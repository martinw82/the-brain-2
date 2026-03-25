/**
 * Trust Ladder Core Module
 * Phase 1 - v2.2 Architecture
 * 
 * Manages workflow trust tiers, gate decisions, and promotion/regression.
 */

import { db } from '../../src/db/index.ts';
import { workflow_trust, trust_events } from '../../src/db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import {
  TRUST_THRESHOLDS,
  TIER_DESCRIPTIONS,
  DECISION_TYPES,
  shouldPromote,
  shouldRegress,
} from '../../src/config/trustLadder.js';

/**
 * Initialize trust tracking for a new workflow
 * @param {string} workflowId - Workflow identifier
 * @param {string} projectId - Project identifier
 * @returns {Promise<Object>} - Created trust record
 */
export async function initWorkflowTrust(workflowId, projectId) {
  if (!workflowId) throw new Error('workflowId is required');
  
  // Check if already exists
  const [existing] = await db.select()
    .from(workflow_trust)
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  if (existing) {
    return { ...existing, initialized: false };
  }
  
  // Create new trust record at Tier 1
  const record = {
    id: crypto.randomUUID(),
    workflow_id: workflowId,
    project_id: projectId,
    current_tier: 1,
    run_count: 0,
    approval_count: 0,
    consecutive_approvals: 0,
    tier_locked: false,
    created_at: new Date(),
    updated_at: new Date(),
  };
  
  await db.insert(workflow_trust).values(record);
  
  return { ...record, initialized: true };
}

/**
 * Check if a workflow can pass a trust gate
 * @param {string} workflowId - Workflow identifier
 * @param {string} gateName - Name of the gate
 * @returns {Promise<Object>} - Gate check result
 */
export async function checkGate(workflowId, gateName) {
  if (!workflowId || !gateName) {
    throw new Error('workflowId and gateName are required');
  }
  
  // Get trust record
  const [trust] = await db.select()
    .from(workflow_trust)
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  if (!trust) {
    return {
      canPass: false,
      reason: 'Workflow trust not initialized',
      action: 'init_required',
    };
  }
  
  // Check if tier is locked
  if (trust.tier_locked) {
    return {
      canPass: false,
      reason: 'Workflow tier is locked',
      current_tier: trust.current_tier,
      action: 'unlock_required',
    };
  }
  
  // Check if gate already has a pending decision
  const [pendingEvent] = await db.select()
    .from(trust_events)
    .where(and(
      eq(trust_events.workflow_id, workflowId),
      eq(trust_events.gate_name, gateName)
    ))
    .orderBy(desc(trust_events.decided_at))
    .limit(1);
  
  // Tier 1: Always requires explicit approval
  if (trust.current_tier === 1) {
    return {
      canPass: pendingEvent?.decision === DECISION_TYPES.APPROVED,
      requiresApproval: true,
      current_tier: 1,
      gate_status: pendingEvent?.decision === DECISION_TYPES.APPROVED 
        ? GATE_STATUS.PASSED 
        : GATE_STATUS.PENDING,
      pending_event: pendingEvent || null,
    };
  }
  
  // Tier 2: Batch approval - first gate may still require individual approval
  if (trust.current_tier === 2) {
    // For now, Tier 2 still requires some approval (batch)
    // Specific logic depends on project type and gate
    const batchApproved = trust.consecutive_approvals >= 5;
    
    return {
      canPass: batchApproved || pendingEvent?.decision === DECISION_TYPES.APPROVED,
      requiresApproval: !batchApproved,
      current_tier: 2,
      gate_status: batchApproved || pendingEvent?.decision === DECISION_TYPES.APPROVED
        ? GATE_STATUS.PASSED
        : GATE_STATUS.PENDING,
      batch_mode: true,
    };
  }
  
  // Tier 3: Autopilot - no approval required
  return {
    canPass: true,
    requiresApproval: false,
    current_tier: 3,
    gate_status: GATE_STATUS.PASSED,
    autopilot: true,
  };
}

/**
 * Record a gate decision and update trust metrics
 * @param {string} workflowId - Workflow identifier
 * @param {string} runId - Run identifier
 * @param {string} gateName - Gate name
 * @param {string} decision - Decision (approved, rejected, modified)
 * @param {string} notes - Optional notes
 * @param {string} decidedBy - Who made the decision
 * @returns {Promise<Object>} - Updated trust state
 */
