// api/agents.js — Agent Task Execution (Phase 5.6)
// Executes tasks assigned to AI agents with mode-aware behavior

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Vercel Pro: allow up to 60s for agent execution
export const config = { maxDuration: 60 };

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

// ── PROVIDER ADAPTERS (subset from ai.js) ───────────────────────
const ENV_API_KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  moonshot: process.env.MOONSHOT_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  openai: process.env.OPENAI_API_KEY,
};

const PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    formatRequest: (systemPrompt, userPrompt, model, temperature, maxTokens) => ({
      model: model || 'claude-sonnet-4-6',
      max_tokens: maxTokens || 2000,
      temperature: temperature || 0.7,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    parseResponse: (data) => ({
      content: data.content?.[0]?.text || '',
      usage: {
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
      },
    }),
    parseError: (data) => data.error?.message || 'Anthropic API Error',
    pricing: { input: 3.00, output: 15.00 },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
    formatRequest: (systemPrompt, userPrompt, model, temperature, maxTokens) => ({
      model: model || 'gpt-4o-mini',
      max_tokens: maxTokens || 2000,
      temperature: temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 },
    }),
    parseError: (data) => data.error?.message || 'OpenAI API Error',
    pricing: { input: 0.15, output: 0.60 },
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    headers: (apiKey) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }),
    formatRequest: (systemPrompt, userPrompt, model, temperature, maxTokens) => ({
      model: model || 'deepseek-chat',
      max_tokens: maxTokens || 2000,
      temperature: temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userPrompt },
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: { input_tokens: data.usage?.prompt_tokens || 0, output_tokens: data.usage?.completion_tokens || 0 },
    }),
    parseError: (data) => data.error?.message || 'DeepSeek API Error',
    pricing: { input: 0.14, output: 0.28 },
  },
};

