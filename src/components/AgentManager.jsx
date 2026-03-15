/**
 * Agent Manager (Phase 5.3)
 * Browse, clone, and manage agents
 *
 * Agents are file-based in /agents/*.md
 * System agents are read-only
 * Custom agents can be created by cloning
 */

import { useState, useEffect } from 'react';
import {
  getAgents,
  getAgentStats,
  cloneAgent,
  clearAgentCache,
} from '../agents.js';
import { agentExecution, tasks as tasksApi } from '../api.js';
import { fileURI } from '../uri.js';

// Colors matching TheBrain.jsx
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
    color: v === 'danger' ? C.red : '#e2e8f0',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono',monospace",
  }),
  input: {
    background: '#0d1424',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 12,
    padding: '7px 11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  textarea: {
    background: '#0d1424',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: "'JetBrains Mono',monospace",
    fontSize: 12,
    padding: '7px 11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 80,
  },
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

// Capability taxonomy
const CAPABILITY_OPTIONS = [
  {
    category: 'Code',
    items: [
      'code.write',
      'code.review',
      'code.debug',
      'code.test',
      'code.deploy',
    ],
  },
  {
    category: 'Content',
    items: [
      'content.write',
      'content.edit',
      'content.social',
      'content.email',
      'content.docs',
    ],
  },
  {
    category: 'Strategy',
    items: [
      'strategy.plan',
      'strategy.research',
      'strategy.analyze',
      'strategy.prioritize',
    ],
  },
  {
    category: 'Design',
    items: ['design.ui', 'design.assets', 'design.brand', 'design.prototype'],
  },
  {
    category: 'Research',
    items: [
      'research.market',
      'research.tech',
      'research.competitor',
      'research.user',
    ],
  },
];

// Permission options
const PERMISSION_OPTIONS = [
  'read:all',
  'write:code-modules',
  'write:content-assets',
  'write:design-assets',
  'write:staging',
  'write:devlog',
  'write:tools',
  'write:project-artifacts',
];

