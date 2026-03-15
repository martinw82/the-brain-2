/**
 * Recursive Directory Retrieval (Phase 7.1)
 * Open Viking Pattern - AI explores project structure intelligently
 *
 * Algorithm:
 * 1. Intent analysis → extract keywords
 * 2. L0 vector search → find candidate directories
 * 3. L1 exploration within candidates
 * 4. Recursive descent if subdirectories found
 * 5. Return results + trace
 */

import { fileSummaries } from './api.js';

const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_DIRS = 10;
const DEFAULT_MIN_RELEVANCE = 0.3;

export const RETRIEVAL_TRACE = {
  explored: [],
  skipped: [],
  searched: [],

  addExplored(path, reason = 'relevant') {
    this.explored.push({ path, reason, timestamp: Date.now() });
  },

  addSkipped(path, reason = 'not relevant') {
    this.skipped.push({ path, reason, timestamp: Date.now() });
  },

  addSearched(query, resultsCount) {
    this.searched.push({ query, resultsCount, timestamp: Date.now() });
  },

  format() {
    const parts = [];

    if (this.explored.length > 0) {
      const paths = this.explored.map((e) => e.path).join(' → ');
      parts.push(`Explored: ${paths}`);
    }

    if (this.skipped.length > 0) {
      const paths = this.skipped
        .map((s) => `${s.path} (${s.reason})`)
        .join(', ');
      parts.push(`Skipped: ${paths}`);
    }

    return parts.join(' | ') || 'No directories explored';
  },

  reset() {
    this.explored = [];
    this.skipped = [];
    this.searched = [];
  },

  toJSON() {
    return {
      explored: this.explored,
      skipped: this.skipped,
      searched: this.searched,
      summary: this.format(),
    };
  },
};

const INTENT_PROMPT = `Analyze this user query and extract the key search terms and intent.
Return a JSON object with:
- "keywords": array of important terms (excluding common words like "the", "a", "find", etc.)
- "intent": primary intent - one of: "find", "understand", "modify", "create", "debug", "review"
- "domain": inferred domain/topic if apparent

Query: "{query}"

Respond with valid JSON only.`;

const L0_RANKING_PROMPT = `You are ranking directories by relevance to a user query.
Given a directory path and its L0 abstract, determine relevance score (0-1).
Consider:
- Does the directory contain files related to the query?
- Is the domain/topic aligned?

Directory: "{dirPath}"
L0 Abstract: "{abstract}"
Query: "{query}"

Respond with just a number between 0 and 1.`;

const L1_EXPLORE_PROMPT = `Analyze this directory for the user's query.
Given the directory's L1 overview and file list, determine:
1. Does this directory contain relevant content? (yes/no)
2. Should we explore subdirectories? (yes/no/maybe)
3. Key files that match the query

Directory: "{dirPath}"
L1 Overview: "{overview}"
Files: {fileList}
Query: "{query}"

Respond with JSON:
{{"relevant": boolean, "exploreSubdirs": "yes"|"no"|"maybe", "matchingFiles": ["file1", "..."], "reason": "brief explanation"}}`;

/**
 * Analyze user query to extract keywords and intent
 * @param {string} query - User query
 * @param {Function} aiCall - AI call function
 * @returns {Promise<{keywords: string[], intent: string, domain: string}>}
 */
export async function analyzeIntent(query, aiCall) {
  try {
    const prompt = INTENT_PROMPT.replace('{query}', query);
    const response = await aiCall(prompt);

    const parsed = JSON.parse(response);
    return {
      keywords: parsed.keywords || [],
      intent: parsed.intent || 'find',
      domain: parsed.domain || '',
    };
  } catch (e) {
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(w)
      );
    return { keywords, intent: 'find', domain: '' };
  }
}

/**
 * L0 vector search - rank directories by relevance using abstracts
 * @param {string} projectId - Project ID
 * @param {string[]} keywords - Search keywords
 * @param {object} options - Options
 * @returns {Promise<Array>} - Ranked directories with scores
 */
