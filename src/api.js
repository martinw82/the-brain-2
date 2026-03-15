// src/api.js — Vercel edition with offline support
// All API calls in one place. Uses /api/auth, /api/projects, /api/data

import { cache } from './cache.js';

const BASE = ''; // same domain, no prefix needed

export const token = {
  get: () => localStorage.getItem('brain_token'),
  set: (t) => localStorage.setItem('brain_token', t),
  clear: () => localStorage.removeItem('brain_token'),
};

function headers() {
  const t = token.get();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/**
 * Main request wrapper with offline support
 * - Tries API first
 * - Falls back to cache on network failure
 * - Returns cached data if offline
 */
async function req(method, url, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: headers(),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));

    // Handle different response codes
    if (!res.ok) {
      // 401 Unauthorized - don't fallback to cache, bubble up auth error
      if (res.status === 401) {
        throw new Error(data.error || 'Unauthorized');
      }
      // 409 Conflict - return for offline conflict handling
      if (res.status === 409) {
        return { _conflict: true, ...data };
      }
      // Other errors - try cache
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    // Success - mark as online and cache response if applicable
    cache.setOnline(true);

    // Cache response for read operations (implicit from successful response)
    if (method === 'GET') {
      const resource = _extractResource(url);
      if (resource) {
        // Try to cache the response data
        _cacheResponse(resource, data);
      }
    }

    return data;
  } catch (e) {
    // Network error - check if offline
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
      cache.setOnline(false);
      console.log('[API] Network error, attempting cache fallback...');

      // Try to return cached data for this URL
      const cachedData = _getCachedData(url);
      if (cachedData) {
        console.log('[API] Returning cached data');
        return cachedData;
      }
    }

    // No cache available or non-network error
    throw e;
  }
}

/**
 * Extract resource name from API URL
 * @private
 */
function _extractResource(url) {
  if (url.includes('resource=')) {
    const match = url.match(/resource=([^&]+)/);
    return match ? match[1] : null;
  }
  return null;
}

/**
 * Try to retrieve cached data for a URL
 * @private
 */
function _getCachedData(url) {
  const resource = _extractResource(url);
  if (!resource) return null;

  const collection = cache.getCollection(resource);
  if (collection && collection.data && collection.data.length > 0) {
    return { [resource]: collection.data };
  }
  return null;
}

/**
 * Cache response data from successful API call
 * @private
 */
function _cacheResponse(resource, data) {
  if (!resource || !data) return;

  // Only cache collections (arrays)
  const resourceData = data[resource];
  if (Array.isArray(resourceData)) {
    cache.setCollection(resource, resourceData);
  }
}

const get = (url) => req('GET', url);
const post = (url, body) => req('POST', url, body);
const put = (url, body) => req('PUT', url, body);
const del = (url, body) => req('DELETE', url, body);

/**
 * Helper: Wrap a write operation with write queue support for offline mode
 * Usage: writeWithQueue(method, url, body, resource, action, params)
 * @param {string} method - HTTP method
 * @param {string} url - API URL
 * @param {Object} body - Request body
 * @param {string} resource - Resource type for queue (e.g., "projects")
 * @param {string} action - Action name for queue (e.g., "save-file")
 * @param {Object} params - Full parameters to queue (for retry on reconnect)
 * @returns {Promise<Object>}
 */
export async function writeWithQueue(
  method,
  url,
  body,
  resource,
  action,
  params
) {
  // Enqueue before attempting API call
  const queueId = cache.enqueueWrite(action, resource, action, params);

  try {
    // Try API call
    const result = await req(method, url, body);
    // Success - remove from queue
    cache.dequeueWrite(queueId);
    return result;
  } catch (e) {
    // Network error - keep in queue for sync later
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
      cache.setOnline(false);
      cache.updateWriteStatus(queueId, 'pending');
      console.log(`[API] Write queued for later sync: ${action}`);
      // Return optimistic result for UI
      return { _queued: true, queueId };
    }
    // Other error - remove from queue and throw
    cache.dequeueWrite(queueId);
    throw e;
  }
}

