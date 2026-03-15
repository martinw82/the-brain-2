/**
 * Agent Functions (Phase 5.6)
 * Function calling system for agent execution
 *
 * Enables agents to DO things, not just advise:
 * - read_file: Get L2 content from project files
 * - write_file: Create/update project files
 * - create_task: Delegate work to humans or agents
 * - search_projects: Find context across projects
 * - mark_complete: Finish assigned work
 * - request_review: Escalate for human review
 */

import { tasks as tasksApi, projects as projectsApi } from './api.js';
import { contentHash } from './uri.js';

// Function definitions for AI function calling
export const FUNCTION_DEFINITIONS = [
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

// Execution context - set by the UI before agent runs
let executionContext = {
  userId: null,
  projectId: null,
  autoMode: false, // true = auto-execute, false = preview mode
  ignorePatterns: [],
};

/**
 * Set execution context for agent functions
 */
export function setExecutionContext(context) {
  executionContext = { ...executionContext, ...context };
}

/**
 * Get current execution context
 */
export function getExecutionContext() {
  return { ...executionContext };
}

/**
 * Parse a brain:// URI
 */
function parseFileURI(uri) {
  const match = uri.match(/^brain:\/\/project\/([^/]+)\/file\/(.+)$/);
  if (!match) {
    throw new Error(
      `Invalid file URI: ${uri}. Expected format: brain://project/{id}/file/{path}`
    );
  }
  return { projectId: match[1], filePath: match[2] };
}

/**
 * Execute a function call from an agent
 * @param {string} functionName - Name of function to call
 * @param {object} arguments_ - Arguments to pass
 * @returns {Promise<object>} - Result of function execution
 */
export async function executeFunction(functionName, arguments_) {
  const ctx = getExecutionContext();

  // Check if in preview mode - block write operations
  if (!ctx.autoMode && ['write_file', 'create_task'].includes(functionName)) {
    return {
      success: false,
      preview: true,
      message: `Preview mode: Would execute ${functionName} with parameters. Set autoMode=true to execute.`,
      proposed: arguments_,
    };
  }

  switch (functionName) {
    case 'read_file':
      return await readFile(arguments_.uri);
    case 'write_file':
      return await writeFile(
        arguments_.uri,
        arguments_.content,
        arguments_.mode || 'create'
      );
    case 'create_task':
      return await createTask(arguments_);
    case 'search_projects':
      return await searchProjects(arguments_);
    case 'mark_complete':
      return await markComplete(arguments_);
    case 'request_review':
      return await requestReview(arguments_);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

/**
 * Read a file from a project
 */
async function readFile(uri) {
  const { projectId, filePath } = parseFileURI(uri);
  const ctx = getExecutionContext();

  // Check ignore patterns
  if (
    ctx.ignorePatterns?.some(
      (pattern) =>
        filePath.includes(pattern) || filePath.match(new RegExp(pattern))
    )
  ) {
    return {
      success: false,
      error: `Access denied: ${filePath} matches ignore pattern`,
    };
  }

  try {
    // Fetch file via API
    const files = await projectsApi.getFiles(projectId);
    const file = files.find(
      (f) => f.path === filePath || f.path === '/' + filePath
    );

    if (!file) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    return {
      success: true,
      uri,
      filePath,
      projectId,
      content: file.content || '',
      preview: file.content?.substring(0, 500) || '',
      size: file.content?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Write a file to a project
 */
async function writeFile(uri, content, mode = 'create') {
  const { projectId, filePath } = parseFileURI(uri);
  const ctx = getExecutionContext();

  // Security: Check ignore patterns
  if (
    ctx.ignorePatterns?.some(
      (pattern) =>
        filePath.includes(pattern) || filePath.match(new RegExp(pattern))
    )
  ) {
    return {
      success: false,
      error: `Access denied: ${filePath} matches ignore pattern`,
    };
  }

  // Preview mode
  if (mode === 'preview') {
    return {
      success: true,
      preview: true,
      uri,
      filePath,
      proposedContent: content,
      size: content.length,
      message: 'Preview: File would be written with the above content',
    };
  }

  try {
    // Check if file exists
    const files = await projectsApi.getFiles(projectId);
    const existingFile = files.find(
      (f) => f.path === filePath || f.path === '/' + filePath
    );

    if (mode === 'create' && existingFile) {
      return {
        success: false,
        error: `File already exists: ${filePath}. Use mode='update' to modify.`,
      };
    }

    // Save file via API
    const result = await projectsApi.saveFile(projectId, filePath, content);

    return {
      success: true,
      uri,
      filePath,
      projectId,
      action: existingFile ? 'updated' : 'created',
      contentHash: contentHash(content),
      size: content.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Create a task
 */
async function createTask(args) {
  const ctx = getExecutionContext();

  if (!ctx.userId) {
    return {
      success: false,
      error: 'No user context available',
    };
  }

  try {
    const taskData = {
      title: args.title,
      description: args.description,
      project_id: args.project_id || ctx.projectId,
      priority: args.priority || 'medium',
      assignee_type: args.assignee_type || 'human',
      assignee_id: args.assignee_id || null,
      assigned_by: 'agent',
      assignment_reason: `Created by agent for: ${args.title}`,
    };

    const result = await tasksApi.create(taskData);

    return {
      success: true,
      task_id: result.id,
      title: result.title,
      status: result.status,
      uri: `brain://project/${ctx.projectId}/task/${result.id}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Search projects
 */
async function searchProjects(args) {
  const ctx = getExecutionContext();

  try {
    // Use the search API
    const filters = {};
    if (args.project_id) filters.project_id = args.project_id;
    if (args.file_type) filters.file_type = args.file_type;

    const results = await projectsApi.search(args.query, filters);

    return {
      success: true,
      query: args.query,
      count: results.length,
      results: results.slice(0, 10).map((r) => ({
        projectId: r.project_id,
        projectName: r.project_name,
        filePath: r.file_path,
        excerpt: r.excerpt || '',
        uri: `brain://project/${r.project_id}/file/${r.file_path}`,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Mark a task as complete
 */
async function markComplete(args) {
  const ctx = getExecutionContext();

  try {
    const result = await tasksApi.complete(
      args.task_id,
      args.summary,
      args.outputs
    );

    return {
      success: true,
      task_id: args.task_id,
      status: 'complete',
      summary: args.summary,
      completed_at: result.completed_at,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Request human review
 */
async function requestReview(args) {
  const ctx = getExecutionContext();

  // In preview mode, just return what would be requested
  if (!ctx.autoMode) {
    return {
      success: true,
      preview: true,
      message: `Preview: Would request review - ${args.reason} (urgency: ${args.urgency || 'medium'})`,
    };
  }

  // Create a review task for the human
  try {
    const taskData = {
      title: `Review Request: ${args.reason.substring(0, 50)}`,
      description: args.reason,
      project_id: ctx.projectId,
      priority:
        args.urgency === 'high'
          ? 'critical'
          : args.urgency === 'low'
            ? 'low'
            : 'medium',
      assignee_type: 'human',
      assigned_by: 'agent',
      assignment_reason: `Agent requested review: ${args.reason}`,
    };

    const result = await tasksApi.create(taskData);

    return {
      success: true,
      review_requested: true,
      task_id: result.id,
      message: 'Review request created - human will be notified',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Build function calling instructions for agent prompts
 */
export function buildFunctionInstructions() {
  const definitions = FUNCTION_DEFINITIONS.map((f) => {
    const params = f.parameters.properties;
    const required = f.parameters.required || [];
    const paramList = Object.entries(params)
      .map(([name, info]) => {
        const req = required.includes(name) ? ' (required)' : ' (optional)';
        return `  - ${name}: ${info.description}${req}`;
      })
      .join('\n');

    return `## ${f.name}
${f.description}

Parameters:
${paramList}`;
  }).join('\n\n');

  return `## Available Functions

You have access to the following functions to accomplish your task. Use them when needed rather than just describing what should be done.

${definitions}

## Function Calling Rules

1. Use functions to DO work, not just describe it
2. After calling a function, analyze the result and continue or respond
3. If a function fails, try an alternative approach or explain the issue
4. Use read_file before write_file to understand existing content
5. Use create_task to break down large tasks or delegate subtasks
6. Use mark_complete when your assigned task is done
7. Use request_review when you need human feedback

## Mode

${executionContext.autoMode ? 'AUTO MODE: Functions will execute immediately' : 'PREVIEW MODE: Write operations will be shown but not executed. Set autoMode=true to actually run.'}

---

Begin your work now.`;
}

export default {
  FUNCTION_DEFINITIONS,
  setExecutionContext,
  getExecutionContext,
  executeFunction,
  buildFunctionInstructions,
};
