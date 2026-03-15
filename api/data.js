// api/data.js — Vercel serverless function
// Handles: staging, ideas, sessions, comments, search

import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl: { rejectUnauthorized: true },
  });
}

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(res, data, status = 200) {
  return res.status(status).json(data);
}
function err(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}
function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}
function safeJson(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// ── PAGINATION HELPER (Phase 8.3) ────────────────────────────
function addPagination(query, params, req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  return {
    query: `${query} LIMIT ? OFFSET ?`,
    params: [...params, limit, offset],
    pagination: { page, limit, offset },
  };
}

function formatPaginatedResponse(items, count, pagination) {
  return {
    data: items,
    pagination: {
      ...pagination,
      total: count,
      total_pages: Math.ceil(count / pagination.limit),
    },
  };
}

// ── RATE LIMITING (Phase 8.4) ────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute

function checkRateLimit(userId) {
  const now = Date.now();
  const key = userId || 'anonymous';
  const record = rateLimitMap.get(key) || { count: 0, windowStart: now };

  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.windowStart = now;
  } else {
    record.count++;
  }

  rateLimitMap.set(key, record);

  if (record.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

// ── INPUT SANITIZATION (Phase 8.4) ──────────────────────────
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  // Remove potential SQL injection patterns
  return str
    .replace(
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi,
      ''
    )
    .replace(/(--|#|\/\*|\*\/)/g, '')
    .trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) =>
        typeof v === 'string' ? sanitizeInput(v) : v
      );
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  // Rate limiting (Phase 8.4)
  if (!checkRateLimit(auth.userId)) {
    return err(res, 'Rate limit exceeded. Please try again later.', 429);
  }

  // Sanitize request body inputs (Phase 8.4)
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  const {
    resource,
    id: resourceId,
    project_id,
    file_path,
    q,
    limit,
    health_only,
  } = req.query;
  let db;

  try {
    db = await getDb();

    // ── STAGING ──────────────────────────────────────────────
    if (resource === 'staging') {
      if (req.method === 'GET') {
        const [rows] = project_id
          ? await db.execute(
              'SELECT * FROM staging WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC',
              [auth.userId, project_id]
            )
          : await db.execute(
              'SELECT * FROM staging WHERE user_id = ? ORDER BY created_at DESC',
              [auth.userId]
            );
        return ok(res, { staging: rows });
      }
      if (req.method === 'POST') {
        const {
          id,
          project_id: pid,
          name,
          tag,
          status,
          notes,
          added,
        } = req.body || {};
        if (!name || !pid) return err(res, 'name and project_id required');
        const newId = id || crypto.randomUUID();
        await db.execute(
          'INSERT INTO staging (id, user_id, project_id, name, tag, status, notes, added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newId,
            auth.userId,
            pid,
            name,
            tag || 'IDEA_',
            status || 'in-review',
            notes || '',
            added || new Date().toISOString().slice(0, 7),
          ]
        );
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { action } = req.query;
        const { status, notes, folder_id, filename } = req.body || {};

        // Phase 2.3: Move staging item to folder
        if (action === 'moveToFolder' && folder_id && filename) {
          try {
            // Get staging item
            const [stagingRows] = await db.execute(
              'SELECT * FROM staging WHERE id = ? AND user_id = ?',
              [resourceId, auth.userId]
            );
            if (!stagingRows.length)
              return err(res, 'Staging item not found', 404);
            const stagingItem = stagingRows[0];

            // Get project files to check for conflicts
            const [existingFiles] = await db.execute(
              'SELECT * FROM project_files WHERE project_id = ? AND path = ?',
              [stagingItem.project_id, `${folder_id}/${filename}`]
            );

            let finalPath = `${folder_id}/${filename}`;
            if (existingFiles.length > 0) {
              // Add timestamp suffix to avoid conflict
              const ext = filename.split('.').pop();
              const base = filename.replace(new RegExp(`\\.${ext}$`), '');
              const timestamp = new Date()
                .toISOString()
                .replace(/[:-]/g, '')
                .slice(0, 15);
              finalPath = `${folder_id}/${base}_${timestamp}.${ext}`;
            }

            // Get staging file content
            const [stagingFileRows] = await db.execute(
              'SELECT * FROM project_files WHERE project_id = ? AND path = ?',
              [stagingItem.project_id, `staging/${stagingItem.name}`]
            );

            if (stagingFileRows.length > 0) {
              const stagingFile = stagingFileRows[0];
              // Copy to new location
              await db.execute(
                'INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?)',
                [
                  stagingItem.project_id,
                  auth.userId,
                  finalPath,
                  stagingFile.content,
                ]
              );
              // Delete from staging
              await db.execute(
                'DELETE FROM project_files WHERE project_id = ? AND path = ?',
                [stagingItem.project_id, `staging/${stagingItem.name}`]
              );
            }

            // Update staging record with folder path and filed timestamp
            const filedAt = new Date().toISOString();
            await db.execute(
              'UPDATE staging SET folder_path = ?, filed_at = ? WHERE id = ? AND user_id = ?',
              [finalPath, filedAt, resourceId, auth.userId]
            );

            return ok(res, {
              success: true,
              folder_path: finalPath,
              filed_at: filedAt,
            });
          } catch (e) {
            console.error('moveToFolder error:', e);
            return err(res, 'Failed to move file to folder');
          }
        }

        // Regular status/notes update
        const fields = [],
          values = [];
        if (status !== undefined) {
          fields.push('status = ?');
          values.push(status);
        }
        if (notes !== undefined) {
          fields.push('notes = ?');
          values.push(notes);
        }
        if (fields.length) {
          values.push(resourceId, auth.userId);
          await db.execute(
            `UPDATE staging SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
          );
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM staging WHERE id = ? AND user_id = ?', [
          resourceId,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── IDEAS ─────────────────────────────────────────────────
    if (resource === 'ideas') {
      if (req.method === 'GET') {
        const [rows] = await db.execute(
          'SELECT * FROM ideas WHERE user_id = ? ORDER BY score DESC, created_at DESC',
          [auth.userId]
        );
        return ok(res, {
          ideas: rows.map((r) => ({ ...r, tags: safeJson(r.tags, []) })),
        });
      }
      if (req.method === 'POST') {
        const { id, title, score, tags, added } = req.body || {};
        if (!title) return err(res, 'title required');
        const newId = id || crypto.randomUUID();
        await db.execute(
          'INSERT INTO ideas (id, user_id, title, score, tags, added) VALUES (?, ?, ?, ?, ?, ?)',
          [
            newId,
            auth.userId,
            title,
            score || 5,
            JSON.stringify(tags || []),
            added || new Date().toISOString().slice(0, 7),
          ]
        );
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { score, tags } = req.body || {};
        await db.execute(
          'UPDATE ideas SET score = ?, tags = ? WHERE id = ? AND user_id = ?',
          [score, JSON.stringify(tags || []), resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM ideas WHERE id = ? AND user_id = ?', [
          resourceId,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── SESSIONS ──────────────────────────────────────────────
    if (resource === 'sessions') {
      if (req.method === 'GET') {
        const lim = parseInt(limit || '20');
        const [rows] = await db.execute(
          'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
          [auth.userId, lim]
        );
        return ok(res, { sessions: rows });
      }
      if (req.method === 'POST') {
        const {
          project_id: pid,
          duration_s,
          log,
          started_at,
          ended_at,
        } = req.body || {};
        const id = crypto.randomUUID();
        await db.execute(
          'INSERT INTO sessions (id, user_id, project_id, duration_s, log, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            auth.userId,
            pid || null,
            duration_s || 0,
            log || '',
            started_at || null,
            ended_at || null,
          ]
        );
        return ok(res, { success: true, id }, 201);
      }
    }

    // ── COMMENTS ─────────────────────────────────────────────
    if (resource === 'comments') {
      if (req.method === 'GET') {
        if (!project_id || !file_path)
          return err(res, 'project_id and file_path required');
        const [rows] = await db.execute(
          'SELECT * FROM comments WHERE user_id = ? AND project_id = ? AND file_path = ? ORDER BY created_at ASC',
          [auth.userId, project_id, file_path]
        );
        return ok(res, { comments: rows });
      }
      if (req.method === 'POST') {
        const { project_id: pid, file_path: fp, text } = req.body || {};
        if (!pid || !fp || !text)
          return err(res, 'project_id, file_path and text required');
        const id = crypto.randomUUID();
        await db.execute(
          'INSERT INTO comments (id, user_id, project_id, file_path, text) VALUES (?, ?, ?, ?, ?)',
          [id, auth.userId, pid, fp, text]
        );
        return ok(res, { success: true, id }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { resolved } = req.body || {};
        await db.execute(
          'UPDATE comments SET resolved = ? WHERE id = ? AND user_id = ?',
          [resolved ? 1 : 0, resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM comments WHERE id = ? AND user_id = ?', [
          resourceId,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── FILE METADATA (Roadmap 2.3) ───────────────────────────
    if (resource === 'file_metadata') {
      if (req.method === 'GET') {
        if (!project_id || !file_path)
          return err(res, 'project_id and file_path required');
        const [rows] = await db.execute(
          'SELECT * FROM file_metadata WHERE user_id = ? AND project_id = ? AND file_path = ?',
          [auth.userId, project_id, file_path]
        );
        const metadata =
          rows.length > 0
            ? { ...rows[0], metadata_json: safeJson(rows[0].metadata_json, {}) }
            : null;
        return ok(res, { metadata });
      }
      if (req.method === 'POST') {
        const {
          project_id: pid,
          file_path: fp,
          category,
          status,
          metadata_json,
        } = req.body || {};
        if (!pid || !fp) return err(res, 'project_id and file_path required');
        await db.execute(
          'INSERT INTO file_metadata (project_id, user_id, file_path, category, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
          [
            pid,
            auth.userId,
            fp,
            category || null,
            status || 'draft',
            metadata_json ? JSON.stringify(metadata_json) : null,
          ]
        );
        return ok(res, { success: true }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { category, status, metadata_json } = req.body || {};
        const fields = ['updated_at = NOW()'],
          values = [];
        if (category !== undefined) {
          fields.push('category = ?');
          values.push(category);
        }
        if (status !== undefined) {
          fields.push('status = ?');
          values.push(status);
        }
        if (metadata_json !== undefined) {
          fields.push('metadata_json = ?');
          values.push(metadata_json ? JSON.stringify(metadata_json) : null);
        }
        if (fields.length > 1) {
          values.push(resourceId, auth.userId);
          await db.execute(
            `UPDATE file_metadata SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
          );
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute(
          'DELETE FROM file_metadata WHERE id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── AREAS ─────────────────────────────────────────────────
    if (resource === 'areas') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute(
            'SELECT * FROM life_areas WHERE user_id = ? ORDER BY sort_order ASC',
            [auth.userId]
          );
          return ok(res, { areas: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, { areas: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { id, name, color, icon, description, target_hours_weekly } =
          req.body || {};
        if (!name) return err(res, 'name required');
        const newId = id || crypto.randomUUID();
        await db.execute(
          'INSERT INTO life_areas (id, user_id, name, color, icon, description, target_hours_weekly) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            newId,
            auth.userId,
            name,
            color || '#3b82f6',
            icon || '🌐',
            description || '',
            target_hours_weekly || null,
          ]
        );
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [],
          values = [];
        const map = {
          name: 'name',
          color: 'color',
          icon: 'icon',
          description: 'description',
          target_hours_weekly: 'target_hours_weekly',
          health_score: 'health_score',
          sort_order: 'sort_order',
        };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = ?`);
            values.push(data[k]);
          }
        }
        if (fields.length) {
          values.push(resourceId, auth.userId);
          await db.execute(
            `UPDATE life_areas SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
          );
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute(
          'DELETE FROM life_areas WHERE id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        // Also unassign projects
        await db.execute(
          'UPDATE projects SET life_area_id = NULL WHERE life_area_id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── GOALS ─────────────────────────────────────────────────
    if (resource === 'goals') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute(
            'SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC',
            [auth.userId]
          );
          return ok(res, { goals: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, { goals: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const {
          id,
          title,
          target_amount,
          current_amount,
          currency,
          timeframe,
          category,
          status,
        } = req.body || {};
        if (!title || target_amount === undefined)
          return err(res, 'title and target_amount required');
        const newId = id || crypto.randomUUID();
        await db.execute(
          'INSERT INTO goals (id, user_id, title, target_amount, current_amount, currency, timeframe, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newId,
            auth.userId,
            title,
            target_amount,
            current_amount || 0,
            currency || 'GBP',
            timeframe || 'monthly',
            category || 'income',
            status || 'active',
          ]
        );
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [],
          values = [];
        const map = {
          title: 'title',
          target_amount: 'target_amount',
          current_amount: 'current_amount',
          currency: 'currency',
          timeframe: 'timeframe',
          category: 'category',
          status: 'status',
        };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = ?`);
            values.push(data[k]);
          }
        }
        if (fields.length) {
          values.push(resourceId, auth.userId);
          await db.execute(
            `UPDATE goals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
          );
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', [
          resourceId,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── TEMPLATES ───────────────────────────────────────────────
    if (resource === 'templates') {
      if (req.method === 'GET') {
        try {
          const [rows] = await db.execute(
            'SELECT * FROM templates WHERE user_id IS NULL OR user_id = ? ORDER BY is_system DESC, name ASC',
            [auth.userId]
          );
          return ok(res, {
            templates: rows.map((r) => ({
              ...r,
              config: safeJson(r.config, {}),
            })),
          });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, { templates: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { id, name, description, icon, category, config, is_system } =
          req.body || {};
        if (!name || !config) return err(res, 'name and config required');
        const newId = id || crypto.randomUUID();
        await db.execute(
          'INSERT INTO templates (id, user_id, name, description, icon, category, config, is_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newId,
            auth.userId,
            name,
            description || '',
            icon || '📄',
            category || 'custom',
            JSON.stringify(config),
            is_system ? 1 : 0,
          ]
        );
        return ok(res, { success: true, id: newId }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const data = req.body || {};
        const fields = [],
          values = [];
        const map = {
          name: 'name',
          description: 'description',
          icon: 'icon',
          category: 'category',
          config: 'config',
          is_system: 'is_system',
        };
        for (const [k, col] of Object.entries(map)) {
          if (data[k] !== undefined) {
            fields.push(`${col} = ?`);
            values.push(k === 'config' ? JSON.stringify(data[k]) : data[k]);
          }
        }
        if (fields.length) {
          values.push(resourceId, auth.userId);
          await db.execute(
            `UPDATE templates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
            values
          );
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM templates WHERE id = ? AND user_id = ?', [
          resourceId,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── GOAL CONTRIBUTIONS ──────────────────────────────────────
    if (resource === 'contributions') {
      if (req.method === 'GET') {
        const { goal_id } = req.query;
        if (!goal_id) return err(res, 'goal_id required');
        try {
          const [rows] = await db.execute(
            'SELECT * FROM goal_contributions WHERE user_id = ? AND goal_id = ? ORDER BY date DESC',
            [auth.userId, goal_id]
          );
          return ok(res, { contributions: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, { contributions: [] });
          } else {
            throw e;
          }
        }
      }
      if (req.method === 'POST') {
        const { goal_id, project_id, source_label, amount, date, notes } =
          req.body || {};
        if (!goal_id || amount === undefined)
          return err(res, 'goal_id and amount required');
        const id = crypto.randomUUID();
        await db.execute(
          'INSERT INTO goal_contributions (id, goal_id, user_id, project_id, source_label, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            goal_id,
            auth.userId,
            project_id || null,
            source_label || '',
            amount,
            date || new Date().toISOString().slice(0, 10),
            notes || '',
          ]
        );

        // Auto-update current_amount in goal
        await db.execute(
          'UPDATE goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?',
          [amount, goal_id, auth.userId]
        );

        return ok(res, { success: true, id }, 201);
      }
      if (req.method === 'DELETE' && resourceId) {
        // Need goal_id to update current_amount
        const [rows] = await db.execute(
          'SELECT goal_id, amount FROM goal_contributions WHERE id = ? AND user_id = ?',
          [resourceId, auth.userId]
        );
        if (rows.length) {
          const { goal_id, amount } = rows[0];
          await db.execute(
            'DELETE FROM goal_contributions WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          await db.execute(
            'UPDATE goals SET current_amount = current_amount - ? WHERE id = ? AND user_id = ?',
            [amount, goal_id, auth.userId]
          );
        }
        return ok(res, { success: true });
      }
    }

    // ── SETTINGS ──────────────────────────────────────────────
    if (resource === 'settings') {
      if (req.method === 'GET') {
        const [rows] = await db.execute(
          'SELECT settings FROM users WHERE id = ?',
          [auth.userId]
        );
        let parsed = {};
        try {
          parsed = JSON.parse(rows[0]?.settings || '{}');
        } catch (_) {}
        return ok(res, { settings: parsed });
      }
      if (req.method === 'PUT') {
        const settingsJson = JSON.stringify(req.body || {});
        await db.execute('UPDATE users SET settings = ? WHERE id = ?', [
          settingsJson,
          auth.userId,
        ]);
        return ok(res, { success: true });
      }
    }

    // ── TAGS ──────────────────────────────────────────────────
    if (resource === 'tags') {
      try {
        if (req.method === 'GET') {
          const [rows] = await db.execute(
            'SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC',
            [auth.userId]
          );
          return ok(res, { tags: rows });
        }
        if (req.method === 'POST') {
          const { name, color, category } = req.body || {};
          if (!name?.trim()) return err(res, 'name required');
          // Upsert — return existing tag if name already exists
          const [existing] = await db.execute(
            'SELECT * FROM tags WHERE user_id = ? AND name = ?',
            [auth.userId, name.trim()]
          );
          if (existing.length)
            return ok(
              res,
              { success: true, id: existing[0].id, tag: existing[0] },
              200
            );
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)',
            [
              id,
              auth.userId,
              name.trim(),
              color || '#3b82f6',
              category || 'custom',
            ]
          );
          return ok(
            res,
            {
              success: true,
              id,
              tag: {
                id,
                user_id: auth.userId,
                name: name.trim(),
                color: color || '#3b82f6',
                category: category || 'custom',
              },
            },
            201
          );
        }
        if (req.method === 'PUT' && resourceId) {
          const { name, color, category } = req.body || {};
          const fields = [],
            values = [];
          if (name) {
            fields.push('name = ?');
            values.push(name.trim());
          }
          if (color) {
            fields.push('color = ?');
            values.push(color);
          }
          if (category) {
            fields.push('category = ?');
            values.push(category);
          }
          if (fields.length) {
            values.push(resourceId, auth.userId);
            await db.execute(
              `UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
              values
            );
          }
          return ok(res, { success: true });
        }
        if (req.method === 'DELETE' && resourceId) {
          await db.execute(
            'DELETE FROM entity_tags WHERE tag_id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          await db.execute('DELETE FROM tags WHERE id = ? AND user_id = ?', [
            resourceId,
            auth.userId,
          ]);
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist"))
          return ok(res, { tags: [] });
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
          const { tag_id, tag_name, tag_color, entity_type, entity_id } =
            req.body || {};
          if (!entity_type || !entity_id)
            return err(res, 'entity_type and entity_id required');
          let tid = tag_id;
          if (!tid && tag_name) {
            // Auto-create tag if not found
            const [existing] = await db.execute(
              'SELECT id FROM tags WHERE user_id = ? AND name = ?',
              [auth.userId, tag_name.trim()]
            );
            if (existing.length) {
              tid = existing[0].id;
            } else {
              tid = crypto.randomUUID();
              await db.execute(
                'INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)',
                [
                  tid,
                  auth.userId,
                  tag_name.trim(),
                  tag_color || '#3b82f6',
                  'custom',
                ]
              );
            }
          }
          if (!tid) return err(res, 'tag_id or tag_name required');
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT IGNORE INTO entity_tags (id, tag_id, user_id, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)',
            [id, tid, auth.userId, entity_type, entity_id]
          );
          const [tagRows] = await db.execute(
            'SELECT name, color FROM tags WHERE id = ?',
            [tid]
          );
          const tag = tagRows[0] || {};
          return ok(
            res,
            {
              id,
              tag_id: tid,
              name: tag.name || tag_name,
              color: tag.color || tag_color || '#3b82f6',
              entity_type,
              entity_id,
              user_id: auth.userId,
            },
            201
          );
        }
        if (req.method === 'DELETE') {
          // Detach: ?tag_id=X&entity_type=Y&entity_id=Z
          const { tag_id: tid, entity_type, entity_id } = req.query;
          if (!tid || !entity_type || !entity_id)
            return err(res, 'tag_id, entity_type, entity_id required');
          await db.execute(
            'DELETE FROM entity_tags WHERE tag_id = ? AND entity_type = ? AND entity_id = ? AND user_id = ?',
            [tid, entity_type, entity_id, auth.userId]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist"))
          return ok(res, { entity_tags: [] });
        throw e;
      }
    }

    // ── ENTITY LINKS ──────────────────────────────────────────
    if (resource === 'links') {
      try {
        if (req.method === 'GET') {
          // Get all links for an entity: ?entity_type=X&entity_id=Y
          const { entity_type, entity_id } = req.query;
          if (!entity_type || !entity_id)
            return err(res, 'entity_type and entity_id required');
          const [rows] = await db.execute(
            `SELECT * FROM entity_links WHERE user_id = ? AND (
              (source_type = ? AND source_id = ?) OR (target_type = ? AND target_id = ?)
            ) ORDER BY created_at DESC`,
            [auth.userId, entity_type, entity_id, entity_type, entity_id]
          );
          return ok(res, { links: rows });
        }
        if (req.method === 'POST') {
          const {
            source_type,
            source_id,
            target_type,
            target_id,
            relationship,
          } = req.body || {};
          if (!source_type || !source_id || !target_type || !target_id)
            return err(res, 'source and target required');
          const id = crypto.randomUUID();
          await db.execute(
            'INSERT IGNORE INTO entity_links (id, user_id, source_type, source_id, target_type, target_id, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              id,
              auth.userId,
              source_type,
              source_id,
              target_type,
              target_id,
              relationship || 'related',
            ]
          );
          return ok(res, { success: true, id }, 201);
        }
        if (req.method === 'DELETE' && resourceId) {
          await db.execute(
            'DELETE FROM entity_links WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist"))
          return ok(res, { links: [] });
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
        const results = rows.map((row) => {
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
            excerpt =
              content.slice(0, 120) + (content.length > 120 ? '...' : '');
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
            query: q,
          };
        });

        // Group by project
        const grouped = {};
        results.forEach((r) => {
          if (!grouped[r.project_id]) {
            grouped[r.project_id] = {
              project_id: r.project_id,
              project_name: r.project_name,
              emoji: r.emoji,
              matches: [],
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
      try {
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
          const {
            date: checkDate,
            sleep_hours,
            energy_level,
            gut_symptoms,
            training_done,
            notes,
          } = req.body || {};
          if (!checkDate) return err(res, 'date required');

          const id = crypto.randomUUID();
          try {
            await db.execute(
              `INSERT INTO daily_checkins (id, user_id, date, sleep_hours, energy_level, gut_symptoms, training_done, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                auth.userId,
                checkDate,
                sleep_hours || null,
                energy_level || null,
                gut_symptoms || null,
                training_done || 0,
                notes || null,
              ]
            );
            return ok(res, { success: true, id }, 201);
          } catch (e) {
            // Handle duplicate key (upsert): update instead
            if (e.code === 'ER_DUP_ENTRY') {
              await db.execute(
                `UPDATE daily_checkins SET sleep_hours = ?, energy_level = ?, gut_symptoms = ?, training_done = ?, notes = ?, updated_at = NOW()
               WHERE user_id = ? AND date = ?`,
                [
                  sleep_hours || null,
                  energy_level || null,
                  gut_symptoms || null,
                  training_done || 0,
                  notes || null,
                  auth.userId,
                  checkDate,
                ]
              );
              return ok(res, { success: true, updated: true });
            }
            throw e;
          }
        }

        if (req.method === 'PUT' && resourceId) {
          const {
            sleep_hours,
            energy_level,
            gut_symptoms,
            training_done,
            notes,
          } = req.body || {};
          await db.execute(
            `UPDATE daily_checkins SET sleep_hours = ?, energy_level = ?, gut_symptoms = ?, training_done = ?, notes = ?, updated_at = NOW()
           WHERE id = ? AND user_id = ?`,
            [
              sleep_hours || null,
              energy_level || null,
              gut_symptoms || null,
              training_done || 0,
              notes || null,
              resourceId,
              auth.userId,
            ]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { checkin: null, checkins: [] });
        }
        throw e;
      }
    }

    // ── TRAINING LOGS (Phase 2.6) ────────────────────────────
    if (resource === 'training-logs') {
      try {
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
              if (!weekMap[weekKey])
                weekMap[weekKey] = { sessions: 0, total_minutes: 0, types: {} };
              weekMap[weekKey].sessions++;
              weekMap[weekKey].total_minutes += r.duration_minutes || 0;
              weekMap[weekKey].types[r.type] =
                (weekMap[weekKey].types[r.type] || 0) + 1;
            }
            const totalSessions = rows.length;
            const totalMinutes = rows.reduce(
              (s, r) => s + (r.duration_minutes || 0),
              0
            );
            const avgEnergy = rows.filter((r) => r.energy_after != null);
            return ok(res, {
              stats: {
                total_sessions: totalSessions,
                total_minutes: totalMinutes,
                avg_duration: totalSessions
                  ? Math.round(totalMinutes / totalSessions)
                  : 0,
                avg_energy_after: avgEnergy.length
                  ? Math.round(
                      (avgEnergy.reduce((s, r) => s + r.energy_after, 0) /
                        avgEnergy.length) *
                        10
                    ) / 10
                  : null,
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
          const {
            date: logDate,
            duration_minutes,
            type,
            notes,
            energy_after,
          } = req.body || {};
          if (!logDate) return err(res, 'date required');
          if (!duration_minutes || duration_minutes < 1)
            return err(res, 'duration_minutes required (>0)');
          const validTypes = [
            'solo',
            'class',
            'sparring',
            'conditioning',
            'other',
          ];
          const safeType = validTypes.includes(type) ? type : 'solo';

          const id = crypto.randomUUID();
          await db.execute(
            `INSERT INTO training_logs (id, user_id, date, duration_minutes, type, notes, energy_after)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              auth.userId,
              logDate,
              duration_minutes,
              safeType,
              notes || null,
              energy_after != null ? energy_after : null,
            ]
          );
          return ok(res, { success: true, id }, 201);
        }

        if (req.method === 'PUT' && resourceId) {
          const { duration_minutes, type, notes, energy_after } =
            req.body || {};
          const validTypes = [
            'solo',
            'class',
            'sparring',
            'conditioning',
            'other',
          ];
          const safeType = type && validTypes.includes(type) ? type : undefined;
          const sets = [];
          const vals = [];
          if (duration_minutes != null) {
            sets.push('duration_minutes = ?');
            vals.push(duration_minutes);
          }
          if (safeType) {
            sets.push('type = ?');
            vals.push(safeType);
          }
          if (notes !== undefined) {
            sets.push('notes = ?');
            vals.push(notes || null);
          }
          if (energy_after !== undefined) {
            sets.push('energy_after = ?');
            vals.push(energy_after);
          }
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
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            logs: [],
            stats: {
              total_sessions: 0,
              total_minutes: 0,
              avg_duration: 0,
              avg_energy_after: null,
              weeks: {},
            },
          });
        }
        throw e;
      }
    }

    // ── OUTREACH LOG (Phase 2.7) ────────────────────────────
    if (resource === 'outreach-log') {
      try {
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
            return ok(res, {
              logs: rows,
              daily_counts: dailyCounts,
              total: rows.length,
            });
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
          const {
            date: logDate,
            type,
            target,
            project_id,
            notes,
          } = req.body || {};
          if (!logDate) return err(res, 'date required');
          const validTypes = ['message', 'post', 'call', 'email', 'other'];
          const safeType = validTypes.includes(type) ? type : 'message';

          const id = crypto.randomUUID();
          await db.execute(
            `INSERT INTO outreach_log (id, user_id, date, type, target, project_id, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              auth.userId,
              logDate,
              safeType,
              target || null,
              project_id || null,
              notes || null,
            ]
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
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { logs: [], daily_counts: {}, count: 0, total: 0 });
        }
        throw e;
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
        const weekStart =
          week ||
          (() => {
            const d = new Date();
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
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
          ? Math.round(
              (checkinRows.reduce((s, r) => s + (r.energy_level || 0), 0) /
                checkinRows.length) *
                10
            ) / 10
          : null;
        const avgSleep = checkinRows.length
          ? Math.round(
              (checkinRows.reduce((s, r) => s + (r.sleep_hours || 0), 0) /
                checkinRows.length) *
                10
            ) / 10
          : null;

        return ok(res, {
          week_start: weekStart,
          week_end: weekEnd,
          review,
          stats: {
            sessions: sessionRows.length,
            session_minutes: Math.round(
              sessionRows.reduce((s, r) => s + (r.duration_s || 0), 0) / 60
            ),
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
        const {
          week_start,
          what_shipped,
          what_blocked,
          next_priority,
          ai_analysis,
          data_json,
        } = req.body || {};
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
            [
              what_shipped || null,
              what_blocked || null,
              next_priority || null,
              ai_analysis || null,
              data_json || null,
              auth.userId,
              week_start,
            ]
          );
          return ok(res, { success: true, id: existing[0].id });
        } else {
          const [result] = await db.execute(
            `INSERT INTO weekly_reviews (user_id, week_start, what_shipped, what_blocked, next_priority, ai_analysis, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              auth.userId,
              week_start,
              what_shipped || null,
              what_blocked || null,
              next_priority || null,
              ai_analysis || null,
              data_json || null,
            ]
          );
          return ok(res, { success: true, id: result.insertId }, 201);
        }
      }
    }

    // ── AI METADATA SUGGESTIONS (Phase 3.1) ───────────────────
    if (resource === 'ai-metadata-suggestions') {
      if (req.method === 'POST') {
        const { project_id, file_path, content, project_name, project_phase } =
          req.body || {};
        if (!content) return err(res, 'content required');

        // Check ignore rules from agent-config.json
        const ignorePatterns = [
          'node_modules',
          '.git',
          'dist',
          'build',
          '.env',
          'package-lock.json',
          'yarn.lock',
          'pnpm-lock.yaml',
        ];
        const lowerPath = (file_path || '').toLowerCase();
        for (const pattern of ignorePatterns) {
          if (lowerPath.includes(pattern)) {
            return ok(res, {
              ignored: true,
              reason: `File matches ignore pattern: ${pattern}`,
            });
          }
        }

        // Only suggest for text/markdown files
        const suggestableExts = ['.md', '.txt', '.markdown'];
        const hasSuggestableExt = suggestableExts.some((ext) =>
          lowerPath.endsWith(ext)
        );
        if (!hasSuggestableExt && content.length > 5000) {
          return ok(res, {
            ignored: true,
            reason: 'File type not supported for suggestions',
          });
        }

        // Truncate content if too long (first 3000 chars is enough for analysis)
        const truncatedContent = content.slice(0, 3000);

        // Call Anthropic API for suggestions
        const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        if (!ANTHROPIC_API_KEY) {
          return ok(res, {
            error: 'AI provider not configured',
            suggestions: null,
          });
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
          const response = await fetch(
            'https://api.anthropic.com/v1/messages',
            {
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
            }
          );

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
            const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) ||
              text.match(/```\s*([\s\S]*?)```/) || [null, text];
            suggestions = JSON.parse(jsonMatch[1] || text);
          } catch (e) {
            console.error('Failed to parse AI response:', e);
            suggestions = null;
          }

          return ok(res, {
            suggestions,
            usage: data.usage,
            content_sampled:
              truncatedContent.length < content.length
                ? `${truncatedContent.length} of ${content.length} chars`
                : 'full content',
          });
        } catch (e) {
          console.error('AI metadata suggestion error:', e);
          return ok(res, { error: 'Analysis failed', suggestions: null });
        }
      }
    }

    // ── SYNC STATE (Phase 2.4B / 3.4) ─────────────────────────
    if (resource === 'sync_state') {
      if (req.method === 'GET') {
        const { project_id } = req.query;
        if (!project_id) return err(res, 'project_id required');
        const [rows] = await db.execute(
          'SELECT * FROM sync_state WHERE project_id = ? AND user_id = ?',
          [project_id, auth.userId]
        );
        return ok(res, { sync_state: rows[0] || null });
      }

      if (req.method === 'POST') {
        const { project_id, folder_handle_key, sync_status } = req.body || {};
        if (!project_id) return err(res, 'project_id required');

        // Check if exists
        const [existing] = await db.execute(
          'SELECT id FROM sync_state WHERE project_id = ? AND user_id = ?',
          [project_id, auth.userId]
        );

        if (existing.length > 0) {
          // Update
          await db.execute(
            `UPDATE sync_state SET folder_handle_key = ?, sync_status = ?, updated_at = NOW() WHERE id = ?`,
            [folder_handle_key || null, sync_status || 'idle', existing[0].id]
          );
          return ok(res, { success: true, id: existing[0].id });
        } else {
          // Create
          const id = crypto.randomUUID();
          await db.execute(
            `INSERT INTO sync_state (id, project_id, user_id, folder_handle_key, sync_status) VALUES (?, ?, ?, ?, ?)`,
            [
              id,
              project_id,
              auth.userId,
              folder_handle_key || null,
              sync_status || 'idle',
            ]
          );
          return ok(res, { success: true, id }, 201);
        }
      }

      if (req.method === 'PUT') {
        const { project_id, last_sync_at, sync_status } = req.body || {};
        if (!project_id) return err(res, 'project_id required');
        await db.execute(
          `UPDATE sync_state SET last_sync_at = ?, sync_status = ?, updated_at = NOW() WHERE project_id = ? AND user_id = ?`,
          [
            last_sync_at || new Date().toISOString(),
            sync_status || 'idle',
            project_id,
            auth.userId,
          ]
        );
        return ok(res, { success: true });
      }

      if (req.method === 'DELETE') {
        const { project_id } = req.query;
        if (!project_id) return err(res, 'project_id required');
        await db.execute(
          'DELETE FROM sync_state WHERE project_id = ? AND user_id = ?',
          [project_id, auth.userId]
        );
        return ok(res, { success: true });
      }
    }

    // ── SCRIPT EXECUTION (Phase 3.6) ─────────────────────────
    if (resource === 'scripts' && req.method === 'POST') {
      const { script, language, project_id, project_files } = req.body || {};

      if (!script) return err(res, 'script required');
      if (!language) return err(res, 'language required');

      // Whitelist allowed languages
      const allowedLanguages = ['javascript', 'js', 'python', 'py'];
      if (!allowedLanguages.includes(language.toLowerCase())) {
        return err(
          res,
          `Language "${language}" not allowed. Use: ${allowedLanguages.join(', ')}`,
          400
        );
      }

      try {
        let result = '';
        let output = [];

        // Capture console.log output
        const mockConsole = {
          log: (...args) => {
            output.push(
              args
                .map((a) =>
                  typeof a === 'object' ? JSON.stringify(a) : String(a)
                )
                .join(' ')
            );
          },
          error: (...args) => {
            output.push(
              '[ERROR] ' +
                args
                  .map((a) =>
                    typeof a === 'object' ? JSON.stringify(a) : String(a)
                  )
                  .join(' ')
            );
          },
        };

        if (language === 'javascript' || language === 'js') {
          // Create sandboxed environment
          const sandbox = {
            console: mockConsole,
            projectFiles: project_files || {},
            projectId: project_id,
            JSON,
            Math,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            RegExp,
            Error,
            Promise,
            Set,
            Map,
            Buffer: undefined, // Disable Buffer for safety
            process: undefined, // Disable process
            require: undefined, // Disable require
            fetch: undefined, // Disable network
            XMLHttpRequest: undefined,
            WebSocket: undefined,
            setTimeout: undefined,
            setInterval: undefined,
            clearTimeout: undefined,
            clearInterval: undefined,
          };

          // Wrap script in async IIFE for timeout control
          const wrappedScript = `
            (async function() {
              ${script}
            })()
          `;

          // Execute with 30 second timeout
          const executePromise = new Promise(async (resolve, reject) => {
            try {
              // Use Function constructor for safer execution
              const fn = new Function(...Object.keys(sandbox), wrappedScript);
              const result = await fn(...Object.values(sandbox));
              resolve(result);
            } catch (e) {
              reject(e);
            }
          });

          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error('Script execution timeout (30s)')),
              30000
            );
          });

          result = await Promise.race([executePromise, timeoutPromise]);
        } else {
          // Python not implemented in this environment
          return ok(res, {
            error: 'Python execution not available in serverless environment',
            output: [
              'Python scripts require a server with Python installed. Consider using JavaScript.',
            ],
          });
        }

        return ok(res, {
          success: true,
          result: result !== undefined ? result : null,
          output: output.join('\n'),
          executionTime: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Script execution error:', e);
        return ok(res, {
          success: false,
          error: e.message,
          output: output.join('\n'),
          executionTime: new Date().toISOString(),
        });
      }
    }

    // ── DRIFT CHECK (Phase 2.10) ──────────────────────────────
    if (resource === 'drift-check') {
      try {
        if (req.method === 'GET') {
          const today = new Date().toISOString().split('T')[0];
          const fourteenDaysAgo = new Date(
            Date.now() - 14 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0];
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];

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
                data: { currentWeek: week1Count, lastWeek: week2Count },
              });
            }
          }

          // Rule 2: Outreach = 0 for 5+ days
          const uniqueOutreachDays = new Set(outreachRows.map((r) => r.date))
            .size;
          if (uniqueOutreachDays === 0) {
            flags.push({
              type: 'outreach_gap',
              severity: 'high',
              message:
                'No outreach actions for 5+ days — mandatory daily minimum not met',
              data: { daysSince: 5 },
            });
          }

          // Rule 3: Average energy declining over 7 days
          const recentCheckins = checkinRows.filter(
            (r) => r.energy_level != null && r.date >= sevenDaysAgo
          );
          if (recentCheckins.length >= 3) {
            const avgEnergy =
              recentCheckins.reduce((s, r) => s + r.energy_level, 0) /
              recentCheckins.length;
            // Check if declining trend (compare first half vs second half)
            const mid = Math.floor(recentCheckins.length / 2);
            const firstHalf = recentCheckins.slice(0, mid);
            const secondHalf = recentCheckins.slice(mid);
            const firstAvg =
              firstHalf.reduce((s, r) => s + r.energy_level, 0) /
              firstHalf.length;
            const secondAvg =
              secondHalf.reduce((s, r) => s + r.energy_level, 0) /
              secondHalf.length;
            if (secondAvg < firstAvg - 1) {
              flags.push({
                type: 'energy_decline',
                severity: 'medium',
                message: `Energy declining: ${firstAvg.toFixed(1)} → ${secondAvg.toFixed(1)} over last 7 days`,
                data: {
                  firstHalfAvg: firstAvg,
                  secondHalfAvg: secondAvg,
                  currentAvg: avgEnergy,
                },
              });
            }
          }

          // Rule 4: No sessions logged for 3+ days
          const recentSessions = sessionRows.filter(
            (r) => r.ended_at && r.ended_at >= threeDaysAgo + ' 00:00:00'
          );
          if (recentSessions.length === 0) {
            const lastSession = sessionRows[0];
            const daysSince = lastSession
              ? Math.floor(
                  (Date.now() - new Date(lastSession.ended_at).getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              : 14;
            flags.push({
              type: 'session_gap',
              severity: 'medium',
              message: `No work sessions for ${daysSince} days`,
              data: { daysSince },
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
            const project = projectRows.find((p) => p.id === primaryProjectId);
            if (project && project.health < 60) {
              flags.push({
                type: 'stagnant_project',
                severity: 'medium',
                message: `${project.name} stuck at health ${project.health} — ${primaryProjectCount} sessions logged but no improvement`,
                data: {
                  projectId: primaryProjectId,
                  projectName: project.name,
                  health: project.health,
                  sessionCount: primaryProjectCount,
                },
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
              projects: projectRows.length,
            },
          });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            flags: [],
            checked_at: new Date().toISOString(),
            summary: {
              checkins: 0,
              trainingSessions: 0,
              outreachDays: 0,
              sessions: 0,
              projects: 0,
            },
          });
        }
        throw e;
      }
    }

    // ── NOTIFICATIONS (Phase 4.4) ─────────────────────────────
    if (resource === 'notifications') {
      try {
        // GET: list notifications with unread count
        if (req.method === 'GET') {
          const { unread_only, limit } = req.query;
          let query = 'SELECT * FROM notifications WHERE user_id = ?';
          const params = [auth.userId];

          if (unread_only === 'true') {
            query += ' AND read = FALSE';
          }

          query += ' ORDER BY created_at DESC';

          if (limit) {
            query += ' LIMIT ?';
            params.push(parseInt(limit));
          }

          const [rows] = await db.execute(query, params);
          const [countRows] = await db.execute(
            'SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND read = FALSE',
            [auth.userId]
          );

          return ok(res, {
            notifications: rows,
            unread_count: countRows[0]?.unread || 0,
          });
        }

        // POST: create notification (manual or from triggers)
        if (req.method === 'POST') {
          const { type, message, action_url, expires_at } = req.body || {};
          if (!type || !message) return err(res, 'type and message required');

          const id = crypto.randomUUID();
          await db.execute(
            'INSERT INTO notifications (id, user_id, type, message, action_url, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              id,
              auth.userId,
              type,
              message,
              action_url || null,
              expires_at || null,
            ]
          );
          return ok(res, { success: true, id }, 201);
        }

        // PUT: mark as read or mark all read
        if (req.method === 'PUT') {
          const { action } = req.query;

          if (action === 'mark-all-read') {
            await db.execute(
              'UPDATE notifications SET read = TRUE WHERE user_id = ? AND read = FALSE',
              [auth.userId]
            );
            return ok(res, { success: true });
          }

          if (resourceId) {
            await db.execute(
              'UPDATE notifications SET read = TRUE WHERE id = ? AND user_id = ?',
              [resourceId, auth.userId]
            );
            return ok(res, { success: true });
          }

          return err(res, 'id or action required');
        }

        // DELETE: remove notification
        if (req.method === 'DELETE' && resourceId) {
          await db.execute(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { notifications: [], unread_count: 0 });
        }
        throw e;
      }
    }

    // ── NOTIFICATION TRIGGERS (Phase 4.4) ─────────────────────
    if (resource === 'notification-check') {
      try {
        if (req.method === 'GET') {
          const today = new Date().toISOString().split('T')[0];
          const now = new Date().toISOString();
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
          const sevenDaysAgoISO = new Date(
            Date.now() - 7 * 24 * 60 * 60 * 1000
          ).toISOString();

          const notificationsCreated = [];

          // Check 1: Daily check-in not done
          const [checkinRows] = await db.execute(
            'SELECT id FROM daily_checkins WHERE user_id = ? AND date = ?',
            [auth.userId, today]
          );
          if (checkinRows.length === 0) {
            // Check if we already created this notification today
            const [existing] = await db.execute(
              `SELECT id FROM notifications WHERE user_id = ? AND type = 'daily_checkin' 
             AND created_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)`,
              [auth.userId]
            );
            if (existing.length === 0) {
              const id = crypto.randomUUID();
              await db.execute(
                'INSERT INTO notifications (id, user_id, type, message, action_url) VALUES (?, ?, ?, ?, ?)',
                [
                  id,
                  auth.userId,
                  'daily_checkin',
                  '🌅 Daily check-in not completed — track your energy and health',
                  '/?action=checkin',
                ]
              );
              notificationsCreated.push({ type: 'daily_checkin', id });
            }
          }

          // Check 2: Training minimum not met by end of week (Friday check)
          const dayOfWeek = new Date().getDay(); // 0 = Sunday, 5 = Friday
          if (dayOfWeek === 5) {
            const [trainingRows] = await db.execute(
              `SELECT COUNT(*) as count FROM training_logs 
             WHERE user_id = ? AND date >= ?`,
              [auth.userId, sevenDaysAgo]
            );
            if (trainingRows[0].count < 3) {
              const [existing] = await db.execute(
                `SELECT id FROM notifications WHERE user_id = ? AND type = 'training_weekly' 
               AND created_at >= ?`,
                [auth.userId, sevenDaysAgoISO]
              );
              if (existing.length === 0) {
                const id = crypto.randomUUID();
                await db.execute(
                  'INSERT INTO notifications (id, user_id, type, message, action_url) VALUES (?, ?, ?, ?, ?)',
                  [
                    id,
                    auth.userId,
                    'training_weekly',
                    `🥋 Training goal not met — ${trainingRows[0].count}/3 sessions this week`,
                    '/?action=training',
                  ]
                );
                notificationsCreated.push({ type: 'training_weekly', id });
              }
            }
          }

          // Check 3: Project health dropped below 50
          const [lowHealthProjects] = await db.execute(
            'SELECT id, name, health FROM projects WHERE user_id = ? AND health < 50',
            [auth.userId]
          );
          for (const proj of lowHealthProjects) {
            const [existing] = await db.execute(
              `SELECT id FROM notifications WHERE user_id = ? AND type = 'project_health' 
             AND action_url LIKE ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
              [auth.userId, `%${proj.id}%`]
            );
            if (existing.length === 0) {
              const id = crypto.randomUUID();
              await db.execute(
                'INSERT INTO notifications (id, user_id, type, message, action_url) VALUES (?, ?, ?, ?, ?)',
                [
                  id,
                  auth.userId,
                  'project_health',
                  `⚠️ ${proj.name} health dropped to ${proj.health} — needs attention`,
                  `/?hub=${proj.id}`,
                ]
              );
              notificationsCreated.push({
                type: 'project_health',
                id,
                project: proj.name,
              });
            }
          }

          // Check 4: Staging items pending review > 7 days
          const [oldStaging] = await db.execute(
            `SELECT s.id, s.name, s.project_id, p.name as project_name 
           FROM staging s JOIN projects p ON s.project_id = p.id
           WHERE s.user_id = ? AND s.status = 'in-review' 
           AND s.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            [auth.userId]
          );
          for (const item of oldStaging) {
            const [existing] = await db.execute(
              `SELECT id FROM notifications WHERE user_id = ? AND type = 'staging_pending' 
             AND action_url LIKE ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
              [auth.userId, `%${item.id}%`]
            );
            if (existing.length === 0) {
              const id = crypto.randomUUID();
              await db.execute(
                'INSERT INTO notifications (id, user_id, type, message, action_url) VALUES (?, ?, ?, ?, ?)',
                [
                  id,
                  auth.userId,
                  'staging_pending',
                  `📋 "${item.name}" in ${item.project_name} pending review for 7+ days`,
                  `/?hub=${item.project_id}&tab=review`,
                ]
              );
              notificationsCreated.push({
                type: 'staging_pending',
                id,
                item: item.name,
              });
            }
          }

          // Check 5: Drift detection alerts (use existing drift-check logic)
          // This will be populated by the client calling drift-check separately

          // ── NOTIFICATION BATCHING & FATIGUE PREVENTION ───────────
          // Count recent notifications to prevent overwhelm
          const [recentCount] = await db.execute(
            `SELECT COUNT(*) as count FROM notifications 
           WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
            [auth.userId]
          );

          // Quiet hours: 10 PM - 7 AM (user's local time would be better, but UTC for now)
          const currentHour = new Date().getUTCHours();
          const isQuietHours = currentHour >= 22 || currentHour < 7;

          // Priority filtering: if many notifications already, only high-priority ones
          const recentNotifications = recentCount[0]?.count || 0;
          const shouldBatch = recentNotifications >= 5;

          // If in quiet hours, only critical notifications
          const filteredNotifications = notificationsCreated.filter((n) => {
            if (isQuietHours) {
              // Only project health and staging pending are critical
              return ['project_health', 'staging_pending'].includes(n.type);
            }
            if (shouldBatch) {
              // In batch mode, skip daily check-in reminders (keep others)
              return n.type !== 'daily_checkin';
            }
            return true;
          });

          // Delete non-critical notifications created during batch mode
          if (isQuietHours || shouldBatch) {
            const toRemove = notificationsCreated.filter(
              (n) => !filteredNotifications.find((f) => f.id === n.id)
            );
            for (const n of toRemove) {
              await db.execute('DELETE FROM notifications WHERE id = ?', [
                n.id,
              ]);
            }
          }

          return ok(res, {
            checked_at: now,
            notifications_created: filteredNotifications,
            checks: {
              daily_checkin: checkinRows.length === 0,
              training_weekly: dayOfWeek === 5,
              low_health_projects: lowHealthProjects.length,
              old_staging: oldStaging.length,
            },
            meta: {
              recent_notifications_24h: recentNotifications,
              is_quiet_hours: isQuietHours,
              batched: shouldBatch,
              suppressed_count:
                notificationsCreated.length - filteredNotifications.length,
            },
          });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            checked_at: new Date().toISOString(),
            notifications_created: [],
            checks: {},
            meta: {},
          });
        }
        throw e;
      }
    }

    // ── SMART MODE SUGGESTIONS (Phase 6.2) ─────────────────────
    if (resource === 'mode-suggestions') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      try {
        const suggestions = [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        // Get user settings
        const [userRows] = await db.execute(
          'SELECT settings FROM users WHERE id = ?',
          [auth.userId]
        );
        const userSettings = (() => {
          try {
            return JSON.parse(userRows[0]?.settings || '{}');
          } catch {
            return {};
          }
        })();
        const currentMode = userSettings.assistance_mode || 'coach';

        // Don't suggest if already in that mode (avoid noise)
        const modeSuggestionsDismissed =
          userSettings.dismissed_mode_suggestions || [];

        // Check 1: 30-day check-in streak → suggest Assistant
        if (currentMode !== 'assistant') {
          const [checkinStreak] = await db.execute(
            `SELECT COUNT(DISTINCT date) as streak FROM daily_checkins 
             WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
            [auth.userId, thirtyDaysAgo]
          );
          if (
            checkinStreak[0]?.streak >= 25 &&
            !modeSuggestionsDismissed.includes('streak_assistant')
          ) {
            suggestions.push({
              type: 'streak_assistant',
              suggested_mode: 'assistant',
              reason:
                'You have a 25+ day check-in streak. Consider switching to Assistant mode for less intrusive support.',
              trigger: '25+ days of check-ins',
              confidence: 'high',
            });
          }
        }

        // Check 2: 3+ missed check-ins → suggest back to Coach
        if (currentMode === 'assistant' || currentMode === 'silent') {
          const [missedCheckins] = await db.execute(
            `SELECT COUNT(*) as missed FROM (
               SELECT DATE_ADD(?, INTERVAL n DAY) as missing_date
               FROM (SELECT 0 as n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION 
                     SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION 
                     SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13) numbers
               WHERE DATE_ADD(?, INTERVAL n DAY) <= CURRENT_DATE()
             ) dates
             WHERE missing_date NOT IN (SELECT date FROM daily_checkins WHERE user_id = ?)
             AND missing_date >= ?`,
            [thirtyDaysAgo, thirtyDaysAgo, auth.userId, thirtyDaysAgo]
          );
          if (
            missedCheckins[0]?.missed >= 3 &&
            !modeSuggestionsDismissed.includes('missed_coach')
          ) {
            suggestions.push({
              type: 'missed_coach',
              suggested_mode: 'coach',
              reason:
                'You have missed 3+ check-ins recently. Consider switching back to Coach mode for accountability.',
              trigger: '3+ missed check-ins in 30 days',
              confidence: 'high',
            });
          }
        }

        // Check 3: High agent delegation rate → suggest Silent
        if (currentMode !== 'silent') {
          const [taskStats] = await db.execute(
            `SELECT 
               COUNT(*) as total,
               SUM(CASE WHEN assignee_type = 'agent' THEN 1 ELSE 0 END) as agent_tasks
             FROM tasks 
             WHERE user_id = ? AND created_at >= ?`,
            [auth.userId, fourteenDaysAgo]
          );
          const total = taskStats[0]?.total || 0;
          const agentTasks = taskStats[0]?.agent_tasks || 0;
          if (
            total >= 5 &&
            agentTasks / total >= 0.5 &&
            !modeSuggestionsDismissed.includes('delegation_silent')
          ) {
            suggestions.push({
              type: 'delegation_silent',
              suggested_mode: 'silent',
              reason:
                'You delegate 50%+ of tasks to agents. Consider Silent mode for a hands-off experience.',
              trigger: `${Math.round((agentTasks / total) * 100)}% agent delegation`,
              confidence: 'medium',
            });
          }
        }

        // Check 4: Low engagement → suggest Coach
        if (currentMode === 'silent') {
          const [sessionCount] = await db.execute(
            `SELECT COUNT(*) as sessions FROM sessions WHERE user_id = ? AND ended_at >= ?`,
            [auth.userId, fourteenDaysAgo]
          );
          if (
            sessionCount[0]?.sessions < 3 &&
            !modeSuggestionsDismissed.includes('low_engagement_coach')
          ) {
            suggestions.push({
              type: 'low_engagement_coach',
              suggested_mode: 'coach',
              reason:
                'Low activity detected. Switch to Coach mode for proactive support and accountability.',
              trigger: 'Less than 3 sessions in 2 weeks',
              confidence: 'low',
            });
          }
        }

        return ok(res, {
          current_mode: currentMode,
          suggestions: suggestions.filter(
            (s) => !modeSuggestionsDismissed.includes(s.type)
          ),
          analyzed: {
            checkin_streak_days: thirtyDaysAgo,
            task_period_days: 14,
          },
        });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            current_mode: 'coach',
            suggestions: [],
            analyzed: {},
          });
        }
        throw e;
      }
    }

    // ── DISMISS MODE SUGGESTION ─────────────────────────────────
    if (resource === 'dismiss-mode-suggestion') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { suggestion_type } = req.body || {};
      if (!suggestion_type) return err(res, 'suggestion_type required');

      try {
        const [userRows] = await db.execute(
          'SELECT settings FROM users WHERE id = ?',
          [auth.userId]
        );
        const userSettings = (() => {
          try {
            return JSON.parse(userRows[0]?.settings || '{}');
          } catch {
            return {};
          }
        })();

        const dismissed = userSettings.dismissed_mode_suggestions || [];
        if (!dismissed.includes(suggestion_type)) {
          dismissed.push(suggestion_type);
        }

        await db.execute('UPDATE users SET settings = ? WHERE id = ?', [
          JSON.stringify({
            ...userSettings,
            dismissed_mode_suggestions: dismissed,
          }),
          auth.userId,
        ]);

        return ok(res, { dismissed: suggestion_type });
      } catch (e) {
        throw e;
      }
    }

    // ── EXPORT ALL — Full user data backup ────────────────────
    if (resource === 'export-all') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      try {
        const exportData = {
          version: '1.0.0',
          exported_at: new Date().toISOString(),
          user_id: auth.userId,
          data: {},
        };

        // Tables to export (same order as backup script)
        const tables = [
          {
            name: 'users',
            filter: 'id = ?',
            params: [auth.userId],
            exclude: ['password_hash'],
          },
          { name: 'life_areas', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'projects', filter: 'user_id = ?', params: [auth.userId] },
          {
            name: 'project_custom_folders',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'project_files',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'file_metadata',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          { name: 'staging', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'ideas', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'sessions', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'comments', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'goals', filter: 'user_id = ?', params: [auth.userId] },
          {
            name: 'goal_contributions',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          { name: 'tags', filter: 'user_id = ?', params: [auth.userId] },
          { name: 'entity_tags', filter: 'user_id = ?', params: [auth.userId] },
          {
            name: 'entity_links',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'templates',
            filter: 'user_id = ? OR user_id IS NULL',
            params: [auth.userId],
            hasNull: true,
          },
          {
            name: 'daily_checkins',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'training_logs',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'outreach_log',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          {
            name: 'weekly_reviews',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
          { name: 'sync_state', filter: 'user_id = ?', params: [auth.userId] },
          {
            name: 'sync_file_state',
            filter: 'project_id IN (SELECT id FROM projects WHERE user_id = ?)',
            params: [auth.userId],
            subquery: true,
          },
          {
            name: 'project_integrations',
            filter: 'project_id IN (SELECT id FROM projects WHERE user_id = ?)',
            params: [auth.userId],
            subquery: true,
            redact: ['access_token'],
          },
          {
            name: 'notifications',
            filter: 'user_id = ?',
            params: [auth.userId],
          },
        ];

        for (const table of tables) {
          try {
            let query;
            if (table.hasNull) {
              query = `SELECT * FROM \`${table.name}\` WHERE user_id = ? OR user_id IS NULL`;
            } else if (table.subquery) {
              query = `SELECT * FROM \`${table.name}\` WHERE ${table.filter}`;
            } else {
              query = `SELECT * FROM \`${table.name}\` WHERE ${table.filter}`;
            }

            const [rows] = await db.execute(query, table.params);

            // Apply exclusions and redactions
            if (table.exclude || table.redact) {
              exportData.data[table.name] = rows.map((row) => {
                const cleanRow = { ...row };
                if (table.exclude) {
                  table.exclude.forEach((col) => delete cleanRow[col]);
                }
                if (table.redact) {
                  table.redact.forEach((col) => {
                    if (cleanRow[col]) cleanRow[col] = '[REDACTED]';
                  });
                }
                return cleanRow;
              });
            } else {
              exportData.data[table.name] = rows;
            }
          } catch (tableError) {
            // Table might not exist, skip silently
            exportData.data[table.name] = [];
          }
        }

        // Set download headers
        const filename = `brain-export-${auth.userId}-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`
        );
        return res.status(200).json(exportData);
      } catch (e) {
        console.error('Export error:', e);
        return err(res, 'Export failed', 500);
      }
    }

    // ── IMPORT ALL — Restore from backup JSON ─────────────────
    if (resource === 'import-all') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      try {
        const backup = req.body;

        // Validate backup structure
        if (!backup || typeof backup !== 'object') {
          return err(res, 'Invalid backup data: expected JSON object');
        }

        if (!backup.data || typeof backup.data !== 'object') {
          return err(res, 'Invalid backup: missing data object');
        }

        // Import order (respects FK constraints)
        const importOrder = [
          'life_areas',
          'projects',
          'project_custom_folders',
          'project_files',
          'file_metadata',
          'staging',
          'ideas',
          'sessions',
          'comments',
          'goals',
          'goal_contributions',
          'tags',
          'entity_tags',
          'entity_links',
          'templates',
          'daily_checkins',
          'training_logs',
          'outreach_log',
          'weekly_reviews',
          'sync_state',
          'sync_file_state',
          'project_integrations',
          'notifications',
        ];

        const results = {
          imported: {},
          errors: [],
          total_inserted: 0,
          total_updated: 0,
        };

        for (const tableName of importOrder) {
          const rows = backup.data[tableName];
          if (!Array.isArray(rows) || rows.length === 0) continue;

          let inserted = 0;
          let updated = 0;
          let errors = 0;

          for (const row of rows) {
            try {
              // Skip if no id (can't upsert)
              if (!row.id) continue;

              // Get column names from the row
              const columns = Object.keys(row).filter(
                (k) => k !== 'created_at' && k !== 'updated_at'
              );
              const values = columns.map((col) => row[col]);

              // Build upsert query
              const colNames = columns.map((c) => `\`${c}\``);
              const placeholders = columns.map(() => '?');
              const updates = columns
                .filter((c) => c !== 'id')
                .map((c) => `\`${c}\` = VALUES(\`${c}\`)`);

              let query;
              if (updates.length > 0) {
                query = `INSERT INTO \`${tableName}\` (${colNames.join(', ')}) 
                         VALUES (${placeholders.join(', ')}) 
                         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`;
              } else {
                query = `INSERT IGNORE INTO \`${tableName}\` (${colNames.join(', ')}) 
                         VALUES (${placeholders.join(', ')})`;
              }

              const [result] = await db.execute(query, values);

              if (result.affectedRows === 1 && result.insertId) {
                inserted++;
              } else {
                updated++;
              }
            } catch (rowError) {
              errors++;
              if (results.errors.length < 5) {
                results.errors.push(
                  `${tableName}.${row.id}: ${rowError.message}`
                );
              }
            }
          }

          if (inserted > 0 || updated > 0 || errors > 0) {
            results.imported[tableName] = { inserted, updated, errors };
            results.total_inserted += inserted;
            results.total_updated += updated;
          }
        }

        return ok(res, {
          success: true,
          imported: results.imported,
          summary: {
            total_inserted: results.total_inserted,
            total_updated: results.total_updated,
          },
          errors: results.errors.length > 0 ? results.errors : undefined,
        });
      } catch (e) {
        console.error('Import error:', e);
        return err(res, 'Import failed: ' + e.message, 500);
      }
    }

    // ── USER AI SETTINGS ──────────────────────────────────────
    if (resource === 'user-ai-settings') {
      // GET: Retrieve settings
      if (req.method === 'GET') {
        const [rows] = await db.execute(
          'SELECT provider, model, max_tokens, temperature, enabled FROM user_ai_settings WHERE user_id = ?',
          [auth.userId]
        );

        // Provider info with pricing
        const providers = [
          {
            key: 'anthropic',
            name: 'Anthropic (Claude)',
            pricing: { input: 3.0, output: 15.0 },
            freeTier: false,
            models: ['claude-sonnet-4-6', 'claude-opus-4', 'claude-haiku-3-5'],
          },
          {
            key: 'moonshot',
            name: 'Moonshot AI (Kimi)',
            pricing: { input: 1.0, output: 2.0 },
            freeTier: true,
            models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
          },
          {
            key: 'deepseek',
            name: 'DeepSeek',
            pricing: { input: 0.14, output: 0.28 },
            freeTier: true,
            models: ['deepseek-chat', 'deepseek-coder'],
          },
          {
            key: 'mistral',
            name: 'Mistral AI',
            pricing: { input: 0.5, output: 1.5 },
            freeTier: true,
            models: ['mistral-tiny', 'mistral-small', 'mistral-medium'],
          },
          {
            key: 'openai',
            name: 'OpenAI (GPT)',
            pricing: { input: 2.5, output: 10.0 },
            freeTier: false,
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
          },
        ];

        if (rows.length > 0) {
          return ok(res, { settings: rows[0], providers });
        }
        return ok(res, {
          settings: {
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            temperature: 0.7,
          },
          providers,
        });
      }

      // PUT: Update settings
      if (req.method === 'PUT') {
        const { provider, api_key, model, max_tokens, temperature } =
          req.body || {};

        const validProviders = [
          'anthropic',
          'moonshot',
          'deepseek',
          'mistral',
          'openai',
        ];
        if (!provider || !validProviders.includes(provider)) {
          return err(res, 'Invalid provider', 400);
        }

        // Encrypt API key (base64 for basic obfuscation)
        const encryptedKey = api_key
          ? `enc:${Buffer.from(api_key).toString('base64')}`
          : undefined;

        await db.execute(
          `INSERT INTO user_ai_settings (id, user_id, provider, api_key_encrypted, model, max_tokens, temperature, enabled)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE
           provider = VALUES(provider),
           api_key_encrypted = COALESCE(VALUES(api_key_encrypted), api_key_encrypted),
           model = VALUES(model),
           max_tokens = VALUES(max_tokens),
           temperature = VALUES(temperature),
           updated_at = NOW()`,
          [auth.userId, provider, encryptedKey, model, max_tokens, temperature]
        );

        return ok(res, { success: true, message: 'AI settings updated' });
      }

      // DELETE: Clear user API key
      if (req.method === 'DELETE') {
        await db.execute(
          'UPDATE user_ai_settings SET api_key_encrypted = NULL WHERE user_id = ?',
          [auth.userId]
        );
        return ok(res, { success: true, message: 'API key removed' });
      }
    }

    // ── TASKS (Phase 5.4) ──────────────────────────────────────
    if (resource === 'tasks') {
      try {
        // GET /api/data?resource=tasks — List tasks
        if (req.method === 'GET') {
          const {
            status,
            assignee_type,
            project_id: pid,
            my_tasks,
          } = req.query;

          let sql = 'SELECT * FROM tasks WHERE user_id = ?';
          const params = [auth.userId];

          if (my_tasks === 'true') {
            sql += ' AND assignee_type = ? AND assignee_id = ?';
            params.push('human', 'user');
          } else if (assignee_type) {
            sql += ' AND assignee_type = ?';
            params.push(assignee_type);
          }

          if (status) {
            sql += ' AND status = ?';
            params.push(status);
          }

          if (pid) {
            sql += ' AND project_id = ?';
            params.push(pid);
          }

          sql +=
            ' ORDER BY FIELD(priority, "critical", "high", "medium", "low"), created_at DESC';

          const [rows] = await db.execute(sql, params);
          return ok(res, { tasks: rows });
        }

        // POST /api/data?resource=tasks — Create task
        if (req.method === 'POST') {
          const {
            id,
            project_id: pid,
            title,
            description,
            context_uri,
            assignee_type,
            assignee_id,
            assignee_context,
            priority,
            due_date,
            parent_task_id,
            assigned_by,
            assignment_reason,
          } = req.body || {};

          if (!title) return err(res, 'title required');

          const newId = id || crypto.randomUUID();
          const now = new Date().toISOString();

          await db.execute(
            `INSERT INTO tasks (
            id, project_id, user_id, title, description, context_uri,
            assignee_type, assignee_id, assignee_context,
            status, priority, due_date, parent_task_id, assigned_by, assignment_reason,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newId,
              pid || null,
              auth.userId,
              title,
              description || '',
              context_uri || null,
              assignee_type || 'human',
              assignee_id || 'user',
              assignee_context ? JSON.stringify(assignee_context) : null,
              'pending',
              priority || 'medium',
              due_date || null,
              parent_task_id || null,
              assigned_by || 'user',
              assignment_reason || '',
              now,
            ]
          );

          return ok(res, { success: true, id: newId }, 201);
        }

        // PUT /api/data?resource=tasks&id={id} — Update task
        if (req.method === 'PUT' && resourceId) {
          const { action } = req.query;
          const { status, result_summary, output_uris } = req.body || {};

          // Verify task exists and belongs to user
          const [existing] = await db.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          if (!existing.length) return err(res, 'Task not found', 404);

          const task = existing[0];
          const now = new Date().toISOString();

          // Action: start task
          if (action === 'start') {
            await db.execute(
              'UPDATE tasks SET status = ?, started_at = ? WHERE id = ?',
              ['in_progress', now, resourceId]
            );
            return ok(res, { success: true, status: 'in_progress' });
          }

          // Action: complete task
          if (action === 'complete') {
            await db.execute(
              'UPDATE tasks SET status = ?, completed_at = ?, result_summary = ?, output_uris = ? WHERE id = ?',
              [
                'complete',
                now,
                result_summary || '',
                output_uris ? JSON.stringify(output_uris) : null,
                resourceId,
              ]
            );
            return ok(res, { success: true, status: 'complete' });
          }

          // Action: block task
          if (action === 'block') {
            const { reason } = req.body || {};
            await db.execute(
              'UPDATE tasks SET status = ?, assignee_context = JSON_SET(COALESCE(assignee_context, "{}"), "$.block_reason", ?) WHERE id = ?',
              ['blocked', reason || 'No reason given', resourceId]
            );
            return ok(res, { success: true, status: 'blocked' });
          }

          // Action: assign to agent (or reassign)
          if (action === 'assign') {
            const {
              assignee_type: newType,
              assignee_id: newId,
              reason,
            } = req.body || {};
            if (!newType || !newId)
              return err(res, 'assignee_type and assignee_id required');

            await db.execute(
              'UPDATE tasks SET assignee_type = ?, assignee_id = ?, assigned_by = ?, assignment_reason = ? WHERE id = ?',
              [
                newType,
                newId,
                'user',
                reason || `Assigned to ${newId}`,
                resourceId,
              ]
            );
            return ok(res, {
              success: true,
              assignee_type: newType,
              assignee_id: newId,
            });
          }

          // Generic update
          const updates = [];
          const values = [];

          if (status) {
            updates.push('status = ?');
            values.push(status);
          }
          if (result_summary) {
            updates.push('result_summary = ?');
            values.push(result_summary);
          }
          if (output_uris) {
            updates.push('output_uris = ?');
            values.push(JSON.stringify(output_uris));
          }

          if (updates.length === 0) return err(res, 'No fields to update');

          values.push(resourceId);
          await db.execute(
            `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`,
            values
          );
          return ok(res, { success: true });
        }

        // DELETE /api/data?resource=tasks&id={id} — Delete task
        if (req.method === 'DELETE' && resourceId) {
          const [existing] = await db.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          if (!existing.length) return err(res, 'Task not found', 404);

          await db.execute('DELETE FROM tasks WHERE id = ?', [resourceId]);
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { tasks: [] });
        }
        throw e;
      }
    }

    // ── FILE SUMMARIES (Phase 5.2) ────────────────────────────
    if (resource === 'file-summaries') {
      try {
        // GET: Retrieve summaries for a project
        if (req.method === 'GET') {
          const { project_id: pid, file_path: fp } = req.query;
          if (!pid) return err(res, 'project_id required');

          // Single file summary
          if (fp) {
            const [rows] = await db.execute(
              'SELECT * FROM file_summaries WHERE project_id = ? AND file_path = ?',
              [pid, fp]
            );
            return ok(res, { summary: rows[0] || null });
          }

          // All summaries for project
          const [rows] = await db.execute(
            'SELECT file_path, l0_abstract, l1_overview, content_hash, generated_at, token_count FROM file_summaries WHERE project_id = ? ORDER BY updated_at DESC',
            [pid]
          );
          return ok(res, { summaries: rows });
        }

        // POST: Store/update a summary
        if (req.method === 'POST') {
          const {
            project_id: pid,
            file_path: fp,
            l0_abstract,
            l1_overview,
            content_hash,
            token_count,
          } = req.body || {};
          if (!pid || !fp || !content_hash)
            return err(res, 'project_id, file_path, content_hash required');

          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          // Upsert: try insert, update on duplicate
          try {
            await db.execute(
              `INSERT INTO file_summaries 
               (id, project_id, file_path, l0_abstract, l1_overview, content_hash, token_count, generated_at, generated_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                id,
                pid,
                fp,
                l0_abstract || null,
                l1_overview || null,
                content_hash,
                token_count || null,
                now,
                'ai',
              ]
            );
            return ok(res, { success: true, id, created: true }, 201);
          } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
              // Update existing
              await db.execute(
                `UPDATE file_summaries 
                 SET l0_abstract = ?, l1_overview = ?, content_hash = ?, token_count = ?, generated_at = ?, generated_by = ?
                 WHERE project_id = ? AND file_path = ?`,
                [
                  l0_abstract || null,
                  l1_overview || null,
                  content_hash,
                  token_count || null,
                  now,
                  'ai',
                  pid,
                  fp,
                ]
              );
              return ok(res, { success: true, updated: true });
            }
            throw e;
          }
        }

        // DELETE: Remove a summary
        if (req.method === 'DELETE') {
          const { project_id: pid, file_path: fp } = req.query;
          if (!pid || !fp) return err(res, 'project_id and file_path required');

          await db.execute(
            'DELETE FROM file_summaries WHERE project_id = ? AND file_path = ?',
            [pid, fp]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { summary: null, summaries: [] });
        }
        throw e;
      }
    }

    // ── WORKFLOWS (Phase 5.5) ───────────────────────────────────
    if (resource === 'workflows') {
      try {
        // GET: List workflow templates
        if (req.method === 'GET') {
          const { template_id, instances, project_id } = req.query;

          // Get specific template
          if (template_id) {
            const [rows] = await db.execute(
              'SELECT * FROM workflow_templates WHERE id = ? AND (is_system = TRUE OR user_id = ?)',
              [template_id, auth.userId]
            );
            return ok(res, { template: rows[0] || null });
          }

          // List all templates
          const [rows] = await db.execute(
            'SELECT * FROM workflow_templates WHERE is_system = TRUE OR user_id = ? ORDER BY is_system DESC, name',
            [auth.userId]
          );
          return ok(res, { templates: rows });
        }

        // POST: Create/update template
        if (req.method === 'POST') {
          const { id, name, description, icon, steps, triggers } =
            req.body || {};
          if (!id || !name || !steps)
            return err(res, 'id, name, steps required');

          try {
            await db.execute(
              `INSERT INTO workflow_templates (id, user_id, name, description, icon, steps, triggers, is_system)
               VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)`,
              [
                id,
                auth.userId,
                name,
                description || '',
                icon || '📋',
                JSON.stringify(steps),
                triggers ? JSON.stringify(triggers) : null,
              ]
            );
            return ok(res, { success: true, id }, 201);
          } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') {
              // Update existing
              await db.execute(
                `UPDATE workflow_templates 
                 SET name = ?, description = ?, icon = ?, steps = ?, triggers = ?
                 WHERE id = ? AND user_id = ?`,
                [
                  name,
                  description || '',
                  icon || '📋',
                  JSON.stringify(steps),
                  triggers ? JSON.stringify(triggers) : null,
                  id,
                  auth.userId,
                ]
              );
              return ok(res, { success: true, updated: true });
            }
            throw e;
          }
        }

        // DELETE: Remove custom template
        if (req.method === 'DELETE' && req.query.template_id) {
          await db.execute(
            'DELETE FROM workflow_templates WHERE id = ? AND user_id = ? AND is_system = FALSE',
            [req.query.template_id, auth.userId]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { templates: [] });
        }
        throw e;
      }
    }

    // ── WORKFLOW INSTANCES (Phase 5.5) ──────────────────────────
    if (resource === 'workflow-instances') {
      try {
        // GET: List instances or get specific
        if (req.method === 'GET') {
          const { instance_id, project_id, status } = req.query;

          if (instance_id) {
            const [rows] = await db.execute(
              `SELECT wi.*, wt.name as template_name, wt.icon as template_icon, wt.steps as template_steps
               FROM workflow_instances wi
               JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
               WHERE wi.id = ? AND wi.user_id = ?`,
              [instance_id, auth.userId]
            );
            return ok(res, { instance: rows[0] || null });
          }

          let sql = `SELECT wi.*, wt.name as template_name, wt.icon as template_icon
                     FROM workflow_instances wi
                     JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
                     WHERE wi.user_id = ?`;
          const params = [auth.userId];

          if (project_id) {
            sql += ' AND wi.project_id = ?';
            params.push(project_id);
          }
          if (status) {
            sql += ' AND wi.status = ?';
            params.push(status);
          }

          sql += ' ORDER BY wi.started_at DESC';

          const [rows] = await db.execute(sql, params);
          return ok(res, { instances: rows });
        }

        // POST: Create/start workflow instance
        if (req.method === 'POST') {
          const { template_id, project_id } = req.body || {};
          if (!template_id) return err(res, 'template_id required');

          // Get template
          const [templates] = await db.execute(
            'SELECT * FROM workflow_templates WHERE id = ? AND (is_system = TRUE OR user_id = ?)',
            [template_id, auth.userId]
          );
          if (!templates.length) return err(res, 'Template not found', 404);
          const template = templates[0];

          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          await db.execute(
            `INSERT INTO workflow_instances 
             (id, workflow_template_id, project_id, user_id, status, step_results, execution_log, started_at)
             VALUES (?, ?, ?, ?, 'running', '{}', ?, ?)`,
            [
              id,
              template_id,
              project_id || null,
              auth.userId,
              `${now}: Workflow instance created\n${now}: Starting step 1`,
              now,
            ]
          );

          return ok(
            res,
            {
              success: true,
              id,
              instance: {
                id,
                workflow_template_id: template_id,
                template_name: template.name,
                status: 'running',
                current_step_index: 0,
              },
            },
            201
          );
        }

        // PUT: Update instance (pause, resume, complete step, abort)
        if (req.method === 'PUT' && resourceId) {
          const { action, step_result } = req.body || {};

          const [instances] = await db.execute(
            'SELECT * FROM workflow_instances WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          if (!instances.length) return err(res, 'Instance not found', 404);
          const instance = instances[0];

          const now = new Date().toISOString();

          switch (action) {
            case 'pause':
              await db.execute(
                "UPDATE workflow_instances SET status = 'paused' WHERE id = ?",
                [resourceId]
              );
              return ok(res, { success: true, status: 'paused' });

            case 'resume':
              await db.execute(
                "UPDATE workflow_instances SET status = 'running' WHERE id = ?",
                [resourceId]
              );
              return ok(res, { success: true, status: 'running' });

            case 'abort':
              await db.execute(
                "UPDATE workflow_instances SET status = 'aborted', completed_at = ? WHERE id = ?",
                [now, resourceId]
              );
              return ok(res, { success: true, status: 'aborted' });

            case 'complete-step':
              // Update step results and advance
              const stepResults = JSON.parse(instance.step_results || '{}');
              const steps = JSON.parse(step_result?.steps || '[]');
              const currentStep = steps[instance.current_step_index];

              if (currentStep) {
                stepResults[`step_${currentStep.id}`] = {
                  ...step_result,
                  completed_at: now,
                };
              }

              const nextStepIndex = instance.current_step_index + 1;
              const isComplete = nextStepIndex >= steps.length;

              await db.execute(
                `UPDATE workflow_instances 
                 SET current_step_index = ?,
                     step_results = ?,
                     status = ?,
                     completed_at = ?,
                     execution_log = CONCAT(execution_log, ?)
                 WHERE id = ?`,
                [
                  nextStepIndex,
                  JSON.stringify(stepResults),
                  isComplete ? 'completed' : 'running',
                  isComplete ? now : null,
                  `\n${now}: Step ${instance.current_step_index + 1} completed`,
                  resourceId,
                ]
              );

              return ok(res, {
                success: true,
                advanced: !isComplete,
                completed: isComplete,
                next_step_index: isComplete ? null : nextStepIndex,
              });

            default:
              return err(res, 'Unknown action');
          }
        }

        // DELETE: Remove instance
        if (req.method === 'DELETE' && resourceId) {
          await db.execute(
            'DELETE FROM workflow_instances WHERE id = ? AND user_id = ?',
            [resourceId, auth.userId]
          );
          return ok(res, { success: true });
        }
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { instances: [] });
        }
        throw e;
      }
    }

    // ── AUTO TASK CREATION (Phase 7.3) ─────────────────────────
    if (resource === 'auto-tasks') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      try {
        const proposedTasks = [];

        // Get all project files that look like DEVLOG or have TODO/FIXME markers
        const [files] = await db.execute(
          `SELECT pf.id, pf.project_id, pf.path, pf.content, p.name as project_name
           FROM project_files pf
           JOIN projects p ON pf.project_id = p.id
           WHERE pf.deleted_at IS NULL 
           AND p.user_id = ?
           AND (pf.path LIKE '%DEVLOG%' OR pf.path LIKE '%TODO%' OR pf.path LIKE '%CHANGELOG%')`,
          [auth.userId]
        );

        // Patterns to detect
        const patterns = [
          { regex: /TODO:?\s*(.+)/gi, type: 'todo', priority: 'medium' },
          { regex: /FIXME:?\s*(.+)/gi, type: 'fixme', priority: 'high' },
          { regex: /XXX:?\s*(.+)/gi, type: 'xxx', priority: 'medium' },
          {
            regex: /BLOCKED:?\s*(.+)/gi,
            type: 'blocked',
            priority: 'critical',
          },
          { regex: /- \[\s*\]\s*(.+)/g, type: 'checkbox', priority: 'medium' },
        ];

        for (const file of files) {
          const content = file.content || '';

          for (const pattern of patterns) {
            let match;
            // Reset regex state
            const regex = new RegExp(pattern.regex.source, pattern.regex.flags);

            while ((match = regex.exec(content)) !== null) {
              const text = (match[1] || match[0]).trim();
              if (text.length < 3 || text.length > 200) continue;

              // Skip if already looks like a completed task
              if (
                text.includes('complete') ||
                text.includes('done') ||
                text.includes('✓')
              )
                continue;

              proposedTasks.push({
                source_file: file.path,
                project_id: file.project_id,
                project_name: file.project_name,
                type: pattern.type,
                title: text.substring(0, 100),
                description: `Found in ${file.path}: ${text}`,
                priority: pattern.priority,
                detected_text: text.substring(0, 200),
              });
            }
          }
        }

        // Also check for BLOCKED comments in any file
        const [allFiles] = await db.execute(
          `SELECT pf.id, pf.project_id, pf.path, pf.content, p.name as project_name
           FROM project_files pf
           JOIN projects p ON pf.project_id = p.id
           WHERE pf.deleted_at IS NULL 
           AND p.user_id = ?
           AND pf.content LIKE '%BLOCKED%'`,
          [auth.userId]
        );

        for (const file of allFiles) {
          const content = file.content || '';
          const blockedRegex = /BLOCKED[:\s]*(.+)/gi;
          let match;

          while ((match = blockedRegex.exec(content)) !== null) {
            const text = match[1].trim();
            // Check if we already have this from DEVLOG scan
            const exists = proposedTasks.some(
              (t) => t.source_file === file.path && t.detected_text === text
            );
            if (!exists && text.length > 3) {
              proposedTasks.push({
                source_file: file.path,
                project_id: file.project_id,
                project_name: file.project_name,
                type: 'blocked',
                title: text.substring(0, 100),
                description: `Blocked in ${file.path}: ${text}`,
                priority: 'critical',
                detected_text: text.substring(0, 200),
              });
            }
          }
        }

        // Remove duplicates
        const uniqueTasks = [];
        const seen = new Set();
        for (const task of proposedTasks) {
          const key = `${task.project_id}:${task.detected_text}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueTasks.push(task);
          }
        }

        return ok(res, {
          proposed: uniqueTasks,
          analyzed_projects: files.length,
          analyzed_files: allFiles.length,
        });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            proposed: [],
            analyzed_projects: 0,
            analyzed_files: 0,
          });
        }
        throw e;
      }
    }

    // ── CREATE TASK FROM PROPOSED (Phase 7.3) ─────────────────
    if (resource === 'create-from-proposed') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { project_id, title, description, priority, source_file } =
        req.body || {};

      if (!title || !project_id)
        return err(res, 'title and project_id required');

      try {
        const [result] = await db.execute(
          `INSERT INTO tasks (user_id, project_id, title, description, priority, status, assigned_by, assignment_reason, created_at)
           VALUES (?, ?, ?, ?, ?, 'pending', 'ai', ?, NOW())`,
          [
            auth.userId,
            project_id,
            title,
            description || '',
            priority || 'medium',
            `Auto-created from ${source_file || 'DEVLOG scan'}`,
          ]
        );

        return ok(res, {
          success: true,
          task_id: result.insertId,
          title,
        });
      } catch (e) {
        throw e;
      }
    }

    // ── WORKFLOW PATTERNS (Phase 7.2) ───────────────────────────────
    if (resource === 'workflow-patterns') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      const projectId = req.query.project_id || null;

      try {
        const patterns = [];
        const suggestions = [];

        // Get completed workflow instances
        let instanceQuery = `SELECT wi.*, wt.name as template_name, wt.steps as template_steps
          FROM workflow_instances wi
          JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
          WHERE wi.user_id = ? AND wi.status = 'completed'`;
        const queryParams = [auth.userId];

        if (projectId) {
          instanceQuery += ' AND wi.project_id = ?';
          queryParams.push(projectId);
        }

        instanceQuery += ' ORDER BY wi.completed_at DESC LIMIT 20';

        const [instances] = await db.execute(instanceQuery, queryParams);

        if (instances.length < 3) {
          return ok(res, {
            patterns: [],
            suggestions: [],
            message: 'Need at least 3 completed workflows for analysis',
            sample_count: instances.length,
          });
        }

        // Get tasks for these workflows
        const instanceIds = instances.map((i) => i.id);
        const [tasks] = await db.execute(
          `SELECT * FROM tasks WHERE workflow_instance_id IN (${instanceIds.map(() => '?').join(',')})`,
          instanceIds
        );

        // Analyze step durations
        const stepDurations = {};
        for (const instance of instances) {
          const stepResults =
            typeof instance.step_results === 'string'
              ? JSON.parse(instance.step_results)
              : instance.step_results || {};
          const steps =
            typeof instance.template_steps === 'string'
              ? JSON.parse(instance.template_steps)
              : instance.template_steps || [];

          for (const step of steps) {
            const result = stepResults[step.id];
            if (result?.completed_at && result?.started_at) {
              const duration =
                new Date(result.completed_at) - new Date(result.started_at);
              if (!stepDurations[step.id]) {
                stepDurations[step.id] = [];
              }
              stepDurations[step.id].push({
                duration,
                label: step.label,
                estimated: step.estimated_minutes * 60 * 1000,
              });
            }
          }
        }

        for (const [stepId, times] of Object.entries(stepDurations)) {
          if (times.length >= 3) {
            const avgActual =
              times.reduce((a, b) => a + b.duration, 0) / times.length;
            const avgEstimated =
              times.reduce((a, b) => a + (b.estimated || 0), 0) / times.length;
            const ratio = avgEstimated > 0 ? avgActual / avgEstimated : null;

            if (ratio !== null) {
              patterns.push({
                type: 'step_duration',
                step_id: stepId,
                label: times[0].label,
                avg_actual_minutes: Math.round(avgActual / 60000),
                avg_estimated_minutes: Math.round(avgEstimated / 60000),
                ratio: Math.round(ratio * 100) / 100,
                sample_count: times.length,
              });

              // Generate suggestions for duration issues
              if (ratio > 1.5) {
                suggestions.push({
                  type: 'estimate_adjustment',
                  priority: 'high',
                  title: 'Adjust time estimate',
                  message: `Step "${times[0].label}" takes ${ratio.toFixed(1)}x longer than estimated (${Math.round(avgActual / 60000)}min avg vs ${Math.round(avgEstimated / 60000)}min planned).`,
                  action: 'adjust_estimate',
                  step_id: stepId,
                  suggested_minutes: Math.round((avgActual / 60000) * 1.2),
                });
              }
            }
          }
        }

        // Analyze agent success rates
        const agentStats = {};
        for (const task of tasks) {
          if (task.assignee_type === 'agent' && task.assignee_id) {
            const key = task.assignee_id;
            if (!agentStats[key]) {
              agentStats[key] = { success: 0, total: 0 };
            }
            agentStats[key].total++;
            if (task.status === 'complete') {
              agentStats[key].success++;
            }
          }
        }

        for (const [agentId, stats] of Object.entries(agentStats)) {
          if (stats.total >= 3) {
            const successRate = stats.success / stats.total;
            patterns.push({
              type: 'agent_success',
              agent_id: agentId,
              success_rate: Math.round(successRate * 100) / 100,
              total_tasks: stats.total,
            });

            if (successRate < 0.5) {
              suggestions.push({
                type: 'agent_reliability',
                priority: 'medium',
                title: 'Agent success rate low',
                message: `${agentId} completes only ${Math.round(successRate * 100)}% of tasks. Consider reviewing its SOP.`,
                action: 'review_agent',
                agent_id: agentId,
              });
            }
          }
        }

        // Detect bottlenecks (blocked steps)
        const blockedSteps = {};
        for (const task of tasks) {
          if (task.workflow_step_id) {
            if (!blockedSteps[task.workflow_step_id]) {
              blockedSteps[task.workflow_step_id] = { blocked: 0, total: 0 };
            }
            blockedSteps[task.workflow_step_id].total++;
            if (task.status === 'blocked') {
              blockedSteps[task.workflow_step_id].blocked++;
            }
          }
        }

        for (const [stepId, stats] of Object.entries(blockedSteps)) {
          if (stats.total >= 2) {
            const blockRate = stats.blocked / stats.total;
            if (blockRate >= 0.3) {
              patterns.push({
                type: 'bottleneck',
                step_id: stepId,
                block_rate: Math.round(blockRate * 100) / 100,
                blocked_count: stats.blocked,
                total_count: stats.total,
              });

              suggestions.push({
                type: 'bottleneck_fix',
                priority: 'high',
                title: 'Step frequently blocked',
                message: `"${stepId}" is blocked ${Math.round(blockRate * 100)}% of the time. Consider adding prerequisites.`,
                action: 'add_checkpoint',
                step_id: stepId,
              });
            }
          }
        }

        // Workflow health summary
        if (instances.length >= 5) {
          const avgDuration =
            instances.reduce((a, i) => {
              if (i.completed_at && i.started_at) {
                return a + (new Date(i.completed_at) - new Date(i.started_at));
              }
              return a;
            }, 0) /
            instances.length /
            60000;

          suggestions.push({
            type: 'workflow_health',
            priority: 'low',
            title: 'Average workflow duration',
            message: `Completed workflows average ${Math.round(avgDuration)} minutes from start to finish.`,
          });
        }

        return ok(res, {
          patterns,
          suggestions,
          sample_count: instances.length,
        });
      } catch (e) {
        console.error('[WorkflowPatterns] Error:', e.message);
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            patterns: [],
            suggestions: [],
            message: 'Workflow tables not found',
          });
        }
        throw e;
      }
    }

    // ── APPLY WORKFLOW SUGGESTION (Phase 7.2) ──────────────────────
    if (resource === 'apply-workflow-suggestion') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { suggestion_type, step_id, suggested_minutes, template_id } =
        req.body || {};

      if (!suggestion_type) return err(res, 'suggestion_type required');

      try {
        // For now, just acknowledge the action
        // Future: actually update the workflow template
        return ok(res, {
          success: true,
          applied: suggestion_type,
          message: `Suggestion "${suggestion_type}" acknowledged. Template update coming soon.`,
        });
      } catch (e) {
        throw e;
      }
    }

    // ── MEMORIES (Phase 7.4) ───────────────────────────────────────
    if (resource === 'memories') {
      const { method } = req;

      // GET /api/data?resource=memories — List memories
      if (method === 'GET') {
        const category = req.query.category || null;
        const activeOnly = req.query.active !== 'false';

        try {
          let query = 'SELECT * FROM memories WHERE user_id = ?';
          const params = [auth.userId];

          if (category) {
            query += ' AND category = ?';
            params.push(category);
          }

          if (activeOnly) {
            query += ' AND is_active = TRUE';
          }

          query += ' ORDER BY accessed_count DESC, updated_at DESC LIMIT 50';

          const [rows] = await db.execute(query, params);

          // Update last_accessed for retrieved memories
          if (rows.length > 0) {
            const ids = rows.map((r) => r.id);
            await db.execute(
              `UPDATE memories SET last_accessed = NOW(), accessed_count = accessed_count + 1 
               WHERE id IN (${ids.map(() => '?').join(',')})`,
              ids
            );
          }

          return ok(res, { memories: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, {
              memories: [],
              message: 'Memories table not found',
            });
          }
          throw e;
        }
      }

      // POST /api/data?resource=memories — Create memory
      if (method === 'POST') {
        const { category, title, content, source_type, source_id, confidence } =
          req.body || {};

        if (!category || !title || !content) {
          return err(res, 'category, title, and content are required');
        }

        try {
          const [result] = await db.execute(
            `INSERT INTO memories (user_id, category, title, content, source_type, source_id, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              auth.userId,
              category,
              title,
              content,
              source_type || 'manual',
              source_id || null,
              confidence || 0.5,
            ]
          );

          return ok(res, {
            success: true,
            id: result.insertId,
          });
        } catch (e) {
          throw e;
        }
      }

      return err(res, 'Method not allowed', 405);
    }

    // ── MEMORY AUTO-EXTRACTION (Phase 7.4) ───────────────────────
    if (resource === 'extract-memories') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { source_type, source_id } = req.body || {};
      if (!source_type || !source_id) {
        return err(res, 'source_type and source_id are required');
      }

      try {
        const extracted = [];

        // Extract from completed workflow
        if (source_type === 'workflow') {
          const [instances] = await db.execute(
            `SELECT wi.*, wt.name as template_name
             FROM workflow_instances wi
             JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
             WHERE wi.id = ? AND wi.user_id = ?`,
            [source_id, auth.userId]
          );

          if (instances[0]) {
            const instance = instances[0];
            const duration =
              instance.completed_at && instance.started_at
                ? Math.round(
                    (new Date(instance.completed_at) -
                      new Date(instance.started_at)) /
                      60000
                  )
                : null;

            // Extract pattern memory
            extracted.push({
              category: 'patterns',
              title: `Workflow: ${instance.template_name} completed`,
              content: `Completed workflow "${instance.template_name}" in ${duration} minutes. Status: ${instance.status}`,
              source_type: 'workflow',
              source_id: instance.id,
              confidence: 0.8,
            });

            // Extract event memory
            extracted.push({
              category: 'events',
              title: `Recent workflow execution`,
              content: `Executed ${instance.template_name} workflow which ${instance.status === 'completed' ? 'completed successfully' : instance.status}`,
              source_type: 'workflow',
              source_id: instance.id,
              confidence: 0.9,
            });
          }
        }

        // Extract from task completion
        if (source_type === 'task') {
          const [tasks] = await db.execute(
            `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
            [source_id, auth.userId]
          );

          if (tasks[0]) {
            const task = tasks[0];

            // Extract as pattern if agent task
            if (task.assignee_type === 'agent') {
              const success = task.status === 'complete';
              extracted.push({
                category: 'patterns',
                title: `Agent task: ${task.title}`,
                content: `${task.assignee_id} agent ${success ? 'successfully completed' : 'failed'} task "${task.title}"`,
                source_type: 'task',
                source_id: task.id,
                confidence: success ? 0.8 : 0.6,
              });
            }

            // Extract as event
            extracted.push({
              category: 'events',
              title: `Task: ${task.title}`,
              content: `Task "${task.title}" is now ${task.status}. Priority: ${task.priority}`,
              source_type: 'task',
              source_id: task.id,
              confidence: 0.9,
            });
          }
        }

        // Extract from check-in patterns
        if (source_type === 'checkin') {
          const [checkins] = await db.execute(
            `SELECT * FROM daily_checkins WHERE user_id = ? ORDER BY date DESC LIMIT 7`,
            [auth.userId]
          );

          if (checkins.length >= 5) {
            const avgEnergy =
              checkins.reduce((a, c) => a + (c.energy || 0), 0) /
              checkins.length;
            const avgSleep =
              checkins.reduce((a, c) => a + (c.sleep_hours || 0), 0) /
              checkins.length;

            extracted.push({
              category: 'patterns',
              title: 'Weekly check-in pattern',
              content: `Average energy level: ${avgEnergy.toFixed(1)}/10, Average sleep: ${avgSleep.toFixed(1)} hours over last ${checkins.length} days`,
              source_type: 'checkin',
              source_id: source_id,
              confidence: 0.7,
            });
          }
        }

        // Save extracted memories
        for (const mem of extracted) {
          await db.execute(
            `INSERT INTO memories (user_id, category, title, content, source_type, source_id, confidence)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              auth.userId,
              mem.category,
              mem.title,
              mem.content,
              mem.source_type,
              mem.source_id,
              mem.confidence,
            ]
          );
        }

        return ok(res, {
          success: true,
          extracted: extracted.length,
          memories: extracted,
        });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            success: false,
            extracted: 0,
            message: 'Memories table not found',
          });
        }
        throw e;
      }
    }

    // ── MEMORY INSIGHTS (Phase 7.4) ────────────────────────────────
    if (resource === 'memory-insights') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      try {
        // Get memory statistics
        const [stats] = await db.execute(
          `SELECT 
             category,
             COUNT(*) as count,
             AVG(confidence) as avg_confidence,
             SUM(accessed_count) as total_accesses
           FROM memories 
           WHERE user_id = ? AND is_active = TRUE
           GROUP BY category`,
          [auth.userId]
        );

        // Get recent patterns
        const [recentPatterns] = await db.execute(
          `SELECT * FROM memories 
           WHERE user_id = ? AND category = 'patterns' AND is_active = TRUE
           ORDER BY accessed_count DESC, created_at DESC
           LIMIT 5`,
          [auth.userId]
        );

        // Get personalized insights
        const insights = [];

        // Analyze patterns for insights
        for (const pattern of recentPatterns) {
          if (pattern.content.includes('underestimate')) {
            insights.push({
              type: 'estimation',
              message:
                'You tend to underestimate task duration. Consider adding 20% buffer.',
              confidence: pattern.confidence,
            });
          }
          if (
            pattern.content.includes('successfully completed') &&
            pattern.content.includes('agent')
          ) {
            insights.push({
              type: 'delegation',
              message:
                'Agent tasks are completing successfully. Keep delegating!',
              confidence: pattern.confidence,
            });
          }
        }

        // Check engagement pattern
        const [sessionCount] = await db.execute(
          `SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND ended_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
          [auth.userId]
        );

        if (sessionCount[0]?.count > 0) {
          insights.push({
            type: 'engagement',
            message: `You have ${sessionCount[0].count} sessions this week. Keep the momentum!`,
            confidence: 0.9,
          });
        }

        return ok(res, {
          stats,
          recent_patterns: recentPatterns,
          insights,
        });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, {
            stats: [],
            recent_patterns: [],
            insights: [],
            message: 'Memories table not found',
          });
        }
        throw e;
      }
    }

    // ── COMMUNITY WORKFLOWS (Phase 8.1) ───────────────────────────
    if (resource === 'community-workflows') {
      const { method } = req;

      // GET /api/data?resource=community-workflows — List public workflows
      if (method === 'GET') {
        const category = req.query.category || null;
        const sort = req.query.sort || 'stars'; // stars, usage, recent
        const search = req.query.search || null;

        try {
          let query =
            'SELECT * FROM community_workflows WHERE is_published = TRUE';
          const params = [];

          if (category) {
            query += ' AND category = ?';
            params.push(category);
          }

          if (search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
          }

          switch (sort) {
            case 'usage':
              query += ' ORDER BY usage_count DESC';
              break;
            case 'recent':
              query += ' ORDER BY published_at DESC';
              break;
            case 'rating':
              query += ' ORDER BY avg_rating DESC';
              break;
            case 'stars':
            default:
              query += ' ORDER BY stars DESC';
          }

          query += ' LIMIT 50';

          const [rows] = await db.execute(query, params);

          return ok(res, { workflows: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, {
              workflows: [],
              message: 'Community workflows not found',
            });
          }
          throw e;
        }
      }

      // POST /api/data?resource=community-workflows — Publish workflow
      if (method === 'POST') {
        const { workflow_id, name, description, icon, category } =
          req.body || {};

        if (!workflow_id || !name) {
          return err(res, 'workflow_id and name are required');
        }

        try {
          // Get the original workflow template
          const [templates] = await db.execute(
            'SELECT * FROM workflow_templates WHERE id = ?',
            [workflow_id]
          );

          if (!templates[0]) {
            return err(res, 'Workflow template not found');
          }

          const template = templates[0];

          // Anonymize user data
          const [result] = await db.execute(
            `INSERT INTO community_workflows 
             (original_workflow_id, original_user_id, name, description, icon, category, steps, is_published)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [
              workflow_id,
              null, // anonymize user
              name,
              description || template.description || '',
              icon || template.icon || '📋',
              category || 'general',
              template.steps,
            ]
          );

          // Update usage count of original
          await db.execute(
            'UPDATE workflow_templates SET usage_count = usage_count + 1 WHERE id = ?',
            [workflow_id]
          );

          return ok(res, {
            success: true,
            id: result.insertId,
            message: 'Workflow published to community',
          });
        } catch (e) {
          throw e;
        }
      }

      return err(res, 'Method not allowed', 405);
    }

    // ── STAR/FORK COMMUNITY WORKFLOW ─────────────────────────────
    if (resource === 'community-workflow-action') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { action, workflow_id } = req.body || {};
      if (!action || !workflow_id) {
        return err(res, 'action and workflow_id are required');
      }

      try {
        if (action === 'star') {
          await db.execute(
            'UPDATE community_workflows SET stars = stars + 1 WHERE id = ?',
            [workflow_id]
          );
          return ok(res, { success: true, action: 'starred' });
        }

        if (action === 'unstar') {
          await db.execute(
            'UPDATE community_workflows SET stars = GREATEST(stars - 1, 0) WHERE id = ?',
            [workflow_id]
          );
          return ok(res, { success: true, action: 'unstarred' });
        }

        if (action === 'fork') {
          // Get the community workflow
          const [workflows] = await db.execute(
            'SELECT * FROM community_workflows WHERE id = ?',
            [workflow_id]
          );

          if (!workflows[0]) {
            return err(res, 'Workflow not found');
          }

          const wf = workflows[0];

          // Create a copy in user's workflow_templates
          const newId = `forked-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await db.execute(
            `INSERT INTO workflow_templates 
             (id, user_id, name, description, icon, steps, is_system)
             VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
            [
              newId,
              auth.userId,
              `${wf.name} (fork)`,
              wf.description,
              wf.icon,
              wf.steps,
            ]
          );

          // Increment fork count
          await db.execute(
            'UPDATE community_workflows SET forks = forks + 1 WHERE id = ?',
            [workflow_id]
          );

          return ok(res, {
            success: true,
            action: 'forked',
            new_workflow_id: newId,
          });
        }

        if (action === 'rate') {
          const { rating } = req.body || {};
          if (!rating || rating < 1 || rating > 5) {
            return err(res, 'Valid rating (1-5) required');
          }

          // Get current rating data
          const [workflows] = await db.execute(
            'SELECT avg_rating, rating_count FROM community_workflows WHERE id = ?',
            [workflow_id]
          );

          if (!workflows[0]) {
            return err(res, 'Workflow not found');
          }

          const current = workflows[0];
          const newCount = current.rating_count + 1;
          const newAvg =
            (current.avg_rating * current.rating_count + rating) / newCount;

          await db.execute(
            'UPDATE community_workflows SET avg_rating = ?, rating_count = ? WHERE id = ?',
            [newAvg, newCount, workflow_id]
          );

          return ok(res, {
            success: true,
            action: 'rated',
            new_rating: Math.round(newAvg * 10) / 10,
          });
        }

        return err(res, 'Unknown action', 400);
      } catch (e) {
        throw e;
      }
    }

    // ── MY PUBLISHED WORKFLOWS ─────────────────────────────────
    if (resource === 'my-community-workflows') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      try {
        const [rows] = await db.execute(
          `SELECT * FROM community_workflows 
           WHERE original_user_id = ? OR original_user_id IS NULL
           ORDER BY published_at DESC`,
          [auth.userId]
        );

        return ok(res, { workflows: rows });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { workflows: [] });
        }
        throw e;
      }
    }

    // ── USER INTEGRATIONS (Phase 8.2) ────────────────────────────
    if (resource === 'integrations') {
      const { method } = req;

      // GET /api/data?resource=integrations — List user's integrations
      if (method === 'GET') {
        try {
          const [rows] = await db.execute(
            `SELECT id, user_id, provider, is_active, metadata, created_at, updated_at
             FROM user_integrations 
             WHERE user_id = ? AND is_active = TRUE`,
            [auth.userId]
          );

          return ok(res, { integrations: rows });
        } catch (e) {
          if (
            e.message.includes('Table') &&
            e.message.includes("doesn't exist")
          ) {
            return ok(res, { integrations: [] });
          }
          throw e;
        }
      }

      // POST /api/data?resource=integrations — Add integration
      if (method === 'POST') {
        const {
          provider,
          access_token,
          refresh_token,
          token_expires_at,
          metadata,
        } = req.body || {};

        if (!provider || !access_token) {
          return err(res, 'provider and access_token are required');
        }

        try {
          // Check if integration already exists
          const [existing] = await db.execute(
            'SELECT id FROM user_integrations WHERE user_id = ? AND provider = ?',
            [auth.userId, provider]
          );

          if (existing[0]) {
            // Update existing
            await db.execute(
              `UPDATE user_integrations 
               SET access_token = ?, refresh_token = ?, token_expires_at = ?, metadata = ?, is_active = TRUE
               WHERE user_id = ? AND provider = ?`,
              [
                access_token,
                refresh_token,
                token_expires_at,
                JSON.stringify(metadata),
                auth.userId,
                provider,
              ]
            );

            return ok(res, { success: true, action: 'updated' });
          } else {
            // Insert new
            const [result] = await db.execute(
              `INSERT INTO user_integrations (user_id, provider, access_token, refresh_token, token_expires_at, metadata)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                auth.userId,
                provider,
                access_token,
                refresh_token,
                token_expires_at,
                JSON.stringify(metadata),
              ]
            );

            return ok(res, {
              success: true,
              action: 'created',
              id: result.insertId,
            });
          }
        } catch (e) {
          throw e;
        }
      }

      // DELETE /api/data?resource=integrations — Remove integration
      if (method === 'DELETE') {
        const { provider } = req.body || {};

        if (!provider) {
          return err(res, 'provider is required');
        }

        try {
          await db.execute(
            'UPDATE user_integrations SET is_active = FALSE WHERE user_id = ? AND provider = ?',
            [auth.userId, provider]
          );

          return ok(res, { success: true });
        } catch (e) {
          throw e;
        }
      }

      return err(res, 'Method not allowed', 405);
    }

    // ── GITHUB INTEGRATION (Phase 8.2) ──────────────────────────
    if (resource === 'github-sync') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { action, project_id } = req.body || {};

      try {
        // Get GitHub integration
        const [integrations] = await db.execute(
          'SELECT * FROM user_integrations WHERE user_id = ? AND provider = ? AND is_active = TRUE',
          [auth.userId, 'github']
        );

        if (!integrations[0]) {
          return err(res, 'GitHub integration not connected');
        }

        const integration = integrations[0];
        const token = integration.access_token;

        if (action === 'sync-repos') {
          // In production, this would call GitHub API
          // For now, return mock data structure
          return ok(res, {
            success: true,
            repos: [
              {
                name: 'the-brain-2',
                full_name: 'user/the-brain-2',
                private: false,
              },
            ],
            message: 'GitHub sync would fetch repos here',
          });
        }

        if (action === 'create-issue') {
          const { repo, title, body } = req.body || {};
          if (!repo || !title) {
            return err(res, 'repo and title are required');
          }

          // In production, would create GitHub issue
          return ok(res, {
            success: true,
            action: 'issue-created',
            repo,
            title,
            message: 'Would create GitHub issue here',
          });
        }

        if (action === 'link-project') {
          const { repo, project_id: projId } = req.body || {};
          if (!repo || !projId) {
            return err(res, 'repo and project_id are required');
          }

          // Update project with GitHub repo info
          await db.execute(
            'UPDATE projects SET github_repo = ? WHERE id = ? AND user_id = ?',
            [repo, projId, auth.userId]
          );

          return ok(res, { success: true, repo });
        }

        return err(res, 'Unknown action', 400);
      } catch (e) {
        throw e;
      }
    }

    // ── CALENDAR INTEGRATION (Phase 8.2) ────────────────────────
    if (resource === 'calendar-sync') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { action } = req.body || {};

      try {
        // Get Google integration
        const [integrations] = await db.execute(
          'SELECT * FROM user_integrations WHERE user_id = ? AND provider = ? AND is_active = TRUE',
          [auth.userId, 'google']
        );

        if (!integrations[0]) {
          return err(res, 'Google Calendar integration not connected');
        }

        if (action === 'create-event') {
          const { title, description, start_time, end_time, task_id } =
            req.body || {};

          if (!title || !start_time) {
            return err(res, 'title and start_time are required');
          }

          // In production, would create Google Calendar event
          return ok(res, {
            success: true,
            action: 'event-created',
            title,
            start_time,
            message: 'Would create Google Calendar event here',
          });
        }

        if (action === 'block-time') {
          const { task_id, duration_minutes } = req.body || {};

          if (!task_id) {
            return err(res, 'task_id is required');
          }

          // Get task details
          const [tasks] = await db.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
            [task_id, auth.userId]
          );

          if (!tasks[0]) {
            return err(res, 'Task not found');
          }

          // In production, would block time on calendar
          return ok(res, {
            success: true,
            action: 'time-blocked',
            task_id,
            duration_minutes: duration_minutes || 60,
            message: 'Would block time on Google Calendar here',
          });
        }

        return err(res, 'Unknown action', 400);
      } catch (e) {
        throw e;
      }
    }

    // ── EMAIL INTEGRATION (Phase 8.2) ───────────────────────────
    if (resource === 'email-sync') {
      if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

      const { action } = req.body || {};

      try {
        // Get email integration
        const [integrations] = await db.execute(
          'SELECT * FROM user_integrations WHERE user_id = ? AND provider = ? AND is_active = TRUE',
          [auth.userId, 'email']
        );

        if (!integrations[0]) {
          return err(res, 'Email integration not connected');
        }

        if (action === 'send-task-update') {
          const { task_id, recipients } = req.body || {};

          if (!task_id || !recipients) {
            return err(res, 'task_id and recipients are required');
          }

          // Get task details
          const [tasks] = await db.execute(
            'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
            [task_id, auth.userId]
          );

          if (!tasks[0]) {
            return err(res, 'Task not found');
          }

          const task = tasks[0];

          // In production, would send email
          return ok(res, {
            success: true,
            action: 'email-sent',
            recipients,
            subject: `Task Update: ${task.title}`,
            message: 'Would send email notification here',
          });
        }

        return err(res, 'Unknown action', 400);
      } catch (e) {
        throw e;
      }
    }

    // ── SYNC LOG (Phase 8.2) ────────────────────────────────────
    if (resource === 'integration-sync-log') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      const provider = req.query.provider || null;

      try {
        let query = 'SELECT * FROM integration_sync_log WHERE user_id = ?';
        const params = [auth.userId];

        if (provider) {
          query += ' AND provider = ?';
          params.push(provider);
        }

        query += ' ORDER BY started_at DESC LIMIT 20';

        const [rows] = await db.execute(query, params);

        return ok(res, { sync_logs: rows });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { sync_logs: [] });
        }
        throw e;
      }
    }


    // ── AGENT STATS (Phase 5.3) ───────────────────────────────────
    if (resource === 'agent-stats') {
      if (req.method !== 'GET') return err(res, 'Method not allowed', 405);

      const agentId = req.query.agent_id;

      try {
        // Get agent stats from tasks table
        let query = `
          SELECT 
            assignee_id as agent_id,
            COUNT(*) as total_tasks,
            SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as completed_tasks,
            AVG(result_duration_minutes) as avg_duration_minutes,
            AVG(result_cost) as avg_cost
          FROM tasks 
          WHERE assignee_type = 'agent' AND user_id = ?
        `;
        const params = [auth.userId];

        if (agentId) {
          query += ' AND assignee_id = ?';
          params.push(agentId);
        }

        query += ' GROUP BY assignee_id';

        const [rows] = await db.execute(query, params);

        // Calculate success rate
        const stats = rows.map(row => ({
          agent_id: row.agent_id,
          total_tasks: parseInt(row.total_tasks) || 0,
          completed_tasks: parseInt(row.completed_tasks) || 0,
          avg_duration_minutes: Math.round(row.avg_duration_minutes) || 0,
          avg_cost: parseFloat(row.avg_cost) || 0,
          success_rate: row.total_tasks > 0 
            ? Math.round((row.completed_tasks / row.total_tasks) * 100) 
            : 0
        }));

        return ok(res, { stats });
      } catch (e) {
        if (
          e.message.includes('Table') &&
          e.message.includes("doesn't exist")
        ) {
          return ok(res, { stats: [] });
        }
        throw e;
      }
    }
    return err(res, 'Not found', 404);
  } catch (e) {
    console.error('Data error:', e.message, e.stack);
    return err(res, `Server error: ${e.message}`, 500);
  } finally {
    if (db) await db.end();
  }
}