// ── AUTH ──────────────────────────────────────────────────────
export const auth = {
  register: (email, password, name) =>
    post(`${BASE}/api/auth?action=register`, { email, password, name }),

  login: (email, password) =>
    post(`${BASE}/api/auth?action=login`, { email, password }),

  me: () => get(`${BASE}/api/auth?action=me`),

  updateProfile: (data) => put(`${BASE}/api/auth?action=me`, data),

  logout: () => token.clear(),
};

// ── PROJECTS ──────────────────────────────────────────────────
export const projects = {
  list: () => get(`${BASE}/api/projects?action=list`),

  get: (id) => get(`${BASE}/api/projects?action=get&id=${id}`),

  create: (project) => post(`${BASE}/api/projects?action=create`, project),

  update: (id, data) =>
    put(`${BASE}/api/projects?action=update&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/projects?action=delete&id=${id}`),

  saveFile: (projectId, path, content) =>
    put(`${BASE}/api/projects?action=save-file&id=${projectId}`, {
      path,
      content,
    }),

  deleteFile: (projectId, path) =>
    del(`${BASE}/api/projects?action=delete-file&id=${projectId}`, { path }),

  addFolder: (projectId, folder) =>
    post(`${BASE}/api/projects?action=add-folder&id=${projectId}`, folder),

  setActiveFile: (projectId, path) =>
    put(`${BASE}/api/projects?action=active-file&id=${projectId}`, { path }),

  import: (method, projectId, name, data, lifeAreaId, templateId) =>
    post(`${BASE}/api/projects?action=import`, {
      method,
      projectId,
      name,
      data,
      lifeAreaId,
      templateId,
    }),
};

// ── AREAS ─────────────────────────────────────────────────────
export const areas = {
  list: () => get(`${BASE}/api/data?resource=areas`),

  create: (area) => post(`${BASE}/api/data?resource=areas`, area),

  update: (id, data) => put(`${BASE}/api/data?resource=areas&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=areas&id=${id}`),
};

export const goals = {
  list: () => get(`${BASE}/api/data?resource=goals`),

  create: (goal) => post(`${BASE}/api/data?resource=goals`, goal),

  update: (id, data) => put(`${BASE}/api/data?resource=goals&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=goals&id=${id}`),

  listContributions: (goalId) =>
    get(`${BASE}/api/data?resource=contributions&goal_id=${goalId}`),

  addContribution: (contribution) =>
    post(`${BASE}/api/data?resource=contributions`, contribution),

  deleteContribution: (id) =>
    del(`${BASE}/api/data?resource=contributions&id=${id}`),
};

export const templates = {
  list: () => get(`${BASE}/api/data?resource=templates`),

  create: (template) => post(`${BASE}/api/data?resource=templates`, template),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=templates&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=templates&id=${id}`),
};

// ── STAGING ───────────────────────────────────────────────────
export const staging = {
  list: (projectId) =>
    get(
      `${BASE}/api/data?resource=staging${projectId ? `&project_id=${projectId}` : ''}`
    ),

  create: (item) => post(`${BASE}/api/data?resource=staging`, item),

  update: (id, data) => put(`${BASE}/api/data?resource=staging&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=staging&id=${id}`),

  moveToFolder: (id, folderId, filename) =>
    put(`${BASE}/api/data?resource=staging&id=${id}&action=moveToFolder`, {
      folder_id: folderId,
      filename,
    }),
};

// ── FILE METADATA (Roadmap 2.3) ────────────────────────────
export const fileMetadata = {
  get: (projectId, filePath) =>
    get(
      `${BASE}/api/data?resource=file_metadata&project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`
    ),

  create: (data) => post(`${BASE}/api/data?resource=file_metadata`, data),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=file_metadata&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=file_metadata&id=${id}`),
};

// ── IDEAS ─────────────────────────────────────────────────────
export const ideas = {
  list: () => get(`${BASE}/api/data?resource=ideas`),

  create: (idea) => post(`${BASE}/api/data?resource=ideas`, idea),

  update: (id, data) => put(`${BASE}/api/data?resource=ideas&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=ideas&id=${id}`),
};

// ── SESSIONS ──────────────────────────────────────────────────
export const sessions = {
  list: (limit = 20) =>
    get(`${BASE}/api/data?resource=sessions&limit=${limit}`),

  create: (session) => post(`${BASE}/api/data?resource=sessions`, session),
};

