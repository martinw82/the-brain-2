/**
 * Integrations (Phase 8.2)
 * Client-side module for external service integrations
 */

import { get, post } from './api.js';

const BASE = '';

export const PROVIDERS = {
  GITHUB: 'github',
  GOOGLE: 'google',
  SLACK: 'slack',
  DISCORD: 'discord',
  EMAIL: 'email',
};

/**
 * List user's active integrations
 * @returns {Promise<object>} - List of integrations
 */
export async function listIntegrations() {
  return get(`${BASE}/api/data?resource=integrations`);
}

/**
 * Add or update an integration
 * @param {object} integration - Integration data
 * @returns {Promise<object>} - Result
 */
export async function addIntegration(integration) {
  return post(`${BASE}/api/data?resource=integrations`, integration);
}

/**
 * Remove an integration
 * @param {string} provider - Provider name
 * @returns {Promise<object>} - Result
 */
export async function removeIntegration(provider) {
  return post(`${BASE}/api/data?resource=integrations`, {
    method: 'DELETE',
    provider,
  });
}

// ── GITHUB ───────────────────────────────────────────────────

/**
 * Sync GitHub repositories
 * @returns {Promise<object>} - List of repos
 */
export async function githubSyncRepos() {
  return post(`${BASE}/api/data?resource=github-sync`, {
    action: 'sync-repos',
  });
}

/**
 * Create a GitHub issue from a task
 * @param {string} repo - Repository name
 * @param {string} title - Issue title
 * @param {string} body - Issue body
 * @returns {Promise<object>} - Result
 */
export async function githubCreateIssue(repo, title, body) {
  return post(`${BASE}/api/data?resource=github-sync`, {
    action: 'create-issue',
    repo,
    title,
    body,
  });
}

/**
 * Link a project to a GitHub repository
 * @param {string} repo - Repository name
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} - Result
 */
export async function githubLinkProject(repo, projectId) {
  return post(`${BASE}/api/data?resource=github-sync`, {
    action: 'link-project',
    repo,
    project_id: projectId,
  });
}

// ── GOOGLE CALENDAR ─────────────────────────────────────────

/**
 * Create a calendar event
 * @param {object} event - Event details
 * @returns {Promise<object>} - Result
 */
export async function calendarCreateEvent(event) {
  return post(`${BASE}/api/data?resource=calendar-sync`, {
    action: 'create-event',
    ...event,
  });
}

/**
 * Block time for a task
 * @param {string} taskId - Task ID
 * @param {number} durationMinutes - Duration in minutes
 * @returns {Promise<object>} - Result
 */
export async function calendarBlockTime(taskId, durationMinutes = 60) {
  return post(`${BASE}/api/data?resource=calendar-sync`, {
    action: 'block-time',
    task_id: taskId,
    duration_minutes: durationMinutes,
  });
}

// ── EMAIL ───────────────────────────────────────────────────

/**
 * Send task update via email
 * @param {string} taskId - Task ID
 * @param {string[]} recipients - Email addresses
 * @returns {Promise<object>} - Result
 */
export async function emailSendTaskUpdate(taskId, recipients) {
  return post(`${BASE}/api/data?resource=email-sync`, {
    action: 'send-task-update',
    task_id: taskId,
    recipients,
  });
}

// ── SYNC LOG ─────────────────────────────────────────────────

/**
 * Get integration sync logs
 * @param {string} provider - Optional provider filter
 * @returns {Promise<object>} - Sync logs
 */
export async function getSyncLogs(provider = null) {
  const params = new URLSearchParams({ resource: 'integration-sync-log' });
  if (provider) params.append('provider', provider);
  return get(`${BASE}/api/data?${params.toString()}`);
}

export default {
  listIntegrations,
  addIntegration,
  removeIntegration,
  githubSyncRepos,
  githubCreateIssue,
  githubLinkProject,
  calendarCreateEvent,
  calendarBlockTime,
  emailSendTaskUpdate,
  getSyncLogs,
  PROVIDERS,
};
