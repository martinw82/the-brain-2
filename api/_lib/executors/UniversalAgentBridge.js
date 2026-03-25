/**
 * Universal Agent Bridge (UAB)
 * Routes Execution Packages to capable workers.
 */

import { db } from '../../../src/db/index.ts';
import { worker_capabilities, execution_log } from '../../../src/db/schema.ts';
// Note: These imports use relative paths from api/_lib/executors/ to src/
import { eq, and, inArray } from 'drizzle-orm';

const ADAPTERS = {
  cli_subprocess: null, // Lazy load to avoid circular deps
  websocket: null,
  mcp: null,
};

function validateExecutionPackage(pkg) {
  const errors = [];
  if (!pkg.execution_id) errors.push('execution_id is required');
  if (!pkg.brain_context?.task_uri) errors.push('brain_context.task_uri is required');
  if (!pkg.execution_package?.capabilities_required) errors.push('execution_package.capabilities_required is required');
  if (!pkg.execution_package?.main_command) errors.push('execution_package.main_command is required');
  return { valid: errors.length === 0, errors };
}

async function findCapableWorker(requiredCapabilities) {
  const workers = await db.select()
    .from(worker_capabilities)
    .where(eq(worker_capabilities.status, 'online'));
  
  if (workers.length === 0) return null;
  
  const scored = workers.map(worker => {
    const caps = worker.capabilities || {};
    let score = 0;
    let allRequired = true;
    
    for (const req of requiredCapabilities) {
      if (caps[req] === true || typeof caps[req] === 'object') {
        score += 1;
      } else {
        allRequired = false;
      }
    }
    
    return { worker, score, allRequired };
  });
  
  const capable = scored
    .filter(s => s.allRequired)
    .sort((a, b) => b.score - a.score);
  
  return capable[0]?.worker || null;
}

export async function routeExecution(executionPackage) {
  const startTime = Date.now();
  
  const validation = validateExecutionPackage(executionPackage);
  if (!validation.valid) {
    throw new Error(`Invalid execution package: ${validation.errors.join(', ')}`);
  }
  
  const { execution_id, brain_context, execution_package, trace_envelope } = executionPackage;
  
  const worker = await findCapableWorker(execution_package.capabilities_required);
  
  if (!worker) {
    await db.insert(execution_log).values({
      id: crypto.randomUUID(),
      run_id: execution_id,
      parent_run_id: trace_envelope?.parent_run_id,
      workflow_id: trace_envelope?.workflow_id,
      status: 'failed',
      duration_ms: Date.now() - startTime,
    });
    
    throw new Error('No capable worker available');
  }
  
  // Lazy load adapter
  if (!ADAPTERS.cli_subprocess) {
    const { ClaudeCodeAdapter } = await import('./ClaudeCodeAdapter.js');
    ADAPTERS.cli_subprocess = ClaudeCodeAdapter;
  }
  
  const AdapterClass = ADAPTERS[worker.type] || ADAPTERS.cli_subprocess;
  const adapter = new AdapterClass(worker);
  
  try {
    const result = await adapter.execute(executionPackage, { timeout: executionPackage.timeout });
    
    await db.insert(execution_log).values({
      id: crypto.randomUUID(),
      run_id: execution_id,
      parent_run_id: trace_envelope?.parent_run_id,
      workflow_id: trace_envelope?.workflow_id,
      worker_id: worker.worker_id,
      provider: result.provider,
      cost_usd: result.cost_usd,
      tokens_used: result.tokens_used,
      duration_ms: result.duration_ms || Date.now() - startTime,
      status: result.status,
    });
    
    return {
      execution_id,
      status: result.status,
      worker_id: worker.worker_id,
      output: result.output,
      duration_ms: result.duration_ms || Date.now() - startTime,
    };
    
  } catch (error) {
    await db.insert(execution_log).values({
      id: crypto.randomUUID(),
      run_id: execution_id,
      parent_run_id: trace_envelope?.parent_run_id,
      workflow_id: trace_envelope?.workflow_id,
      worker_id: worker.worker_id,
      status: 'failed',
      duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}

export async function registerWorker(workerConfig) {
  const { worker_id, type, capabilities } = workerConfig;
  
  const worker = {
    worker_id,
    type,
    capabilities: JSON.stringify(capabilities),
    status: 'online',
    last_seen: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.insert(worker_capabilities).values(worker);
  return { ...worker, capabilities };
}

export async function workerHeartbeat(workerId, status = 'online') {
  await db.update(worker_capabilities)
    .set({ status, last_seen: new Date(), updated_at: new Date() })
    .where(eq(worker_capabilities.worker_id, workerId));
  
  return { worker_id: workerId, status, timestamp: new Date() };
}

export async function listWorkers() {
  const workers = await db.select().from(worker_capabilities);
  return workers.map(w => ({ ...w, capabilities: JSON.parse(w.capabilities || '{}') }));
}

export default {
  routeExecution,
  registerWorker,
  workerHeartbeat,
  listWorkers,
};
