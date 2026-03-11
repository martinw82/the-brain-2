// api/ai.js — Anthropic Proxy + Server-Side Context Builder (Phase 2.8)

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const agentConfig = require('../agent-config.json');

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

// ── TOKEN ESTIMATOR ───────────────────────────────────────────
// Rough estimate: 1 token ≈ 4 chars
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── SERVER-SIDE SYSTEM PROMPT BUILDER ────────────────────────
async function buildSystemPrompt(userId, db) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch all data in parallel
  const [
    [userRows],
    [goalRows],
    [contribRows],
    [checkinRows],
    [trainingRows],
    [outreachRows],
    [projectRows],
    [sessionRows],
    [driftCheckinRows],
    [driftTrainingRows],
    [driftOutreachRows],
    [driftSessionRows],
  ] = await Promise.all([
    db.execute('SELECT name, email, monthly_target, currency, goal FROM users WHERE id = ?', [userId]),
    db.execute(`SELECT id, title, target_amount, current_amount, currency, status
                FROM goals WHERE user_id = ? AND status = 'active' LIMIT 1`, [userId]),
    db.execute(`SELECT SUM(amount) as total FROM goal_contributions
                WHERE goal_id IN (SELECT id FROM goals WHERE user_id = ? AND status = 'active')`, [userId]),
    db.execute('SELECT * FROM daily_checkins WHERE user_id = ? AND date = ?', [userId, today]),
    db.execute(`SELECT COUNT(*) as count, SUM(duration_minutes) as minutes
                FROM training_logs WHERE user_id = ? AND date >= ?`, [userId, weekAgo]),
    db.execute(`SELECT COUNT(*) as today_count FROM outreach_log WHERE user_id = ? AND date = ?`, [userId, today]),
    db.execute(`SELECT id, name, phase, health, momentum, priority, revenue_ready,
                       next_action, blockers, tags, income_target, emoji
                FROM projects WHERE user_id = ?
                ORDER BY priority ASC LIMIT 12`, [userId]),
    db.execute(`SELECT s.project_id, p.name as project_name, s.duration_s, s.log, s.ended_at
                FROM sessions s LEFT JOIN projects p ON p.id = s.project_id
                WHERE s.user_id = ? ORDER BY s.ended_at DESC LIMIT 3`, [userId]),
    // Drift detection data
    db.execute('SELECT date, energy_level FROM daily_checkins WHERE user_id = ? AND date >= ? ORDER BY date DESC', [userId, fourteenDaysAgo]),
    db.execute('SELECT date FROM training_logs WHERE user_id = ? AND date >= ? ORDER BY date DESC', [userId, fourteenDaysAgo]),
    db.execute('SELECT date FROM outreach_log WHERE user_id = ? AND date >= ? ORDER BY date DESC', [userId, new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]),
    db.execute('SELECT project_id, ended_at FROM sessions WHERE user_id = ? AND ended_at >= ? ORDER BY ended_at DESC', [userId, fourteenDaysAgo + ' 00:00:00']),
  ]);

  const user = userRows[0] || {};
  const goal = goalRows[0] || null;
  const goalTotal = Number(contribRows[0]?.total || 0);
  const checkin = checkinRows[0] || null;
  const training = trainingRows[0] || { count: 0, minutes: 0 };
  const outreachToday = Number(outreachRows[0]?.today_count || 0);

  // ── IDENTITY BLOCK ────────────────────────────────────────
  const identityBlock = agentConfig.identity;

  // ── RULES BLOCK (compressed) ──────────────────────────────
  const rulesBlock = agentConfig.rules
    .map(r => `${r.id}. **${r.rule}**: ${r.detail}`)
    .join('\n');

  // ── STATE BLOCK ───────────────────────────────────────────
  let stateBlock = 'No check-in today.';
  let routingMode = 'Steady';
  let routingNote = '';

  if (checkin) {
    const e = checkin.energy_level || 5;
    const g = checkin.gut_symptoms || 0;
    const s = checkin.sleep_hours || 7;
    const trainingDone = checkin.training_done ? 'yes' : 'no';

    if (e <= 4 || g >= 7 || s < 5) {
      routingMode = 'Recovery';
      routingNote = 'LOW ENERGY / POOR STATE — low-complexity tasks only (admin, comms, review)';
    } else if (e >= 8 && g <= 4 && s >= 7) {
      routingMode = 'Power';
      routingNote = 'HIGH ENERGY — deep work, architecture, hard problems available';
    } else {
      routingMode = 'Steady';
      routingNote = 'STEADY STATE — shipping, outreach, medium-complexity tasks';
    }

    stateBlock = `Energy: ${e}/10 | Sleep: ${s}h | Gut: ${g}/10 | Training today: ${trainingDone}
Training this week: ${training.count} sessions (${training.minutes || 0} min) ${training.count < 3 ? '⚠ BELOW 3/week target' : '✓ on target'}
Outreach today: ${outreachToday} action${outreachToday === 1 ? '' : 's'} ${outreachToday === 0 ? '— NOT DONE (Rule 2: mandatory every day)' : '✓ done'}
Mode: **${routingMode}** — ${routingNote}`;
  } else {
    stateBlock = `No check-in logged today.
Training this week: ${training.count} sessions ${training.count < 3 ? '⚠ BELOW target' : '✓ on target'}
Outreach today: ${outreachToday} ${outreachToday === 0 ? '— NOT DONE (mandatory)' : '✓ done'}`;
  }

  // ── GOAL BLOCK ────────────────────────────────────────────
  let goalBlock = 'No active goal set.';
  if (goal) {
    const pct = goal.target_amount > 0 ? Math.round(goalTotal / goal.target_amount * 100) : 0;
    const curr = goal.currency === 'USD' ? '$' : goal.currency === 'EUR' ? '€' : '£';
    goalBlock = `${goal.title}: ${curr}${goalTotal} / ${curr}${goal.target_amount} (${pct}%)`;
  }

  // ── PROJECTS BLOCK (compressed, priority order) ───────────
  const projectLines = projectRows.map(p => {
    const blockers = (() => {
      try { return JSON.parse(p.blockers || '[]'); } catch { return []; }
    })();
    const tags = (() => {
      try { return JSON.parse(p.tags || '[]'); } catch { return []; }
    })();
    const parts = [
      `#${p.priority} ${p.emoji || ''} ${p.name}`,
      `phase:${p.phase}`,
      `health:${p.health}`,
      p.revenue_ready ? '💰revenue-ready' : '',
      `next→${p.next_action || 'none'}`,
      blockers.length > 0 ? `BLOCKED:${blockers.slice(0, 2).join('; ')}` : '',
      tags.length > 0 ? `tags:${tags.slice(0, 3).join(',')}` : '',
    ].filter(Boolean);
    return parts.join(' | ');
  });
  const projectsBlock = projectLines.join('\n');

  // ── SESSIONS BLOCK ────────────────────────────────────────
  let sessionsBlock = 'No recent sessions.';
  if (sessionRows.length > 0) {
    sessionsBlock = sessionRows.map(s => {
      const mins = Math.round((s.duration_s || 0) / 60);
      const date = s.ended_at ? String(s.ended_at).slice(0, 10) : '?';
      const log = (s.log || '').slice(0, 80);
      return `${date} | ${s.project_name || 'unknown'} | ${mins}min | ${log}`;
    }).join('\n');
  }

  // ── DRIFT DETECTION BLOCK ─────────────────────────────────
  const driftFlags = [];
  
  // Training deficit: <3 sessions/week for 2 weeks
  const trainingByWeek = {};
  for (const row of driftTrainingRows) {
    const d = new Date(row.date);
    const day = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - day + 1);
    const weekKey = monday.toISOString().split('T')[0];
    trainingByWeek[weekKey] = (trainingByWeek[weekKey] || 0) + 1;
  }
  const weekKeys = Object.keys(trainingByWeek).sort().slice(-2);
  if (weekKeys.length >= 2) {
    const w1 = trainingByWeek[weekKeys[0]] || 0;
    const w2 = trainingByWeek[weekKeys[1]] || 0;
    if (w1 < 3 && w2 < 3) {
      driftFlags.push(`TRAINING DEFICIT: ${w1} this week, ${w2} last week (target: 3/week)`);
    }
  }
  
  // Outreach gap: 0 for 5+ days
  const uniqueOutreachDays = new Set(driftOutreachRows.map(r => r.date)).size;
  if (uniqueOutreachDays === 0) {
    driftFlags.push('OUTREACH GAP: No outreach for 5+ days (mandatory daily minimum)');
  }
  
  // Energy decline over 7 days
  const sevenDayCheckins = driftCheckinRows.filter(r => r.energy_level != null && r.date >= weekAgo);
  if (sevenDayCheckins.length >= 3) {
    const mid = Math.floor(sevenDayCheckins.length / 2);
    const first = sevenDayCheckins.slice(0, mid).reduce((s, r) => s + r.energy_level, 0) / mid;
    const second = sevenDayCheckins.slice(mid).reduce((s, r) => s + r.energy_level, 0) / (sevenDayCheckins.length - mid);
    if (second < first - 1) {
      driftFlags.push(`ENERGY DECLINE: ${first.toFixed(1)} → ${second.toFixed(1)} over last 7 days`);
    }
  }
  
  // Session gap: no sessions for 3+ days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentSessions = driftSessionRows.filter(r => r.ended_at && r.ended_at >= threeDaysAgo + ' 00:00:00');
  if (recentSessions.length === 0) {
    const last = driftSessionRows[0];
    const daysSince = last ? Math.floor((Date.now() - new Date(last.ended_at).getTime()) / (24 * 60 * 60 * 1000)) : 14;
    driftFlags.push(`SESSION GAP: No work logged for ${daysSince} days`);
  }
  
  // Stagnant project: 14+ days focus, no health improvement
  const sessionsByProj = {};
  for (const row of driftSessionRows) {
    sessionsByProj[row.project_id] = (sessionsByProj[row.project_id] || 0) + 1;
  }
  let primaryPid = null, primaryCount = 0;
  for (const [pid, count] of Object.entries(sessionsByProj)) {
    if (count > primaryCount) { primaryCount = count; primaryPid = pid; }
  }
  if (primaryPid && primaryCount >= 3) {
    const proj = projectRows.find(p => p.id === primaryPid);
    if (proj && proj.health < 60) {
      driftFlags.push(`STAGNANT PROJECT: ${proj.name} stuck at health ${proj.health} (${primaryCount} sessions, no improvement)`);
    }
  }
  
  const driftBlock = driftFlags.length > 0 
    ? driftFlags.join('\n') 
    : 'No drift detected — patterns on track.';

  // ── ASSEMBLE PROMPT ───────────────────────────────────────
  const prompt = `${identityBlock}

## Operator
Name: ${user.name || 'Builder'} | Monthly target: ${user.currency || '£'}${user.monthly_target || 3000}

## Enforcement Rules
${rulesBlock}

## Today's State
${stateBlock}

## Drift Detection
${driftBlock}

## Active Goal
${goalBlock}

## Projects (priority order)
${projectsBlock}

## Recent Sessions
${sessionsBlock}`;

  // Token budget check — truncate projects if over budget
  const estimated = estimateTokens(prompt);
  if (estimated > agentConfig.token_budget) {
    // Trim to first 6 projects
    const trimmedProjects = projectLines.slice(0, 6).join('\n') + '\n[...truncated to fit token budget]';
    return `${identityBlock}

## Operator
Name: ${user.name || 'Builder'} | Monthly target: ${user.currency || '£'}${user.monthly_target || 3000}

## Enforcement Rules
${rulesBlock}

## Today's State
${stateBlock}

## Drift Detection
${driftBlock}

## Active Goal
${goalBlock}

## Projects (priority order, top 6)
${trimmedProjects}

## Recent Sessions
${sessionsBlock}`;
  }

  return prompt;
}

