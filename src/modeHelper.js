/**
 * Mode Helper — Single source of truth for assistance mode behavior
 *
 * Three modes: coach (default), assistant, silent
 * Every mode-sensitive feature calls into this module.
 */

const MODE_MATRIX = {
  daily_checkin:         { coach: 'mandatory', assistant: 'available', silent: 'off' },
  drift_alerts:          { coach: 'alert',     assistant: 'badge',     silent: 'off' },
  outreach_enforcement:  { coach: 'modal',     assistant: 'tracked',   silent: 'off' },
  ai_coach_tab:          { coach: 'full',      assistant: 'no_presets', silent: 'hidden' },
  notifications:         { coach: 'all',       assistant: 'filtered',  silent: 'none' },
  ai_tone:               { coach: 'challenging', assistant: 'supportive', silent: 'minimal' },
  agent_trigger:         { coach: 'auto',      assistant: 'preview',   silent: 'manual' },
  workflow_advance:      { coach: 'auto',      assistant: 'auto',      silent: 'manual' },
};

const OFF_BEHAVIORS = new Set(['off', 'hidden', 'none']);

/**
 * Get current assistance mode from user settings
 * @param {object} userSettings - User settings object
 * @returns {'coach'|'assistant'|'silent'}
 */
export function getMode(userSettings) {
  const mode = userSettings?.assistance_mode;
  if (mode === 'assistant' || mode === 'silent') return mode;
  return 'coach'; // default
}

/**
 * Get behavior variant for a feature in the given mode
 * @param {string} feature - Feature key from MODE_MATRIX
 * @param {'coach'|'assistant'|'silent'} mode - Current mode
 * @returns {string} Behavior variant
 */
export function getBehavior(feature, mode) {
  const row = MODE_MATRIX[feature];
  if (!row) return 'off';
  return row[mode] || row.coach;
}

/**
 * Check if a feature should be shown/active in the given mode
 * @param {string} feature - Feature key from MODE_MATRIX
 * @param {'coach'|'assistant'|'silent'} mode - Current mode
 * @returns {boolean}
 */
export function shouldShow(feature, mode) {
  return !OFF_BEHAVIORS.has(getBehavior(feature, mode));
}

/**
 * Mode display metadata for UI
 */
export const MODE_INFO = {
  coach: {
    label: 'Coach',
    icon: '🔥',
    description: 'Active coaching — mandatory check-ins, drift alerts, direct tone',
  },
  assistant: {
    label: 'Assistant',
    icon: '🎯',
    description: 'Responsive help — available on-demand, supportive tone',
  },
  silent: {
    label: 'Silent',
    icon: '🔇',
    description: 'Minimal — no prompts, no notifications, factual answers only',
  },
};
