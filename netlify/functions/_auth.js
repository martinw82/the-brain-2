// netlify/functions/_auth.js
// JWT verification middleware for all protected routes

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES = '30d';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Extract and verify Bearer token from request headers
// Returns { userId, email } or null
export function requireAuth(headers) {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  return verifyToken(token);
}

// Standard CORS + JSON headers
export const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function ok(data, status = 200) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify(data) };
}

export function err(message, status = 400) {
  return { statusCode: status, headers: HEADERS, body: JSON.stringify({ error: message }) };
}

export function handleOptions() {
  return { statusCode: 204, headers: HEADERS, body: '' };
}