export async function recordGateDecision(workflowId, runId, gateName, decision, notes = '', decidedBy = null) {
  if (!workflowId || !runId || !gateName || !decision) {
    throw new Error('workflowId, runId, gateName, and decision are required');
  }
  
  if (!Object.values(DECISION_TYPES).includes(decision)) {
    throw new Error(`Invalid decision: ${decision}. Must be one of: ${Object.values(DECISION_TYPES).join(', ')}`);
  }
  
  // Get current trust record
  let [trust] = await db.select()
    .from(workflow_trust)
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  if (!trust) {
    // Auto-initialize
    trust = await initWorkflowTrust(workflowId, null);
  }
  
  // Record the trust event
  const event = {
    id: crypto.randomUUID(),
    workflow_id: workflowId,
    run_id: runId,
    gate_name: gateName,
    decision,
    notes,
    decided_by: decidedBy,
    decided_at: new Date(),
  };
  
  await db.insert(trust_events).values(event);
  
  // Update trust metrics
  const updates = {
    run_count: trust.run_count + 1,
    updated_at: new Date(),
  };
  
  if (decision === DECISION_TYPES.APPROVED) {
    updates.approval_count = trust.approval_count + 1;
    updates.consecutive_approvals = trust.consecutive_approvals + 1;
  } else {
    // Reset consecutive on rejection
    updates.consecutive_approvals = 0;
  }
  
  // Check for promotion
  let promotion = null;
  if (trust.current_tier < 3 && !trust.tier_locked) {
    const nextTier = trust.current_tier + 1;
    if (shouldPromote({ ...trust, ...updates }, nextTier)) {
      updates.current_tier = nextTier;
      updates[`promoted_to_tier${nextTier}_at`] = new Date();
      promotion = {
        from_tier: trust.current_tier,
        to_tier: nextTier,
        reason: `Reached threshold: ${updates.run_count} runs, ${((updates.approval_count / updates.run_count) * 100).toFixed(1)}% approval rate`,
      };
    }
  }
  
  // Check for regression (only if not promoted)
  let regression = null;
  if (!promotion && trust.current_tier > 1 && !trust.tier_locked) {
    const recentEvents = await db.select()
      .from(trust_events)
      .where(eq(trust_events.workflow_id, workflowId))
      .orderBy(desc(trust_events.decided_at))
      .limit(20);
    
    if (shouldRegress(trust, recentEvents)) {
      const newTier = trust.current_tier - 1;
      updates.current_tier = newTier;
      updates.last_regression_at = new Date();
      updates.consecutive_approvals = 0;
      regression = {
        from_tier: trust.current_tier,
        to_tier: newTier,
        reason: `High error rate detected in recent runs`,
      };
    }
  }
  
  // Apply updates
  await db.update(workflow_trust)
    .set(updates)
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  return {
    event,
    trust: { ...trust, ...updates },
    promotion,
    regression,
  };
}

/**
 * Get trust status for a workflow
 * @param {string} workflowId - Workflow identifier
 * @returns {Promise<Object|null>} - Trust record or null
 */
export async function getTrustStatus(workflowId) {
  if (!workflowId) throw new Error('workflowId is required');
  
  const [trust] = await db.select()
    .from(workflow_trust)
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  if (!trust) return null;
  
  // Get recent events
  const recentEvents = await db.select()
    .from(trust_events)
    .where(eq(trust_events.workflow_id, workflowId))
    .orderBy(desc(trust_events.decided_at))
    .limit(10);
  
  // Calculate stats
  const allEvents = await db.select()
    .from(trust_events)
    .where(eq(trust_events.workflow_id, workflowId));
  
  const approvalRate = trust.run_count > 0 
    ? (trust.approval_count / trust.run_count * 100).toFixed(1)
    : 0;
  
  return {
    ...trust,
    tier_name: TIER_DESCRIPTIONS[trust.current_tier]?.name,
    tier_description: TIER_DESCRIPTIONS[trust.current_tier]?.description,
    approval_rate: `${approvalRate}%`,
    recent_events: recentEvents,
    total_events: allEvents.length,
  };
}

/**
 * Lock or unlock a workflow's tier
 * @param {string} workflowId - Workflow identifier
 * @param {boolean} locked - Whether to lock (true) or unlock (false)
 * @param {string} reason - Reason for locking
 * @returns {Promise<Object>} - Updated trust record
 */
export async function setTierLock(workflowId, locked, reason = '') {
  if (!workflowId) throw new Error('workflowId is required');
  
  await db.update(workflow_trust)
    .set({ 
      tier_locked: locked ? 1 : 0,
      updated_at: new Date(),
    })
    .where(eq(workflow_trust.workflow_id, workflowId));
  
  return {
    workflow_id: workflowId,
    locked,
    reason,
    timestamp: new Date(),
  };
}

/**
 * List all workflows with their trust status
 * @param {Object} filters - Optional filters
 * @returns {Promise<Array>} - Array of trust records
 */
export async function listWorkflowTrust(filters = {}) {
  let query = db.select().from(workflow_trust);
  
  if (filters.project_id) {
    query = query.where(eq(workflow_trust.project_id, filters.project_id));
  }
  
  if (filters.tier) {
    query = query.where(eq(workflow_trust.current_tier, filters.tier));
  }
  
  const records = await query;
  
  return records.map(r => ({
    ...r,
    tier_name: TIER_DESCRIPTIONS[r.current_tier]?.name,
  }));
}

// Default export
export default {
  initWorkflowTrust,
  checkGate,
  recordGateDecision,
  getTrustStatus,
  setTierLock,
  listWorkflowTrust,
};
