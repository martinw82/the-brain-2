/**
 * File Summarization Utilities (Phase 5.2)
 * Hierarchical Context Summarization - Open Viking Pattern
 * 
 * L0 Abstract: ~100 tokens - Vector search, quick filtering
 * L1 Overview: ~2,000 tokens - Navigation, context routing
 * L2 Detail: Unlimited - Original file content
 */

import { fileSummaries } from './api.js';
import { contentHash } from './uri.js';

/**
 * Prompt for generating L0 Abstract (~100 tokens)
 * Captures the essence for quick filtering/vector search
 */
export const L0_PROMPT = `Provide a 1-sentence abstract (max 20 words) capturing the core purpose of this file.
Format: "This file [does X] to achieve [Y]."
Be specific about the domain/purpose. No filler words.`;

/**
 * Prompt for generating L1 Overview (~2000 tokens)
 * Captures structure and key points for navigation
 */
export const L1_PROMPT = `Provide a structured overview of this file covering:
1. PURPOSE: What this file achieves (2-3 sentences)
2. STRUCTURE: Main sections/components (bullet list)
3. KEY CONCEPTS: Important terms, functions, or patterns defined here
4. DEPENDENCIES: What other files/modules this relates to
5. ACTIONS: What a developer would do with this file

Use concise bullet points. Total length: 300-500 words.`;

/**
 * Check if file needs summarization (no summary or content changed)
 * @param {string} projectId - Project ID
 * @param {string} filePath - File path
 * @param {string} currentContent - Current file content
 * @returns {Promise<{needsUpdate: boolean, existingSummary: object|null}>}
 */
export async function checkSummaryStatus(projectId, filePath, currentContent) {
  try {
    const result = await fileSummaries.get(projectId, filePath);
    const existing = result?.summary;
    
    if (!existing) {
      return { needsUpdate: true, existingSummary: null };
    }
    
    const currentHash = contentHash(currentContent);
    const needsUpdate = existing.content_hash !== currentHash;
    
    return { needsUpdate, existingSummary: existing };
  } catch (e) {
    return { needsUpdate: true, existingSummary: null };
  }
}

/**
 * Store generated summaries
 * @param {string} projectId - Project ID
 * @param {string} filePath - File path  
 * @param {string} content - Original content (for hash)
 * @param {object} summaries - { l0_abstract, l1_overview }
 * @returns {Promise}
 */
export async function storeSummaries(projectId, filePath, content, summaries) {
  const hash = contentHash(content);
  const tokenCount = content.length / 4; // Rough estimate
  
  return fileSummaries.store(projectId, filePath, {
    l0_abstract: summaries.l0_abstract,
    l1_overview: summaries.l1_overview,
    content_hash: hash,
    token_count: Math.round(tokenCount)
  });
}

/**
 * Get project overview using L1 summaries
 * @param {string} projectId - Project ID
 * @returns {Promise<string>} - Formatted overview
 */
export async function getProjectOverview(projectId) {
  try {
    const result = await fileSummaries.list(projectId);
    const summaries = result?.summaries || [];
    
    if (summaries.length === 0) {
      return 'No summaries available for this project yet.';
    }
    
    return summaries.map(s => {
      const abstract = s.l0_abstract || 'No abstract available';
      return `**${s.file_path}** (${s.token_count || '?'} tokens)\n${abstract}`;
    }).join('\n\n');
  } catch (e) {
    return 'Error loading project overview.';
  }
}

/**
 * Build AI context using L0/L1 summaries (efficient retrieval)
 * @param {string} projectId - Project ID
 * @param {string} query - Search query (optional)
 * @returns {Promise<string>} - Context string for AI
 */
export async function buildSummaryContext(projectId, query = '') {
  try {
    const result = await fileSummaries.list(projectId);
    const summaries = result?.summaries || [];
    
    if (summaries.length === 0) {
      return '';
    }
    
    // If query provided, filter to relevant files (simple keyword match)
    let relevant = summaries;
    if (query) {
      const terms = query.toLowerCase().split(/\s+/);
      relevant = summaries.filter(s => {
        const text = `${s.file_path} ${s.l0_abstract || ''} ${s.l1_overview || ''}`.toLowerCase();
        return terms.some(t => text.includes(t));
      });
    }
    
    // Build context from L1 overviews
    const context = relevant.slice(0, 5).map(s => {
      const overview = s.l1_overview ? s.l1_overview.slice(0, 500) + '...' : (s.l0_abstract || 'No summary');
      return `--- ${s.file_path} ---\n${overview}`;
    }).join('\n\n');
    
    return `PROJECT CONTEXT (based on ${relevant.length} file summaries):\n\n${context}`;
  } catch (e) {
    return '';
  }
}

export default {
  L0_PROMPT,
  L1_PROMPT,
  checkSummaryStatus,
  storeSummaries,
  getProjectOverview,
  buildSummaryContext
};
