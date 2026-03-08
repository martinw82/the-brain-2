// api/ai.js — Anthropic Proxy Function

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function err(res, msg, status = 400) { return res.status(status).json({ error: msg }); }

function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  const { prompt, system } = req.body || {};
  if (!prompt) return err(res, 'prompt required');

  if (!ANTHROPIC_API_KEY) return err(res, 'AI provider not configured', 500);

  // Simple in-memory rate limiting (best effort for serverless)
  // Note: In a real Vercel environment, this only applies to the current instance.
  // Using a global store like Upstash Redis is the recommended Phase 2 approach.
  if (!global.aiRateLimit) global.aiRateLimit = {};
  const now = Date.now();
  const userLimit = global.aiRateLimit[auth.userId] || { count: 0, reset: now + 60000 };

  if (now > userLimit.reset) {
    userLimit.count = 0;
    userLimit.reset = now + 60000;
  }

  if (userLimit.count >= 10) {
    return res.status(429).json({ error: 'Rate limited. Try again in a minute.' });
  }

  userLimit.count++;
  global.aiRateLimit[auth.userId] = userLimit;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        system: system || '',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Anthropic API error:', data);
        return err(res, data.error?.message || 'AI Proxy Error', response.status);
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error('AI error:', e);
    return err(res, 'Server error', 500);
  }
}
