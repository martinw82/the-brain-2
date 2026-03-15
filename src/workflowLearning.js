/**
 * Workflow Learning (Phase 7.2)
 * Client-side module for workflow pattern analysis
 * Uses the API endpoint for server-side analysis
 */

import { workflowPatterns } from './api.js';

export const PATTERN_TYPES = {
  STEP_DURATION: 'step_duration',
  AGENT_SUCCESS: 'agent_success',
  BOTTLENECK: 'bottleneck',
  LOOP: 'loop',
  COMMON_SEQUENCE: 'common_sequence',
};

/**
 * Get workflow patterns and suggestions
 * @param {string|null} projectId - Optional project ID to filter by
 * @returns {Promise<object>} - Patterns and suggestions
 */
export async function getWorkflowInsights(projectId = null) {
  const result = await workflowPatterns.get(projectId);
  return result;
}

/**
 * Apply a workflow suggestion
 * @param {object} suggestion - The suggestion to apply
 * @returns {Promise<object>} - Result of applying suggestion
 */
export async function applySuggestion(suggestion) {
  const result = await workflowPatterns.applySuggestion(suggestion);
  return result;
}

/**
 * Check if there's enough data for pattern analysis
 * @param {number} sampleCount - Number of completed workflows
 * @returns {boolean} - Whether analysis is possible
 */
export function canAnalyzePatterns(sampleCount) {
  return sampleCount >= 3;
}

export default {
  getWorkflowInsights,
  applySuggestion,
  canAnalyzePatterns,
  PATTERN_TYPES,
};
