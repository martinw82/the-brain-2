/**
 * URI Utility for The Brain
 * Standardized resource addressing using brain:// scheme
 *
 * Patterns:
 *   brain://project/{id}                    - Project reference
 *   brain://project/{id}/file/{path}        - File within project
 *   brain://project/{id}/task/{taskId}      - Task within project
 *   brain://goal/{id}                       - Goal reference
 *   brain://staging/{id}                    - Staging item
 *   brain://idea/{id}                       - Idea reference
 *   brain://agent/{agentId}                 - Agent reference
 *   brain://workflow/{id}                   - Workflow template
 *   brain://workflow/{id}/step/{stepNum}    - Workflow step
 *   brain://user/{userId}/settings          - User settings
 *   brain://context/{type}/{id}             - Generic context reference
 */

const URI_SCHEME = 'brain://';

/**
 * Parse a brain:// URI into its components
 * @param {string} uri - The URI to parse
 * @returns {Object|null} - Parsed components or null if invalid
 */
export function parseURI(uri) {
  if (!uri || typeof uri !== 'string') return null;

  // Ensure it starts with brain://
  if (!uri.startsWith(URI_SCHEME)) {
    // Try to handle bare paths by assuming project/file
    if (uri.includes('/')) {
      const parts = uri.split('/');
      return {
        scheme: 'brain',
        type: 'project',
        id: parts[0],
        resource: 'file',
        resourceId: parts.slice(1).join('/'),
        raw: uri,
      };
    }
    return null;
  }

  // Remove brain:// prefix
  const path = uri.slice(URI_SCHEME.length);
  const segments = path.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const [type, id, ...rest] = segments;

  const result = {
    scheme: 'brain',
    type, // project, goal, staging, idea, agent, workflow, user, context
    id, // The ID of the resource
    raw: uri,
  };

  // Parse resource-specific paths
  if (type === 'project' && rest.length >= 2) {
    const [resource, ...resourcePath] = rest;
    result.resource = resource; // file, task, folder
    result.resourceId = resourcePath.join('/');
  } else if (type === 'workflow' && rest.length >= 2 && rest[0] === 'step') {
    result.resource = 'step';
    result.resourceId = rest[1];
  } else if (type === 'user' && rest.length >= 1) {
    result.resource = rest[0]; // settings, profile, etc.
  }

  return result;
}

/**
 * Generate a brain:// URI from components
 * @param {Object} params - URI components
 * @param {string} params.type - Resource type (project, goal, etc.)
 * @param {string} params.id - Resource ID
 * @param {string} [params.resource] - Sub-resource type (file, task, etc.)
 * @param {string} [params.resourceId] - Sub-resource ID/path
 * @returns {string} - The generated URI
 */
export function generateURI({ type, id, resource, resourceId }) {
  if (!type || !id) {
    throw new Error('URI generation requires type and id');
  }

  let uri = `${URI_SCHEME}${type}/${id}`;

  if (resource) {
    uri += `/${resource}`;
    if (resourceId) {
      uri += `/${resourceId}`;
    }
  }

  return uri;
}

/**
 * Generate a project URI
 * @param {string} projectId - Project ID
 * @returns {string} - brain://project/{id}
 */
export function projectURI(projectId) {
  return generateURI({ type: 'project', id: projectId });
}

/**
 * Generate a file URI
 * @param {string} projectId - Project ID
 * @param {string} filePath - File path within project
 * @returns {string} - brain://project/{id}/file/{path}
 */