// ── COMMENTS ─────────────────────────────────────────────────
export const comments = {
  list: (projectId, filePath) =>
    get(
      `${BASE}/api/data?resource=comments&project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`
    ),

  create: (projectId, filePath, text) =>
    post(`${BASE}/api/data?resource=comments`, {
      project_id: projectId,
      file_path: filePath,
      text,
    }),

  resolve: (id, resolved) =>
    put(`${BASE}/api/data?resource=comments&id=${id}`, { resolved }),

  delete: (id) => del(`${BASE}/api/data?resource=comments&id=${id}`),
};

// ── SEARCH ────────────────────────────────────────────────────
export const search = {
  query: (q, filters = {}) => {
    let url = `${BASE}/api/data?resource=search&q=${encodeURIComponent(q)}`;
    if (filters.project_id) url += `&project_id=${filters.project_id}`;
    if (filters.folder) url += `&folder=${encodeURIComponent(filters.folder)}`;
    if (filters.file_type) url += `&file_type=${filters.file_type}`;
    if (filters.tag) url += `&tag=${encodeURIComponent(filters.tag)}`;
    return get(url);
  },
};

// ── TAGS ──────────────────────────────────────────────────────
export const tags = {
  list: () => get(`${BASE}/api/data?resource=tags`),

  create: (name, color, category) =>
    post(`${BASE}/api/data?resource=tags`, { name, color, category }),

  update: (id, data) => put(`${BASE}/api/data?resource=tags&id=${id}`, data),

  delete: (id) => del(`${BASE}/api/data?resource=tags&id=${id}`),

  // Entity tag operations
  listEntityTags: () => get(`${BASE}/api/data?resource=entity-tags`),

  attach: (tagId, entityType, entityId) =>
    post(`${BASE}/api/data?resource=entity-tags`, {
      tag_id: tagId,
      entity_type: entityType,
      entity_id: entityId,
    }),

  attachByName: (tagName, entityType, entityId, color) =>
    post(`${BASE}/api/data?resource=entity-tags`, {
      tag_name: tagName,
      tag_color: color,
      entity_type: entityType,
      entity_id: entityId,
    }),

  detach: (tagId, entityType, entityId) =>
    del(
      `${BASE}/api/data?resource=entity-tags&tag_id=${tagId}&entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
    ),
};

// ── LINKS ─────────────────────────────────────────────────────
export const links = {
  query: (entityType, entityId) =>
    get(
      `${BASE}/api/data?resource=links&entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
    ),

  create: (sourceType, sourceId, targetType, targetId, relationship) =>
    post(`${BASE}/api/data?resource=links`, {
      source_type: sourceType,
      source_id: sourceId,
      target_type: targetType,
      target_id: targetId,
      relationship,
    }),

  delete: (id) => del(`${BASE}/api/data?resource=links&id=${id}`),
};

// ── SETTINGS ──────────────────────────────────────────────────
export const settings = {
  get: () => get(`${BASE}/api/data?resource=settings`),
  put: (data) => put(`${BASE}/api/data?resource=settings`, data),
};

// ── DAILY CHECKINS (Phase 2.5) ────────────────────────────────
export const dailyCheckins = {
  save: (checkin) => post(`${BASE}/api/data?resource=daily-checkins`, checkin),
  get: (date) => get(`${BASE}/api/data?resource=daily-checkins&date=${date}`),
  getRecent: (days = 7) =>
    get(`${BASE}/api/data?resource=daily-checkins&days=${days}`),
};

// ── OUTREACH LOG (Phase 2.7) ─────────────────────────────────
export const outreachLog = {
  save: (entry) => post(`${BASE}/api/data?resource=outreach-log`, entry),
  list: (days = 7) =>
    get(`${BASE}/api/data?resource=outreach-log&days=${days}`),
  today: () => {
    const today = new Date().toISOString().split('T')[0];
    return get(`${BASE}/api/data?resource=outreach-log&date=${today}`);
  },
  delete: (id) => del(`${BASE}/api/data?resource=outreach-log&id=${id}`),
};

