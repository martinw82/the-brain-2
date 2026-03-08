// src/api.js — Vercel edition
// All API calls in one place. Uses /api/auth, /api/projects, /api/data

const BASE = '';  // same domain, no prefix needed

export const token = {
  get:   () => localStorage.getItem('brain_token'),
  set:   (t) => localStorage.setItem('brain_token', t),
  clear: () => localStorage.removeItem('brain_token'),
};

function headers() {
  const t = token.get();
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const get  = (url)        => req('GET',    url);
const post = (url, body)  => req('POST',   url, body);
const put  = (url, body)  => req('PUT',    url, body);
const del  = (url, body)  => req('DELETE', url, body);

// ── AUTH ──────────────────────────────────────────────────────
export const auth = {
  register: (email, password, name) =>
    post(`${BASE}/api/auth?action=register`, { email, password, name }),

  login: (email, password) =>
    post(`${BASE}/api/auth?action=login`, { email, password }),

  me: () =>
    get(`${BASE}/api/auth?action=me`),

  updateProfile: (data) =>
    put(`${BASE}/api/auth?action=me`, data),

  logout: () => token.clear(),
};

// ── PROJECTS ──────────────────────────────────────────────────
export const projects = {
  list: () =>
    get(`${BASE}/api/projects?action=list`),

  get: (id) =>
    get(`${BASE}/api/projects?action=get&id=${id}`),

  create: (project) =>
    post(`${BASE}/api/projects?action=create`, project),

  update: (id, data) =>
    put(`${BASE}/api/projects?action=update&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/projects?action=delete&id=${id}`),

  saveFile: (projectId, path, content) =>
    put(`${BASE}/api/projects?action=save-file&id=${projectId}`, { path, content }),

  deleteFile: (projectId, path) =>
    del(`${BASE}/api/projects?action=delete-file&id=${projectId}`, { path }),

  addFolder: (projectId, folder) =>
    post(`${BASE}/api/projects?action=add-folder&id=${projectId}`, folder),

  setActiveFile: (projectId, path) =>
    put(`${BASE}/api/projects?action=active-file&id=${projectId}`, { path }),
};

// ── STAGING ───────────────────────────────────────────────────
export const staging = {
  list: (projectId) =>
    get(`${BASE}/api/data?resource=staging${projectId ? `&project_id=${projectId}` : ''}`),

  create: (item) =>
    post(`${BASE}/api/data?resource=staging`, item),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=staging&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=staging&id=${id}`),
};

// ── IDEAS ─────────────────────────────────────────────────────
export const ideas = {
  list: () =>
    get(`${BASE}/api/data?resource=ideas`),

  create: (idea) =>
    post(`${BASE}/api/data?resource=ideas`, idea),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=ideas&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=ideas&id=${id}`),
};

// ── SESSIONS ──────────────────────────────────────────────────
export const sessions = {
  list: (limit = 20) =>
    get(`${BASE}/api/data?resource=sessions&limit=${limit}`),

  create: (session) =>
    post(`${BASE}/api/data?resource=sessions`, session),
};

// ── COMMENTS ─────────────────────────────────────────────────
export const comments = {
  list: (projectId, filePath) =>
    get(`${BASE}/api/data?resource=comments&project_id=${projectId}&file_path=${encodeURIComponent(filePath)}`),

  create: (projectId, filePath, text) =>
    post(`${BASE}/api/data?resource=comments`, { project_id: projectId, file_path: filePath, text }),

  resolve: (id, resolved) =>
    put(`${BASE}/api/data?resource=comments&id=${id}`, { resolved }),

  delete: (id) =>
    del(`${BASE}/api/data?resource=comments&id=${id}`),
};

// ── SEARCH ────────────────────────────────────────────────────
export const search = {
  query: (q) =>
    get(`${BASE}/api/data?resource=search&q=${encodeURIComponent(q)}`),
};

// ── AI ────────────────────────────────────────────────────────
export const ai = {
  ask: (prompt, system) =>
    post(`${BASE}/api/ai`, { prompt, system }),
};
