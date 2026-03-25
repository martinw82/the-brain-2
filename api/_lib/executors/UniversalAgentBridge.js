// api/executors/UniversalAgentBridge.js — Universal Agent Bridge (Phase 1)
// Brain OS v2.2
//
// Routes Execution Packages to capable workers.
// Creates/updates REL nodes on every handoff.
// Pre-execute: createNode pending
// Post-execute: realizeNode with output + generated_by edge

import { createNode, realizeNode, linkNodes } from '../../src/entityGraph.js';
import { checkGate } from '../trustLadder.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';
import { OpenClawAdapter } from './OpenClawAdapter.js';

// Worker adapter registry
const ADAPTERS = {
  cli_subprocess: ClaudeCodeAdapter,
  websocket: OpenClawAdapter,
  // mcp: MCPAdapter, // Future
};

/**
 * Validate that the worker has the required capabilities.
 */
function validateCapabilities(workerCapabilities, requiredCapabilities) {
  if (!requiredCapabilities || requiredCapabilities.length === 0) return true;

  const caps = workerCapabilities || {};
  return requiredCapabilities.every(req => {
    if (typeof req === 'string') {
      return caps[req] === true || caps[req] !== undefined;
    }
    return true;
  });
}

/**
 * Validate the execution package has a policy_id (MAPL stub).
 * In Phase 1, we only check presence. Full signing in Phase 6.
 */
function validatePolicy(executionPackage) {
  const policyId = executionPackage?.security?.policy_id;
  if (!policyId) {
    console.warn('[UAB] Warning: Execution package missing policy_id. Allowing in Phase 1 (stub).');
  }
  return true; // Phase 1: always allow, just warn
}

/**
 * Select the best available worker for the execution package.
 */
async function selectWorker(db, requiredCapabilities) {
  const [workers] = await db.execute(
    "SELECT * FROM worker_capabilities WHERE status = 'online' ORDER BY last_seen DESC"
  );

  for (const worker of workers) {
    const caps = typeof worker.capabilities === 'string'
      ? JSON.parse(worker.capabilities)
      : worker.capabilities;

    if (validateCapabilities(caps, requiredCapabilities)) {
      return { ...worker, capabilities: caps };
    }
  }

  return null;
}

/**
 * Execute a task through the Universal Agent Bridge.
 *
 * @param {object} db - Database connection
 * @param {object} executionPackage - Full execution package (PRD format)
 * @returns {object} - Execution result with callback data
 */
export async function executeViaUAB(db, executionPackage) {
  const {
    execution_id,
    brain_context,
    execution_package: execPkg,
  } = executionPackage;

  const taskUri = brain_context?.task_uri;
  const dependsOn = brain_context?.depends_on || [];
  const outputUris = brain_context?.output_uris || [];
  const trustTier = brain_context?.trust_tier || 1;
  const traceEnvelope = brain_context?.trace_envelope || {};

  // 1. Validate policy (MAPL stub)
  validatePolicy(executionPackage);

  // 2. Create pending REL node for the task
  if (taskUri) {
    try {
      await createNode(db, taskUri, 'task', 'project', 'trace', {
        execution_id,
        trace_envelope: traceEnvelope,
      });

      // Create depends_on edges
      for (const depUri of dependsOn) {
        try {
          await linkNodes(db, taskUri, depUri, 'depends_on');
        } catch { /* dependency node may not exist yet */ }
      }
    } catch (e) {
      // Node may already exist — that's OK
      if (!e.message.includes('Duplicate')) throw e;
    }
  }

  // 3. Select a capable worker
  const requiredCaps = execPkg?.capabilities_required || [];
  const worker = await selectWorker(db, requiredCaps);

  if (!worker) {
    const error = `No online worker with capabilities: ${requiredCaps.join(', ')}`;
    return { status: 'failed', error, execution_id };
  }

  // 4. Get the adapter for this worker type
  const AdapterClass = ADAPTERS[worker.type];
  if (!AdapterClass) {
    return { status: 'failed', error: `No adapter for worker type: ${worker.type}`, execution_id };
  }

  // 5. Execute via adapter
  const adapter = new AdapterClass(worker);
  const startTime = Date.now();

  let result;
  try {
    result = await adapter.execute(execPkg);
  } catch (e) {
    result = { status: 'failed', error: e.message };
  }

  const durationMs = Date.now() - startTime;

  // 6. Log execution
  await db.execute(
    `INSERT INTO execution_log (run_id, parent_run_id, workflow_id, worker_id, provider, cost_usd, tokens_used, duration_ms, quality_score, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      traceEnvelope.run_id || execution_id,
      traceEnvelope.parent_run_id || null,
      brain_context?.workflow_id || null,
      worker.worker_id,
      result.provider || null,
      result.cost_usd || null,
      result.tokens_used || null,
      durationMs,
      result.quality_score || null,
      result.status || 'unknown',
    ]
  );

  // 7. Realize the REL node if successful
  if (result.status === 'success' && taskUri) {
    const checksum = result.output?.checksum || null;
    await realizeNode(db, taskUri, result.output, checksum);

    // Create output entities and generated_by edges
    for (const outUri of outputUris) {
      try {
        await createNode(db, outUri, 'asset', 'project', 'episodic', {
          generated_from: taskUri,
        });
        await linkNodes(db, outUri, taskUri, 'generated_by');
      } catch { /* may already exist */ }
    }
  }

  // 8. Return callback-format result
  return {
    task_id: taskUri,
    run_id: traceEnvelope.run_id || execution_id,
    status: result.status || 'failed',
    output: result.output || null,
    cost_usd: result.cost_usd || 0,
    tokens_used: result.tokens_used || 0,
    duration_ms: durationMs,
    quality_score: result.quality_score || null,
    worker_id: worker.worker_id,
  };
}

export default { executeViaUAB };