// ── TRAINING LOGS (Phase 2.6) ────────────────────────────────
export const trainingLogs = {
  save: (log) => post(`${BASE}/api/data?resource=training-logs`, log),
  list: (days = 7) =>
    get(`${BASE}/api/data?resource=training-logs&days=${days}`),
  stats: (weeks = 4) =>
    get(`${BASE}/api/data?resource=training-logs&weeks=${weeks}`),
  update: (id, data) =>
    put(`${BASE}/api/data?resource=training-logs&id=${id}`, data),
  delete: (id) => del(`${BASE}/api/data?resource=training-logs&id=${id}`),
};

// ── WEEKLY REVIEW (Phase 2.9) ─────────────────────────────────
export const weeklyReview = {
  fetch: (weekStart) =>
    get(
      `${BASE}/api/data?resource=weekly-review${weekStart ? `&week=${weekStart}` : ''}`
    ),
  list: (n = 8) => get(`${BASE}/api/data?resource=weekly-review&list=${n}`),
  save: (data) => post(`${BASE}/api/data?resource=weekly-review`, data),
};

// ── DRIFT DETECTION (Phase 2.10) ──────────────────────────────
export const drift = {
  check: () => get(`${BASE}/api/data?resource=drift-check`),
};

// ── AI METADATA SUGGESTIONS (Phase 3.1) ───────────────────────
export const aiMetadata = {
  suggest: (projectId, filePath, content, projectName, projectPhase) =>
    post(`${BASE}/api/data?resource=ai-metadata-suggestions`, {
      project_id: projectId,
      file_path: filePath,
      content,
      project_name: projectName,
      project_phase: projectPhase,
    }),
};

// ── SCRIPT EXECUTION (Phase 3.6) ──────────────────────────────
export const scripts = {
  run: (script, language, projectId, projectFiles) =>
    post(`${BASE}/api/data?resource=scripts`, {
      script,
      language,
      project_id: projectId,
      project_files: projectFiles,
    }),
};

// ── AI ────────────────────────────────────────────────────────
export const ai = {
  ask: (prompt, system, provider) =>
    post(`${BASE}/api/ai`, { prompt, system, provider }),
};

// ── USER AI SETTINGS ─────────────────────────────────────────
export const userAISettings = {
  get: () => get(`${BASE}/api/data?resource=user-ai-settings`),
  update: (settings) =>
    put(`${BASE}/api/data?resource=user-ai-settings`, settings),
  deleteKey: () => del(`${BASE}/api/data?resource=user-ai-settings`),
};

// ── INTEGRATIONS (Phase 4.3) ─────────────────────────────────
export const integrations = {
  get: (projectId, provider) =>
    get(
      `${BASE}/api/integrations?provider=${provider}&project_id=${projectId}`
    ),
  connect: (projectId, provider, data) =>
    post(
      `${BASE}/api/integrations?provider=${provider}&project_id=${projectId}`,
      data
    ),
  update: (projectId, provider, data) =>
    put(
      `${BASE}/api/integrations?provider=${provider}&project_id=${projectId}`,
      data
    ),
  disconnect: (projectId, provider) =>
    del(
      `${BASE}/api/integrations?provider=${provider}&project_id=${projectId}`
    ),
};

// ── NOTIFICATIONS (Phase 4.4) ────────────────────────────────
export const notifications = {
  list: (unreadOnly = false, limit = 50) =>
    get(
      `${BASE}/api/data?resource=notifications&unread_only=${unreadOnly}&limit=${limit}`
    ),
  create: (type, message, actionUrl) =>
    post(`${BASE}/api/data?resource=notifications`, {
      type,
      message,
      action_url: actionUrl,
    }),
  markRead: (id) => put(`${BASE}/api/data?resource=notifications&id=${id}`),
  markAllRead: () =>
    put(`${BASE}/api/data?resource=notifications&action=mark-all-read`),
  delete: (id) => del(`${BASE}/api/data?resource=notifications&id=${id}`),
  checkTriggers: () => get(`${BASE}/api/data?resource=notification-check`),
};

// ── MODE SUGGESTIONS (Phase 6.2) ────────────────────────────
export const modeSuggestions = {
  get: () => get(`${BASE}/api/data?resource=mode-suggestions`),
  dismiss: (suggestionType) =>
    post(`${BASE}/api/data?resource=dismiss-mode-suggestion`, {
      suggestion_type: suggestionType,
    }),
};

