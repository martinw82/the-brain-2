/**
 * Workflow Execution Engine (Phase 5.5)
 * Orchestrates multi-step workflows by creating tasks
 */

import {
  workflowInstances,
  tasks,
  workflows as workflowsApi,
  agentExecution,
  workflowJob,
} from './api.js';
import { selectAgent, buildAgentPrompt } from './agents.js';

/**
 * Queue a job for worker execution (local resources like Remotion)
 * @param {object} instance - Workflow instance
 * @param {object} step - Step definition
 * @param {number} stepIndex - Step index
 */
async function queueWorkerJob(instance, step, stepIndex) {
  try {
    console.log(
      `[Workflow] Step ${stepIndex + 1} requires worker, queuing job...`
    );

    // Determine job type from step
    const jobType = step.capability || 'shell.execute';

    // Build payload based on job type
    let payload = {};

    if (jobType === 'video.render') {
      // For video rendering, we need storyboard JSON
      // This would come from previous step outputs
      payload = {
        storyboard_json: step.storyboard_json || {},
        output_format: 'mp4',
        output_resolution: '1080p',
      };
    } else {
      // Generic shell execution
      payload = step.payload || {};
    }

    // Queue the job
    const result = await workflowJob.queue({
      workflow_id: instance.id,
      task_id: null, // No task for worker jobs
      project_id: instance.project_id,
      job_type: jobType,
      payload,
      priority: 5,
    });

    if (result.success) {
      console.log(`[Workflow] Job queued: ${result.job_id}`);

      // Start polling for job completion
      pollWorkerJob(instance.id, step.id, result.job_id);
    } else {
      console.error(`[Workflow] Failed to queue job:`, result.error);

      // If no worker available, mark step as waiting
      await workflowInstances.updateStatus(instance.id, {
        current_step_index: stepIndex,
        status: 'waiting_for_worker',
        step_status: {
          [step.id]: {
            status: 'waiting',
            message: 'No worker available. Start a Spine worker to continue.',
          },
        },
      });
    }
  } catch (e) {
    console.error('[Workflow] Queue worker job error:', e);
  }
}

/**
 * Poll for worker job completion
 */
async function pollWorkerJob(instanceId, stepId, jobId) {
  const maxAttempts = 3600; // 1 hour at 1 poll per second
  let attempts = 0;

  const poll = async () => {
    attempts++;

    if (attempts > maxAttempts) {
      console.error(`[Workflow] Job ${jobId} timed out`);
      return;
    }

    try {
      const status = await workflowJob.status(jobId);

      if (status.status === 'completed') {
        console.log(`[Workflow] Job ${jobId} completed`);

        // Save output to workflow instance
        await workflowInstances.completeStep(instanceId, {
          step_id: stepId,
          status: 'complete',
          outputs: status.result,
        });

        // Advance workflow
        const instanceResult = await workflowInstances.get(instanceId);
        if (instanceResult?.instance) {
          const nextIndex = getNextStep(instanceResult.instance, [], 0);
          if (nextIndex !== null) {
            await executeStep(instanceId, nextIndex);
          }
        }

        return;
      } else if (status.status === 'failed') {
        console.error(`[Workflow] Job ${jobId} failed:`, status.error);

        await workflowInstances.completeStep(instanceId, {
          step_id: stepId,
          status: 'failed',
          error: status.error,
        });

        return;
      }

      // Still pending/running, poll again
      setTimeout(poll, 2000);
    } catch (e) {
      console.error(`[Workflow] Poll error for job ${jobId}:`, e);
      setTimeout(poll, 5000); // Retry with backoff
    }
  };

  // Start polling
  poll();
}

/**
 * Start a new workflow instance
 * @param {string} templateId - Workflow template ID
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} - Created instance
 */
export async function startWorkflow(templateId, projectId) {
  // Create instance
  const result = await workflowInstances.start(templateId, projectId);

  if (result.success && result.instance) {
    // Execute first step
    await executeStep(result.instance.id, 0);
  }

  return result;
}

/**
 * Execute a workflow step
 * @param {string} instanceId - Workflow instance ID
 * @param {number} stepIndex - Step index to execute
 */
export async function executeStep(instanceId, stepIndex) {
  try {
    // Get instance details
    const instanceResult = await workflowInstances.get(instanceId);
    if (!instanceResult?.instance) {
      console.error('[Workflow] Instance not found:', instanceId);
      return;
    }

    const instance = instanceResult.instance;

    // Parse steps from template
    let steps = [];
    try {
      steps =
        typeof instance.template_steps === 'string'
          ? JSON.parse(instance.template_steps)
          : instance.template_steps || [];
    } catch (e) {
      console.error('[Workflow] Failed to parse steps:', e);
      return;
    }

    if (stepIndex >= steps.length) {
      // Workflow complete
      await workflowInstances.completeStep(instanceId, { steps });
      return;
    }

    const step = steps[stepIndex];

    // Determine assignee
    let assigneeType = 'human';
    let assigneeId = 'user';

    if (step.capability && step.auto_assign) {
      // Find agent by capability
      const agent = await selectAgent(step.capability, {
        projectId: instance.project_id,
      });
      if (agent) {
        assigneeType = 'agent';
        assigneeId = agent.id;
      }
    }

    // Check if step requires worker execution (local resources like Remotion)
    if (step.worker_required) {
      // Queue job for worker instead of creating agent task
      await queueWorkerJob(instance, step, stepIndex);
      return;
    }

    // Create task for this step
    const taskResult = await tasks.create({
      project_id: instance.project_id,
      title: step.label,
      description: step.sop || `Complete workflow step: ${step.label}`,
      assignee_type: assigneeType,
      assignee_id: assigneeId,
      priority: 'medium',
      workflow_instance_id: instanceId,
      workflow_step_id: step.id,
    });

    if (taskResult.success) {
      console.log(
        `[Workflow] Step ${stepIndex + 1} task created: ${taskResult.id}`
      );

      // If assigned to agent and auto_assign, trigger execution (Phase 5.6)
      if (assigneeType === 'agent' && step.auto_assign) {
        try {
          const execResult = await agentExecution.execute(taskResult.id);
          if (execResult.status === 'complete') {
            await onTaskComplete(taskResult.id);
          }
          // 'preview' (assistant mode) or 'blocked' → UI handles via polling
        } catch (execErr) {
          console.error(
            `[Workflow] Agent execution failed for step ${stepIndex + 1}:`,
            execErr
          );
        }
      }
    }
  } catch (e) {
    console.error('[Workflow] Execute step error:', e);
  }
}

