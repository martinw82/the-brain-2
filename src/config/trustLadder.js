/**
 * Trust Ladder Configuration — Phase 1
 * Brain OS v2.2
 *
 * Constants for trust tier thresholds, regression rules,
 * and per-project gate maps.
 */

// ── Tier Definitions ────────────────────────────────────────────

export const TIERS = {
  FULL_APPROVAL: 1, // Every action reviewed individually
  BATCH_DIGEST: 2, // Batch approval, routine items grouped
  AUTOPILOT: 3, // Full autonomy, human override only
};

// ── Promotion Thresholds ────────────────────────────────────────

export const PROMOTION_THRESHOLDS = {
  // Tier 1 → Tier 2
  TIER_1_TO_2: {
    min_runs: 20,
    min_approval_rate: 0.9,
    min_consecutive_approvals: 5,
  },
  // Tier 2 → Tier 3
  TIER_2_TO_3: {
    min_runs: 40,
    min_approval_rate: 0.95,
    min_consecutive_approvals: 10,
  },
};

// ── Regression Rules ────────────────────────────────────────────

export const REGRESSION_RULES = {
  // Tier 3 → Tier 2 (auto)
  error_rate_threshold: 0.15, // ≥15% error/rejection in last 10 runs
  lookback_window: 10, // Number of recent runs to check
  cooldown_hours: 24, // Minimum time before re-promotion
};

// ── Per-Project Gate Maps ───────────────────────────────────────
// Each project defines named gates and their positions in the pipeline.

export const PROJECT_GATES = {
  'youtube-longform-documentary': {
    gates: [
      { name: 'approve_script', label: 'Approve Script', position: 6 },
      { name: 'approve_storyboard', label: 'Approve Storyboard', position: 10 },
      { name: 'pre_upload_review', label: 'Pre-Upload Review', position: 12 },
    ],
  },
  'b2b-outreach': {
    gates: [
      { name: 'approve_email', label: 'Approve Email', position: 1 },
      { name: 'approve_social', label: 'Approve Social Posts', position: 2 },
    ],
  },
  'competition-batch-submit': {
    gates: [
      {
        name: 'approve_batch',
        label: 'Approve Competition Batch',
        position: 4,
      },
      {
        name: 'approve_creative',
        label: 'Approve Creative (high-value)',
        position: 7,
        condition: 'prize_value > 500',
      },
    ],
  },
};

// ── Trust Tier Labels ───────────────────────────────────────────

export const TIER_LABELS = {
  1: 'Full Approval',
  2: 'Batch Digest',
  3: 'Autopilot',
};

export default {
  TIERS,
  PROMOTION_THRESHOLDS,
  REGRESSION_RULES,
  PROJECT_GATES,
  TIER_LABELS,
};
