/**
 * Recursive Directory Retrieval Tests
 */

import {
  analyzeIntent,
  rankDirectories,
  exploreDirectory,
  retrieveContext,
  formatRetrievalTrace,
} from '../retrieval.js';
import { getAgents } from '../agents.js';

// Mock dependencies
jest.mock('../agents.js', () => ({
  getAgents: jest.fn(),
}));

global.fetch = jest.fn();

describe('Retrieval Module', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('analyzeIntent', () => {
    it('should extract keywords from query', () => {
      const result = analyzeIntent('How does authentication work in this project?');

      expect(result.keywords).toContain('authentication');
      expect(result.keywords).toContain('work');
      expect(result.keywords).toContain('project');
      expect(result.intent).toBe('understand');
    });

    it('should identify code-related intent', () => {
      const result = analyzeIntent('Show me the API routes');

      expect(result.domain).toContain('code');
      expect(result.keywords).toContain('api');
      expect(result.keywords).toContain('routes');
    });

    it('should identify documentation intent', () => {
      const result = analyzeIntent('Where is the README?');

      expect(result.domain).toContain('documentation');
      expect(result.keywords).toContain('readme');
    });

    it('should handle empty query', () => {
      const result = analyzeIntent('');

      expect(result.keywords).toEqual([]);
      expect(result.intent).toBe('general');
    });
  });

  describe('rankDirectories', () => {
    const mockDirectories = [
      { path: 'src/auth', l0_abstract: 'Authentication module with login/signup' },
      { path: 'src/api', l0_abstract: 'API routes and controllers' },
      { path: 'src/utils', l0_abstract: 'Utility functions and helpers' },
    ];

    it('should rank directories by relevance', () => {
      const ranked = rankDirectories(mockDirectories, ['authentication', 'login']);

      expect(ranked[0].path).toBe('src/auth');
      expect(ranked[0].relevanceScore).toBeGreaterThan(0);
    });

    it('should return all directories sorted', () => {
      const ranked = rankDirectories(mockDirectories, ['api']);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].path).toBe('src/api');
    });

    it('should handle empty keywords', () => {
      const ranked = rankDirectories(mockDirectories, []);

      expect(ranked).toHaveLength(3);
      expect(ranked.every(r => r.relevanceScore === 0)).toBe(true);
    });
  });

  describe('exploreDirectory', () => {
    it('should fetch directory contents', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({
          files: [
            { path: 'src/auth/login.js', l0_abstract: 'Login logic' },
            { path: 'src/auth/signup.js', l0_abstract: 'Signup logic' },
          ],
        }),
      });

      const result = await exploreDirectory('proj-1', 'src/auth', 2);

      expect(result.files).toHaveLength(2);
      expect(result.path).toBe('src/auth');
      expect(result.explored).toBe(true);
    });

    it('should handle max depth', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({
          files: [],
          subdirectories: ['src/auth/oauth'],
        }),
      });

      const result = await exploreDirectory('proj-1', 'src/auth', 0);

      expect(result.explored).toBe(true);
      expect(result.depth).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await exploreDirectory('proj-1', 'invalid', 3);

      expect(result.explored).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('formatRetrievalTrace', () => {
    it('should format trace with explored and skipped', () => {
      const trace = {
        explored: ['src/auth', 'src/api'],
        skipped: ['node_modules', '.git'],
      };

      const formatted = formatRetrievalTrace(trace);

      expect(formatted).toContain('Explored:');
      expect(formatted).toContain('src/auth');
      expect(formatted).toContain('Skipped:');
      expect(formatted).toContain('node_modules');
    });

    it('should handle empty trace', () => {
      const formatted = formatRetrievalTrace({ explored: [], skipped: [] });

      expect(formatted).toContain('Explored:');
      expect(formatted).toContain('none');
    });
  });

  describe('retrieveContext', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        json: async () => ({
          summaries: [
            { path: 'src', l0_abstract: 'Source code', type: 'directory' },
            { path: 'src/auth.js', l0_abstract: 'Auth module', type: 'file' },
          ],
        }),
      });

      getAgents.mockResolvedValue([]);
    });

    it('should retrieve context for query', async () => {
      const result = await retrieveContext('proj-1', 'authentication');

      expect(result.query).toBe('authentication');
      expect(result.context).toBeDefined();
      expect(result.trace).toBeDefined();
    });

    it('should respect maxResults', async () => {
      const result = await retrieveContext('proj-1', 'test', { maxResults: 5 });

      expect(result.maxResults).toBe(5);
    });

    it('should include retrieval trace', async () => {
      const result = await retrieveContext('proj-1', 'authentication');

      expect(result.trace.explored).toBeDefined();
      expect(result.trace.skipped).toBeDefined();
    });
  });
});