// ── WORKFLOW PATTERNS (Phase 7.2) ───────────────────────────
export const workflowPatterns = {
  get: (projectId = null) => {
    const params = new URLSearchParams({ resource: 'workflow-patterns' });
    if (projectId) params.append('project_id', projectId);
    return get(`${BASE}/api/data?${params.toString()}`);
  },
  applySuggestion: (suggestion) =>
    post(`${BASE}/api/data?resource=apply-workflow-suggestion`, suggestion),
};

// ── MEMORIES (Phase 7.4) ─────────────────────────────────────
export const memories = {
  list: (options = {}) => {
    const params = new URLSearchParams({ resource: 'memories' });
    if (options.category) params.append('category', options.category);
    if (options.active === false) params.append('active', 'false');
    return get(`${BASE}/api/data?${params.toString()}`);
  },
  create: (memory) => post(`${BASE}/api/data?resource=memories`, memory),
  extract: (sourceType, sourceId) =>
    post(`${BASE}/api/data?resource=extract-memories`, {
      source_type: sourceType,
      source_id: sourceId,
    }),
  insights: () => get(`${BASE}/api/data?resource=memory-insights`),
};

// ── COMMUNITY WORKFLOWS (Phase 8.1) ──────────────────────────
export const communityWorkflows = {
  list: (options = {}) => {
    const params = new URLSearchParams({ resource: 'community-workflows' });
    if (options.category) params.append('category', options.category);
    if (options.sort) params.append('sort', options.sort);
    if (options.search) params.append('search', options.search);
    return get(`${BASE}/api/data?${params.toString()}`);
  },
  publish: (workflow) =>
    post(`${BASE}/api/data?resource=community-workflows`, workflow),
  star: (workflowId) =>
    post(`${BASE}/api/data?resource=community-workflow-action`, {
      action: 'star',
      workflow_id: workflowId,
    }),
  unstar: (workflowId) =>
    post(`${BASE}/api/data?resource=community-workflow-action`, {
      action: 'unstar',
      workflow_id: workflowId,
    }),
  fork: (workflowId) =>
    post(`${BASE}/api/data?resource=community-workflow-action`, {
      action: 'fork',
      workflow_id: workflowId,
    }),
  rate: (workflowId, rating) =>
    post(`${BASE}/api/data?resource=community-workflow-action`, {
      action: 'rate',
      workflow_id: workflowId,
      rating,
    }),
  mine: () => get(`${BASE}/api/data?resource=my-community-workflows`),
};

// ── TASKS (Phase 5.4) ────────────────────────────────────────
export const tasks = {
  // List tasks with optional filters
  list: (filters = {}) => {
    const params = new URLSearchParams({ resource: 'tasks' });
    if (filters.my_tasks) params.append('my_tasks', 'true');
    if (filters.status) params.append('status', filters.status);
    if (filters.assignee_type)
      params.append('assignee_type', filters.assignee_type);
    if (filters.project_id) params.append('project_id', filters.project_id);
    return get(`${BASE}/api/data?${params.toString()}`);
  },

  // Get my tasks (assigned to human user)
  myTasks: () => get(`${BASE}/api/data?resource=tasks&my_tasks=true`),

  // Get tasks by project
  byProject: (projectId) =>
    get(`${BASE}/api/data?resource=tasks&project_id=${projectId}`),

  // Create a new task
  create: (task) => post(`${BASE}/api/data?resource=tasks`, task),

  // Update task status or fields
  update: (id, updates) =>
    put(`${BASE}/api/data?resource=tasks&id=${id}`, updates),

  // Start working on a task
  start: (id) =>
    put(`${BASE}/api/data?resource=tasks&id=${id}&action=start`, {}),

  // Complete a task
  complete: (id, result_summary, output_uris) =>
    put(`${BASE}/api/data?resource=tasks&id=${id}&action=complete`, {
      result_summary,
      output_uris,
    }),

  // Block a task with reason
  block: (id, reason) =>
    put(`${BASE}/api/data?resource=tasks&id=${id}&action=block`, { reason }),

  // Assign task to someone (human, agent, integration)
  assign: (id, assignee_type, assignee_id, reason) =>
    put(`${BASE}/api/data?resource=tasks&id=${id}&action=assign`, {
      assignee_type,
      assignee_id,
      reason,
    }),

  // Delete a task
  delete: (id) => del(`${BASE}/api/data?resource=tasks&id=${id}`),

  // Auto Task Creation (Phase 7.3)
  // Scan DEVLOG/TODO files for tasks
  getProposed: () => get(`${BASE}/api/data?resource=auto-tasks`),

  // Create task from proposed
  createFromProposed: (task) =>
    post(`${BASE}/api/data?resource=create-from-proposed`, task),
};