export async function l0VectorSearch(projectId, keywords, options = {}) {
  const {
    maxResults = DEFAULT_MAX_DIRS,
    minRelevance = DEFAULT_MIN_RELEVANCE,
  } = options;

  try {
    const result = await fileSummaries.list(projectId);
    const summaries = result?.summaries || [];

    if (summaries.length === 0) {
      return [];
    }

    const dirMap = new Map();

    for (const summary of summaries) {
      const filePath = summary.file_path;
      const dir = filePath.includes('/') ? filePath.split('/')[0] : 'root';

      if (!dirMap.has(dir)) {
        dirMap.set(dir, {
          path: dir,
          abstract: summary.l0_abstract || '',
          overview: summary.l1_overview || '',
          files: [],
        });
      }

      const dirInfo = dirMap.get(dir);
      dirInfo.files.push({
        path: filePath,
        abstract: summary.l0_abstract,
        overview: summary.l1_overview,
      });
    }

    const dirs = Array.from(dirMap.values());

    const scored = dirs.map((dir) => {
      const dirText =
        `${dir.path} ${dir.abstract} ${dir.overview}`.toLowerCase();
      let score = 0;

      for (const keyword of keywords) {
        if (dirText.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }

      score = score / Math.max(keywords.length, 1);

      return { ...dir, score };
    });

    RETRIEVAL_TRACE.addSearched(keywords.join(' '), scored.length);

    return scored
      .filter((d) => d.score >= minRelevance)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  } catch (e) {
    console.error('L0 search error:', e);
    return [];
  }
}

/**
 * L1 exploration - analyze directory content using L1 overviews
 * @param {object} dir - Directory info
 * @param {string} query - User query
 * @param {Function} aiCall - AI call function
 * @returns {Promise<{relevant: boolean, exploreSubdirs: string, matchingFiles: string[]}>}
 */
export async function l1Explore(dir, query, aiCall) {
  try {
    const fileList = dir.files
      .slice(0, 20)
      .map((f) => f.path)
      .join(', ');

    const prompt = L1_EXPLORE_PROMPT.replace('{dirPath}', dir.path)
      .replace('{overview}', dir.overview.substring(0, 500))
      .replace('{fileList}', fileList)
      .replace('{query}', query);

    const response = await aiCall(prompt);
    return JSON.parse(response);
  } catch (e) {
    const dirText = `${dir.path} ${dir.overview}`.toLowerCase();
    const queryLower = query.toLowerCase();
    const keywordMatches = queryLower
      .split(/\s+/)
      .filter((w) => dirText.includes(w));

    return {
      relevant: keywordMatches.length > 0,
      exploreSubdirs: keywordMatches.length > 1 ? 'maybe' : 'no',
      matchingFiles: dir.files
        .filter((f) =>
          `${f.path} ${f.abstract}`.toLowerCase().includes(queryLower)
        )
        .slice(0, 5)
        .map((f) => f.path),
      reason: 'fallback keyword matching',
    };
  }
}

/**
 * Get subdirectories of a given directory
 * @param {string} projectId - Project ID
 * @param {string} parentDir - Parent directory path
 * @returns {Promise<string[]>} - List of subdirectory paths
 */
export async function getSubdirectories(projectId, parentDir) {
  try {
    const result = await fileSummaries.list(projectId);
    const summaries = result?.summaries || [];

    const subdirs = new Set();
    const prefix = parentDir === 'root' ? '' : parentDir + '/';

    for (const summary of summaries) {
      const filePath = summary.file_path;
      if (filePath.startsWith(prefix)) {
        const remainder = filePath.slice(prefix.length);
        if (remainder.includes('/')) {
          const subdir = remainder.split('/')[0];
          subdirs.add(prefix + subdir);
        }
      }
    }

    return Array.from(subdirs);
  } catch (e) {
    return [];
  }
}

/**
 * Recursive descent - explore directory tree
 * @param {string} projectId - Project ID
 * @param {string} query - User query
 * @param {object} options - Options
 * @returns {Promise<{results: Array, trace: object}>}
 */
export async function recursiveRetrieval(projectId, query, options = {}) {
  const {
    maxDepth = DEFAULT_MAX_DEPTH,
    maxDirs = DEFAULT_MAX_DIRS,
    aiCall = null,
    initialDirs = [],
  } = options;

  RETRIEVAL_TRACE.reset();

  const results = [];
  const visited = new Set();

  async function explore(dirPath, depth) {
    if (depth > maxDepth || visited.has(dirPath)) {
      if (visited.has(dirPath)) {
        RETRIEVAL_TRACE.addSkipped(dirPath, 'already visited');
      }
      return;
    }

    visited.add(dirPath);

    try {
      const result = await fileSummaries.list(projectId);
      const summaries = result?.summaries || [];

      const dirSummaries = summaries.filter((s) => {
        const fileDir = s.file_path.includes('/')
          ? s.file_path.split('/')[0]
          : 'root';
        return (
          fileDir === dirPath ||
          (dirPath === 'root' && !s.file_path.includes('/'))
        );
      });

      if (dirSummaries.length === 0) {
        RETRIEVAL_TRACE.addSkipped(dirPath, 'no files found');
        return;
      }

      const dirInfo = {
        path: dirPath,
        files: dirSummaries.map((s) => ({
          path: s.file_path,
          abstract: s.l0_abstract,
          overview: s.l1_overview,
        })),
        overview: dirSummaries[0]?.l1_overview || '',
      };

      let shouldExplore = true;

      if (aiCall) {
        const analysis = await l1Explore(dirInfo, query, aiCall);

        if (!analysis.relevant) {
          RETRIEVAL_TRACE.addSkipped(
            dirPath,
            analysis.reason || 'not relevant'
          );
          shouldExplore = false;
        } else {
          RETRIEVAL_TRACE.addExplored(dirPath, analysis.reason || 'relevant');

          if (analysis.matchingFiles?.length > 0) {
            results.push({
              directory: dirPath,
              matchingFiles: analysis.matchingFiles,
              relevance: 'high',
            });
          }
        }

        if (analysis.exploreSubdirs === 'no') {
          shouldExplore = false;
        }
      } else {
        RETRIEVAL_TRACE.addExplored(dirPath, 'keyword match');

        const queryLower = query.toLowerCase();
        const matching = dirInfo.files.filter((f) =>
          `${f.path} ${f.abstract}`.toLowerCase().includes(queryLower)
        );

        if (matching.length > 0) {
          results.push({
            directory: dirPath,
            matchingFiles: matching.map((f) => f.path),
            relevance: 'medium',
          });
        }
      }

      if (shouldExplore && depth < maxDepth) {
        const subdirs = await getSubdirectories(projectId, dirPath);

        for (const subdir of subdirs.slice(0, 5)) {
          await explore(subdir, depth + 1);
        }
      }
    } catch (e) {
      console.error(`Error exploring ${dirPath}:`, e);
      RETRIEVAL_TRACE.addSkipped(dirPath, 'error: ' + e.message);
    }
  }

  if (initialDirs.length > 0) {
    for (const dir of initialDirs.slice(0, maxDirs)) {
      await explore(dir, 0);
    }
  } else {
    const candidates = await l0VectorSearch(
      projectId,
      query.split(/\s+/).filter((w) => w.length > 2),
      { maxResults: maxDirs }
    );

    for (const candidate of candidates) {
      await explore(candidate.path, 0);
    }
  }

  return {
    results: results.slice(0, 20),
    trace: RETRIEVAL_TRACE.toJSON(),
  };
}

/**
 * Main entry point for recursive directory retrieval
 * @param {string} projectId - Project ID
 * @param {string} query - User query
 * @param {object} options - Options including aiCall for L1 analysis
 * @returns {Promise<{results: Array, trace: object}>}
 */
export async function retrieveContext(projectId, query, options = {}) {
  const { aiCall = null } = options;

  let keywords;

  if (aiCall) {
    const intent = await analyzeIntent(query, aiCall);
    keywords = intent.keywords;
  } else {
    keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 2 &&
          !['the', 'and', 'for', 'with', 'from', 'find', 'look'].includes(w)
      );
  }

  const l0Results = await l0VectorSearch(projectId, keywords);

  const initialDirs = l0Results
    .filter((d) => d.score >= 0.3)
    .map((d) => d.path);

  return recursiveRetrieval(projectId, query, {
    ...options,
    initialDirs,
    aiCall,
  });
}

export default {
  RETRIEVAL_TRACE,
  analyzeIntent,
  l0VectorSearch,
  l1Explore,
  getSubdirectories,
  recursiveRetrieval,
  retrieveContext,
};
