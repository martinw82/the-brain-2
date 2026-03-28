/**
 * File Summaries Tests
 */

import {
  checkSummaryStatus,
  storeSummaries,
  buildSummaryContext,
  L0_PROMPT,
  L1_PROMPT,
} from '../summaries.js';
import { contentHash } from '../uri.js';
import { fileSummaries } from '../api.js';

// Mock API
jest.mock('../api.js', () => ({
  fileSummaries: {
    get: jest.fn(),
    store: jest.fn(),
    list: jest.fn(),
  },
}));

describe('Summaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSummaryStatus', () => {
    it('should indicate update needed when no summary exists', async () => {
      fileSummaries.get.mockResolvedValueOnce({ summary: null });

      const result = await checkSummaryStatus('proj-1', 'test.md', 'content');

      expect(result.needsUpdate).toBe(true);
      expect(result.reason).toBe('no_summary');
    });

    it('should indicate update needed when content changed', async () => {
      const oldContent = 'old content';
      const newContent = 'new content';
      const oldHash = contentHash(oldContent);

      fileSummaries.get.mockResolvedValueOnce({
        summary: { content_hash: oldHash },
      });

      const result = await checkSummaryStatus('proj-1', 'test.md', newContent);

      expect(result.needsUpdate).toBe(true);
      expect(result.reason).toBe('content_changed');
    });

    it('should not need update when content unchanged', async () => {
      const content = 'same content';
      const hash = contentHash(content);

      fileSummaries.get.mockResolvedValueOnce({
        summary: { content_hash: hash },
      });

      const result = await checkSummaryStatus('proj-1', 'test.md', content);

      expect(result.needsUpdate).toBe(false);
    });
  });

  describe('storeSummaries', () => {
    it('should store L0 and L1 summaries', async () => {
      const summaryData = {
        l0_abstract: 'Short abstract',
        l1_overview: 'Detailed overview',
      };

      fileSummaries.store.mockResolvedValueOnce({ success: true });

      const content = 'file content';
      const result = await storeSummaries(
        'proj-1',
        'test.md',
        content,
        summaryData
      );

      expect(fileSummaries.store).toHaveBeenCalledWith(
        'proj-1',
        'test.md',
        expect.objectContaining({
          l0_abstract: 'Short abstract',
          l1_overview: 'Detailed overview',
          content_hash: expect.any(String),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('buildSummaryContext', () => {
    it('should build context from summaries', async () => {
      const mockSummaries = [
        {
          file_path: 'README.md',
          l0_abstract: 'Project readme',
          token_count: 100,
        },
        {
          file_path: 'src/index.js',
          l0_abstract: 'Entry point',
          token_count: 50,
        },
      ];

      fileSummaries.list.mockResolvedValueOnce({ summaries: mockSummaries });

      const context = await buildSummaryContext('proj-1');

      expect(context).toContain('README.md');
      expect(context).toContain('Project readme');
      expect(context).toContain('src/index.js');
      expect(context).toContain('Entry point');
    });

    it('should handle empty summaries', async () => {
      fileSummaries.list.mockResolvedValueOnce({ summaries: [] });

      const context = await buildSummaryContext('proj-1');

      expect(context).toBe('');
    });

    it('should calculate total tokens', async () => {
      const mockSummaries = [
        { file_path: 'a.md', l0_abstract: 'A', token_count: 100 },
        { file_path: 'b.md', l0_abstract: 'B', token_count: 200 },
      ];

      fileSummaries.list.mockResolvedValueOnce({ summaries: mockSummaries });

      const context = await buildSummaryContext('proj-1');

      // Should include metadata about total tokens
      expect(context).toContain('300'); // Total tokens
    });
  });

  describe('Prompts', () => {
    it('should have L0 prompt defined', () => {
      expect(L0_PROMPT).toBeDefined();
      expect(L0_PROMPT).toContain('100 tokens');
    });

    it('should have L1 prompt defined', () => {
      expect(L1_PROMPT).toBeDefined();
      expect(L1_PROMPT).toContain('2000 tokens');
    });
  });
});
