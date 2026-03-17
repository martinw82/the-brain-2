import { useEffect } from 'react';
import { tasks as tasksApi, agentExecution } from '../api.js';

/**
 * Hook for task CRUD and agent task polling.
 */
export default function useTaskOps(deps) {
  const {
    tasks,
    setTasks,
    setTasksLoading,
    setShowTaskModal,
    setTaskForm,
    setTaskAgents,
    showToast,
  } = deps;

  const loadTasks = async () => {
    try {
      setTasksLoading(true);
      const data = await tasksApi.myTasks();
      if (data && data.tasks) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error('Tasks load error:', e);
    } finally {
      setTasksLoading(false);
    }
  };

  // Phase 5.6: Poll executing agent tasks
  useEffect(() => {
    const executingTasks = tasks.filter(
      (t) => t.assignee_type === 'agent' && t.status === 'in_progress'
    );
    if (executingTasks.length === 0) return;
    const interval = setInterval(async () => {
      try {
        // Re-fetch all tasks to get current statuses from the server
        const data = await tasksApi.myTasks();
        if (data && data.tasks) {
          setTasks(data.tasks);
        }
      } catch {
        /* ignore polling errors */
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [tasks]);

  const createTask = async (taskData) => {
    try {
      const result = await tasksApi.create(taskData);
      if (result.success) {
        showToast(
          `Task created${taskData.assignee_type === 'agent' ? ` → assigned to ${taskData.assignee_id}` : ''}`
        );
        loadTasks();
        setShowTaskModal(false);
        setTaskForm({
          title: '',
          description: '',
          priority: 'medium',
          project_id: '',
          assignee_type: 'human',
          assignee_id: 'user',
        });
        setTaskAgents([]);
      }
    } catch (e) {
      console.error('Create task error:', e);
      showToast('Failed to create task');
    }
  };

  const completeTask = async (id) => {
    try {
      await tasksApi.complete(id, 'Completed manually');
      showToast('Task completed');
      loadTasks();
    } catch (e) {
      console.error('Complete task error:', e);
      showToast('Failed to complete task');
    }
  };

  const deleteTask = async (id) => {
    try {
      await tasksApi.delete(id);
      showToast('Task deleted');
      loadTasks();
    } catch (e) {
      console.error('Delete task error:', e);
      showToast('Failed to delete task');
    }
  };

  return { loadTasks, createTask, completeTask, deleteTask };
}
