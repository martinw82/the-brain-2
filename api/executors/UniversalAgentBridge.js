/**
 * Universal Agent Bridge (UAB)
 * Phase 1 - v2.2 Architecture
 * 
 * Routes Execution Packages to capable workers.
 * Creates/updates REL nodes on every handoff.
 * 
 * The Brain (Planner) → UAB (Bridge) → Worker (Executor)
 */

import { db } from '../../src/db/index.ts';
import { worker_capabilities, execution_log } from '../../src/db/schema.ts';
import { eq, and, inArray } from 'drizzle-orm';
import { createNode, realizeNode, createLink } from '../../src/entityGraph.js';
import { ClaudeCodeAdapter } from './adapters/ClaudeCodeAdapter.js';
import { OpenClawAdapter } from './adapters/OpenClawAdapter.js';

// Adapter registry
const ADAPTERS = {
  cli_subprocess: ClaudeCodeAdapter,
  websocket: OpenClawAdapter,
  mcp: null, // Future
};

/**
 * Validate an Execution Package
 * @param {Object} pkg - Execution Package
 * @returns {Object} - Validation result
 */
function validateExecutionPackage(pkg) {
  const errors = [];
  
  if (!pkg.execution_id) errors.push('execution_id is required');
  if (!pkg.brain_context?.task_uri) errors.push('brain_context.task_uri is required');
  if (!pkg.execution_package?.capabilities_required) errors.push('execution_package.capabilities_required is required');
  if (!pkg.execution_package?.main_command) errors.push('execution_package.main_command is required');
  if (!pkg.security?.policy_id) errors.push('security.policy_id is required (MAPL stub)');
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Find a capable worker for the execution
 * @param {Array<string>} requiredCapabilities - Required capabilities
 * @returns {Promise<Object|null>} - Worker record or null
 */
async function findCapableWorker(requiredCapabilities) {
  // Get online workers
  const workers = await db.select()
    .from(worker_capabilities)
    .where(eq(worker_capabilities.status, 'online'));
  
  if (workers.length === 0) return null;
  
  // Score workers by capability match
  const scored = workers.map(worker => {
    const caps = worker.capabilities || {};
    let score = 0;
    let allRequired = true;
    
    for (const req of requiredCapabilities) {
      if (caps[req] === true) {
        score += 1;
      } else if (typeof caps[req] === 'object') {
        score += 1;
      } else {
        allRequired = false;
      }
    }
    
    return { worker, score, allRequired };
  });
  
  // Filter to workers with all required capabilities, sort by score
  const capable = scored
    .filter(s => s.allRequired)
    .sort((a, b) => b.score - a.score);
  
  return capable[0]?.worker || null;
}

/**
 * Route an Execution Package to a worker
 * @param {Object} executionPackage - The execution package
 * @returns {Promise<Object>} - Execution result
 */
export async function routeExecution(executionPackage) {
  const startTime = Date.now();
  
  // 1. Validate package
  const validation = validateExecutionPackage(executionPackage);
  if (!validation.valid) {
    throw new Error(`Invalid execution package: ${validation.errors.join(', ')}`);
  }
  
  const { 
    execution_id, 
    brain_context, 
    execution_package,
    security,
    timeout = 3600,
    callback_url,
  } = executionPackage;
  
  const { task_uri, depends_on, output_uris, trust_tier, trace_envelope } = brain_context;
  
  // 2. Create pending entity nodes in REL
  try {
    // Create task entity
    await createNode(task_uri, 'task', 'project', 'trace', {
      execution_id,
      trust_tier,
      policy_id: security.policy_id,
    });
    
    // Create output entities
    if (output_uris) {
      for (const outputUri of output_uris) {
        await createNode(outputUri, 'asset', 'project', 'trace', {
          execution_id,
          pending: true,
        });
        
        // Link output to task (will be realized on completion)
        await createLink(task_uri, outputUri, 'generates', 1.0);
      }
    }
    
    // Link dependencies
    if (depends_on) {
      for (const depUri of depends_on) {
        await createLink(depUri, task_uri, 'depends_on', 1.0);
      }
    }
  } catch (error) {
    console.error('REL node creation failed:', error);
    // Continue - REL failure shouldn't block execution
  }
  
  // 3. Find capable worker
  const worker = await findCapableWorker(execution_package.capabilities_required);
  
  if (!worker) {
    // Log failed execution
    await db.insert(execution_log).values({
      id: crypto.randomUUID(),
      run_id: execution_id,
      parent_run_id: trace_envelope?.parent_run_id,
      workflow_id: trace_envelope?.workflow_id,
      worker_id: null,
      provider: null,
      status: 'failed',
      duration_ms: Date.now() - startTime,
    });
    
    throw new Error('No capable worker available for required capabilities: ' + 
      execution_package.capabilities_required.join(', '));
  }
  
  // 4. Get appropriate adapter
  const AdapterClass = ADAPTERS[worker.type];
  if (!AdapterClass) {
    throw new Error(`No adapter available for worker type: ${worker.type}`);
  }
  
  const adapter = new AdapterClass(worker);
  
  // 5. Execute
  let result;
  try {
    result = await adapter.execute(execution_package, {
      onProgress: (progress) => {
        // POST progress to checkpoint_url if provided
        if (execution_package.checkpoint_url) {
          fetch(execution_package.checkpoint_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              run_id: execution_id,
              progress,
              timestamp: new Date().toISOString(),
            }),
          }).catch(err => console.error('Checkpoint POST failed:', err));
        }
      },
      timeout,
    });
    
    // 6. Realize output entities
    if (result.status === 'success' && result.output) {
      try {
        await realizeNode(task_uri, { 
          completed: true, 
          output: result.output,
          duration_ms: result.duration_ms,
        });
        
        if (output_uris && result.output.uri) {
          await realizeNode(result.output.uri, result.output, result.output.checksum);
        }
      } catch (error) {
        console.error('REL realize failed:', error);
      }
    }
    
    // 7. Log execution
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
      quality_score: result.quality_score,
      status: result.status,
    });
    
    // 8. Callback if provided
    if (callback_url) {
      fetch(callback_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: execution_id,
          run_id: execution_id,
          status: result.status,
          output: result.output,
          cost_usd: result.cost_usd,
          tokens_used: result.tokens_used,
          duration_ms: result.duration_ms,
          quality_score: result.quality_score,
        }),
      }).catch(err => console.error('Callback failed:', err));
    }
    
    return {
      execution_id,
      status: result.status,
      worker_id: worker.worker_id,
      output: result.output,
      cost: {
        usd: result.cost_usd,
        tokens: result.tokens_used,
      },
      duration_ms: result.duration_ms || Date.now() - startTime,
    };
    
  } catch (error) {
    // Log failed execution
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

/**
 * Register a new worker
 * @param {Object} workerConfig - Worker configuration
 * @returns {Promise<Object>} - Created worker record
 */
export async function registerWorker(workerConfig) {
  const { worker_id, type, capabilities } = workerConfig;
  
  if (!worker_id || !type || !capabilities) {
    throw new Error('worker_id, type, and capabilities are required');
  }
  
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

/**
 * Update worker heartbeat
 * @param {string} workerId - Worker ID
 * @param {string} status - Worker status
 * @returns {Promise<Object>} - Updated worker record
 */
export async function workerHeartbeat(workerId, status = 'online') {
  await db.update(worker_capabilities)
    .set({ 
      status,
      last_seen: new Date(),
      updated_at: new Date(),
    })
    .where(eq(worker_capabilities.worker_id, workerId));
  
  return { worker_id: workerId, status, timestamp: new Date() };
}

/**
 * List available workers
 * @returns {Promise<Array>} - Array of worker records
 */
export async function listWorkers() {
  const workers = await db.select().from(worker_capabilities);
  
  return workers.map(w => ({
    ...w,
    capabilities: JSON.parse(w.capabilities || '{}'),
  }));
}

// Default export
export default {
  routeExecution,
  registerWorker,
  workerHeartbeat,
  listWorkers,
};