export function fileURI(projectId, filePath) {
  // Normalize path (remove leading slash, encode special chars)
  const normalizedPath = filePath.replace(/^\//, '').replace(/\\/g, '/');
  return generateURI({
    type: 'project',
    id: projectId,
    resource: 'file',
    resourceId: normalizedPath,
  });
}

/**
 * Generate a task URI
 * @param {string} projectId - Project ID
 * @param {string|number} taskId - Task ID
 * @returns {string} - brain://project/{id}/task/{taskId}
 */
export function taskURI(projectId, taskId) {
  return generateURI({
    type: 'project',
    id: projectId,
    resource: 'task',
    resourceId: String(taskId),
  });
}

/**
 * Generate a goal URI
 * @param {string|number} goalId - Goal ID
 * @returns {string} - brain://goal/{id}
 */
export function goalURI(goalId) {
  return generateURI({ type: 'goal', id: String(goalId) });
}

/**
 * Generate a staging item URI
 * @param {string|number} stagingId - Staging item ID
 * @returns {string} - brain://staging/{id}
 */
export function stagingURI(stagingId) {
  return generateURI({ type: 'staging', id: String(stagingId) });
}

/**
 * Generate an idea URI
 * @param {string|number} ideaId - Idea ID
 * @returns {string} - brain://idea/{id}
 */
export function ideaURI(ideaId) {
  return generateURI({ type: 'idea', id: String(ideaId) });
}

/**
 * Generate an agent URI
 * @param {string} agentId - Agent ID (dev, content, strategy, etc.)
 * @returns {string} - brain://agent/{id}
 */
export function agentURI(agentId) {
  return generateURI({ type: 'agent', id: agentId });
}

/**
 * Generate a workflow URI
 * @param {string} workflowId - Workflow template ID
 * @param {number} [stepNum] - Optional step number
 * @returns {string} - brain://workflow/{id} or brain://workflow/{id}/step/{n}
 */
export function workflowURI(workflowId, stepNum) {
  if (stepNum !== undefined) {
    return generateURI({
      type: 'workflow',
      id: workflowId,
      resource: 'step',
      resourceId: String(stepNum),
    });
  }
  return generateURI({ type: 'workflow', id: workflowId });
}

/**
 * Generate a context URI for AI references
 * @param {string} contextType - Type of context (project_summary, goal_progress, etc.)
 * @param {string} contextId - Context identifier
 * @returns {string} - brain://context/{type}/{id}
 */
export function contextURI(contextType, contextId) {
  return generateURI({ type: 'context', id: contextType, resource: contextId });
}

/**
 * Resolve a URI to a human-readable label
 * @param {string} uri - The URI to resolve
 * @param {Object} context - Optional context data for resolution
 * @returns {string} - Human-readable label
 */
export function resolveLabel(uri, context = {}) {
  const parsed = parseURI(uri);
  if (!parsed) return uri;

  const { type, id, resource, resourceId } = parsed;

  // Use provided context if available
  if (context.projects?.[id]) {
    const project = context.projects[id];
    if (resource === 'file' && project.files?.[resourceId]) {
      return `${project.name} → ${resourceId}`;
    }
    if (resource === 'task') {
      return `${project.name} → Task #${resourceId}`;
    }
    return project.name || id;
  }

  // Default labels
  switch (type) {
    case 'project':
      if (resource === 'file') return `Project ${id} → ${resourceId}`;
      if (resource === 'task') return `Project ${id} → Task #${resourceId}`;
      return `Project: ${id}`;
    case 'goal':
      return `Goal: ${id}`;
    case 'staging':
      return `Staging: ${id}`;
    case 'idea':
      return `Idea: ${id}`;
    case 'agent':
      return `Agent: ${id}`;
    case 'workflow':
      if (resource === 'step') return `Workflow ${id} → Step ${resourceId}`;
      return `Workflow: ${id}`;
    default:
      return uri;
  }
}

/**
 * Extract all URIs from a text string
 * @param {string} text - Text to search
 * @returns {string[]} - Array of found URIs
 */
export function extractURIs(text) {
  if (!text || typeof text !== 'string') return [];

  const uriRegex = /brain:\/\/[^\s\)\]\>\"\']+/g;
  return text.match(uriRegex) || [];
}

/**
 * Replace URIs in text with labeled links (for rendering)
 * @param {string} text - Original text
 * @param {Function} linkRenderer - Function(uri, label) => string|ReactElement
 * @param {Object} context - Context for label resolution
 * @returns {Array} - Array of strings and link elements
 */
