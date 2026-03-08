// netlify/functions/data.js
// Handles: staging, ideas, sessions, comments, search
// GET/POST/PUT/DELETE /api/staging
// GET/POST/DELETE     /api/ideas
// POST                /api/sessions
// GET/POST/PUT        /api/comments
// GET                 /api/search?q=...

import { query } from './_db.js';
import { requireAuth, ok, err, handleOptions } from './_auth.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const auth = requireAuth(event.headers);
  if (!auth) return err('Unauthorised', 401);

  const rawPath = event.path
    .replace('/.netlify/functions/data', '')
    .replace('/api', '');

  const parts = rawPath.split('/').filter(Boolean);
  const resource = parts[0];   // staging | ideas | sessions | comments | search
  const resourceId = parts[1]; // optional ID

  // ══════════════════════════════════════════════════════════
  // STAGING
  // ══════════════════════════════════════════════════════════
  if (resource === 'staging') {

    if (event.httpMethod === 'GET') {
      const projectId = event.queryStringParameters?.project;
      const rows = projectId
        ? await query('SELECT * FROM staging WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC', [auth.userId, projectId])
        : await query('SELECT * FROM staging WHERE user_id = ? ORDER BY created_at DESC', [auth.userId]);
      return ok({ staging: rows });
    }

    if (event.httpMethod === 'POST') {
      const { id, project_id, name, tag, status, notes, added } = JSON.parse(event.body || '{}');
      if (!name || !project_id) return err('name and project_id required');
      const newId = id || crypto.randomUUID();
      await query(
        'INSERT INTO staging (id, user_id, project_id, name, tag, status, notes, added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newId, auth.userId, project_id, name, tag || 'IDEA_', status || 'in-review', notes || '', added || new Date().toISOString().slice(0,7)]
      );
      return ok({ success: true, id: newId }, 201);
    }

    if (event.httpMethod === 'PUT' && resourceId) {
      const { status, notes } = JSON.parse(event.body || '{}');
      const fields = [];
      const values = [];
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (notes !== undefined)  { fields.push('notes = ?');  values.push(notes); }
      if (fields.length === 0) return ok({ success: true });
      values.push(resourceId, auth.userId);
      await query(`UPDATE staging SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE' && resourceId) {
      await query('DELETE FROM staging WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
      return ok({ success: true });
    }
  }

  // ══════════════════════════════════════════════════════════
  // IDEAS
  // ══════════════════════════════════════════════════════════
  if (resource === 'ideas') {

    if (event.httpMethod === 'GET') {
      const rows = await query(
        'SELECT * FROM ideas WHERE user_id = ? ORDER BY score DESC, created_at DESC',
        [auth.userId]
      );
      return ok({ ideas: rows.map(r => ({ ...r, tags: safeJson(r.tags, []) })) });
    }

    if (event.httpMethod === 'POST') {
      const { id, title, score, tags, added } = JSON.parse(event.body || '{}');
      if (!title) return err('title required');
      const newId = id || crypto.randomUUID();
      await query(
        'INSERT INTO ideas (id, user_id, title, score, tags, added) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, auth.userId, title, score || 5, JSON.stringify(tags || []), added || new Date().toISOString().slice(0,7)]
      );
      return ok({ success: true, id: newId }, 201);
    }

    if (event.httpMethod === 'PUT' && resourceId) {
      const { score, tags } = JSON.parse(event.body || '{}');
      await query(
        'UPDATE ideas SET score = ?, tags = ? WHERE id = ? AND user_id = ?',
        [score, JSON.stringify(tags || []), resourceId, auth.userId]
      );
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE' && resourceId) {
      await query('DELETE FROM ideas WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
      return ok({ success: true });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SESSIONS
  // ══════════════════════════════════════════════════════════
  if (resource === 'sessions') {

    if (event.httpMethod === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '20');
      const rows = await query(
        'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [auth.userId, limit]
      );
      return ok({ sessions: rows });
    }

    if (event.httpMethod === 'POST') {
      const { project_id, duration_s, log, started_at, ended_at } = JSON.parse(event.body || '{}');
      const id = crypto.randomUUID();
      await query(
        'INSERT INTO sessions (id, user_id, project_id, duration_s, log, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, auth.userId, project_id || null, duration_s || 0, log || '', started_at || null, ended_at || null]
      );
      return ok({ success: true, id }, 201);
    }
  }

  // ══════════════════════════════════════════════════════════
  // COMMENTS
  // ══════════════════════════════════════════════════════════
  if (resource === 'comments') {

    if (event.httpMethod === 'GET') {
      const { project_id, file_path } = event.queryStringParameters || {};
      if (!project_id || !file_path) return err('project_id and file_path required');
      const rows = await query(
        'SELECT * FROM comments WHERE user_id = ? AND project_id = ? AND file_path = ? ORDER BY created_at ASC',
        [auth.userId, project_id, file_path]
      );
      return ok({ comments: rows });
    }

    if (event.httpMethod === 'POST') {
      const { project_id, file_path, text } = JSON.parse(event.body || '{}');
      if (!project_id || !file_path || !text) return err('project_id, file_path and text required');
      const id = crypto.randomUUID();
      await query(
        'INSERT INTO comments (id, user_id, project_id, file_path, text) VALUES (?, ?, ?, ?, ?)',
        [id, auth.userId, project_id, file_path, text]
      );
      return ok({ success: true, id }, 201);
    }

    if (event.httpMethod === 'PUT' && resourceId) {
      const { resolved } = JSON.parse(event.body || '{}');
      await query(
        'UPDATE comments SET resolved = ? WHERE id = ? AND user_id = ?',
        [resolved ? 1 : 0, resourceId, auth.userId]
      );
      return ok({ success: true });
    }

    if (event.httpMethod === 'DELETE' && resourceId) {
      await query('DELETE FROM comments WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
      return ok({ success: true });
    }
  }

  // ══════════════════════════════════════════════════════════
  // FULL-TEXT SEARCH
  // ══════════════════════════════════════════════════════════
  if (resource === 'search' && event.httpMethod === 'GET') {
    const q = event.queryStringParameters?.q || '';
    if (!q.trim()) return ok({ results: [] });

    try {
      // Full-text search on file content
      const fileResults = await query(
        `SELECT pf.project_id, pf.path, 
                LEFT(pf.content, 200) as excerpt,
                p.name as project_name, p.emoji
         FROM project_files pf
         JOIN projects p ON p.id = pf.project_id
         WHERE pf.user_id = ? 
           AND MATCH(pf.content) AGAINST(? IN BOOLEAN MODE)
         LIMIT 15`,
        [auth.userId, `${q}*`]
      );

      // Fallback: LIKE search if full-text returns nothing
      const results = fileResults.length > 0 ? fileResults : await query(
        `SELECT pf.project_id, pf.path,
                LEFT(pf.content, 200) as excerpt,
                p.name as project_name, p.emoji
         FROM project_files pf
         JOIN projects p ON p.id = pf.project_id
         WHERE pf.user_id = ? AND pf.content LIKE ?
         LIMIT 15`,
        [auth.userId, `%${q}%`]
      );

      return ok({ results });
    } catch (e) {
      console.error('Search error:', e);
      return ok({ results: [] });
    }
  }

  return err('Not found', 404);
}

function safeJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}
