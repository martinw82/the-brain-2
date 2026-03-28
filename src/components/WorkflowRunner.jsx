/**
 * Workflow Runner (Phase 5.5)
 * Start and monitor workflow executions
 */

import { useState, useEffect } from 'react';
import { workflows, workflowInstances } from '../api.js';
import {
  startWorkflow,
  getProgress,
  formatExecutionLog,
} from '../workflows.js';
import WorkerStatusPanel from './WorkerStatusPanel.jsx';

const C = {
  bg: '#070b14',
  surface: '#0a0f1e',
  border: '#0f1e3a',
  blue: '#1a4fd6',
  blue2: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#6366f1',
  text: '#cbd5e1',
  muted: '#475569',
  dim: '#334155',
};

const S = {
  card: (hi, col) => ({
    background: C.surface,
    border: `1px solid ${hi ? col || C.blue : C.border}`,
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 10,
  }),
  label: (col) => ({
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: col || C.dim,
    marginBottom: 8,
    display: 'block',
  }),
  btn: (v = 'primary', c) => ({
    background:
      v === 'primary' ? c || C.blue : v === 'ghost' ? 'transparent' : '#0d1424',
    border: v === 'ghost' ? `1px solid ${C.border}` : 'none',
    color: v === 'success' ? C.green : v === 'danger' ? C.red : '#e2e8f0',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono',monospace",
  }),
  badge: (c) => ({
    fontSize: 9,
    padding: '2px 6px',
    borderRadius: 3,
    background: `${c}18`,
    color: c,
    border: `1px solid ${c}35`,
    letterSpacing: '0.09em',
    fontWeight: 700,
  }),
};

const STATUS_COLORS = {
  pending: C.dim,
  running: C.blue,
  paused: C.amber,
  completed: C.green,
  failed: C.red,
  aborted: C.red,
};