/**
 * Handle task completion and advance workflow
 * @param {string} taskId - Completed task ID
 */
export async function onTaskComplete(taskId) {
  try {
    // Get task details
    const taskResult = await tasks.get(taskId);
    if (!taskResult?.task?.workflow_instance_id) {
      return; // Not part of a workflow
    }

    const task = taskResult.task;
    const instanceId = task.workflow_instance_id;

    // Get instance
    const instanceResult = await workflowInstances.get(instanceId);
    if (!instanceResult?.instance) return;

    const instance = instanceResult.instance;

    // Parse steps
    let steps = [];
    try {
      steps =
        typeof instance.template_steps === 'string'
          ? JSON.parse(instance.template_steps)
          : instance.template_steps || [];
    } catch (e) {
      return;
    }

    // Complete current step
    const currentStepIndex = instance.current_step_index || 0;

    await workflowInstances.completeStep(instanceId, {
      steps,
      step_id: task.workflow_step_id,
      task_id: taskId,
      status: 'complete',
      completed_at: new Date().toISOString(),
    });

    // Advance to next step (via helper for future branching/conditions)
    const nextStepIndex = getNextStep(instance, steps, currentStepIndex);
    if (nextStepIndex !== null && nextStepIndex < steps.length) {
      await executeStep(instanceId, nextStepIndex);
    } else {
      console.log(`[Workflow] Instance ${instanceId} completed`);
    }
  } catch (e) {
    console.error('[Workflow] On task complete error:', e);
  }
}

/**
 * Determine next step index after completing a step.
 * Currently sequential; designed as the extension point for
 * future condition evaluation, parallel step groups, and branching.
 * @param {object} instance - Workflow instance
 * @param {Array} steps - Step definitions array
 * @param {number} completedStepIndex - Index of the just-completed step
 * @returns {number|null} - Next step index, or null if workflow is done
 */
export function getNextStep(instance, steps, completedStepIndex) {
  // Future: evaluate step.condition, step.parallel, step.wait_for here
  const next = completedStepIndex + 1;
  return next < steps.length ? next : null;
}

/**
 * Get workflow progress summary
 * @param {object} instance - Workflow instance
 * @returns {object} - Progress summary
 */
export function getProgress(instance) {
  try {
    const steps =
      typeof instance.template_steps === 'string'
        ? JSON.parse(instance.template_steps)
        : instance.template_steps || [];

    const stepResults =
      typeof instance.step_results === 'string'
        ? JSON.parse(instance.step_results)
        : instance.step_results || {};

    const totalSteps = steps.length;
    const completedSteps = Object.values(stepResults).filter(
      (r) => r.status === 'complete'
    ).length;
    const progress =
      totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      total: totalSteps,
      completed: completedSteps,
      current: instance.current_step_index || 0,
      progress,
      remaining: totalSteps - completedSteps,
    };
  } catch (e) {
    return { total: 0, completed: 0, current: 0, progress: 0, remaining: 0 };
  }
}

/**
 * Seed system workflows on first run
 * This would be called during app initialization
 */
export async function seedSystemWorkflows() {
  try {
    // Get existing workflow IDs so we only seed missing ones
    const result = await workflowsApi.list();
    const existingIds = new Set((result?.templates || []).map((t) => t.id));

    // Load system workflows from JSON
    const response = await fetch('/agents/system-workflows.json');
    const data = await response.json();

    let added = 0;
    for (const wf of data.workflows) {
      if (!existingIds.has(wf.id)) {
        await workflowsApi.create({ ...wf, is_system: true });
        added++;
      }
    }

    if (added > 0) {
      console.log('[Workflow] Seeded', added, 'new system workflow(s)');
    } else {
      console.log('[Workflow] System workflows up to date');
    }
  } catch (e) {
    console.error('[Workflow] Failed to seed workflows:', e);
  }
}

/**
 * Format execution log for display
 * @param {string} logText - Raw execution log
 * @returns {array} - Formatted log entries
 */
export function formatExecutionLog(logText) {
  if (!logText) return [];

  return logText
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      // Parse timestamp: 2026-03-15T10:30:00Z: Message
      const match = line.match(
        /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z):\s*(.+)$/
      );
      if (match) {
        return {
          timestamp: match[1],
          message: match[2],
          time: new Date(match[1]).toLocaleTimeString(),
        };
      }
      return { message: line, time: null };
    });
}

export default {
  startWorkflow,
  executeStep,
  onTaskComplete,
  getProgress,
  seedSystemWorkflows,
  formatExecutionLog,
};
