/**
 * Trust Ladder Configuration
 * Phase 1 - v2.2 Architecture
 * 
 * Three-tier trust system with explicit promotion thresholds.
 */

// Promotion thresholds
export const TRUST_THRESHOLDS = {
  TIER1_TO_TIER2: {
    min_runs: 20,
    min_approval_rate: 0.90,
    min_consecutive: 5,
  },
  TIER2_TO_TIER3: {
    min_runs: 40,
    min_approval_rate: 0.95,
    min_consecutive: 10,
  },
  REGRESSION: {
    error_rate_threshold: 0.15, // 15% error rate triggers regression
    cooldown_hours: 24,
  },
};

// Trust gates by project type
export const TRUST_GATES = {
  YOUTUBE: {
    gates: ['approve_script', 'approve_storyboard', 'pre_upload_review'],
    descriptions: {
      approve_script: 'Review and approve video script before production',
      approve_storyboard: 'Review visual storyboard before rendering',
      pre_upload_review: 'Final review before YouTube upload',
    },
  },
  B2B_OUTREACH: {
    gates: ['approve_email', 'approve_social_posts'],
    descriptions: {
      approve_email: 'Review cold outreach email (Tier 1: every email)',
      approve_social_posts: 'Review social media content batch',
    },
  },
  COMPETITIONS: {
    gates: ['approve_batch_queue'],
    descriptions: {
      approve_batch_queue: 'Review daily competition batch',
    },
  },
};

// Tier descriptions
export const TIER_DESCRIPTIONS = {
  1: {
    name: 'Full Approval',
    description: 'Every execution requires explicit human approval',
    auto_approve: false,
    batch_approve: false,
    approval_required: true,
  },
  2: {
    name: 'Batch Digest',
    description: 'Daily batch approval for routine executions',
    auto_approve: false,
    batch_approve: true,
    approval_required: true,
  },
  3: {
    name: 'Autopilot',
    description: 'Full autonomy with exception reporting',
    auto_approve: true,
    batch_approve: false,
    approval_required: false,
  },
};

// Decision types
export const DECISION_TYPES = {
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MODIFIED: 'modified',
};

// Gate status
export const GATE_STATUS = {
  PENDING: 'pending',
  PASSED: 'passed',
  BLOCKED: 'blocked',
  SKIPPED: 'skipped',
};

// Helper: Calculate if workflow should be promoted
export function shouldPromote(trustRecord, targetTier) {
  const { run_count, approval_count, consecutive_approvals } = trustRecord;
  
  if (targetTier === 2) {
    const rate = run_count > 0 ? approval_count / run_count : 0;
    return (
      run_count >= TRUST_THRESHOLDS.TIER1_TO_TIER2.min_runs &&
      rate >= TRUST_THRESHOLDS.TIER1_TO_TIER2.min_approval_rate &&
      consecutive_approvals >= TRUST_THRESHOLDS.TIER1_TO_TIER2.min_consecutive
    );
  }
  
  if (targetTier === 3) {
    const rate = run_count > 0 ? approval_count / run_count : 0;
    return (
      run_count >= TRUST_THRESHOLDS.TIER2_TO_TIER3.min_runs &&
      rate >= TRUST_THRESHOLDS.TIER2_TO_TIER3.min_approval_rate &&
      consecutive_approvals >= TRUST_THRESHOLDS.TIER2_TO_TIER3.min_consecutive
    );
  }
  
  return false;
}

// Helper: Check if workflow should be regressed
export function shouldRegress(trustRecord, recentEvents) {
  if (trustRecord.current_tier <= 1) return false;
  if (trustRecord.tier_locked) return false;
  
  // Check cooldown
  if (trustRecord.last_regression_at) {
    const hoursSince = (Date.now() - new Date(trustRecord.last_regression_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < TRUST_THRESHOLDS.REGRESSION.cooldown_hours) return false;
  }
  
  // Check recent error rate
  const recentDecisions = recentEvents.slice(-10);
  if (recentDecisions.length < 5) return false; // Need minimum sample
  
  const rejections = recentDecisions.filter(e => e.decision === DECISION_TYPES.REJECTED).length;
  const errorRate = rejections / recentDecisions.length;
  
  return errorRate >= TRUST_THRESHOLDS.REGRESSION.error_rate_threshold;
}

// Helper: Get gates for a project type
export function getGatesForProject(projectType) {
  const config = TRUST_GATES[projectType.toUpperCase()];
  return config ? config.gates : [];
}

// Helper: Check if gate requires approval at given tier
export function gateRequiresApproval(gateName, tier, projectType) {
  const gates = getGatesForProject(projectType);
  const gateIndex = gates.indexOf(gateName);
  
  if (gateIndex === -1) return true; // Unknown gate = require approval
  
  // Tier 1: All gates require approval
  if (tier === 1) return true;
  
  // Tier 2: First gate often requires approval, later gates may be batched
  if (tier === 2) {
    // First gate usually still requires individual approval
    if (gateIndex === 0) return true;
    // Later gates may be batched (depends on project)
    return projectType.toUpperCase() !== 'COMPETITIONS';
  }
  
  // Tier 3: No approval required (except high-value exceptions)
  return false;
}

export default {
  TRUST_THRESHOLDS,
  TRUST_GATES,
  TIER_DESCRIPTIONS,
  DECISION_TYPES,
  GATE_STATUS,
  shouldPromote,
  shouldRegress,
  getGatesForProject,
  gateRequiresApproval,
};