export default function AgentManager({ projectId, projectFiles, onSaveAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [stats, setStats] = useState({});
  const [agentTasks, setAgentTasks] = useState([]);
  const [executing, setExecuting] = useState(null); // task ID being executed
  const [previewData, setPreviewData] = useState(null); // {taskId, prompt, agent}

  useEffect(() => {
    loadAgents();
  }, [projectId]);

  const loadAgents = async () => {
    setLoading(true);
    try {
      clearAgentCache(); // Force refresh
      const allAgents = await getAgents(projectId);
      setAgents(allAgents);

      // Load stats for each
      const statsMap = {};
      for (const agent of allAgents) {
        statsMap[agent.id] = await getAgentStats(agent.id);
      }
      setStats(statsMap);
    } catch (e) {
      console.error('Failed to load agents:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = async (agent) => {
    setSelectedAgent(agent);
    setEditing(false);
    setEditForm(null);
    setPreviewData(null);
    // Load tasks assigned to this agent
    try {
      const result = await tasksApi.list({ assignee_id: agent.id });
      setAgentTasks(result.tasks || []);
    } catch {
      setAgentTasks([]);
    }
  };

  const handleExecute = async (taskId) => {
    setExecuting(taskId);
    setPreviewData(null);
    try {
      const result = await agentExecution.execute(taskId);
      if (result.status === 'preview') {
        setPreviewData({ taskId, prompt: result.prompt, agent: result.agent });
        setExecuting(null);
      } else if (result.status === 'complete') {
        // Refresh tasks
        setAgentTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'complete',
                  result_summary: result.result_summary,
                }
              : t
          )
        );
        setExecuting(null);
      } else {
        setAgentTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: result.status || 'blocked' } : t
          )
        );
        setExecuting(null);
      }
    } catch (e) {
      console.error('[AgentExec] Error:', e);
      setExecuting(null);
    }
  };

  const handleConfirmExec = async (taskId) => {
    setExecuting(taskId);
    try {
      const result = await agentExecution.confirm(taskId);
      setAgentTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: result.status || 'complete',
                result_summary: result.result_summary,
              }
            : t
        )
      );
      setPreviewData(null);
    } catch (e) {
      console.error('[AgentExec] Confirm error:', e);
    } finally {
      setExecuting(null);
    }
  };

  const handleClone = async (agent) => {
    const cloned = await cloneAgent(agent.id, {
      name: `${agent.name} (Custom)`,
    });

    setEditForm({
      ...cloned,
      capabilities: [...(cloned.capabilities || [])],
      permissions: [...(cloned.permissions || [])],
      ignore_patterns: [...(cloned.ignore_patterns || [])],
    });
    setEditing(true);
    setSelectedAgent(cloned);
  };

  const handleSave = async () => {
    if (!editForm) return;

    // Generate markdown content
    const frontmatter = [
      '---',
      `id: ${editForm.id}`,
      `version: ${editForm.version}`,
      `previous_version: ${editForm.previous_version || ''}`,
      `name: ${editForm.name}`,
      `icon: ${editForm.icon}`,
      `description: ${editForm.description}`,
      `capabilities:`,
      ...(editForm.capabilities || []).map((c) => `  - ${c}`),
      `permissions:`,
      ...(editForm.permissions || []).map((p) => `  - ${p}`),
      `ignore_patterns:`,
      ...(editForm.ignore_patterns || []).map((i) => `  - ${i}`),
      `model: ${editForm.model}`,
      `temperature: ${editForm.temperature}`,
      `created_by: user`,
      `created_at: ${new Date().toISOString().split('T')[0]}`,
      '---',
      '',
      editForm.prompt_prefix || '',
    ].join('\n');

    // Save via callback (parent handles actual file creation)
    if (onSaveAgent) {
      await onSaveAgent(editForm.id, frontmatter);
    }

    setEditing(false);
    setEditForm(null);
    await loadAgents(); // Refresh
  };

  const toggleCapability = (cap) => {
    if (!editForm) return;
    const has = editForm.capabilities?.includes(cap);
    setEditForm({
      ...editForm,
      capabilities: has
        ? editForm.capabilities.filter((c) => c !== cap)
        : [...(editForm.capabilities || []), cap],
    });
  };

  const togglePermission = (perm) => {
    if (!editForm) return;
    const has = editForm.permissions?.includes(perm);
    setEditForm({
      ...editForm,
      permissions: has
        ? editForm.permissions.filter((p) => p !== perm)
        : [...(editForm.permissions || []), perm],
    });
  };

  const systemAgents = agents.filter((a) => a.is_system !== false);
  const customAgents = agents.filter((a) => a.is_system === false);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* Agent List */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={{ ...S.card(true), marginBottom: 12 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={S.label(C.blue2)}>🤖 Agents</span>
            <button style={S.btn('ghost')} onClick={loadAgents}>
              ↻
            </button>
          </div>

          {loading && (
            <div style={{ fontSize: 10, color: C.muted }}>Loading...</div>
          )}

          {/* System Agents */}
          {!loading && systemAgents.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: C.dim, margin: '12px 0 8px' }}>
                SYSTEM
              </div>
              {systemAgents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    background:
                      selectedAgent?.id === agent.id
                        ? C.blue + '20'
                        : 'transparent',
                    border: `1px solid ${selectedAgent?.id === agent.id ? C.blue : 'transparent'}`,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{agent.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 8, color: C.dim }}>
                      {agent.capabilities?.length || 0} capabilities
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Custom Agents */}
          {!loading && customAgents.length > 0 && (
            <>
              <div style={{ fontSize: 9, color: C.dim, margin: '16px 0 8px' }}>
                CUSTOM
              </div>
              {customAgents.map((agent) => (
                <div
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 5,
                    cursor: 'pointer',
                    background:
                      selectedAgent?.id === agent.id
                        ? C.blue + '20'
                        : 'transparent',
                    border: `1px solid ${selectedAgent?.id === agent.id ? C.blue : 'transparent'}`,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{agent.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 8, color: C.amber }}>
                      v{agent.version}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!loading && agents.length === 0 && (
            <div style={{ fontSize: 10, color: C.muted }}>No agents found</div>
          )}
        </div>
      </div>

      {/* Agent Detail */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!selectedAgent && (
          <div style={S.card(false)}>
            <div
              style={{
                fontSize: 12,
                color: C.muted,
                textAlign: 'center',
                padding: '40px 0',
              }}
            >
              Select an agent to view details
            </div>
          </div>
        )}

        {selectedAgent && !editing && (
          <div>
            <div style={S.card(true)}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{selectedAgent.icon}</span>
                  <div>
                    <div
                      style={{ fontSize: 14, fontWeight: 700, color: C.text }}
                    >
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 2 }}>
                      {selectedAgent.id}
                      {selectedAgent.is_system !== false && (
                        <span style={{ ...S.badge(C.purple), marginLeft: 8 }}>
                          SYSTEM
                        </span>
                      )}
                      {selectedAgent.version && (
                        <span style={{ ...S.badge(C.amber), marginLeft: 8 }}>
                          v{selectedAgent.version}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => handleClone(selectedAgent)}
                  >
                    + Clone
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginTop: 12,
                  lineHeight: 1.6,
                }}
              >
                {selectedAgent.description}
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                ...S.card(false),
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 9, color: C.dim }}>TASKS</div>
                <div style={{ fontSize: 18, color: C.text, fontWeight: 700 }}>
                  {stats[selectedAgent.id]?.total_tasks || 0}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.dim }}>SUCCESS RATE</div>
                <div style={{ fontSize: 18, color: C.green, fontWeight: 700 }}>
                  {Math.round(
                    (stats[selectedAgent.id]?.success_rate || 0) * 100
                  )}
                  %
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.dim }}>AVG COST</div>
                <div style={{ fontSize: 18, color: C.blue2, fontWeight: 700 }}>
                  ${stats[selectedAgent.id]?.avg_cost?.toFixed(3) || '0.000'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: C.dim }}>AVG TIME</div>
                <div style={{ fontSize: 18, color: C.amber, fontWeight: 700 }}>
                  {stats[selectedAgent.id]?.avg_duration_minutes || 0}m
                </div>
              </div>
            </div>

            {/* Agent Tasks (Phase 5.6) */}
            <div style={S.card(agentTasks.some((t) => t.status === 'pending'))}>
              <span style={S.label(C.amber)}>Assigned Tasks</span>
              {agentTasks.length === 0 && (
                <div style={{ fontSize: 10, color: C.muted }}>
                  No tasks assigned to this agent
                </div>
              )}
              {agentTasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span
                    style={S.badge(
                      task.status === 'complete'
                        ? C.green
                        : task.status === 'blocked'
                          ? C.red
                          : task.status === 'in_progress'
                            ? C.amber
                            : C.dim
                    )}
                  >
                    {task.status}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.text,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </div>
                  </div>
                  {task.status === 'pending' && (
                    <button
                      style={S.btn('primary')}
                      disabled={executing === task.id}
                      onClick={() => handleExecute(task.id)}
                    >
                      {executing === task.id ? '⏳' : '▶ Execute'}
                    </button>
                  )}
                  {task.status === 'complete' && task.result_summary && (
                    <span style={{ fontSize: 9, color: C.green }}>✓</span>
                  )}
                  {task.status === 'blocked' && (
                    <span style={{ fontSize: 9, color: C.red }}>✗</span>
                  )}
                </div>
              ))}
              {/* Completed task result viewer */}
              {agentTasks
                .filter((t) => t.status === 'complete' && t.result_summary)
                .map((task) => (
                  <details key={`result-${task.id}`} style={{ marginTop: 8 }}>
                    <summary
                      style={{ fontSize: 9, color: C.green, cursor: 'pointer' }}
                    >
                      Result: {task.title}
                    </summary>
                    <pre
                      style={{
                        fontSize: 9,
                        color: C.text,
                        background: C.bg,
                        padding: 10,
                        borderRadius: 5,
                        overflow: 'auto',
                        maxHeight: 200,
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        marginTop: 6,
                      }}
                    >
                      {task.result_summary}
                    </pre>
                  </details>
                ))}
            </div>

            {/* Preview mode (assistant) */}
            {previewData && (
              <div style={{ ...S.card(true), borderColor: C.amber }}>
                <span style={S.label(C.amber)}>Preview: Agent Prompt</span>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
                  Model: {previewData.agent?.model} | Temp:{' '}
                  {previewData.agent?.temperature}
                </div>
                <pre
                  style={{
                    fontSize: 9,
                    color: C.text,
                    background: C.bg,
                    padding: 10,
                    borderRadius: 5,
                    overflow: 'auto',
                    maxHeight: 250,
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.5,
                  }}
                >
                  {previewData.prompt}
                </pre>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    style={S.btn('primary', C.green)}
                    disabled={!!executing}
                    onClick={() => handleConfirmExec(previewData.taskId)}
                  >
                    {executing ? '⏳ Executing...' : '✓ Confirm & Execute'}
                  </button>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => setPreviewData(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Capabilities */}
            <div style={S.card(false)}>
              <span style={S.label()}>Capabilities</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedAgent.capabilities?.map((cap) => (
                  <span key={cap} style={S.badge(C.blue)}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Permissions */}
            <div style={S.card(false)}>
              <span style={S.label()}>Permissions</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedAgent.permissions?.map((perm) => (
                  <span key={perm} style={S.badge(C.green)}>
                    {perm}
                  </span>
                ))}
              </div>
            </div>

            {/* Prompt Prefix */}
            <div style={S.card(false)}>
              <span style={S.label()}>System Prompt</span>
              <pre
                style={{
                  fontSize: 10,
                  color: C.text,
                  background: C.bg,
                  padding: 12,
                  borderRadius: 5,
                  overflow: 'auto',
                  maxHeight: 300,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {selectedAgent.prompt_prefix}
              </pre>
            </div>
          </div>
        )}

        {/* Edit Mode */}
        {selectedAgent && editing && editForm && (
          <div>
            <div style={S.card(true)}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <span style={S.label(C.blue2)}>Clone Agent</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </button>
                  <button style={S.btn('primary')} onClick={handleSave}>
                    Save
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 9, color: C.amber, marginBottom: 12 }}>
                New ID: {editForm.id}
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <span style={S.label()}>Name</span>
                  <input
                    style={S.input}
                    value={editForm.name || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <span style={S.label()}>Icon</span>
                  <input
                    style={S.input}
                    value={editForm.icon || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, icon: e.target.value })
                    }
                    placeholder="🤖"
                  />
                </div>

                <div>
                  <span style={S.label()}>Description</span>
                  <input
                    style={S.input}
                    value={editForm.description || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, description: e.target.value })
                    }
                  />
                </div>

                <div>
                  <span style={S.label()}>Model</span>
                  <select
                    style={S.input}
                    value={editForm.model || 'claude-sonnet-4-6'}
                    onChange={(e) =>
                      setEditForm({ ...editForm, model: e.target.value })
                    }
                  >
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                    <option value="claude-opus-4">Claude Opus 4</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Capabilities Selection */}
            <div style={S.card(false)}>
              <span style={S.label()}>Capabilities</span>
              {CAPABILITY_OPTIONS.map((cat) => (
                <div key={cat.category} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
                    {cat.category}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {cat.items.map((cap) => {
                      const selected = editForm.capabilities?.includes(cap);
                      return (
                        <button
                          key={cap}
                          onClick={() => toggleCapability(cap)}
                          style={{
                            ...S.badge(selected ? C.blue : C.dim),
                            cursor: 'pointer',
                            opacity: selected ? 1 : 0.5,
                          }}
                        >
                          {selected ? '✓ ' : ''}
                          {cap}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Permissions Selection */}
            <div style={S.card(false)}>
              <span style={S.label()}>Permissions</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PERMISSION_OPTIONS.map((perm) => {
                  const selected = editForm.permissions?.includes(perm);
                  return (
                    <button
                      key={perm}
                      onClick={() => togglePermission(perm)}
                      style={{
                        ...S.badge(selected ? C.green : C.dim),
                        cursor: 'pointer',
                        opacity: selected ? 1 : 0.5,
                      }}
                    >
                      {selected ? '✓ ' : ''}
                      {perm}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt Editor */}
            <div style={S.card(false)}>
              <span style={S.label()}>System Prompt</span>
              <textarea
                style={{
                  ...S.textarea,
                  minHeight: 200,
                  fontFamily: 'monospace',
                }}
                value={editForm.prompt_prefix || ''}
                onChange={(e) =>
                  setEditForm({ ...editForm, prompt_prefix: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
