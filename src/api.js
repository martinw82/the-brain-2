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

  import: (method, projectId, name, data, lifeAreaId, templateId) =>
    post(`${BASE}/api/projects?action=import`, { method, projectId, name, data, lifeAreaId, templateId }),
};

// ── AREAS ─────────────────────────────────────────────────────
export const areas = {
  list: () =>
    get(`${BASE}/api/data?resource=areas`),

  create: (area) =>
    post(`${BASE}/api/data?resource=areas`, area),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=areas&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=areas&id=${id}`),
};

export const goals = {
  list: () =>
    get(`${BASE}/api/data?resource=goals`),

  create: (goal) =>
    post(`${BASE}/api/data?resource=goals`, goal),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=goals&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=goals&id=${id}`),

  listContributions: (goalId) =>
    get(`${BASE}/api/data?resource=contributions&goal_id=${goalId}`),

  addContribution: (contribution) =>
    post(`${BASE}/api/data?resource=contributions`, contribution),

  deleteContribution: (id) =>
    del(`${BASE}/api/data?resource=contributions&id=${id}`),
};

export const templates = {
  list: () =>
    get(`${BASE}/api/data?resource=templates`),

  create: (template) =>
    post(`${BASE}/api/data?resource=templates`, template),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=templates&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=templates&id=${id}`),
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

// ── TAGS ──────────────────────────────────────────────────────
export const tags = {
  list: () =>
    get(`${BASE}/api/data?resource=tags`),

  create: (name, color, category) =>
    post(`${BASE}/api/data?resource=tags`, { name, color, category }),

  update: (id, data) =>
    put(`${BASE}/api/data?resource=tags&id=${id}`, data),

  delete: (id) =>
    del(`${BASE}/api/data?resource=tags&id=${id}`),

  // Entity tag operations
  listEntityTags: () =>
    get(`${BASE}/api/data?resource=entity-tags`),

  attach: (tagId, entityType, entityId) =>
    post(`${BASE}/api/data?resource=entity-tags`, { tag_id: tagId, entity_type: entityType, entity_id: entityId }),

  attachByName: (tagName, entityType, entityId, color) =>
    post(`${BASE}/api/data?resource=entity-tags`, { tag_name: tagName, tag_color: color, entity_type: entityType, entity_id: entityId }),

  detach: (tagId, entityType, entityId) =>
    del(`${BASE}/api/data?resource=entity-tags&tag_id=${tagId}&entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`),
};

// ── LINKS ─────────────────────────────────────────────────────
export const links = {
  query: (entityType, entityId) =>
    get(`${BASE}/api/data?resource=links&entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`),

  create: (sourceType, sourceId, targetType, targetId, relationship) =>
    post(`${BASE}/api/data?resource=links`, { source_type: sourceType, source_id: sourceId, target_type: targetType, target_id: targetId, relationship }),

  delete: (id) =>
    del(`${BASE}/api/data?resource=links&id=${id}`),
};

// ── SETTINGS ──────────────────────────────────────────────────
export const settings = {
  get: () => get(`${BASE}/api/data?resource=settings`),
  put: (data) => put(`${BASE}/api/data?resource=settings`, data),
};

// ── AI ────────────────────────────────────────────────────────
export const ai = {
  ask: (prompt, system) =>
    post(`${BASE}/api/ai`, { prompt, system }),
};

// ── IMPORT PARSERS ────────────────────────────────────────────
export function parseBuildlFormat(text) {
  // Parse BUIDL export format: MANIFEST_START...MANIFEST_END, FILES_START...FILES_END
  const manifestMatch = text.match(/MANIFEST_START\n([\s\S]*?)\nMANIFEST_END/);
  const filesMatch = text.match(/FILES_START\n([\s\S]*?)\nFILES_END/);

  if (!manifestMatch) throw new Error('Invalid BUIDL format: MANIFEST_START/END not found');
  if (!filesMatch) throw new Error('Invalid BUIDL format: FILES_START/END not found');

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
    throw new Error('Invalid projectId: must contain only lowercase letters, numbers, and hyphens');
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
  const skipPatterns = ['.git', 'node_modules', '.DS_Store', '__pycache__', '.env'];
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.pdf', '.bin', '.exe', '.zip'];

  const files = [];
  const warnings = [];

  async function readDir(handle, basePath = '') {
    const entries = await handle.entries();
    for await (const [name, entry] of entries) {
      if (skipPatterns.some(p => name.includes(p))) {
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
            warnings.push(`${path}: file too large (${file.size} bytes), skipped`);
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
