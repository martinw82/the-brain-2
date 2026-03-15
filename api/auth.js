// api/auth.js — Vercel serverless function
// Handles: /api/auth/register, /api/auth/login, /api/auth/me

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
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

function ok(res, data, status = 200) {
  return res.status(status).json(data);
}
function err(res, msg, status = 400) {
  return res.status(status).json({ error: msg });
}
function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  
  // Handle HEAD request for connectivity check (sync.js isOnline)
  if (req.method === 'HEAD') return res.status(200).end();

  const action = req.query.action;
  let db;

  try {
    db = await getDb();

    // POST /api/auth?action=register
    if (req.method === 'POST' && action === 'register') {
      const { email, password, name } = req.body || {};
      if (!email || !password) return err(res, 'Email and password required');
      if (password.length < 8) return err(res, 'Password must be at least 8 characters');

      const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existing.length > 0) return err(res, 'Email already registered', 409);

      const hash = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();
      await db.execute(
        'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
        [userId, email.toLowerCase(), hash, name || null]
      );
      const token = jwt.sign({ userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: '30d' });
      return ok(res, { token, user: { id: userId, email: email.toLowerCase(), name: name || null } }, 201);
    }

    // POST /api/auth?action=login
    if (req.method === 'POST' && action === 'login') {
      const { email, password } = req.body || {};
      if (!email || !password) return err(res, 'Email and password required');

      const [users] = await db.execute(
        'SELECT id, email, password_hash, name, goal, monthly_target, currency, timezone FROM users WHERE email = ?',
        [email.toLowerCase()]
      );
      if (!users.length) return err(res, 'Invalid email or password', 401);
      const user = users[0];
      if (!await bcrypt.compare(password, user.password_hash)) return err(res, 'Invalid email or password', 401);

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
      return ok(res, { token, user: { id: user.id, email: user.email, name: user.name, goal: user.goal, monthly_target: user.monthly_target, currency: user.currency, timezone: user.timezone } });
    }

    // GET /api/auth?action=me
    if (req.method === 'GET' && action === 'me') {
      const auth = getAuth(req);
      if (!auth) return err(res, 'Unauthorised', 401);
      const [users] = await db.execute(
        'SELECT id, email, name, goal, monthly_target, currency, timezone FROM users WHERE id = ?',
        [auth.userId]
      );
      if (!users.length) return err(res, 'User not found', 404);
      return ok(res, { user: users[0] });
    }

    // PUT /api/auth?action=me
    if (req.method === 'PUT' && action === 'me') {
      const auth = getAuth(req);
      if (!auth) return err(res, 'Unauthorised', 401);
      const { name, goal, monthly_target, currency, timezone } = req.body || {};
      await db.execute(
        'UPDATE users SET name=?, goal=?, monthly_target=?, currency=?, timezone=? WHERE id=?',
        [name, goal, monthly_target, currency, timezone, auth.userId]
      );
      return ok(res, { success: true });
    }

    return err(res, 'Not found', 404);
  } catch (e) {
    console.error('Auth error:', e);
    return err(res, 'Server error', 500);
  } finally {
    if (db) await db.end();
  }
}
