// api/agent-execute.js — Agent Execution with Function Calling (Phase 5.6)

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { createRequire } from 'module';
import { getCorsHeaders } from './_lib/cors.js';

const require = createRequire(import.meta.url);
const agentConfig = require('../agent-config.json');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is not set');

// CORS headers are set per-request via getCorsHeaders(req)

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

// Function definitions for the AI
const FUNCTION_DEFINITIONS = [
  {
    name: 'read_file',
    description:
      'Read the full content of a project file. Use this when you need to understand existing code, docs, or context.',
    parameters: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description:
            'The brain:// URI of the file to read (e.g., brain://project/my-app/file/README.md)',
        },
      },
      required: ['uri'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or update a project file. Use this to write code, docs, or any content to the project.',
    parameters: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description:
            'The brain:// URI of the file to write (e.g., brain://project/my-app/file/README.md)',
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file',
        },
        mode: {
          type: 'string',
          enum: ['create', 'update', 'preview'],
          description:
            'Mode: create (new file), update (modify existing), preview (show changes without applying)',
          default: 'create',
        },
      },
      required: ['uri', 'content'],
    },
  },
  {
    name: 'create_task',
    description:
      'Create a new task for yourself, another human, or an agent. Use this to delegate work or break down larger work.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the task',
        },
        description: {
          type: 'string',
          description: 'Detailed description of what needs to be done',
        },
        project_id: {
          type: 'string',
          description: 'Project ID this task belongs to (optional)',
        },
        priority: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Priority level',
          default: 'medium',
        },
        assignee_type: {
          type: 'string',
          enum: ['human', 'agent'],
          description: 'Who should do this task',
          default: 'human',
        },
        assignee_id: {
          type: 'string',
          description:
            'Agent ID if assignee_type is agent (e.g., system-dev-v1)',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'search_projects',
    description:
      'Search across all projects for files containing specific content or patterns. Use this to find context.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - keywords or patterns to search for',
        },
        project_id: {
          type: 'string',
          description: 'Limit search to specific project (optional)',
        },
        file_type: {
          type: 'string',
          description: 'Filter by file extension (e.g., md, js, json)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'mark_complete',
    description:
      'Mark your assigned task as complete with a summary of what was done and any outputs created.',
    parameters: {
      type: 'object',
      properties: {
        task_id: {
          type: 'integer',
          description: 'The ID of the task to mark complete',
        },
        summary: {
          type: 'string',
          description: 'Summary of what was accomplished',
        },
        outputs: {
          type: 'array',
          items: { type: 'string' },
          description:
            'List of brain:// URIs of files or resources created/modified',
        },
      },
      required: ['task_id', 'summary'],
    },
  },
  {
    name: 'request_review',
    description:
      'Request human review of work done. Use this when you need feedback or approval before proceeding.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Why you need review and what specifically to review',
        },
        urgency: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How urgently is review needed',
          default: 'medium',
        },
      },
      required: ['reason'],
    },
  },
];

