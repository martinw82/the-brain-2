// netlify/functions/projects.js
// GET    /api/projects              — list all projects for user
// POST   /api/projects              — create project
// GET    /api/projects/:id          — get single project with files
// PUT    /api/projects/:id          — update project metadata
// DELETE /api/projects/:id          — delete project
// PUT    /api/projects/:id/files    — upsert a file
// DELETE /api/projects/:id/files    — delete a file
// POST   /api/projects/:id/folders  — add custom folder
// PUT    /api/projects/:id/active-file — update active file

import { query } from './_db.js';
import { requireAuth, ok, err, handleOptions } from './_auth.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const auth = requireAuth(event.headers);
  if (!auth) return err('Unauthorised', 401);

  const basePath = event.path
    .replace('/.netlify/functions/projects', '')
    .replace('/api/projects', '');

  const parts = basePath.split('/').filter(Boolean);
  const projectId = parts[0] || null;
  const subResource = parts[1] || null;

  // ── LIST PROJECTS ─────────────────────────────────────────
  if (event.httpMethod === 'GET' && !projectId) {
    try {
      const projects = await query(
        `SELECT p.*, 
          (SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'folder_id', cf.folder_id, 'label', cf.label, 
            'icon', cf.icon, 'description', cf.description
          )) FROM project_custom_folders cf WHERE cf.project_id = p.id) as custom_folders
         FROM projects p 
         WHERE p.user_id = ? 
         ORDER BY p.priority ASC`,
        [auth.userId]
      );

      // Parse JSON columns
      const parsed = projects.map(p => ({
        ...p,
        blockers: safeJson(p.blockers, []),
        tags: safeJson(p.tags, []),
        skills: safeJson(p.skills, ['dev', 'strategy']),
        integrations: safeJson(p.integrations, {}),
        customFolders: safeJson(p.custom_folders, []).map(f => ({
          id: f.folder_id,
          label: f.label,
          icon: f.icon,
          desc: f.description,
        })),
        custom_folders: undefined,
      }));

      return ok({ projects: parsed });
    } catch (e) {
      console.error('List projects error:', e);
      return err('Failed to fetch projects', 500);
    }
  }

  // ── GET SINGLE PROJECT WITH FILES ─────────────────────────
  if (event.httpMethod === 'GET' && projectId && !subResource) {
    try {
      const projects = await query(
        'SELECT * FROM projects WHERE id = ? AND user_id = ?',
        [projectId, auth.userId]
      );
      if (projects.length === 0) return err('Project not found', 404);
      const p = projects[0];

      const files = await query(
        'SELECT path, content FROM project_files WHERE project_id = ? AND user_id = ?',
        [projectId, auth.userId]
      );
      const filesMap = {};
      files.forEach(f => { filesMap[f.path] = f.content || ''; });

      const folders = await query(
        'SELECT folder_id as id, label, icon, description as desc FROM project_custom_folders WHERE project_id = ? ORDER BY sort_order',
        [projectId]
      );

      return ok({
        project: {
          ...p,
          blockers: safeJson(p.blockers, []),
          tags: safeJson(p.tags, []),
          skills: safeJson(p.skills, ['dev', 'strategy']),
          integrations: safeJson(p.integrations, {}),
          customFolders: folders,
          files: filesMap,
          activeFile: p.active_file,
        }
      });
    } catch (e) {
      console.error('Get project error:', e);
      return err('Failed to fetch project', 500);
    }
  }

  // ── CREATE PROJECT ────────────────────────────────────────
  if (event.httpMethod === 'POST' && !projectId) {
    try {
      const data = JSON.parse(event.body || '{}');
      const { id, name, emoji, phase, status, priority, revenueReady, incomeTarget,
              momentum, lastTouched, desc, nextAction, blockers, tags, skills,
              integrations, files, customFolders, health, activeFile } = data;

      if (!id || !name) return err('id and name required');

      // Check for duplicate
      const existing = await query(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [id, auth.userId]
      );
      if (existing.length > 0) return err('Project ID already exists', 409);

      await query(
        `INSERT INTO projects 
         (id, user_id, name, emoji, phase, status, priority, revenue_ready, income_target,
          momentum, last_touched, description, next_action, blockers, tags, skills,
          integrations, active_file, health)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, auth.userId, name, emoji || '📁', phase || 'BOOTSTRAP', status || 'active',
         priority || 99, revenueReady ? 1 : 0, incomeTarget || 0,
         momentum || 3, lastTouched || null, desc || '', nextAction || '',
         JSON.stringify(blockers || []), JSON.stringify(tags || []),
         JSON.stringify(skills || ['dev', 'strategy']),
         JSON.stringify(integrations || {}),
         activeFile || 'PROJECT_OVERVIEW.md', health || 100]
      );

      // Insert files
      if (files && typeof files === 'object') {
        for (const [path, content] of Object.entries(files)) {
          await query(
            `INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content)`,
            [id, auth.userId, path, content || '']
          );
        }
      }

      // Insert custom folders
      if (customFolders && customFolders.length > 0) {
        for (let i = 0; i < customFolders.length; i++) {
          const f = customFolders[i];
          await query(
            `INSERT INTO project_custom_folders (project_id, user_id, folder_id, label, icon, description, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE label=VALUES(label), icon=VALUES(icon)`,
            [id, auth.userId, f.id, f.label, f.icon || '📁', f.desc || '', i]
          );
        }
      }

      return ok({ success: true, id }, 201);
    } catch (e) {
      console.error('Create project error:', e);
      return err('Failed to create project', 500);
    }
  }

  // ── UPDATE PROJECT METADATA ───────────────────────────────
  if (event.httpMethod === 'PUT' && projectId && !subResource) {
    try {
      const data = JSON.parse(event.body || '{}');

      // Build dynamic update
      const fields = [];
      const values = [];

      const map = {
        name: 'name', emoji: 'emoji', phase: 'phase', status: 'status',
        priority: 'priority', momentum: 'momentum', lastTouched: 'last_touched',
        desc: 'description', nextAction: 'next_action', health: 'health',
        incomeTarget: 'income_target', activeFile: 'active_file',
      };

      for (const [jsKey, dbCol] of Object.entries(map)) {
        if (data[jsKey] !== undefined) {
          fields.push(`${dbCol} = ?`);
          values.push(data[jsKey]);
        }
      }

      const jsonMap = {
        blockers: 'blockers', tags: 'tags', skills: 'skills', integrations: 'integrations'
      };
      for (const [jsKey, dbCol] of Object.entries(jsonMap)) {
        if (data[jsKey] !== undefined) {
          fields.push(`${dbCol} = ?`);
          values.push(JSON.stringify(data[jsKey]));
        }
      }

      if (data.revenueReady !== undefined) {
        fields.push('revenue_ready = ?');
        values.push(data.revenueReady ? 1 : 0);
      }

      if (fields.length === 0) return ok({ success: true });

      values.push(projectId, auth.userId);
      await query(
        `UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
        values
      );

      return ok({ success: true });
    } catch (e) {
      console.error('Update project error:', e);
      return err('Failed to update project', 500);
    }
  }

  // ── DELETE PROJECT ────────────────────────────────────────
  if (event.httpMethod === 'DELETE' && projectId && !subResource) {
    try {
      await query('DELETE FROM projects WHERE id = ? AND user_id = ?', [projectId, auth.userId]);
      return ok({ success: true });
    } catch (e) {
      return err('Failed to delete project', 500);
    }
  }

  // ── UPSERT FILE ───────────────────────────────────────────
  if (event.httpMethod === 'PUT' && subResource === 'files') {
    try {
      const { path, content } = JSON.parse(event.body || '{}');
      if (!path) return err('path required');

      // Verify project belongs to user
      const proj = await query('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, auth.userId]);
      if (proj.length === 0) return err('Project not found', 404);

      await query(
        `INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = CURRENT_TIMESTAMP`,
        [projectId, auth.userId, path, content || '']
      );

      return ok({ success: true });
    } catch (e) {
      console.error('Upsert file error:', e);
      return err('Failed to save file', 500);
    }
  }

  // ── DELETE FILE ───────────────────────────────────────────
  if (event.httpMethod === 'DELETE' && subResource === 'files') {
    try {
      const { path } = JSON.parse(event.body || '{}');
      if (!path) return err('path required');

      await query(
        'DELETE FROM project_files WHERE project_id = ? AND user_id = ? AND path = ?',
        [projectId, auth.userId, path]
      );

      return ok({ success: true });
    } catch (e) {
      return err('Failed to delete file', 500);
    }
  }

  // ── ADD CUSTOM FOLDER ─────────────────────────────────────
  if (event.httpMethod === 'POST' && subResource === 'folders') {
    try {
      const { id: folderId, label, icon, desc } = JSON.parse(event.body || '{}');
      if (!folderId || !label) return err('id and label required');

      const proj = await query('SELECT id FROM projects WHERE id = ? AND user_id = ?', [projectId, auth.userId]);
      if (proj.length === 0) return err('Project not found', 404);

      await query(
        `INSERT INTO project_custom_folders (project_id, user_id, folder_id, label, icon, description)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE label=VALUES(label), icon=VALUES(icon), description=VALUES(description)`,
        [projectId, auth.userId, folderId, label, icon || '📁', desc || '']
      );

      return ok({ success: true });
    } catch (e) {
      return err('Failed to add folder', 500);
    }
  }

  // ── UPDATE ACTIVE FILE ────────────────────────────────────
  if (event.httpMethod === 'PUT' && subResource === 'active-file') {
    try {
      const { path } = JSON.parse(event.body || '{}');
      await query(
        'UPDATE projects SET active_file = ? WHERE id = ? AND user_id = ?',
        [path, projectId, auth.userId]
      );
      return ok({ success: true });
    } catch (e) {
      return err('Failed to update active file', 500);
    }
  }

  return err('Not found', 404);
}

function safeJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
