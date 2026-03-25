/**
 * URI Utility Tests
 * Tests for brain:// URI parsing and generation
 */

import {
  parseURI,
  generateURI,
  fileURI,
  projectURI,
  taskURI,
  goalURI,
  isValidURI,
  extractURIs,
  uriToNavigation,
  resolveLabel,
  contentHash,
} from '../../uri.js';

describe('URI Utilities', () => {
  describe('parseURI', () => {
    it('should parse project URI', () => {
      const result = parseURI('brain://project/my-app');
      expect(result).toEqual({
        type: 'project',
        projectId: 'my-app',
        path: null,
        id: null,
      });
    });

    it('should parse project file URI', () => {
      const result = parseURI('brain://project/my-app/file/README.md');
      expect(result).toEqual({
        type: 'file',
        projectId: 'my-app',
        path: 'README.md',
        id: null,
      });
    });

    it('should parse nested file URI', () => {
      const result = parseURI('brain://project/my-app/file/docs/guide.md');
      expect(result).toEqual({
        type: 'file',
        projectId: 'my-app',
        path: 'docs/guide.md',
        id: null,
      });
    });

    it('should parse task URI', () => {
      const result = parseURI('brain://task/123');
      expect(result).toEqual({
        type: 'task',
        projectId: null,
        path: null,
        id: '123',
      });
    });

    it('should parse goal URI', () => {
      const result = parseURI('brain://goal/thailand-fund');
      expect(result).toEqual({
        type: 'goal',
        projectId: null,
        path: null,
        id: 'thailand-fund',
      });
    });

    it('should return null for invalid URIs', () => {
      expect(parseURI('not-a-uri')).toBeNull();
      expect(parseURI('http://example.com')).toBeNull();
      expect(parseURI('')).toBeNull();
      expect(parseURI(null)).toBeNull();
    });
  });

  describe('generateURI', () => {
    it('should generate project URI', () => {
      expect(generateURI('project', 'my-app')).toBe('brain://project/my-app');
    });

    it('should generate file URI', () => {
      expect(generateURI('file', 'my-app', 'README.md')).toBe(
        'brain://project/my-app/file/README.md'
      );
    });

    it('should generate task URI', () => {
      expect(generateURI('task', null, null, '456')).toBe('brain://task/456');
    });
  });

  describe('fileURI', () => {
    it('should create file URI shorthand', () => {
      expect(fileURI('my-app', 'src/index.js')).toBe(
        'brain://project/my-app/file/src/index.js'
      );
    });
  });

  describe('projectURI', () => {
    it('should create project URI shorthand', () => {
      expect(projectURI('my-app')).toBe('brain://project/my-app');
    });
  });

  describe('isValidURI', () => {
    it('should validate correct URIs', () => {
      expect(isValidURI('brain://project/test')).toBe(true);
      expect(isValidURI('brain://task/123')).toBe(true);
      expect(isValidURI('brain://goal/savings')).toBe(true);
    });

    it('should reject invalid URIs', () => {
      expect(isValidURI('not-a-uri')).toBe(false);
      expect(isValidURI('')).toBe(false);
      expect(isValidURI(null)).toBe(false);
    });
  });

  describe('extractURIs', () => {
    it('should extract URIs from text', () => {
      const text =
        'Check brain://project/my-app/file/README.md and brain://task/123 for details.';
      const uris = extractURIs(text);
      expect(uris).toEqual([
        'brain://project/my-app/file/README.md',
        'brain://task/123',
      ]);
    });

    it('should return empty array for text without URIs', () => {
      expect(extractURIs('No URIs here')).toEqual([]);
    });

    it('should handle multiple URIs on same line', () => {
      const text = 'brain://project/a brain://project/b brain://task/1';
      expect(extractURIs(text)).toHaveLength(3);
    });
  });

  describe('uriToNavigation', () => {
    it('should convert project URI to navigation action', () => {
      const action = uriToNavigation('brain://project/my-app');
      expect(action).toEqual({
        view: 'hub',
        hubId: 'my-app',
      });
    });

    it('should convert file URI to navigation action', () => {
      const action = uriToNavigation('brain://project/my-app/file/README.md');
      expect(action).toEqual({
        view: 'hub',
        hubId: 'my-app',
        file: 'README.md',
      });
    });

    it('should return null for invalid URI', () => {
      expect(uriToNavigation('invalid')).toBeNull();
    });
  });

  describe('resolveLabel', () => {
    it('should generate label for project URI', () => {
      expect(resolveLabel('brain://project/my-app')).toBe('Project: my-app');
    });

    it('should generate label for file URI', () => {
      expect(resolveLabel('brain://project/my-app/file/README.md')).toBe(
        'File: README.md'
      );
    });

    it('should generate label for task URI', () => {
      expect(resolveLabel('brain://task/123')).toBe('Task #123');
    });
  });

  describe('contentHash', () => {
    it('should generate consistent hash for same content', () => {
      const hash1 = contentHash('hello world');
      const hash2 = contentHash('hello world');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = contentHash('hello');
      const hash2 = contentHash('world');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      expect(contentHash('')).toBeTruthy();
    });

    it('should handle large content', () => {
      const largeContent = 'a'.repeat(10000);
      expect(contentHash(largeContent)).toBeTruthy();
      expect(contentHash(largeContent).length).toBe(64); // SHA-256 hex
    });
  });
});