// Provider adapters with tool support
const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1/messages',
    supportsTools: true,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }),
    formatRequest: (systemPrompt, messages, settings, tools) => ({
      model: settings.model || 'claude-sonnet-4-6',
      max_tokens: settings.max_tokens || 4096,
      temperature: settings.temperature || 0.7,
      system: systemPrompt,
      messages,
      tools: tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
    }),
    parseResponse: (data) => {
      const content = data.content || [];
      const textContent = content.find((c) => c.type === 'text');
      const toolUse = content.filter((c) => c.type === 'tool_use');

      return {
        content: textContent?.text || '',
        toolUse,
        usage: {
          input_tokens: data.usage?.input_tokens || 0,
          output_tokens: data.usage?.output_tokens || 0,
        },
        model: data.model,
        stopReason: data.stop_reason,
      };
    },
    getApiKey: (userSettings, envKeys) =>
      userSettings?.api_key || envKeys.anthropic,
  },

  openai: {
    name: 'OpenAI (GPT)',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    supportsTools: true,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, messages, settings, tools) => ({
      model: settings.model || 'gpt-4o',
      max_tokens: settings.max_tokens || 4096,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
      tools: tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    }),
    parseResponse: (data) => {
      const message = data.choices?.[0]?.message;
      return {
        content: message?.content || '',
        toolCalls: message?.tool_calls || [],
        usage: {
          input_tokens: data.usage?.prompt_tokens || 0,
          output_tokens: data.usage?.completion_tokens || 0,
        },
        model: data.model,
        stopReason: data.choices?.[0]?.finish_reason,
      };
    },
    getApiKey: (userSettings, envKeys) =>
      userSettings?.api_key || envKeys.openai,
  },

  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    supportsTools: false, // DeepSeek doesn't support tools yet
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, messages, settings) => ({
      model: settings.model || 'deepseek-chat',
      max_tokens: settings.max_tokens || 4096,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
      model: data.model,
    }),
    getApiKey: (userSettings, envKeys) =>
      userSettings?.api_key || envKeys.deepseek,
  },

  moonshot: {
    name: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1/chat/completions',
    supportsTools: false,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, messages, settings) => ({
      model: settings.model || 'moonshot-v1-8k',
      max_tokens: settings.max_tokens || 4096,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
      model: data.model,
    }),
    getApiKey: (userSettings, envKeys) =>
      userSettings?.api_key || envKeys.moonshot,
  },

  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1/chat/completions',
    supportsTools: true,
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }),
    formatRequest: (systemPrompt, messages, settings, tools) => ({
      model: settings.model || 'mistral-large',
      max_tokens: settings.max_tokens || 4096,
      temperature: settings.temperature || 0.7,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages,
      ],
      tools: tools?.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    }),
    parseResponse: (data) => ({
      content: data.choices?.[0]?.message?.content || '',
      toolCalls: data.choices?.[0]?.message?.tool_calls || [],
      usage: {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
      },
      model: data.model,
    }),
    getApiKey: (userSettings, envKeys) =>
      userSettings?.api_key || envKeys.mistral,
  },
};

const ENV_API_KEYS = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  moonshot: process.env.MOONSHOT_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY,
  mistral: process.env.MISTRAL_API_KEY,
  openai: process.env.OPENAI_API_KEY,
};

