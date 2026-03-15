// api/ai.js — Multi-Provider AI Proxy with User Configuration
// Supports: Anthropic (Claude), Moonshot AI (Kimi), DeepSeek, Mistral, OpenAI

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const agentConfig = require('../agent-config.json');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Environment fallbacks for server-side defaults (user keys take precedence)
const ENV_API_KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  moonshot: process.env.MOONSHOT_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  openai: process.env.OPENAI_API_KEY,
};

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

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// ── USER AI SETTINGS ──────────────────────────────────────────
async function getUserAISettings(db, userId) {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM user_ai_settings WHERE user_id = ?',
      [userId]
    );
    if (rows.length > 0) return rows[0];
    return {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0.7,
      enabled: 1,
    };
  } catch (e) {
    console.error('[AI] Failed to get user AI settings:', e.message);
    return null;
  }
}

// ── PROVIDER ADAPTERS ─────────────────────────────────────────
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'prompt-caching-2024-07-31',
    }),
    formatRequest: (systemPrompt, userPrompt, settings) => ({
      model: settings.model || 'claude-sonnet-4-6',
      max_tokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      system: systemPrompt ? [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }] : undefined,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    parseResponse: (data) => ({
      content: data.content?.[0]?.text || '',
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        cache_creation_input_tokens: data.usage?.cache_creation_input_tokens || 0,
        cache_read_input_tokens: data.usage?.cache_read_input_tokens || 0,
      },
      model: data.model,
    }),
    parseError: (data) => data.error?.message || 'Anthropic API Error',
    pricing: { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 },
  },

  moonshot: {
    name: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, userPrompt, settings) => ({
      model: settings.model || 'moonshot-v1-8k',
      max_tokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: data.model,
    }),
    parseError: (data) => data.error?.message || 'Moonshot API Error',
    pricing: { input: 1.00, output: 2.00, cacheWrite: 0, cacheRead: 0 },
  },

  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, userPrompt, settings) => ({
      model: settings.model || 'deepseek-chat',
      max_tokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: data.model,
    }),
    parseError: (data) => data.error?.message || 'DeepSeek API Error',
    pricing: { input: 0.14, output: 0.28, cacheWrite: 0, cacheRead: 0 },
  },

  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, userPrompt, settings) => ({
      model: settings.model || 'mistral-medium',
      max_tokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: data.model,
    }),
    parseError: (data) => data.error?.message || 'Mistral API Error',
    pricing: { input: 0.50, output: 1.50, cacheWrite: 0, cacheRead: 0 },
  },

  openai: {
    name: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, userPrompt, settings) => ({
      model: settings.model || 'gpt-4o',
      max_tokens: settings.max_tokens || 1000,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
      model: data.model,
    }),
    parseError: (data) => data.error?.message || 'OpenAI API Error',
    pricing: { input: 2.50, output: 10.00, cacheWrite: 0, cacheRead: 0 },
  },
};

// ── URI GENERATION HELPERS ────────────────────────────────────
function projectURI(projectId) {
  return `brain://project/${projectId}`;
}