// ── HANDLER ───────────────────────────────────────────────────
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  const { prompt, system } = req.body || {};
  if (!prompt) return err(res, 'prompt required');

  if (!ANTHROPIC_API_KEY) return err(res, 'AI provider not configured', 500);

  // Rate limiting
  if (!global.aiRateLimit) global.aiRateLimit = {};
  const now = Date.now();
  const userLimit = global.aiRateLimit[auth.userId] || { count: 0, reset: now + 60000 };
  if (now > userLimit.reset) { userLimit.count = 0; userLimit.reset = now + 60000; }
  if (userLimit.count >= 10) {
    return res.status(429).json({ error: 'Rate limited. Try again in a minute.' });
  }
  userLimit.count++;
  global.aiRateLimit[auth.userId] = userLimit;

  // Build system prompt — server-side if no override provided
  let systemPrompt = system || null;
  let db = null;
  if (!systemPrompt) {
    try {
      db = await getDb();
      systemPrompt = await buildSystemPrompt(auth.userId, db);
    } catch (e) {
      console.error('[AI] Failed to build system prompt from DB:', e.message);
      // Fallback to minimal prompt rather than failing
      systemPrompt = agentConfig.identity + '\n\n## Rules\n' +
        agentConfig.rules.map(r => `${r.id}. ${r.rule}: ${r.detail}`).join('\n');
    } finally {
      if (db) db.end().catch(() => {});
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: agentConfig.model,
        max_tokens: agentConfig.max_response_tokens,
        system: systemPrompt ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] : undefined,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return err(res, data.error?.message || 'AI Proxy Error', response.status);
    }

    const { usage } = data;
    const tokenEstimate = systemPrompt ? estimateTokens(systemPrompt) : 0;
    console.log(`[AI] user=${auth.userId} sys_est=${tokenEstimate}tok input=${usage?.input_tokens} output=${usage?.output_tokens} cache_create=${usage?.cache_creation_input_tokens||0} cache_read=${usage?.cache_read_input_tokens||0}`);

    return res.status(200).json(data);
  } catch (e) {
    console.error('AI error:', e);
    return err(res, 'Server error', 500);
  }
}
