// api/trustLadder.js — Trust Ladder Core Logic (Phase 1)
// Brain OS v2.2
//
// Three exported functions:
//   initWorkflowTrust(db, workflowId, projectId) — register a new workflow
//   checkGate(db, workflowId, gateName) — check if gate needs human approval
//   recordGateDecision(db, workflowId, runId, gateName, decision, decidedBy, notes)

import {
  PROMOTION_THRESHOLDS,
  REGRESSION_RULES,
} from '../../src/config/trustLadder.js';

/**
 * Register a new workflow in the Trust Ladder at Tier 1.
 */
export async function initWorkflowTrust(db, workflowId, projectId) {
  const [existing] = await db.execute(
    'SELECT id FROM workflow_trust WHERE workflow_id = ?',
    [workflowId]
  );

  if (existing.length > 0) {
    return existing[0];
  }

  await db.execute(
    `INSERT INTO workflow_trust (workflow_id, project_id, current_tier)
     VALUES (?, ?, 1)`,
    [workflowId, projectId]
  );

  return { workflow_id: workflowId, project_id: projectId, current_tier: 1 };
}

/**
 * Check whether a gate requires human approval based on current trust tier.
 *
 * Returns: { needs_approval: boolean, current_tier: number, workflow_id: string }
 */
export async function checkGate(db, workflowId, gateName) {
  const [rows] = await db.execute(
    'SELECT * FROM workflow_trust WHERE workflow_id = ?',
    [workflowId]
  );

  if (rows.length === 0) {
    // Unregistered workflow — always requires approval
    return { needs_approval: true, current_tier: 1, workflow_id: workflowId };
  }

  const trust = rows[0];

  // Tier 1: Always needs approval
  if (trust.current_tier === 1) {
    return { needs_approval: true, current_tier: 1, workflow_id: workflowId };
  }

  // Tier 2: Batch digest — still needs approval but can be batched
  if (trust.current_tier === 2) {
    return { needs_approval: true, current_tier: 2, workflow_id: workflowId, batch: true };
  }

  // Tier 3: Autopilot — no approval needed
  return { needs_approval: false, current_tier: 3, workflow_id: workflowId };
}

/**
 * Record a gate decision and update trust metrics.
 * Handles auto-promotion and auto-regression.
 */
export async function recordGateDecision(db, workflowId, runId, gateName, decision, decidedBy = 'user', notes = null) {
  // Record the event
  await db.execute(
    `INSERT INTO trust_events (workflow_id, run_id, gate_name, decision, decided_by, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [workflowId, runId, gateName, decision, decidedBy, notes]
  );

  // Get current trust state
  const [rows] = await db.execute(
    'SELECT * FROM workflow_trust WHERE workflow_id = ?',
    [workflowId]
  );

  if (rows.length === 0) return null;

  const trust = rows[0];

  if (trust.tier_locked) {
    return trust; // Frozen — no promotion/regression
  }

  const isApproved = decision === 'approved';

  // Update counters
  const newRunCount = trust.run_count + 1;
  const newApprovalCount = trust.approval_count + (isApproved ? 1 : 0);
  const newConsecutive = isApproved ? trust.consecutive_approvals + 1 : 0;

  let newTier = trust.current_tier;
  let promotedAt2 = trust.promoted_to_tier2_at;
  let promotedAt3 = trust.promoted_to_tier3_at;
  let regressionAt = trust.last_regression_at;

  // Check promotion: Tier 1 → 2
  if (trust.current_tier === 1) {
    const threshold = PROMOTION_THRESHOLDS.TIER_1_TO_2;
    const approvalRate = newApprovalCount / newRunCount;
    if (
      newRunCount >= threshold.min_runs &&
      approvalRate >= threshold.min_approval_rate &&
      newConsecutive >= threshold.min_consecutive_approvals
    ) {
      newTier = 2;
      promotedAt2 = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  // Check promotion: Tier 2 → 3
  if (trust.current_tier === 2) {
    const threshold = PROMOTION_THRESHOLDS.TIER_2_TO_3;
    const approvalRate = newApprovalCount / newRunCount;
    if (
      newRunCount >= threshold.min_runs &&
      approvalRate >= threshold.min_approval_rate &&
      newConsecutive >= threshold.min_consecutive_approvals
    ) {
      newTier = 3;
      promotedAt3 = new Date().toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  // Check regression: Tier 3 → 2
  if (trust.current_tier === 3) {
    // Check error rate in last N runs
    const [recentEvents] = await db.execute(
      `SELECT decision FROM trust_events
       WHERE workflow_id = ? ORDER BY decided_at DESC LIMIT ?`,
      [workflowId, REGRESSION_RULES.lookback_window]
    );

    if (recentEvents.length >= REGRESSION_RULES.lookback_window) {
      const errorCount = recentEvents.filter(e => e.decision !== 'approved').length;
      const errorRate = errorCount / recentEvents.length;

      if (errorRate >= REGRESSION_RULES.error_rate_threshold) {
        // Check cooldown
        const cooldownOk = !trust.last_regression_at ||
          (Date.now() - new Date(trust.last_regression_at).getTime()) > REGRESSION_RULES.cooldown_hours * 3600000;

        if (cooldownOk) {
          newTier = 2;
          regressionAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
      }
    }
  }

  // Update trust state
  await db.execute(
    `UPDATE workflow_trust SET
       run_count = ?, approval_count = ?, consecutive_approvals = ?,
       current_tier = ?, promoted_to_tier2_at = ?, promoted_to_tier3_at = ?,
       last_regression_at = ?, updated_at = NOW()
     WHERE workflow_id = ?`,
    [newRunCount, newApprovalCount, newConsecutive, newTier, promotedAt2, promotedAt3, regressionAt, workflowId]
  );

  return {
    ...trust,
    run_count: newRunCount,
    approval_count: newApprovalCount,
    consecutive_approvals: newConsecutive,
    current_tier: newTier,
  };
}
