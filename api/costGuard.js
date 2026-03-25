// api/costGuard.js — Cost Guard (Phase 5)
// Brain OS v2.2
//
// Five exported functions:
//   getMonthlySpend(db) — current month's total spend in GBP
//   checkBudget(db) — budget status with alerts
//   suggestProvider(db, preferredProvider) — downgrade provider if over alert threshold
//   recordCost(db, runId, provider, costUsd, tokensUsed) — log cost to execution_log
//   getProviderStats(db, days) — aggregate cost/tokens/runs by provider

// --- Constants ---

export const MONTHLY_BUDGET_GBP = 15;
export const ALERT_THRESHOLD = 0.8;
export const HARD_CAP_THRESHOLD = 0.95;
export const PROVIDER_FALLBACK_ORDER = ['claude-haiku', 'claude-sonnet', 'claude-opus'];

const USD_TO_GBP = 0.79;

/**
 * Query execution_log for the current month's total spend, converted to GBP.
 *
 * @param {object} db - Database connection
 * @returns {number} Total spend in GBP for the current calendar month
 */
export async function getMonthlySpend(db) {
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total_usd
     FROM execution_log
     WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
       AND created_at < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')`
  );

  const totalUsd = parseFloat(rows[0].total_usd) || 0;
  return totalUsd * USD_TO_GBP;
}

/**
 * Check whether the current monthly spend is within budget.
 *
 * @param {object} db - Database connection
 * @returns {{ allowed: boolean, spend_gbp: number, budget_gbp: number, percentage: number, alert: boolean }}
 */
export async function checkBudget(db) {
  const spendGbp = await getMonthlySpend(db);
  const percentage = spendGbp / MONTHLY_BUDGET_GBP;

  return {
    allowed: percentage < HARD_CAP_THRESHOLD,
    spend_gbp: Math.round(spendGbp * 100) / 100,
    budget_gbp: MONTHLY_BUDGET_GBP,
    percentage: Math.round(percentage * 1000) / 1000,
    alert: percentage >= ALERT_THRESHOLD,
  };
}

/**
 * Suggest a cheaper provider if spend is over the alert threshold.
 * Returns the preferred provider if budget is healthy, otherwise
 * walks down the fallback order to find a cheaper alternative.
 *
 * @param {object} db - Database connection
 * @param {string} preferredProvider - The provider the caller would like to use
 * @returns {{ provider: string, downgraded: boolean, reason: string | null }}
 */
export async function suggestProvider(db, preferredProvider) {
  const budget = await checkBudget(db);

  if (!budget.alert) {
    return { provider: preferredProvider, downgraded: false, reason: null };
  }

  const preferredIndex = PROVIDER_FALLBACK_ORDER.indexOf(preferredProvider);

  // If preferred provider is unknown or already the cheapest, keep it
  if (preferredIndex <= 0) {
    return {
      provider: preferredProvider,
      downgraded: false,
      reason: budget.allowed ? null : 'hard_cap_reached',
    };
  }

  // Walk down to a cheaper provider
  const suggestedProvider = budget.percentage >= HARD_CAP_THRESHOLD
    ? PROVIDER_FALLBACK_ORDER[0] // cheapest if near hard cap
    : PROVIDER_FALLBACK_ORDER[Math.max(0, preferredIndex - 1)];

  return {
    provider: suggestedProvider,
    downgraded: suggestedProvider !== preferredProvider,
    reason: budget.percentage >= HARD_CAP_THRESHOLD
      ? 'hard_cap_near'
      : 'alert_threshold_exceeded',
  };
}

/**
 * Insert or update cost fields for a run in execution_log.
 *
 * @param {object} db - Database connection
 * @param {string} runId - The execution run ID
 * @param {string} provider - Provider name (e.g. 'claude-sonnet')
 * @param {number} costUsd - Cost in USD
 * @param {number} tokensUsed - Number of tokens consumed
 */
export async function recordCost(db, runId, provider, costUsd, tokensUsed) {
  // Try update first; if no row exists, insert a minimal record
  const [result] = await db.execute(
    `UPDATE execution_log
     SET provider = ?, cost_usd = ?, tokens_used = ?, updated_at = NOW()
     WHERE run_id = ?`,
    [provider, costUsd, tokensUsed, runId]
  );

  if (result.affectedRows === 0) {
    await db.execute(
      `INSERT INTO execution_log (run_id, provider, cost_usd, tokens_used, status)
       VALUES (?, ?, ?, ?, 'recorded')`,
      [runId, provider, costUsd, tokensUsed]
    );
  }
}

/**
 * Aggregate cost, tokens, and run counts by provider for the last N days.
 *
 * @param {object} db - Database connection
 * @param {number} [days=30] - Number of days to look back
 * @returns {Array<{ provider: string, total_cost_usd: number, total_cost_gbp: number, total_tokens: number, run_count: number }>}
 */
export async function getProviderStats(db, days = 30) {
  const [rows] = await db.execute(
    `SELECT
       provider,
       COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
       COALESCE(SUM(tokens_used), 0) AS total_tokens,
       COUNT(*) AS run_count
     FROM execution_log
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       AND provider IS NOT NULL
     GROUP BY provider
     ORDER BY total_cost_usd DESC`,
    [days]
  );

  return rows.map(row => ({
    provider: row.provider,
    total_cost_usd: Math.round(parseFloat(row.total_cost_usd) * 10000) / 10000,
    total_cost_gbp: Math.round(parseFloat(row.total_cost_usd) * USD_TO_GBP * 10000) / 10000,
    total_tokens: parseInt(row.total_tokens, 10),
    run_count: parseInt(row.run_count, 10),
  }));
}
