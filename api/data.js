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
        const { status, notes } = req.body || {};
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
