// Handler for auth resources: auth
// Merged from api/auth.js into data.js handler pattern
// NOTE: This handler is AUTH_EXEMPT — register/login don't require JWT

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handleAuth(req, res, { db, userId, ok, err }) {
  const { action } = req.query;

  // Handle HEAD request for connectivity check (sync.js isOnline)
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  // POST ?action=register
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

  // POST ?action=login
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

  // GET ?action=me
  if (req.method === 'GET' && action === 'me') {
    if (!userId) return err(res, 'Unauthorised', 401);
    const [users] = await db.execute(
      'SELECT id, email, name, goal, monthly_target, currency, timezone FROM users WHERE id = ?',
      [userId]
    );
    if (!users.length) return err(res, 'User not found', 404);
    return ok(res, { user: users[0] });
  }

  // PUT ?action=me
  if (req.method === 'PUT' && action === 'me') {
    if (!userId) return err(res, 'Unauthorised', 401);
    const { name, goal, monthly_target, currency, timezone } = req.body || {};
    await db.execute(
      'UPDATE users SET name=?, goal=?, monthly_target=?, currency=?, timezone=? WHERE id=?',
      [name, goal, monthly_target, currency, timezone, userId]
    );
    return ok(res, { success: true });
  }

  return err(res, 'Not found', 404);
}