// ── FILE SUMMARIES (Phase 5.2) ───────────────────────────────
export const fileSummaries = {
  // Get summary for a specific file
  get: (projectId, filePath) =>
    get(
      `${BASE}/api/data?resource=file-summaries&project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`
    ),

  // Get all summaries for a project
  list: (projectId) =>
    get(`${BASE}/api/data?resource=file-summaries&project_id=${projectId}`),

  // Store/update a summary
  store: (projectId, filePath, summary) =>
    post(`${BASE}/api/data?resource=file-summaries`, {
      project_id: projectId,
      file_path: filePath,
      ...summary,
    }),

  // Delete a summary
  delete: (projectId, filePath) =>
    del(
      `${BASE}/api/data?resource=file-summaries&project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`
    ),
};

// ── WORKFLOWS (Phase 5.5) ─────────────────────────────────────
export const workflows = {
  // List all workflow templates
  list: () => get(`${BASE}/api/data?resource=workflows`),

  // Get specific template
  get: (templateId) =>
    get(`${BASE}/api/data?resource=workflows&template_id=${templateId}`),

  // Create/update template
  create: (template) => post(`${BASE}/api/data?resource=workflows`, template),

  // Delete custom template
  delete: (templateId) =>
    del(`${BASE}/api/data?resource=workflows&template_id=${templateId}`),
};

export const workflowInstances = {
  // List instances (optionally filter by project/status)
  list: (filters = {}) => {
    const params = new URLSearchParams({ resource: 'workflow-instances' });
    if (filters.project_id) params.append('project_id', filters.project_id);
    if (filters.status) params.append('status', filters.status);
    return get(`${BASE}/api/data?${params.toString()}`);
  },

  // Get specific instance
  get: (instanceId) =>
    get(
      `${BASE}/api/data?resource=workflow-instances&instance_id=${instanceId}`
    ),

  // Start new workflow instance
  start: (templateId, projectId) =>
    post(`${BASE}/api/data?resource=workflow-instances`, {
      template_id: templateId,
      project_id: projectId,
    }),

  // Pause instance
  pause: (instanceId) =>
    put(`${BASE}/api/data?resource=workflow-instances&id=${instanceId}`, {
      action: 'pause',
    }),

  // Resume instance
  resume: (instanceId) =>
    put(`${BASE}/api/data?resource=workflow-instances&id=${instanceId}`, {
      action: 'resume',
    }),

  // Abort instance
  abort: (instanceId) =>
    put(`${BASE}/api/data?resource=workflow-instances&id=${instanceId}`, {
      action: 'abort',
    }),

  // Complete current step and advance
  completeStep: (instanceId, stepResult) =>
    put(`${BASE}/api/data?resource=workflow-instances&id=${instanceId}`, {
      action: 'complete-step',
      step_result: stepResult,
    }),

  // Delete instance
  delete: (instanceId) =>
    del(`${BASE}/api/data?resource=workflow-instances&id=${instanceId}`),
};

// ── AGENT EXECUTION (Phase 5.6) ──────────────────────────────
export const agentExecution = {
  execute: (options) => post(`${BASE}/api/agent-execute`, options),

  executeTask: (taskId) =>
    post(`${BASE}/api/agent-execute`, { task_id: taskId }),

  executeWithMessage: (agentId, message, projectId, context) =>
    post(`${BASE}/api/agent-execute`, {
      agent_id: agentId,
      message,
      project_id: projectId,
      context,
    }),
};

// ── AGENT STATS (Phase 5.3) ───────────────────────────────────
export const agents = {
  getStats: (agentId) => get(`${BASE}/api/data?resource=agent-stats${agentId ? "\&agent_id=" + agentId : ""}`),
  getAllStats: () => get(`${BASE}/api/data?resource=agent-stats`),
};