export default function WorkflowRunner({ projectId, project, agents }) {
  const [templates, setTemplates] = useState([]);
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeInstance, setActiveInstance] = useState(null);
  const [showStartModal, setShowStartModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load templates
      const tmplRes = await workflows.list();
      setTemplates(tmplRes?.templates || []);

      // Load instances for this project
      if (projectId) {
        const instRes = await workflowInstances.list({ project_id: projectId });
        setInstances(instRes?.instances || []);
      }
    } catch (e) {
      console.error('Failed to load workflows:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (templateId) => {
    try {
      const result = await startWorkflow(templateId, projectId);
      if (result.success) {
        showToast(`✓ Workflow started: ${result.instance.template_name}`);
        setShowStartModal(false);
        await loadData();
        setActiveInstance(result.instance);
      }
    } catch (e) {
      console.error('Failed to start workflow:', e);
      showToast('Failed to start workflow');
    }
  };

  const handleControl = async (instanceId, action) => {
    try {
      let result;
      switch (action) {
        case 'pause':
          result = await workflowInstances.pause(instanceId);
          break;
        case 'resume':
          result = await workflowInstances.resume(instanceId);
          break;
        case 'abort':
          result = await workflowInstances.abort(instanceId);
          break;
      }
      if (result?.success) {
        await loadData();
      }
    } catch (e) {
      console.error('Workflow control error:', e);
    }
  };

  const runningInstances = instances.filter((i) =>
    ['pending', 'running', 'paused'].includes(i.status)
  );
  const completedInstances = instances.filter((i) =>
    ['completed', 'failed', 'aborted'].includes(i.status)
  );

  return (
    <div>
      {/* Header */}
      <div
        style={{
          ...S.card(true),
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={S.label(C.blue2)}>⚙️ Workflows</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn('ghost')} onClick={loadData}>
            ↻ Refresh
          </button>
          <button
            style={S.btn('primary')}
            onClick={() => setShowStartModal(true)}
          >
            + Start Workflow
          </button>
        </div>
      </div>

      {/* Running Instances */}
      {runningInstances.length > 0 && (
        <div style={S.card(false)}>
          <span style={S.label(C.blue)}>
            Running ({runningInstances.length})
          </span>
          {runningInstances.map((instance) => {
            const progress = getProgress(instance);
            return (
              <div
                key={instance.id}
                onClick={() => setActiveInstance(instance)}
                style={{
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: 12,
                  marginBottom: 8,
                  cursor: 'pointer',
                  background:
                    activeInstance?.id === instance.id
                      ? C.blue + '10'
                      : 'transparent',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 16 }}>
                      {instance.template_icon}
                    </span>
                    <div>
                      <div
                        style={{ fontSize: 11, color: C.text, fontWeight: 600 }}
                      >
                        {instance.template_name}
                      </div>
                      <div style={{ fontSize: 8, color: C.dim }}>
                        Step {progress.current + 1} of {progress.total}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      style={S.badge(STATUS_COLORS[instance.status] || C.dim)}
                    >
                      {instance.status}
                    </span>
                    {instance.status === 'running' && (
                      <button
                        style={{
                          ...S.btn('ghost'),
                          fontSize: 8,
                          padding: '2px 6px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleControl(instance.id, 'pause');
                        }}
                      >
                        ⏸
                      </button>
                    )}
                    {instance.status === 'paused' && (
                      <button
                        style={{
                          ...S.btn('ghost'),
                          fontSize: 8,
                          padding: '2px 6px',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleControl(instance.id, 'resume');
                        }}
                      >
                        ▶
                      </button>
                    )}
                    <button
                      style={{
                        ...S.btn('ghost'),
                        fontSize: 8,
                        padding: '2px 6px',
                        color: C.red,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleControl(instance.id, 'abort');
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 4,
                      background: C.border,
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progress.progress}%`,
                        background:
                          instance.status === 'paused' ? C.amber : C.blue,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      marginTop: 4,
                      textAlign: 'right',
                    }}
                  >
                    {progress.progress}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Worker Status Panel */}
      <WorkerStatusPanel projectId={projectId} />

      {/* Active Instance Detail */}
      {activeInstance && (
        <WorkflowInstanceDetail
          instance={activeInstance}
          agents={agents}
          onClose={() => setActiveInstance(null)}
        />
      )}

      {/* Completed Instances */}
      {completedInstances.length > 0 && (
        <div style={S.card(false)}>
          <span style={S.label(C.dim)}>
            History ({completedInstances.length})
          </span>
          <div style={{ maxHeight: 200, overflow: 'auto' }}>
            {completedInstances.map((instance) => (
              <div
                key={instance.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.border}`,
                  opacity: 0.7,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{instance.template_icon}</span>
                  <span style={{ fontSize: 10, color: C.text }}>
                    {instance.template_name}
                  </span>
                </div>
                <span
                  style={{
                    ...S.badge(STATUS_COLORS[instance.status] || C.dim),
                    fontSize: 8,
                  }}
                >
                  {instance.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start Modal */}
      {showStartModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.blue}`,
              borderRadius: 12,
              width: 480,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflow: 'auto',
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                Start Workflow
              </span>
              <button
                style={S.btn('ghost')}
                onClick={() => setShowStartModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 10, color: C.dim, marginBottom: 12 }}>
              Project: {project?.emoji} {project?.name}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {templates.map((template) => {
                let steps = [];
                try {
                  steps =
                    typeof template.steps === 'string'
                      ? JSON.parse(template.steps)
                      : template.steps || [];
                } catch (e) {}

                return (
                  <div
                    key={template.id}
                    onClick={() => handleStart(template.id)}
                    style={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: 12,
                      cursor: 'pointer',
                      background: 'transparent',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = C.blue)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = C.border)
                    }
                  >
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                    >
                      <span style={{ fontSize: 24 }}>{template.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            color: C.text,
                            fontWeight: 600,
                          }}
                        >
                          {template.name}
                          {template.is_system && (
                            <span
                              style={{
                                ...S.badge(C.purple),
                                marginLeft: 8,
                                fontSize: 8,
                              }}
                            >
                              SYSTEM
                            </span>
                          )}
                        </div>
                        <div
                          style={{ fontSize: 9, color: C.muted, marginTop: 2 }}
                        >
                          {template.description}
                        </div>
                        <div
                          style={{ fontSize: 8, color: C.dim, marginTop: 4 }}
                        >
                          {steps.length} steps •{' '}
                          {steps.filter((s) => s.auto_assign).length}{' '}
                          auto-assigned
                        </div>
                      </div>
                      <span style={{ fontSize: 16, color: C.blue }}>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Instance detail view
function WorkflowInstanceDetail({ instance, agents, onClose }) {
  const [logEntries, setLogEntries] = useState([]);

  useEffect(() => {
    setLogEntries(formatExecutionLog(instance.execution_log));
  }, [instance.execution_log]);

  let steps = [];
  try {
    steps =
      typeof instance.template_steps === 'string'
        ? JSON.parse(instance.template_steps)
        : instance.template_steps || [];
  } catch (e) {}

  const stepResults =
    typeof instance.step_results === 'string'
      ? JSON.parse(instance.step_results)
      : instance.step_results || {};

  const progress = getProgress(instance);

  return (
    <div style={S.card(true)}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>{instance.template_icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {instance.template_name}
            </div>
            <div style={{ fontSize: 8, color: C.dim }}>{instance.id}</div>
          </div>
        </div>
        <button style={S.btn('ghost')} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: C.dim,
            marginBottom: 4,
          }}
        >
          <span>Progress</span>
          <span>
            {progress.completed} / {progress.total} steps
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: C.border,
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress.progress}%`,
              background: instance.status === 'paused' ? C.amber : C.green,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div style={{ marginBottom: 16 }}>
        <span style={S.label()}>Steps</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {steps.map((step, idx) => {
            const result = stepResults[`step_${step.id}`];
            const isCurrent = idx === instance.current_step_index;
            const isComplete = result?.status === 'complete';
            const isPending = idx > instance.current_step_index;
            const isWaitingForWorker = isCurrent && step.worker_required && instance.status === 'waiting_for_worker';

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 5,
                  background: isCurrent ? (isWaitingForWorker ? C.amber + '15' : C.blue + '15') : 'transparent',
                  border: `1px solid ${isCurrent ? (isWaitingForWorker ? C.amber : C.blue) : C.border}`,
                  opacity: isPending ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: isComplete
                      ? C.green
                      : isCurrent
                        ? (isWaitingForWorker ? C.amber : C.blue)
                        : C.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {isComplete ? '✓' : isWaitingForWorker ? '⏳' : idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: C.text,
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {step.label}
                    {isWaitingForWorker && (
                      <span style={{ color: C.amber, marginLeft: 8 }}>
                        (Waiting for worker...)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
                    {step.sop}
                  </div>
                  {step.capability && (
                    <div style={{ fontSize: 8, color: C.blue2, marginTop: 4 }}>
                      Needs: {step.capability}
                      {step.auto_assign && ' • Auto-assign'}
                      {step.worker_required && ' • Worker required'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Execution Log */}
      <div>
        <span style={S.label()}>Execution Log</span>
        <div
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 5,
            padding: 10,
            maxHeight: 150,
            overflow: 'auto',
            fontSize: 9,
            fontFamily: 'monospace',
          }}
        >
          {logEntries.length === 0 ? (
            <span style={{ color: C.dim }}>No log entries yet...</span>
          ) : (
            logEntries.map((entry, i) => (
              <div key={i} style={{ marginBottom: 3, color: C.muted }}>
                {entry.time && (
                  <span style={{ color: C.dim }}>[{entry.time}] </span>
                )}
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function showToast(msg) {
  // Use TheBrain's toast if available, otherwise console
  if (window.showToast) {
    window.showToast(msg);
  } else {
    console.log(msg);
  }
}