// ── AGENT FILE LOADER ───────────────────────────────────────────
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatter = {};
  let currentKey = null;
  let currentList = null;

  for (const line of match[1].split('\n')) {
    const listMatch = line.match(/^  - (.+)$/);
    if (listMatch && currentKey) {
      if (!currentList) { currentList = []; frontmatter[currentKey] = currentList; }
      currentList.push(listMatch[1]);
      continue;
    }
    const nested = line.match(/^  ([a-z_]+):\s*(.+)$/);
    if (nested && currentKey) {
      if (typeof frontmatter[currentKey] !== 'object' || Array.isArray(frontmatter[currentKey])) {
        frontmatter[currentKey] = {};
      }
      frontmatter[currentKey][nested[1]] = nested[2].replace(/^["']|["']$/g, '');
      currentList = null;
      continue;
    }
    const keyMatch = line.match(/^([a-z_]+):\s*(.+)?$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      currentList = null;
      const value = keyMatch[2];
      if (value) {
        const num = parseFloat(value);
        frontmatter[currentKey] = isNaN(num) ? value : num;
      } else {
        frontmatter[currentKey] = true;
      }
    }
  }

  return { frontmatter, body: match[2].trim() };
}

function loadAgentDefinition(agentId, projectId) {
  // Try system agents first, then project agents (forward-compatible)
  const agentsDir = join(__dirname, '..', 'public', 'agents');
  const paths = [
    join(agentsDir, `system-${agentId}.md`),
    join(agentsDir, `${agentId}.md`),
  ];

  // Forward-compatible: project-specific agents will live in project folders
  // when loadProjectAgents is implemented
  if (projectId) {
    paths.push(join(agentsDir, `project-${projectId}-${agentId}.md`));
  }

  for (const p of paths) {
    try {
      const content = readFileSync(p, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);
      return { ...frontmatter, prompt_prefix: body, file_path: p };
    } catch {
      // File not found, try next path
    }
  }
  return null;
}

// ── PROMPT BUILDER ──────────────────────────────────────────────
function buildAgentPrompt(agent, task, projectContext, fileSummaries) {
  const parts = [agent.prompt_prefix || '', '', '---', ''];

  if (projectContext) {
    parts.push(`PROJECT: ${projectContext.name}`);
    if (projectContext.phase) parts.push(`PHASE: ${projectContext.phase}`);
    parts.push('');
  }

  parts.push(`TASK: ${task.title}`);
  if (task.priority) parts.push(`PRIORITY: ${task.priority}`);
  parts.push('');

  if (fileSummaries && fileSummaries.length > 0) {
    parts.push('PROJECT CONTEXT:');
    for (const s of fileSummaries.slice(0, 10)) {
      parts.push(`- ${s.file_path}: ${s.l0_abstract || s.l1_overview?.slice(0, 200) || 'no summary'}`);
    }
    parts.push('');
  }

  parts.push('YOUR TASK:');
  parts.push(task.description || 'Complete the assigned work.');
  parts.push('');
  parts.push('Begin.');

  return parts.join('\n');
}

// ── AI CALL ─────────────────────────────────────────────────────
async function callAI(provider, apiKey, systemPrompt, userPrompt, model, temperature) {
  const providerConfig = PROVIDERS[provider] || PROVIDERS.anthropic;
  const key = apiKey || ENV_API_KEYS[provider] || ENV_API_KEYS.anthropic;

  if (!key) throw new Error(`No API key for provider: ${provider}`);

  const body = providerConfig.formatRequest(systemPrompt, userPrompt, model, temperature, 2000);
  const response = await fetch(providerConfig.baseUrl, {
    method: 'POST',
    headers: providerConfig.headers(key),
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(providerConfig.parseError(data));
  }

  return providerConfig.parseResponse(data);
}

// ── COST CALCULATION ────────────────────────────────────────────
function calculateCost(provider, usage) {
  const config = PROVIDERS[provider] || PROVIDERS.anthropic;
  const input = (usage.input_tokens || 0) / 1_000_000 * config.pricing.input;
  const output = (usage.output_tokens || 0) / 1_000_000 * config.pricing.output;
  return Math.round((input + output) * 10000) / 10000;
}

// ── MAIN HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = getAuth(req);
  if (!auth) return err(res, 'Unauthorized', 401);

  const action = req.query.action || req.body?.action;
  let db;

  try {
    db = await getDb();

    if (action === 'status' && req.method === 'GET') {
      // ── STATUS: Get task execution status ───────────────────
      const taskId = req.query.task_id;
      if (!taskId) return err(res, 'task_id required');

      const [rows] = await db.execute(
        'SELECT id, title, status, assignee_type, assignee_id, result_summary, assignee_context FROM tasks WHERE id = ? AND project_id IN (SELECT id FROM projects WHERE user_id = ?)',
        [taskId, auth.userId]
      );
      if (!rows[0]) return err(res, 'Task not found', 404);

      const task = rows[0];
      const context = (() => { try { return JSON.parse(task.assignee_context || '{}'); } catch { return {}; } })();

      return res.status(200).json({
        success: true,
        task_id: task.id,
        status: task.status,
        result_summary: task.result_summary,
        cost: context.execution_cost,
      });
    }

    if (action === 'execute' && req.method === 'POST') {
      const { task_id } = req.body;
      const confirmed = req.query.confirmed === 'true' || req.body.confirmed;
      if (!task_id) return err(res, 'task_id required');

      // Load task
      const [taskRows] = await db.execute(
        'SELECT t.*, p.name as project_name, p.phase as project_phase, p.user_id FROM tasks t LEFT JOIN projects p ON t.project_id = p.id WHERE t.id = ?',
        [task_id]
      );
      const task = taskRows[0];
      if (!task) return err(res, 'Task not found', 404);
      if (task.user_id !== auth.userId) return err(res, 'Unauthorized', 403);
      if (task.assignee_type !== 'agent') return err(res, 'Task not assigned to agent');

      // Load user settings for mode check
      const [userRows] = await db.execute('SELECT settings FROM users WHERE id = ?', [auth.userId]);
      const userSettings = (() => { try { return JSON.parse(userRows[0]?.settings || '{}'); } catch { return {}; } })();
      const mode = userSettings.assistance_mode || 'coach';

      // Mode-aware trigger behavior
      const MODE_TRIGGER = { coach: 'auto', assistant: 'preview', silent: 'manual' };
      const triggerBehavior = MODE_TRIGGER[mode] || 'auto';

      if (triggerBehavior === 'manual' && !confirmed) {
        return err(res, 'Silent mode: use manual execution', 403);
      }

      // Load agent definition
      const agent = loadAgentDefinition(task.assignee_id, task.project_id);
      if (!agent) return err(res, `Agent not found: ${task.assignee_id}`, 404);

      // Preview mode (assistant): return prompt for confirmation
      if (triggerBehavior === 'preview' && !confirmed) {
        // Load context for prompt preview
        const [summaryRows] = await db.execute(
          'SELECT file_path, l0_abstract, l1_overview FROM file_summaries WHERE project_id = ? LIMIT 10',
          [task.project_id || '']
        );

        const prompt = buildAgentPrompt(
          agent,
          task,
          { name: task.project_name, phase: task.project_phase },
          summaryRows
        );

        // Store preview in task context
        await db.execute(
          'UPDATE tasks SET status = ?, assignee_context = ? WHERE id = ?',
          ['review', JSON.stringify({ preview_prompt: prompt, agent_model: agent.model, agent_temperature: agent.temperature }), task_id]
        );

        return res.status(200).json({
          success: true,
          task_id,
          status: 'preview',
          prompt,
          agent: { name: agent.name, model: agent.model, temperature: agent.temperature },
        });
      }

      // ── EXECUTE ─────────────────────────────────────────────
      // Update status to executing
      await db.execute('UPDATE tasks SET status = ? WHERE id = ?', ['in_progress', task_id]);

      // Load project file summaries for context
      const [summaryRows] = await db.execute(
        'SELECT file_path, l0_abstract, l1_overview FROM file_summaries WHERE project_id = ? LIMIT 10',
        [task.project_id || '']
      );

      const systemPrompt = buildAgentPrompt(
        agent,
        task,
        { name: task.project_name, phase: task.project_phase },
        summaryRows
      );

      // Determine provider — agent model maps to provider
      const agentModel = agent.model || 'claude-sonnet-4-6';
      let provider = 'anthropic';
      if (agentModel.startsWith('gpt') || agentModel.startsWith('o1')) provider = 'openai';
      else if (agentModel.startsWith('deepseek')) provider = 'deepseek';
      else if (agentModel.startsWith('moonshot')) provider = 'moonshot';

      // Check for user API key
      const [aiSettingsRows] = await db.execute(
        'SELECT api_key_encrypted FROM user_ai_settings WHERE user_id = ? AND provider = ?',
        [auth.userId, provider]
      );
      const userApiKey = aiSettingsRows[0]?.api_key_encrypted || null;

      try {
        const result = await callAI(
          provider,
          userApiKey,
          systemPrompt,
          task.description || task.title,
          agentModel,
          agent.temperature || 0.7
        );

        const cost = calculateCost(provider, result.usage);

        // Update task as complete
        await db.execute(
          'UPDATE tasks SET status = ?, result_summary = ?, assignee_context = ? WHERE id = ?',
          ['complete', result.content.slice(0, 10000), JSON.stringify({
            execution_cost: cost,
            tokens: result.usage,
            model: agentModel,
            provider,
          }), task_id]
        );

        // Log AI usage
        const today = new Date().toISOString().split('T')[0];
        await db.execute(
          `INSERT INTO ai_usage (id, user_id, date, input_tokens, output_tokens, estimated_cost_usd, model)
           VALUES (UUID(), ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE input_tokens = input_tokens + VALUES(input_tokens),
           output_tokens = output_tokens + VALUES(output_tokens),
           estimated_cost_usd = estimated_cost_usd + VALUES(estimated_cost_usd)`,
          [auth.userId, today, result.usage.input_tokens, result.usage.output_tokens, cost, agentModel]
        );

        return res.status(200).json({
          success: true,
          task_id,
          status: 'complete',
          result_summary: result.content.slice(0, 2000),
          cost,
        });

      } catch (execError) {
        // Execution failed — mark blocked
        await db.execute(
          'UPDATE tasks SET status = ?, assignee_context = ? WHERE id = ?',
          ['blocked', JSON.stringify({ error: execError.message, blocked_at: new Date().toISOString() }), task_id]
        );

        // Check handoff rules — escalate to human if configured
        if (agent.handoff_rules?.on_error === 'escalate_to_human') {
          const escalationId = `esc-${Date.now()}`;
          await db.execute(
            `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_type, created_at)
             VALUES (?, ?, ?, ?, 'pending', ?, 'human', NOW())`,
            [
              escalationId,
              task.project_id,
              `[Escalated] ${task.title}`,
              `Agent ${agent.name} failed: ${execError.message}\n\nOriginal task: ${task.description}`,
              task.priority || 'medium',
            ]
          );
        }

        return res.status(200).json({
          success: false,
          task_id,
          status: 'blocked',
          error: execError.message,
          escalated: agent.handoff_rules?.on_error === 'escalate_to_human',
        });
      }
    }

    return err(res, `Unknown action: ${action}`);

  } catch (e) {
    console.error('[AgentExec]', e);
    return res.status(500).json({ error: e.message, headers: CORS });
  } finally {
    if (db) await db.end();
  }
}