// Execute a function
async function executeFunction(fn, args, db, userId) {
  switch (fn) {
    case 'read_file': {
      const match = args.uri?.match(/^brain:\/\/project\/([^/]+)\/file\/(.+)$/);
      if (!match) return { success: false, error: 'Invalid file URI' };
      const [, projectId, filePath] = match;

      const [files] = await db.execute(
        `SELECT f.path, f.content FROM project_files f
         JOIN projects p ON f.project_id = p.id
         WHERE f.project_id = ? AND f.path = ? AND f.deleted_at IS NULL AND p.user_id = ?`,
        [projectId, filePath, userId]
      );

      if (files.length === 0) {
        // Try with leading slash
        const [files2] = await db.execute(
          `SELECT f.path, f.content FROM project_files f
           JOIN projects p ON f.project_id = p.id
           WHERE f.project_id = ? AND f.path = ? AND f.deleted_at IS NULL AND p.user_id = ?`,
          [projectId, '/' + filePath, userId]
        );
        if (files2.length === 0)
          return { success: false, error: `File not found: ${filePath}` };
        return {
          success: true,
          uri: args.uri,
          content: files2[0].content || '',
          size: (files2[0].content || '').length,
        };
      }

      return {
        success: true,
        uri: args.uri,
        content: files[0].content || '',
        size: (files[0].content || '').length,
      };
    }

    case 'write_file': {
      const match = args.uri?.match(/^brain:\/\/project\/([^/]+)\/file\/(.+)$/);
      if (!match) return { success: false, error: 'Invalid file URI' };
      const [, projectId, filePath] = match;

      if (args.mode === 'preview') {
        return {
          success: true,
          preview: true,
          uri: args.uri,
          proposedSize: args.content?.length || 0,
        };
      }

      // Verify project ownership
      const [projCheck] = await db.execute(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [projectId, userId]
      );
      if (projCheck.length === 0) return { success: false, error: 'Project not found or access denied' };

      // Check if file exists
      const [existing] = await db.execute(
        'SELECT id FROM project_files WHERE project_id = ? AND path = ? AND deleted_at IS NULL',
        [projectId, filePath]
      );

      if (existing.length === 0) {
        // Create new file
        const [result] = await db.execute(
          'INSERT INTO project_files (project_id, path, content, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [projectId, filePath, args.content]
        );
      } else {
        // Update existing
        await db.execute(
          'UPDATE project_files SET content = ?, updated_at = NOW() WHERE id = ?',
          [args.content, existing[0].id]
        );
      }

      return {
        success: true,
        uri: args.uri,
        action: existing.length > 0 ? 'updated' : 'created',
      };
    }

    case 'create_task': {
      if (args.project_id) {
        const [projCheck] = await db.execute(
          'SELECT id FROM projects WHERE id = ? AND user_id = ?',
          [args.project_id, userId]
        );
        if (projCheck.length === 0) return { success: false, error: 'Project not found or access denied' };
      }
      const [result] = await db.execute(
        `INSERT INTO tasks (user_id, project_id, title, description, priority, assignee_type, assignee_id, status, assigned_by, assignment_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'agent', ?, NOW())`,
        [
          userId,
          args.project_id || null,
          args.title,
          args.description,
          args.priority || 'medium',
          args.assignee_type || 'human',
          args.assignee_id || null,
          args.description,
        ]
      );

      return {
        success: true,
        task_id: result.insertId,
        title: args.title,
        status: 'pending',
      };
    }

    case 'search_projects': {
      const query = `%${args.query}%`;
      let sql = `SELECT p.id as project_id, p.name as project_name, f.path as file_path, f.content 
                 FROM project_files f JOIN projects p ON f.project_id = p.id 
                 WHERE f.deleted_at IS NULL AND p.user_id = ? AND (f.content LIKE ? OR f.path LIKE ?)`;
      const params = [userId, query, query];

      if (args.project_id) {
        sql += ' AND p.id = ?';
        params.push(args.project_id);
      }
      if (args.file_type) {
        sql += ' AND f.path LIKE ?';
        params.push(`%.${args.file_type}`);
      }

      sql += ' LIMIT 20';

      const [results] = await db.execute(sql, params);

      return {
        success: true,
        query: args.query,
        count: results.length,
        results: results.map((r) => ({
          projectId: r.project_id,
          projectName: r.project_name,
          filePath: r.file_path,
          excerpt: (r.content || '').substring(0, 200),
          uri: `brain://project/${r.project_id}/file/${r.file_path}`,
        })),
      };
    }

    case 'mark_complete': {
      await db.execute(
        'UPDATE tasks SET status = ?, completed_at = NOW(), result_summary = ? WHERE id = ? AND user_id = ?',
        ['complete', args.summary, args.task_id, userId]
      );
      return { success: true, task_id: args.task_id, status: 'complete' };
    }

    case 'request_review': {
      // Create a review task
      const [result] = await db.execute(
        `INSERT INTO tasks (user_id, title, description, priority, assignee_type, status, assigned_by, assignment_reason, created_at)
         VALUES (?, ?, ?, ?, 'human', 'pending', 'agent', ?, NOW())`,
        [
          userId,
          'Review Request',
          args.reason,
          args.urgency || 'medium',
          args.reason,
        ]
      );
      return {
        success: true,
        task_id: result.insertId,
        message: 'Review requested',
      };
    }

    default:
      return { success: false, error: `Unknown function: ${fn}` };
  }
}

// Get user AI settings
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
      max_tokens: 4096,
      temperature: 0.7,
      enabled: 1,
    };
  } catch (e) {
    return null;
  }
}

