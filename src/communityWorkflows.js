/**
 * Community Workflows (Phase 8.1)
 * Client-side module for sharing and discovering workflow templates
 */

import { get, post } from './api.js';

const BASE = '';

export const WORKFLOW_CATEGORIES = [
  'general',
  'product-launch',
  'content',
  'development',
  'marketing',
  'research',
  'design',
  'business',
];

export const SORT_OPTIONS = {
  STARS: 'stars',
  USAGE: 'usage',
  RECENT: 'recent',
  RATING: 'rating',
};

/**
 * List public community workflows
 * @param {object} options - Filter options
 * @returns {Promise<object>} - List of workflows
 */
export async function listCommunityWorkflows(options = {}) {
  const params = new URLSearchParams({ resource: 'community-workflows' });

  if (options.category) params.append('category', options.category);
  if (options.sort) params.append('sort', options.sort);
  if (options.search) params.append('search', options.search);

  return get(`${BASE}/api/data?${params.toString()}`);
}

/**
 * Publish a workflow to the community
 * @param {object} workflow - Workflow to publish
 * @returns {Promise<object>} - Published workflow
 */
export async function publishWorkflow(workflow) {
  return post(`${BASE}/api/data?resource=community-workflows`, workflow);
}

/**
 * Perform action on community workflow
 * @param {string} action - Action: star, unstar, fork, rate
 * @param {string} workflowId - Workflow ID
 * @param {number} rating - Rating (1-5) for rate action
 * @returns {Promise<object>} - Action result
 */
export async function workflowAction(action, workflowId, rating = null) {
  const body = { action, workflow_id: workflowId };
  if (rating !== null) body.rating = rating;
  return post(`${BASE}/api/data?resource=community-workflow-action`, body);
}

/**
 * Get workflows published by current user
 * @returns {Promise<object>} - User's published workflows
 */
export async function myCommunityWorkflows() {
  return get(`${BASE}/api/data?resource=my-community-workflows`);
}

/**
 * Fork a community workflow to user's templates
 * @param {string} workflowId - Community workflow ID
 * @returns {Promise<object>} - Fork result with new workflow ID
 */
export async function forkWorkflow(workflowId) {
  return workflowAction('fork', workflowId);
}

/**
 * Star a community workflow
 * @param {string} workflowId - Community workflow ID
 * @returns {Promise<object>} - Star result
 */
export async function starWorkflow(workflowId) {
  return workflowAction('star', workflowId);
}

/**
 * Unstar a community workflow
 * @param {string} workflowId - Community workflow ID
 * @returns {Promise<object>} - Unstar result
 */
export async function unstarWorkflow(workflowId) {
  return workflowAction('unstar', workflowId);
}

/**
 * Rate a community workflow
 * @param {string} workflowId - Community workflow ID
 * @param {number} rating - Rating (1-5)
 * @returns {Promise<object>} - Rating result
 */
export async function rateWorkflow(workflowId, rating) {
  return workflowAction('rate', workflowId, rating);
}

export default {
  listCommunityWorkflows,
  publishWorkflow,
  workflowAction,
  myCommunityWorkflows,
  forkWorkflow,
  starWorkflow,
  unstarWorkflow,
  rateWorkflow,
  WORKFLOW_CATEGORIES,
  SORT_OPTIONS,
};
