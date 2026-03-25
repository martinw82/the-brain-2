import React, { useState } from 'react';
import { C, S } from '../utils/constants.js';

const WIZARD_STEPS = [
  { id: 'core', label: 'Core Idea', icon: '💡' },
  { id: 'scope', label: 'MVP Scope', icon: '🎯' },
  { id: 'tech', label: 'Tech & Design', icon: '🛠' },
  { id: 'agents', label: 'Agent Team', icon: '🤖' },
  { id: 'review', label: 'Review & Generate', icon: '✅' },
];

const Row = ({ label, children, hint }) => (
  <div style={{ marginBottom: 12 }}>
    <span style={S.label()}>{label}</span>
    {hint && (
      <div style={{ fontSize: 8, color: C.dim, marginBottom: 4 }}>{hint}</div>
    )}
    {children}
  </div>
);

// Bootstrap Wizard (same as before — no persistence changes needed here)
const BootstrapWizard = ({ project, onComplete, onClose }) => {
  const [step, setStep] = useState(0);
  const [brief, setBrief] = useState({
    name: project?.name || '',
    problem: '',
    solution: '',
    targetUser: '',
    revenueModel: '',
    mvpFeatures: ['', '', '', '', ''],
    techStack: '',
    designStyle: '',
    contentTone: 'Builder-first, authentic, anti-corporate',
    agentRules: '',
    customFolders: ['', '', ''],
    selectedAgents: ['strategy', 'dev'],
  });
  const toggleAgent = (id) =>
    setBrief((b) => ({
      ...b,
      selectedAgents: b.selectedAgents.includes(id)
        ? b.selectedAgents.filter((a) => a !== id)
        : [...b.selectedAgents, id],
    }));
  const setFeature = (i, v) =>
    setBrief((b) => {
      const f = [...b.mvpFeatures];
      f[i] = v;
      return { ...b, mvpFeatures: f };
    });
  const canProceed = [
    brief.problem.trim() && brief.solution.trim() && brief.targetUser.trim(),
    brief.revenueModel.trim() && brief.mvpFeatures.filter(Boolean).length >= 1,
    true,
    brief.selectedAgents.length >= 1,
    true,
  ][step];
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
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
          width: 640,
          maxWidth: '96vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: `0 0 40px ${C.blue}20`,
        }}
      >
        <div
          style={{
            background: '#0a1628',
            borderBottom: `1px solid ${C.border}`,
            padding: '14px 20px',
            borderRadius: '12px 12px 0 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 9,
                  color: C.blue,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Agent Bootstrap Protocol
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                {project?.emoji} {project?.name}
              </div>
            </div>
            <button
              style={{ ...S.btn('ghost'), padding: '3px 9px' }}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex' }}>
            {WIZARD_STEPS.map((s, i) => (
              <div
                key={s.id}
                onClick={() => i < step && setStep(i)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '5px 4px',
                  cursor: i < step ? 'pointer' : 'default',
                  borderBottom: `2px solid ${i === step ? C.blue : i < step ? C.green : C.border}`,
                  fontSize: 9,
                  color: i === step ? C.blue : i < step ? C.green : C.dim,
                }}
              >
                {s.icon} {s.label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {step === 0 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                This brief is the source of truth. Every agent will read it
                before starting.
              </div>
              <Row label="Problem — what pain does this solve?">
                <textarea
                  style={{ ...S.input, height: 64, resize: 'vertical' }}
                  placeholder="e.g. Solo builders have no structured system..."
                  value={brief.problem}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, problem: e.target.value }))
                  }
                />
              </Row>
              <Row label="Solution — what does this do?">
                <textarea
                  style={{ ...S.input, height: 64, resize: 'vertical' }}
                  placeholder="e.g. A project OS that scaffolds AI agent workflows..."
                  value={brief.solution}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, solution: e.target.value }))
                  }
                />
              </Row>
              <Row label="Target User">
                <input
                  style={S.input}
                  placeholder="e.g. Bootstrap Web3 solo founders..."
                  value={brief.targetUser}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, targetUser: e.target.value }))
                  }
                />
              </Row>
              <Row label="Revenue Model">
                <input
                  style={S.input}
                  placeholder="e.g. $9/mo SaaS, freemium + pro tier..."
                  value={brief.revenueModel}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, revenueModel: e.target.value }))
                  }
                />
              </Row>
            </div>
          )}
          {step === 1 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                5 features maximum. If you can't ship all 5 in 2 weeks solo, cut
                more.
              </div>
              <Row label="MVP Features">
                {brief.mvpFeatures.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 6,
                      marginBottom: 6,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: C.dim,
                        width: 16,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}.
                    </span>
                    <input
                      style={S.input}
                      placeholder={
                        i === 0
                          ? 'e.g. User can create a project and fill the Bootstrap Brief'
                          : 'Optional feature...'
                      }
                      value={f}
                      onChange={(e) => setFeature(i, e.target.value)}
                    />
                  </div>
                ))}
              </Row>
              <Row
                label="Custom Folders?"
                hint="Beyond the standard 12. Leave blank if unsure."
              >
                {['', '', ''].map((_, i) => (
                  <input
                    key={i}
                    style={{ ...S.input, marginBottom: 6 }}
                    placeholder={`Custom folder ${i + 1}...`}
                    value={brief.customFolders[i] || ''}
                    onChange={(e) => {
                      const f = [...brief.customFolders];
                      f[i] = e.target.value;
                      setBrief((b) => ({ ...b, customFolders: f }));
                    }}
                  />
                ))}
              </Row>
            </div>
          )}
          {step === 2 && (
            <div>
              <Row label="Tech Stack">
                <input
                  style={S.input}
                  placeholder="e.g. React + Vite + Tailwind..."
                  value={brief.techStack}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, techStack: e.target.value }))
                  }
                />
              </Row>
              <Row label="Design Style">
                <input
                  style={S.input}
                  placeholder="e.g. Dark minimalist, monospace..."
                  value={brief.designStyle}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, designStyle: e.target.value }))
                  }
                />
              </Row>
              <Row label="Content Tone">
                <input
                  style={S.input}
                  value={brief.contentTone}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, contentTone: e.target.value }))
                  }
                />
              </Row>
              <Row label="Agent Rules">
                <textarea
                  style={{ ...S.input, height: 64, resize: 'vertical' }}
                  placeholder="e.g. Never use Next.js..."
                  value={brief.agentRules}
                  onChange={(e) =>
                    setBrief((b) => ({ ...b, agentRules: e.target.value }))
                  }
                />
              </Row>
            </div>
          )}
          {step === 3 && (
            <div>
              {Object.values({
                strategy: {
                  id: 'strategy',
                  icon: '🎯',
                  label: 'Strategy Agent',
                  desc: 'Validates scope, revenue rationale. Always first.',
                },
                dev: {
                  id: 'dev',
                  icon: '🛠',
                  label: 'Dev Agent',
                  desc: 'Tech stack, Bolt one-shot prompt.',
                },
                design: {
                  id: 'design',
                  icon: '🎨',
                  label: 'Design Agent',
                  desc: 'UI spec, style tokens.',
                },
                content: {
                  id: 'content',
                  icon: '✍️',
                  label: 'Content Agent',
                  desc: 'Launch copy, thread drafts.',
                },
                research: {
                  id: 'research',
                  icon: '🔬',
                  label: 'Research Agent',
                  desc: 'Market research, competitors.',
                },
              }).map((sk) => (
                <div
                  key={sk.id}
                  onClick={() => toggleAgent(sk.id)}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start',
                    padding: '10px 12px',
                    marginBottom: 6,
                    background: brief.selectedAgents.includes(sk.id)
                      ? 'rgba(26,79,214,0.1)'
                      : C.bg,
                    border: `1px solid ${brief.selectedAgents.includes(sk.id) ? C.blue : C.border}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 3,
                      background: brief.selectedAgents.includes(sk.id)
                        ? C.blue
                        : C.border,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                    }}
                  >
                    {brief.selectedAgents.includes(sk.id) ? '✓' : ''}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: '#e2e8f0',
                        fontWeight: 600,
                      }}
                    >
                      {sk.icon} {sk.label}
                    </div>
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                      {sk.desc}
                    </div>
                  </div>
                  {sk.id === 'strategy' && (
                    <span
                      style={{
                        ...S.badge(C.amber),
                        marginLeft: 'auto',
                        flexShrink: 0,
                      }}
                    >
                      ALWAYS FIRST
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {step === 4 && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  marginBottom: 16,
                  lineHeight: 1.7,
                }}
              >
                These files will be generated and saved to your project in the
                database.
              </div>
              {[
                'project-artifacts/BOOTSTRAP_BRIEF.md',
                'project-artifacts/STRATEGY_PROMPT.md',
                'project-artifacts/DEV_PROMPT.md',
                'system/SKILL.md',
                'system/AGENT_ONBOARDING.md',
              ].map((f) => (
                <div
                  key={f}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  <span style={{ fontSize: 9, color: C.green }}>✓</span>
                  <div
                    style={{
                      fontSize: 10,
                      color: '#e2e8f0',
                      fontFamily: C.mono,
                    }}
                  >
                    {f}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 20,
            }}
          >
            <button
              style={S.btn('ghost')}
              onClick={() => (step > 0 ? setStep((s) => s - 1) : onClose())}
            >
              {step > 0 ? '← Back' : 'Cancel'}
            </button>
            {step < 4 ? (
              <button
                style={{ ...S.btn('primary'), opacity: canProceed ? 1 : 0.5 }}
                onClick={() => canProceed && setStep((s) => s + 1)}
              >
                Next →
              </button>
            ) : (
              <button
                style={S.btn('primary')}
                onClick={() => onComplete(brief)}
              >
                🚀 Generate & Save Bootstrap Files
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BootstrapWizard;