// Build system prompt for agent
async function buildAgentPrompt(db, userId, agentId, context = {}) {
  const [userRows] = await db.execute(
    'SELECT name, settings FROM users WHERE id = ?',
    [userId]
  );
  const user = userRows[0] || {};
  const userSettings = (() => {
    try {
      return JSON.parse(user.settings || '{}');
    } catch {
      return {};
    }
  })();
  const autoMode = userSettings.auto_run_agents || false;

  // Load agent definition
  let agentPrompt = `You are an AI agent. Complete the assigned task.`;
  let ignorePatterns = [];

  if (agentId) {
    // Try to load from agents folder
    try {
      // For now, use defaults based on agent ID
      if (agentId.includes('dev')) {
        agentPrompt = `You are a senior developer. Write clean, working code. Follow project conventions. Always read existing files before modifying.`;
        ignorePatterns = ['node_modules/', '.git/', '*.test.js', 'legal/'];
      } else if (agentId.includes('content')) {
        agentPrompt = `You are a content writer. Write authentic, engaging copy. Your voice: builder-first, anti-corporate, genuine.`;
        ignorePatterns = ['.git/', 'node_modules/'];
      } else if (agentId.includes('strategy')) {
        agentPrompt = `You are a strategic advisor. Think critically, prioritize ruthlessly. Your north star: revenue and growth.`;
        ignorePatterns = ['.git/'];
      } else if (agentId.includes('design')) {
        agentPrompt = `You are a UI/UX designer. Create dark minimalist designs. Style: monospace, nearly kawaii, functional.`;
        ignorePatterns = ['.git/', 'node_modules/', '*.psd'];
      } else if (agentId.includes('research')) {
        agentPrompt = `You are a researcher. Always cite sources. Map insights to decisions. Be thorough.`;
        ignorePatterns = ['.git/'];
      }
    } catch (e) {
      console.error('[AgentExecute] Failed to load agent:', e);
    }
  }

  // Add context
  let contextBlock = '';
  if (context.project) {
    contextBlock += `\nPROJECT: ${context.project.name}\n`;
    contextBlock += `PHASE: ${context.project.phase}\n`;
    contextBlock += `PRIORITY: ${context.project.priority}\n`;
  }
  if (context.task) {
    contextBlock += `\nTASK: ${context.task.title}\n`;
    contextBlock += `DESCRIPTION: ${context.task.description}\n`;
    contextBlock += `PRIORITY: ${context.task.priority}\n`;
  }

  // Build function instructions
  const fnDefs = FUNCTION_DEFINITIONS.map((f) => {
    const params = Object.entries(f.parameters.properties)
      .map(([name, info]) => `  - ${name}: ${info.description}`)
      .join('\n');
    return `## ${f.name}\n${f.description}\n\nParameters:\n${params}`;
  }).join('\n\n');

  const functionBlock = `## Available Functions

${fnDefs}

## Function Calling Rules

1. Use functions to DO work, not just describe it
2. Use read_file before write_file
3. Use create_task to break down large tasks
4. Use mark_complete when done
5. If a function fails, explain the error

## Mode

${autoMode ? 'AUTO MODE: Functions execute immediately' : 'PREVIEW MODE: write_file and create_task will be previewed but not executed'}`;

  return {
    prompt: `${agentPrompt}\n\n${contextBlock}\n\n${functionBlock}`,
    autoMode,
    ignorePatterns,
  };
}

