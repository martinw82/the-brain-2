/**
 * Project Factory Tests
 * Tests for project creation utilities
 */

import {
  makeManifest,
  calcHealth,
  makeDefaultFiles,
  makeProject,
} from '../../utils/projectFactory.js';

describe('Project Factory', () => {
  describe('makeManifest', () => {
    it('should create manifest with required fields', () => {
      const manifest = makeManifest({
        id: 'test-project',
        name: 'Test Project',
        phase: 'BOOTSTRAP',
      });

      expect(manifest.id).toBe('test-project');
      expect(manifest.name).toBe('Test Project');
      expect(manifest.phase).toBe('BOOTSTRAP');
      expect(manifest.version).toBe('2.0');
      expect(manifest.created_at).toBeDefined();
    });

    it('should include optional fields when provided', () => {
      const manifest = makeManifest({
        id: 'test-project',
        name: 'Test Project',
        phase: 'BUILD',
        description: 'A test project',
        tags: ['test', 'demo'],
      });

      expect(manifest.description).toBe('A test project');
      expect(manifest.tags).toEqual(['test', 'demo']);
    });
  });

  describe('calcHealth', () => {
    it('should return 100 for perfect health', () => {
      const health = calcHealth({
        last_touched: new Date().toISOString().slice(0, 7),
        momentum: 5,
      });
      expect(health).toBe(100);
    });

    it('should decrease health for old projects', () => {
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 3);
      
      const health = calcHealth({
        last_touched: oldDate.toISOString().slice(0, 7),
        momentum: 5,
      });
      
      expect(health).toBeLessThan(100);
    });

    it('should decrease health for low momentum', () => {
      const health = calcHealth({
        last_touched: new Date().toISOString().slice(0, 7),
        momentum: 1,
      });
      
      expect(health).toBeLessThan(100);
    });

    it('should not return negative health', () => {
      const veryOldDate = new Date();
      veryOldDate.setFullYear(veryOldDate.getFullYear() - 2);
      
      const health = calcHealth({
        last_touched: veryOldDate.toISOString().slice(0, 7),
        momentum: 0,
      });
      
      expect(health).toBeGreaterThanOrEqual(0);
    });
  });

  describe('makeDefaultFiles', () => {
    it('should create PROJECT_OVERVIEW.md', () => {
      const files = makeDefaultFiles({
        id: 'test-project',
        name: 'Test Project',
      });

      expect(files['PROJECT_OVERVIEW.md']).toBeDefined();
      expect(files['PROJECT_OVERVIEW.md']).toContain('Test Project');
    });

    it('should create TASKS.md', () => {
      const files = makeDefaultFiles({ id: 'test' });
      expect(files['TASKS.md']).toBeDefined();
    });

    it('should create DEVLOG.md', () => {
      const files = makeDefaultFiles({ id: 'test' });
      expect(files['DEVLOG.md']).toBeDefined();
    });

    it('should create manifest.json', () => {
      const files = makeDefaultFiles({
        id: 'test-project',
        name: 'Test Project',
      });

      expect(files['system/manifest.json']).toBeDefined();
      const manifest = JSON.parse(files['system/manifest.json']);
      expect(manifest.id).toBe('test-project');
    });
  });

  describe('makeProject', () => {
    it('should create complete project structure', () => {
      const project = makeProject({
        id: 'my-project',
        name: 'My Project',
        phase: 'BUILD',
        priority: 5,
      });

      expect(project.id).toBe('my-project');
      expect(project.name).toBe('My Project');
      expect(project.phase).toBe('BUILD');
      expect(project.priority).toBe(5);
      expect(project.files).toBeDefined();
      expect(project.health).toBeGreaterThan(0);
    });

    it('should use default values when not provided', () => {
      const project = makeProject({
        id: 'minimal-project',
        name: 'Minimal',
      });

      expect(project.phase).toBe('BOOTSTRAP');
      expect(project.priority).toBeDefined();
      expect(project.health).toBeDefined();
    });

    it('should include all standard folders', () => {
      const project = makeProject({ id: 'test', name: 'Test' });
      
      expect(project.files['code-modules/.gitkeep']).toBeDefined();
      expect(project.files['design-assets/.gitkeep']).toBeDefined();
      expect(project.files['content-assets/.gitkeep']).toBeDefined();
      expect(project.files['analytics/.gitkeep']).toBeDefined();
    });
  });
});
