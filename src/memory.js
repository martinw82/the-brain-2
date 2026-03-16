/**
 * Memory Self-Iteration (Phase 7.4)
 * Client-side module for personal memory management
 */

import { memories } from './api.js';

export const MEMORY_CATEGORIES = {
  PROFILE: 'profile',
  PREFERENCES: 'preferences',
  ENTITIES: 'entities',
  EVENTS: 'events',
  CASES: 'cases',
  PATTERNS: 'patterns',
};

export const MEMORY_SOURCES = {
  WORKFLOW: 'workflow',
  TASK: 'task',
  PROJECT: 'project',
  SESSION: 'session',
  CHECKIN: 'checkin',
  MANUAL: 'manual',
};

/**
 * List memories with optional filters
 * @param {object} options - Filter options
 * @returns {Promise<object>} - List of memories
 */
export async function listMemories(options = {}) {
  return memories.list(options);
}

/**
 * Create a new memory
 * @param {object} memory - Memory to create
 * @returns {Promise<object>} - Created memory
 */
export async function createMemory(memory) {
  return memories.create(memory);
}

/**
 * Extract memories from a source
 * @param {string} sourceType - Type of source (workflow, task, checkin)
 * @param {string} sourceId - ID of the source
 * @returns {Promise<object>} - Extracted memories
 */
export async function extractMemories(sourceType, sourceId) {
  // Use the API directly via fetch
  const response = await fetch('/api/data?resource=extract-memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_type: sourceType, source_id: sourceId }),
  });
  return response.json();
}

/**
 * Get memory insights and statistics
 * @returns {Promise<object>} - Memory insights
 */
export async function getMemoryInsights() {
  // Use the API directly via fetch
  const response = await fetch('/api/data?resource=memory-insights');
  return response.json();
}

/**
 * Get memories formatted for AI context
 * @param {number} maxMemories - Maximum number of memories to include
 * @returns {Promise<string>} - Formatted memory context
 */
export async function getMemoryContext(maxMemories = 10) {
  const result = await listMemories({ active: true });
  const memoryList = result.memories || [];

  if (memoryList.length === 0) {
    return '';
  }

  const sorted = memoryList
    .sort((a, b) => b.accessed_count - a.accessed_count)
    .slice(0, maxMemories);

  const sections = [];

  // Group by category
  const byCategory = {};
  for (const mem of sorted) {
    if (!byCategory[mem.category]) {
      byCategory[mem.category] = [];
    }
    byCategory[mem.category].push(mem);
  }

  for (const [category, mems] of Object.entries(byCategory)) {
    sections.push(`## ${category.toUpperCase()}`);
    for (const mem of mems) {
      sections.push(`- ${mem.title}: ${mem.content}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}

export default {
  listMemories,
  createMemory,
  extractMemories,
  getMemoryInsights,
  getMemoryContext,
  MEMORY_CATEGORIES,
  MEMORY_SOURCES,
};
