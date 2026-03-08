// src/api.js
// All API calls in one place.
// Token is stored in localStorage and sent with every request.
// Swap BASE_URL in .env to point at any backend.

const BASE = import.meta.env.VITE_API_URL || '/.netlify/functions';

// ── TOKEN MANAGEMENT ─────────────────────────────────────────
export const token = {
  get: ()    => localStorage.getItem('brain_token'),
  set: (t)   => localStorage.setItem('brain_token', t),
  clear: ()  => localStorage.removeItem('brain_token'),
};

function headers(extra = {}) {
  const t = token.get();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    ...extra,
  };
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

const get    = (path)       => req('GET',    path);
const post   = (path, body) => req('POST',   path, body);
const put    = (path, body) => req('PUT',    path, body);
const del    = (path, body) => req('DELETE', path, body);

// ── AUTH ──────────────────────────────────────────────────────
export const auth = {
  register: (email, password, name) =>
    post('/auth/register', { email, password, name }),

  login: (email, password) =>
    post('/auth/login', { email, password }),

  me: () => get('/auth/me'),

  updateProfile: (data) => put('/auth/me', data),

  logout: () => token.clear(),
};

// ── PROJECTS ──────────────────────────────────────────────────
export const projects = {
  list: () => get('/projects'),

  get: (id) => get(`/projects/${id}`),

  create: (project) => post('/projects', project),

  update: (id, data) => put(`/projects/${id}`, data),

  delete: (id) => del(`/projects/${id}`),

  saveFile: (projectId, path, content) =>
    put(`/projects/${projectId}/files`, { path, content }),

  deleteFile: (projectId, path) =>
    del(`/projects/${projectId}/files`, { path }),

  addFolder: (projectId, folder) =>
    post(`/projects/${projectId}/folders`, folder),

  setActiveFile: (projectId, path) =>
    put(`/projects/${projectId}/active-file`, { path }),
};

// ── STAGING ───────────────────────────────────────────────────
export const staging = {
  list: (projectId) =>
    get(projectId ? `/staging?project=${projectId}` : '/staging'),

  create: (item) => post('/staging', item),

  update: (id, data) => put(`/staging/${id}`, data),

  delete: (id) => del(`/staging/${id}`),
};

// ── IDEAS ─────────────────────────────────────────────────────
export const ideas = {
  list: () => get('/ideas'),

  create: (idea) => post('/ideas', idea),

  update: (id, data) => put(`/ideas/${id}`, data),

  delete: (id) => del(`/ideas/${id}`),
};

// ── SESSIONS ──────────────────────────────────────────────────
export const sessions = {
  list: (limit = 20) => get(`/sessions?limit=${limit}`),

  create: (session) => post('/sessions', session),
};

// ── COMMENTS ─────────────────────────────────────────────────
export const comments = {
  list: (projectId, filePath) =>
    get(`/comments?project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`),

  create: (projectId, filePath, text) =>
    post('/comments', { project_id: projectId, file_path: filePath, text }),

  resolve: (id, resolved) => put(`/comments/${id}`, { resolved }),

  delete: (id) => del(`/comments/${id}`),
};

// ── SEARCH ────────────────────────────────────────────────────
export const search = {
  query: (q) => get(`/search?q=${encodeURIComponent(q)}`),
};
