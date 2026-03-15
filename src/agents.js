/**
 * Agent Registry (Phase 5.3)
 * File-based agent definitions with ephemeral execution
 * 
 * Architecture:
 * - Agent definitions live in /agents/*.md files
 * - Frontmatter = metadata (capabilities, permissions, etc.)
 * - Body = prompt_prefix
 * - Agents are immutable (new file = new version)
 * - Stats derived from tasks table (no persistent agent state)
 */

import { tasks as tasksApi } from './api.js';

// Cache for parsed agents
let agentCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Parse frontmatter from markdown content
 * @param {string} content - Markdown content with frontmatter
 * @returns {object} - { frontmatter, body }
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterText = match[1];
  const body = match[2].trim();
  
  // Simple YAML-like parsing (sufficient for our needs)
  const frontmatter = {};
  let currentKey = null;
  let currentList = null;
  
  for (const line of frontmatterText.split('\n')) {
    const listMatch = line.match(/^  - (.+)$/);
    if (listMatch && currentKey) {
      if (!currentList) {
        currentList = [];
        frontmatter[currentKey] = currentList;
      }
      currentList.push(listMatch[1]);
      continue;
    }
    
    const keyMatch = line.match(/^([a-z_]+):\s*(.+)?$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      currentList = null;
      const value = keyMatch[2];
      if (value) {
        // Try to parse as number
        const num = parseFloat(value);
        frontmatter[currentKey] = isNaN(num) ? value : num;
      } else {
        frontmatter[currentKey] = true;
      }
    }
  }
  
  return { frontmatter, body };
}

/**
 * Load agent from markdown file
 * @param {string} path - File path
 * @returns {Promise<object|null>} - Agent object or null
 */
async function loadAgentFile(path) {
  try {
    // In browser, we need to fetch the file
    // In dev, files are in /agents/ folder
    const response = await fetch(path);
    if (!response.ok) return null;
    
    const content = await response.text();
    const { frontmatter, body } = parseFrontmatter(content);
    
    return {
      ...frontmatter,
      prompt_prefix: body,
      file_path: path
    };
  } catch (e) {
    console.error(`[AgentRegistry] Failed to load ${path}:`, e);
    return null;
  }
}

/**
 * Load all system agents
 * @returns {Promise<object[]>} - Array of agent objects
 */
async function loadSystemAgents() {
  // System agents are known files
  const systemAgentFiles = [
    '/agents/system-dev.md',
    '/agents/system-content.md',
    '/agents/system-strategy.md',
    '/agents/system-design.md',
    '/agents/system-research.md'
  ];
  
  const agents = await Promise.all(
    systemAgentFiles.map(loadAgentFile)
  );
  
  return agents.filter(Boolean);
}

/**
 * Load project-specific agents
 * @param {string} projectId - Project ID
 * @returns {Promise<object[]>} - Array of agent objects
 */
async function loadProjectAgents(projectId) {
  // Project agents stored in project files
  // Files matching /agents/*.md pattern in project
  // This would require fetching project file list
  // For now, return empty (future enhancement)
  return [];
}

/**
 * Get all agents (system + project)
 * @param {string} projectId - Optional project ID to include project agents
 * @returns {Promise<object[]>} - Array of agent objects
 */
export async function getAgents(projectId = null) {
  const now = Date.now();
  
  // Use cache if fresh
  if (agentCache && (now - cacheTimestamp) < CACHE_TTL) {
    return agentCache;
  }
  
  // Load system agents
  const systemAgents = await loadSystemAgents();
  
  // Load project agents if project specified
  const projectAgents = projectId ? await loadProjectAgents(projectId) : [];
  
  // Combine
  agentCache = [...systemAgents, ...projectAgents];
  cacheTimestamp = now;
  
  return agentCache;
}

/**
 * Find agents by capability
 * @param {string} capability - Capability to search for (e.g., 'code.write')
 * @param {string} projectId - Optional project ID
 * @returns {Promise<object[]>} - Matching agents
 */
export async function findByCapability(capability, projectId = null) {
  const agents = await getAgents(projectId);
  return agents.filter(a => a.capabilities?.includes(capability));
}

/**
 * Get single agent by ID
 * @param {string} agentId - Agent ID (e.g., 'system-dev-v1')
 * @param {string} projectId - Optional project ID
 * @returns {Promise<object|null>} - Agent or null
 */
export async function getAgent(agentId, projectId = null) {
  const agents = await getAgents(projectId);
  return agents.find(a => a.id === agentId) || null;
}

