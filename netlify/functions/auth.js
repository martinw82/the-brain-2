// netlify/functions/auth.js
// POST /api/auth/register  — create account
// POST /api/auth/login     — get JWT
// GET  /api/auth/me        — verify token + return user

import bcrypt from 'bcryptjs';
import { query } from './_db.js';
import { signToken, requireAuth, ok, err, handleOptions, HEADERS } from './_auth.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  const path = event.path.replace('/.netlify/functions/auth', '').replace('/api/auth', '');

  // ── REGISTER ──────────────────────────────────────────────
  if (event.httpMethod === 'POST' && path === '/register') {
    try {
      const { email, password, name } = JSON.parse(event.body || '{}');

      if (!email || !password) return err('Email and password required');
      if (password.length < 8) return err('Password must be at least 8 characters');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Invalid email');

      // Check if email already exists
      const existing = await query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
      if (existing.length > 0) return err('Email already registered', 409);

      const hash = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();

      await query(
        'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
        [userId, email.toLowerCase(), hash, name || null]
      );

      const token = signToken({ userId, email: email.toLowerCase() });

      return ok({
        token,
        user: { id: userId, email: email.toLowerCase(), name: name || null }
      }, 201);

    } catch (e) {
      console.error('Register error:', e);
      return err('Registration failed', 500);
    }
  }

  // ── LOGIN ─────────────────────────────────────────────────
  if (event.httpMethod === 'POST' && path === '/login') {
    try {
      const { email, password } = JSON.parse(event.body || '{}');
      if (!email || !password) return err('Email and password required');

      const users = await query(
        'SELECT id, email, password_hash, name, goal, monthly_target, currency, timezone FROM users WHERE email = ?',
        [email.toLowerCase()]
      );

      if (users.length === 0) return err('Invalid email or password', 401);
      const user = users[0];

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return err('Invalid email or password', 401);

      const token = signToken({ userId: user.id, email: user.email });

      return ok({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          goal: user.goal,
          monthly_target: user.monthly_target,
          currency: user.currency,
          timezone: user.timezone,
        }
      });

    } catch (e) {
      console.error('Login error:', e);
      return err('Login failed', 500);
    }
  }

  // ── ME (verify token) ─────────────────────────────────────
  if (event.httpMethod === 'GET' && path === '/me') {
    const auth = requireAuth(event.headers);
    if (!auth) return err('Unauthorised', 401);

    try {
      const users = await query(
        'SELECT id, email, name, goal, monthly_target, currency, timezone FROM users WHERE id = ?',
        [auth.userId]
      );
      if (users.length === 0) return err('User not found', 404);
      return ok({ user: users[0] });
    } catch (e) {
      return err('Server error', 500);
    }
  }

  // ── UPDATE PROFILE ────────────────────────────────────────
  if (event.httpMethod === 'PUT' && path === '/me') {
    const auth = requireAuth(event.headers);
    if (!auth) return err('Unauthorised', 401);

    try {
      const { name, goal, monthly_target, currency, timezone } = JSON.parse(event.body || '{}');
      await query(
        'UPDATE users SET name=?, goal=?, monthly_target=?, currency=?, timezone=? WHERE id=?',
        [name, goal, monthly_target, currency, timezone, auth.userId]
      );
      return ok({ success: true });
    } catch (e) {
      return err('Update failed', 500);
    }
  }

  return err('Not found', 404);
}