export function renderURIs(text, linkRenderer, context = {}) {
  if (!text || typeof text !== 'string') return [text];

  const uris = extractURIs(text);
  if (uris.length === 0) return [text];

  const parts = [];
  let lastIndex = 0;

  uris.forEach((uri) => {
    const index = text.indexOf(uri, lastIndex);
    if (index > lastIndex) {
      parts.push(text.slice(lastIndex, index));
    }

    const label = resolveLabel(uri, context);
    parts.push(linkRenderer(uri, label));

    lastIndex = index + uri.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Convert a URI to a navigation path for the app
 * @param {string} uri - The URI to convert
 * @returns {Object|null} - Navigation action {type, params} or null
 */
export function uriToNavigation(uri) {
  const parsed = parseURI(uri);
  if (!parsed) return null;

  const { type, id, resource, resourceId } = parsed;

  switch (type) {
    case 'project':
      if (resource === 'file') {
        return {
          type: 'OPEN_FILE',
          params: { projectId: id, filePath: resourceId },
        };
      }
      if (resource === 'task') {
        return {
          type: 'OPEN_TASK',
          params: { projectId: id, taskId: resourceId },
        };
      }
      return {
        type: 'OPEN_PROJECT',
        params: { projectId: id },
      };

    case 'goal':
      return {
        type: 'OPEN_GOAL',
        params: { goalId: id },
      };

    case 'staging':
      return {
        type: 'OPEN_STAGING',
        params: { stagingId: id },
      };

    case 'idea':
      return {
        type: 'OPEN_IDEA',
        params: { ideaId: id },
      };

    case 'workflow':
      if (resource === 'step') {
        return {
          type: 'OPEN_WORKFLOW_STEP',
          params: { workflowId: id, stepNum: parseInt(resourceId, 10) },
        };
      }
      return {
        type: 'OPEN_WORKFLOW',
        params: { workflowId: id },
      };

    default:
      return null;
  }
}

/**
 * Create a URI from a file object
 * @param {Object} file - File object with path or id
 * @param {string} projectId - Project ID
 * @returns {string} - brain://project/{id}/file/{path}
 */
export function fileToURI(file, projectId) {
  const path = file.path || file.name || file.id;
  return fileURI(projectId, path);
}

/**
 * Create a URI from a project object
 * @param {Object} project - Project object
 * @returns {string} - brain://project/{id}
 */
export function projectToURI(project) {
  return projectURI(project.id || project.slug);
}

/**
 * Validate if a string is a valid brain:// URI
 * @param {string} uri - String to validate
 * @returns {boolean}
 */
export function isValidURI(uri) {
  if (!uri || typeof uri !== 'string') return false;

  // Must start with brain://
  if (!uri.startsWith(URI_SCHEME)) return false;

  // Must have type and id
  const path = uri.slice(URI_SCHEME.length);
  const segments = path.split('/').filter(Boolean);

  return segments.length >= 2;
}

/**
 * Get the parent URI (e.g., project from file URI)
 * @param {string} uri - Child URI
 * @returns {string|null} - Parent URI or null
 */
export function getParentURI(uri) {
  const parsed = parseURI(uri);
  if (!parsed) return null;

  // If has resource, return parent type/id
  if (parsed.resource) {
    return generateURI({ type: parsed.type, id: parsed.id });
  }

  return null;
}

/**
 * Compare two URIs for equality
 * @param {string} uri1 - First URI
 * @param {string} uri2 - Second URI
 * @returns {boolean}
 */
export function compareURIs(uri1, uri2) {
  const p1 = parseURI(uri1);
  const p2 = parseURI(uri2);

  if (!p1 || !p2) return uri1 === uri2;

  return (
    p1.type === p2.type &&
    p1.id === p2.id &&
    p1.resource === p2.resource &&
    p1.resourceId === p2.resourceId
  );
}

// Default export for convenience
export default {
  parse: parseURI,
  generate: generateURI,
  project: projectURI,
  file: fileURI,
  task: taskURI,
  goal: goalURI,
  staging: stagingURI,
  idea: ideaURI,
  agent: agentURI,
  workflow: workflowURI,
  context: contextURI,
  resolveLabel,
  extract: extractURIs,
  render: renderURIs,
  toNavigation: uriToNavigation,
  fileToURI,
  projectToURI,
  isValid: isValidURI,
  getParent: getParentURI,
  compare: compareURIs,
};

/**
 * Generate a simple content hash for change detection
 * @param {string} content - Content to hash
 * @returns {string} - 16-character hash
 */
export function contentHash(content) {
  if (!content) return '0';
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}