/**
 * Get agent execution stats from tasks table
 * @param {string} agentId - Agent ID
 * @returns {Promise<object>} - Stats object
 */
export async function getAgentStats(agentId) {
  try {
    // This would need a backend endpoint to aggregate
    // For now, return placeholder
    // In real implementation: tasks.getAgentHistory(agentId)
    return {
      total_tasks: 0,
      completed_tasks: 0,
      avg_cost: 0,
      avg_duration_minutes: 0,
      success_rate: 0
    };
  } catch (e) {
    return {
      total_tasks: 0,
      completed_tasks: 0,
      avg_cost: 0,
      avg_duration_minutes: 0,
      success_rate: 0
    };
  }
}

/**
 * Select best agent for task
 * @param {string} capability - Required capability
 * @param {object} options - Selection options
 * @returns {Promise<object|null>} - Selected agent or null
 */
export async function selectAgent(capability, options = {}) {
  const { projectId, preferLowCost = false } = options;
  
  // Find candidates
  const candidates = await findByCapability(capability, projectId);
  
  if (candidates.length === 0) {
    return null;
  }
  
  if (candidates.length === 1) {
    return candidates[0];
  }
  
  // Score candidates
  const scored = await Promise.all(
    candidates.map(async (agent) => {
      const stats = await getAgentStats(agent.id);
      
      // Simple scoring: success_rate * 0.6 + cost_efficiency * 0.4
      const successScore = stats.success_rate || 0.5;
      const costScore = stats.avg_cost 
        ? Math.max(0, 1 - (stats.avg_cost / 0.1)) // Lower cost = higher score
        : 0.5;
      
      const score = preferLowCost
        ? (successScore * 0.4 + costScore * 0.6)
        : (successScore * 0.6 + costScore * 0.4);
      
      return { agent, score, stats };
    })
  );
  
  // Sort by score
  scored.sort((a, b) => b.score - a.score);
  
  return scored[0].agent;
}

/**
 * Clear agent cache (call when files might have changed)
 */
export function clearAgentCache() {
  agentCache = null;
  cacheTimestamp = 0;
}

/**
 * Create a new agent by cloning existing
 * @param {string} baseAgentId - Agent to clone
 * @param {object} modifications - Fields to modify
 * @returns {Promise<object>} - New agent definition
 */
export async function cloneAgent(baseAgentId, modifications = {}) {
  const base = await getAgent(baseAgentId);
  if (!base) throw new Error(`Agent not found: ${baseAgentId}`);
  
  // Generate verbose ID
  const timestamp = new Date().toISOString().split('T')[0];
  const baseName = base.id.replace(/-v\d+$/, '');
  const newVersion = (base.version || 1) + 1;
  
  const newAgent = {
    ...base,
    ...modifications,
    id: `${baseName}-v${newVersion}-clone-${timestamp}`,
    version: newVersion,
    previous_version: base.id,
    created_by: 'user',
    created_at: timestamp,
    is_system: false
  };
  
  return newAgent;
}

/**
 * Build agent prompt with context
 * @param {object} agent - Agent definition
 * @param {object} context - Project/task context
 * @returns {string} - Full prompt
 */
export function buildAgentPrompt(agent, context = {}) {
  const parts = [
    agent.prompt_prefix || '',
    '',
    '---',
    ''
  ];
  
  if (context.project) {
    parts.push(`PROJECT: ${context.project.name}`);
    parts.push(`PHASE: ${context.project.phase}`);
    parts.push('');
  }
  
  if (context.task) {
    parts.push(`TASK: ${context.task.title}`);
    parts.push(`PRIORITY: ${context.task.priority}`);
    parts.push('');
  }
  
  if (context.summaries) {
    parts.push('PROJECT CONTEXT:');
    parts.push(context.summaries);
    parts.push('');
  }
  
  parts.push('YOUR TASK:');
  parts.push(context.task?.description || 'Complete the assigned work.');
  parts.push('');
  
  if (agent.sop) {
    parts.push('STANDARD OPERATING PROCEDURE:');
    parts.push(...agent.sop.map(step => `- ${step}`));
    parts.push('');
  }
  
  parts.push('Begin.');
  
  return parts.join('\n');
}

export default {
  getAgents,
  findByCapability,
  getAgent,
  getAgentStats,
  selectAgent,
  clearAgentCache,
  cloneAgent,
  buildAgentPrompt
};
