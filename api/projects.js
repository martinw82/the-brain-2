// api/projects.js — Vercel serverless function
// Handles all project CRUD + files + folders

import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

function getDb() {
  return mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '4000'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl:      { rejectUnauthorized: true },
  });
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(res, data, status = 200) { return res.status(status).json(data); }
function err(res, msg, status = 400) { return res.status(status).json({ error: msg }); }
function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}
function safeJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── Map MySQL snake_case row → frontend camelCase ────────────
function mapProject(p, customFolders) {
  return {
    id:           p.id,
    name:         p.name,
    emoji:        p.emoji || '📁',
    phase:        p.phase || 'BOOTSTRAP',
    status:       p.status || 'active',
    priority:     p.priority || 99,
    revenueReady: !!p.revenue_ready,
    incomeTarget: p.income_target || 0,
    momentum:     p.momentum || 3,
    lastTouched:  p.last_touched || null,
    desc:         p.description || '',
    nextAction:   p.next_action || '',
    blockers:     safeJson(p.blockers, []),
    tags:         safeJson(p.tags, []),
    skills:       safeJson(p.skills, ['dev', 'strategy']),
    integrations: safeJson(p.integrations, {}),
    activeFile:   p.active_file || 'PROJECT_OVERVIEW.md',
    health:       p.health || 100,
    created:      p.created_at,
    customFolders: customFolders || [],
    // files intentionally omitted from list — loaded on demand via get
  };
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  const { action, id: projectId } = req.query;
  let db;

  try {
    db = await getDb();

    // ── GET list (no files — lightweight) ────────────────────
    if (req.method === 'GET' && action === 'list') {
      const [projects] = await db.execute(
        `SELECT p.*, 
          (SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'folder_id', cf.folder_id, 'label', cf.label,
            'icon', cf.icon, 'description', cf.description
          )) FROM project_custom_folders cf WHERE cf.project_id = p.id) as custom_folders
         FROM projects p WHERE p.user_id = ? ORDER BY p.priority ASC`,
        [auth.userId]
      );

      const parsed = projects.map(p => {
        const rawFolders = safeJson(p.custom_folders, []);
        const folders = (Array.isArray(rawFolders) ? rawFolders : [])
          .filter(f => f && f.folder_id)
          .map(f => ({ id: f.folder_id, label: f.label, icon: f.icon, desc: f.description }));
        return mapProject(p, folders);
      });

      return ok(res, { projects: parsed });
    }

    // ── GET single with files ────────────────────────────────
    if (req.method === 'GET' && action === 'get' && projectId) {
      const [projects] = await db.execute(
        'SELECT * FROM projects WHERE id = ? AND user_id = ?',
        [projectId, auth.userId]
      );
      if (!projects.length) return err(res, 'Not found', 404);
      const p = projects[0];

      // Use fallback for deleted_at to avoid breaking if migration hasn't run yet
      let files;
      try {
        [files] = await db.execute(
          'SELECT path, content FROM project_files WHERE project_id = ? AND user_id = ? AND deleted_at IS NULL',
          [projectId, auth.userId]
        );
      } catch (e) {
        if (e.message.includes('Unknown column \'deleted_at\'')) {
          [files] = await db.execute(
            'SELECT path, content FROM project_files WHERE project_id = ? AND user_id = ?',
            [projectId, auth.userId]
          );
        } else {
          throw e;
        }
      }
      const filesMap = {};
      files.forEach(f => { filesMap[f.path] = f.content || ''; });

      const [folders] = await db.execute(
        'SELECT folder_id as id, label, icon, description as `desc` FROM project_custom_folders WHERE project_id = ? ORDER BY sort_order',
        [projectId]
      );

      const mapped = mapProject(p, folders);
      mapped.files = filesMap;

      return ok(res, { project: mapped });
    }

    // ── POST create ──────────────────────────────────────────
    if (req.method === 'POST' && action === 'create') {
      const data = req.body || {};
      const { id, name, emoji, phase, status, priority, revenueReady, incomeTarget, momentum, lastTouched, desc, nextAction, blockers, tags, skills, integrations, files, customFolders, health, activeFile } = data;
      if (!id || !name) return err(res, 'id and name required');

      const [existing] = await db.execute('SELECT id FROM projects WHERE id = ? AND user_id = ?', [id, auth.userId]);
      if (existing.length) return err(res, 'Project ID exists', 409);

      await db.execute(
        `INSERT INTO projects (id, user_id, name, emoji, phase, status, priority, revenue_ready, income_target, momentum, last_touched, description, next_action, blockers, tags, skills, integrations, active_file, health)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, auth.userId, name, emoji || '📁', phase || 'BOOTSTRAP', status || 'active', priority || 99, revenueReady ? 1 : 0, incomeTarget || 0, momentum || 3, lastTouched || null, desc || '', nextAction || '', JSON.stringify(blockers || []), JSON.stringify(tags || []), JSON.stringify(skills || []), JSON.stringify(integrations || {}), activeFile || 'PROJECT_OVERVIEW.md', health || 100]
      );

      if (files) {
        for (const [path, content] of Object.entries(files)) {
          await db.execute(
            `INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content)`,
            [id, auth.userId, path, content || '']
          );
        }
      }

      if (customFolders?.length) {
        for (let i = 0; i < customFolders.length; i++) {
          const f = customFolders[i];
          await db.execute(
            `INSERT INTO project_custom_folders (project_id, user_id, folder_id, label, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE label=VALUES(label)`,
            [id, auth.userId, f.id, f.label, f.icon || '📁', f.desc || '', i]
          );
        }
      }

      return ok(res, { success: true, id }, 201);
    }

    // ── PUT update ───────────────────────────────────────────
    if (req.method === 'PUT' && action === 'update' && projectId) {
      const data = req.body || {};
      const fields = [], values = [];
      const map = {
        name: 'name', emoji: 'emoji', phase: 'phase', status: 'status',
        priority: 'priority', momentum: 'momentum', lastTouched: 'last_touched',
        desc: 'description', nextAction: 'next_action', health: 'health',
        incomeTarget: 'income_target', activeFile: 'active_file',
      };
      for (const [k, col] of Object.entries(map)) {
        if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(data[k]); }
      }
      for (const [k, col] of Object.entries({ blockers: 'blockers', tags: 'tags', skills: 'skills', integrations: 'integrations' })) {
        if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(JSON.stringify(data[k])); }
      }
      if (data.revenueReady !== undefined) { fields.push('revenue_ready = ?'); values.push(data.revenueReady ? 1 : 0); }
      if (fields.length) {
        values.push(projectId, auth.userId);
        await db.execute(`UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }

    // ── DELETE project ───────────────────────────────────────
    if (req.method === 'DELETE' && action === 'delete' && projectId) {
      await db.execute('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, auth.userId]);
      return ok(res, { success: true });
    }

    // ── PUT upsert file ──────────────────────────────────────
    if (req.method === 'PUT' && action === 'save-file' && projectId) {
      const { path, content } = req.body || {};
      if (!path) return err(res, 'path required');
      try {
        await db.execute(
          `INSERT INTO project_files (project_id, user_id, path, content, deleted_at) VALUES (?, ?, ?, ?, NULL) ON DUPLICATE KEY UPDATE content = VALUES(content), deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`,
          [projectId, auth.userId, path, content || '']
        );
      } catch (e) {
        if (e.message.includes('Unknown column \'deleted_at\'')) {
          await db.execute(
            `INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP`,
            [projectId, auth.userId, path, content || '']
          );
        } else {
          throw e;
        }
      }
      return ok(res, { success: true });
    }

    // ── DELETE file (Soft Delete with fallback) ──────────────
    // TODO: Implement hard-delete cleanup for files older than 30 days
    if (req.method === 'DELETE' && action === 'delete-file' && projectId) {
      const { path } = req.body || {};
      try {
        await db.execute('UPDATE project_files SET deleted_at = CURRENT_TIMESTAMP WHERE project_id = ? AND user_id = ? AND path = ?', [projectId, auth.userId, path]);
      } catch (e) {
        if (e.message.includes('Unknown column \'deleted_at\'')) {
          await db.execute('DELETE FROM project_files WHERE project_id = ? AND user_id = ? AND path = ?', [projectId, auth.userId, path]);
        } else {
          throw e;
        }
      }
      return ok(res, { success: true });
    }

    // ── POST add folder ──────────────────────────────────────
    if (req.method === 'POST' && action === 'add-folder' && projectId) {
      const { id: folderId, label, icon, desc } = req.body || {};
      if (!folderId || !label) return err(res, 'id and label required');
      await db.execute(
        `INSERT INTO project_custom_folders (project_id, user_id, folder_id, label, icon, description) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE label=VALUES(label), icon=VALUES(icon)`,
        [projectId, auth.userId, folderId, label, icon || '📁', desc || '']
      );
      return ok(res, { success: true });
    }

    // ── PUT active file ──────────────────────────────────────
    if (req.method === 'PUT' && action === 'active-file' && projectId) {
      const { path } = req.body || {};
      await db.execute('UPDATE projects SET active_file = ? WHERE id = ? AND user_id = ?', [path, projectId, auth.userId]);
      return ok(res, { success: true });
    }

    return err(res, 'Not found', 404);
  } catch (e) {
    console.error('Projects error:', e);
    return err(res, 'Server error', 500);
  } finally {
    if (db) await db.end();
  }
}
