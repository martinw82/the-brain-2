/**
 * API Integration Tests
 * Tests for client-side API wrapper
 */

import {
  auth,
  projects,
  tasks,
  areas,
  goals,
  staging,
  workflowInstances,
} from '../../api.js';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Client', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.clear();
  });

  describe('Authentication', () => {
    it('should login and store token', async () => {
      const mockResponse = {
        success: true,
        token: 'test-jwt-token',
        user: { id: '123', email: 'test@example.com' },
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await auth.login('test@example.com', 'password');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/data?resource=auth&action=login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle login errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      await expect(auth.login('test@example.com', 'wrong')).rejects.toThrow();
    });

    it('should include auth token in requests', async () => {
      localStorage.setItem('brain_token', 'test-token');

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      });

      await projects.list();

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('Projects API', () => {
    it('should list projects', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1' },
        { id: 'proj-2', name: 'Project 2' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: mockProjects }),
      });

      const result = await projects.list();

      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].name).toBe('Project 1');
    });

    it('should create project', async () => {
      const newProject = { id: 'new-proj', name: 'New Project' };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, ...newProject }),
      });

      const result = await projects.create(newProject);

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects?action=create'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newProject),
        })
      );
    });

    it('should save file', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await projects.saveFile('proj-1', 'README.md', '# Content');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects?action=save-file&id=proj-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ path: 'README.md', content: '# Content' }),
        })
      );
    });
  });

  describe('Tasks API', () => {
    it('should list my tasks', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1', status: 'pending' },
        { id: 2, title: 'Task 2', status: 'in_progress' },
      ];

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: mockTasks }),
      });

      const result = await tasks.myTasks();

      expect(result.tasks).toHaveLength(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=tasks&my_tasks=true'),
        expect.any(Object)
      );
    });

    it('should create task', async () => {
      const newTask = {
        title: 'New Task',
        description: 'Task description',
        priority: 'high',
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, id: 123 }),
      });

      const result = await tasks.create(newTask);

      expect(result.success).toBe(true);
      expect(result.id).toBe(123);
    });

    it('should complete task', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await tasks.complete(123, 'Completed successfully');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=tasks&id=123&action=complete'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ result_summary: 'Completed successfully' }),
        })
      );
    });
  });

  describe('Workflow API', () => {
    it('should start workflow instance', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          instance: { id: 'inst-1', status: 'running' },
        }),
      });

      const result = await workflowInstances.start('template-1', 'project-1');

      expect(result.success).toBe(true);
      expect(result.instance.status).toBe('running');
    });

    it('should pause workflow', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      await workflowInstances.pause('inst-1');

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('resource=workflow-instances&id=inst-1'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ action: 'pause' }),
        })
      );
    });
  });

  describe('Offline Fallback', () => {
    it('should return cached data when offline', async () => {
      // Setup cache
      const cachedData = {
        projects: [{ id: 'cached', name: 'Cached Project' }],
      };
      localStorage.setItem(
        'brain_cache_projects',
        JSON.stringify({
          data: cachedData.projects,
          timestamp: Date.now(),
        })
      );

      // Mock network failure
      fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await projects.list();

      expect(result).toEqual(cachedData);
    });

    it('should queue writes when offline', async () => {
      fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      await projects.update('proj-1', { name: 'Updated' });

      // Check that write was queued
      const queue = JSON.parse(
        localStorage.getItem('brain_write_queue') || '[]'
      );
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[0].resource).toBe('projects');
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 unauthorized', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });

      await expect(projects.list()).rejects.toThrow('Unauthorized');
    });

    it('should handle 409 conflict', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Conflict', _conflict: true }),
      });

      const result = await projects.update('proj-1', {});

      expect(result._conflict).toBe(true);
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('NetworkError'));

      // Should try cache fallback or throw
      await expect(projects.list()).rejects.toThrow();
    });
  });
});
