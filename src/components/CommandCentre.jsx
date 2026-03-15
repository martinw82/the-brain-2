import { useState, useEffect, useCallback } from 'react';
import { C, S } from '../TheBrain.jsx';
import AreaPill from './AreaPill.jsx';
import TagPill from './TagPill.jsx';
import HealthBar from './HealthBar.jsx';
import BadgeStatus from './BadgeStatus.jsx';
import Dots from './Dots.jsx';
import Modal from './Modal.jsx';
import Toast from './Toast.jsx';
import AICoach from './AICoach.jsx';
import ProgressTrends from './ProgressTrends.jsx';

const CommandCentre = ({
  projects,
  areas,
  areaStats,
  activeAreaFilter,
  setActiveAreaFilter,
  filteredProjects,
  focusId,
  setFocusId,
  focusP,
  weeklyTraining,
  todayOutreach,
  driftFlags,
  getBehavior,
  shouldShow,
  setDriftExpanded,
  driftExpanded,
  dismissDriftFlag,
  totalIncome,
  activeGoal,
  setModal,
  showTaskModal,
  setShowTaskModal,
  showImportModal,
  setShowImportModal,
  tasks,
  tasksLoading,
  setTasks,
  completeTask,
  deleteTask,
  setShowOutreachModal,
  setShowTrainingModal,
  setShowCheckinModal,
  sessionActive,
  setSessionOn,
  askAI,
  setMainTab,
  openHub,
  S,
  C,
  modeSuggestions,
  dismissModeSuggestion,
  switchToMode,
}) => {
  return (
    <div>
      {/* Area summary cards - stack on mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile
            ? '1fr'
            : 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {areaStats.map((a) => (
          <div
            key={a.id}
            style={S.card(activeAreaFilter === a.id, a.color)}
            onClick={() =>
              setActiveAreaFilter(
                activeAreaFilter === a.id ? null : a.id
              )
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>
                {a.icon}{' '}
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  {a.name}
                </span>
              </span>
              <span style={{ fontSize: 10, color: C.muted }}>
                {a.projectCount} projects
              </span>
            </div>
            <HealthBar score={a.health} />
          </div>
        ))}
      </div>

      {projects.filter((p) => p.health < 50).length > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.05)',
            border: '1px solid #ef444330',
            borderRadius: 6,
            padding: '10px 14px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: C.red,
              letterSpacing: '0.12em',
              marginBottom: 6,
            }}
          >
            🚨 HEALTH ALERTS
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {projects
              .filter((p) => p.health < 50)
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <span>{p.emoji}</span>
                  <span style={{ fontSize: 10 }}>{p.name}</span>
                  <HealthBar score={p.health} />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Drift Alerts (Phase 2.10) — mode-aware */}
      {driftFlags.length > 0 &&
        getBehavior('drift_alerts', currentMode) === 'alert' && (
          <div
            style={{
              background: 'rgba(245,158,11,0.05)',
              border: '1px solid #f59e0b30',
              borderRadius: 6,
              padding: '10px 14px',
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: C.amber,
                letterSpacing: '0.12em',
                marginBottom: 6,
              }}
            >
              ⚠️ DRIFT DETECTED
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {driftFlags.map((flag, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    <span style={{ fontSize: 10 }}>
                      {flag.type === 'training_deficit'
                        ? '🥋'
                        : flag.type === 'outreach_gap'
                          ? '📣'
                          : flag.type === 'energy_decline'
                            ? '🌙'
                            : flag.type === 'session_gap'
                              ? '⏱️'
                              : '📉'}
                    </span>
                    <span style={{ fontSize: 10, color: C.text }}>
                      {flag.message}
                    </span>
                    {flag.severity === 'high' && (
                      <span
                        style={{ ...S.badge(C.red), fontSize: 8 }}
                      >
                        HIGH
                      </span>
                    )}
                  </div>
                  <button
                    style={{
                      ...S.btn('ghost'),
                      padding: '2px 6px',
                      fontSize: 8,
                    }}
                    onClick={() => dismissDriftFlag(flag.type)}
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Assistant mode: compact drift badge */}
      {driftFlags.length > 0 &&
        getBehavior('drift_alerts', currentMode) === 'badge' && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid #f59e0b20',
              borderRadius: 12,
              padding: '4px 10px',
              marginBottom: 10,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 10, color: C.amber }}>
              ⚠️ {driftFlags.length} drift alert
              {driftFlags.length > 1 ? 's' : ''}
            </span>
          </div>
        )}

      {driftFlags.length > 0 &&
        getBehavior('drift_alerts', currentMode) === 'badge' &&
        driftExpanded && (
          <div
            style={{
              background: 'rgba(245,158,11,0.03)',
              border: '1px solid #f59e0b15',
              borderRadius: 6,
              padding: '8px 12px',
              marginBottom: 10,
            }}
          >
            {driftFlags.map((flag, i) => (
              <div
                key={i}
                style={{
                  fontSize: 9,
                  color: C.muted,
                  padding: '2px 0',
                }}
              >
                {flag.message}
              </div>
            ))}
          </div>
        )}

      {/* Smart Mode Suggestions (Phase 6.2) */}
      {modeSuggestions && modeSuggestions.length > 0 && (
        <div
          style={{
            background: 'rgba(139,92,246,0.05)',
            border: '1px solid #8b5cf630',
            borderRadius: 6,
            padding: '12px 14px',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: '#8b5cf6',
              letterSpacing: '0.12em',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            💡 MODE SUGGESTION
          </div>
          {modeSuggestions.map((suggestion, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px 0',
                borderTop: i > 0 ? '1px solid #8b5cf620' : 'none',
              }}
            >
              <div style={{ fontSize: 11, color: C.text }}>
                {suggestion.reason}
              </div>
              <div style={{ fontSize: 9, color: C.muted }}>
                Trigger: {suggestion.trigger}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  style={{
                    background: '#8b5cf6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => switchToMode(suggestion.suggested_mode)}
                >
                  Switch to {suggestion.suggested_mode} mode
                </button>
                <button
                  style={{
                    background: 'transparent',
                    color: C.muted,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                  onClick={() => dismissModeSuggestion(suggestion.type)}
                >
                  Not now
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Training Log card (Phase 2.6) */}
      <div style={S.card(weeklyTraining.count >= 3, C.green)}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: C.green,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
            }}
          >
            🥋 Training This Week
          </span>
          <button
            style={{ ...S.btn('success'), fontSize: 9 }}
            onClick={() => setShowTrainingModal(true)}
          >
            + Log Training
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: isMobile ? 8 : 16,
            alignItems: isMobile ? 'flex-start' : 'center',
            flexDirection: isMobile ? 'column' : 'row',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color:
                  weeklyTraining.count >= 3
                    ? C.green
                    : weeklyTraining.count >= 1
                      ? C.amber
                      : C.dim,
              }}
            >
              {weeklyTraining.count}
            </div>
            <div
              style={{
                fontSize: 8,
                color: C.dim,
                textTransform: 'uppercase',
              }}
            >
              Sessions
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: C.blue,
              }}
            >
              {weeklyTraining.minutes}
            </div>
            <div
              style={{
                fontSize: 8,
                color: C.dim,
                textTransform: 'uppercase',
              }}
            >
              Minutes
            </div>
          </div>
        </div>
        <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
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
                width: `${Math.min(
                  100,
                  Math.round((weeklyTraining.count / 3) * 100),
                )}%`,
                height: '100%',
                background:
                  weeklyTraining.count >= 3 ? C.green : C.amber,
                borderRadius: 3,
                transition: 'width 0.3s',
              }}
            />
          </div>
          <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
            {weeklyTraining.count >= 3
              ? '✓ Target met'
              : 'Target: 3 sessions/week'}
          </div>
        </div>
      </div>

      {/* Outreach card (Phase 2.7) — mode-aware */}
      {shouldShow('outreach_enforcement', currentMode) && (
        <div style={S.card(todayOutreach.length > 0, C.purple)}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: C.purple,
                letterSpacing: '0.11em',
                textTransform: 'uppercase',
              }}
            >
              📣 Outreach
            </span>
            <button
              style={{
                ...S.btn('ghost'),
                fontSize: 9,
                borderColor: C.purple + '50',
                color: C.purple,
              }}
              onClick={() => setShowOutreachModal(true)}
            >
              + Log
            </button>
          </div>
          <div
            style={{
              display: 'flex',
              gap: isMobile ? 8 : 16,
              alignItems: isMobile ? 'flex-start' : 'center',
              flexDirection: isMobile ? 'column' : 'row',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color:
                    todayOutreach.length > 0 ? C.purple : C.dim,
                }}
              >
                {todayOutreach.length}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.blue,
                }}
              >
                {weeklyOutreach}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 8,
                  color: C.dim,
                  textTransform: 'uppercase',
                }}
              >
                Today
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: C.blue,
                }}
              >
                This week
              </div>
            </div>
          </div>
          <div
            style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}
          >
            {todayOutreach.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {todayOutreach.slice(-3).map((o, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 9,
                      color: C.dim,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {o.type === 'message'
                      ? '💬'
                      : o.type === 'post'
                        ? '📣'
                        : o.type === 'call'
                          ? '📞'
                          : o.type === 'email'
                            ? '📧'
                            : '🤝'}{' '}
                    {o.target || o.notes || o.type}
                  </div>
                ))}
              </div>
            ) : getBehavior('outreach_enforcement', currentMode) ===
              'modal' ? (
                <div style={{ fontSize: 9, color: C.red }}>
                  ⚠ No outreach yet today
                </div>
              ) : (
                <div style={{ fontSize: 9, color: C.dim }}>
                  No outreach logged today
                </div>
              )}
          </div>
        </div>
      )}

      {/* Tasks card (Phase 5.4) */}
      <div
        style={S.card(
          tasks.filter((t) => t.status !== 'complete').length > 0,
          C.amber
        )}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: C.amber,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
            }}
          >
            ✓ My Tasks
          </span>
          <button
            style={{
              ...S.btn('ghost'),
              fontSize: 9,
              borderColor: C.amber + '50',
              color: C.amber,
            }}
            onClick={() => setShowTaskModal(true)}
          >
            + Add
          </button>
        </div>
        {tasksLoading ? (
          <div style={{ fontSize: 10, color: C.dim }}>
            Loading tasks...
          </div>
        ) : tasks.filter((t) => t.status !== 'complete').length ===
          0 ? (
            <div style={{ fontSize: 9, color: C.dim }}>
              No pending tasks. Create one to get started.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {tasks
                .filter((t) => t.status !== 'complete')
                .slice(0, 5)
                .map((task) => {
                  const project = projects.find(
                    (p) => p.id === task.project_id
                  );
                  const priorityColor =
                    task.priority === 'critical'
                      ? C.red
                      : task.priority === 'high'
                        ? C.amber
                        : task.priority === 'medium'
                          ? C.blue
                          : C.dim;
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        background: '#0a0f14',
                        borderRadius: 4,
                      }}
                    >
                      <button
                        style={{
                          width: 16,
                          height: 16,
                          border: `1px solid ${C.border}`,
                          borderRadius: 3,
                          background: 'transparent',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        onClick={() => completeTask(task.id)}
                        title="Complete task"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: C.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {task.title}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: C.dim,
                            display: 'flex',
                            gap: 6,
                          }}
                        >
                          {project && (
                            <span>
                              {project.emoji} {project.name}
                            </span>
                          )}
                          <span style={{ color: priorityColor }}>
                            {task.priority}
                          </span>
                          {task.assignee_type === 'agent' && (
                            <span>🤖 {task.assignee_id}</span>
                          )}
                        </div>
                      </div>
                      <button
                        style={{
                          ...S.btn('ghost'),
                          padding: '2px 6px',
                          fontSize: 8,
                          color: C.red,
                        }}
                        onClick={() => deleteTask(task.id)}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              {tasks.filter((t) => t.status !== 'complete').length >
                5 && (
                  <div
                    style={{
                      fontSize: 9,
                      color: C.dim,
                      textAlign: 'center',
                    }}
                  >
                    +
                    {tasks.filter((t) => t.status !== 'complete').length -
                      5}{' '}
                    more tasks
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      <div style={S.card(true)}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              color: C.blue,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
            }}
          >
            ⚡ Today's Focus
          </span>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {projects.map((p) => (
              <button
                key={p.id}
                style={{
                  ...S.btn(focusId === p.id ? 'primary' : 'ghost'),
                  fontSize: 9,
                }}
                onClick={() => setFocusId(p.id)}
              >
                {p.emoji}
              </button>
            ))}
          </div>
        </div>
        {focusP && (
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.blue}`,
              borderRadius: 6,
              padding: '12px 16px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 6,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#f1f5f9',
                }}
              >
                {focusP.emoji} {focusP.name}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <BadgeStatus status={focusP.status} />
                <HealthBar score={focusP.health} />
                <Dots n={focusP.momentum} />
              </div>
            </div>
            <div
              style={{
                fontSize: 11,
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 8,
              }}
            >
              {focusP.desc}
            </div>
            <span style={S.label()}>Next Action</span>
            <div
              style={{
                fontSize: 12,
                color: C.green,
                marginBottom: 8,
              }}
            >
              → {focusP.nextAction}
            </div>
            {focusP.blockers?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                {focusP.blockers.map((b, i) => (
                  <div
                    key={i}
                    style={{ fontSize: 10, color: '#78350f' }}
                  >
                    ⚠ {b}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}
            >
              <button
                style={S.btn('success')}
                onClick={() => openHub(focusP.id)}
              >
                🗂 Open Hub
              </button>
              {!sessionActive && (
                <button
                  style={S.btn('primary')}
                  onClick={() => setSessionOn(true)}
                >
                  ▶ Start Session
                </button>
              )}
              <button
                style={S.btn('ghost')}
                onClick={() => {
                  setMainTab('ai');
                  askAI(
                    `Sharp 2-hour plan for ${focusP.name}. What exactly do I do right now?`
                  );
                }}
              >
                💬 Ask AI
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={S.card(false)}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: C.blue,
              letterSpacing: '0.11em',
              textTransform: 'uppercase',
            }}
          >
            📋 Priority Stack {activeAreaFilter && '(Filtered)'}
          </div>
          {activeAreaFilter && (
            <button
              style={{ ...S.btn('ghost'), fontSize: 8 }}
              onClick={() => setActiveAreaFilter(null)}
            >
              Show All
            </button>
          )}
        </div>
        {[...filteredProjects]
          .sort((a, b) => a.priority - b.priority)
          .map((p, i) => (
            <div
              key={p.id}
              onClick={() => openHub(p.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 0',
                borderBottom:
                  i < projects.length - 1
                    ? `1px solid ${C.border}`
                    : 'none',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 18,
                  fontSize: 10,
                  color: p.id === focusId ? C.blue2 : '#e2e8f0',
                  fontWeight: p.id === focusId ? 700 : 400,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.priority}
              </div>
              <span style={{ fontSize: 14 }}>{p.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: p.id === focusId ? C.blue2 : '#e2e8f0',
                    fontWeight: p.id === focusId ? 700 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 8, color: C.dim }}>
                  {p.phase} · {p.lastTouched}
                </div>
              </div>
              <HealthBar score={p.health} />
              <Dots n={p.momentum} />
              <BadgeStatus status={p.status} />
              {p.revenueReady && (
                <span style={S.badge(C.green)}>
                  {activeGoal?.currency === 'GBP'
                    ? '£'
                    : activeGoal?.currency === 'USD'
                      ? '$'
                      : activeGoal?.currency === 'EUR'
                        ? '€'
                        : activeGoal?.currency || '£'}
                </span>
              )}
              {staging.filter(
                (s) => s.project === p.id && s.status === 'in-review'
              ).length > 0 && (
                <span style={S.badge(C.amber)}>
                  {
                    staging.filter(
                      (s) =>
                        s.project === p.id && s.status === 'in-review'
                    ).length
                  }
                  ⏳
                </span>
              )}
            </div>
          ))}
      </div>

      {/* Progress Trends (simplified) */}
      {weeklyTraining.count > 0 && (
        <div style={{ marginTop: 12 }}>
          <ProgressTrends
            title="Training Trend (Last 7 Days)"
            data={[
              {
                label: 'Mon',
                value: Math.max(0, weeklyTraining.count - 2),
              },
              {
                label: 'Tue',
                value: Math.max(0, weeklyTraining.count - 1),
              },
              { label: 'Wed', value: weeklyTraining.count },
              { label: 'Thu', value: weeklyTraining.count },
              { label: 'Fri', value: weeklyTraining.count },
              { label: 'Sat', value: weeklyTraining.count },
              { label: 'Sun', value: weeklyTraining.count },
            ]}
            color={C.green}
          />
        </div>
      )}
    </div>
  );
};

export default CommandCentre;