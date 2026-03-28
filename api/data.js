// api/data.js — Vercel serverless function (Refactored)
// Thin router that dispatches to handler modules

import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { getCorsHeaders } from './_lib/cors.js';

// Import handlers
import handleStaging from './_lib/handlers/staging.js';
import handleEntities from './_lib/handlers/entities.js';
import handleSessions from './_lib/handlers/sessions.js';
import handleTasks from './_lib/handlers/tasks.js';
import handleFiles from './_lib/handlers/files.js';
import handleSettings from './_lib/handlers/settings.js';
import handleSync from './_lib/handlers/sync.js';
import handleAdmin from './_lib/handlers/admin.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is not set');

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

// ── PAGINATION HELPER ─────────────────────────────────────────
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

// ── RATE LIMITING ────────────────────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

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
  return record.count <= RATE_LIMIT_MAX;
}

// ── INPUT SANITIZATION ──────────────────────────────────────
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b)/gi, '')
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
      sanitized[key] = value.map((v) => (typeof v === 'string' ? sanitizeInput(v) : v));
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ── HANDLER REGISTRY ─────────────────────────────────────────
const HANDLERS = {
  // staging & ideas
  staging: handleStaging,
  ideas: handleStaging,
  
  // entities
  areas: handleEntities,
  goals: handleEntities,
  templates: handleEntities,
  contributions: handleEntities,
  tags: handleEntities,
  'entity-tags': handleEntities,
  links: handleEntities,
  search: handleEntities,
  
  // sessions group
  sessions: handleSessions,
  comments: handleSessions,
  'daily-checkins': handleSessions,
  'training-logs': handleSessions,
  'weekly-review': handleSessions,
  
  // tasks
  tasks: handleTasks,
  'auto-tasks': handleTasks,
  'create-from-proposed': handleTasks,
  
  // files
  'file_metadata': handleFiles,
  'file-summaries': handleFiles,
  scripts: handleFiles,
  
  // settings
  settings: handleSettings,
  'user-ai-settings': handleSettings,
  'outreach-log': handleSettings,
  'ai-metadata-suggestions': handleSettings,
  
  // sync
  'sync-state': handleSync,
  'drift-check': handleSync,
  
  // admin
  'export-all': handleAdmin,
  'import-all': handleAdmin,
  'agent-stats': handleAdmin,
  'wipe-user': handleAdmin,
};

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
export default async function handler(req, res) {
  const CORS = getCorsHeaders(req);
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  // Rate limiting
  if (!checkRateLimit(auth.userId)) {
    return err(res, 'Rate limit exceeded. Please try again later.', 429);
  }

  // Sanitize inputs
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  const { resource } = req.query;
  if (!resource) return err(res, 'resource parameter required');

  const handlerFn = HANDLERS[resource];
  if (!handlerFn) return err(res, 'Unknown resource', 400);

  let db;
  try {
    db = await getDb();
    const context = { db, userId: auth.userId, ok, err, safeJson, addPagination, formatPaginatedResponse };
    const result = await handlerFn(req, res, context);
    // If handler returns null, it didn't handle the request (shouldn't happen with proper routing)
    if (result === null) {
      return err(res, 'Resource handler returned no result', 500);
    }
  } catch (e) {
    console.error('Data API error:', e);
    return err(res, 'Server error', 500);
  } finally {
    if (db) await db.end();
  }
}
