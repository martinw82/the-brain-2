/**
 * useTaskOps Hook Tests
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import useTaskOps from '../../hooks/useTaskOps';
import { tasks as tasksApi } from '../../api.js';

jest.mock('../../api.js', () => ({
  tasks: {
    list: jest.fn(),
    myTasks: jest.fn(),
    create: jest.fn(),
    complete: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('useTaskOps', () => {
  const mockDeps = {
    tasks: [],
    setTasks: jest.fn(),
    setTasksLoading: jest.fn(),
    setShowTaskModal: jest.fn(),
    setTaskForm: jest.fn(),
    setTaskAgents: jest.fn(),
    showToast: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadTasks', () => {
    it('should load tasks and update state', async () => {
      const mockTasks = [
        { id: 1, title: 'Task 1' },
        { id: 2, title: 'Task 2' },
      ];
      tasksApi.myTasks.mockResolvedValueOnce({ tasks: mockTasks });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.loadTasks();
      });

      expect(mockDeps.setTasksLoading).toHaveBeenCalledWith(true);
      expect(tasksApi.myTasks).toHaveBeenCalled();
      expect(mockDeps.setTasks).toHaveBeenCalledWith(mockTasks);
      expect(mockDeps.setTasksLoading).toHaveBeenCalledWith(false);
    });

    it('should handle load errors', async () => {
      tasksApi.myTasks.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.loadTasks();
      });

      expect(mockDeps.setTasksLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('createTask', () => {
    const newTaskData = {
      title: 'New Task',
      description: 'Description',
      priority: 'high',
      assignee_type: 'human',
      assignee_id: 'user',
    };

    it('should create task and show success toast', async () => {
      tasksApi.create.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.createTask(newTaskData);
      });

      expect(tasksApi.create).toHaveBeenCalledWith(newTaskData);
      expect(mockDeps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('Task created')
      );
      expect(mockDeps.setShowTaskModal).toHaveBeenCalledWith(false);
    });

    it('should show agent assignment in toast', async () => {
      const agentTask = {
        ...newTaskData,
        assignee_type: 'agent',
        assignee_id: 'system-dev-v1',
      };
      tasksApi.create.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.createTask(agentTask);
      });

      expect(mockDeps.showToast).toHaveBeenCalledWith(
        expect.stringContaining('system-dev-v1')
      );
    });

    it('should reset form after creation', async () => {
      tasksApi.create.mockResolvedValueOnce({ success: true });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.createTask(newTaskData);
      });

      expect(mockDeps.setTaskForm).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '',
          description: '',
          priority: 'medium',
        })
      );
    });

    it('should handle creation errors', async () => {
      tasksApi.create.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.createTask(newTaskData);
      });

      expect(mockDeps.showToast).toHaveBeenCalledWith('Failed to create task');
    });
  });

  describe('completeTask', () => {
    it('should complete task and reload', async () => {
      tasksApi.complete.mockResolvedValueOnce({ success: true });
      tasksApi.myTasks.mockResolvedValueOnce({ tasks: [] });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.completeTask(123);
      });

      expect(tasksApi.complete).toHaveBeenCalledWith(123, 'Completed manually');
      expect(mockDeps.showToast).toHaveBeenCalledWith('Task completed');
    });

    it('should handle completion errors', async () => {
      tasksApi.complete.mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.completeTask(123);
      });

      expect(mockDeps.showToast).toHaveBeenCalledWith(
        'Failed to complete task'
      );
    });
  });

  describe('deleteTask', () => {
    it('should delete task and reload', async () => {
      tasksApi.delete.mockResolvedValueOnce({ success: true });
      tasksApi.myTasks.mockResolvedValueOnce({ tasks: [] });

      const { result } = renderHook(() => useTaskOps(mockDeps));

      await act(async () => {
        await result.current.deleteTask(123);
      });

      expect(tasksApi.delete).toHaveBeenCalledWith(123);
      expect(mockDeps.showToast).toHaveBeenCalledWith('Task deleted');
    });
  });

  describe('Agent Task Polling', () => {
    it('should poll for executing agent tasks', async () => {
      jest.useFakeTimers();

      const executingTasks = [
        { id: 1, status: 'in_progress', assignee_type: 'agent' },
      ];
      const depsWithTasks = {
        ...mockDeps,
        tasks: executingTasks,
      };

      tasksApi.myTasks.mockResolvedValue({ tasks: executingTasks });

      renderHook(() => useTaskOps(depsWithTasks));

      // Fast-forward 3 seconds (polling interval)
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      await waitFor(() => {
        expect(tasksApi.myTasks).toHaveBeenCalled();
      });

      jest.useRealTimers();
    });

    it('should not poll if no executing tasks', () => {
      jest.useFakeTimers();

      const nonExecutingTasks = [
        { id: 1, status: 'pending', assignee_type: 'human' },
      ];
      const depsWithTasks = {
        ...mockDeps,
        tasks: nonExecutingTasks,
      };

      renderHook(() => useTaskOps(depsWithTasks));

      act(() => {
        jest.advanceTimersByTime(3000);
      });

      expect(tasksApi.myTasks).not.toHaveBeenCalled();

      jest.useRealTimers();
    });
  });
});
