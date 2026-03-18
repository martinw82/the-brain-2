/**
 * Workflow Engine Tests
 */

import {
  startWorkflow,
  executeStep,
  onTaskComplete,
  getProgress,
  formatExecutionLog,
} from '../workflows.js';
import { workflowInstances, tasks } from '../api.js';
import { selectAgent } from '../agents.js';

// Mock dependencies
jest.mock('../api.js', () => ({
  workflowInstances: {
    start: jest.fn(),
    get: jest.fn(),
    completeStep: jest.fn(),
  },
  tasks: {
    create: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../agents.js', () => ({
  selectAgent: jest.fn(),
}));

describe('Workflow Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startWorkflow', () => {
    it('should create instance and execute first step', async () => {
      const mockInstance = {
        id: 'inst-1',
        template_id: 'template-1',
        project_id: 'proj-1',
        status: 'running',
        template_steps: JSON.stringify([
          { id: 'step-1', label: 'Step 1', capability: 'code.write' },
        ]),
      };

      workflowInstances.start.mockResolvedValueOnce({
        success: true,
        instance: mockInstance,
      });

      tasks.create.mockResolvedValueOnce({ success: true, id: 'task-1' });

      const result = await startWorkflow('template-1', 'proj-1');

      expect(workflowInstances.start).toHaveBeenCalledWith('template-1', 'proj-1');
      expect(result.success).toBe(true);
    });

    it('should handle start failure', async () => {
      workflowInstances.start.mockResolvedValueOnce({
        success: false,
        error: 'Template not found',
      });

      const result = await startWorkflow('invalid-template', 'proj-1');

      expect(result.success).toBe(false);
    });
  });

  describe('executeStep', () => {
    const mockInstance = {
      id: 'inst-1',
      project_id: 'proj-1',
      template_steps: JSON.stringify([
        { id: 'step-1', label: 'Security Audit', capability: 'audit.security', auto_assign: true },
        { id: 'step-2', label: 'Fix Issues', capability: 'code.fix' },
      ]),
    };

    it('should create task for step with agent assignment', async () => {
      workflowInstances.get.mockResolvedValueOnce({
        instance: mockInstance,
      });

      selectAgent.mockResolvedValueOnce({
        id: 'system-dev-v1',
        name: 'Dev Agent',
      });

      tasks.create.mockResolvedValueOnce({
        success: true,
        id: 'task-1',
      });

      await executeStep('inst-1', 0);

      expect(selectAgent).toHaveBeenCalledWith('audit.security', { projectId: 'proj-1' });
      expect(tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Security Audit',
          assignee_type: 'agent',
          assignee_id: 'system-dev-v1',
          workflow_instance_id: 'inst-1',
        })
      );
    });

    it('should assign to human if no agent found', async () => {
      workflowInstances.get.mockResolvedValueOnce({
        instance: mockInstance,
      });

      selectAgent.mockResolvedValueOnce(null);

      tasks.create.mockResolvedValueOnce({
        success: true,
        id: 'task-1',
      });

      await executeStep('inst-1', 0);

      expect(tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          assignee_type: 'human',
          assignee_id: 'user',
        })
      );
    });

    it('should handle missing instance', async () => {
      workflowInstances.get.mockResolvedValueOnce({ instance: null });

      // Should not throw
      await expect(executeStep('invalid-inst', 0)).resolves.not.toThrow();
    });
  });

  describe('onTaskComplete', () => {
    it('should advance workflow when task completes', async () => {
      const mockTask = {
        id: 'task-1',
        workflow_instance_id: 'inst-1',
        workflow_step_id: 'step-1',
      };

      const mockInstance = {
        id: 'inst-1',
        current_step_index: 0,
        template_steps: JSON.stringify([
          { id: 'step-1', label: 'Step 1' },
          { id: 'step-2', label: 'Step 2', capability: 'code.write' },
        ]),
      };

      tasks.get.mockResolvedValueOnce({ task: mockTask });
      workflowInstances.get.mockResolvedValueOnce({ instance: mockInstance });
      workflowInstances.completeStep.mockResolvedValueOnce({ success: true });

      await onTaskComplete('task-1');

      expect(workflowInstances.completeStep).toHaveBeenCalledWith('inst-1', expect.any(Object));
    });

    it('should skip if task not part of workflow', async () => {
      tasks.get.mockResolvedValueOnce({
        task: { id: 'task-1', workflow_instance_id: null },
      });

      await onTaskComplete('task-1');

      expect(workflowInstances.get).not.toHaveBeenCalled();
    });
  });

  describe('getProgress', () => {
    it('should calculate progress correctly', () => {
      const instance = {
        template_steps: JSON.stringify([
          { id: 'step-1' },
          { id: 'step-2' },
          { id: 'step-3' },
          { id: 'step-4' },
        ]),
        step_results: JSON.stringify({
          step_1: { status: 'complete' },
          step_2: { status: 'complete' },
        }),
        current_step_index: 2,
      };

      const progress = getProgress(instance);

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
      expect(progress.current).toBe(2);
      expect(progress.progress).toBe(50);
      expect(progress.remaining).toBe(2);
    });

    it('should handle empty steps', () => {
      const instance = {
        template_steps: '[]',
        step_results: '{}',
      };

      const progress = getProgress(instance);

      expect(progress.total).toBe(0);
      expect(progress.progress).toBe(0);
    });

    it('should handle string step_results', () => {
      const instance = {
        template_steps: JSON.stringify([{ id: 'step-1' }]),
        step_results: { step_1: { status: 'complete' } },
      };

      const progress = getProgress(instance);

      expect(progress.completed).toBe(1);
    });

    it('should return zeros on error', () => {
      const instance = {
        template_steps: 'invalid json',
      };

      const progress = getProgress(instance);

      expect(progress.total).toBe(0);
      expect(progress.progress).toBe(0);
    });
  });

  describe('formatExecutionLog', () => {
    it('should parse log entries', () => {
      const logText = `2026-03-15T10:00:00Z: Workflow started
2026-03-15T10:05:00Z: Step 1 completed
2026-03-15T10:30:00Z: Step 2 assigned to Dev Agent`;

      const entries = formatExecutionLog(logText);

      expect(entries).toHaveLength(3);
      expect(entries[0].timestamp).toBe('2026-03-15T10:00:00Z');
      expect(entries[0].message).toBe('Workflow started');
      expect(entries[0].time).toBeDefined();
    });

    it('should handle lines without timestamp', () => {
      const logText = 'Some log line without timestamp';

      const entries = formatExecutionLog(logText);

      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Some log line without timestamp');
      expect(entries[0].time).toBeNull();
    });

    it('should return empty array for empty log', () => {
      expect(formatExecutionLog('')).toEqual([]);
      expect(formatExecutionLog(null)).toEqual([]);
    });
  });
});
