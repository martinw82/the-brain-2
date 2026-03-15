/**
 * Workflow Execution Engine (Phase 5.5)
 * Orchestrates multi-step workflows by creating tasks
 */

import { workflowInstances, tasks, workflows as workflowsApi } from './api.js';
import { selectAgent, buildAgentPrompt } from './agents.js';

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
      steps = typeof instance.template_steps === 'string' 
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
      const agent = await selectAgent(step.capability, { projectId: instance.project_id });
      if (agent) {
        assigneeType = 'agent';
        assigneeId = agent.id;
      }
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
      workflow_step_id: step.id
    });
    
    if (taskResult.success) {
      console.log(`[Workflow] Step ${stepIndex + 1} task created: ${taskResult.id}`);
      
      // If assigned to agent and auto_assign, trigger execution
      if (assigneeType === 'agent' && step.auto_assign) {
        // This would trigger agent execution (Phase 5.6)
        console.log(`[Workflow] Auto-triggering agent ${assigneeId} for step ${stepIndex + 1}`);
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
      steps = typeof instance.template_steps === 'string' 
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
      completed_at: new Date().toISOString()
    });
    
    // Advance to next step
    const nextStepIndex = currentStepIndex + 1;
    if (nextStepIndex < steps.length) {
      await executeStep(instanceId, nextStepIndex);
    } else {
      console.log(`[Workflow] Instance ${instanceId} completed`);
    }
  } catch (e) {
    console.error('[Workflow] On task complete error:', e);
  }
}

/**
 * Get workflow progress summary
 * @param {object} instance - Workflow instance
 * @returns {object} - Progress summary
 */
export function getProgress(instance) {
  try {
    const steps = typeof instance.template_steps === 'string' 
      ? JSON.parse(instance.template_steps) 
      : instance.template_steps || [];
    
    const stepResults = typeof instance.step_results === 'string'
      ? JSON.parse(instance.step_results)
      : instance.step_results || {};
    
    const totalSteps = steps.length;
    const completedSteps = Object.values(stepResults).filter(r => r.status === 'complete').length;
    const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    return {
      total: totalSteps,
      completed: completedSteps,
      current: instance.current_step_index || 0,
      progress,
      remaining: totalSteps - completedSteps
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
    // Check if already seeded
    const result = await workflowsApi.list();
    const hasSystemWorkflows = result?.templates?.some(t => t.is_system);
    
    if (hasSystemWorkflows) {
      console.log('[Workflow] System workflows already seeded');
      return;
    }
    
    // Load system workflows from JSON
    const response = await fetch('/agents/system-workflows.json');
    const data = await response.json();
    
    for (const wf of data.workflows) {
      await workflowsApi.create({
        ...wf,
        is_system: true
      });
    }
    
    console.log('[Workflow] System workflows seeded:', data.workflows.length);
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
  
  return logText.split('\n').filter(Boolean).map(line => {
    // Parse timestamp: 2026-03-15T10:30:00Z: Message
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z):\s*(.+)$/);
    if (match) {
      return {
        timestamp: match[1],
        message: match[2],
        time: new Date(match[1]).toLocaleTimeString()
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
  formatExecutionLog
};
