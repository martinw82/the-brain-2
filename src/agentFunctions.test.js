/**
 * Agent Functions Tests
 * Tests for function calling system
 */

import {
  FUNCTION_DEFINITIONS,
  setExecutionContext,
  executeFunction,
  formatFunctionResult,
} from '../agentFunctions.js';
import { tasks as tasksApi, projects as projectsApi } from '../api.js';

// Mock API
jest.mock('../api.js', () => ({
  tasks: {
    create: jest.fn(),
    complete: jest.fn(),
  },
  projects: {
    get: jest.fn(),
    saveFile: jest.fn(),
  },
}));

global.fetch = jest.fn();

describe('Agent Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setExecutionContext({
      projectId: 'test-project',
      taskId: 'task-123',
      userId: 'user-123',
    });
  });

  describe('FUNCTION_DEFINITIONS', () => {
    it('should have all required functions', () => {
      const functionNames = FUNCTION_DEFINITIONS.map((f) => f.name);

      expect(functionNames).toContain('read_file');
      expect(functionNames).toContain('write_file');
      expect(functionNames).toContain('create_task');
      expect(functionNames).toContain('search_projects');
      expect(functionNames).toContain('mark_complete');
      expect(functionNames).toContain('request_review');
    });

    it('should have proper schemas for each function', () => {
      FUNCTION_DEFINITIONS.forEach((func) => {
        expect(func.name).toBeDefined();
        expect(func.description).toBeDefined();
        expect(func.parameters).toBeDefined();
        expect(func.parameters.type).toBe('object');
        expect(func.parameters.properties).toBeDefined();
      });
    });

    it('should have read_file schema', () => {
      const readFile = FUNCTION_DEFINITIONS.find((f) => f.name === 'read_file');

      expect(readFile.parameters.properties.uri).toBeDefined();
      expect(readFile.parameters.required).toContain('uri');
    });

    it('should have write_file schema', () => {
      const writeFile = FUNCTION_DEFINITIONS.find(
        (f) => f.name === 'write_file'
      );

      expect(writeFile.parameters.properties.uri).toBeDefined();
      expect(writeFile.parameters.properties.content).toBeDefined();
      expect(writeFile.parameters.properties.mode).toBeDefined();
      expect(writeFile.parameters.properties.mode.enum).toEqual([
        'create',
        'update',
        'preview',
      ]);
    });

    it('should have create_task schema', () => {
      const createTask = FUNCTION_DEFINITIONS.find(
        (f) => f.name === 'create_task'
      );

      expect(createTask.parameters.properties.title).toBeDefined();
      expect(createTask.parameters.properties.assignee_type).toBeDefined();
      expect(createTask.parameters.properties.assignee_type.enum).toEqual([
        'human',
        'agent',
      ]);
    });
  });

  describe('setExecutionContext', () => {
    it('should set context for function execution', () => {
      setExecutionContext({
        projectId: 'proj-456',
        taskId: 'task-789',
      });

      // Context is used internally, verified through executeFunction tests
      expect(() => setExecutionContext({})).not.toThrow();
    });
  });

  describe('executeFunction', () => {
    it('should execute read_file function', async () => {
      const fileContent = '# README\n\nProject description.';

      fetch.mockResolvedValueOnce({
        json: async () => ({ file: { content: fileContent } }),
      });

      const result = await executeFunction('read_file', {
        uri: 'brain://project/test-project/file/README.md',
      });

      expect(result.success).toBe(true);
      expect(result.content).toBe(fileContent);
    });

    it('should execute write_file function in preview mode', async () => {
      const result = await executeFunction('write_file', {
        uri: 'brain://project/test-project/file/test.md',
        content: '# New File',
        mode: 'preview',
      });

      expect(result.success).toBe(true);
      expect(result.preview).toBe(true);
      expect(result.changes).toBeDefined();
    });

    it('should execute write_file function in create mode', async () => {
      projectsApi.saveFile.mockResolvedValueOnce({ success: true });

      const result = await executeFunction('write_file', {
        uri: 'brain://project/test-project/file/test.md',
        content: '# New File',
        mode: 'create',
      });

      expect(projectsApi.saveFile).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should execute create_task function', async () => {
      tasksApi.create.mockResolvedValueOnce({
        success: true,
        id: 'new-task-123',
      });

      const result = await executeFunction('create_task', {
        title: 'New Task',
        description: 'Task description',
        priority: 'high',
        assignee_type: 'agent',
        assignee_id: 'system-dev-v1',
      });

      expect(tasksApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Task',
          priority: 'high',
        })
      );
      expect(result.success).toBe(true);
      expect(result.task_id).toBe('new-task-123');
    });

    it('should execute mark_complete function', async () => {
      tasksApi.complete.mockResolvedValueOnce({ success: true });

      const result = await executeFunction('mark_complete', {
        task_id: 'task-123',
        summary: 'Completed the work',
        outputs: ['brain://project/test-project/file/result.md'],
      });

      expect(tasksApi.complete).toHaveBeenCalledWith(
        'task-123',
        'Completed the work',
        expect.any(Array)
      );
      expect(result.success).toBe(true);
    });

    it('should handle unknown functions', async () => {
      const result = await executeFunction('unknown_function', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown function');
    });

    it('should handle execution errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await executeFunction('read_file', {
        uri: 'brain://project/test/file.md',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('formatFunctionResult', () => {
    it('should format successful result', () => {
      const result = {
        success: true,
        content: 'File content here',
      };

      const formatted = formatFunctionResult('read_file', result);

      expect(formatted).toContain('✓ read_file succeeded');
      expect(formatted).toContain('File content here');
    });

    it('should format failed result', () => {
      const result = {
        success: false,
        error: 'File not found',
      };

      const formatted = formatFunctionResult('read_file', result);

      expect(formatted).toContain('✗ read_file failed');
      expect(formatted).toContain('File not found');
    });

    it('should handle preview mode result', () => {
      const result = {
        success: true,
        preview: true,
        changes: { added: 5, removed: 2 },
      };

      const formatted = formatFunctionResult('write_file', result);

      expect(formatted).toContain('preview');
      expect(formatted).toContain('5');
      expect(formatted).toContain('2');
    });
  });
});
