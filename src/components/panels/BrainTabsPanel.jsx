import { HealthBar, BadgeStatus, Dots } from '../UI/SmallComponents.jsx';
import ProgressTrends from '../ProgressTrends.jsx';
import AgentManager from '../AgentManager.jsx';
import WorkflowRunner from '../WorkflowRunner.jsx';
import WeeklyReviewPanel from '../WeeklyReviewPanel.jsx';
import GitHubIntegration from '../GitHubIntegration.jsx';
import { renderAIResponse } from '../URILink.jsx';
import { uriToNavigation } from '../../uri.js';
import { getBehavior, getMode, shouldShow } from '../../modeHelper.js';
import {
  C,
  S,
  ITEM_TAGS,
  REVIEW_STATUSES,
  BUIDL_VERSION,
} from '../../utils/constants.js';
import { calcHealth } from '../../utils/projectFactory.js';

/**
 * BrainTabsPanel — all mainTab content panels.
 * Accepts a single ctx prop with all required state/callbacks.
 */
export default function BrainTabsPanel({ ctx }) {
  const {
    mainTab,
    projects,
    staging,
    ideas,
    areas,
    goals,
    templates,
    tasks,
    userTags,
    entityTags,
    integrations,
    isMobile,
    areaStats,
    activeAreaFilter,
    setActiveAreaFilter,
    driftFlags,
    driftExpanded,
    setDriftExpanded,
    focusId,
    setFocusId,
    focusP,
    totalIncome,
    activeGoal,
    weeklyTraining,
    currentMode,
    weeklyOutreach,
    todayOutreach,
    modal,
    setModal,
    setMainTab,
    setView,
    setBootstrapWiz,
    setShowImportModal,
    setShowGoalModal,
    setShowTrainingModal,
    setShowOutreachModal,
    setShowTaskModal,
    setSessionOn,
    sessionActive,
    hubId,
    newStaging,
    setNewStaging,
    newIdea,
    setNewIdea,
    aiIn,
    setAiIn,
    aiOut,
    aiLoad,
    selectedTagId,
    setSelectedTagId,
    projectsById,
    // functions
    openHub,
    saveFile,
    exportProject,
    addStaging,
    addIdea,
    askAI,
    completeTask,
    deleteTask,
    dismissDriftFlag,
    QuickTagRow,
    buildCtx,
    buildBrief,
    copy,
    showToast,
  } = ctx;

  return (
    <>
      {mainTab === 'command' && (
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
                  setActiveAreaFilter(activeAreaFilter === a.id ? null : a.id)
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
                          <span style={{ ...S.badge(C.red), fontSize: 8 }}>
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
                onClick={() => setDriftExpanded((prev) => !prev)}
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
              <div style={{ display: 'flex', gap: 16 }}>
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
                      width: `${Math.min(100, Math.round((weeklyTraining.count / 3) * 100))}%`,
                      height: '100%',
                      background: weeklyTraining.count >= 3 ? C.green : C.amber,
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
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: todayOutreach.length > 0 ? C.purple : C.dim,
                      }}
                    >
                      {todayOutreach.length}
                    </div>
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
                      {weeklyOutreach}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      This week
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
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
              <div style={{ fontSize: 10, color: C.dim }}>Loading tasks...</div>
            ) : tasks.filter((t) => t.status !== 'complete').length === 0 ? (
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
                              whiteSpace: 'nowrap',
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
                {tasks.filter((t) => t.status !== 'complete').length > 5 && (
                  <div
                    style={{
                      fontSize: 9,
                      color: C.dim,
                      textAlign: 'center',
                    }}
                  >
                    +{tasks.filter((t) => t.status !== 'complete').length - 5}{' '}
                    more tasks
                  </div>
                )}
              </div>
            )}
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
                      <div key={i} style={{ fontSize: 10, color: '#78350f' }}>
                        ⚠ {b}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
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
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = '#ffffff05')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <div
                    style={{
                      width: 18,
                      fontSize: 10,
                      color: C.dim,
                      fontWeight: 700,
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
                          (s) => s.project === p.id && s.status === 'in-review'
                        ).length
                      }
                      ⏳
                    </span>
                  )}
                </div>
              ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
              cursor: 'pointer',
            }}
            onClick={() => setModal('manage-goals')}
          >
            <div style={{ fontSize: 9, color: C.dim }}>
              {activeGoal?.title || 'Goal'}:{' '}
              {activeGoal?.currency === 'USD'
                ? '$'
                : activeGoal?.currency === 'EUR'
                  ? '€'
                  : activeGoal?.currency === 'GBP'
                    ? '£'
                    : activeGoal?.currency || '£'}
              {totalIncome} /{' '}
              {activeGoal?.currency === 'USD'
                ? '$'
                : activeGoal?.currency === 'EUR'
                  ? '€'
                  : activeGoal?.currency === 'GBP'
                    ? '£'
                    : activeGoal?.currency || '£'}
              {activeGoal?.target_amount || 3000} (
              {Math.round(
                (totalIncome / (activeGoal?.target_amount || 3000)) * 100
              )}
              %)
            </div>
            <div style={{ fontSize: 9, color: C.blue }}>⚙️ Manage</div>
          </div>
          <div
            style={{
              height: 6,
              background: C.border,
              borderRadius: 3,
              overflow: 'hidden',
              marginBottom: 4,
            }}
            onClick={() => setModal('manage-goals')}
          >
            <div
              style={{
                width: `${Math.min(100, Math.round((totalIncome / (activeGoal?.target_amount || 3000)) * 100))}%`,
                height: '100%',
                background: `linear-gradient(90deg,${C.blue},${C.green})`,
                borderRadius: 3,
              }}
            />
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
      )}

      {mainTab === 'projects' && (
        <div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <button
              style={S.btn('primary')}
              onClick={() => setModal('new-project')}
            >
              + New Project
            </button>
            <button
              style={S.btn('ghost')}
              onClick={() => setShowImportModal(true)}
            >
              ⬆ Import
            </button>
          </div>
          {projects.map((p) => (
            <div key={p.id} style={S.card(false)}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{p.emoji}</span>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#f1f5f9',
                      }}
                    >
                      {p.name}
                    </div>
                    <div style={{ fontSize: 8, color: C.muted }}>
                      {p.phase} · #{p.priority} · {p.lastTouched}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 5,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <HealthBar score={p.health} />
                  <Dots n={p.momentum} />
                  <BadgeStatus status={p.status} />
                  <button
                    style={{ ...S.btn('success'), fontSize: 9 }}
                    onClick={() => openHub(p.id)}
                  >
                    🗂 Hub
                  </button>
                  <button
                    style={{ ...S.btn('ghost'), fontSize: 9 }}
                    onClick={() => exportProject(p.id)}
                  >
                    ⬇
                  </button>
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: C.muted,
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                {p.desc}
              </div>
              <div style={{ fontSize: 10, color: C.green }}>
                → {p.nextAction}
              </div>
              <QuickTagRow entityType="project" entityId={p.id} />
            </div>
          ))}
          {projects.length === 0 && (
            <div
              style={{
                fontSize: 11,
                color: C.dim,
                textAlign: 'center',
                padding: '40px 0',
              }}
            >
              No projects yet. Create your first one above.
            </div>
          )}
        </div>
      )}

      {mainTab === 'bootstrap' && (
        <div>
          <div style={{ ...S.card(true, C.green), marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div>
                <span style={S.label(C.green)}>
                  🚀 Agent Bootstrap Protocol
                </span>
                <div
                  style={{
                    fontSize: 11,
                    color: C.text,
                    lineHeight: 1.8,
                    maxWidth: 560,
                  }}
                >
                  Spin up a new project with agent control baked in from day
                  one. Generates a Bootstrap Brief + ready-to-paste agent
                  prompts, all saved to your database.
                </div>
              </div>
              <button
                style={{
                  ...S.btn('success'),
                  fontSize: 11,
                  padding: '8px 16px',
                }}
                onClick={() => setModal('new-project')}
              >
                + New Project → Bootstrap
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : 'repeat(auto-fill,minmax(180px,1fr))',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {BOOTSTRAP_STEPS.map((s, i) => (
              <div
                key={s.id}
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 9, color: C.dim, fontWeight: 700 }}>
                    STEP {i + 1}
                  </span>
                  {s.agent ? (
                    <span style={S.badge(C.blue2)}>{s.agent}</span>
                  ) : (
                    <span style={S.badge(C.amber)}>YOU</span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#e2e8f0',
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.6 }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
          {projects.map((p) => {
            const bf = p.files || {};
            const briefExists = !!bf['project-artifacts/BOOTSTRAP_BRIEF.md'];
            const stratDone = !!bf['project-artifacts/STRATEGY_OUTPUT.md'];
            const devDone = !!bf['code-modules/DEV_BRIEF.md'];
            const steps = [
              { label: 'Brief', done: briefExists },
              { label: 'Strategy', done: stratDone },
              { label: 'Dev', done: devDone },
              { label: 'Design', done: !!bf['design-assets/UI_SPEC.md'] },
              {
                label: 'Content',
                done: !!bf['content-assets/LAUNCH_COPY.md'],
              },
              {
                label: 'Review',
                done:
                  p.status === 'active' && briefExists && stratDone && devDone,
              },
            ];
            const pct = Math.round(
              (steps.filter((s) => s.done).length / steps.length) * 100
            );
            return (
              <div
                key={p.id}
                style={{
                  ...S.card(false),
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setBootstrapWiz(p.id)}
              >
                <span style={{ fontSize: 18, flexShrink: 0 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: '#e2e8f0',
                        fontWeight: 600,
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color:
                          pct === 100 ? C.green : pct > 0 ? C.amber : C.dim,
                      }}
                    >
                      {pct}% bootstrapped
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {steps.map((s) => (
                      <span
                        key={s.label}
                        style={{
                          fontSize: 8,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: s.done
                            ? 'rgba(16,185,129,0.12)'
                            : 'rgba(255,255,255,0.04)',
                          color: s.done ? C.green : C.dim,
                          border: `1px solid ${s.done ? '#10b98130' : C.border}`,
                        }}
                      >
                        {s.done ? '✓' : ''} {s.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                  {briefExists ? (
                    <button
                      style={{ ...S.btn('ghost'), fontSize: 9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openHub(p.id, 'project-artifacts/BOOTSTRAP_BRIEF.md');
                      }}
                    >
                      📋 Brief
                    </button>
                  ) : (
                    <span style={S.badge(C.amber)}>No Brief</span>
                  )}
                  {briefExists && !stratDone && (
                    <button
                      style={{ ...S.btn('primary'), fontSize: 9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openHub(p.id, 'project-artifacts/STRATEGY_PROMPT.md');
                      }}
                    >
                      🎯 Strategy →
                    </button>
                  )}
                  {stratDone && !devDone && (
                    <button
                      style={{ ...S.btn('primary'), fontSize: 9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openHub(p.id, 'project-artifacts/DEV_PROMPT.md');
                      }}
                    >
                      🛠 Dev →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mainTab === 'staging' && (
        <div>
          <div style={S.card(false)}>
            <span style={S.label()}>🌀 Stage Something</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <select
                style={S.sel}
                value={newStaging.tag}
                onChange={(e) =>
                  setNewStaging((s) => ({ ...s, tag: e.target.value }))
                }
              >
                {ITEM_TAGS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                style={S.sel}
                value={newStaging.project}
                onChange={(e) =>
                  setNewStaging((s) => ({
                    ...s,
                    project: e.target.value,
                  }))
                }
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              style={{ ...S.input, marginBottom: 6 }}
              placeholder="Name or description..."
              value={newStaging.name}
              onChange={(e) =>
                setNewStaging((s) => ({ ...s, name: e.target.value }))
              }
            />
            <input
              style={{ ...S.input, marginBottom: 6 }}
              placeholder="Notes..."
              value={newStaging.notes}
              onChange={(e) =>
                setNewStaging((s) => ({ ...s, notes: e.target.value }))
              }
            />
            <button
              style={S.btn('primary')}
              onClick={() => {
                if (newStaging.name.trim()) {
                  addStaging(newStaging);
                  setNewStaging({
                    name: '',
                    tag: 'IDEA_',
                    project: projects[0]?.id || '',
                    notes: '',
                  });
                }
              }}
            >
              → Stage It
            </button>
          </div>
          {['in-review', 'approved', 'deferred', 'rejected'].map((sk) => {
            const items = staging.filter((s) => s.status === sk);
            if (!items.length && sk !== 'in-review') return null;
            const sc = REVIEW_STATUSES[sk];
            return (
              <div key={sk} style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: sc.color,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  {sc.icon} {sc.label} ({items.length})
                </div>
                {!items.length && (
                  <div style={{ fontSize: 9, color: C.dim }}>Nothing here.</div>
                )}
                {items.map((item) => {
                  const proj = projects.find((p) => p.id === item.project);
                  const isc = REVIEW_STATUSES[item.status];
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: C.surface,
                        border: `1px solid ${isc.color}22`,
                        borderLeft: `3px solid ${isc.color}`,
                        borderRadius: '0 5px 5px 0',
                        padding: '8px 13px',
                        marginBottom: 5,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 5,
                          marginBottom: 3,
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: 9,
                              background: C.border,
                              padding: '1px 5px',
                              borderRadius: 3,
                              marginRight: 6,
                            }}
                          >
                            {item.tag}
                          </span>
                          <span style={{ fontSize: 11 }}>{item.name}</span>
                        </div>
                        <span style={{ fontSize: 8, color: C.muted }}>
                          {proj?.emoji} {proj?.name} · {item.added}
                        </span>
                      </div>
                      {item.notes && (
                        <div
                          style={{
                            fontSize: 9,
                            color: C.muted,
                            marginBottom: 5,
                          }}
                        >
                          {item.notes}
                        </div>
                      )}
                      <QuickTagRow entityType="staging" entityId={item.id} />
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {['approved', 'rejected', 'deferred']
                          .filter((s) => s !== sk)
                          .map((s) => (
                            <button
                              key={s}
                              style={{
                                ...S.btn(
                                  s === 'approved'
                                    ? 'success'
                                    : s === 'rejected'
                                      ? 'danger'
                                      : 'ghost'
                                ),
                                padding: '2px 7px',
                                fontSize: 8,
                              }}
                              onClick={() => updateStagingStatus(item.id, s)}
                            >
                              {REVIEW_STATUSES[s].icon} {s}
                            </button>
                          ))}
                        <button
                          style={{
                            ...S.btn('ghost'),
                            padding: '2px 7px',
                            fontSize: 8,
                          }}
                          onClick={() => openHub(item.project)}
                        >
                          🗂 Hub
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {mainTab === 'skills' && (
        <div style={{ height: 'calc(100vh - 200px)' }}>
          <AgentManager
            projectId={hubId}
            projectFiles={hub?.files}
            onSaveAgent={async (agentId, content) => {
              // Save custom agent to project files
              if (hubId) {
                await saveFile(hubId, `agents/${agentId}.md`, content);
                showToast(`✓ Agent ${agentId} created`);
              }
            }}
          />
        </div>
      )}

      {mainTab === 'workflows' && (
        <div style={{ height: 'calc(100vh - 200px)' }}>
          <WorkflowRunner
            projectId={focusId}
            project={projects.find((p) => p.id === focusId)}
            agents={[]}
          />
        </div>
      )}

      {mainTab === 'integrations' && (
        <GitHubIntegration projects={projects} isMobile={isMobile} />
      )}

      {mainTab === 'ideas' && (
        <div>
          <div style={S.card(false)}>
            <span style={S.label()}>💡 Bank an Idea</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={S.input}
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                placeholder="Describe it..."
                onKeyDown={(e) => e.key === 'Enter' && addIdea(newIdea)}
              />
              <button style={S.btn('primary')} onClick={() => addIdea(newIdea)}>
                Bank It
              </button>
            </div>
            <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
              Ideas ≠ projects. Bank now. Promote only when P1–P3 have revenue.
            </div>
          </div>
          {ideas.map((idea) => (
            <div
              key={idea.id}
              style={{
                ...S.card(false),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.text }}>{idea.title}</div>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    marginTop: 3,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  <QuickTagRow entityType="idea" entityId={idea.id} />
                  <span
                    style={{
                      fontSize: 8,
                      padding: '1px 5px',
                      borderRadius: 8,
                      background: C.border,
                      color: C.muted,
                    }}
                  >
                    {idea.added}
                  </span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color:
                    idea.score >= 7
                      ? C.green
                      : idea.score >= 5
                        ? C.amber
                        : C.red,
                }}
              >
                {idea.score}/10
              </div>
            </div>
          ))}
        </div>
      )}

      {mainTab === 'ai' && (
        <div>
          <div style={S.card(false)}>
            <span style={S.label()}>💬 AI Coach</span>
            {getBehavior('ai_coach_tab', currentMode) === 'full' && (
              <div
                style={{
                  display: 'flex',
                  gap: 5,
                  flexWrap: 'wrap',
                  marginBottom: 10,
                }}
              >
                {[
                  'What should I work on today?',
                  'Where am I looping?',
                  'Thailand income path?',
                  'Triage staging',
                  'Rank by revenue potential',
                  'Which project is dying?',
                ].map((p) => (
                  <button
                    key={p}
                    style={S.btn('ghost')}
                    onClick={() => askAI(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={S.input}
                value={aiIn}
                placeholder="Ask anything..."
                onChange={(e) => setAiIn(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiIn.trim()) {
                    askAI(aiIn);
                    setAiIn('');
                  }
                }}
              />
              <button
                style={S.btn('primary')}
                onClick={() => {
                  if (aiIn.trim()) {
                    askAI(aiIn);
                    setAiIn('');
                  }
                }}
                disabled={aiLoad}
              >
                Ask
              </button>
            </div>
          </div>
          {(aiLoad || aiOut) && (
            <div ref={aiRef} style={{ ...S.card(true, C.green) }}>
              <span style={S.label(C.green)}>Response</span>
              {aiLoad ? (
                <div style={{ fontSize: 10, color: C.dim }}>Thinking...</div>
              ) : (
                <div
                  style={{
                    fontSize: 11,
                    color: C.text,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {renderAIResponse(aiOut, projectsById, (uri) => {
                    const nav = uriToNavigation(uri);
                    if (!nav) return;
                    if (
                      nav.type === 'OPEN_PROJECT' ||
                      nav.type === 'OPEN_FILE'
                    ) {
                      const proj = projects.find(
                        (p) => p.id === nav.params.projectId
                      );
                      if (proj) {
                        openHub(proj);
                        if (nav.params.filePath) {
                          setTimeout(() => openFile(nav.params.filePath), 100);
                        }
                      }
                    } else if (nav.type === 'OPEN_GOAL') {
                      setShowGoalModal(true);
                    }
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mainTab === 'review' && (
        <WeeklyReviewPanel
          token={token.get()}
          onAskAI={async (prompt) => {
            const d = await aiApi.ask(prompt);
            return d.content?.map((b) => b.text || '').join('') || '';
          }}
        />
      )}

      {mainTab === 'export' && (
        <div>
          <div style={S.card(true)}>
            <span style={S.label()}>📤 Agent Context + Exports</span>
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <button style={S.btn('primary')} onClick={() => copy(buildCtx())}>
                {copied ? '✓ Copied!' : '📋 Copy Full Context'}
              </button>
              {projects[0] && (
                <>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => copy(buildBrief('dev', briefProj))}
                  >
                    📋 Dev Brief
                  </button>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => copy(buildBrief('strategy', briefProj))}
                  >
                    📋 Strategy Brief
                  </button>
                </>
              )}
            </div>
            <div style={{ marginBottom: 10 }}>
              <span style={S.label()}>Export Projects (local download)</span>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    style={S.btn('ghost')}
                    onClick={() => exportProject(p.id)}
                  >
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
            </div>
            <pre
              style={{
                fontSize: 8,
                color: C.dim,
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 5,
                padding: 12,
                overflow: 'auto',
                maxHeight: 280,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {buildCtx()}
            </pre>
          </div>
        </div>
      )}

      {mainTab === 'tags' && (
        <div>
          <div style={S.card(false)}>
            <span style={S.label()}>🏷 Tag Cloud</span>
            {userTags.length === 0 ? (
              <div style={{ fontSize: 10, color: C.dim, padding: '8px 0' }}>
                No tags yet. Tag a project, idea, staging item, goal, or file to
                get started.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 6,
                }}
              >
                {userTags.map((t) => {
                  const count = entityTags.filter(
                    (et) => et.tag_id === t.id
                  ).length;
                  const isSel = selectedTagId === t.id;
                  return (
                    <span
                      key={t.id}
                      onClick={() => setSelectedTagId(isSel ? null : t.id)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        border: `1px solid ${isSel ? t.color || C.blue : C.border}`,
                        background: isSel
                          ? (t.color || C.blue) + '22'
                          : 'transparent',
                        color: t.color || C.blue,
                        fontSize: 10,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      {t.name}{' '}
                      <span style={{ fontSize: 8, color: C.muted }}>
                        {count}
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          {selectedTagId &&
            (() => {
              const tag = userTags.find((t) => t.id === selectedTagId);
              if (!tag) return null;
              const matches = entityTags.filter(
                (et) => et.tag_id === selectedTagId
              );
              const byType = {};
              matches.forEach((et) => {
                if (!byType[et.entity_type]) byType[et.entity_type] = [];
                byType[et.entity_type].push(et);
              });
              const TYPE_LABELS = {
                project: 'Projects',
                idea: 'Ideas',
                staging: 'Staging',
                goal: 'Goals',
                file: 'Files',
              };
              const renderEntity = (type, et) => {
                if (type === 'project') {
                  const p = projects.find(
                    (p) => String(p.id) === String(et.entity_id)
                  );
                  if (!p) return null;
                  return (
                    <div
                      key={et.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        borderBottom: `1px solid ${C.border}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        openHub(p.id);
                        setView('hub');
                      }}
                    >
                      <span>{p.emoji}</span>
                      <span style={{ fontSize: 10 }}>{p.name}</span>
                      <BadgeStatus status={p.status} />
                    </div>
                  );
                }
                if (type === 'idea') {
                  const i = ideas.find(
                    (i) => String(i.id) === String(et.entity_id)
                  );
                  if (!i) return null;
                  return (
                    <div
                      key={et.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: 10 }}>💡 {i.title}</span>
                      <span style={{ fontSize: 9, color: C.dim }}>
                        {i.score}/10
                      </span>
                    </div>
                  );
                }
                if (type === 'staging') {
                  const s = staging.find(
                    (s) => String(s.id) === String(et.entity_id)
                  );
                  if (!s) return null;
                  const proj = projects.find((p) => p.id === s.project);
                  return (
                    <div
                      key={et.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: 10 }}>🌀 {s.name}</span>
                      <span style={{ fontSize: 8, color: C.muted }}>
                        {proj?.emoji} {proj?.name}
                      </span>
                    </div>
                  );
                }
                if (type === 'goal') {
                  const g = goals.find(
                    (g) => String(g.id) === String(et.entity_id)
                  );
                  if (!g) return null;
                  return (
                    <div
                      key={et.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        borderBottom: `1px solid ${C.border}`,
                      }}
                    >
                      <span style={{ fontSize: 10 }}>🎯 {g.title}</span>
                      <span style={{ fontSize: 8, color: C.muted }}>
                        {g.currency}
                        {g.current_amount}/{g.target_amount}
                      </span>
                    </div>
                  );
                }
                if (type === 'file') {
                  const [projectId, ...rest] = et.entity_id.split('/');
                  const filePath = rest.join('/');
                  const p = projects.find(
                    (p) => String(p.id) === String(projectId)
                  );
                  return (
                    <div
                      key={et.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 0',
                        borderBottom: `1px solid ${C.border}`,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        openHub(projectId, filePath);
                        setView('hub');
                      }}
                    >
                      <span style={{ fontSize: 10 }}>📝 {filePath}</span>
                      <span style={{ fontSize: 8, color: C.muted }}>
                        {p?.emoji} {p?.name}
                      </span>
                    </div>
                  );
                }
                return null;
              };
              return (
                <div style={S.card(false)}>
                  <span style={S.label()}>
                    All entities tagged{' '}
                    <span style={{ color: tag.color || C.blue }}>
                      {tag.name}
                    </span>{' '}
                    ({matches.length})
                  </span>
                  {matches.length === 0 && (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      No entities tagged with this yet.
                    </div>
                  )}
                  {['project', 'idea', 'staging', 'goal', 'file']
                    .filter((type) => byType[type])
                    .map((type) => (
                      <div key={type} style={{ marginBottom: 12 }}>
                        <div
                          style={{
                            fontSize: 8,
                            color: C.dim,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 4,
                          }}
                        >
                          {TYPE_LABELS[type]} ({byType[type].length})
                        </div>
                        {byType[type].map((et) => renderEntity(type, et))}
                      </div>
                    ))}
                </div>
              );
            })()}
        </div>
      )}
    </>
  );
}