export default async function handler(req, res) {
  const CORS = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  const user = getAuth(req);
  if (!user) {
    return err(res, 'Unauthorized', 401);
  }

  if (req.method !== 'POST') {
    return err(res, 'Method not allowed', 405);
  }

  const {
    agent_id,
    task_id,
    project_id,
    message,
    context,
    max_iterations = 5,
  } = req.body;

  if (!message && !task_id) {
    return err(res, 'Either message or task_id required');
  }

  const db = await getDb();

  try {
    // Get user AI settings
    const userSettings = await getUserAISettings(db, user.id);
    const provider = userSettings?.provider || 'anthropic';
    const providerConfig = PROVIDERS[provider];

    if (!providerConfig) {
      return err(res, `Unknown provider: ${provider}`);
    }

    // Get API key
    const apiKey = providerConfig.getApiKey(userSettings, ENV_API_KEYS);
    if (!apiKey) {
      return err(res, `No API key for ${provider}`);
    }

    // Build agent prompt
    let agentContext = context || {};
    if (project_id) {
      const [projRows] = await db.execute(
        'SELECT id, name, phase, priority, health, next_action FROM projects WHERE id = ? AND user_id = ?',
        [project_id, user.id]
      );
      if (projRows[0]) {
        agentContext.project = projRows[0];
      }
    }
    if (task_id) {
      const [taskRows] = await db.execute(
        'SELECT id, title, description, priority FROM tasks WHERE id = ? AND (assignee_type = ? OR assignee_id = ?)',
        [task_id, 'agent', agent_id]
      );
      if (taskRows[0]) {
        agentContext.task = taskRows[0];
      }
    }

    const {
      prompt: systemPrompt,
      autoMode,
      ignorePatterns,
    } = await buildAgentPrompt(db, user.id, agent_id, agentContext);

    // Build messages
    let messages = [];
    if (message) {
      messages.push({ role: 'user', content: message });
    }

    // Check if provider supports tools
    const supportsTools =
      providerConfig.supportsTools && !userSettings?.disable_functions;
    const tools = supportsTools ? FUNCTION_DEFINITIONS : null;

    let iterations = 0;
    let finalContent = '';
    const functionResults = [];

    while (iterations < max_iterations) {
      iterations++;

      // Make API call
      const requestBody = providerConfig.formatRequest(
        systemPrompt,
        messages,
        userSettings,
        tools
      );

      const response = await fetch(providerConfig.baseUrl, {
        method: 'POST',
        headers: providerConfig.headers(apiKey),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return err(res, `AI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const parsed = providerConfig.parseResponse(data);

      // Add assistant message
      let assistantMessage = parsed.content;

      // Handle tool calls
      const toolCalls = parsed.toolCalls || parsed.toolUse || [];

      if (toolCalls.length > 0) {
        // Add the assistant's message with tool calls
        if (provider === 'openai') {
          messages.push({
            role: 'assistant',
            content: assistantMessage,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments: JSON.stringify(tc.function.arguments),
              },
            })),
          });
        } else if (provider === 'anthropic') {
          messages.push({ role: 'assistant', content: assistantMessage });
        }

        // Execute each tool call
        for (const toolCall of toolCalls) {
          const fnName = toolCall.function?.name || toolCall.name;
          const fnArgs =
            typeof toolCall.function?.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function?.arguments || toolCall.input || {};

          const result = await executeFunction(fnName, fnArgs, db, user.id);
          functionResults.push({ function: fnName, args: fnArgs, result });

          // Add tool result message
          if (provider === 'openai') {
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } else if (provider === 'anthropic') {
            messages.push({
              role: 'user',
              content: `Tool result for ${fnName}: ${JSON.stringify(result, null, 2)}`,
            });
          }
        }

        // Continue loop to get next response
        continue;
      }

      // No more tool calls - we're done
      finalContent = assistantMessage;
      break;
    }

    // Log usage
    try {
      const today = new Date().toISOString().split('T')[0];
      await db.execute(
        `INSERT INTO ai_usage (user_id, date, provider, model, input_tokens, output_tokens, cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE input_tokens = input_tokens + VALUES(input_tokens),
         output_tokens = output_tokens + VALUES(output_tokens), cost_usd = cost_usd + VALUES(cost_usd)`,
        [
          user.id,
          today,
          provider,
          userSettings?.model || 'unknown',
          parsed.usage?.input_tokens || 0,
          parsed.usage?.output_tokens || 0,
          0,
        ]
      );
    } catch (e) {
      console.error('[AgentExecute] Failed to log usage:', e);
    }

    Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).json({
      success: true,
      content: finalContent,
      iterations,
      functionResults,
      autoMode,
    });
  } catch (e) {
    console.error('[AgentExecute] Error:', e);
    return err(res, e.message);
  } finally {
    await db.end();
  }
}