function fileURI(projectId, filePath) {
  const normalizedPath = filePath.replace(/^\//, '').replace(/\\/g, '/');
  return `brain://project/${projectId}/file/${normalizedPath}`;
}

function goalURI(goalId) {
  return `brain://goal/${goalId}`;
}

// ── SYSTEM PROMPT BUILDER ─────────────────────────────────────
async function buildSystemPrompt(userId, db) {
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
    db.execute('SELECT name, email, monthly_target, currency, goal, settings FROM users WHERE id = ?', [userId]),
    db.execute('SELECT id, title, target_amount, current_amount, currency, status FROM goals WHERE user_id = ? AND status = ? LIMIT 1', [userId, 'active']),
    db.execute('SELECT SUM(amount) as total FROM goal_contributions WHERE goal_id IN (SELECT id FROM goals WHERE user_id = ? AND status = ?)', [userId, 'active']),
    db.execute('SELECT * FROM daily_checkins WHERE user_id = ? AND date = ?', [userId, today]),
    db.execute('SELECT COUNT(*) as count, SUM(duration_minutes) as minutes FROM training_logs WHERE user_id = ? AND date >= ?', [userId, weekAgo]),
    db.execute('SELECT COUNT(*) as today_count FROM outreach_log WHERE user_id = ? AND date = ?', [userId, today]),
    db.execute('SELECT id, name, phase, health, momentum, priority, revenue_ready, next_action, blockers, tags, income_target, emoji FROM projects WHERE user_id = ? ORDER BY priority ASC LIMIT 12', [userId]),
    db.execute('SELECT s.project_id, p.name as project_name, s.duration_s, s.log, s.ended_at FROM sessions s LEFT JOIN projects p ON p.id = s.project_id WHERE s.user_id = ? ORDER BY s.ended_at DESC LIMIT 3', [userId]),
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

  // Mode-aware prompt (Phase 6.1)
  const userSettingsParsed = (() => { try { return JSON.parse(user.settings || '{}'); } catch { return {}; } })();
  const assistanceMode = userSettingsParsed.assistance_mode || 'coach';

  let identityBlock, rulesBlock;
  if (assistanceMode === 'silent') {
    identityBlock = 'You are a concise project management assistant. Answer questions directly with minimal commentary.';
    rulesBlock = 'Respond factually. No coaching. No motivational language. Keep answers short.';
  } else if (assistanceMode === 'assistant') {
    identityBlock = agentConfig.identity.replace(/drill sergeant|military|tough love/gi, 'helpful partner');
    rulesBlock = agentConfig.rules
      .filter(r => !['outreach_mandatory', 'training_mandatory'].includes(r.id))
      .map(r => `${r.id}. **${r.rule}**: ${r.detail}`)
      .join('\n');
  } else {
    identityBlock = agentConfig.identity;
    rulesBlock = agentConfig.rules.map(r => `${r.id}. **${r.rule}**: ${r.detail}`).join('\n');
  }

  let stateBlock = 'No check-in today.';
  let routingMode = 'Steady';
  if (checkin) {
    const e = checkin.energy_level || 5;
    const g = checkin.gut_symptoms || 0;
    const s = checkin.sleep_hours || 7;
    const trainingDone = checkin.training_done ? 'yes' : 'no';

    if (e <= 4 || g >= 7 || s < 5) routingMode = 'Recovery';
    else if (e >= 8 && g <= 4 && s >= 7) routingMode = 'Power';

    stateBlock = `Energy: ${e}/10 | Sleep: ${s}h | Gut: ${g}/10 | Training: ${trainingDone}
Training: ${training.count} sessions (${training.minutes || 0} min) ${training.count < 3 ? '⚠ BELOW target' : '✓ on target'}
Outreach: ${outreachToday} ${outreachToday === 0 ? '— NOT DONE' : '✓ done'}
Mode: ${routingMode}`;
  }

  let goalBlock = 'No active goal.';
  if (goal) {
    const pct = goal.target_amount > 0 ? Math.round(goalTotal / goal.target_amount * 100) : 0;
    const curr = goal.currency === 'USD' ? '$' : goal.currency === 'EUR' ? '€' : '£';
    goalBlock = `${goal.title}: ${curr}${goalTotal} / ${curr}${goal.target_amount} (${pct}%) | ${goalURI(goal.id)}`;
  }

  const projectLines = projectRows.map(p => {
    const blockers = (() => { try { return JSON.parse(p.blockers || '[]'); } catch { return []; } })();
    const uri = projectURI(p.id);
    return `#${p.priority} ${p.emoji || ''} ${p.name} | phase:${p.phase} | health:${p.health} ${p.revenue_ready ? '💰revenue' : ''} | →${p.next_action || 'none'} ${blockers.length > 0 ? `BLOCKED:${blockers.slice(0, 2).join(';')}` : ''} | ${uri}`;
  });

  let sessionsBlock = 'No recent sessions.';
  if (sessionRows.length > 0) {
    sessionsBlock = sessionRows.map(s => {
      const mins = Math.round((s.duration_s || 0) / 60);
      const date = s.ended_at ? String(s.ended_at).slice(0, 10) : '?';
      return `${date} | ${s.project_name || 'unknown'} | ${mins}min`;
    }).join('\n');
  }

  const driftFlags = [];
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
    if (w1 < 3 && w2 < 3) driftFlags.push(`TRAINING DEFICIT: ${w1} this week, ${w2} last week`);
  }
  const uniqueOutreachDays = new Set(driftOutreachRows.map(r => r.date)).size;
  if (uniqueOutreachDays === 0) driftFlags.push('OUTREACH GAP: No outreach for 5+ days');

  const driftBlock = driftFlags.length > 0 ? driftFlags.join('\n') : 'No drift detected.';

  const uriInstructions = `## Resource References (brain:// URIs)
You can reference any project, file, goal, or resource using brain:// URIs:
- Project: brain://project/{id} (e.g., ${projectRows[0] ? projectURI(projectRows[0].id) : 'brain://project/my-app'})
- File: brain://project/{id}/file/{path} (e.g., brain://project/my-app/file/README.md)
- Goal: brain://goal/{id}
- Agent: brain://agent/{dev|content|strategy|design|research}

Use URIs when:
- Referencing specific projects or files in your response
- Suggesting the user check a particular document
- Creating tasks that need context

The user can click these URIs to navigate directly to the resource.`;

  if (assistanceMode === 'silent') {
    return `${identityBlock}

## Operator
Name: ${user.name || 'Builder'}

## Projects
${projectLines.join('\n')}

${goal ? `## Goal\n${goalBlock}` : ''}

${uriInstructions}`;
  }

  return `${identityBlock}

## Operator
Name: ${user.name || 'Builder'} | Target: ${user.currency || '£'}${user.monthly_target || 3000}

## Rules
${rulesBlock}

## State
${stateBlock}
${assistanceMode === 'assistant' ? '' : `\n## Drift\n${driftBlock}`}

## Goal
${goalBlock}

## Projects
${projectLines.join('\n')}

## Sessions
${sessionsBlock}

${uriInstructions}`;
}

// ── USAGE LOGGING ──────────────────────────────────────────────
async function logAIUsage(db, userId, provider, usage, model) {
  if (!db || !usage) return;
  try {
    const today = new Date().toISOString().split('T')[0];
    const providerConfig = PROVIDERS[provider] || PROVIDERS.anthropic;
    const pricing = providerConfig.pricing;

    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheCreateTokens = usage.cache_creation_input_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;

    const regularInput = Math.max(0, inputTokens - cacheCreateTokens - cacheReadTokens);
    const costUsd = (
      (regularInput / 1000000) * pricing.input +
      (outputTokens / 1000000) * pricing.output +
      (cacheCreateTokens / 1000000) * (pricing.cacheWrite || pricing.input) +
      (cacheReadTokens / 1000000) * (pricing.cacheRead || pricing.input * 0.5)
    );

    await db.execute(
      `INSERT INTO ai_usage (user_id, date, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, estimated_cost_usd, model, request_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
       input_tokens = input_tokens + VALUES(input_tokens),
       output_tokens = output_tokens + VALUES(output_tokens),
       cache_creation_input_tokens = cache_creation_input_tokens + VALUES(cache_creation_input_tokens),
       cache_read_input_tokens = cache_read_input_tokens + VALUES(cache_read_input_tokens),
       estimated_cost_usd = estimated_cost_usd + VALUES(estimated_cost_usd),
       request_count = request_count + 1,
       model = VALUES(model),
       updated_at = NOW()`,
      [userId, today, inputTokens, outputTokens, cacheCreateTokens, cacheReadTokens, costUsd, model]
    );

    console.log(`[AI] ${provider} usage: $${costUsd.toFixed(4)}`);
  } catch (e) {
    console.error('[AI] Failed to log usage:', e.message);
  }
}

// ── MAIN HANDLER ───────────────────────────────────────────────
export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return err(res, 'Method not allowed', 405);

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorised', 401);

  const { prompt, system, provider: requestedProvider } = req.body || {};
  if (!prompt) return err(res, 'prompt required');

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

  let db;
  try {
    db = await getDb();

    const userSettings = await getUserAISettings(db, auth.userId);
    const providerKey = requestedProvider || userSettings?.provider || 'anthropic';
    const provider = PROVIDERS[providerKey];

    if (!provider) {
      return err(res, `Unknown provider: ${providerKey}. Available: ${Object.keys(PROVIDERS).join(', ')}`, 400);
    }

    // Get API key: user setting first, then env fallback
    let apiKey = userSettings?.api_key_encrypted;
    if (apiKey && apiKey.startsWith('enc:')) {
      apiKey = Buffer.from(apiKey.slice(4), 'base64').toString();
    }
    if (!apiKey) apiKey = ENV_API_KEYS[providerKey];

    if (!apiKey) {
      return err(res, `No API key for ${provider.name}. Add it in Settings > AI.`, 400);
    }

    // Build system prompt
    let systemPrompt = system || null;
    if (!systemPrompt) {
      try {
        systemPrompt = await buildSystemPrompt(auth.userId, db);
      } catch (e) {
        systemPrompt = agentConfig.identity + '\n\n## Rules\n' + agentConfig.rules.map(r => `${r.id}. ${r.rule}`).join('\n');
      }
    }

    // Format and send request
    const requestBody = provider.formatRequest(systemPrompt, prompt, userSettings);

    const response = await fetch(provider.baseUrl, {
      method: 'POST',
      headers: provider.headers(apiKey),
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[AI] ${providerKey} error:`, data);
      return err(res, provider.parseError(data), response.status);
    }

    const parsed = provider.parseResponse(data);
    await logAIUsage(db, auth.userId, providerKey, parsed.usage, parsed.model || requestBody.model);

    return res.status(200).json({
      content: [{ type: 'text', text: parsed.content }],
      usage: parsed.usage,
      model: parsed.model,
      provider: providerKey,
    });

  } catch (e) {
    console.error('[AI] Error:', e);
    return err(res, 'Server error', 500);
  } finally {
    if (db) await db.end().catch(() => {});
  }
}
