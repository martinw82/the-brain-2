// api/data.js — Vercel serverless function
// Handles: staging, ideas, sessions, comments, search

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

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  const { resource, id: resourceId, project_id, file_path, q, limit, health_only } = req.query;
  let db;

  try {
    db = await getDb();

    // ── STAGING ──────────────────────────────────────────────
    if (resource === 'staging') {
      if (req.method === 'GET') {
        const [rows] = project_id
          ? await db.execute('SELECT * FROM staging WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC', [auth.userId, project_id])
          : await db.execute('SELECT * FROM staging WHERE user_id = ? ORDER BY created_at DESC', [auth.userId]);
        return ok(res, { staging: rows });
      }
      if (req.method === 'POST') {
        const { id, project_id: pid, name, tag, status, notes, added } = req.body || {};
        if (!name || !pid) return err(res, 'name and project_id required');
        const newId = id || crypto.randomUUID();
        await db.execute('INSERT INTO staging (id, user_id, project_id, name, tag, status, notes, added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId, auth.userId, pid, name, tag || 'IDEA_', status || 'in-review', notes || '', added || new Date().toISOString().slice(0, 7)]);
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { action } = req.query;
        const { status, notes, folder_id, filename } = req.body || {};

        // Phase 2.3: Move staging item to folder
        if (action === 'moveToFolder' && folder_id && filename) {
          try {
            // Get staging item
            const [stagingRows] = await db.execute('SELECT * FROM staging WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
            if (!stagingRows.length) return err(res, 'Staging item not found', 404);
            const stagingItem = stagingRows[0];

            // Get project files to check for conflicts
            const [existingFiles] = await db.execute('SELECT * FROM project_files WHERE project_id = ? AND path = ?', [stagingItem.project_id, `${folder_id}/${filename}`]);

            let finalPath = `${folder_id}/${filename}`;
            if (existingFiles.length > 0) {
              // Add timestamp suffix to avoid conflict
              const ext = filename.split('.').pop();
              const base = filename.replace(new RegExp(`\\.${ext}$`), '');
              const timestamp = new Date().toISOString().replace(/[:-]/g, '').slice(0, 15);
              finalPath = `${folder_id}/${base}_${timestamp}.${ext}`;
            }

            // Get staging file content
            const [stagingFileRows] = await db.execute('SELECT * FROM project_files WHERE project_id = ? AND path = ?', [stagingItem.project_id, `staging/${stagingItem.name}`]);

            if (stagingFileRows.length > 0) {
              const stagingFile = stagingFileRows[0];
              // Copy to new location
              await db.execute('INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?)', [stagingItem.project_id, auth.userId, finalPath, stagingFile.content]);
              // Delete from staging
              await db.execute('DELETE FROM project_files WHERE project_id = ? AND path = ?', [stagingItem.project_id, `staging/${stagingItem.name}`]);
            }

            // Update staging record with folder path and filed timestamp
            const filedAt = new Date().toISOString();
            await db.execute('UPDATE staging SET folder_path = ?, filed_at = ? WHERE id = ? AND user_id = ?', [finalPath, filedAt, resourceId, auth.userId]);

            return ok(res, { success: true, folder_path: finalPath, filed_at: filedAt });
          } catch (e) {
            console.error('moveToFolder error:', e);
            return err(res, 'Failed to move file to folder');
          }
        }

        // Regular status/notes update
        const fields = [], values = [];
        if (status !== undefined) { fields.push('status = ?'); values.push(status); }
        if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
        if (fields.length) { values.push(resourceId, auth.userId); await db.execute(`UPDATE staging SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM staging WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── IDEAS ─────────────────────────────────────────────────
    if (resource === 'ideas') {
      if (req.method === 'GET') {
        const [rows] = await db.execute('SELECT * FROM ideas WHERE user_id = ? ORDER BY score DESC, created_at DESC', [auth.userId]);
        return ok(res, { ideas: rows.map(r => ({ ...r, tags: safeJson(r.tags, []) })) });
      }
      if (req.method === 'POST') {
        const { id, title, score, tags, added } = req.body || {};
        if (!title) return err(res, 'title required');
        const newId = id || crypto.randomUUID();
        await db.execute('INSERT INTO ideas (id, user_id, title, score, tags, added) VALUES (?, ?, ?, ?, ?, ?)', [newId, auth.userId, title, score || 5, JSON.stringify(tags || []), added || new Date().toISOString().slice(0, 7)]);
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { score, tags } = req.body || {};
        await db.execute('UPDATE ideas SET score = ?, tags = ? WHERE id = ? AND user_id = ?', [score, JSON.stringify(tags || []), resourceId, auth.userId]);
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM ideas WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── SESSIONS ──────────────────────────────────────────────
    if (resource === 'sessions') {
      if (req.method === 'GET') {
        const lim = parseInt(limit || '20');
        const [rows] = await db.execute('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [auth.userId, lim]);
        return ok(res, { sessions: rows });
      }
      if (req.method === 'POST') {
        const { project_id: pid, duration_s, log, started_at, ended_at } = req.body || {};
        const id = crypto.randomUUID();
        await db.execute('INSERT INTO sessions (id, user_id, project_id, duration_s, log, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, auth.userId, pid || null, duration_s || 0, log || '', started_at || null, ended_at || null]);
        return ok(res, { success: true, id }, 201);
      }
    }

    // ── COMMENTS ─────────────────────────────────────────────
    if (resource === 'comments') {
      if (req.method === 'GET') {
        if (!project_id || !file_path) return err(res, 'project_id and file_path required');
        const [rows] = await db.execute('SELECT * FROM comments WHERE user_id = ? AND project_id = ? AND file_path = ? ORDER BY created_at ASC', [auth.userId, project_id, file_path]);
        return ok(res, { comments: rows });
      }
      if (req.method === 'POST') {
        const { project_id: pid, file_path: fp, text } = req.body || {};
        if (!pid || !fp || !text) return err(res, 'project_id, file_path and text required');
        const id = crypto.randomUUID();
        await db.execute('INSERT INTO comments (id, user_id, project_id, file_path, text) VALUES (?, ?, ?, ?, ?)', [id, auth.userId, pid, fp, text]);
        return ok(res, { success: true, id }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { resolved } = req.body || {};
        await db.execute('UPDATE comments SET resolved = ? WHERE id = ? AND user_id = ?', [resolved ? 1 : 0, resourceId, auth.userId]);
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM comments WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── FILE METADATA (Roadmap 2.3) ───────────────────────────
    if (resource === 'file_metadata') {
      if (req.method === 'GET') {
        if (!project_id || !file_path) return err(res, 'project_id and file_path required');
        const [rows] = await db.execute('SELECT * FROM file_metadata WHERE user_id = ? AND project_id = ? AND file_path = ?', [auth.userId, project_id, file_path]);
        const metadata = rows.length > 0 ? { ...rows[0], metadata_json: safeJson(rows[0].metadata_json, {}) } : null;
        return ok(res, { metadata });
      }
      if (req.method === 'POST') {
        const { project_id: pid, file_path: fp, category, status, metadata_json } = req.body || {};
        if (!pid || !fp) return err(res, 'project_id and file_path required');
        await db.execute(
          'INSERT INTO file_metadata (project_id, user_id, file_path, category, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
          [pid, auth.userId, fp, category || null, status || 'draft', metadata_json ? JSON.stringify(metadata_json) : null]
        );
        return ok(res, { success: true }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { category, status, metadata_json } = req.body || {};
        const fields = ['updated_at = NOW()'], values = [];
        if (category !== undefined) { fields.push('category = ?'); values.push(category); }
        if (status !== undefined) { fields.push('status = ?'); values.push(status); }
        if (metadata_json !== undefined) { fields.push('metadata_json = ?'); values.push(metadata_json ? JSON.stringify(metadata_json) : null); }
        if (fields.length > 1) { values.push(resourceId, auth.userId); await db.execute(`UPDATE file_metadata SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM file_metadata WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── AREAS ─────────────────────────────────────────────────
    if (resource === 'areas') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute('SELECT * FROM life_areas WHERE user_id = ? ORDER BY sort_order ASC', [auth.userId]);
          return ok(res, { areas: rows });
        } catch (e) {
          if (e.message.includes('Table') && e.message.includes('doesn\'t exist')) {
            return ok(res, { areas: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { id, name, color, icon, description, target_hours_weekly } = req.body || {};
        if (!name) return err(res, 'name required');
        const newId = id || crypto.randomUUID();
        await db.execute('INSERT INTO life_areas (id, user_id, name, color, icon, description, target_hours_weekly) VALUES (?, ?, ?, ?, ?, ?, ?)', [newId, auth.userId, name, color || '#3b82f6', icon || '🌐', description || '', target_hours_weekly || null]);
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [], values = [];
        const map = { name:'name', color:'color', icon:'icon', description:'description', target_hours_weekly:'target_hours_weekly', health_score:'health_score', sort_order:'sort_order' };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(data[k]); }
        }
        if (fields.length) { values.push(resourceId, auth.userId); await db.execute(`UPDATE life_areas SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM life_areas WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        // Also unassign projects
        await db.execute('UPDATE projects SET life_area_id = NULL WHERE life_area_id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── GOALS ─────────────────────────────────────────────────
    if (resource === 'goals') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [auth.userId]);
          return ok(res, { goals: rows });
        } catch (e) {
          if (e.message.includes('Table') && e.message.includes('doesn\'t exist')) {
            return ok(res, { goals: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { id, title, target_amount, current_amount, currency, timeframe, category, status } = req.body || {};
        if (!title || target_amount === undefined) return err(res, 'title and target_amount required');
        const newId = id || crypto.randomUUID();
        await db.execute('INSERT INTO goals (id, user_id, title, target_amount, current_amount, currency, timeframe, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [newId, auth.userId, title, target_amount, current_amount || 0, currency || 'GBP', timeframe || 'monthly', category || 'income', status || 'active']);
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [], values = [];
        const map = { title:'title', target_amount:'target_amount', current_amount:'current_amount', currency:'currency', timeframe:'timeframe', category:'category', status:'status' };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) { fields.push(`${col} = ?`); values.push(data[k]); }
        }
        if (fields.length) { values.push(resourceId, auth.userId); await db.execute(`UPDATE goals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── TEMPLATES ───────────────────────────────────────────────
    if (resource === 'templates') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute('SELECT * FROM templates WHERE user_id IS NULL OR user_id = ? ORDER BY is_system DESC, name ASC', [auth.userId]);
          return ok(res, { templates: rows.map(r => ({ ...r, config: safeJson(r.config, {}) })) });
        } catch (e) {
          if (e.message.includes('Table') && e.message.includes('doesn\'t exist')) {
            return ok(res, { templates: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { id, name, description, icon, category, config, is_system } = req.body || {};
        if (!name || !config) return err(res, 'name and config required');
        const newId = id || crypto.randomUUID();
        await db.execute('INSERT INTO templates (id, user_id, name, description, icon, category, config, is_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [newId, auth.userId, name, description || '', icon || '📄', category || 'custom', JSON.stringify(config), is_system ? 1 : 0]);
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [], values = [];
        const map = { name:'name', description:'description', icon:'icon', category:'category', config:'config', is_system:'is_system' };
        for (const [k, col] of Object.entries(map)) {
            if (data[k] !== undefined) {
                fields.push(`${col} = ?`);
                values.push(k === 'config' ? JSON.stringify(data[k]) : data[k]);
            }
        }
        if (fields.length) { values.push(resourceId, auth.userId); await db.execute(`UPDATE templates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM templates WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── GOAL CONTRIBUTIONS ──────────────────────────────────────
    if (resource === 'contributions') {
      if (req.method === 'GET') {
        const { goal_id } = req.query;
        if (!goal_id) return err(res, 'goal_id required');
        try {
          const [rows] = await db.execute('SELECT * FROM goal_contributions WHERE user_id = ? AND goal_id = ? ORDER BY date DESC', [auth.userId, goal_id]);
          return ok(res, { contributions: rows });
        } catch (e) {
          if (e.message.includes('Table') && e.message.includes('doesn\'t exist')) {
            return ok(res, { contributions: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { goal_id, project_id, source_label, amount, date, notes } = req.body || {};
        if (!goal_id || amount === undefined) return err(res, 'goal_id and amount required');
        const id = crypto.randomUUID();
        await db.execute('INSERT INTO goal_contributions (id, goal_id, user_id, project_id, source_label, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, goal_id, auth.userId, project_id || null, source_label || '', amount, date || new Date().toISOString().slice(0, 10), notes || '']);

        // Auto-update current_amount in goal
        await db.execute('UPDATE goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?', [amount, goal_id, auth.userId]);

        return ok(res, { success: true, id }, 201);
      }
      if (req.method === 'DELETE' && resourceId) {
        // Need goal_id to update current_amount
        const [rows] = await db.execute('SELECT goal_id, amount FROM goal_contributions WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
        if (rows.length) {
          const { goal_id, amount } = rows[0];
          await db.execute('DELETE FROM goal_contributions WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
          await db.execute('UPDATE goals SET current_amount = current_amount - ? WHERE id = ? AND user_id = ?', [amount, goal_id, auth.userId]);
        }
        return ok(res, { success: true });
      }
    }

    // ── SETTINGS ──────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const [rows] = await db.execute('SELECT settings FROM users WHERE id = ?', [auth.userId]);
        let parsed = {};
        try { parsed = JSON.parse(rows[0]?.settings || '{}'); } catch(_) {}
        return ok(res, { settings: parsed });
      }
      if (req.method === 'PUT') {
        const settingsJson = JSON.stringify(req.body || {});
        await db.execute('UPDATE users SET settings = ? WHERE id = ?', [settingsJson, auth.userId]);
        return ok(res, { success: true });
      }
    }

    // ── TAGS ──────────────────────────────────────────────────
    if (resource === 'tags') {
      try {
        if (req.method === 'GET') {
          const [rows] = await db.execute('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC', [auth.userId]);
          return ok(res, { tags: rows });
        }
        if (req.method === 'POST') {
          const { name, color, category } = req.body || {};
          if (!name?.trim()) return err(res, 'name required');
          // Upsert — return existing tag if name already exists
          const [existing] = await db.execute('SELECT * FROM tags WHERE user_id = ? AND name = ?', [auth.userId, name.trim()]);
          if (existing.length) return ok(res, { success: true, id: existing[0].id, tag: existing[0] }, 200);
          const id = crypto.randomUUID();
          await db.execute('INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)', [id, auth.userId, name.trim(), color || '#3b82f6', category || 'custom']);
          return ok(res, { success: true, id, tag: { id, user_id: auth.userId, name: name.trim(), color: color || '#3b82f6', category: category || 'custom' } }, 201);
        }
        if (req.method === 'PUT' && resourceId) {
          const { name, color, category } = req.body || {};
          const fields = [], values = [];
          if (name) { fields.push('name = ?'); values.push(name.trim()); }
          if (color) { fields.push('color = ?'); values.push(color); }
          if (category) { fields.push('category = ?'); values.push(category); }
          if (fields.length) { values.push(resourceId, auth.userId); await db.execute(`UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values); }
          return ok(res, { success: true });
        }
        if (req.method === 'DELETE' && resourceId) {
          await db.execute('DELETE FROM entity_tags WHERE tag_id = ? AND user_id = ?', [resourceId, auth.userId]);
          await db.execute('DELETE FROM tags WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) return ok(res, { tags: [] });
        throw e;
      }
    }

    // ── ENTITY TAGS ───────────────────────────────────────────
    if (resource === 'entity-tags') {
      try {
        if (req.method === 'GET') {
          // List all entity_tags for this user (joined with tag data)
          const [rows] = await db.execute(
            `SELECT et.id, et.tag_id, et.entity_type, et.entity_id, et.created_at,
                    t.name, t.color, t.category
             FROM entity_tags et JOIN tags t ON t.id = et.tag_id
             WHERE et.user_id = ? ORDER BY et.entity_type, et.entity_id, t.name`,
            [auth.userId]
          );
          return ok(res, { entity_tags: rows });
        }
        if (req.method === 'POST') {
          // Attach tag to entity — body: { tag_id OR tag_name, entity_type, entity_id }
          const { tag_id, tag_name, tag_color, entity_type, entity_id } = req.body || {};
          if (!entity_type || !entity_id) return err(res, 'entity_type and entity_id required');
          let tid = tag_id;
          if (!tid && tag_name) {
            // Auto-create tag if not found
            const [existing] = await db.execute('SELECT id FROM tags WHERE user_id = ? AND name = ?', [auth.userId, tag_name.trim()]);
            if (existing.length) {
              tid = existing[0].id;
            } else {
              tid = crypto.randomUUID();
              await db.execute('INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)', [tid, auth.userId, tag_name.trim(), tag_color || '#3b82f6', 'custom']);
            }
          }
          if (!tid) return err(res, 'tag_id or tag_name required');
          const id = crypto.randomUUID();
          await db.execute('INSERT IGNORE INTO entity_tags (id, tag_id, user_id, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)', [id, tid, auth.userId, entity_type, entity_id]);
          const [tagRows] = await db.execute('SELECT name, color FROM tags WHERE id = ?', [tid]);
          const tag = tagRows[0] || {};
          return ok(res, { id, tag_id: tid, name: tag.name || tag_name, color: tag.color || tag_color || '#3b82f6', entity_type, entity_id, user_id: auth.userId }, 201);
        }
        if (req.method === 'DELETE') {
          // Detach: ?tag_id=X&entity_type=Y&entity_id=Z
          const { tag_id: tid, entity_type, entity_id } = req.query;
          if (!tid || !entity_type || !entity_id) return err(res, 'tag_id, entity_type, entity_id required');
          await db.execute('DELETE FROM entity_tags WHERE tag_id = ? AND entity_type = ? AND entity_id = ? AND user_id = ?', [tid, entity_type, entity_id, auth.userId]);
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) return ok(res, { entity_tags: [] });
        throw e;
      }
    }

    // ── ENTITY LINKS ──────────────────────────────────────────
    if (resource === 'links') {
      try {
        if (req.method === 'GET') {
          // Get all links for an entity: ?entity_type=X&entity_id=Y
          const { entity_type, entity_id } = req.query;
          if (!entity_type || !entity_id) return err(res, 'entity_type and entity_id required');
          const [rows] = await db.execute(
            `SELECT * FROM entity_links WHERE user_id = ? AND (
              (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)
            ) ORDER BY created_at DESC`,
            [auth.userId, entity_type, entity_id, entity_type, entity_id]
          );
          return ok(res, { links: rows });
        }
        if (req.method === 'POST') {
          const { source_type, source_id, target_type, target_id, relationship } = req.body || {};
          if (!source_type || !source_id || !target_type || !target_id) return err(res, 'source and target required');
          const id = crypto.randomUUID();
          await db.execute('INSERT IGNORE INTO entity_links (id, user_id, source_type, source_id, target_type, target_id, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, auth.userId, source_type, source_id, target_type, target_id, relationship || 'related']);
          return ok(res, { success: true, id }, 201);
        }
        if (req.method === 'DELETE' && resourceId) {
          await db.execute('DELETE FROM entity_links WHERE id = ? AND user_id = ?', [resourceId, auth.userId]);
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) return ok(res, { links: [] });
        throw e;
      }
    }

    // ── SEARCH ────────────────────────────────────────────────
    if (resource === 'search') {
      if (!q?.trim()) return ok(res, { results: [] });
      try {
        let results;
        try {
          [results] = await db.execute(
            `SELECT pf.project_id, pf.path, LEFT(pf.content, 200) as excerpt, p.name as project_name, p.emoji
             FROM project_files pf JOIN projects p ON p.id = pf.project_id
             WHERE pf.user_id = ? AND pf.content LIKE ? AND pf.deleted_at IS NULL LIMIT 15`,
            [auth.userId, `%${q}%`]
          );
        } catch (e) {
          if (e.message.includes('Unknown column \'pf.deleted_at\'')) {
            [results] = await db.execute(
              `SELECT pf.project_id, pf.path, LEFT(pf.content, 200) as excerpt, p.name as project_name, p.emoji
               FROM project_files pf JOIN projects p ON p.id = pf.project_id
               WHERE pf.user_id = ? AND pf.content LIKE ? LIMIT 15`,
              [auth.userId, `%${q}%`]
            );
          } else {
            throw e;
          }
        }
        return ok(res, { results });
      } catch {
        return ok(res, { results: [] });
      }
    }

    return err(res, 'Not found', 404);
  } catch (e) {
    console.error('Data error:', e);
    return err(res, 'Server error', 500);
  } finally {
    if (db) await db.end();
  }
}
