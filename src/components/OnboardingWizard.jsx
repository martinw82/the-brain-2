import { useState, useEffect } from 'react';
import { C, S } from '../utils/constants.js';
import { useUser } from '../contexts/UserContext.jsx';

// ═══════════════════════════════════════════════════════════
// ONBOARDING WIZARD (Phase 4.2)
// ═══════════════════════════════════════════════════════════
const OnboardingWizard = ({
  templates,
  areas,
  onComplete,
  onSkip,
  onCreateGoal,
  onCreateProject,
  isMobile,
}) => {
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [useCases, setUseCases] = useState([]);
  const [goalForm, setGoalForm] = useState({
    title: '',
    target_amount: 5000,
    currency: 'USD',
    timeframe: 'monthly',
    category: 'income',
  });
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const totalSteps = 4;
  const progress = step / totalSteps;

  const useCaseOptions = [
    {
      id: 'business',
      icon: '💼',
      label: 'Business / Work',
      desc: 'Projects, clients, revenue goals',
    },
    {
      id: 'creative',
      icon: '🎨',
      label: 'Creative Projects',
      desc: 'Art, writing, design, music',
    },
    {
      id: 'health',
      icon: '💪',
      label: 'Health & Fitness',
      desc: 'Training, nutrition, wellness',
    },
    {
      id: 'personal',
      icon: '👤',
      label: 'Personal / Life',
      desc: 'Organization, learning, growth',
    },
  ];

  const suggestedTemplates = {
    business: ['BUIDL Framework', 'Software Project'],
    creative: ['Content Project'],
    health: ['Health & Fitness'],
    personal: ['Blank'],
  };

  const suggestedGoals = {
    business: { title: 'Reach $5k MRR', target_amount: 5000, currency: 'USD' },
    creative: { title: 'Launch 3 Projects', target_amount: 3, currency: 'USD' },
    health: { title: 'Train 150 Times', target_amount: 150, currency: 'USD' },
    personal: { title: 'Save $10,000', target_amount: 10000, currency: 'USD' },
  };

  // Auto-suggest based on use cases
  useEffect(() => {
    if (useCases.length > 0) {
      const primary = useCases[0];
      const suggestion = suggestedGoals[primary];
      if (suggestion && !goalForm.title) {
        setGoalForm((f) => ({ ...f, ...suggestion }));
      }
      // Auto-select template
      const templateNames = suggestedTemplates[primary] || ['Blank'];
      const template = templates.find((t) => templateNames.includes(t.name));
      if (template) setSelectedTemplate(template.id);
      // Auto-fill project name
      if (!projectName) {
        setProjectName(`${user?.name?.split(' ')[0] || 'My'}'s First Project`);
      }
    }
  }, [useCases]);

  const toggleUseCase = (id) => {
    setUseCases((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      // Step 2: Create goal
      let goalId = null;
      if (goalForm.title) {
        const goal = await onCreateGoal(goalForm);
        goalId = goal?.id;
      }

      // Step 3: Create project
      const project = await onCreateProject({
        name: projectName,
        templateId: selectedTemplate,
        goalId,
      });

      onComplete(project);
    } catch (e) {
      console.error('Onboarding error:', e);
    } finally {
      setCreating(false);
    }
  };

  const modalWidth = isMobile ? '100vw' : '500px';
  const modalHeight = isMobile ? '100vh' : 'auto';
  const modalMaxHeight = isMobile ? '100vh' : '85vh';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'center',
        background: C.bg,
      }}
    >
      <div
        style={{
          width: modalWidth,
          height: modalHeight,
          maxHeight: modalMaxHeight,
          background: C.surface,
          border: isMobile ? 'none' : `1px solid ${C.border}`,
          borderRadius: isMobile ? 0 : 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '20px 16px 12px' : '24px 24px 16px',
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: isMobile ? 16 : 14,
                fontWeight: 700,
                color: '#f1f5f9',
              }}
            >
              Welcome to The Brain 🧠
            </span>
            <button
              style={{ ...S.btn('ghost'), fontSize: 9, padding: '6px 12px' }}
              onClick={onSkip}
            >
              I know what I'm doing \u2192
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: i <= step ? C.blue : C.border,
                  transition: 'background 0.3s',
                }}
              />
            ))}
          </div>
          <div
            style={{
              fontSize: 9,
              color: C.dim,
              marginTop: 6,
              textAlign: 'center',
            }}
          >
            Step {step} of {totalSteps}
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '16px' : '24px',
          }}
        >
          {/* Step 1: Welcome / Use Cases */}
          {step === 1 && (
            <div>
              <div
                style={{
                  fontSize: isMobile ? 20 : 18,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: 8,
                }}
              >
                What will you use The Brain for?
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
                Select all that apply. This helps us set up your first project.
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 10,
                }}
              >
                {useCaseOptions.map((uc) => {
                  const selected = useCases.includes(uc.id);
                  return (
                    <button
                      key={uc.id}
                      onClick={() => toggleUseCase(uc.id)}
                      style={{
                        background: selected ? `${C.blue}15` : C.bg,
                        border: `2px solid ${selected ? C.blue : C.border}`,
                        borderRadius: 10,
                        padding: 16,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 28, marginBottom: 8 }}>
                        {uc.icon}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: selected ? '#f1f5f9' : C.text,
                          marginBottom: 4,
                        }}
                      >
                        {uc.label}
                      </div>
                      <div style={{ fontSize: 9, color: C.muted }}>
                        {uc.desc}
                      </div>
                      {selected && (
                        <div
                          style={{ marginTop: 8, fontSize: 10, color: C.blue }}
                        >
                          \u2713 Selected
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Goal */}
          {step === 2 && (
            <div>
              <div
                style={{
                  fontSize: isMobile ? 20 : 18,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: 8,
                }}
              >
                Set your first goal
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
                What are you working toward? You can always change this later.
              </div>

              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div style={{ marginBottom: 12 }}>
                  <span style={S.label()}>Goal Title</span>
                  <input
                    style={S.input}
                    value={goalForm.title}
                    onChange={(e) =>
                      setGoalForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="e.g., Reach $5k MRR"
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <span style={S.label()}>Target</span>
                    <input
                      style={S.input}
                      type="number"
                      value={goalForm.target_amount}
                      onChange={(e) =>
                        setGoalForm((f) => ({
                          ...f,
                          target_amount: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <span style={S.label()}>Currency</span>
                    <select
                      style={S.sel}
                      value={goalForm.currency}
                      onChange={(e) =>
                        setGoalForm((f) => ({ ...f, currency: e.target.value }))
                      }
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (\u20AC)</option>
                      <option value="GBP">GBP (\u00A3)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <span style={S.label()}>Timeframe</span>
                  <select
                    style={S.sel}
                    value={goalForm.timeframe}
                    onChange={(e) =>
                      setGoalForm((f) => ({ ...f, timeframe: e.target.value }))
                    }
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: `${C.blue}10`,
                  borderRadius: 8,
                  border: `1px solid ${C.blue}30`,
                }}
              >
                <div style={{ fontSize: 10, color: C.blue }}>
                  💡 Tip: Goals in The Brain track your project's income
                  contributions automatically.
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Project */}
          {step === 3 && (
            <div>
              <div
                style={{
                  fontSize: isMobile ? 20 : 18,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: 8,
                }}
              >
                Create your first project
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>
                A project is a workspace for your work. Choose a template to get
                started quickly.
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={S.label()}>Project Name</span>
                <input
                  style={S.input}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                />
              </div>

              <span style={S.label()}>Choose a Template</span>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {templates
                  .filter((t) => t.is_system)
                  .map((t) => {
                    const selected = selectedTemplate === t.id;
                    const suggested =
                      useCases.length > 0 &&
                      suggestedTemplates[useCases[0]]?.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplate(t.id)}
                        style={{
                          background: selected ? `${C.blue}15` : C.bg,
                          border: `2px solid ${selected ? C.blue : suggested ? `${C.green}50` : C.border}`,
                          borderRadius: 8,
                          padding: 12,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{t.icon}</span>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: selected ? '#f1f5f9' : C.text,
                              }}
                            >
                              {t.name}
                            </span>
                            {suggested && (
                              <span
                                style={{ ...S.badge(C.green), fontSize: 8 }}
                              >
                                Recommended
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: C.muted,
                              marginTop: 2,
                            }}
                          >
                            {t.description}
                          </div>
                        </div>
                        {selected && (
                          <span style={{ color: C.blue, fontSize: 14 }}>
                            \u2713
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div>
              <div
                style={{
                  fontSize: isMobile ? 20 : 18,
                  fontWeight: 700,
                  color: '#f1f5f9',
                  marginBottom: 8,
                }}
              >
                You're all set! 🎉
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 24 }}>
                Here's what we're creating for you:
              </div>

              <div
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                    paddingBottom: 12,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ fontSize: 24 }}>🎯</span>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      Goal
                    </div>
                    <div style={{ fontSize: 13, color: '#f1f5f9' }}>
                      {goalForm.title || 'No goal set'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 24 }}>
                    {templates.find((t) => t.id === selectedTemplate)?.icon ||
                      '📁'}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      Project
                    </div>
                    <div style={{ fontSize: 13, color: '#f1f5f9' }}>
                      {projectName || 'Untitled Project'}
                    </div>
                    <div style={{ fontSize: 9, color: C.muted }}>
                      {templates.find((t) => t.id === selectedTemplate)?.name ||
                        'Blank'}{' '}
                      template
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.6 }}>
                After creating your project, we'll show you a quick tour of the
                key features.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: isMobile ? '16px' : '20px 24px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          {step > 1 ? (
            <button
              style={{ ...S.btn('ghost'), minWidth: 100 }}
              onClick={() => setStep(step - 1)}
            >
              \u2190 Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              style={{ ...S.btn('primary'), minWidth: 120 }}
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && useCases.length === 0}
            >
              Next \u2192
            </button>
          ) : (
            <button
              style={{ ...S.btn('primary'), minWidth: 140 }}
              onClick={handleCreate}
              disabled={creating || !selectedTemplate}
            >
              {creating ? 'Creating...' : 'Create Project \u2192'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