// ── IMPORT PARSERS ────────────────────────────────────────────
export function parseBuildlFormat(text) {
  // Parse BUIDL export format: MANIFEST_START...MANIFEST_END, FILES_START...FILES_END
  const manifestMatch = text.match(/MANIFEST_START\n([\s\S]*?)\nMANIFEST_END/);
  const filesMatch = text.match(/FILES_START\n([\s\S]*?)\nFILES_END/);

  if (!manifestMatch)
    throw new Error('Invalid BUIDL format: MANIFEST_START/END not found');
  if (!filesMatch)
    throw new Error('Invalid BUIDL format: FILES_START/END not found');

  let manifest;
  try {
    manifest = JSON.parse(manifestMatch[1]);
  } catch (e) {
    throw new Error('Invalid BUIDL manifest JSON: ' + e.message);
  }

  const files = [];
  const filesSection = filesMatch[1];
  const fileBlocks = filesSection.split('\n---FILE---\n').filter(Boolean);

  for (const block of fileBlocks) {
    const lines = block.split('\n');
    const pathLine = lines[0];
    if (!pathLine.startsWith('PATH: ')) {
      console.warn('Skipping malformed file block:', block.substring(0, 50));
      continue;
    }
    const path = pathLine.substring(6); // Remove "PATH: "
    const content = lines.slice(1).join('\n');
    files.push({ path, content });
  }

  return {
    projectId: manifest.projectId || manifest.id || '',
    name: manifest.name || 'Imported Project',
    description: manifest.description || '',
    files,
  };
}

export function validateImportJson(json) {
  // Validate JSON import structure
  if (!json || typeof json !== 'object') {
    throw new Error('Import data must be a valid JSON object');
  }

  if (!json.projectId || typeof json.projectId !== 'string') {
    throw new Error('Missing or invalid projectId (must be a string)');
  }

  if (!/^[a-z0-9-]+$/.test(json.projectId)) {
    throw new Error(
      'Invalid projectId: must contain only lowercase letters, numbers, and hyphens'
    );
  }

  if (!json.name || typeof json.name !== 'string') {
    throw new Error('Missing or invalid name (must be a string)');
  }

  if (!Array.isArray(json.files)) {
    throw new Error('Missing or invalid files (must be an array)');
  }

  for (let i = 0; i < json.files.length; i++) {
    const file = json.files[i];
    if (!file.path || typeof file.path !== 'string') {
      throw new Error(`files[${i}].path: must be a non-empty string`);
    }
    if (typeof file.content !== 'string') {
      throw new Error(`files[${i}].content: must be a string`);
    }
  }

  return {
    projectId: json.projectId,
    name: json.name,
    description: json.description || '',
    files: json.files,
  };
}

export async function parseFileSystemEntries(dirHandle) {
  // Recursively read directory entries from File System Access API
  const skipPatterns = [
    '.git',
    'node_modules',
    '.DS_Store',
    '__pycache__',
    '.env',
  ];
  const binaryExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.pdf',
    '.bin',
    '.exe',
    '.zip',
  ];

  const files = [];
  const warnings = [];

  async function readDir(handle, basePath = '') {
    const entries = await handle.entries();
    for await (const [name, entry] of entries) {
      if (skipPatterns.some((p) => name.includes(p))) {
        continue;
      }

      const path = basePath ? `${basePath}/${name}` : name;

      if (entry.kind === 'directory') {
        await readDir(entry, path);
      } else if (entry.kind === 'file') {
        // Skip binary files
        const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
        if (binaryExtensions.includes(ext)) {
          warnings.push(`${path}: binary file skipped`);
          continue;
        }

        try {
          const file = await entry.getFile();
          // Limit to 1MB per file
          if (file.size > 1024 * 1024) {
            warnings.push(
              `${path}: file too large (${file.size} bytes), skipped`
            );
            continue;
          }
          const content = await file.text();
          files.push({ path, content });
        } catch (e) {
          warnings.push(`${path}: error reading file: ${e.message}`);
        }
      }
    }
  }

  await readDir(dirHandle);
  return { files, warnings };
}
