/**
 * Memory Module Tests
 */

import {
  listMemories,
  createMemory,
  extractMemories,
  getMemoryInsights,
  getMemoryContext,
  MEMORY_CATEGORIES,
  MEMORY_SOURCES,
} from '../memory.js';

// Mock fetch
global.fetch = jest.fn();

describe('Memory Module', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('Constants', () => {
    it('should have all memory categories', () => {
      expect(MEMORY_CATEGORIES.PROFILE).toBe('profile');
      expect(MEMORY_CATEGORIES.PREFERENCES).toBe('preferences');
      expect(MEMORY_CATEGORIES.ENTITIES).toBe('entities');
      expect(MEMORY_CATEGORIES.EVENTS).toBe('events');
      expect(MEMORY_CATEGORIES.CASES).toBe('cases');
      expect(MEMORY_CATEGORIES.PATTERNS).toBe('patterns');
    });

    it('should have all memory sources', () => {
      expect(MEMORY_SOURCES.WORKFLOW).toBe('workflow');
      expect(MEMORY_SOURCES.TASK).toBe('task');
      expect(MEMORY_SOURCES.PROJECT).toBe('project');
      expect(MEMORY_SOURCES.SESSION).toBe('session');
      expect(MEMORY_SOURCES.CHECKIN).toBe('checkin');
      expect(MEMORY_SOURCES.MANUAL).toBe('manual');
    });
  });

  describe('listMemories', () => {
    it('should fetch memories from API', async () => {
      const mockMemories = [
        { id: 1, category: 'patterns', title: 'Test Pattern' },
        { id: 2, category: 'preferences', title: 'Pref' },
      ];

      fetch.mockResolvedValueOnce({
        json: async () => ({ memories: mockMemories }),
      });

      const result = await listMemories();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=memories'),
        expect.any(Object)
      );
      expect(result.memories).toHaveLength(2);
    });

    it('should pass filter options', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({ memories: [] }),
      });

      await listMemories({ category: 'patterns', active: true });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=patterns'),
        expect.any(Object)
      );
    });
  });

  describe('createMemory', () => {
    it('should create memory via API', async () => {
      const newMemory = {
        category: 'patterns',
        title: 'New Pattern',
        content: 'Test content',
      };

      fetch.mockResolvedValueOnce({
        json: async () => ({ success: true, id: 123 }),
      });

      const result = await createMemory(newMemory);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=memories'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newMemory),
        })
      );
    });
  });

  describe('extractMemories', () => {
    it('should extract memories from source', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          extracted: [{ category: 'patterns', title: 'Extracted' }],
        }),
      });

      const result = await extractMemories('workflow', 'wf-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=extract-memories'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ source_type: 'workflow', source_id: 'wf-1' }),
        })
      );
    });
  });

  describe('getMemoryInsights', () => {
    it('should fetch insights', async () => {
      const mockInsights = {
        stats: { total: 10, by_category: {} },
        recent_patterns: [],
        generated_insights: [],
      };

      fetch.mockResolvedValueOnce({
        json: async () => mockInsights,
      });

      const result = await getMemoryInsights();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=memory-insights'),
        expect.any(Object)
      );
    });
  });

  describe('getMemoryContext', () => {
    it('should format memories for AI context', async () => {
      const mockMemories = [
        {
          category: 'patterns',
          title: 'Estimation',
          content: 'Usually underestimate by 2x',
          accessed_count: 10,
        },
        {
          category: 'preferences',
          title: 'Work Time',
          content: 'Best in morning',
          accessed_count: 5,
        },
      ];

      fetch.mockResolvedValueOnce({
        json: async () => ({ memories: mockMemories }),
      });

      const context = await getMemoryContext(10);

      expect(context).toContain('## PATTERNS');
      expect(context).toContain('Estimation: Usually underestimate by 2x');
      expect(context).toContain('## PREFERENCES');
      expect(context).toContain('Work Time: Best in morning');
    });

    it('should return empty string for no memories', async () => {
      fetch.mockResolvedValueOnce({
        json: async () => ({ memories: [] }),
      });

      const context = await getMemoryContext();

      expect(context).toBe('');
    });

    it('should limit to maxMemories', async () => {
      const manyMemories = Array(20)
        .fill(null)
        .map((_, i) => ({
          category: 'patterns',
          title: `Pattern ${i}`,
          content: `Content ${i}`,
          accessed_count: i,
        }));

      fetch.mockResolvedValueOnce({
        json: async () => ({ memories: manyMemories }),
      });

      const context = await getMemoryContext(5);

      // Should only include top 5 by accessed_count
      expect(context.match(/Pattern/g) || []).toHaveLength(5);
    });
  });
});
