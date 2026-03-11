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

    // ── SEARCH (Phase 3.3 Enhanced) ───────────────────────────
    if (resource === 'search') {
      if (!q?.trim()) return ok(res, { results: [], grouped: {} });
      
      const { project_id, folder, file_type, tag } = req.query;
      
      try {
        let query = `
          SELECT pf.project_id, pf.path, p.name as project_name, p.emoji,
                 LEFT(pf.content, 1000) as content_preview
          FROM project_files pf 
          JOIN projects p ON p.id = pf.project_id
          WHERE pf.user_id = ? AND pf.content LIKE ?
        `;
        const params = [auth.userId, `%${q}%`];
        
        // Apply filters
        if (project_id) {
          query += ` AND pf.project_id = ?`;
          params.push(project_id);
        }
        
        if (folder) {
          query += ` AND pf.path LIKE ?`;
          params.push(`${folder}/%`);
        }
        
        if (file_type) {
          query += ` AND pf.path LIKE ?`;
          params.push(`%.${file_type}`);
        }
        
        // Handle soft deletes
        try {
          query += ` AND pf.deleted_at IS NULL`;
        } catch {}
        
        query += ` LIMIT 50`;
        
        const [rows] = await db.execute(query, params);
        
        // Process results with highlighted excerpts
        const results = rows.map(row => {
          const content = row.content_preview || '';
          const lowerContent = content.toLowerCase();
          const lowerQuery = q.toLowerCase();
          const idx = lowerContent.indexOf(lowerQuery);
          
          // Create highlighted excerpt
          let excerpt = '';
          if (idx >= 0) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(content.length, idx + q.length + 60);
            excerpt = content.slice(start, end);
            // Add ellipsis if truncated
            if (start > 0) excerpt = '...' + excerpt;
            if (end < content.length) excerpt = excerpt + '...';
          } else {
            excerpt = content.slice(0, 120) + (content.length > 120 ? '...' : '');
          }
          
          // Extract folder from path
          const folderMatch = row.path.match(/^([^/]+)/);
          const fileFolder = folderMatch ? folderMatch[1] : 'root';
          
          // Extract file extension
          const extMatch = row.path.match(/\.([^.]+)$/);
          const extension = extMatch ? extMatch[1].toLowerCase() : '';
          
          return {
            project_id: row.project_id,
            project_name: row.project_name,
            emoji: row.emoji,
            path: row.path,
            folder: fileFolder,
            extension,
            excerpt,
            // For highlighting
            match_index: idx,
            query: q
          };
        });
        
        // Group by project
        const grouped = {};
        results.forEach(r => {
          if (!grouped[r.project_id]) {
            grouped[r.project_id] = {
              project_id: r.project_id,
              project_name: r.project_name,
              emoji: r.emoji,
              matches: []
            };
          }
          grouped[r.project_id].matches.push(r);
        });
        
        return ok(res, { results, grouped });
      } catch (e) {
        console.error('Search error:', e);
        return ok(res, { results: [], grouped: {} });
      }
    }

    // ── DAILY CHECKINS (Phase 2.5) ────────────────────────────
    if (resource === 'daily-checkins') {
      const { date, days } = req.query;

      if (req.method === 'GET') {
        // Get single date or range of dates
        if (date) {
          // Get specific date
          const [rows] = await db.execute(
            'SELECT * FROM daily_checkins WHERE user_id = ? AND date = ?',
            [auth.userId, date]
          );
          return ok(res, { checkin: rows[0] || null });
        } else if (days) {
          // Get last N days
          const numDays = parseInt(days) || 7;
          const [rows] = await db.execute(
            `SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY date DESC LIMIT ?`,
            [auth.userId, numDays]
          );
          return ok(res, { checkins: rows });
        } else {
          // Get all
          const [rows] = await db.execute(
            'SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY date DESC',
            [auth.userId]
          );
          return ok(res, { checkins: rows });
        }
      }

      if (req.method === 'POST') {
        const { date: checkDate, sleep_hours, energy_level, gut_symptoms, training_done, notes } = req.body || {};
        if (!checkDate) return err(res, 'date required');

        const id = crypto.randomUUID();
        try {
          await db.execute(
            `INSERT INTO daily_checkins (id, user_id, date, sleep_hours, energy_level, gut_symptoms, training_done, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, auth.userId, checkDate, sleep_hours || null, energy_level || null, gut_symptoms || null, training_done || 0, notes || null]
          );
          return ok(res, { success: true, id }, 201);
        } catch (e) {
          // Handle duplicate key (upsert): update instead
          if (e.code === 'ER_DUP_ENTRY') {
            await db.execute(
              `UPDATE daily_checkins SET sleep_hours = ?, energy_level = ?, gut_symptoms = ?, training_done = ?, notes = ?, updated_at = NOW()
               WHERE user_id = ? AND date = ?`,
              [sleep_hours || null, energy_level || null, gut_symptoms || null, training_done || 0, notes || null, auth.userId, checkDate]
            );
            return ok(res, { success: true, updated: true });
          }
          throw e;
        }
      }

      if (req.method === 'PUT' && resourceId) {
        const { sleep_hours, energy_level, gut_symptoms, training_done, notes } = req.body || {};
        await db.execute(
          `UPDATE daily_checkins SET sleep_hours = ?, energy_level = ?, gut_symptoms = ?, training_done = ?, notes = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
          [sleep_hours || null, energy_level || null, gut_symptoms || null, training_done || 0, notes || null, resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── TRAINING LOGS (Phase 2.6) ────────────────────────────
    if (resource === 'training-logs') {
      const { date, days, weeks } = req.query;

      if (req.method === 'GET') {
        // Stats mode: weekly counts + averages
        if (weeks) {
          const numWeeks = parseInt(weeks) || 4;
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - numWeeks * 7);
          const since = sinceDate.toISOString().split('T')[0];
          const [rows] = await db.execute(
            `SELECT date, duration_minutes, type, energy_after
             FROM training_logs WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
            [auth.userId, since]
          );
          // Compute weekly buckets
          const weekMap = {};
          for (const r of rows) {
            const d = new Date(r.date);
            // ISO week start (Monday)
            const day = d.getDay() || 7;
            const monday = new Date(d);
            monday.setDate(d.getDate() - day + 1);
            const weekKey = monday.toISOString().split('T')[0];
            if (!weekMap[weekKey]) weekMap[weekKey] = { sessions: 0, total_minutes: 0, types: {} };
            weekMap[weekKey].sessions++;
            weekMap[weekKey].total_minutes += r.duration_minutes || 0;
            weekMap[weekKey].types[r.type] = (weekMap[weekKey].types[r.type] || 0) + 1;
          }
          const totalSessions = rows.length;
          const totalMinutes = rows.reduce((s, r) => s + (r.duration_minutes || 0), 0);
          const avgEnergy = rows.filter(r => r.energy_after != null);
          return ok(res, {
            stats: {
              total_sessions: totalSessions,
              total_minutes: totalMinutes,
              avg_duration: totalSessions ? Math.round(totalMinutes / totalSessions) : 0,
              avg_energy_after: avgEnergy.length ? Math.round(avgEnergy.reduce((s, r) => s + r.energy_after, 0) / avgEnergy.length * 10) / 10 : null,
              weeks: weekMap,
            },
            logs: rows,
          });
        }
        // Single date
        if (date) {
          const [rows] = await db.execute(
            'SELECT * FROM training_logs WHERE user_id = ? AND date = ? ORDER BY created_at DESC',
            [auth.userId, date]
          );
          return ok(res, { logs: rows });
        }
        // Recent N days
        if (days) {
          const numDays = parseInt(days) || 7;
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - numDays);
          const since = sinceDate.toISOString().split('T')[0];
          const [rows] = await db.execute(
            'SELECT * FROM training_logs WHERE user_id = ? AND date >= ? ORDER BY date DESC',
            [auth.userId, since]
          );
          return ok(res, { logs: rows });
        }
        // Default: all
        const [rows] = await db.execute(
          'SELECT * FROM training_logs WHERE user_id = ? ORDER BY date DESC LIMIT 100',
          [auth.userId]
        );
        return ok(res, { logs: rows });
      }

      if (req.method === 'POST') {
        const { date: logDate, duration_minutes, type, notes, energy_after } = req.body || {};
        if (!logDate) return err(res, 'date required');
        if (!duration_minutes || duration_minutes < 1) return err(res, 'duration_minutes required (>0)');
        const validTypes = ['solo', 'class', 'sparring', 'conditioning', 'other'];
        const safeType = validTypes.includes(type) ? type : 'solo';

        const id = crypto.randomUUID();
        await db.execute(
          `INSERT INTO training_logs (id, user_id, date, duration_minutes, type, notes, energy_after)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, auth.userId, logDate, duration_minutes, safeType, notes || null, energy_after != null ? energy_after : null]
        );
        return ok(res, { success: true, id }, 201);
      }

      if (req.method === 'PUT' && resourceId) {
        const { duration_minutes, type, notes, energy_after } = req.body || {};
        const validTypes = ['solo', 'class', 'sparring', 'conditioning', 'other'];
        const safeType = type && validTypes.includes(type) ? type : undefined;
        const sets = [];
        const vals = [];
        if (duration_minutes != null) { sets.push('duration_minutes = ?'); vals.push(duration_minutes); }
        if (safeType) { sets.push('type = ?'); vals.push(safeType); }
        if (notes !== undefined) { sets.push('notes = ?'); vals.push(notes || null); }
        if (energy_after !== undefined) { sets.push('energy_after = ?'); vals.push(energy_after); }
        if (sets.length === 0) return err(res, 'No fields to update');
        sets.push('updated_at = NOW()');
        vals.push(resourceId, auth.userId);
        await db.execute(
          `UPDATE training_logs SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
          vals
        );
        return ok(res, { success: true });
      }

      if (req.method === 'DELETE' && resourceId) {
        await db.execute(
          'DELETE FROM training_logs WHERE id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── OUTREACH LOG (Phase 2.7) ────────────────────────────
    if (resource === 'outreach-log') {
      const { date, days } = req.query;

      if (req.method === 'GET') {
        // Daily count stats mode
        if (days) {
          const numDays = parseInt(days) || 7;
          const sinceDate = new Date();
          sinceDate.setDate(sinceDate.getDate() - numDays);
          const since = sinceDate.toISOString().split('T')[0];
          const [rows] = await db.execute(
            'SELECT * FROM outreach_log WHERE user_id = ? AND date >= ? ORDER BY date DESC, created_at DESC',
            [auth.userId, since]
          );
          // Build daily counts map
          const dailyCounts = {};
          for (const r of rows) {
            dailyCounts[r.date] = (dailyCounts[r.date] || 0) + 1;
          }
          return ok(res, { logs: rows, daily_counts: dailyCounts, total: rows.length });
        }
        // Single date
        if (date) {
          const [rows] = await db.execute(
            'SELECT * FROM outreach_log WHERE user_id = ? AND date = ? ORDER BY created_at DESC',
            [auth.userId, date]
          );
          return ok(res, { logs: rows, count: rows.length });
        }
        // Default: recent 30 days
        const [rows] = await db.execute(
          'SELECT * FROM outreach_log WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 200',
          [auth.userId]
        );
        return ok(res, { logs: rows });
      }

      if (req.method === 'POST') {
        const { date: logDate, type, target, project_id, notes } = req.body || {};
        if (!logDate) return err(res, 'date required');
        const validTypes = ['message', 'post', 'call', 'email', 'other'];
        const safeType = validTypes.includes(type) ? type : 'message';

        const id = crypto.randomUUID();
        await db.execute(
          `INSERT INTO outreach_log (id, user_id, date, type, target, project_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, auth.userId, logDate, safeType, target || null, project_id || null, notes || null]
        );
        return ok(res, { success: true, id }, 201);
      }

      if (req.method === 'DELETE' && resourceId) {
        await db.execute(
          'DELETE FROM outreach_log WHERE id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── WEEKLY REVIEW (Phase 2.9) ─────────────────────────────
    if (resource === 'weekly-review') {
      if (req.method === 'GET') {
        const { week, list } = req.query;

        // List recent reviews
        if (list) {
          const n = Math.min(parseInt(list) || 8, 52);
          const [rows] = await db.execute(
            `SELECT id, week_start, what_shipped, what_blocked, next_priority, ai_analysis, created_at, updated_at
             FROM weekly_reviews WHERE user_id = ? ORDER BY week_start DESC LIMIT ?`,
            [auth.userId, n]
          );
          return ok(res, { reviews: rows });
        }

        // Get single week with aggregated data
        const weekStart = week || (() => {
          const d = new Date();
          const day = d.getDay();
          const diff = (day === 0 ? -6 : 1 - day);
          d.setDate(d.getDate() + diff);
          return d.toISOString().split('T')[0];
        })();

        const weekEnd = (() => {
          const d = new Date(weekStart);
          d.setDate(d.getDate() + 6);
          return d.toISOString().split('T')[0];
        })();

        // Fetch saved review + aggregated stats in parallel
        const [
          [reviewRows],
          [sessionRows],
          [checkinRows],
          [trainingRows],
          [outreachRows],
          [stagingRows],
        ] = await Promise.all([
          db.execute(
            'SELECT * FROM weekly_reviews WHERE user_id = ? AND week_start = ?',
            [auth.userId, weekStart]
          ),
          db.execute(
            `SELECT s.id, s.duration_s, s.log, s.ended_at, p.name as project_name
             FROM sessions s LEFT JOIN projects p ON p.id = s.project_id
             WHERE s.user_id = ? AND DATE(s.ended_at) BETWEEN ? AND ?
             ORDER BY s.ended_at DESC`,
            [auth.userId, weekStart, weekEnd]
          ),
          db.execute(
            `SELECT date, energy_level, sleep_hours, gut_symptoms, mood_score
             FROM daily_checkins WHERE user_id = ? AND date BETWEEN ? AND ?`,
            [auth.userId, weekStart, weekEnd]
          ),
          db.execute(
            `SELECT COUNT(*) as count, SUM(duration_minutes) as total_minutes
             FROM training_logs WHERE user_id = ? AND date BETWEEN ? AND ?`,
            [auth.userId, weekStart, weekEnd]
          ),
          db.execute(
            `SELECT COUNT(*) as count FROM outreach_log
             WHERE user_id = ? AND date BETWEEN ? AND ?`,
            [auth.userId, weekStart, weekEnd]
          ),
          db.execute(
            `SELECT COUNT(*) as count FROM staging
             WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)
             AND status = 'done'
             AND updated_at BETWEEN ? AND ?`,
            [auth.userId, weekStart + ' 00:00:00', weekEnd + ' 23:59:59']
          ),
        ]);

        const review = reviewRows[0] || null;
        const avgEnergy = checkinRows.length
          ? Math.round(checkinRows.reduce((s, r) => s + (r.energy_level || 0), 0) / checkinRows.length * 10) / 10
          : null;
        const avgSleep = checkinRows.length
          ? Math.round(checkinRows.reduce((s, r) => s + (r.sleep_hours || 0), 0) / checkinRows.length * 10) / 10
          : null;

        return ok(res, {
          week_start: weekStart,
          week_end: weekEnd,
          review,
          stats: {
            sessions: sessionRows.length,
            session_minutes: Math.round(sessionRows.reduce((s, r) => s + (r.duration_s || 0), 0) / 60),
            checkin_days: checkinRows.length,
            avg_energy: avgEnergy,
            avg_sleep: avgSleep,
            training_count: Number(trainingRows[0]?.count || 0),
            training_minutes: Number(trainingRows[0]?.total_minutes || 0),
            outreach_count: Number(outreachRows[0]?.count || 0),
            staging_done: Number(stagingRows[0]?.count || 0),
          },
          sessions: sessionRows,
        });
      }

      if (req.method === 'POST') {
        const { week_start, what_shipped, what_blocked, next_priority, ai_analysis, data_json } = req.body || {};
        if (!week_start) return err(res, 'week_start required');

        // Upsert
        const [existing] = await db.execute(
          'SELECT id FROM weekly_reviews WHERE user_id = ? AND week_start = ?',
          [auth.userId, week_start]
        );

        if (existing.length > 0) {
          await db.execute(
            `UPDATE weekly_reviews SET what_shipped=?, what_blocked=?, next_priority=?, ai_analysis=?, data_json=?, updated_at=NOW()
             WHERE user_id = ? AND week_start = ?`,
            [what_shipped || null, what_blocked || null, next_priority || null, ai_analysis || null, data_json || null, auth.userId, week_start]
          );
          return ok(res, { success: true, id: existing[0].id });
        } else {
          const [result] = await db.execute(
            `INSERT INTO weekly_reviews (user_id, week_start, what_shipped, what_blocked, next_priority, ai_analysis, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [auth.userId, week_start, what_shipped || null, what_blocked || null, next_priority || null, ai_analysis || null, data_json || null]
          );
          return ok(res, { success: true, id: result.insertId }, 201);
        }
      }
    }

    // ── AI METADATA SUGGESTIONS (Phase 3.1) ───────────────────
    if (resource === 'ai-metadata-suggestions') {
      if (req.method === 'POST') {
        const { project_id, file_path, content, project_name, project_phase } = req.body || {};
        if (!content) return err(res, 'content required');

        // Check ignore rules from agent-config.json
        const ignorePatterns = [
          'node_modules', '.git', 'dist', 'build', '.env',
          'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
        ];
        const lowerPath = (file_path || '').toLowerCase();
        for (const pattern of ignorePatterns) {
          if (lowerPath.includes(pattern)) {
            return ok(res, { ignored: true, reason: `File matches ignore pattern: ${pattern}` });
          }
        }

        // Only suggest for text/markdown files
        const suggestableExts = ['.md', '.txt', '.markdown'];
        const hasSuggestableExt = suggestableExts.some(ext => lowerPath.endsWith(ext));
        if (!hasSuggestableExt && content.length > 5000) {
          return ok(res, { ignored: true, reason: 'File type not supported for suggestions' });
        }

        // Truncate content if too long (first 3000 chars is enough for analysis)
        const truncatedContent = content.slice(0, 3000);

        // Call Anthropic API for suggestions
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (!ANTHROPIC_API_KEY) {
          return ok(res, { error: 'AI provider not configured', suggestions: null });
        }

        const systemPrompt = `You are a metadata analysis assistant. Analyze the provided file content and suggest metadata.

Respond with ONLY a JSON object in this exact format:
{
  "category": "one of: documentation, planning, research, code, design, marketing, other",
  "status": "one of: draft, review, final, archived",
  "tags": ["tag1", "tag2", "tag3"],
  "related_projects": ["project-id-1", "project-id-2"],
  "confidence": 0.85
}

Rules:
- category: best fit based on content type
- status: draft if incomplete/notes, review if needs feedback, final if polished
- tags: 2-5 relevant tags based on content themes
- related_projects: suggest related project IDs if content references other projects (empty array if none)
- confidence: 0.0-1.0 score of how confident you are in these suggestions

Be concise. Return valid JSON only.`;

        const userPrompt = `Analyze this file and suggest metadata:

File path: ${file_path || 'unknown'}
Project: ${project_name || 'unknown'} (${project_phase || 'unknown phase'})

Content:
---
${truncatedContent}
---

Provide metadata suggestions as JSON.`;

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: 500,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            console.error('Anthropic API error:', data);
            return ok(res, { error: 'AI analysis failed', suggestions: null });
          }

          // Parse the JSON response
          let suggestions;
          try {
            const text = data.content?.[0]?.text || '{}';
            // Extract JSON from potential markdown code block
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/) || [null, text];
            suggestions = JSON.parse(jsonMatch[1] || text);
          } catch (e) {
            console.error('Failed to parse AI response:', e);
            suggestions = null;
          }

          return ok(res, { 
            suggestions,
            usage: data.usage,
            content_sampled: truncatedContent.length < content.length ? `${truncatedContent.length} of ${content.length} chars` : 'full content'
          });
        } catch (e) {
          console.error('AI metadata suggestion error:', e);
          return ok(res, { error: 'Analysis failed', suggestions: null });
        }
      }
    }

    // ── DRIFT CHECK (Phase 2.10) ──────────────────────────────
    if (resource === 'drift-check') {
      if (req.method === 'GET') {
        const today = new Date().toISOString().split('T')[0];
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Fetch all data in parallel
        const [
          [checkinRows],
          [trainingRows],
          [outreachRows],
          [sessionRows],
          [projectRows],
        ] = await Promise.all([
          // Last 14 days of check-ins
          db.execute(
            'SELECT date, energy_level, sleep_hours, gut_symptoms FROM daily_checkins WHERE user_id = ? AND date >= ? ORDER BY date DESC',
            [auth.userId, fourteenDaysAgo]
          ),
          // Training logs for last 14 days
          db.execute(
            'SELECT date, duration_minutes FROM training_logs WHERE user_id = ? AND date >= ? ORDER BY date DESC',
            [auth.userId, fourteenDaysAgo]
          ),
          // Outreach for last 5 days
          db.execute(
            'SELECT date FROM outreach_log WHERE user_id = ? AND date >= ? ORDER BY date DESC',
            [auth.userId, fiveDaysAgo]
          ),
          // Sessions for last 14 days
          db.execute(
            'SELECT project_id, ended_at FROM sessions WHERE user_id = ? AND ended_at >= ? ORDER BY ended_at DESC',
            [auth.userId, fourteenDaysAgo + ' 00:00:00']
          ),
          // Project health history (last 14 days of health snapshots if available, or current)
          db.execute(
            'SELECT id, name, health, phase, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
            [auth.userId]
          ),
        ]);

        const flags = [];

        // Rule 1: Training < 3 sessions/week for 2 consecutive weeks
        const trainingByWeek = {};
        for (const row of trainingRows) {
          const d = new Date(row.date);
          const day = d.getDay() || 7;
          const monday = new Date(d);
          monday.setDate(d.getDate() - day + 1);
          const weekKey = monday.toISOString().split('T')[0];
          trainingByWeek[weekKey] = (trainingByWeek[weekKey] || 0) + 1;
        }
        const weekKeys = Object.keys(trainingByWeek).sort().slice(-2); // Last 2 weeks
        if (weekKeys.length >= 2) {
          const week1Count = trainingByWeek[weekKeys[0]] || 0;
          const week2Count = trainingByWeek[weekKeys[1]] || 0;
          if (week1Count < 3 && week2Count < 3) {
            flags.push({
              type: 'training_deficit',
              severity: 'high',
              message: `Training below minimum: ${week1Count} sessions this week, ${week2Count} last week (target: 3/week)`,
              data: { currentWeek: week1Count, lastWeek: week2Count }
            });
          }
        }

        // Rule 2: Outreach = 0 for 5+ days
        const uniqueOutreachDays = new Set(outreachRows.map(r => r.date)).size;
        if (uniqueOutreachDays === 0) {
          flags.push({
            type: 'outreach_gap',
            severity: 'high',
            message: 'No outreach actions for 5+ days — mandatory daily minimum not met',
            data: { daysSince: 5 }
          });
        }

        // Rule 3: Average energy declining over 7 days
        const recentCheckins = checkinRows.filter(r => r.energy_level != null && r.date >= sevenDaysAgo);
        if (recentCheckins.length >= 3) {
          const avgEnergy = recentCheckins.reduce((s, r) => s + r.energy_level, 0) / recentCheckins.length;
          // Check if declining trend (compare first half vs second half)
          const mid = Math.floor(recentCheckins.length / 2);
          const firstHalf = recentCheckins.slice(0, mid);
          const secondHalf = recentCheckins.slice(mid);
          const firstAvg = firstHalf.reduce((s, r) => s + r.energy_level, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((s, r) => s + r.energy_level, 0) / secondHalf.length;
          if (secondAvg < firstAvg - 1) {
            flags.push({
              type: 'energy_decline',
              severity: 'medium',
              message: `Energy declining: ${firstAvg.toFixed(1)} → ${secondAvg.toFixed(1)} over last 7 days`,
              data: { firstHalfAvg: firstAvg, secondHalfAvg: secondAvg, currentAvg: avgEnergy }
            });
          }
        }

        // Rule 4: No sessions logged for 3+ days
        const recentSessions = sessionRows.filter(r => r.ended_at && r.ended_at >= threeDaysAgo + ' 00:00:00');
        if (recentSessions.length === 0) {
          const lastSession = sessionRows[0];
          const daysSince = lastSession 
            ? Math.floor((Date.now() - new Date(lastSession.ended_at).getTime()) / (24 * 60 * 60 * 1000))
            : 14;
          flags.push({
            type: 'session_gap',
            severity: 'medium',
            message: `No work sessions for ${daysSince} days`,
            data: { daysSince }
          });
        }

        // Rule 5: Same project focus for 14+ days with no health improvement
        const sessionsByProject = {};
        for (const row of sessionRows) {
          if (!sessionsByProject[row.project_id]) {
            sessionsByProject[row.project_id] = [];
          }
          sessionsByProject[row.project_id].push(row);
        }
        // Find project with most recent sessions
        let primaryProjectId = null;
        let primaryProjectCount = 0;
        for (const [pid, sessions] of Object.entries(sessionsByProject)) {
          if (sessions.length > primaryProjectCount) {
            primaryProjectCount = sessions.length;
            primaryProjectId = pid;
          }
        }
        if (primaryProjectId && primaryProjectCount >= 3) {
          const project = projectRows.find(p => p.id === primaryProjectId);
          if (project && project.health < 60) {
            flags.push({
              type: 'stagnant_project',
              severity: 'medium',
              message: `${project.name} stuck at health ${project.health} — ${primaryProjectCount} sessions logged but no improvement`,
              data: { projectId: primaryProjectId, projectName: project.name, health: project.health, sessionCount: primaryProjectCount }
            });
          }
        }

        return ok(res, { 
          flags, 
          checked_at: new Date().toISOString(),
          summary: {
            checkins: checkinRows.length,
            trainingSessions: trainingRows.length,
            outreachDays: uniqueOutreachDays,
            sessions: sessionRows.length,
            projects: projectRows.length
          }
        });
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
