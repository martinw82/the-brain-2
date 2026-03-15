import { useState, useRef, useEffect, useCallback } from 'react';
import {
  projects as projectsApi,
  staging as stagingApi,
  ideas as ideasApi,
  sessions as sessionsApi,
  comments as commentsApi,
  search as searchApi,
  ai as aiApi,
  areas as areasApi,
  goals as goalsApi,
  templates as templatesApi,
  tags as tagsApi,
  links as linksApi,
  settings as settingsApi,
  fileMetadata,
  token,
  drift as driftApi,
  aiMetadata as aiMetadataApi,
  scripts as scriptsApi,
  integrations as integrationsApi,
  notifications as notificationsApi,
  userAISettings,
  tasks as tasksApi,
  fileSummaries,
  agentExecution,
} from './api.js';
import { cache } from './cache.js';
import { sync } from './sync.js';
import { desktopSync } from './desktop-sync.js';
import AICoach from './components/AICoach.jsx';
import FileTree from './components/FileTree.jsx';
import ProgressTrends from './components/ProgressTrends.jsx';
import CommandCentre from './components/CommandCentre.jsx';
import {
  parseURI,
  extractURIs,
  uriToNavigation,
  resolveLabel,
  isValidURI,
  contentHash,
} from './uri.js';
import {
  checkSummaryStatus,
  storeSummaries,
  L0_PROMPT,
  L1_PROMPT,
} from './summaries.js';
import FolderSyncSetup from './components/FolderSyncSetup.jsx';
import SyncReviewModal from './components/SyncReviewModal.jsx';
import DailyCheckinModal from './components/DailyCheckinModal.jsx';
import TrainingLogModal from './components/TrainingLogModal.jsx';
import OutreachLogModal from './components/OutreachLogModal.jsx';
import WeeklyReviewPanel from './components/WeeklyReviewPanel.jsx';
import AgentManager from './components/AgentManager.jsx';
import FileSummaryViewer from './components/FileSummaryViewer.jsx';
import WorkflowRunner from './components/WorkflowRunner.jsx';
import AICoach from './components/AICoach.jsx';
import { seedSystemWorkflows } from './workflows.js';
import { getMode, getBehavior, shouldShow, MODE_INFO } from './modeHelper.js';

// ============================================================
// THE BRAIN v6 — Wired Edition
// Full persistence via TiDB/MySQL + Netlify Functions
// ============================================================

// ═══════════════════════════════════════════════════════════
// RESPONSIVE BREAKPOINTS (Phase 4.1)
// ═══════════════════════════════════════════════════════════
const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

// ── UNDO/REDO SYSTEM ─────────────────────────────────────────
const useUndoRedo = (limit = 50) => {
  const [state, setState] = useState({
    past: [],
    present: null,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const init = useCallback((initialState) => {
    setState({ past: [], present: initialState, future: [] });
  }, []);

  const push = useCallback(
    (newPresent, actionType = 'edit') => {
      setState((prev) => {
        const newPast = [
          ...prev.past,
          { state: prev.present, action: actionType },
        ].slice(-limit);
        return { past: newPast, present: newPresent, future: [] };
      });
    },
    [limit]
  );

  const undo = useCallback(() => {
    if (!canUndo) return null;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    setState({
      past: newPast,
      present: previous.state,
      future: [
        { state: state.present, action: previous.action },
        ...state.future,
      ].slice(0, limit),
    });
    return { state: previous.state, action: previous.action };
  }, [state, canUndo, limit]);

  const redo = useCallback(() => {
    if (!canRedo) return null;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    setState((prev) => ({
      past: [...prev.past, { state: prev.present, action: next.action }].slice(
        -limit
      ),
      present: next.state,
      future: newFuture,
    }));
    return { state: next.state, action: next.action };
  }, [state, canRedo, limit]);

  const clear = useCallback(() => {
    setState({ past: [], present: null, future: [] });
  }, []);

  return {
    state: state.present,
    init,
    push,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  };
};

// ── KEYBOARD SHORTCUTS SYSTEM ───────────────────────────────
const SHORTCUTS = {
  global: [
    { key: '⌘K / Ctrl+K', description: 'Search across projects' },
    { key: '⌘? / Ctrl+?', description: 'Show keyboard shortcuts' },
    { key: '⌘B / Ctrl+B', description: 'Toggle Brain/Hub view' },
    { key: 'Esc', description: 'Close modals / exit search' },
  ],
  editor: [
    { key: '⌘S / Ctrl+S', description: 'Save file immediately' },
    { key: '⌘Z / Ctrl+Z', description: 'Undo last edit' },
    { key: '⌘⇧Z / Ctrl+Y', description: 'Redo' },
    { key: '⌘P / Ctrl+P', description: 'Toggle Preview mode' },
    { key: '⌘⇧F / Ctrl+Shift+F', description: 'Search in file' },
  ],
  navigation: [
    { key: 'G then C', description: 'Go to Command Centre' },
    { key: 'G then P', description: 'Go to Projects' },
    { key: 'G then S', description: 'Go to Staging' },
    { key: 'G then I', description: 'Go to Ideas' },
  ],
  actions: [
    { key: 'N then P', description: 'New Project' },
    { key: 'N then F', description: 'New File' },
    { key: 'N then I', description: 'New Idea' },
    { key: 'Space', description: 'Start/Stop session timer' },
  ],
};

const KeyboardShortcutsModal = ({ onClose }) => (
  <Modal title="⌨️ Keyboard Shortcuts" onClose={onClose} width={500}>
    <div style={{ display: 'grid', gap: 20 }}>
      {Object.entries(SHORTCUTS).map(([category, shortcuts]) => (
        <div key={category}>
          <div
            style={{
              fontSize: 10,
              color: C.blue,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            {category}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {shortcuts.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: C.text }}>
                  {s.description}
                </span>
                <kbd
                  style={{
                    fontFamily: C.mono,
                    fontSize: 10,
                    padding: '2px 8px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.blue2,
                    minWidth: 80,
                    textAlign: 'center',
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
        fontSize: 9,
        color: C.muted,
      }}
    >
      Tip: Press ? anytime to open this cheat sheet
    </div>
  </Modal>
);

// ── PROGRESS TRENDS COMPONENT ───────────────────────────────
// Moved to components/ProgressTrends.jsx

const useBreakpoint = () => {
  const [bp, setBp] = useState(() => {
    const w = window.innerWidth;
    if (w < BREAKPOINTS.mobile) return 'mobile';
    if (w < BREAKPOINTS.tablet) return 'tablet';
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < BREAKPOINTS.mobile) setBp('mobile');
      else if (w < BREAKPOINTS.tablet) setBp('tablet');
      else setBp('desktop');
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    breakpoint: bp,
    isMobile: bp === 'mobile',
    isTablet: bp === 'tablet',
    isDesktop: bp === 'desktop',
  };
};

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
  mono: "'JetBrains Mono','Fira Code','Courier New',monospace",
};
const S = {
  root: {
    fontFamily: C.mono,
    background: C.bg,
    color: C.text,
    minHeight: '100vh',
  },
  card: (hi, col) => ({
    background: C.surface,
    border: `1px solid ${hi ? col || C.blue : C.border}`,
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 10,
    boxShadow: hi ? `0 0 18px ${col || C.blue}18` : 'none',
  }),
  input: {
    background: '#0d1424',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: C.mono,
    fontSize: 12,
    padding: '7px 11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  sel: {
    background: '#0d1424',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: C.mono,
    fontSize: 12,
    padding: '7px 11px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  // Phase 4.1: Added minHeight:44 for mobile touch targets (44px minimum)
  btn: (v = 'primary', c) => ({
    background:
      v === 'primary'
        ? c || C.blue
        : v === 'success'
          ? 'rgba(16,185,129,0.15)'
          : v === 'danger'
            ? 'rgba(239,68,68,0.15)'
            : 'transparent',
    border:
      v === 'ghost'
        ? `1px solid ${C.border}`
        : v === 'success'
          ? '1px solid #10b98140'
          : v === 'danger'
            ? '1px solid #ef444440'
            : 'none',
    color: v === 'success' ? C.green : v === 'danger' ? C.red : '#e2e8f0',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: C.mono,
    whiteSpace: 'nowrap',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  tab: (a, c = C.blue2) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: C.mono,
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '7px 13px',
    color: a ? c : C.dim,
    borderBottom: a ? `2px solid ${c}` : '2px solid transparent',
    minHeight: 44,
  }),
  badge: (c = C.blue2) => ({
    fontSize: 9,
    padding: '2px 6px',
    borderRadius: 3,
    background: `${c}18`,
    color: c,
    border: `1px solid ${c}35`,
    letterSpacing: '0.09em',
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }),
  label: (c = C.blue) => ({
    fontSize: 9,
    color: c,
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    marginBottom: 6,
    display: 'block',
  }),
};

// ── SMALL COMPONENTS ─────────────────────────────────────────
const AreaPill = ({ area, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...S.btn(active ? 'primary' : 'ghost'),
      background: active ? area.color : C.surface,
      border: active ? `1px solid ${area.color}` : `1px solid ${C.border}`,
      color: active ? '#fff' : C.text,
      fontSize: 9,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
  >
    <span style={{ fontSize: 12 }}>{area.icon}</span> {area.name}
  </button>
);
const TagPill = ({ tag, onRemove }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 9,
      padding: '2px 6px',
      borderRadius: 10,
      background: `${tag.color}22`,
      color: tag.color,
      border: `1px solid ${tag.color}55`,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}
  >
    {tag.name}
    {onRemove && (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tag);
        }}
        style={{
          cursor: 'pointer',
          marginLeft: 1,
          opacity: 0.7,
          fontWeight: 700,
        }}
      >
        ×
      </span>
    )}
  </span>
);
const Dots = ({ n = 0, max = 5, size = 5 }) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: i < n ? C.blue2 : C.border,
        }}
      />
    ))}
  </div>
);
const HealthBar = ({ score }) => {
  const col = score > 70 ? C.green : score > 40 ? C.amber : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 60,
          height: 4,
          background: C.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: col,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>{score}</span>
    </div>
  );
};
const STATUS_MAP = {
  active: { l: 'ACTIVE', c: C.green },
  stalled: { l: 'STALLED', c: C.amber },
  paused: { l: 'PAUSED', c: C.purple },
  done: { l: 'DONE', c: C.blue2 },
  idea: { l: 'IDEA', c: '#94a3b8' },
};
const BadgeStatus = ({ status }) => {
  const m = STATUS_MAP[status] || STATUS_MAP.idea;
  return <span style={S.badge(m.c)}>{m.l}</span>;
};
const Modal = ({ title, onClose, children, width = 400 }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24,
        width,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
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
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
          {title}
        </span>
        <button
          style={{ ...S.btn('ghost'), padding: '2px 8px' }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

// Inline toast — replaces alert() for save confirmations
const Toast = ({ msg, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: C.surface,
        border: `1px solid ${C.green}40`,
        borderRadius: 8,
        padding: '10px 18px',
        fontSize: 11,
        color: C.green,
        zIndex: 9999,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
      }}
    >
      {msg}
    </div>
  );
};

// ── AI PROVIDER SETTINGS COMPONENT ───────────────────────────
const AIProviderSettings = () => {
  const [aiSettings, setAiSettings] = useState({
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    temperature: 0.7,
    api_key: '',
  });
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    // Load settings on mount
    userAISettings
      .get()
      .then((data) => {
        if (data.settings) {
          setAiSettings((prev) => ({ ...prev, ...data.settings, api_key: '' }));
        }
        if (data.providers) setProviders(data.providers);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await userAISettings.update({
        provider: aiSettings.provider,
        model: aiSettings.model,
        max_tokens: aiSettings.max_tokens,
        temperature: aiSettings.temperature,
        api_key: aiSettings.api_key || undefined, // Only send if provided
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('Failed to save AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleClearKey = async () => {
    await userAISettings.deleteKey();
    setAiSettings((prev) => ({ ...prev, api_key: '' }));
    alert('API key cleared - will use server default');
  };

  const selectedProvider = providers.find((p) => p.key === aiSettings.provider);
  const models = selectedProvider?.models || ['claude-sonnet-4-6'];

  return (
    <div
      style={{
        padding: '12px',
        background: `${C.purple}08`,
        border: `1px solid ${C.purple}30`,
        borderRadius: 6,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.text,
          marginBottom: 8,
        }}
      >
        🤖 AI Provider
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Provider Selection */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>Provider</span>
          <select
            style={S.sel}
            value={aiSettings.provider}
            onChange={(e) => {
              const provider = providers.find((p) => p.key === e.target.value);
              setAiSettings((prev) => ({
                ...prev,
                provider: e.target.value,
                model: provider?.models?.[0] || 'claude-sonnet-4-6',
              }));
            }}
          >
            {providers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} {p.freeTier ? '(Free tier)' : ''} - ${p.pricing.input}
                /M tok
              </option>
            ))}
          </select>
          <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
            {selectedProvider?.freeTier
              ? '✅ Free tier available'
              : '💳 Paid service'}
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>Model</span>
          <select
            style={S.sel}
            value={aiSettings.model}
            onChange={(e) =>
              setAiSettings((prev) => ({ ...prev, model: e.target.value }))
            }
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* API Key */}
        <div>
          <span style={{ ...S.label(C.purple), fontSize: 8 }}>
            API Key (optional)
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type={showKey ? 'text' : 'password'}
              style={{ ...S.input, flex: 1, fontFamily: 'monospace' }}
              placeholder="Leave blank to use server default"
              value={aiSettings.api_key}
              onChange={(e) =>
                setAiSettings((prev) => ({ ...prev, api_key: e.target.value }))
              }
            />
            <button
              style={{ ...S.btn('ghost'), padding: '5px 10px' }}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <div style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>
            Your key is encrypted.{' '}
            {aiSettings.api_key
              ? '💾 Will be saved'
              : '🌐 Using server default'}
          </div>
        </div>

        {/* Advanced Settings */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
        >
          <div>
            <span style={{ ...S.label(C.purple), fontSize: 8 }}>
              Max Tokens
            </span>
            <input
              type="number"
              style={S.input}
              value={aiSettings.max_tokens}
              onChange={(e) =>
                setAiSettings((prev) => ({
                  ...prev,
                  max_tokens: Number(e.target.value),
                }))
              }
              min={100}
              max={4000}
            />
          </div>
          <div>
            <span style={{ ...S.label(C.purple), fontSize: 8 }}>
              Temperature
            </span>
            <input
              type="number"
              style={S.input}
              value={aiSettings.temperature}
              onChange={(e) =>
                setAiSettings((prev) => ({
                  ...prev,
                  temperature: Number(e.target.value),
                }))
              }
              min={0}
              max={1}
              step={0.1}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            style={{ ...S.btn('primary'), flex: 1, background: C.purple }}
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? '⏳ Saving...'
              : saved
                ? '✓ Saved!'
                : '💾 Save AI Settings'}
          </button>
          <button
            style={{ ...S.btn('ghost') }}
            onClick={handleClearKey}
            title="Clear personal API key"
          >
            🗑️ Clear Key
          </button>
        </div>

        {/* Provider Info */}
        <div
          style={{
            fontSize: 8,
            color: C.muted,
            padding: '8px',
            background: C.bg,
            borderRadius: 4,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>💡 About {selectedProvider?.name}</strong>
          </div>
          <div>
            Input: ${selectedProvider?.pricing?.input}/M tokens | Output: $
            {selectedProvider?.pricing?.output}/M tokens
          </div>
          {selectedProvider?.key === 'deepseek' && (
            <div>🔥 Cheapest option with great quality</div>
          )}
          {selectedProvider?.key === 'mistral' && (
            <div>🎁 Generous free tier available</div>
          )}
          {selectedProvider?.key === 'moonshot' && (
            <div>🇨🇳 Chinese-optimized, good for Asian markets</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── METADATA EDITOR (Roadmap 2.3 + 3.1) ───────────────────
const MetadataEditor = ({
  file,
  projectId,
  metadata,
  onSave,
  allTags,
  aiSuggestions,
  onRequestSuggestions,
  loadingSuggestions,
  onAcceptSuggestion,
}) => {
  const [category, setCategory] = useState(metadata?.category || '');
  const [status, setStatus] = useState(metadata?.status || 'draft');
  const [customFields, setCustomFields] = useState(
    metadata?.metadata_json?.custom || {}
  );
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showAiSection, setShowAiSection] = useState(true);

  // Sync local state when metadata prop changes
  useEffect(() => {
    setCategory(metadata?.category || '');
    setStatus(metadata?.status || 'draft');
    setCustomFields(metadata?.metadata_json?.custom || {});
  }, [metadata]);

  const save = async () => {
    await onSave({ category, status, metadata_json: { custom: customFields } });
  };

  const addCustomField = () => {
    if (newFieldKey.trim()) {
      setCustomFields((prev) => ({ ...prev, [newFieldKey]: newFieldValue }));
      setNewFieldKey('');
      setNewFieldValue('');
    }
  };

  const hasSuggestions =
    aiSuggestions && !aiSuggestions.error && !aiSuggestions.ignored;
  const suggestions = aiSuggestions?.suggestions;

  return (
    <div
      style={{
        borderLeft: `1px solid ${C.border}`,
        padding: 12,
        minWidth: 250,
        maxWidth: 300,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: expanded ? 8 : 0,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          📋 Metadata
        </span>
        <span style={{ fontSize: 12 }}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div>
          {/* AI Suggestions (Phase 3.1) */}
          {showAiSection && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                background: C.bg,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 9, color: C.purple, fontWeight: 600 }}>
                  🤖 AI Suggestions
                </span>
                <button
                  style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 8 }}
                  onClick={() => onRequestSuggestions?.()}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? '⏳' : '↻ Refresh'}
                </button>
              </div>

              {loadingSuggestions && (
                <div style={{ fontSize: 9, color: C.dim, fontStyle: 'italic' }}>
                  Analyzing content...
                </div>
              )}

              {aiSuggestions?.ignored && (
                <div style={{ fontSize: 9, color: C.dim }}>
                  {aiSuggestions.reason || 'File type not analyzed'}
                </div>
              )}

              {aiSuggestions?.error && (
                <div style={{ fontSize: 9, color: C.red }}>
                  {aiSuggestions.error}
                </div>
              )}

              {hasSuggestions && suggestions && (
                <div>
                  {/* Category suggestion */}
                  {suggestions.category &&
                    suggestions.category !== category && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{ fontSize: 8, color: C.dim, flexShrink: 0 }}
                        >
                          Category:
                        </span>
                        <span
                          style={{
                            fontSize: 8,
                            color: C.purple,
                            border: `1px dashed ${C.purple}`,
                            padding: '2px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setCategory(suggestions.category);
                            onAcceptSuggestion?.(
                              'category',
                              suggestions.category
                            );
                          }}
                        >
                          {suggestions.category} ✓
                        </span>
                      </div>
                    )}

                  {/* Status suggestion */}
                  {suggestions.status && suggestions.status !== status && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{ fontSize: 8, color: C.dim, flexShrink: 0 }}
                      >
                        Status:
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          color: C.purple,
                          border: `1px dashed ${C.purple}`,
                          padding: '2px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setStatus(suggestions.status);
                          onAcceptSuggestion?.('status', suggestions.status);
                        }}
                      >
                        {suggestions.status} ✓
                      </span>
                    </div>
                  )}

                  {/* Tag suggestions */}
                  {suggestions.tags && suggestions.tags.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Suggested tags:
                      </span>
                      <div
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
                      >
                        {suggestions.tags.map((tag, idx) => {
                          const alreadyHas = allTags?.some(
                            (t) => t.name?.toLowerCase() === tag.toLowerCase()
                          );
                          return (
                            <span
                              key={idx}
                              style={{
                                fontSize: 8,
                                color: C.purple,
                                border: `1px dashed ${C.purple}`,
                                padding: '2px 6px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                opacity: alreadyHas ? 0.5 : 1,
                              }}
                              onClick={() =>
                                !alreadyHas && onAcceptSuggestion?.('tag', tag)
                              }
                            >
                              {tag} {alreadyHas ? '(has)' : '✓'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {suggestions.confidence !== undefined && (
                    <div style={{ fontSize: 8, color: C.dim, marginTop: 6 }}>
                      Confidence: {Math.round(suggestions.confidence * 100)}%
                    </div>
                  )}
                </div>
              )}

              {!loadingSuggestions &&
                !hasSuggestions &&
                !aiSuggestions?.error &&
                !aiSuggestions?.ignored && (
                  <div style={{ fontSize: 9, color: C.dim }}>
                    Click refresh to analyze file content
                  </div>
                )}
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Category</label>
            <input
              type="text"
              style={{ ...S.input, fontSize: 9, width: '100%' }}
              placeholder="design, docs..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Status</label>
            <select
              style={{ ...S.sel, fontSize: 9, width: '100%' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="final">Final</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Custom Fields */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Custom Fields</label>
            {Object.entries(customFields).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: 4,
                  marginBottom: 4,
                  fontSize: 8,
                }}
              >
                <span
                  style={{ flex: 1, color: C.dim, wordBreak: 'break-word' }}
                >
                  {key}:
                </span>
                <span
                  style={{ flex: 1, color: C.text, wordBreak: 'break-word' }}
                >
                  {value}
                </span>
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '2px 4px',
                    color: C.red,
                    flexShrink: 0,
                  }}
                  onClick={() =>
                    setCustomFields((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input
                type="text"
                style={{ ...S.input, flex: 1, fontSize: 8, padding: '4px' }}
                placeholder="key"
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
              />
              <input
                type="text"
                style={{ ...S.input, flex: 1, fontSize: 8, padding: '4px' }}
                placeholder="value"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
              />
              <button
                style={{
                  ...S.btn('success'),
                  fontSize: 8,
                  padding: '4px 8px',
                  flexShrink: 0,
                }}
                onClick={addCustomField}
              >
                +
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            style={{ ...S.btn('primary'), width: '100%', fontSize: 9 }}
            onClick={save}
          >
            💾 Save
          </button>
        </div>
      )}
    </div>
  );
};

// ── CONSTANTS ─────────────────────────────────────────────────
const BUIDL_VERSION = '1.0';
const STANDARD_FOLDERS = [
  {
    id: 'content-assets',
    icon: '📚',
    label: 'Content Assets',
    desc: 'Guides, blogs, threads, tutorials',
  },
  {
    id: 'project-artifacts',
    icon: '📦',
    label: 'Project Artifacts',
    desc: 'Feature lists, roadmaps, personas',
  },
  {
    id: 'design-assets',
    icon: '🎨',
    label: 'Design Assets',
    desc: 'Logos, brand kits, style guides',
  },
  {
    id: 'code-modules',
    icon: '🛠',
    label: 'Code Modules',
    desc: 'Components, contracts, scripts',
  },
  {
    id: 'marketing',
    icon: '📣',
    label: 'Marketing',
    desc: 'Campaigns, press kits, strategy',
  },
  {
    id: 'analytics',
    icon: '📈',
    label: 'Analytics',
    desc: 'Tracking plans, KPIs, data',
  },
  {
    id: 'infrastructure',
    icon: '⚙️',
    label: 'Infrastructure',
    desc: 'Hosting, deploy configs',
  },
  { id: 'qa', icon: '📋', label: 'QA', desc: 'Test plans, checklists' },
  { id: 'support', icon: '🤝', label: 'Support', desc: 'FAQs, community docs' },
  { id: 'legal', icon: '⚖️', label: 'Legal', desc: 'Privacy, ToS, licensing' },
  {
    id: 'staging',
    icon: '🌀',
    label: 'Staging',
    desc: 'Raw inputs — unreviewed',
  },
  {
    id: 'system',
    icon: '📂',
    label: 'System',
    desc: 'DEVLOG, SYSTEM_INDEX, meta',
  },
  {
    id: 'tools',
    icon: '🔧',
    label: 'Tools',
    desc: 'Scripts, automation, utilities',
  },
];
const STANDARD_FOLDER_IDS = new Set(STANDARD_FOLDERS.map((f) => f.id));
const ITEM_TAGS = [
  'IDEA_',
  'SKETCH_',
  'RND_',
  'REWRITE_',
  'PROMPT_',
  'FINAL_',
  'DRAFT_',
  'CODE_',
];
const REVIEW_STATUSES = {
  'in-review': { label: 'IN REVIEW', color: C.amber, icon: '🔄' },
  approved: { label: 'APPROVED', color: C.green, icon: '✅' },
  rejected: { label: 'REJECTED', color: C.red, icon: '❌' },
  deferred: { label: 'DEFERRED', color: C.purple, icon: '⏳' },
};
const THAILAND_TARGET = 3000;
const BUIDL_PHASES = [
  'BOOTSTRAP',
  'UNLEASH',
  'INNOVATE',
  'DECENTRALIZE',
  'LEARN',
  'SHIP',
];

// ── MANIFEST + PROJECT FACTORY ────────────────────────────────
const makeManifest = (p) => ({
  buidl_version: BUIDL_VERSION,
  id: p.id,
  name: p.name,
  emoji: p.emoji || '📁',
  phase: p.phase || 'BOOTSTRAP',
  status: p.status || 'active',
  priority: p.priority || 1,
  revenue_ready: p.revenueReady || false,
  income_target: p.incomeTarget || 0,
  momentum: p.momentum || 3,
  last_touched: p.lastTouched || new Date().toISOString().slice(0, 7),
  desc: p.desc || '',
  next_action: p.nextAction || '',
  blockers: p.blockers || [],
  tags: p.tags || [],
  skills: p.skills || ['dev', 'strategy'],
  custom_folders: (p.customFolders || []).map((f) => ({
    id: f.id,
    label: f.label,
    icon: f.icon || '📁',
    desc: f.desc || '',
  })),
  integrations: p.integrations || {},
  created: p.created || new Date().toISOString(),
  exported: new Date().toISOString(),
});

const calcHealth = (p) => {
  const now = new Date(),
    last = new Date((p.lastTouched || '2025-01') + '-01');
  const days = Math.floor((now - last) / (1000 * 60 * 60 * 24));
  let s = 100;
  s -= Math.min(40, days * 0.5);
  s -= (p.blockers || []).length * 8;
  s -= (5 - (p.momentum || 3)) * 6;
  if (p.status === 'paused') s -= 15;
  if (p.status === 'stalled') s -= 20;
  return Math.max(0, Math.round(s));
};

const makeDefaultFiles = (name, templateConfig = null) => {
  const folders = templateConfig?.folders || STANDARD_FOLDERS.map((f) => f.id);
  const showFolder = (id) => folders.includes(id);

  const files = {
    'PROJECT_OVERVIEW.md': `# ${name}\n\n## What is this?\n\n> One sentence description here.\n\n## Problem\n\n## Solution\n\n## Target User\n\n## Revenue Model\n\n## Current Status\n\n## Next Milestone\n`,
    'DEVLOG.md': `# Dev Log — ${name}\n\n## ${new Date().toISOString().slice(0, 10)}\n\n- Project initialised\n`,
    'TASKS.md': `# Tasks — ${name}\n\n## In Progress\n- [ ] Define MVP scope\n\n## Backlog\n- [ ] Set up repo\n\n## Done\n`,
    'SYSTEM_INDEX.md': `# System Index — ${name}\n\n## Folders\n${STANDARD_FOLDERS.filter(
      (f) => folders.includes(f.id)
    )
      .map((f) => `- **${f.label}**: ${f.desc}`)
      .join('\n')}\n`,
    'system/agent.ignore': `# agent.ignore\nlegal/\ninfrastructure/\nsystem/agent.ignore\nmanifest.json\n`,
    'system/SKILL.md': `# Project Skill Overrides — ${name}\n\n## Dev Agent Overrides\n# - Custom rules here\n`,
    'system/DEPENDENCY_GRAPH.md': `# Dependency Graph — ${name}\n\nVisualise project relationships and architecture.\n\n## System Architecture\n\n\`\`\`mermaid\ngraph TB\n    subgraph Frontend\n        UI[User Interface]\n        State[State Management]\n    end\n    \n    subgraph Backend\n        API[API Layer]\n        DB[(Database)]\n    end\n    \n    subgraph External\n        AI[AI Provider]\n        Storage[File Storage]\n    end\n    \n    UI --> State\n    State --> API\n    API --> DB\n    API --> AI\n    API --> Storage\n\`\`\`\n\n## Data Flow\n\n\`\`\`mermaid\nsequenceDiagram\n    participant U as User\n    participant F as Frontend\n    participant A as API\n    participant D as Database\n    \n    U->>F: Action\n    F->>A: Request\n    A->>D: Query\n    D-->>A: Result\n    A-->>F: Response\n    F-->>U: Update UI\n\`\`\`\n\n## Project Dependencies\n\n\`\`\`mermaid\ngraph LR\n    A[${name}] --> B[Core Feature]\n    A --> C[Integration]\n    A --> D[Documentation]\n    \n    B --> B1[Module 1]\n    B --> B2[Module 2]\n    \n    C --> C1[External API]\n    C --> C2[Service]\n\`\`\`\n\n---\n\n*Edit this file to customise diagrams for your project*\n`,
  };

  if (showFolder('marketing'))
    files['CONTENT_CALENDAR.md'] =
      `# Content Calendar — ${name}\n\n| Date | Platform | Type | Topic | Status |\n|------|----------|------|-------|--------|\n`;
  if (showFolder('staging')) {
    files['REVIEW_QUEUE.md'] =
      `# Review Queue — ${name}\n\n| Item | Tag | Added | Status | Notes |\n|------|-----|-------|--------|-------|\n`;
    files['staging/.gitkeep'] = '';
  }

  // Phase 3.6: Tools folder with predefined scripts
  files['tools/.gitkeep'] = '';
  files['tools/export-zip.js'] = `// Export all project files as ZIP
// Usage: Run this script to generate a downloadable ZIP archive

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function exportZip(projectFiles, projectName) {
  const zip = new JSZip();
  
  // Add all files to ZIP
  for (const [filePath, content] of Object.entries(projectFiles)) {
    zip.file(filePath, content);
  }
  
  // Generate ZIP
  const blob = await zip.generateAsync({ type: 'blob' });
  
  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = \`\${projectName.replace(/\\s+/g, '-').toLowerCase()}-export.zip\`;
  a.click();
  URL.revokeObjectURL(url);
  
  return \`Exported \${Object.keys(projectFiles).length} files\`;
}

// Script metadata
export const meta = {
  name: 'Export ZIP',
  description: 'Export all project files as a ZIP archive',
  language: 'javascript'
};
`;
  files['tools/word-count.js'] =
    `// Count words across all markdown files in project
// Usage: Run this script to get word count statistics

function countWords(projectFiles) {
  const mdFiles = Object.entries(projectFiles).filter(([path]) => 
    path.endsWith('.md') || path.endsWith('.txt')
  );
  
  let totalWords = 0;
  const fileStats = [];
  
  for (const [path, content] of mdFiles) {
    // Remove markdown syntax for accurate count
    const cleanContent = content
      .replace(/[#\\*\\[\\]()\\-\\|\\/>]/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
    
    const words = cleanContent.split(/\\s+/).filter(w => w.length > 0).length;
    totalWords += words;
    fileStats.push({ path, words });
  }
  
  // Sort by word count
  fileStats.sort((a, b) => b.words - a.words);
  
  return {
    totalWords,
    fileCount: mdFiles.length,
    topFiles: fileStats.slice(0, 5),
    averagePerFile: mdFiles.length > 0 ? Math.round(totalWords / mdFiles.length) : 0
  };
}

// Script metadata
export const meta = {
  name: 'Word Count',
  description: 'Count words across all markdown files',
  language: 'javascript'
};
`;
  files['tools/list-todos.js'] = `// List all TODO items across project files
// Usage: Run this script to extract all TODOs and FIXMEs

function listTodos(projectFiles) {
  const todos = [];
  
  for (const [path, content] of Object.entries(projectFiles)) {
    const lines = content.split('\\n');
    
    lines.forEach((line, index) => {
      // Match TODO, FIXME, HACK, XXX patterns
      const match = line.match(/(TODO|FIXME|HACK|XXX)[\\s:]*(.+)/i);
      if (match) {
        todos.push({
          path,
          line: index + 1,
          type: match[1].toUpperCase(),
          text: match[2].trim()
        });
      }
    });
  }
  
  // Group by type
  const byType = todos.reduce((acc, todo) => {
    acc[todo.type] = (acc[todo.type] || 0) + 1;
    return acc;
  }, {});
  
  return {
    total: todos.length,
    byType,
    todos: todos.slice(0, 20) // Limit to first 20
  };
}

// Script metadata
export const meta = {
  name: 'List TODOs',
  description: 'Find all TODO, FIXME, HACK, XXX items in project files',
  language: 'javascript'
};
`;

  return files;
};

const makeProject = (
  id,
  name,
  emoji,
  phase,
  status,
  priority,
  revenueReady,
  desc,
  nextAction,
  blockers,
  tags,
  momentum,
  lastTouched,
  incomeTarget,
  skills = [],
  customFolders = [],
  templateConfig = null
) => {
  const files = {
    ...makeDefaultFiles(name, templateConfig),
    'manifest.json': JSON.stringify(
      makeManifest({
        id,
        name,
        emoji,
        phase,
        status,
        priority,
        revenueReady,
        incomeTarget,
        momentum,
        lastTouched,
        desc,
        nextAction,
        blockers,
        tags,
        skills,
        customFolders,
      }),
      null,
      2
    ),
  };

  if (templateConfig?.folders) {
    templateConfig.folders.forEach((fId) => {
      files[`${fId}/.gitkeep`] = '';
    });
  } else {
    customFolders.forEach((f) => {
      files[`${f.id}/.gitkeep`] = '';
    });
  }

  const p = {
    id,
    name,
    emoji,
    phase,
    status,
    priority,
    revenueReady,
    desc,
    nextAction,
    blockers,
    tags,
    momentum,
    lastTouched,
    incomeTarget,
    skills: skills.length ? skills : ['dev', 'strategy'],
    customFolders,
    integrations: {},
    files,
    activeFile: 'PROJECT_OVERVIEW.md',
    created: new Date().toISOString(),
  };
  p.health = calcHealth(p);
  return p;
};

// ── FILE TYPE DETECTION ────────────────────────────────────────
const getFileType = (path) => {
  const ext = path?.split('.').pop()?.toLowerCase() || '';
  const textExts = [
    'md',
    'json',
    'js',
    'ts',
    'py',
    'sol',
    'txt',
    'css',
    'html',
    'xml',
    'yaml',
    'yml',
    'env',
  ];
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
  const audioExts = ['mp3', 'wav', 'ogg', 'm4a', 'flac'];
  const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
  const archiveExts = ['zip', 'tar', 'gz', 'rar', '7z'];
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
  if (textExts.includes(ext)) return 'text';
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  if (archiveExts.includes(ext)) return 'archive';
  if (docExts.includes(ext)) return 'document';
  return 'binary';
};

// ── FILE SIZE FORMATTER ────────────────────────────────────────
const formatFileSize = (base64str) => {
  const kb = Math.floor(base64str.length / 4 / 1024);
  return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
};

// ── MERMAID RENDERER (Phase 3.2) ────────────────────────────
const MermaidRenderer = ({ chart, id }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!chart || !window.mermaid) return;

    const renderChart = async () => {
      try {
        // Generate unique ID if not provided
        const uniqueId =
          id || `mermaid-${Math.random().toString(36).slice(2, 11)}`;

        // Configure mermaid with dark theme
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1a4fd620',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#1a4fd6',
            lineColor: '#3b82f6',
            secondaryColor: '#0f172a',
            tertiaryColor: '#1e293b',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
          },
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true },
        });

        const { svg: renderedSvg } = await window.mermaid.render(
          uniqueId,
          chart
        );
        setSvg(renderedSvg);
        setError(null);
      } catch (e) {
        console.error('Mermaid render error:', e);
        setError(e.message || 'Failed to render diagram');
        setSvg('');
      }
    };

    renderChart();
  }, [chart, id]);

  if (error) {
    return (
      <div
        style={{
          padding: '12px',
          background: '#1a0f0f',
          border: '1px solid #dc2626',
          borderRadius: 6,
          color: '#ef4444',
          fontSize: 11,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Diagram Error</div>
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        margin: '12px 0',
        overflow: 'auto',
        background: '#0a0f14',
        borderRadius: 6,
        padding: 12,
        border: '1px solid #1e293b',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

// ── URI LINK RENDERER (Phase 5.1) ────────────────────────────
const URILink = ({ uri, label, onNavigate }) => {
  const parsed = parseURI(uri);
  if (!parsed) return <span>{uri}</span>;

  const handleClick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (onNavigate) onNavigate(uri);
    }
  };

  const displayLabel = label || resolveLabel(uri);

  return (
    <span
      style={{
        color: '#3b82f6',
        textDecoration: 'underline',
        cursor: 'pointer',
        fontSize: '10px',
        fontFamily: "'JetBrains Mono',monospace",
        padding: '1px 4px',
        borderRadius: '3px',
        background: '#1a4fd620',
      }}
      onClick={handleClick}
      title={`${uri} (Cmd/Ctrl+Click to navigate)`}
    >
      {displayLabel}
    </span>
  );
};

const renderAIResponse = (text, projects = {}, onNavigate) => {
  if (!text) return <span>{text}</span>;

  const uris = extractURIs(text);
  if (uris.length === 0) return <span>{text}</span>;

  const parts = [];
  let lastIndex = 0;

  uris.forEach((uri) => {
    const index = text.indexOf(uri, lastIndex);
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>{text.slice(lastIndex, index)}</span>
      );
    }
    parts.push(<URILink key={uri + index} uri={uri} onNavigate={onNavigate} />);
    lastIndex = index + uri.length;
  });

  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return <span>{parts}</span>;
};

// ── MARKDOWN + GANTT ──────────────────────────────────────────
const renderMd = (md = '', files = {}) => {
  if (!md) return '';
  let html = md;
  // Extract mermaid blocks before other processing
  const mermaidBlocks = [];
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (match, content) => {
    const id = `mermaid-block-${mermaidBlocks.length}`;
    mermaidBlocks.push({ id, content: content.trim() });
    return `<div class="mermaid-placeholder" data-id="${id}"></div>`;
  });
  // Store mermaid blocks globally for React component to pick up
  if (typeof window !== 'undefined') {
    window.__mermaidBlocks = window.__mermaidBlocks || {};
    mermaidBlocks.forEach((b) => {
      window.__mermaidBlocks[b.id] = b.content;
    });
  }
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imgPath) => {
    const fileContent = files[imgPath];
    if (fileContent && getFileType(imgPath) === 'image') {
      const src = fileContent.startsWith('data:')
        ? fileContent
        : `data:image/png;base64,${fileContent}`;
      return `<img src="${src}" alt="${alt}" style="max-width:100%; max-height:400px; border-radius:4px; margin:8px 0;" />`;
    }
    return `[image: ${alt}]`;
  });
  return html
    .replace(
      /^### (.+)$/gm,
      "<h3 style='color:#e2e8f0;font-size:13px;margin:12px 0 6px'>$1</h3>"
    )
    .replace(
      /^## (.+)$/gm,
      "<h2 style='color:#f1f5f9;font-size:15px;margin:16px 0 8px;border-bottom:1px solid #0f1e3a;padding-bottom:4px'>$1</h2>"
    )
    .replace(
      /^# (.+)$/gm,
      "<h1 style='color:#f1f5f9;font-size:18px;margin:0 0 16px;font-weight:700'>$1</h1>"
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#e2e8f0'>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      "<code style='background:#0d1424;border:1px solid #1e293b;padding:1px 5px;border-radius:3px;font-size:11px;color:#10b981'>$1</code>"
    )
    .replace(
      /^- \[x\] (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#10b981'>✅</span><span>$1</span></div>"
    )
    .replace(
      /^- \[ \] (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#334155'>⬜</span><span style='color:#94a3b8'>$1</span></div>"
    )
    .replace(
      /^- (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#1a4fd6'>·</span><span>$1</span></div>"
    )
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.slice(2, -2).split(' | ');
      if (cells.every((c) => c.match(/^[-:]+$/))) return '';
      return `<div style='display:flex;border-bottom:1px solid #0f1e3a'>${cells.map((c) => `<div style='flex:1;padding:4px 8px;font-size:10px;color:#94a3b8'>${c}</div>`).join('')}</div>`;
    })
    .replace(
      /^> (.+)$/gm,
      "<blockquote style='border-left:3px solid #1a4fd6;margin:8px 0;padding:6px 12px;color:#94a3b8;font-style:italic'>$1</blockquote>"
    )
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};

const GanttChart = ({ tasks }) => {
  const rows = tasks.filter((t) => t.start && t.end);
  if (!rows.length)
    return (
      <div style={{ color: C.muted, fontSize: 10, padding: '12px 0' }}>
        Format:{' '}
        <code style={{ color: C.green }}>
          - [ ] Task 2025-01-01 → 2025-01-14
        </code>
      </div>
    );
  const allD = rows.flatMap((r) => [new Date(r.start), new Date(r.end)]);
  const minD = new Date(Math.min(...allD));
  const maxD = new Date(Math.max(...allD));
  const range = maxD - minD || 1;
  return (
    <div style={{ overflowX: 'auto' }}>
      {rows.map((r, i) => {
        const left = ((new Date(r.start) - minD) / range) * 100;
        const width = ((new Date(r.end) - new Date(r.start)) / range) * 100;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 140,
                fontSize: 10,
                color: C.text,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 16,
                background: C.border,
                borderRadius: 3,
                position: 'relative',
                minWidth: 200,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${Math.max(width, 2)}%`,
                  height: '100%',
                  background: r.done ? C.green : C.blue,
                  borderRadius: 3,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}{' '}
    </div>
  );
};
const parseTasks = (md) => {
  const rows = [];
  md?.split('\n').forEach((line) => {
    const m = line.match(
      /[-*]\s+\[(.)\]\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*(?:→|-|to)\s*(\d{4}-\d{2}-\d{2})/
    );
    if (m)
      rows.push({ done: m[1] === 'x', label: m[2], start: m[3], end: m[4] });
  });
  return rows;
};

// ── FILE TREE ─────────────────────────────────────────────────
const FileTree = ({
  files,
  activeFile,
  onSelect,
  onNewFile,
  onDelete,
  customFolders = [],
}) => {
  const [expanded, setExpanded] = useState(
    new Set(['staging', 'system', 'content-assets', 'code-modules'])
  );
  const tree = {};
  Object.keys(files).forEach((p) => {
    const parts = p.split('/');
    let node = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = { _file: p };
      } else {
        node[part] = node[part] || {};
      }
      node = node[part];
    });
  });
  const allFolders = [...STANDARD_FOLDERS, ...customFolders];
  const getFolderMeta = (id) => allFolders.find((f) => f.id === id);
  const renderNode = (node, depth = 0, prefix = '') =>
    Object.entries(node)
      .filter(([k]) => !k.startsWith('_'))
      .map(([key, val]) => {
        const fullPath = prefix ? `${prefix}/${key}` : key;
        const isDir = !val._file,
          isActive = val._file === activeFile,
          isOpen = expanded.has(fullPath);
        const ext = key.split('.').pop()?.toLowerCase();
        const folderMeta = isDir ? getFolderMeta(key) : null;
        const icon = isDir
          ? folderMeta?.icon || (isOpen ? '📂' : '📁')
          : ext === 'md'
            ? '📝'
            : ext === 'json'
              ? '🔧'
              : ext === 'js'
                ? '⚡'
                : ext === 'py'
                  ? '🐍'
                  : ext === 'sol'
                    ? '💎'
                    : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
                      ? '🖼'
                      : ext === 'svg'
                        ? '🎨'
                        : ext === 'pdf'
                          ? '📕'
                          : ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)
                            ? '📦'
                            : ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
                              ? '🎥'
                              : ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(
                                    ext
                                  )
                                ? '🎵'
                                : '📄';
        if (key === '.gitkeep') return null;
        return (
          <div key={fullPath}>
            <div
              onClick={() => {
                if (isDir) {
                  setExpanded((e) => {
                    const n = new Set(e);
                    n.has(fullPath) ? n.delete(fullPath) : n.add(fullPath);
                    return n;
                  });
                } else onSelect(val._file);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 6px',
                paddingLeft: 8 + depth * 14,
                cursor: 'pointer',
                borderRadius: 4,
                background: isActive ? '#1a4fd620' : 'transparent',
                color: isActive ? C.blue2 : C.text,
                fontSize: 11,
              }}
              onMouseEnter={(e) =>
                !isActive && (e.currentTarget.style.background = '#ffffff08')
              }
              onMouseLeave={(e) =>
                !isActive && (e.currentTarget.style.background = 'transparent')
              }
            >
              <span style={{ fontSize: 12 }}>{icon}</span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {key}
              </span>
              {isDir && folderMeta && !STANDARD_FOLDER_IDS.has(key) && (
                <span style={S.badge(C.purple)}>custom</span>
              )}
              {!isDir && val._file?.startsWith('staging/') && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(val._file);
                  }}
                  style={{
                    fontSize: 9,
                    color: C.red,
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.opacity = 1;
                  }}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}
                >
                  ✕
                </span>
              )}
            </div>
            {isDir && isOpen && (
              <div>{renderNode(val, depth + 1, fullPath)}</div>
            )}
          </div>
        );
      });
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px 6px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: C.blue,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Files
        </span>
        <button
          style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 9 }}
          onClick={onNewFile}
        >
          + File
        </button>
      </div>
      <div style={{ padding: '4px 2px' }}>{renderNode(tree)}</div>
    </div>
  );
};

// ── MARKDOWN PREVIEW WITH MERMAID (Phase 3.2) ───────────────
const MarkdownPreview = ({ content, files }) => {
  const [parts, setParts] = useState([]);

  useEffect(() => {
    if (!content) {
      setParts([]);
      return;
    }

    // Split content by mermaid blocks
    const segments = [];
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let blockIndex = 0;

    while ((match = mermaidRegex.exec(content)) !== null) {
      // Add text before this mermaid block
      if (match.index > lastIndex) {
        segments.push({
          type: 'html',
          content: content.slice(lastIndex, match.index),
        });
      }
      // Add mermaid block
      segments.push({
        type: 'mermaid',
        content: match[1].trim(),
        id: `mmd-${blockIndex++}`,
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({ type: 'html', content: content.slice(lastIndex) });
    }

    // Render markdown for HTML segments
    const renderedParts = segments.map((seg) => ({
      ...seg,
      html: seg.type === 'html' ? renderMd(seg.content, files) : null,
    }));

    setParts(renderedParts);
  }, [content, files]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 20px',
        background: '#050810',
        fontSize: 12,
        lineHeight: 1.8,
        color: C.text,
      }}
    >
      {parts.map((part, idx) =>
        part.type === 'html' ? (
          <div key={idx} dangerouslySetInnerHTML={{ __html: part.html }} />
        ) : (
          <MermaidRenderer key={idx} chart={part.content} id={part.id} />
        )
      )}
    </div>
  );
};

// ── SEARCH MODAL (Phase 3.3) ────────────────────────────────
const SearchModal = ({
  isOpen,
  onClose,
  projects,
  searchRes,
  runSearch,
  searchFilters,
  setSearchFilters,
  recentSearches,
  openHub,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setLoading(true);
        runSearch(query).then(() => setLoading(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchFilters]);

  if (!isOpen) return null;

  // Group results by project
  const grouped = {};
  searchRes.forEach((r) => {
    if (!grouped[r.project_id]) {
      grouped[r.project_id] = {
        project_id: r.project_id,
        project_name: r.project_name,
        emoji: r.emoji,
        matches: [],
      };
    }
    grouped[r.project_id].matches.push(r);
  });

  // Highlight match in excerpt
  const highlightExcerpt = (excerpt, q) => {
    if (!q || !excerpt) return excerpt;
    const parts = excerpt.split(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    );
    return parts.map((part, i) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return (
          <span
            key={i}
            style={{
              background: 'rgba(26,79,214,0.4)',
              color: '#fff',
              padding: '0 2px',
              borderRadius: 2,
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Get unique folders and file types for filters
  const allFolders = [
    ...new Set(searchRes.map((r) => r.folder).filter(Boolean)),
  ];
  const allTypes = [
    ...new Set(searchRes.map((r) => r.extension).filter(Boolean)),
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 700,
          maxHeight: '70vh',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: C.text,
              fontSize: 16,
              outline: 'none',
            }}
          />
          {loading && <span style={{ fontSize: 12, color: C.dim }}>⏳</span>}
          <button
            onClick={onClose}
            style={{ ...S.btn('ghost'), padding: '4px 8px', fontSize: 12 }}
          >
            ESC
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <select
            value={searchFilters.project_id}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, project_id: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 120 }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji}
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.folder}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, folder: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 100 }}
          >
            <option value="">All Folders</option>
            {allFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.file_type}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, file_type: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 100 }}
          >
            <option value="">All Types</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                .{t}
              </option>
            ))}
          </select>
          {(searchFilters.project_id ||
            searchFilters.folder ||
            searchFilters.file_type) && (
            <button
              onClick={() =>
                setSearchFilters({
                  project_id: '',
                  folder: '',
                  file_type: '',
                  tag: '',
                })
              }
              style={{ ...S.btn('ghost'), fontSize: 10, padding: '4px 8px' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {!query.trim() && recentSearches.length > 0 && (
            <div style={{ padding: '10px 20px' }}>
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Recent Searches
              </div>
              {recentSearches.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setQuery(s)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 12,
                    color: C.text,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = '#ffffff08')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          {query.trim() && Object.keys(grouped).length === 0 && !loading && (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: C.dim,
                fontSize: 12,
              }}
            >
              No results found
            </div>
          )}

          {Object.values(grouped).map((group) => [
            <div
              key={`h-${group.project_id}`}
              style={{
                padding: '12px 20px 6px',
                fontSize: 11,
                color: C.blue,
                fontWeight: 600,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              {group.emoji}
              {group.project_name}({group.matches.length})
            </div>,
            ...group.matches.map((m, i) => (
              <div
                key={`${m.project_id}-${m.path}-${i}`}
                onClick={() => {
                  openHub(m.project_id, m.path);
                  onClose();
                }}
                style={{ padding: '8px 20px', cursor: 'pointer' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = '#ffffff08')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <div style={{ fontSize: 11, color: C.text }}>{m.path}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: C.dim,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {highlightExcerpt(m.excerpt, query)}
                </div>
              </div>
            )),
          ])}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 20px',
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: C.dim,
          }}
        >
          <span>{searchRes.length}results</span>
          <span>
            Cmd+K to open · ESC to close · ↑↓ to navigate · Enter to select
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// ONBOARDING WIZARD (Phase 4.2)
// ═══════════════════════════════════════════════════════════
const OnboardingWizard = ({
  user,
  templates,
  areas,
  onComplete,
  onSkip,
  onCreateGoal,
  onCreateProject,
  isMobile,
}) => {
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
              I know what I'm doing →
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
                          ✓ Selected
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
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
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
                          <span style={{ color: C.blue, fontSize: 14 }}>✓</span>
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
              ← Back
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
              Next →
            </button>
          ) : (
            <button
              style={{ ...S.btn('primary'), minWidth: 140 }}
              onClick={handleCreate}
              disabled={creating || !selectedTemplate}
            >
              {creating ? 'Creating...' : 'Create Project →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// TOUR TOOLTIP COMPONENT (Phase 4.2)
// ═══════════════════════════════════════════════════════════
const TourTooltip = ({
  step,
  totalSteps,
  title,
  content,
  position,
  targetRef,
  onNext,
  onSkip,
  onPrev,
  isMobile,
}) => {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 180;

      let top = rect.bottom + 16;
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;

      // Keep in viewport
      if (left < 16) left = 16;
      if (left + tooltipWidth > window.innerWidth - 16)
        left = window.innerWidth - tooltipWidth - 16;
      if (top + tooltipHeight > window.innerHeight - 16) {
        top = rect.top - tooltipHeight - 16;
      }

      setCoords({ top, left });
    }
  }, [targetRef, step]);

  return (
    <>
      {/* Spotlight overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 450,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip */}
      <div
        style={{
          position: 'fixed',
          top: coords.top,
          left: coords.left,
          width: isMobile ? 'calc(100vw - 32px)' : 320,
          background: C.surface,
          border: `2px solid ${C.blue}`,
          borderRadius: 12,
          padding: 20,
          zIndex: 460,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
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
          <span style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>
            TOUR {step}/{totalSteps}
          </span>
          <button
            style={{ ...S.btn('ghost'), padding: '4px 8px', fontSize: 9 }}
            onClick={onSkip}
          >
            Skip tour
          </button>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#f1f5f9',
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.text,
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          {content}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {step > 1 ? (
            <button
              style={{ ...S.btn('ghost'), fontSize: 10 }}
              onClick={onPrev}
            >
              ← Prev
            </button>
          ) : (
            <div />
          )}

          <button
            style={{ ...S.btn('primary'), fontSize: 10 }}
            onClick={onNext}
          >
            {step === totalSteps ? 'Got it!' : 'Next →'}
          </button>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════
// GITHUB INTEGRATION COMPONENT (Phase 4.3)
// ═══════════════════════════════════════════════════════════
const GitHubIntegration = ({ projects, isMobile }) => {
  const [selectedProject, setSelectedProject] = useState(
    projects[0]?.id || null
  );
  const [githubData, setGithubData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState({
    owner: '',
    repo: '',
    token: '',
    branch: 'main',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedProjectData = projects.find((p) => p.id === selectedProject);

  // Load GitHub data when project changes
  useEffect(() => {
    if (!selectedProject) return;
    loadGithubData();
  }, [selectedProject]);

  const loadGithubData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await integrationsApi.get(selectedProject, 'github');
      setGithubData(data);
      if (data.connected && data.repo) {
        setForm({
          owner: data.repo.full_name.split('/')[0],
          repo: data.repo.name,
          branch: data.branch || 'main',
          token: '',
        });
      }
    } catch (e) {
      setError('Failed to load GitHub connection');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!form.owner || !form.repo || !form.token) {
      setError('Please fill in all fields');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await integrationsApi.connect(selectedProject, 'github', {
        repo_owner: form.owner,
        repo_name: form.repo,
        access_token: form.token,
        branch: form.branch || 'main',
      });
      setShowConnect(false);
      await loadGithubData();
    } catch (e) {
      setError(e.message || 'Failed to connect to GitHub');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Disconnect GitHub? Your files will remain in The Brain, but sync will stop.'
      )
    )
      return;
    try {
      await integrationsApi.disconnect(selectedProject, 'github');
      setGithubData(null);
      setForm({ owner: '', repo: '', token: '', branch: 'main' });
    } catch (e) {
      setError('Failed to disconnect');
    }
  };

  return (
    <div>
      {/* Header with project selector */}
      <div style={{ marginBottom: 16 }}>
        <span style={S.label()}>Project</span>
        <select
          style={S.sel}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Help Box */}
      <div
        style={{
          background: `${C.blue}08`,
          border: `1px solid ${C.blue}30`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>
            💡 What is GitHub Integration?
          </span>
          <button
            style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 8px' }}
            onClick={() => setShowHelp(!showHelp)}
          >
            {showHelp ? 'Hide' : 'Learn more'}
          </button>
        </div>
        {showHelp && (
          <div style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Connect your Brain project to a <strong>GitHub repository</strong>{' '}
              for backup and version control.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Sync your project files (markdown, specs, docs) to GitHub</li>
              <li>Track changes with Git history</li>
              <li>Share with collaborators</li>
              <li>Automatic backup</li>
            </ul>
            <p style={{ margin: '8px 0 0', color: C.muted }}>
              💡 <strong>Note:</strong> This syncs your <em>planning files</em>{' '}
              (PROJECT_OVERVIEW.md, specs, etc.). Your actual code repos are
              separate—link to them in your project overview.
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, color: C.dim }}>⟳ Loading...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            background: `${C.red}10`,
            border: `1px solid ${C.red}40`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 10, color: C.red }}>⚠ {error}</div>
        </div>
      )}

      {/* Not connected state */}
      {!loading && !githubData?.connected && (
        <div style={S.card(false)}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🐙</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#f1f5f9',
                marginBottom: 8,
              }}
            >
              GitHub Not Connected
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>
              Connect this project to a GitHub repository to enable sync.
            </div>
            <button
              style={S.btn('primary')}
              onClick={() => setShowConnect(true)}
            >
              Connect GitHub
            </button>
          </div>
        </div>
      )}

      {/* Connected state */}
      {!loading && githubData?.connected && githubData?.repo && (
        <div>
          {/* Repo Card */}
          <div style={S.card(true)}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 32 }}>🐙</span>
                <div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}
                  >
                    {githubData.repo.name}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {githubData.repo.full_name}
                  </div>
                  {githubData.repo.description && (
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
                      {githubData.repo.description}
                    </div>
                  )}
                </div>
              </div>
              <span style={S.badge(C.green)}>● LIVE</span>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.stargazers_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Stars
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.forks_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Forks
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.open_issues_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Issues
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.btn('ghost')}
                onClick={() => window.open(githubData.repo.html_url, '_blank')}
              >
                🌐 Open Repo
              </button>
              <button
                style={{ ...S.btn('ghost'), borderColor: C.red, color: C.red }}
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Recent Commits */}
          <div style={S.card(false)}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={S.label()}>
                Recent Commits ({githubData.branch})
              </span>
              <span style={{ fontSize: 9, color: C.dim }}>
                Last sync:{' '}
                {githubData.last_sync_at
                  ? new Date(githubData.last_sync_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>

            {githubData.commits?.length === 0 ? (
              <div style={{ fontSize: 10, color: C.dim }}>No commits found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {githubData.commits?.map((commit, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: '8px',
                      background: C.bg,
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.blue,
                        minWidth: 50,
                      }}
                    >
                      {commit.sha}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.text }}>
                        {commit.message}
                      </div>
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 2 }}>
                        {commit.author} •{' '}
                        {new Date(commit.date).toLocaleDateString()}
                      </div>
                    </div>
                    <a
                      href={commit.html_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 9, color: C.blue }}
                    >
                      View →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Error State (token expired, repo deleted, etc.) */}
      {!loading && githubData?.connected && !githubData?.repo && (
        <div style={S.card(false)}>
          <div
            style={{
              background: `${C.amber}10`,
              border: `1px solid ${C.amber}40`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.amber,
                marginBottom: 4,
              }}
            >
              ⚠ Connection Issue
            </div>
            <div style={{ fontSize: 9, color: C.text }}>
              {githubData.error ||
                'Could not fetch repository data. Your token may have expired or the repo was deleted.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={S.btn('primary')}
              onClick={() => setShowConnect(true)}
            >
              Reconnect
            </button>
            <button style={S.btn('ghost')} onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnect && (
        <Modal
          title="Connect to GitHub"
          onClose={() => {
            setShowConnect(false);
            setError(null);
          }}
          width={420}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
                <strong>How to connect:</strong>
                <ol style={{ margin: '8px 0', paddingLeft: 16 }}>
                  <li>Create a repo on GitHub (or use existing)</li>
                  <li>
                    Go to Settings → Developer Settings → Personal Access Tokens
                  </li>
                  <li>
                    Generate a token with <code>repo</code> scope
                  </li>
                  <li>Paste the token below</li>
                </ol>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 9, color: C.blue }}
                >
                  🔗 Open GitHub Token Settings →
                </a>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: `${C.red}10`,
                  border: `1px solid ${C.red}40`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.red }}>⚠ {error}</div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Repository Owner</span>
              <input
                style={S.input}
                value={form.owner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owner: e.target.value }))
                }
                placeholder="your-username or org-name"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Your GitHub username or organization
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Repository Name</span>
              <input
                style={S.input}
                value={form.repo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, repo: e.target.value }))
                }
                placeholder="my-project-docs"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                The repo where your Brain files will sync
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Branch</span>
              <input
                style={S.input}
                value={form.branch}
                onChange={(e) =>
                  setForm((f) => ({ ...f, branch: e.target.value }))
                }
                placeholder="main"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Default branch to sync (usually 'main')
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={S.label()}>Personal Access Token</span>
              <input
                style={{ ...S.input, fontFamily: 'monospace' }}
                type="password"
                value={form.token}
                onChange={(e) =>
                  setForm((f) => ({ ...f, token: e.target.value }))
                }
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Token with <strong>repo</strong> scope. Never shared or
                displayed again.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.btn('primary')}
                onClick={handleConnect}
                disabled={saving}
              >
                {saving ? 'Connecting...' : 'Connect to GitHub'}
              </button>
              <button
                style={S.btn('ghost')}
                onClick={() => setShowConnect(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── MARKDOWN EDITOR ───────────────────────────────────────────
const MarkdownEditor = ({
  path,
  content,
  onChange,
  onSave,
  saving,
  files = {},
}) => {
  const [mode, setMode] = useState('edit');
  const [val, setVal] = useState(content);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setVal(content);
    setDirty(false);
  }, [content, path]);

  // Debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(path, val);
      setDirty(false);
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [val, dirty, path, onSave]);

  const isJson = path?.endsWith('.json');
  const isReadonly = path === 'system/agent.ignore' || path === 'manifest.json';
  const hasMermaid = val.includes('```mermaid');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '7px 12px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: C.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 300,
            }}
          >
            {path}
          </span>
          {isReadonly && <span style={S.badge(C.amber)}>READONLY</span>}
          {path === 'manifest.json' && (
            <span style={S.badge(C.purple)}>MANIFEST</span>
          )}
          {hasMermaid && <span style={S.badge(C.blue)}>MERMAID</span>}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          {dirty && (
            <span style={{ fontSize: 9, color: C.amber, marginRight: 8 }}>
              Unsaved changes...
            </span>
          )}
          {!isJson && !isReadonly && (
            <>
              <button
                style={S.tab(mode === 'edit', '#10b981')}
                onClick={() => setMode('edit')}
              >
                Edit
              </button>
              <button
                style={S.tab(mode === 'preview', '#10b981')}
                onClick={() => setMode('preview')}
              >
                Preview
              </button>
            </>
          )}
          {!isReadonly && (
            <button
              style={{
                ...S.btn('success'),
                padding: '4px 10px',
                opacity: saving ? 0.6 : 1,
              }}
              onClick={() => {
                onSave(path, val);
                setDirty(false);
              }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
      {mode === 'edit' || isJson ? (
        <textarea
          style={{
            ...S.input,
            flex: 1,
            resize: 'none',
            border: 'none',
            borderRadius: 0,
            fontSize: isJson ? 11 : 12,
            lineHeight: 1.7,
            padding: '14px 16px',
            background: '#050810',
          }}
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            onChange(e.target.value);
            setDirty(true);
          }}
          readOnly={isReadonly}
          spellCheck={false}
        />
      ) : (
        <MarkdownPreview content={val} files={files} />
      )}
    </div>
  );
};

// ── IMAGE VIEWER ──────────────────────────────────────────────
const ImageViewer = ({ path, content }) => {
  const [imgError, setImgError] = useState(false);
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No image content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:image/png;base64,${content}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          color: C.muted,
        }}
      >
        📷 {path} • {formatFileSize(content)}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imgError ? (
          <div style={{ color: C.red, textAlign: 'center', fontSize: 11 }}>
            Failed to load image
          </div>
        ) : (
          <img
            src={src}
            alt={path}
            onError={() => setImgError(true)}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        )}
      </div>
    </div>
  );
};

// ── AUDIO PLAYER ──────────────────────────────────────────────
const AudioPlayer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No audio content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:audio/mpeg;base64,${content}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          color: C.muted,
        }}
      >
        🎵 {path} • {formatFileSize(content)}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <audio
          src={src}
          controls
          style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
        />
        <a
          href={src}
          download={path}
          style={{ ...S.btn('ghost'), padding: '6px 14px', fontSize: 10 }}
        >
          ⬇ Download
        </a>
      </div>
    </div>
  );
};

// ── VIDEO PLAYER ──────────────────────────────────────────────
const VideoPlayer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No video content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:video/mp4;base64,${content}`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          color: C.muted,
        }}
      >
        🎥 {path} • {formatFileSize(content)}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          src={src}
          controls
          style={{
            width: '100%',
            maxWidth: 800,
            maxHeight: '70vh',
            marginBottom: 16,
            borderRadius: 4,
          }}
        />
        <a
          href={src}
          download={path}
          style={{ ...S.btn('ghost'), padding: '6px 14px', fontSize: 10 }}
        >
          ⬇ Download
        </a>
      </div>
    </div>
  );
};

// ── BINARY VIEWER ─────────────────────────────────────────────
const BinaryViewer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No file content</div>
    );
  const fileType = getFileType(path);
  const icons = { document: '📕', archive: '📦', unknown: '⚫' };
  const icon = icons[fileType] || '⚫';
  const size = formatFileSize(content);
  const isLarge = content.length > 500 * 1024;
  const downloadFile = () => {
    let mimeType = 'application/octet-stream';
    if (content.startsWith('data:'))
      mimeType = content.split(';')[0].replace('data:', '');
    const blob = new Blob([content.startsWith('data:') ? content : content], {
      type: mimeType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          color: C.muted,
        }}
      >
        {icon} {path} • {size}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 12, color: C.text, textAlign: 'center' }}>
          This file cannot be previewed
        </div>
        {isLarge && (
          <div
            style={{
              fontSize: 9,
              color: C.amber,
              background: 'rgba(245,158,11,0.1)',
              border: `1px solid ${C.amber}30`,
              borderRadius: 4,
              padding: '8px 12px',
              maxWidth: 300,
            }}
          >
            ⚠ Large file ({size}) — may load slowly
          </div>
        )}
        <button
          onClick={downloadFile}
          style={{ ...S.btn('primary'), padding: '8px 16px', fontSize: 11 }}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
};

// ── SCRIPT RUNNER (Phase 3.6) ───────────────────────────────
const ScriptRunner = ({ projectId, projectFiles }) => {
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Find scripts in tools folder
  useEffect(() => {
    const foundScripts = [];
    for (const [path, content] of Object.entries(projectFiles || {})) {
      if (
        path.startsWith('tools/') &&
        (path.endsWith('.js') || path.endsWith('.py'))
      ) {
        const name = path
          .split('/')
          .pop()
          .replace(/\\.[^.]+$/, '');
        // Try to extract metadata from script
        let meta = {
          name,
          description: '',
          language: path.endsWith('.py') ? 'python' : 'javascript',
        };
        const metaMatch = content.match(
          /export\\s+const\\s+meta\\s*=\\s*({[^}]+})/
        );
        if (metaMatch) {
          try {
            const parsed = JSON.parse(metaMatch[1].replace(/'/g, '"'));
            meta = { ...meta, ...parsed };
          } catch {}
        }
        foundScripts.push({ path, name, content, meta });
      }
    }
    setScripts(foundScripts);
  }, [projectFiles]);

  const runScript = async () => {
    if (!selectedScript) return;
    setRunning(true);
    setOutput('Running...\\n');

    try {
      const res = await scriptsApi.run(
        selectedScript.content,
        selectedScript.meta.language || 'javascript',
        projectId,
        projectFiles
      );

      let out = '';
      if (res.output) out += res.output + '\\n';
      if (res.result !== undefined && res.result !== null) {
        out += `\\nResult: ${typeof res.result === 'object' ? JSON.stringify(res.result, null, 2) : res.result}`;
      }
      if (res.error) out += `\\nError: ${res.error}`;

      setOutput(out || 'Script executed successfully (no output)');
    } catch (e) {
      setOutput(`Execution failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const runPredefined = (type) => {
    let script = '';
    let name = '';

    if (type === 'wordcount') {
      name = 'Word Count';
      script = `
const mdFiles = Object.entries(projectFiles).filter(([path]) => 
  path.endsWith('.md') || path.endsWith('.txt')
);

let totalWords = 0;
const fileStats = [];

for (const [path, content] of mdFiles) {
  const cleanContent = content
    .replace(/[#\\\\*\\\\[\\\\]()\\\\-\\\\|\\\\/\\>]/g, ' ')
    .replace(/\\\\s+/g, ' ')
    .trim();
  
  const words = cleanContent.split(/\\\\s+/).filter(w => w.length > 0).length;
  totalWords += words;
  fileStats.push({ path, words });
}

fileStats.sort((a, b) => b.words - a.words);

console.log('Total words:', totalWords);
console.log('Files:', mdFiles.length);
console.log('\\nTop 5 files by word count:');
fileStats.slice(0, 5).forEach(f => console.log(\`  ${f.path}: ${f.words} words\`));
`;
    } else if (type === 'todos') {
      name = 'List TODOs';
      script = `
const todos = [];

for (const [path, content] of Object.entries(projectFiles)) {
  const lines = content.split('\\n');
  
  lines.forEach((line, index) => {
    const match = line.match(/(TODO|FIXME|HACK|XXX)[\\\\s:]*/i);
    if (match) {
      todos.push({
        path,
        line: index + 1,
        type: match[1].toUpperCase(),
        text: line.trim()
      });
    }
  });
}

console.log(\`Found ${todos.length} items:\`);
todos.slice(0, 20).forEach(t => {
  console.log(\`[${t.type}] ${t.path}:${t.line}\`);
  console.log(\`  ${t.text}\`);
});
`;
    } else if (type === 'export') {
      name = 'Export Stats';
      script = `
const stats = {
  totalFiles: Object.keys(projectFiles).length,
  folders: [...new Set(Object.keys(projectFiles).map(p => p.split('/')[0]))],
  byExtension: {}
};

for (const path of Object.keys(projectFiles)) {
  const ext = path.split('.').pop() || 'no-ext';
  stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
}

console.log('Project Statistics');
console.log('==================');
console.log('Total files:', stats.totalFiles);
console.log('\\nFolders:', stats.folders.join(', '));
console.log('\\nFiles by type:');
Object.entries(stats.byExtension)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ext, count]) => console.log(\`  .${ext}: ${count}\`));
`;
    }

    setSelectedScript({
      content: script,
      meta: { name, language: 'javascript' },
    });
    setOutput('');
  };

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ⚡ Script Runner
        </span>
        <span style={{ fontSize: 12, color: C.dim }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Predefined Scripts */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
              Quick Scripts:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => runPredefined('wordcount')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                📝 Word Count
              </button>
              <button
                onClick={() => runPredefined('todos')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                ✓ List TODOs
              </button>
              <button
                onClick={() => runPredefined('export')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                📊 Stats
              </button>
            </div>
          </div>

          {/* Custom Scripts from tools/ */}
          {scripts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
                Custom Scripts (from tools/):
              </div>
              <select
                value={selectedScript?.path || ''}
                onChange={(e) => {
                  const s = scripts.find((x) => x.path === e.target.value);
                  setSelectedScript(s || null);
                  setOutput('');
                }}
                style={{ ...S.sel, fontSize: 10, width: '100%' }}
              >
                <option value="">Select a script...</option>
                {scripts.map((s) => (
                  <option key={s.path} value={s.path}>
                    {s.meta.name || s.name} ({s.meta.language})
                  </option>
                ))}
              </select>
              {selectedScript && selectedScript.meta.description && (
                <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
                  {selectedScript.meta.description}
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={runScript}
            disabled={!selectedScript || running}
            style={{
              ...S.btn('primary'),
              fontSize: 9,
              padding: '4px 12px',
              opacity: !selectedScript || running ? 0.5 : 1,
            }}
          >
            {running ? '⟳ Running...' : '▶ Run Script'}
          </button>

          {/* Output */}
          {output && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>
                Output:
              </div>
              <pre
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: 10,
                  fontSize: 9,
                  color: C.text,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {output}
              </pre>
            </div>
          )}

          {scripts.length === 0 && (
            <div style={{ fontSize: 10, color: C.dim, padding: '10px 0' }}>
              No custom scripts found. Create .js files in the /tools/ folder.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── HEALTH CHECK (Phase 3.5) ─────────────────────────────────
const HealthCheck = ({ project, projectFiles, templates, onFix }) => {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState([]);
  const [fixing, setFixing] = useState(false);

  const REQUIRED_FILES = [
    {
      path: 'PROJECT_OVERVIEW.md',
      defaultContent: (name) =>
        `# ${name}\n\n## What is this?\n\n> One sentence description here.\n\n## Problem\n\n## Solution\n\n## Target User\n\n## Revenue Model\n\n## Current Status\n\n## Next Milestone\n`,
    },
    {
      path: 'DEVLOG.md',
      defaultContent: (name) =>
        `# Dev Log — ${name}\n\n## ${new Date().toISOString().slice(0, 10)}\n\n- Project initialised\n`,
    },
    {
      path: 'manifest.json',
      defaultContent: (name, id) =>
        JSON.stringify(
          {
            bidl_version: '1.0',
            id,
            name,
            emoji: '📁',
            phase: 'BOOTSTRAP',
            status: 'active',
            priority: 1,
            revenue_ready: false,
            income_target: 0,
            momentum: 3,
            last_touched: new Date().toISOString().slice(0, 7),
            desc: '',
            next_action: '',
            blockers: [],
            tags: [],
            skills: ['dev', 'strategy'],
            custom_folders: [],
            integrations: {},
            created: new Date().toISOString(),
            exported: new Date().toISOString(),
          },
          null,
          2
        ),
    },
  ];

  const runCheck = async () => {
    setChecking(true);
    setIssues([]);

    await new Promise((r) => setTimeout(r, 300)); // Visual feedback

    const foundIssues = [];
    const files = projectFiles || {};
    const template = templates.find((t) => t.id === project?.templateId);
    const allFolderIds = [
      ...(template?.config?.folders || []),
      ...(project?.customFolders?.map((f) => f.id) || []),
    ];

    // Check 1: Required files exist
    for (const req of REQUIRED_FILES) {
      if (!files[req.path]) {
        foundIssues.push({
          type: 'missing_file',
          severity: 'error',
          message: `Missing required file: ${req.path}`,
          path: req.path,
          autoFix: () =>
            req.defaultContent(
              project?.name || 'Project',
              project?.id || 'project'
            ),
        });
      }
    }

    // Check 2: manifest.json is valid JSON
    if (files['manifest.json']) {
      try {
        const manifest = JSON.parse(files['manifest.json']);
        // Check if manifest matches project state
        if (manifest.name !== project?.name) {
          foundIssues.push({
            type: 'manifest_mismatch',
            severity: 'warning',
            message: `Manifest name "${manifest.name}" doesn't match project name "${project?.name}"`,
            path: 'manifest.json',
          });
        }
        if (manifest.phase !== project?.phase) {
          foundIssues.push({
            type: 'manifest_mismatch',
            severity: 'warning',
            message: `Manifest phase "${manifest.phase}" doesn't match project phase "${project?.phase}"`,
            path: 'manifest.json',
          });
        }
      } catch {
        foundIssues.push({
          type: 'invalid_json',
          severity: 'error',
          message: 'manifest.json contains invalid JSON',
          path: 'manifest.json',
        });
      }
    }

    // Check 3: Orphaned files (files not in any folder)
    const orphaned = Object.keys(files).filter((path) => {
      if (path === 'manifest.json') return false;
      const folder = path.split('/')[0];
      return !allFolderIds.includes(folder) && !path.includes('/');
    });
    if (orphaned.length > 0) {
      foundIssues.push({
        type: 'orphaned_files',
        severity: 'warning',
        message: `${orphaned.length} file(s) not in any folder`,
        paths: orphaned,
      });
    }

    // Check 4: Template-required folders exist
    if (template?.config?.folders) {
      const missingFolders = template.config.folders.filter(
        (f) => !allFolderIds.includes(f)
      );
      for (const folderId of missingFolders) {
        foundIssues.push({
          type: 'missing_folder',
          severity: 'warning',
          message: `Missing template folder: ${folderId}`,
          folderId,
        });
      }
    }

    // Check 5: Empty .gitkeep files in folders
    for (const folderId of allFolderIds) {
      const gitkeepPath = `${folderId}/.gitkeep`;
      if (!files[gitkeepPath]) {
        foundIssues.push({
          type: 'missing_gitkeep',
          severity: 'info',
          message: `Missing .gitkeep in ${folderId}`,
          path: gitkeepPath,
          autoFix: () => '',
        });
      }
    }

    setIssues(foundIssues);
    setChecking(false);
  };

  const handleFixAll = async () => {
    const fixable = issues.filter((i) => i.autoFix);
    if (fixable.length === 0) return;

    setFixing(true);
    const fixes = [];
    for (const issue of fixable) {
      fixes.push({
        type: 'create_file',
        path: issue.path,
        content: issue.autoFix(),
      });
    }
    await onFix(fixes);

    // Re-run check
    await runCheck();
    setFixing(false);
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  const fixableCount = issues.filter((i) => i.autoFix).length;

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: C.blue,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            🏥 Health Check
          </span>
          {issues.length > 0 && (
            <>
              {errorCount > 0 && (
                <span style={{ ...S.badge(C.red), fontSize: 8 }}>
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span style={{ ...S.badge(C.amber), fontSize: 8 }}>
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {infoCount > 0 && (
                <span style={{ ...S.badge(C.dim), fontSize: 8 }}>
                  {infoCount} info
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{ ...S.btn('primary'), fontSize: 9, padding: '4px 10px' }}
            onClick={(e) => {
              e.stopPropagation();
              runCheck();
              setExpanded(true);
            }}
            disabled={checking}
          >
            {checking ? '⟳ Checking...' : '🔍 Check'}
          </button>
          <span style={{ fontSize: 12, color: C.dim }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {issues.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: C.green,
                fontSize: 12,
              }}
            >
              ✓ All checks passed — project structure is healthy
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                {fixableCount > 0 && (
                  <button
                    style={{
                      ...S.btn('success'),
                      fontSize: 9,
                      padding: '4px 10px',
                    }}
                    onClick={handleFixAll}
                    disabled={fixing}
                  >
                    {fixing
                      ? '⟳ Fixing...'
                      : `✓ Auto-fix ${fixableCount} issue${fixableCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {issues.map((issue, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 6,
                    borderRadius: 4,
                    background:
                      issue.severity === 'error'
                        ? `${C.red}10`
                        : issue.severity === 'warning'
                          ? `${C.amber}10`
                          : C.bg,
                    border: `1px solid ${issue.severity === 'error' ? C.red : issue.severity === 'warning' ? C.amber : C.border}`,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 10 }}>
                      {issue.severity === 'error'
                        ? '❌'
                        : issue.severity === 'warning'
                          ? '⚠️'
                          : 'ℹ️'}
                    </span>
                    <span style={{ fontSize: 10, color: C.text, flex: 1 }}>
                      {issue.message}
                    </span>
                    {issue.autoFix && (
                      <span style={{ fontSize: 8, color: C.green }}>
                        ✓ Auto-fixable
                      </span>
                    )}
                  </div>
                  {issue.paths && (
                    <div
                      style={{
                        marginTop: 4,
                        paddingLeft: 20,
                        fontSize: 9,
                        color: C.dim,
                      }}
                    >
                      {issue.paths.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── SKILLS + WORKFLOWS ────────────────────────────────────────
const SKILLS = {
  dev: {
    id: 'dev',
    icon: '🛠',
    label: 'Dev Agent',
    description: 'Code, debug, deploy',
    sop: [
      'Read PROJECT_OVERVIEW.md and DEVLOG.md',
      'Check code-modules/ for existing work',
      'Never modify manifest.json or agent.ignore',
      'Update DEVLOG.md after each change',
      'Flag blockers in REVIEW_QUEUE.md',
    ],
    permissions: ['read:all', 'write:code-modules', 'write:devlog'],
    ignore: ['legal/', 'design-assets/', 'manifest.json'],
    prompt_prefix:
      'Senior dev. Read context JSON. Check code-modules/ for existing work. Ask before deleting. Commit frequently.',
  },
  content: {
    id: 'content',
    icon: '✍️',
    label: 'Content Agent',
    description: 'Write, draft, social, docs',
    sop: [
      'Read brand-voice guide first',
      'All drafts → /staging with DRAFT_ prefix',
      'Never publish directly',
      'Match tone: builder, authentic, anti-corporate',
    ],
    permissions: ['read:all', 'write:content-assets', 'write:staging'],
    ignore: ['code-modules/', 'legal/'],
    prompt_prefix:
      'Content specialist. Brand voice: authentic, builder-first. All drafts to staging first.',
  },
  strategy: {
    id: 'strategy',
    icon: '🎯',
    label: 'Strategy Agent',
    description: 'Planning, revenue, prioritisation',
    sop: [
      'Ground every rec in revenue vs effort',
      'Thailand £3000/mo is north star',
      'No new projects until P1–P3 have revenue',
      'Output structured action items',
    ],
    permissions: ['read:all', 'write:project-artifacts'],
    ignore: ['code-modules/', 'staging/'],
    prompt_prefix:
      'Strategic advisor. Every recommendation maps to £3000/mo Thailand goal. Prioritise ruthlessly. No fluff.',
  },
  design: {
    id: 'design',
    icon: '🎨',
    label: 'Design Agent',
    description: 'UI/UX, branding, visual',
    sop: [
      'Reference brand guide first',
      'Bob style: dark #0a0a0f, blue #1a4fd6, mono',
      'BUIDL logo locked — do not modify',
      'All assets → /staging with SKETCH_ prefix',
    ],
    permissions: ['read:all', 'write:design-assets', 'write:staging'],
    ignore: ['code-modules/', 'legal/'],
    prompt_prefix:
      'Visual designer. Dark minimalist, monospace, nearly kawaii. All output to staging first.',
  },
  research: {
    id: 'research',
    icon: '🔬',
    label: 'Research Agent',
    description: 'Market research, competitor analysis',
    sop: [
      'All findings → project-artifacts/ as markdown',
      'Always cite sources',
      'Map findings to project decisions',
      'Flag contradictions with current assumptions',
    ],
    permissions: ['read:all', 'write:project-artifacts'],
    ignore: ['staging/'],
    prompt_prefix:
      'Research analyst. Cite sources. Map insights to decisions. Flag contradictions.',
  },
};
const WORKFLOWS = [
  {
    id: 'product-launch',
    icon: '🚀',
    label: 'Product Launch',
    steps: [
      {
        id: 1,
        label: 'Final build check',
        agent: 'dev',
        sop: 'Verify features, no errors, mobile responsive',
      },
      {
        id: 2,
        label: 'Security audit',
        agent: 'dev',
        sop: 'Check env vars, HTTPS, contracts',
      },
      {
        id: 3,
        label: 'Launch assets',
        agent: 'design',
        sop: 'Screenshots, banner, OG image → staged',
      },
      {
        id: 4,
        label: 'Launch copy',
        agent: 'content',
        sop: 'Thread, email, description → drafted',
      },
      {
        id: 5,
        label: 'Deploy',
        agent: 'dev',
        sop: 'Netlify/Vercel, verify live URL',
      },
      {
        id: 6,
        label: 'Post thread',
        agent: 'content',
        sop: 'Publish, tag communities',
      },
      {
        id: 7,
        label: 'Monitor',
        agent: 'dev',
        sop: 'Analytics, error logs, 48h feedback',
      },
    ],
  },
  {
    id: 'content-sprint',
    icon: '✍️',
    label: 'Content Sprint',
    steps: [
      {
        id: 1,
        label: 'Pick angle',
        agent: 'strategy',
        sop: 'Review CONTENT_CALENDAR, find gap',
      },
      {
        id: 2,
        label: 'Draft pieces',
        agent: 'content',
        sop: 'Thread + blog → /staging',
      },
      {
        id: 3,
        label: 'Design assets',
        agent: 'design',
        sop: 'Visuals, SKETCH_ prefix',
      },
      {
        id: 4,
        label: 'Review',
        agent: 'human',
        sop: 'Human approves or sends back',
      },
      {
        id: 5,
        label: 'Publish',
        agent: 'content',
        sop: 'Schedule, update calendar',
      },
    ],
  },
  {
    id: 'idea-to-brief',
    icon: '💡',
    label: 'Idea → Brief',
    steps: [
      {
        id: 1,
        label: 'Capture',
        agent: 'human',
        sop: 'Add to idea bank. Title + one sentence.',
      },
      {
        id: 2,
        label: 'Validate',
        agent: 'strategy',
        sop: 'Score: revenue, effort, goal alignment',
      },
      {
        id: 3,
        label: 'Research',
        agent: 'research',
        sop: '3 competitors, gap, audience',
      },
      {
        id: 4,
        label: 'MVP scope',
        agent: 'strategy',
        sop: '5 must-haves max. Cut rest.',
      },
      {
        id: 5,
        label: 'Dev brief',
        agent: 'dev',
        sop: 'Stack, components, timeline',
      },
      {
        id: 6,
        label: 'Wireframes',
        agent: 'design',
        sop: 'Core screens, SKETCH_ prefix',
      },
    ],
  },
  {
    id: 'weekly-review',
    icon: '📊',
    label: 'Weekly Review',
    steps: [
      {
        id: 1,
        label: 'Health check',
        agent: 'human',
        sop: 'Honest momentum 1-5 each project',
      },
      {
        id: 2,
        label: 'Review staging',
        agent: 'human',
        sop: 'Approve, defer or kill all items',
      },
      {
        id: 3,
        label: 'AI review',
        agent: 'strategy',
        sop: 'Full analysis, bottlenecks',
      },
      {
        id: 4,
        label: 'Update devlogs',
        agent: 'human',
        sop: 'Log entry for each active project',
      },
      {
        id: 5,
        label: 'Set focus',
        agent: 'human',
        sop: 'Pick #1, define next action',
      },
      {
        id: 6,
        label: 'Build post',
        agent: 'content',
        sop: 'Honest progress update',
      },
    ],
  },
];
const BOOTSTRAP_STEPS = [
  {
    id: 'brief',
    icon: '📋',
    label: 'Bootstrap Brief',
    agent: null,
    desc: 'You fill this in. 10 mins. Everything else derives from it.',
  },
  {
    id: 'strategy',
    icon: '🎯',
    label: 'Strategy Agent',
    agent: 'strategy',
    desc: 'Reads brief → validates scope → outputs MVP feature list + revenue rationale.',
  },
  {
    id: 'dev',
    icon: '🛠',
    label: 'Dev Agent',
    agent: 'dev',
    desc: 'Reads strategy output → outputs tech stack, component list, Bolt-ready one-shot prompt.',
  },
  {
    id: 'design',
    icon: '🎨',
    label: 'Design Agent',
    agent: 'design',
    desc: 'Reads dev brief → outputs UI spec, style tokens, asset list → /staging.',
  },
  {
    id: 'content',
    icon: '✍️',
    label: 'Content Agent',
    agent: 'content',
    desc: 'Reads all above → outputs launch copy, onboarding doc, first thread draft → /staging.',
  },
  {
    id: 'review',
    icon: '👤',
    label: 'Human Review',
    agent: null,
    desc: 'You review staging items from all agents. Approve, defer or kill. Build begins.',
  },
];

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
  const WIZARD_STEPS = [
    { id: 'core', label: 'Core Idea', icon: '💡' },
    { id: 'scope', label: 'MVP Scope', icon: '🎯' },
    { id: 'tech', label: 'Tech & Design', icon: '🛠' },
    { id: 'agents', label: 'Agent Team', icon: '🤖' },
    { id: 'review', label: 'Review & Generate', icon: '✅' },
  ];
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
  const Row = ({ label, children, hint }) => (
    <div style={{ marginBottom: 12 }}>
      <span style={S.label()}>{label}</span>
      {hint && (
        <div style={{ fontSize: 8, color: C.dim, marginBottom: 4 }}>{hint}</div>
      )}
      {children}
    </div>
  );
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

// ── EXPORT UTILITIES ──────────────────────────────────────────
const buildZipExport = (project) => {
  const manifest = makeManifest(project);
  let out = `BUIDL_EXPORT_V1\nMANIFEST_START\n${JSON.stringify(manifest, null, 2)}\nMANIFEST_END\nFILES_START\n`;
  Object.entries(project.files || {}).forEach(([path, content]) => {
    out += `FILE_START:${path}\n${content || ''}\nFILE_END:${path}\n`;
  });
  out += `FILES_END\n`;
  return out;
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT — accepts props from App.jsx (auth gate)
// ══════════════════════════════════════════════════════════════
export default function TheBrain({
  user,
  initialProjects = [],
  initialStaging = [],
  initialIdeas = [],
  initialAreas = [],
  initialGoals = [],
  initialTemplates = [],
  initialTags = [],
  initialEntityTags = [],
  onLogout,
}) {
  // ── STATE ──────────────────────────────────────────────────
  const [projects, setProjects] = useState(
    initialProjects.map((p) => ({ ...p, health: calcHealth(p) }))
  );
  const [staging, setStaging] = useState(initialStaging);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [areas, setAreas] = useState(initialAreas);
  const [goals, setGoals] = useState(initialGoals || []);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [userTags, setUserTags] = useState(initialTags || []);
  // entityTags: flat array of {id,tag_id,entity_type,entity_id,name,color,category}
  const [entityTags, setEntityTags] = useState(initialEntityTags || []);
  const [tagInput, setTagInput] = useState({}); // {[entityKey]: inputValue}
  const [selectedTagId, setSelectedTagId] = useState(null); // for Tags brain tab
  const [userSettings, setUserSettings] = useState({
    font: 'JetBrains Mono',
    fontSize: 11,
  });
  const [fileMetadata, setFileMetadata] = useState(null); // Roadmap 2.3: current file's metadata
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null); // Phase 3.1: AI metadata suggestions
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    font: 'JetBrains Mono',
    fontSize: 11,
    assistance_mode: 'coach',
  });

  // ── UNDO/REDO STATE ─────────────────────────────────────────
  const fileHistory = useUndoRedo(50); // Track last 50 file edits
  const [undoToast, setUndoToast] = useState(null);

  // ── KEYBOARD SHORTCUTS STATE ────────────────────────────────
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [keySequence, setKeySequence] = useState([]); // For multi-key shortcuts like 'g then c'

  // Hub links
  const [hubLinks, setHubLinks] = useState([]);
  const [newLinkForm, setNewLinkForm] = useState({
    targetType: 'project',
    targetId: '',
    relationship: 'related',
  });

  // UI navigation
  const [view, setView] = useState('brain');
  const [mainTab, setMainTab] = useState('command');
  const [hubId, setHubId] = useState(null);
  const [hubTab, setHubTab] = useState('editor');
  const [reviewFilter, setReviewFilter] = useState('pending'); // Phase 2.3: 'all'|'pending'|'filed'
  const [focusId, setFocusId] = useState(initialProjects[0]?.id || null);

  // Mobile responsive (Phase 4.1)
  const { isMobile, isTablet } = useBreakpoint();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileFileTreeOpen, setMobileFileTreeOpen] = useState(false);

  // Session timer
  const [sessionActive, setSessionOn] = useState(false);
  const [sessionSecs, setSessionSecs] = useState(0);
  const [sessionLog, setSessionLog] = useState('');
  const [templateId, setTemplateId] = useState('');
  const timerRef = useRef(null);
  const sessionStart = useRef(null);

  // AI coach
  const [aiOut, setAiOut] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiIn, setAiIn] = useState('');
  const aiRef = useRef(null);

  // UI misc
  const [copied, setCopied] = useState(false);
  const [activeSkill, setActiveSkill] = useState('dev');
  const [briefProj, setBriefProj] = useState(initialProjects[0]?.id || '');
  const [activeWF, setActiveWF] = useState(null);
  const [wfProj, setWfProj] = useState(initialProjects[0]?.id || '');
  const [newIdea, setNewIdea] = useState('');
  const [newStaging, setNewStaging] = useState({
    name: '',
    tag: 'IDEA_',
    project: initialProjects[0]?.id || '',
    notes: '',
  });
  const [newGoalForm, setNewGoalForm] = useState({
    title: '',
    target_amount: 3000,
    currency: 'GBP',
    timeframe: 'monthly',
    category: 'income',
  });
  const [activeGoalId, setActiveGoalId] = useState(
    initialGoals?.[0]?.id || null
  );
  const [showInt, setShowInt] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');

  // Modals
  const [modal, setModal] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false); // Phase 3.3
  const [searchFilters, setSearchFilters] = useState({
    project_id: '',
    folder: '',
    file_type: '',
    tag: '',
  });
  const [recentSearches, setRecentSearches] = useState([]); // Phase 3.3
  const [bootstrapWizardId, setBootstrapWiz] = useState(null);
  const [newProjForm, setNewProjForm] = useState({
    name: '',
    emoji: '📁',
    phase: 'BOOTSTRAP',
    desc: '',
    areaId: '',
    incomeTarget: 0,
    templateId: '',
  });
  const [newFileName, setNewFileName] = useState('');
  const [newFileFolder, setNewFileFolder] = useState('staging');
  const [customFolderForm, setCFForm] = useState({
    id: '',
    label: '',
    icon: '📁',
    desc: '',
  });
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMethod, setImportMethod] = useState('buidl'); // "buidl" | "json" | "folder"
  const [importLoading, setImportLoading] = useState(false);
  const [importForm, setImportForm] = useState({
    projectId: '',
    name: '',
    lifeAreaId: '',
    templateId: '',
  });
  const [importConflict, setImportConflict] = useState(null); // {projectId, overwrite callback}
  const [renameValue, setRenameValue] = useState('');

  // Onboarding state (Phase 4.2)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    user?.onboarding_completed || false
  );

  // Tour refs (Phase 4.2)
  const brainTabRef = useRef(null);
  const hubTabRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const aiCoachRef = useRef(null);
  // Notification ref (Phase 4.4)
  const notificationRef = useRef(null);

  // Persistence state
  const [saving, setSaving] = useState(false); // file save indicator
  const [toast, setToast] = useState(null); // {msg} or null
  const [loadingFiles, setLoadingFiles] = useState(false); // hub file loading
  const [commentsLoading, setCommentsLoading] = useState(false); // comments loading indicator

  // Offline mode state (Phase 2.4A)
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // "idle", "syncing", "synced", "error"
  const [queuedWrites, setQueuedWrites] = useState(0);

  // Notifications state (Phase 4.4)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Tasks state (Phase 5.4)
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    project_id: '',
    assignee_type: 'human',
    assignee_id: 'user',
  });
  const [taskAgents, setTaskAgents] = useState([]);
  const [taskLoadingAgents, setTaskLoadingAgents] = useState(false);

  // Desktop sync state (Phase 2.4B)
  const [syncState, setSyncState] = useState(null);
  const [syncChanges, setSyncChanges] = useState(null);
  const [showSyncReview, setShowSyncReview] = useState(false);

  // Daily checkin state (Phase 2.5)
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinLastDate, setCheckinLastDate] = useState(
    localStorage.getItem('lastCheckinDate')
  );

  // Training log state (Phase 2.6)
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [weeklyTraining, setWeeklyTraining] = useState({
    count: 0,
    minutes: 0,
  });

  // Outreach log state (Phase 2.7)
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [todayOutreach, setTodayOutreach] = useState([]); // today's entries
  const [weeklyOutreach, setWeeklyOutreach] = useState(0); // total this week

  // Drift detection state (Phase 2.10)
  const [driftFlags, setDriftFlags] = useState([]);
  const [driftExpanded, setDriftExpanded] = useState(false);
  const [driftDismissed, setDriftDismissed] = useState(() => {
    const saved = localStorage.getItem('driftDismissed');
    return saved ? JSON.parse(saved) : [];
  });

  const showToast = (msg) => setToast({ msg });

  // ── TAG HELPERS ───────────────────────────────────────────
  const getEntityTags = (type, id) =>
    entityTags.filter(
      (et) => et.entity_type === type && String(et.entity_id) === String(id)
    );

  const attachTag = async (
    entityType,
    entityId,
    tagName,
    color = '#3b82f6'
  ) => {
    try {
      const res = await tagsApi.attachByName(
        tagName.trim(),
        entityType,
        entityId,
        color
      );
      setEntityTags((prev) => [
        ...prev.filter(
          (et) =>
            !(
              et.tag_id === res.tag_id &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        ),
        res,
      ]);
      setUserTags((prev) =>
        prev.find((t) => t.id === res.tag_id)
          ? prev
          : [...prev, { id: res.tag_id, name: res.name, color: res.color }]
      );
    } catch (e) {
      showToast('Failed to attach tag');
    }
  };

  const detachTag = async (entityType, entityId, tagId) => {
    try {
      await tagsApi.detach(tagId, entityType, entityId);
      setEntityTags((prev) =>
        prev.filter(
          (et) =>
            !(
              et.tag_id === tagId &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        )
      );
    } catch (e) {
      showToast('Failed to remove tag');
    }
  };

  const QuickTagRow = ({ entityType, entityId }) => {
    const key = `${entityType}:${entityId}`;
    const tags = getEntityTags(entityType, entityId);
    const inputVal = tagInput[key] || '';
    const suggestions =
      inputVal.length >= 1
        ? userTags.filter(
            (t) =>
              t.name.toLowerCase().includes(inputVal.toLowerCase()) &&
              !tags.find((et) => et.tag_id === t.id)
          )
        : [];
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        {tags.map((t) => (
          <TagPill
            key={t.id}
            tag={t}
            onRemove={() => detachTag(entityType, entityId, t.tag_id)}
          />
        ))}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            style={{
              ...S.input,
              width: 90,
              padding: '1px 5px',
              fontSize: 9,
              height: 18,
            }}
            placeholder="+ tag"
            value={inputVal}
            onChange={(e) =>
              setTagInput((prev) => ({ ...prev, [key]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputVal.trim()) {
                attachTag(entityType, entityId, inputVal.trim());
                setTagInput((prev) => ({ ...prev, [key]: '' }));
                e.preventDefault();
              }
            }}
          />
          {suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                zIndex: 50,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                minWidth: 120,
              }}
            >
              {suggestions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '3px 8px',
                    fontSize: 9,
                    cursor: 'pointer',
                    color: t.color,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    attachTag(entityType, entityId, t.name, t.color);
                    setTagInput((prev) => ({ ...prev, [key]: '' }));
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── SEED DEFAULTS — called if areas, goals or templates are empty ─────────────
  useEffect(() => {
    if (areas.length === 0 && user) {
      const defaults = [
        {
          name: 'Business / Revenue',
          color: '#1a4fd6',
          icon: '💼',
          description: 'Revenue generating projects',
          sort_order: 1,
        },
        {
          name: 'Health / Body',
          color: '#10b981',
          icon: '🏋️',
          description: 'Physical health and training',
          sort_order: 2,
        },
        {
          name: 'Relationships',
          color: '#ec4899',
          icon: '❤️',
          description: 'Friends, family, and networking',
          sort_order: 3,
        },
        {
          name: 'Creative / Learning',
          color: '#8b5cf6',
          icon: '🎨',
          description: 'Skill building and side projects',
          sort_order: 4,
        },
        {
          name: 'Personal / Admin',
          color: '#64748b',
          icon: '🏠',
          description: 'Life maintenance and logistics',
          sort_order: 5,
        },
      ];
      Promise.all(defaults.map((d) => areasApi.create(d))).then(() => {
        areasApi.list().then((data) => setAreas(data.areas || []));
      });
    }
    if (goals.length === 0 && user) {
      const defaultGoal = {
        title: 'Bootstrap → Thailand',
        target_amount: 3000,
        currency: 'GBP',
        category: 'income',
      };
      goalsApi.create(defaultGoal).then(() => {
        goalsApi.list().then((data) => {
          setGoals(data.goals || []);
          if (data.goals?.length) setActiveGoalId(data.goals[0].id);
        });
      });
    }
    if (templates.length === 0 && user) {
      const defaults = [
        {
          name: 'BUIDL Framework',
          icon: '🚀',
          category: 'software',
          description:
            'The core BUIDL framework with all phases and standard folders.',
          config: {
            phases: [
              'BOOTSTRAP',
              'UNLEASH',
              'INNOVATE',
              'DECENTRALIZE',
              'LEARN',
              'SHIP',
            ],
            folders: STANDARD_FOLDERS.map((f) => f.id),
          },
          is_system: true,
        },
        {
          name: 'Software Project',
          icon: '🛠',
          category: 'software',
          description:
            'Code-focused project with planning, dev, and testing phases.',
          config: {
            phases: ['PLANNING', 'DEVELOPMENT', 'TESTING', 'DEPLOYED'],
            folders: [
              'code-modules',
              'project-artifacts',
              'qa',
              'infrastructure',
              'system',
            ],
          },
          is_system: true,
        },
        {
          name: 'Content Project',
          icon: '✍️',
          category: 'creative',
          description: 'Content creation workflow from research to publishing.',
          config: {
            phases: ['RESEARCH', 'DRAFTING', 'REVIEW', 'PUBLISHED'],
            folders: ['content-assets', 'design-assets', 'marketing', 'system'],
          },
          is_system: true,
        },
        {
          name: 'Health & Fitness',
          icon: '💪',
          category: 'health',
          description:
            'Track training, nutrition, goals, and wellness metrics.',
          config: {
            phases: ['ASSESS', 'BUILD', 'MAINTAIN', 'OPTIMIZE'],
            folders: [
              'analytics',
              'project-artifacts',
              'content-assets',
              'system',
            ],
          },
          is_system: true,
        },
        {
          name: 'Blank',
          icon: '📄',
          category: 'custom',
          description: 'A minimal starting point with only core files.',
          config: { phases: [], folders: ['system'] },
          is_system: true,
        },
      ];
      Promise.all(defaults.map((d) => templatesApi.create(d))).then(() => {
        templatesApi.list().then((data) => setTemplates(data.templates || []));
      });
    }
  }, [areas.length, goals.length, templates.length, user]);

  // ── OFFLINE MODE (Phase 2.4) ────────────────────────────────
  // Sync state changes to cache
  useEffect(() => {
    cache.setCollection('projects', projects);
    cache.setCollection('staging', staging);
    cache.setCollection('ideas', ideas);
    cache.setCollection('areas', areas);
    cache.setCollection('goals', goals);
    cache.setCollection('templates', templates);
    cache.setCollection('tags', userTags);
    cache.setCollection('entityTags', entityTags);
  }, [projects, staging, ideas, areas, goals, templates, userTags, entityTags]);

  // Check online status and listen to sync events
  useEffect(() => {
    const checkOnline = async () => {
      const online = await sync.isOnline();
      setIsOnline(online);
      setQueuedWrites(cache.getWriteQueue().length);
    };

    checkOnline();

    // Register sync event listeners
    sync.onStatusChange((status) => {
      setIsOnline(status === 'online');
      showToast(status === 'online' ? '✓ Back online' : '⚠ Offline mode');
    });

    sync.onSyncStart(() => {
      setSyncStatus('syncing');
      showToast('⟳ Syncing changes...');
    });

    sync.onSyncComplete((count) => {
      setSyncStatus(count > 0 ? 'synced' : 'idle');
      setQueuedWrites(0);
      if (count > 0) showToast(`✓ Synced ${count} changes`);
    });

    sync.onSyncError(() => {
      setSyncStatus('error');
      showToast('⚠ Sync failed, will retry');
    });

    // Periodic check every 5 seconds
    const checkInterval = setInterval(checkOnline, 5000);
    return () => clearInterval(checkInterval);
  }, []);

  // ── DERIVED ────────────────────────────────────────────────
  const hub = projects.find((p) => p.id === hubId);
  const focusP = projects.find((p) => p.id === focusId);
  const activeGoal = goals.find(
    (g) => g.id === (activeGoalId || (goals.length ? goals[0].id : null))
  );
  const totalIncome = activeGoal
    ? activeGoal.current_amount
    : projects.reduce((s, p) => s + (p.incomeTarget || 0), 0);
  const atRisk = projects.filter((p) => p.health < 50).length;
  const inReview = staging.filter((s) => s.status === 'in-review').length;
  const hubAllFolders = hub
    ? [...STANDARD_FOLDERS, ...(hub.customFolders || [])]
    : STANDARD_FOLDERS;

  // Phase 5.1: URI lookup map
  const projectsById = projects.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Area health logic
  const areaStats = areas.map((a) => {
    const areaProjects = projects.filter((p) => p.areaId === a.id);
    const health = areaProjects.length
      ? Math.round(
          areaProjects.reduce((s, p) => s + p.health, 0) / areaProjects.length
        )
      : 100;
    return { ...a, health, projectCount: areaProjects.length };
  });

  const [activeAreaFilter, setActiveAreaFilter] = useState(null);
  const filteredProjects = activeAreaFilter
    ? projects.filter((p) => p.areaId === activeAreaFilter)
    : projects;

  // ── SESSION TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (sessionActive) {
      sessionStart.current = new Date();
      timerRef.current = setInterval(() => setSessionSecs((s) => s + 1), 1000);

      const handleBeforeUnload = (e) => {
        // We can't await endSession() here, but we can try to fire a beacon or sync request if we were using a different API pattern.
        // For now, we'll just log that we should save. In a real environment, we'd use navigator.sendBeacon.
        const dur = Math.floor((new Date() - sessionStart.current) / 1000);
        const data = JSON.stringify({
          project_id: focusId,
          duration_s: dur,
          log: '(Auto-saved on tab close)',
          started_at: sessionStart.current?.toISOString(),
          ended_at: new Date().toISOString(),
        });
        // Try beacon if API supported it without complex auth headers,
        // but our API needs Bearer token which beacon doesn't support well.
        // So we just add the standard listener to prompt user.
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(timerRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      clearInterval(timerRef.current);
    }
  }, [sessionActive, focusId]);
  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── SEARCH MODAL SHORTCUT (Phase 3.3) ─────────────────────
  useEffect(() => {
    // Load recent searches from localStorage
    try {
      const saved = localStorage.getItem('brain_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}

    // Cmd+K / Ctrl+K keyboard shortcut
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // ESC to close
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close notification dropdown (Phase 4.4)
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Save recent searches to localStorage
  const addRecentSearch = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      5
    );
    setRecentSearches(updated);
    try {
      localStorage.setItem('brain_recent_searches', JSON.stringify(updated));
    } catch {}
  };

  // ── COMMENTS LOADER — fetch from DB when hub or active file changes ──
  useEffect(() => {
    if (!hubId || !hub?.activeFile) return;
    const filePath = hub.activeFile;
    const commKey = `${hubId}:${filePath}`;
    setCommentsLoading(true);
    commentsApi
      .list(hubId, filePath)
      .then(({ comments: rows }) => {
        const mapped = (rows || []).map((r) => ({
          id: r.id,
          text: r.text,
          date: r.created_at ? r.created_at.toString().slice(0, 10) : '',
          resolved: !!r.resolved,
        }));
        setComments((prev) => ({ ...prev, [commKey]: mapped }));
      })
      .catch(() => {
        /* silently ignore — existing UI still works */
      })
      .finally(() => setCommentsLoading(false));
  }, [hubId, hub?.activeFile]);

  // ── HUB LINKS — reload when hub changes ─────────────────────
  useEffect(() => {
    if (!hubId) return;
    linksApi
      .query('project', hubId)
      .then((d) => setHubLinks(d.links || []))
      .catch(() => {});
  }, [hubId]);

  // ── USER SETTINGS — load once on login ──────────────────────
  useEffect(() => {
    if (!user) return;
    settingsApi
      .get()
      .then((d) => {
        if (d.settings && Object.keys(d.settings).length) {
          setUserSettings((s) => ({ ...s, ...d.settings }));
          setSettingsForm((s) => ({ ...s, ...d.settings }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // ── DAILY CHECKIN — prompt on first visit of day (Phase 2.5) ──
  const currentMode = getMode(userSettings);
  useEffect(() => {
    if (!user) return;
    const checkinBehavior = getBehavior('daily_checkin', currentMode);
    if (checkinBehavior === 'off') return; // silent mode — skip entirely

    const today = new Date().toISOString().split('T')[0];
    const lastSavedDate = checkinLastDate;

    if (today !== lastSavedDate) {
      // First visit of day — load today's checkin or show modal
      const dailyCheckinsApi = async () => {
        try {
          const res = await fetch(
            `/api/data?resource=daily-checkins&date=${today}`,
            {
              headers: { Authorization: `Bearer ${token.get()}` },
            }
          );
          if (!res.ok) throw new Error('Failed to load checkin');
          const data = await res.json();

          if (data.checkin) {
            // Already checked in today
            setTodayCheckin(data.checkin);
            setCheckinLastDate(today);
            localStorage.setItem('lastCheckinDate', today);
          } else if (checkinBehavior === 'mandatory') {
            // Coach mode — show modal automatically
            setShowCheckinModal(true);
          }
          // Assistant mode ('available') — don't auto-show, user clicks to open
        } catch (e) {
          console.error('Checkin load error:', e);
          if (checkinBehavior === 'mandatory') setShowCheckinModal(true);
        }
      };
      dailyCheckinsApi();
    }
    // Load weekly training count + today's outreach + drift check + tasks + seed workflows
    if (user) {
      loadWeeklyTraining();
      if (getBehavior('outreach_enforcement', getMode(userSettings)) !== 'off')
        loadTodayOutreach();
      if (getBehavior('drift_alerts', getMode(userSettings)) !== 'off')
        loadDriftCheck();
      loadTasks();
      // Phase 5.5: Seed system workflows on first run
      seedSystemWorkflows().catch(() => {});
    }
  }, [user?.id]);

  // ── NOTIFICATIONS — load on mount and check triggers periodically (Phase 4.4) ──
  useEffect(() => {
    if (!user) return;
    const notifBehavior = getBehavior('notifications', getMode(userSettings));
    if (notifBehavior === 'none') return; // silent mode — no notifications

    // Initial load
    loadNotifications();

    // Check triggers on mount
    if (notifBehavior === 'all') checkNotificationTriggers();

    // Set up periodic checks (every 5 minutes)
    const interval = setInterval(
      () => {
        loadNotifications();
        if (notifBehavior === 'all') checkNotificationTriggers();
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [user?.id]);

  // ── NAVIGATION — lazy-loads files on first hub open ────────
  const openHub = async (id, file) => {
    const proj = projects.find((p) => p.id === id);
    const targetFile = file || proj?.activeFile || 'PROJECT_OVERVIEW.md';

    setHubId(id);
    setView('hub');
    setHubTab('editor');

    // If files haven't been loaded yet, fetch from API
    if (!proj?.files) {
      setLoadingFiles(true);
      try {
        const res = await projectsApi.get(id);
        const loaded = res.project;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  files: loaded.files || {},
                  customFolders: loaded.customFolders || p.customFolders || [],
                  activeFile: targetFile,
                }
              : p
          )
        );
      } catch (e) {
        showToast('⚠ Failed to load project files');
      } finally {
        setLoadingFiles(false);
      }
    } else {
      // Files already loaded — just switch active file
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, activeFile: targetFile } : p))
      );
      projectsApi.setActiveFile(id, targetFile).catch(() => {});
    }
  };

  // ── FILE OPS — optimistic + persisted ─────────────────────
  const saveFile = useCallback(
    async (projId, path, content) => {
      // Get previous content for undo history
      const prevContent = projects.find((p) => p.id === projId)?.files?.[path];

      // Push to undo history if content changed
      if (prevContent !== undefined && prevContent !== content) {
        fileHistory.push(
          { projectId: projId, filePath: path, content: prevContent },
          'edit'
        );
      }

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projId ? { ...p, files: { ...p.files, [path]: content } } : p
        )
      );
      setSaving(true);
      try {
        await projectsApi.saveFile(projId, path, content);
        showToast('✓ Saved');

        // Phase 5.2: Trigger summary generation in background (fire and forget)
        if (content.length > 100) {
          generateSummaryAsync(projId, path, content);
        }
      } catch (e) {
        showToast('⚠ Save failed — check connection');
      } finally {
        setSaving(false);
      }
    },
    [projects, fileHistory]
  );

  // Phase 5.2: Async summary generation (background)
  const generateSummaryAsync = async (projId, path, content) => {
    try {
      // Check if summary needed
      const { needsUpdate } = await checkSummaryStatus(projId, path, content);
      if (!needsUpdate) return;

      // Only summarize markdown and code files
      const ext = path.split('.').pop();
      if (!['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(ext))
        return;

      // Generate L0 (abstract) and L1 (overview) in parallel
      const [l0Response, l1Response] = await Promise.all([
        aiApi.ask(
          'claude-sonnet-4-6',
          `${L0_PROMPT}\n\n--- FILE CONTENT ---\n${content.slice(0, 3000)}...\n(end of preview)`
        ),
        content.length > 500
          ? aiApi.ask(
              'claude-sonnet-4-6',
              `${L1_PROMPT}\n\n--- FILE CONTENT ---\n${content.slice(0, 8000)}...\n(end of preview)`
            )
          : Promise.resolve(null),
      ]);

      // Store summaries
      await storeSummaries(projId, path, content, {
        l0_abstract: l0Response?.response || '',
        l1_overview: l1Response?.response || '',
      });

      console.log(`[Summary] Generated for ${path}`);
    } catch (e) {
      // Silent fail - summaries are optional
      console.log(`[Summary] Failed for ${path}:`, e.message);
    }
  };

  const handleHubSave = useCallback(
    (path, content) => {
      if (hubId) saveFile(hubId, path, content);
    },
    [hubId, saveFile]
  );

  const createFile = async (projId, folder, name) => {
    if (!name.trim()) return;
    const path = folder ? `${folder}/${name}` : name;
    const ext = name.split('.').pop();
    const def =
      ext === 'md'
        ? `# ${name.replace('.md', '')}\n\n`
        : ext === 'json'
          ? '{}\n'
          : '';
    // Optimistic
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, files: { ...p.files, [path]: def }, activeFile: path }
          : p
      )
    );
    setModal(null);
    setNewFileName('');
    // Persist
    await projectsApi.saveFile(projId, path, def).catch(() => {});
    await projectsApi.setActiveFile(projId, path).catch(() => {});
  };

  const deleteFile = async (projId, path) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const f = { ...p.files };
        delete f[path];
        return {
          ...p,
          files: f,
          activeFile:
            p.activeFile === path ? 'PROJECT_OVERVIEW.md' : p.activeFile,
        };
      })
    );
    await projectsApi.deleteFile(projId, path).catch(() => {});
  };

  // ── METADATA OPS (Roadmap 2.3) ──────────────────────────
  const fetchMetadata = async (projId, filePath) => {
    setLoadingMetadata(true);
    try {
      const res = await fileMetadata.get(projId, filePath);
      setFileMetadata(res.metadata || null);
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
      setFileMetadata(null);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const saveMetadata = async (projId, filePath, data) => {
    try {
      if (fileMetadata?.id) {
        await fileMetadata.update(fileMetadata.id, data);
      } else {
        await fileMetadata.create({
          project_id: projId,
          file_path: filePath,
          ...data,
        });
      }
      // Fetch fresh to sync state
      await fetchMetadata(projId, filePath);
      showToast('✓ Metadata saved');
    } catch (e) {
      console.error('Failed to save metadata:', e);
      showToast('⚠ Metadata save failed');
    }
  };

  // ── AI METADATA SUGGESTIONS (Phase 3.1) ─────────────────
  const requestAiSuggestions = useCallback(async () => {
    if (!hubId || !hub?.activeFile) return;
    const content = hub.files?.[hub.activeFile];
    if (!content) return;

    setLoadingAiSuggestions(true);
    try {
      const project = projects.find((p) => p.id === hubId);
      const res = await aiMetadataApi.suggest(
        hubId,
        hub.activeFile,
        content,
        project?.name,
        project?.phase
      );
      setAiSuggestions(res);
    } catch (e) {
      console.error('AI suggestions failed:', e);
      setAiSuggestions({ error: 'Failed to get suggestions' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  }, [hubId, hub?.activeFile, hub?.files, projects]);

  const acceptAiSuggestion = useCallback(
    (type, value) => {
      showToast(`✓ Applied ${type}: ${value}`);
      // Auto-save after accepting suggestion
      if (type === 'tag') {
        // Tag will be attached via the existing tag system
        const fileEntityId = `${hubId}/${hub.activeFile}`;
        tagsApi
          .attachByName(value, 'file', fileEntityId)
          .then(() => {
            loadEntityTags();
          })
          .catch(() => {});
      }
    },
    [hubId, hub?.activeFile]
  );

  // Auto-request suggestions when file changes (if enabled)
  useEffect(() => {
    if (hubId && hub?.activeFile && userSettings?.aiMetadataAutoSuggest) {
      const timer = setTimeout(() => requestAiSuggestions(), 500);
      return () => clearTimeout(timer);
    }
  }, [
    hubId,
    hub?.activeFile,
    requestAiSuggestions,
    userSettings?.aiMetadataAutoSuggest,
  ]);

  // ── ONBOARDING CHECK (Phase 4.2) ─────────────────────────────
  useEffect(() => {
    // Check if onboarding should be shown
    if (
      user &&
      !onboardingCompleted &&
      projects.length === 0 &&
      templates.length > 0
    ) {
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user, onboardingCompleted, projects.length, templates.length]);

  const addCustomFolder = async (projId, folder) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const cfs = [...(p.customFolders || []), folder];
        const files = { ...p.files, [`${folder.id}/.gitkeep`]: '' };
        const manifest = makeManifest({ ...p, customFolders: cfs });
        files['manifest.json'] = JSON.stringify(manifest, null, 2);
        return { ...p, customFolders: cfs, files };
      })
    );
    setModal(null);
    setCFForm({ id: '', label: '', icon: '📁', desc: '' });
    // Persist folder + gitkeep + manifest
    await projectsApi.addFolder(projId, folder).catch(() => {});
    await projectsApi
      .saveFile(projId, `${folder.id}/.gitkeep`, '')
      .catch(() => {});
  };

  // ── PROJECT CRUD — persisted ───────────────────────────────
  const createProject = async (form) => {
    const id =
      form.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now().toString(36);
    const template = templates.find((t) => t.id === form.templateId);
    const phase = template?.config?.phases?.[0] || form.phase || 'BOOTSTRAP';

    const proj = makeProject(
      id,
      form.name,
      form.emoji,
      phase,
      'active',
      projects.length + 1,
      false,
      form.desc,
      'Run Bootstrap Protocol → define scope with agents',
      [],
      ['new'],
      3,
      new Date().toISOString().slice(0, 7),
      form.incomeTarget || 0,
      ['dev', 'strategy'],
      [],
      template?.config
    );
    proj.areaId = form.areaId || null;
    // Optimistic
    setProjects((prev) => [...prev, proj]);
    setFocusId(id);
    setModal(null);
    setNewProjForm({ name: '', emoji: '📁', phase: 'BOOTSTRAP', desc: '' });
    // Persist — create project then all default files
    try {
      await projectsApi.create(proj);
      for (const [path, content] of Object.entries(proj.files)) {
        await projectsApi.saveFile(id, path, content);
      }
      showToast('✓ Project created');
      setBootstrapWiz(id);
    } catch (e) {
      showToast('⚠ Failed to save project to database');
    }
  };

  // ── ONBOARDING HANDLERS (Phase 4.2) ─────────────────────────
  const handleOnboardingCreateGoal = async (goalData) => {
    try {
      const res = await goalsApi.create(goalData);
      const updated = await goalsApi.list();
      setGoals(updated.goals || []);
      if (res.id) setActiveGoalId(res.id);
      return res;
    } catch (e) {
      console.error('Failed to create goal during onboarding:', e);
      return null;
    }
  };

  const handleOnboardingCreateProject = async ({
    name,
    templateId,
    goalId,
  }) => {
    const id =
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now().toString(36);
    const template = templates.find((t) => t.id === templateId);
    const phase = template?.config?.phases?.[0] || 'BOOTSTRAP';

    const proj = makeProject(
      id,
      name,
      template?.icon || '📁',
      phase,
      'active',
      1,
      false,
      '',
      'Run Bootstrap Protocol → define scope with agents',
      [],
      ['new'],
      3,
      new Date().toISOString().slice(0, 7),
      0,
      [],
      [],
      template?.config
    );
    proj.areaId = null;

    setProjects((prev) => [...prev, proj]);
    setFocusId(id);

    try {
      await projectsApi.create(proj);
      for (const [path, content] of Object.entries(proj.files)) {
        await projectsApi.saveFile(id, path, content);
      }
      showToast('✓ Project created');
      return proj;
    } catch (e) {
      showToast('⚠ Failed to create project');
      return null;
    }
  };

  const completeOnboarding = async (createdProject) => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);

    // Mark onboarding as completed in DB
    try {
      await settingsApi.update({ onboarding_completed: true });
    } catch (e) {
      console.error('Failed to save onboarding completion:', e);
    }

    // Start tour if project was created
    if (createdProject) {
      setTourStep(1);
      openHub(createdProject.id);
    }
  };

  const skipOnboarding = async () => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);
    try {
      await settingsApi.update({ onboarding_completed: true });
    } catch (e) {
      console.error('Failed to save onboarding skip:', e);
    }
  };

  const updateProject = async (projId, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, ...updates, health: calcHealth({ ...p, ...updates }) }
          : p
      )
    );
    await projectsApi.update(projId, updates).catch(() => {});
  };

  const renameProject = async (projId, newName) => {
    let updatedFiles = {};
    setProjects((prev) => {
      const newProjects = prev.map((p) => {
        if (p.id !== projId) return p;
        const files = { ...p.files };
        if (files['PROJECT_OVERVIEW.md'])
          files['PROJECT_OVERVIEW.md'] = files['PROJECT_OVERVIEW.md'].replace(
            /^# .+$/m,
            `# ${newName}`
          );
        const manifest = makeManifest({ ...p, name: newName });
        files['manifest.json'] = JSON.stringify(manifest, null, 2);
        updatedFiles = files; // capture for re-save
        return { ...p, name: newName, files };
      });
      return newProjects;
    });
    setModal(null);
    await projectsApi.update(projId, { name: newName }).catch(() => {});
    // Re-save overview + manifest
    if (updatedFiles['PROJECT_OVERVIEW.md']) {
      await projectsApi
        .saveFile(
          projId,
          'PROJECT_OVERVIEW.md',
          updatedFiles['PROJECT_OVERVIEW.md']
        )
        .catch(() => {});
    }
    if (updatedFiles['manifest.json']) {
      await projectsApi
        .saveFile(projId, 'manifest.json', updatedFiles['manifest.json'])
        .catch(() => {});
    }
  };

  const deleteProject = async (projId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projId));
    setStaging((prev) => prev.filter((s) => s.project !== projId));
    if (hubId === projId) {
      setView('brain');
      setHubId(null);
    }
    if (focusId === projId) {
      const rem = projects.filter((p) => p.id !== projId);
      if (rem.length) setFocusId(rem[0].id);
    }
    setModal(null);
    await projectsApi.delete(projId).catch(() => {});
  };

  const importProject = async (
    method,
    projectId,
    name,
    data,
    overwrite = false
  ) => {
    if (!projectId.match(/^[a-z0-9-]+$/)) {
      setImportError(
        'Invalid project ID: use only lowercase letters, numbers, and hyphens'
      );
      return;
    }
    if (!name.trim()) {
      setImportError('Project name is required');
      return;
    }

    setImportLoading(true);
    setImportError('');

    try {
      const resp = await projectsApi.import(
        method,
        projectId,
        name,
        data,
        importForm.lifeAreaId,
        importForm.templateId,
        overwrite
      );

      // Success: fetch updated projects list and navigate to new project
      const { projects: updated } = await projectsApi.list();
      setProjects(updated.map((p) => ({ ...p, health: calcHealth(p) })));

      showToast(`✓ Project imported: ${resp.filesCreated} files`);
      setShowImportModal(false);
      setImportForm({
        projectId: '',
        name: '',
        lifeAreaId: '',
        templateId: '',
      });
      setImportText('');
      setImportConflict(null);
      setFocusId(projectId);
      openHub(projectId);
    } catch (e) {
      const errMsg = e.message;
      // Check for 409 conflict
      if (errMsg.includes('409') || errMsg.includes('Project exists')) {
        setImportConflict({
          projectId,
          overwrite: () => importProject(method, projectId, name, data, true),
        });
      } else {
        setImportError(errMsg || 'Import failed');
      }
    } finally {
      setImportLoading(false);
    }
  };

  const completeBootstrap = async (projId, brief) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) {
      showToast('⚠ Error: Project not found. Refresh and try again.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newCustomFolders = (brief.customFolders || [])
      .filter(Boolean)
      .map((f) => ({
        id: f.toLowerCase().replace(/\s+/g, '-'),
        label: f,
        icon: '📁',
        desc: 'Custom folder from Bootstrap Brief',
      }));

    // Build the bootstrap files
    const bootstrapFiles = {
      'project-artifacts/BOOTSTRAP_BRIEF.md': `# Bootstrap Brief — ${brief.name || ''}\nGenerated: ${today}\n\n## Problem\n${brief.problem || ''}\n\n## Solution\n${brief.solution || ''}\n\n## Target User\n${brief.targetUser || ''}\n\n## Revenue Model\n${brief.revenueModel || ''}\n\n## MVP Features\n${
        (brief.mvpFeatures || [])
          .filter(Boolean)
          .map((f, i) => `${i + 1}. ${f}`)
          .join('\n') || '- TBD'
      }\n\n## Tech Stack\n${brief.techStack || 'Open'}\n\n## Design Style\n${brief.designStyle || 'Open'}\n\n## Agent Rules\n${brief.agentRules || 'None'}\n`,
      'project-artifacts/STRATEGY_PROMPT.md': `# Strategy Agent — Project Brief\nDate: ${today}\n\nRead project-artifacts/BOOTSTRAP_BRIEF.md then produce:\n1. Scope Validation\n2. Prioritised Feature List\n3. Revenue Rationale\n4. Risk Register\n\nSave output to: project-artifacts/STRATEGY_OUTPUT.md\nUpdate: DEVLOG.md\n`,
      'project-artifacts/DEV_PROMPT.md': `# Dev Agent — Technical Brief\nDate: ${today}\n\nRead BOOTSTRAP_BRIEF.md and STRATEGY_OUTPUT.md then produce:\n1. Tech Stack Decision\n2. Component Architecture\n3. Bolt One-Shot Prompt\n4. Deployment Plan\n\nSave to: code-modules/DEV_BRIEF.md\nUpdate: DEVLOG.md\n`,
      'system/SKILL.md': `# SKILL.md — Project Overrides\nGenerated: ${today}\n\n## Dev\n${brief.techStack ? `- Stack: ${brief.techStack}` : ''}\n\n## Design\n${brief.designStyle ? `- Style: ${brief.designStyle}` : ''}\n\n## Content\n- Tone: ${brief.contentTone || 'Builder-first'}\n\n## Rules\n${brief.agentRules || 'None'}\n`,
      'system/AGENT_ONBOARDING.md': `# Agent Onboarding\nGenerated: ${today}\n\n1. Read manifest.json\n2. Read project-artifacts/BOOTSTRAP_BRIEF.md\n3. Read system/SKILL.md\n4. Read DEVLOG.md\n5. Do your work → save to correct folder → update DEVLOG\n\n## Agent Team\n${(brief.selectedAgents || []).join(', ')}\n`,
    };

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const allCustom = [...(p.customFolders || []), ...newCustomFolders];
        const folderKeeps = {};
        newCustomFolders.forEach((f) => {
          folderKeeps[`${f.id}/.gitkeep`] = '';
        });
        const allFiles = {
          ...(p.files || {}),
          ...bootstrapFiles,
          ...folderKeeps,
        };
        const updated = {
          ...p,
          customFolders: allCustom,
          skills: brief.selectedAgents,
          nextAction:
            'Step 1: Copy STRATEGY_PROMPT.md → paste into Claude → run strategy agent',
          files: allFiles,
        };
        updated.files['manifest.json'] = JSON.stringify(
          makeManifest(updated),
          null,
          2
        );
        updated.files['PROJECT_OVERVIEW.md'] =
          `# ${p.name}\n\n## One-Liner\n${brief.solution || ''}\n\n## Problem\n${brief.problem || ''}\n\n## Agent Team\n${(brief.selectedAgents || []).join(', ')}\n\n## Bootstrap Status\n- [x] Brief written\n- [ ] Strategy Agent run\n- [ ] Dev Agent run\n`;
        return updated;
      })
    );
    setBootstrapWiz(null);
    openHub(projId, 'project-artifacts/BOOTSTRAP_BRIEF.md');

    // Persist everything
    try {
      const proj = projects.find((p) => p.id === projId);
      await projectsApi.update(projId, {
        skills: brief.selectedAgents,
        nextAction: 'Run Strategy Agent',
      });
      for (const [path, content] of Object.entries(bootstrapFiles)) {
        await projectsApi.saveFile(projId, path, content);
      }
      for (const f of newCustomFolders) {
        await projectsApi.addFolder(projId, f);
        await projectsApi.saveFile(projId, `${f.id}/.gitkeep`, '');
      }
      // Add staging reminder
      const s = {
        id: `bs-${Date.now()}`,
        project_id: projId,
        name: 'Bootstrap complete — run Strategy Agent next',
        tag: 'DRAFT_',
        status: 'in-review',
        notes:
          'Copy STRATEGY_PROMPT.md → paste into Claude → save output as STRATEGY_OUTPUT.md',
        added: new Date().toISOString().slice(0, 7),
      };
      const res = await stagingApi.create(s);
      setStaging((prev) => [
        ...prev,
        { ...s, id: res.id || s.id, project: projId },
      ]);
      showToast('✓ Bootstrap files saved');
    } catch (e) {
      showToast('⚠ Bootstrap saved locally — DB sync failed');
    }
  };

  // ── STAGING OPS — persisted ────────────────────────────────
  const addStaging = async (item) => {
    const tmp = {
      ...item,
      id: `tmp-${Date.now()}`,
      status: 'in-review',
      added: new Date().toISOString().slice(0, 7),
    };
    setStaging((prev) => [...prev, tmp]);
    try {
      const res = await stagingApi.create({
        ...item,
        project_id: item.project,
      });
      setStaging((prev) =>
        prev.map((s) => (s.id === tmp.id ? { ...s, id: res.id } : s))
      );
    } catch {
      showToast('⚠ Staging save failed');
    }
  };

  const updateStagingStatus = async (id, status) => {
    setStaging((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await stagingApi.update(id, { status }).catch(() => {});
  };

  // ── PHASE 2.3: Move staging items to folders ───────────────
  const moveToFolder = async (stagingId, folderId) => {
    const item = staging.find((s) => s.id === stagingId);
    if (!item || !hub) return;

    // Optimistic update
    setStaging((prev) =>
      prev.map((s) =>
        s.id === stagingId
          ? {
              ...s,
              folder_path: `${folderId}/${item.name}`,
              filed_at: new Date().toISOString(),
            }
          : s
      )
    );

    try {
      const res = await stagingApi.moveToFolder(stagingId, folderId, item.name);

      // Update files in project — move from staging/ to folder/
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== hubId) return p;
          const files = { ...(p.files || {}) };
          const oldPath = `staging/${item.name}`;
          const newPath = res.folder_path;

          if (files[oldPath]) {
            files[newPath] = files[oldPath];
            delete files[oldPath];
          }
          return { ...p, files };
        })
      );

      showToast(`✓ Filed as ${res.folder_path}`);
    } catch (e) {
      // Revert optimistic update
      setStaging((prev) =>
        prev.map((s) =>
          s.id === stagingId ? { ...s, folder_path: null, filed_at: null } : s
        )
      );
      showToast('⚠ Failed to file item');
    }
  };

  // ── IDEAS OPS — persisted ──────────────────────────────────
  const addIdea = async (title) => {
    if (!title.trim()) return;
    const tmp = {
      id: `tmp-${Date.now()}`,
      title: title.trim(),
      score: 5,
      tags: ['new'],
      added: new Date().toISOString().slice(0, 7),
    };
    setIdeas((prev) => [...prev, tmp]);
    setNewIdea('');
    try {
      const res = await ideasApi.create({
        title: title.trim(),
        score: 5,
        tags: ['new'],
      });
      setIdeas((prev) =>
        prev.map((i) => (i.id === tmp.id ? { ...i, id: res.id } : i))
      );
    } catch {
      showToast('⚠ Idea save failed');
    }
  };

  // ── SESSION END — persisted ────────────────────────────────
  const endSession = async () => {
    const dur = sessionSecs,
      log = sessionLog;
    if (log.trim()) {
      // Save to devlog file
      const entry = `\n## ${new Date().toISOString().slice(0, 10)} — ${fmtTime(dur)}\n\n${log}\n`;
      const proj = projects.find((p) => p.id === focusId);
      if (proj) {
        const current = (proj.files || {})['DEVLOG.md'] || '';
        await saveFile(focusId, 'DEVLOG.md', current + entry);
      }
    }
    // Log session to DB
    await sessionsApi
      .create({
        project_id: focusId,
        duration_s: dur,
        log,
        started_at: sessionStart.current?.toISOString(),
        ended_at: new Date().toISOString(),
      })
      .catch(() => {});
    setSessionOn(false);
    setSessionSecs(0);
    setSessionLog('');
  };

  // ── DAILY CHECKIN (Phase 2.5) ────────────────────────────────
  const saveCheckin = async (checkin) => {
    try {
      const res = await fetch(`/api/data?resource=daily-checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(checkin),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setTodayCheckin(checkin);
      const today = new Date().toISOString().split('T')[0];
      setCheckinLastDate(today);
      localStorage.setItem('lastCheckinDate', today);
      setShowCheckinModal(false);
      showToast('✓ Check-in saved');
    } catch (e) {
      console.error('Checkin save error:', e);
      showToast('⚠ Failed to save check-in');
    }
  };

  // ── TRAINING LOG (Phase 2.6) ─────────────────────────────────
  const loadWeeklyTraining = async () => {
    try {
      const res = await fetch(`/api/data?resource=training-logs&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      setWeeklyTraining({
        count: logs.length,
        minutes: logs.reduce((s, l) => s + (l.duration_minutes || 0), 0),
      });
    } catch (e) {
      console.error('Training load error:', e);
    }
  };

  const saveTraining = async (log) => {
    try {
      const res = await fetch(`/api/data?resource=training-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowTrainingModal(false);
      showToast('🥋 Training logged');
      loadWeeklyTraining();
      // Also update today's checkin training_done if we have a checkin
      if (todayCheckin && !todayCheckin.training_done) {
        const updated = { ...todayCheckin, training_done: 1 };
        fetch(`/api/data?resource=daily-checkins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.get()}`,
          },
          body: JSON.stringify({
            ...updated,
            date: new Date().toISOString().split('T')[0],
          }),
        }).catch(() => {});
        setTodayCheckin(updated);
      }
    } catch (e) {
      console.error('Training save error:', e);
      showToast('⚠ Failed to log training');
    }
  };

  // ── OUTREACH LOG (Phase 2.7) ─────────────────────────────────
  const loadTodayOutreach = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/data?resource=outreach-log&date=${today}`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTodayOutreach(data.logs || []);
      // Also load this week's count
      const wRes = await fetch(`/api/data?resource=outreach-log&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (wRes.ok) {
        const wData = await wRes.json();
        setWeeklyOutreach((wData.logs || []).length);
      }
    } catch (e) {
      console.error('Outreach load error:', e);
    }
  };

  const saveOutreach = async (entry) => {
    try {
      const res = await fetch(`/api/data?resource=outreach-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowOutreachModal(false);
      showToast('📣 Outreach logged');
      loadTodayOutreach();
    } catch (e) {
      console.error('Outreach save error:', e);
      showToast('⚠ Failed to log outreach');
    }
  };

  // ── DRIFT DETECTION (Phase 2.10) ──────────────────────────────
  const loadDriftCheck = async () => {
    try {
      const data = await driftApi.check();
      if (data && data.flags) {
        // Filter out dismissed flags (by type)
        const activeFlags = data.flags.filter(
          (f) => !driftDismissed.includes(f.type)
        );
        setDriftFlags(activeFlags);
      }
    } catch (e) {
      console.error('Drift check error:', e);
    }
  };

  const dismissDriftFlag = (type) => {
    const updated = [...driftDismissed, type];
    setDriftDismissed(updated);
    localStorage.setItem('driftDismissed', JSON.stringify(updated));
    setDriftFlags((prev) => prev.filter((f) => f.type !== type));
  };

  // ── NOTIFICATIONS (Phase 4.4) ─────────────────────────────────
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const data = await notificationsApi.list();
      if (data && data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error('Notifications load error:', e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const checkNotificationTriggers = async () => {
    try {
      await notificationsApi.checkTriggers();
      // Reload to get any new notifications
      await loadNotifications();
    } catch (e) {
      console.error('Notification trigger check error:', e);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  // ── TASKS (Phase 5.4) ───────────────────────────────────────
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
      for (const t of executingTasks) {
        try {
          const result = await agentExecution.status(t.id);
          if (result.status === 'complete' || result.status === 'blocked') {
            setTasks((prev) =>
              prev.map((p) =>
                p.id === t.id
                  ? {
                      ...p,
                      status: result.status,
                      result_summary: result.result_summary,
                    }
                  : p
              )
            );
          }
        } catch {
          /* ignore polling errors */
        }
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

  const markAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsApi.delete(id);
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Delete notification error:', e);
    }
  };

  // ── DRAG & DROP ────────────────────────────────────────────
  const handleDrop = useCallback((e, projId) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach((file) => {
      const SIZE_LIMIT = 5 * 1024 * 1024;
      if (file.size > SIZE_LIMIT) {
        setToast(
          `⚠ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 5MB — may load slowly`
        );
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target.result;
        const path = `staging/${file.name}`;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projId
              ? { ...p, files: { ...(p.files || {}), [path]: content } }
              : p
          )
        );
        const s = {
          name: file.name,
          tag: 'DRAFT_',
          project: projId,
          notes: `Uploaded ${new Date().toISOString().slice(0, 10)}`,
        };
        await addStaging(s);
        await projectsApi.saveFile(projId, path, content).catch(() => {});
      };
      if (
        file.type.startsWith('text') ||
        ['md', 'json', 'js', 'ts', 'py', 'sol', 'txt', 'css', 'html'].some(
          (e) => file.name.endsWith('.' + e)
        )
      )
        reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
  }, []);

  // ── EXPORT (local download — no API change needed) ─────────
  const exportProject = (projId) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    const content = buildZipExport({
      ...proj,
      files: {
        ...(proj.files || {}),
        'manifest.json': JSON.stringify(makeManifest(proj), null, 2),
      },
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.id}-buidl-export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── SEARCH — uses DB full-text search (Phase 3.3 Enhanced) ──
  const runSearch = async (q) => {
    if (!q.trim()) {
      setSearchRes([]);
      return;
    }
    try {
      const { results, grouped } = await searchApi.query(q, searchFilters);
      setSearchRes(results || []);
      addRecentSearch(q);
    } catch {
      // Fallback to in-memory search
      const res = [];
      projects.forEach((p) =>
        Object.entries(p.files || {}).forEach(([path, content]) => {
          if (
            typeof content === 'string' &&
            content.toLowerCase().includes(q.toLowerCase())
          ) {
            const idx = content.toLowerCase().indexOf(q.toLowerCase());
            const excerptStart = Math.max(0, idx - 60);
            const excerptEnd = Math.min(content.length, idx + q.length + 60);
            let excerpt = content.slice(excerptStart, excerptEnd);
            if (excerptStart > 0) excerpt = '...' + excerpt;
            if (excerptEnd < content.length) excerpt = excerpt + '...';
            res.push({
              project_id: p.id,
              project_name: p.name,
              emoji: p.emoji,
              path,
              excerpt,
              query: q,
            });
          }
        })
      );
      setSearchRes(res.slice(0, 15));
    }
  };

  // ── CONTEXT + BRIEFINGS + AI ───────────────────────────────
  const buildCtx = (projId = null) =>
    JSON.stringify(
      {
        agent_context: 'THE BRAIN v6 — Wired Edition',
        generated: new Date().toISOString(),
        operator: {
          name: user?.name || 'Builder',
          email: user?.email,
          goal: user?.goal || 'Bootstrap → Thailand',
          monthly_target: user?.monthly_target || THAILAND_TARGET,
        },
        today_focus: focusId,
        projects: (projId
          ? projects.filter((p) => p.id === projId)
          : projects
        ).map((p) => ({
          id: p.id,
          name: p.name,
          phase: p.phase,
          status: p.status,
          priority: p.priority,
          revenue_ready: p.revenueReady,
          health: p.health,
          momentum: p.momentum,
          next_action: p.nextAction,
          blockers: p.blockers,
          tags: p.tags,
          income_target: p.incomeTarget,
          skills: p.skills,
          staging_pending: staging.filter(
            (s) => s.project === p.id && s.status === 'in-review'
          ).length,
        })),
        global_staging: staging,
        ideas: ideas.map((i) => ({ title: i.title, score: i.score })),
      },
      null,
      2
    );

  const buildBrief = (skillId, projId) => {
    const sk = SKILLS[skillId];
    const proj = projects.find((p) => p.id === projId);
    if (!sk || !proj) return '';
    return `# ${sk.icon} ${sk.label} Briefing — ${proj.emoji} ${proj.name}\n\n## Role\n${sk.description}\n\n## Project\n- **${proj.name}** (${proj.phase}, Priority #${proj.priority})\n- Status: ${proj.status} | Health: ${proj.health}/100\n- Next: ${proj.nextAction}\n- Blockers: ${proj.blockers?.join(', ') || 'None'}\n\n## Prompt Prefix\n> ${sk.prompt_prefix}\n\n## SOP\n${sk.sop.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## Permissions\n✅ ${sk.permissions.join(', ')}\n🚫 ${sk.ignore.join(', ')}\n\n## Context\n\`\`\`json\n${buildCtx(projId)}\n\`\`\``;
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Phase 2.8: system prompt is now built server-side from DB (agent-config.json + real data)
  // Pass system=null for standard questions; skill briefings still pass their own system override
  const askAI = async (prompt, systemOverride = null) => {
    setAiLoad(true);
    setAiOut('');
    try {
      const d = await aiApi.ask(prompt, systemOverride);
      setAiOut(d.content?.map((b) => b.text || '').join('') || 'No response.');
    } catch (e) {
      setAiOut(e.message || 'Connection error.');
    }
    setAiLoad(false);
    setTimeout(
      () => aiRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    );
  };

  // ── INTEGRATIONS (UI only for now) ─────────────────────────
  const [integrations, setIntegrations] = useState([
    {
      id: 'github',
      icon: '🐙',
      label: 'GitHub',
      desc: 'Repo status, last commit',
      connected: false,
      fields: ['repoUrl', 'accessToken'],
      docsUrl: 'https://docs.github.com/en/rest',
    },
    {
      id: 'netlify',
      icon: '🟢',
      label: 'Netlify',
      desc: 'Deploy status, build logs',
      connected: false,
      fields: ['siteId', 'apiToken'],
      docsUrl: 'https://docs.netlify.com/api/get-started/',
    },
    {
      id: 'tidb',
      icon: '🐬',
      label: 'TiDB',
      desc: 'DB connected',
      connected: true,
      fields: [],
      docsUrl: 'https://tidbcloud.com',
    },
    {
      id: 'farcaster',
      icon: '🟣',
      label: 'Farcaster',
      desc: 'Publish build-in-public',
      connected: false,
      fields: ['fid', 'signerUuid'],
      docsUrl: 'https://docs.farcaster.xyz/',
    },
    {
      id: 'twitter',
      icon: '🐦',
      label: 'Twitter/X',
      desc: 'Post launch threads',
      connected: false,
      fields: ['apiKey', 'apiSecret'],
      docsUrl: 'https://developer.twitter.com/en/docs',
    },
    {
      id: 'base',
      icon: '🔵',
      label: 'Base Chain',
      desc: 'Deploy contracts, mint',
      connected: false,
      fields: ['rpcUrl', 'walletAddress'],
      docsUrl: 'https://docs.base.org/',
    },
  ]);

  // ── TAB DEFINITIONS ────────────────────────────────────────
  const BRAIN_TABS_ALL = [
    { id: 'command', label: '⚡ Command' },
    { id: 'projects', label: '🗂 Projects' },
    { id: 'bootstrap', label: '🚀 Bootstrap' },
    {
      id: 'staging',
      label: `🌀 Staging${inReview > 0 ? ` (${inReview})` : ''}`,
    },
    { id: 'skills', label: '🤖 Skills' },
    { id: 'workflows', label: '⚙️ Workflows' },
    { id: 'integrations', label: '🔌 Connect' },
    { id: 'ideas', label: '💡 Ideas' },
    {
      id: 'tags',
      label: `🏷 Tags${userTags.length > 0 ? ` (${userTags.length})` : ''}`,
    },
    { id: 'ai', label: '💬 AI Coach' },
    { id: 'review', label: '📋 Review' },
    { id: 'export', label: '📤 Export' },
  ];
  const BRAIN_TABS =
    getBehavior('ai_coach_tab', currentMode) === 'hidden'
      ? BRAIN_TABS_ALL.filter((t) => t.id !== 'ai')
      : BRAIN_TABS_ALL;
  const HUB_TABS = [
    { id: 'editor', label: '📝 Editor' },
    { id: 'overview', label: '📊 Overview' },
    { id: 'folders', label: '📁 Folders' },
    {
      id: 'review',
      label: `🔄 Review${hub ? (staging.filter((s) => s.project === hubId && s.status === 'in-review').length > 0 ? ` (${staging.filter((s) => s.project === hubId && s.status === 'in-review').length})` : '') : ''}`,
    },
    { id: 'devlog', label: '📓 Dev Log' },
    { id: 'gantt', label: '📅 Timeline' },
    { id: 'comments', label: '💬 Comments' },
    {
      id: 'links',
      label: `🔗 Links${hubLinks.length > 0 ? ` (${hubLinks.length})` : ''}`,
    },
    { id: 'meta', label: '🔧 Meta' },
  ];

  // ── KEYBOARD SHORTCUTS LISTENER ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Show shortcuts modal: ? or Cmd+?
      if (e.key === '?' || (cmdOrCtrl && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Search: Cmd+K
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
        return;
      }

      // Toggle Brain/Hub: Cmd+B
      if (cmdOrCtrl && e.key === 'b') {
        e.preventDefault();
        if (view === 'hub') setView('brain');
        else if (hubId) setView('hub');
        return;
      }

      // Undo: Cmd+Z
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const undone = fileHistory.undo();
        if (undone && undone.state) {
          // Restore the file content
          const { projectId, filePath, content } = undone.state;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? { ...p, files: { ...p.files, [filePath]: content } }
                : p
            )
          );
          // Save to API (silent)
          projectsApi.saveFile(projectId, filePath, content).catch(() => {});
          setUndoToast({ action: 'undone', message: `Undid ${undone.action}` });
          setTimeout(() => setUndoToast(null), 2000);
        }
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if (
        (cmdOrCtrl && e.shiftKey && e.key === 'z') ||
        (cmdOrCtrl && e.key === 'y')
      ) {
        e.preventDefault();
        const redone = fileHistory.redo();
        if (redone && redone.state) {
          const { projectId, filePath, content } = redone.state;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? { ...p, files: { ...p.files, [filePath]: content } }
                : p
            )
          );
          projectsApi.saveFile(projectId, filePath, content).catch(() => {});
          setUndoToast({ action: 'redone', message: `Redid ${redone.action}` });
          setTimeout(() => setUndoToast(null), 2000);
        }
        return;
      }

      // Navigation shortcuts with 'g' prefix
      if (keySequence[0] === 'g') {
        if (e.key === 'c') {
          setTab('brain');
          setBrainTab('command');
        }
        if (e.key === 'p') {
          setTab('brain');
          setBrainTab('projects');
        }
        if (e.key === 's') {
          setTab('brain');
          setBrainTab('staging');
        }
        if (e.key === 'i') {
          setTab('brain');
          setBrainTab('ideas');
        }
        setKeySequence([]);
        return;
      }

      // Start 'g' sequence
      if (e.key === 'g' && !cmdOrCtrl) {
        setKeySequence(['g']);
        setTimeout(() => setKeySequence([]), 1000); // Reset after 1s
        return;
      }

      // New shortcuts with 'n' prefix
      if (keySequence[0] === 'n') {
        if (e.key === 'p') setModal('newProject');
        if (e.key === 'f') setModal('newFile');
        if (e.key === 'i') setNewIdea(''); // Focus idea input
        setKeySequence([]);
        return;
      }

      if (e.key === 'n' && !cmdOrCtrl) {
        setKeySequence(['n']);
        setTimeout(() => setKeySequence([]), 1000);
        return;
      }

      // Session timer: Space (when not in input)
      if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        sessionActive ? endSession() : startSession();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, hubId, keySequence, fileHistory, sessionActive]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div
      style={{
        ...S.root,
        fontFamily: `'${userSettings.font}','JetBrains Mono','Fira Code',monospace`,
        fontSize: userSettings.fontSize,
      }}
    >
      {toast && <Toast msg={toast.msg} onDone={() => setToast(null)} />}

      {/* Undo/Redo Toast */}
      {undoToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            background: C.surface,
            border: `1px solid ${C.blue}40`,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 11,
            color: C.blue2,
            zIndex: 9999,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{undoToast.action === 'undone' ? '↩️' : '↪️'}</span>
          <span>{undoToast.message}</span>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* ── TOP BAR ── */}
      <div
        style={{
          background: 'linear-gradient(180deg,#0a0f1e,#070b14)',
          borderBottom: `1px solid ${C.border}`,
          padding: isMobile ? '10px 12px 0' : '12px 20px 0',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Mobile Header */}
          {isMobile ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              {/* Hamburger Menu */}
              <button
                style={{
                  ...S.btn('ghost'),
                  padding: '8px 10px',
                  fontSize: 18,
                  minWidth: 44,
                  minHeight: 44,
                }}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                ☰
              </button>

              {/* App Title */}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    lineHeight: 1.1,
                  }}
                >
                  {view === 'hub' && hub
                    ? `${hub.emoji} ${hub.name}`
                    : 'THE BRAIN 🧠'}
                </div>
              </div>

              {/* Notification Bell Mobile */}
              <button
                style={{
                  ...S.btn('ghost'),
                  padding: '8px',
                  fontSize: 16,
                  minWidth: 44,
                  minHeight: 44,
                  position: 'relative',
                }}
                onClick={() => setShowNotifications(true)}
                aria-label={`${unreadCount} notifications`}
              >
                🔔
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: C.red,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid ' + C.bg,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Session Timer (condensed) */}
              <div
                onClick={() => {
                  if (!sessionActive) setSessionOn(true);
                  else endSession();
                }}
                style={{
                  background: sessionActive
                    ? 'rgba(16,185,129,0.08)'
                    : C.surface,
                  border: `1px solid ${sessionActive ? '#10b98140' : C.border}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  minWidth: 44,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: sessionActive ? C.green : '#475569',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sessionActive ? fmtTime(sessionSecs) : '▶'}
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Header */
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: C.blue,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Project OS · v6 · {user?.name || user?.email || 'Builder'}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      lineHeight: 1.1,
                    }}
                  >
                    {view === 'hub' && hub
                      ? `${hub.emoji} ${hub.name}`
                      : 'THE BRAIN 🧠'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <button
                    ref={brainTabRef}
                    style={S.btn(view === 'brain' ? 'primary' : 'ghost')}
                    onClick={() => setView('brain')}
                  >
                    🧠 Brain
                  </button>
                  {hub && (
                    <button
                      ref={hubTabRef}
                      style={S.btn(view === 'hub' ? 'primary' : 'ghost')}
                      onClick={() => setView('hub')}
                    >
                      🗂 Hub
                    </button>
                  )}
                  <button
                    style={{ ...S.btn('ghost'), fontSize: 9 }}
                    onClick={() => setModal('new-project')}
                  >
                    + Project
                  </button>
                </div>
                {/* Search - Phase 3.3: New Search Modal with Cmd+K */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    fontSize: 10,
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => setShowSearchModal(true)}
                >
                  <span>🔍</span>
                  <span>Search</span>
                  <span
                    style={{
                      fontSize: 9,
                      color: C.dim,
                      background: C.bg,
                      padding: '2px 5px',
                      borderRadius: 3,
                    }}
                  >
                    ⌘K
                  </span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {/* Keyboard shortcuts */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '5px 8px',
                    fontSize: 14,
                  }}
                  title="Keyboard Shortcuts (?):"
                  onClick={() => setShowShortcutsModal(true)}
                >
                  ⌨️
                </button>
                {/* Settings gear */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '5px 8px',
                    fontSize: 14,
                  }}
                  title="Settings"
                  onClick={() => {
                    setSettingsForm({ ...userSettings });
                    setModal('settings');
                  }}
                >
                  🔧
                </button>
                {/* Session timer */}
                <div
                  ref={sessionTimerRef}
                  onClick={() => {
                    if (!sessionActive) setSessionOn(true);
                    else endSession();
                  }}
                  style={{
                    background: sessionActive
                      ? 'rgba(16,185,129,0.08)'
                      : C.surface,
                    border: `1px solid ${sessionActive ? '#10b98140' : C.border}`,
                    borderRadius: 6,
                    padding: '5px 11px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sessionActive ? C.green : '#475569',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {sessionActive ? fmtTime(sessionSecs) : '▶ START'}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {sessionActive ? 'End & Log' : 'Session'}
                  </div>
                </div>
                {/* Offline Mode Status (Phase 2.4) */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isOnline ? C.green : C.amber,
                    }}
                  >
                    {isOnline ? '✓' : '⚠'}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                    {queuedWrites > 0 && ` (${queuedWrites})`}
                  </div>
                </div>
                {/* Energy Level Status (Phase 2.5) */}
                {todayCheckin && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          todayCheckin.energy_level <= 4
                            ? C.amber
                            : todayCheckin.energy_level <= 7
                              ? C.amber
                              : C.green,
                      }}
                    >
                      {todayCheckin.energy_level <= 4
                        ? '🌙'
                        : todayCheckin.energy_level <= 7
                          ? '🔄'
                          : '⚡'}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      {todayCheckin.energy_level}/10
                    </div>
                  </div>
                )}
                {/* Assistant mode: Check In button when no checkin yet */}
                {!todayCheckin &&
                  getBehavior('daily_checkin', currentMode) === 'available' && (
                    <div
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => setShowCheckinModal(true)}
                      title="Daily check-in"
                    >
                      <div style={{ fontSize: 14 }}>📋</div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.blue,
                          textTransform: 'uppercase',
                        }}
                      >
                        Check In
                      </div>
                    </div>
                  )}
                {/* Training count (Phase 2.6) */}
                <div
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setShowTrainingModal(true)}
                  title="Log training"
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color:
                        weeklyTraining.count >= 3
                          ? C.green
                          : weeklyTraining.count >= 1
                            ? C.amber
                            : C.dim,
                    }}
                  >
                    🥋
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {weeklyTraining.count}/3
                  </div>
                </div>
                {/* Outreach indicator (Phase 2.7) — mode-aware */}
                {shouldShow('outreach_enforcement', currentMode) && (
                  <div
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => setShowOutreachModal(true)}
                    title="Log outreach"
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: todayOutreach.length > 0 ? C.purple : C.dim,
                      }}
                    >
                      📣
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      {todayOutreach.length > 0
                        ? `${todayOutreach.length} today`
                        : 'none'}
                    </div>
                  </div>
                )}
                {/* Notification Bell (Phase 4.4) — mode-aware */}
                {shouldShow('notifications', currentMode) && (
                  <div ref={notificationRef} style={{ position: 'relative' }}>
                    <div
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => setShowNotifications((v) => !v)}
                      title={`${unreadCount} unread notifications`}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: unreadCount > 0 ? C.red : C.dim,
                          position: 'relative',
                        }}
                      >
                        🔔
                        {unreadCount > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -4,
                              right: -4,
                              background: C.red,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              minWidth: 14,
                              height: 14,
                              borderRadius: 7,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px solid ' + C.bg,
                            }}
                          >
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          textTransform: 'uppercase',
                        }}
                      >
                        {unreadCount > 0 ? `${unreadCount} new` : 'Alerts'}
                      </div>
                    </div>

                    {/* Notification Dropdown (Desktop only) */}
                    {!isMobile && showNotifications && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          width: 360,
                          maxHeight: 480,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          zIndex: 400,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            🔔 Notifications
                          </div>
                          {unreadCount > 0 && (
                            <button
                              style={{
                                ...S.btn('ghost'),
                                fontSize: 9,
                                padding: '4px 8px',
                              }}
                              onClick={markAllNotificationsRead}
                            >
                              Mark all read
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                          {notificationsLoading ? (
                            <div
                              style={{
                                padding: 24,
                                textAlign: 'center',
                                color: C.muted,
                                fontSize: 11,
                              }}
                            >
                              Loading...
                            </div>
                          ) : notifications.length === 0 ? (
                            <div
                              style={{
                                padding: 24,
                                textAlign: 'center',
                                color: C.muted,
                                fontSize: 11,
                              }}
                            >
                              No notifications yet
                            </div>
                          ) : (
                            notifications.map((n) => {
                              const typeIcon =
                                {
                                  daily_checkin: '🌅',
                                  training_weekly: '🥋',
                                  project_health: '⚠️',
                                  staging_pending: '📋',
                                  drift_alert: '🚨',
                                }[n.type] || '📢';
                              return (
                                <div
                                  key={n.id}
                                  style={{
                                    padding: '12px 16px',
                                    borderBottom: `1px solid ${C.border}`,
                                    background: n.read
                                      ? 'transparent'
                                      : 'rgba(26,79,214,0.05)',
                                    cursor: n.action_url
                                      ? 'pointer'
                                      : 'default',
                                    opacity: n.read ? 0.7 : 1,
                                  }}
                                  onClick={() => {
                                    if (!n.read) markNotificationRead(n.id);
                                    if (n.action_url) {
                                      // Parse action_url to navigate
                                      if (n.action_url.includes('hub=')) {
                                        const hubId =
                                          n.action_url.match(
                                            /hub=([^&]+)/
                                          )?.[1];
                                        if (hubId) openHub(hubId);
                                      } else if (
                                        n.action_url.includes('action=checkin')
                                      ) {
                                        setShowCheckinModal(true);
                                      } else if (
                                        n.action_url.includes('action=training')
                                      ) {
                                        setShowTrainingModal(true);
                                      }
                                      setShowNotifications(false);
                                    }
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      alignItems: 'flex-start',
                                    }}
                                  >
                                    <span
                                      style={{ fontSize: 14, flexShrink: 0 }}
                                    >
                                      {typeIcon}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 11,
                                          lineHeight: 1.4,
                                          color: C.text,
                                        }}
                                      >
                                        {n.message}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 9,
                                          color: C.dim,
                                          marginTop: 4,
                                        }}
                                      >
                                        {new Date(n.created_at).toLocaleString(
                                          undefined,
                                          {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </div>
                                    </div>
                                    {!n.read && (
                                      <div
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: 4,
                                          background: C.blue,
                                          flexShrink: 0,
                                          marginTop: 4,
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Footer */}
                        <div
                          style={{
                            padding: '10px 16px',
                            borderTop: `1px solid ${C.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 9, color: C.dim }}>
                            {notifications.length} total
                          </span>
                          <button
                            style={{
                              ...S.btn('ghost'),
                              fontSize: 9,
                              padding: '4px 8px',
                            }}
                            onClick={() => {
                              setShowNotifications(false);
                              checkNotificationTriggers();
                            }}
                          >
                            🔄 Check now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {[
                  { v: projects.length, l: 'Projects' },
                  {
                    v: `${activeGoal?.currency === 'USD' ? '$' : activeGoal?.currency === 'EUR' ? '€' : '£'}${totalIncome}`,
                    l: activeGoal?.title || 'Goal',
                  },
                  {
                    v: `${Math.round((totalIncome / (activeGoal?.target_amount || 3000)) * 100)}%`,
                    l: 'Status',
                  },
                  atRisk > 0 ? { v: atRisk, l: '⚠ At Risk', c: C.amber } : null,
                ]
                  .filter(Boolean)
                  .map((s) => (
                    <div key={s.l} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: s.c || C.blue2,
                        }}
                      >
                        {s.v}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.l}
                      </div>
                    </div>
                  ))}
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={onLogout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {sessionActive && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                style={{ ...S.input, fontSize: 11 }}
                placeholder="What are you working on?"
                value={sessionLog}
                onChange={(e) => setSessionLog(e.target.value)}
              />
              <button
                style={{ ...S.btn('danger'), fontSize: 9 }}
                onClick={endSession}
              >
                End & Log
              </button>
            </div>
          )}

          {/* Tabs - scrollable on mobile */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              overflowX: isMobile ? 'auto' : 'visible',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {view === 'brain'
              ? BRAIN_TABS.map((t) => (
                  <button
                    key={t.id}
                    ref={t.id === 'ai' ? aiCoachRef : null}
                    style={{
                      ...S.tab(mainTab === t.id),
                      flexShrink: isMobile ? 0 : 'auto',
                      padding: isMobile ? '10px 16px' : '7px 13px',
                    }}
                    onClick={() => {
                      setMainTab(t.id);
                      if (t.id !== 'command') setActiveAreaFilter(null);
                    }}
                  >
                    {t.label}
                  </button>
                ))
              : HUB_TABS.map((t) => (
                  <button
                    key={t.id}
                    style={{
                      ...S.tab(hubTab === t.id, '#10b981'),
                      flexShrink: isMobile ? 0 : 'auto',
                      padding: isMobile ? '10px 16px' : '7px 13px',
                    }}
                    onClick={() => setHubTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
            {view === 'hub' && hub && !isMobile && (
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  gap: 4,
                  paddingBottom: 4,
                }}
              >
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => setModal('new-custom-folder')}
                >
                  + Folder
                </button>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => {
                    setRenameValue(hub.name);
                    setModal('rename-project');
                  }}
                >
                  ✏ Rename
                </button>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => exportProject(hubId)}
                >
                  ⬇ Export
                </button>
                <button
                  style={{ ...S.btn('danger'), fontSize: 9 }}
                  onClick={() => setModal('delete-project')}
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE NAVIGATION DRAWER ── */}
      {mobileNavOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              background: C.surface,
              borderRight: `1px solid ${C.border}`,
              padding: 16,
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                🧠 The Brain
              </span>
              <button
                style={{ ...S.btn('ghost'), padding: '6px 10px', fontSize: 16 }}
                onClick={() => setMobileNavOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Main Navigation */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.dim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                Navigation
              </div>
              <button
                style={{
                  ...S.btn(view === 'brain' ? 'primary' : 'ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setView('brain');
                  setMobileNavOpen(false);
                }}
              >
                🧠 Brain
              </button>
              {hub && (
                <button
                  style={{
                    ...S.btn(view === 'hub' ? 'primary' : 'ghost'),
                    width: '100%',
                    marginBottom: 8,
                    justifyContent: 'flex-start',
                    minHeight: 44,
                  }}
                  onClick={() => {
                    setView('hub');
                    setMobileNavOpen(false);
                  }}
                >
                  🗂 Hub ({hub.name})
                </button>
              )}
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setModal('new-project');
                  setMobileNavOpen(false);
                }}
              >
                + New Project
              </button>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setShowSearchModal(true);
                  setMobileNavOpen(false);
                }}
              >
                🔍 Search
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.dim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                Status
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: C.blue2 }}
                  >
                    {projects.length}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    Projects
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: C.green }}
                  >
                    {Math.round(
                      (totalIncome / (activeGoal?.target_amount || 3000)) * 100
                    )}
                    %
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    Goal
                  </div>
                </div>
                {atRisk > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, color: C.amber }}
                    >
                      {atRisk}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      At Risk
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            <div>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setSettingsForm({ ...userSettings });
                  setModal('settings');
                  setMobileNavOpen(false);
                }}
              >
                🔧 Settings
              </button>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginTop: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE NOTIFICATIONS DRAWER (Phase 4.4) ── */}
      {isMobile && showNotifications && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          onClick={() => setShowNotifications(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: 360,
              background: C.surface,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                🔔 Notifications
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    style={{
                      ...S.btn('ghost'),
                      fontSize: 9,
                      padding: '6px 10px',
                    }}
                    onClick={markAllNotificationsRead}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '6px 10px',
                    fontSize: 16,
                  }}
                  onClick={() => setShowNotifications(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notificationsLoading ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 12,
                  }}
                >
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 12,
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const typeIcon =
                    {
                      daily_checkin: '🌅',
                      training_weekly: '🥋',
                      project_health: '⚠️',
                      staging_pending: '📋',
                      drift_alert: '🚨',
                    }[n.type] || '📢';
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '16px',
                        borderBottom: `1px solid ${C.border}`,
                        background: n.read
                          ? 'transparent'
                          : 'rgba(26,79,214,0.05)',
                        cursor: n.action_url ? 'pointer' : 'default',
                        opacity: n.read ? 0.7 : 1,
                      }}
                      onClick={() => {
                        if (!n.read) markNotificationRead(n.id);
                        if (n.action_url) {
                          if (n.action_url.includes('hub=')) {
                            const hubId =
                              n.action_url.match(/hub=([^&]+)/)?.[1];
                            if (hubId) openHub(hubId);
                          } else if (n.action_url.includes('action=checkin')) {
                            setShowCheckinModal(true);
                          } else if (n.action_url.includes('action=training')) {
                            setShowTrainingModal(true);
                          }
                          setShowNotifications(false);
                        }
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {typeIcon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: C.text,
                            }}
                          >
                            {n.message}
                          </div>
                          <div
                            style={{ fontSize: 10, color: C.dim, marginTop: 6 }}
                          >
                            {new Date(n.created_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        {!n.read && (
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              background: C.blue,
                              flexShrink: 0,
                              marginTop: 4,
                            }}
                          />
                        )}
                      </div>
                      <button
                        style={{
                          ...S.btn('ghost'),
                          fontSize: 9,
                          padding: '4px 8px',
                          marginTop: 10,
                          opacity: 0.6,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px',
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 10, color: C.dim }}>
                {notifications.length} total
              </span>
              <button
                style={{ ...S.btn('ghost'), fontSize: 10, padding: '8px 12px' }}
                onClick={() => {
                  checkNotificationTriggers();
                }}
              >
                🔄 Check now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {modal === 'new-project' && (
        <Modal title="New Project" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...S.input, width: 60 }}
              placeholder="🚀"
              value={newProjForm.emoji}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, emoji: e.target.value }))
              }
            />
            <input
              style={S.input}
              placeholder="Project name..."
              value={newProjForm.name}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, name: e.target.value }))
              }
              autoFocus
            />
          </div>
          <select
            style={{ ...S.sel, marginBottom: 8 }}
            value={newProjForm.templateId}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, templateId: e.target.value }))
            }
          >
            <option value="">Select Template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
          {(!newProjForm.templateId ||
            templates.find((t) => t.id === newProjForm.templateId)?.config
              ?.phases?.length > 0) && (
            <select
              style={{ ...S.sel, marginBottom: 8 }}
              value={newProjForm.phase}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, phase: e.target.value }))
              }
            >
              {newProjForm.templateId
                ? templates
                    .find((t) => t.id === newProjForm.templateId)
                    .config.phases.map((p) => <option key={p}>{p}</option>)
                : BUIDL_PHASES.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <textarea
            style={{
              ...S.input,
              height: 60,
              resize: 'vertical',
              marginBottom: 8,
            }}
            placeholder="One sentence description..."
            value={newProjForm.desc}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, desc: e.target.value }))
            }
          />
          <select
            style={{ ...S.sel, marginBottom: 12 }}
            value={newProjForm.areaId}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, areaId: e.target.value }))
            }
          >
            <option value="">Assign to Area (Optional)</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                newProjForm.name.trim() && createProject(newProjForm)
              }
            >
              Create + Save to DB
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>

          {/* Onboarding suggestion for new users (Phase 4.2) */}
          {projects.length === 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 9, color: C.muted }}>
                💡 <strong>New here?</strong> Try the{' '}
                <button
                  style={{
                    ...S.btn('ghost'),
                    fontSize: 9,
                    padding: '2px 6px',
                    marginLeft: 4,
                  }}
                  onClick={() => {
                    setModal(null);
                    setShowOnboarding(true);
                  }}
                >
                  onboarding wizard
                </button>{' '}
                for a guided setup.
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === 'new-file' && hub && (
        <Modal title={`New File — ${hub.name}`} onClose={() => setModal(null)}>
          <select
            style={{ ...S.sel, marginBottom: 8 }}
            value={newFileFolder}
            onChange={(e) => setNewFileFolder(e.target.value)}
          >
            <option value="">Root</option>
            {hubAllFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon || '📁'} {f.label}
              </option>
            ))}
          </select>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="filename.md"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && createFile(hubId, newFileFolder, newFileName)
            }
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() => createFile(hubId, newFileFolder, newFileName)}
            >
              Create
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'new-custom-folder' && hub && (
        <Modal title="Add Custom Folder" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...S.input, width: 60 }}
              placeholder="📁"
              value={customFolderForm.icon}
              onChange={(e) =>
                setCFForm((f) => ({ ...f, icon: e.target.value }))
              }
            />
            <input
              style={S.input}
              placeholder="folder-id (no spaces)"
              value={customFolderForm.id}
              onChange={(e) =>
                setCFForm((f) => ({
                  ...f,
                  id: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                }))
              }
              autoFocus
            />
          </div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="Display label"
            value={customFolderForm.label}
            onChange={(e) =>
              setCFForm((f) => ({ ...f, label: e.target.value }))
            }
          />
          <input
            style={{ ...S.input, marginBottom: 12 }}
            placeholder="Description..."
            value={customFolderForm.desc}
            onChange={(e) => setCFForm((f) => ({ ...f, desc: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                customFolderForm.id.trim() &&
                customFolderForm.label.trim() &&
                addCustomFolder(hubId, customFolderForm)
              }
            >
              Add Folder
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'rename-project' && hub && (
        <Modal title={`Rename: ${hub.name}`} onClose={() => setModal(null)}>
          <input
            style={{ ...S.input, marginBottom: 12 }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && renameProject(hubId, renameValue)
            }
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                renameValue.trim() && renameProject(hubId, renameValue)
              }
            >
              Rename
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'delete-project' && hub && (
        <Modal title="Delete Project?" onClose={() => setModal(null)}>
          <div
            style={{
              fontSize: 11,
              color: C.text,
              marginBottom: 16,
              lineHeight: 1.7,
            }}
          >
            Delete <strong>{hub.name}</strong> from the database? This cannot be
            undone. Export first if you want a backup.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={{ ...S.btn('primary'), background: C.red }}
              onClick={() => deleteProject(hubId)}
            >
              Delete from DB
            </button>
            <button
              style={S.btn('ghost')}
              onClick={() => {
                exportProject(hubId);
                setModal(null);
              }}
            >
              Export first
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {bootstrapWizardId && (
        <BootstrapWizard
          project={projects.find((p) => p.id === bootstrapWizardId)}
          onComplete={(brief) => completeBootstrap(bootstrapWizardId, brief)}
          onClose={() => {
            setBootstrapWiz(null);
            openHub(bootstrapWizardId);
          }}
        />
      )}

      {/* ── ONBOARDING WIZARD (Phase 4.2) ─────────────────────── */}
      {showOnboarding && (
        <OnboardingWizard
          user={user}
          templates={templates}
          areas={areas}
          isMobile={isMobile}
          onCreateGoal={handleOnboardingCreateGoal}
          onCreateProject={handleOnboardingCreateProject}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      {/* ── TOUR TOOLTIP (Phase 4.2) ──────────────────────────── */}
      {tourStep > 0 && tourStep <= 4 && (
        <TourTooltip
          step={tourStep}
          totalSteps={4}
          title={
            tourStep === 1
              ? '🧠 Brain — Your Command Centre'
              : tourStep === 2
                ? '🗂 Hub — Project Workspace'
                : tourStep === 3
                  ? '⚡ Session Timer — Track Focus'
                  : '🤖 AI Coach — Get Help'
          }
          content={
            tourStep === 1
              ? "The Brain tab shows your command centre — today's focus, area health, training stats, and goal progress. Switch between different views here."
              : tourStep === 2
                ? 'Each project has a Hub with files, editor, overview, and review pipeline. Create folders, write markdown, and organize your work.'
                : tourStep === 3
                  ? "Click the timer to start a focused work session. When you're done, log what you accomplished — it gets saved to your DEVLOG.md automatically."
                  : 'The AI Coach can help brainstorm, review code, or suggest next steps. It has full context of your project and can generate briefings for your agents.'
          }
          targetRef={
            tourStep === 1
              ? brainTabRef
              : tourStep === 2
                ? hubTabRef
                : tourStep === 3
                  ? sessionTimerRef
                  : aiCoachRef
          }
          onNext={() => {
            if (tourStep === 1) setView('hub');
            if (tourStep === 2 && sessionActive) setTourStep(4);
            else if (tourStep < 4) setTourStep(tourStep + 1);
            else setTourStep(0);
          }}
          onPrev={() => setTourStep(Math.max(1, tourStep - 1))}
          onSkip={() => setTourStep(0)}
          isMobile={isMobile}
        />
      )}

      {modal === 'manage-goals' && (
        <Modal title="Manage Goals" onClose={() => setModal(null)} width={500}>
          <div style={{ marginBottom: 16 }}>
            <span style={S.label()}>Active Goal</span>
            <select
              style={S.sel}
              value={activeGoalId || ''}
              onChange={(e) => setActiveGoalId(e.target.value)}
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.currency})
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 16,
              marginBottom: 16,
            }}
          >
            <span style={S.label()}>Create New Goal</span>
            <input
              style={{ ...S.input, marginBottom: 8 }}
              placeholder="Goal Title (e.g. Save for House)"
              value={newGoalForm.title}
              onChange={(e) =>
                setNewGoalForm({ ...newGoalForm, title: e.target.value })
              }
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                style={S.input}
                type="number"
                placeholder="Target Amount"
                value={newGoalForm.target_amount}
                onChange={(e) =>
                  setNewGoalForm({
                    ...newGoalForm,
                    target_amount: parseInt(e.target.value),
                  })
                }
              />
              <select
                style={S.sel}
                value={newGoalForm.currency}
                onChange={(e) =>
                  setNewGoalForm({ ...newGoalForm, currency: e.target.value })
                }
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <button
              style={S.btn('primary')}
              onClick={async () => {
                if (!newGoalForm.title) return;
                try {
                  const res = await goalsApi.create(newGoalForm);
                  const updated = await goalsApi.list();
                  setGoals(updated.goals || []);
                  if (res.id) setActiveGoalId(res.id);
                  setNewGoalForm({
                    title: '',
                    target_amount: 3000,
                    currency: 'GBP',
                    timeframe: 'monthly',
                    category: 'income',
                  });
                } catch (e) {
                  showToast('Failed to create goal');
                }
              }}
            >
              Create Goal
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <span style={S.label()}>Existing Goals</span>
            {goals.map((g) => (
              <div
                key={g.id}
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 11 }}>
                    {g.title} ({g.currency}
                    {g.current_amount}/{g.target_amount})
                  </div>
                  <button
                    style={{
                      ...S.btn('danger'),
                      padding: '2px 6px',
                      fontSize: 8,
                    }}
                    onClick={async () => {
                      if (!confirm('Delete this goal?')) return;
                      await goalsApi.delete(g.id);
                      const updated = await goalsApi.list();
                      setGoals(updated.goals || []);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <QuickTagRow entityType="goal" entityId={g.id} />
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="⚙ Settings" onClose={() => setModal(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={S.label()}>Font Family</span>
              <select
                style={S.sel}
                value={settingsForm.font}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, font: e.target.value }))
                }
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Courier New">Courier New</option>
                <option value="monospace">System Monospace</option>
              </select>
            </div>
            <div>
              <span style={S.label()}>Font Size</span>
              <select
                style={S.sel}
                value={settingsForm.fontSize}
                onChange={(e) =>
                  setSettingsForm((f) => ({
                    ...f,
                    fontSize: Number(e.target.value),
                  }))
                }
              >
                {[11, 12, 13, 14].map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                padding: '10px 12px',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontFamily: `'${settingsForm.font}',monospace`,
                fontSize: settingsForm.fontSize,
                color: C.muted,
              }}
            >
              Preview: THE BRAIN v6 · Wired Edition · Bootstrap → Thailand
            </div>

            {/* Assistance Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
                Assistance Mode
              </label>
              <select
                value={settingsForm.assistance_mode || 'coach'}
                onChange={(e) =>
                  setSettingsForm((s) => ({
                    ...s,
                    assistance_mode: e.target.value,
                  }))
                }
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 11,
                }}
              >
                {Object.entries(MODE_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 9, color: C.muted, padding: '4px 0' }}>
                {MODE_INFO[settingsForm.assistance_mode || 'coach'].description}
              </div>
            </div>

            {/* AI Provider Settings */}
            <AIProviderSettings />

            {/* Onboarding re-trigger (Phase 4.2) */}
            <div
              style={{
                padding: '12px',
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                🎓 Getting Started
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
                New to The Brain? Run the onboarding wizard again.
              </div>
              <button
                style={{
                  ...S.btn('ghost'),
                  fontSize: 9,
                  borderColor: C.blue,
                  color: C.blue,
                }}
                onClick={() => {
                  setModal(null);
                  setShowOnboarding(true);
                }}
              >
                Restart Onboarding
              </button>
            </div>

            <button
              style={S.btn('primary')}
              onClick={async () => {
                try {
                  await settingsApi.put(settingsForm);
                  setUserSettings({ ...settingsForm });
                  setModal(null);
                  showToast('✓ Settings saved');
                } catch (e) {
                  showToast('Failed to save settings');
                }
              }}
            >
              Save Settings
            </button>
          </div>
        </Modal>
      )}

      {showSyncReview && (
        <SyncReviewModal
          changes={syncChanges}
          conflicts={[]}
          onApprove={(resolutions) => {
            setShowSyncReview(false);
            // Sync would be executed here with approved resolutions
            showToast('✓ Sync approved');
          }}
          onCancel={() => setShowSyncReview(false)}
        />
      )}

      {showCheckinModal && (
        <DailyCheckinModal
          onSave={saveCheckin}
          onDismiss={() => setShowCheckinModal(false)}
          lastCheckin={todayCheckin}
        />
      )}

      {showTrainingModal && (
        <TrainingLogModal
          onSave={saveTraining}
          onDismiss={() => setShowTrainingModal(false)}
        />
      )}

      {showOutreachModal && (
        <OutreachLogModal
          onSave={saveOutreach}
          onDismiss={() => setShowOutreachModal(false)}
          projects={projects}
        />
      )}

      {/* Task Creation Modal (Phase 5.4 + 5.3) */}
      {showTaskModal && (
        <Modal
          title="✓ New Task"
          onClose={() => {
            setShowTaskModal(false);
            setTaskAgents([]);
          }}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 9,
                  color: C.dim,
                  marginBottom: 4,
                  display: 'block',
                }}
              >
                Title *
              </label>
              <input
                style={S.input}
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 9,
                  color: C.dim,
                  marginBottom: 4,
                  display: 'block',
                }}
              >
                Description
              </label>
              <textarea
                style={{ ...S.input, height: 60, resize: 'vertical' }}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Add details, context, or notes..."
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Project
                </label>
                <select
                  style={S.input}
                  value={taskForm.project_id}
                  onChange={async (e) => {
                    const newProjectId = e.target.value;
                    setTaskForm((f) => ({ ...f, project_id: newProjectId }));
                    // Load agents for capability-based routing
                    if (newProjectId) {
                      setTaskLoadingAgents(true);
                      try {
                        const { getAgents } = await import('./agents.js');
                        const agents = await getAgents(newProjectId);
                        setTaskAgents(agents);
                      } catch (err) {
                        console.error('Failed to load agents:', err);
                      } finally {
                        setTaskLoadingAgents(false);
                      }
                    }
                  }}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Priority
                </label>
                <select
                  style={S.input}
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, priority: e.target.value }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee Selection (Phase 5.3) */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <label
                style={{
                  fontSize: 9,
                  color: C.blue2,
                  marginBottom: 8,
                  display: 'block',
                }}
              >
                ASSIGNEE
              </label>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  style={{
                    ...S.btn(
                      taskForm.assignee_type === 'human' ? 'primary' : 'ghost'
                    ),
                    flex: 1,
                  }}
                  onClick={() =>
                    setTaskForm((f) => ({
                      ...f,
                      assignee_type: 'human',
                      assignee_id: 'user',
                    }))
                  }
                >
                  👤 Me (Human)
                </button>
                <button
                  style={{
                    ...S.btn(
                      taskForm.assignee_type === 'agent' ? 'primary' : 'ghost'
                    ),
                    flex: 1,
                  }}
                  onClick={() =>
                    setTaskForm((f) => ({
                      ...f,
                      assignee_type: 'agent',
                      assignee_id: '',
                    }))
                  }
                  disabled={!taskForm.project_id}
                  title={
                    !taskForm.project_id
                      ? 'Select a project first'
                      : 'Assign to AI agent'
                  }
                >
                  🤖 Agent
                </button>
              </div>

              {taskForm.assignee_type === 'agent' && (
                <div>
                  {taskLoadingAgents ? (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      Loading agents...
                    </div>
                  ) : taskAgents.length === 0 ? (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      No agents available. Create agents in Skills tab.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        maxHeight: 150,
                        overflow: 'auto',
                      }}
                    >
                      {taskAgents.map((agent) => {
                        const selected = taskForm.assignee_id === agent.id;
                        return (
                          <div
                            key={agent.id}
                            onClick={() =>
                              setTaskForm((f) => ({
                                ...f,
                                assignee_id: agent.id,
                              }))
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 5,
                              cursor: 'pointer',
                              background: selected
                                ? C.blue + '20'
                                : 'transparent',
                              border: `1px solid ${selected ? C.blue : C.border}`,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>{agent.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.text,
                                  fontWeight: selected ? 600 : 400,
                                }}
                              >
                                {agent.name}
                                {agent.is_system !== false && (
                                  <span
                                    style={{
                                      ...S.badge(C.purple),
                                      marginLeft: 6,
                                      fontSize: 8,
                                    }}
                                  >
                                    SYSTEM
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 8,
                                  color: C.dim,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {agent.capabilities?.slice(0, 3).join(', ')}
                                {agent.capabilities?.length > 3 &&
                                  ` +${agent.capabilities.length - 3} more`}
                              </div>
                            </div>
                            {selected && (
                              <span style={{ color: C.green }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <button
                style={S.btn('ghost')}
                onClick={() => {
                  setShowTaskModal(false);
                  setTaskAgents([]);
                }}
              >
                Cancel
              </button>
              <button
                style={S.btn('primary')}
                disabled={
                  !taskForm.title.trim() ||
                  (taskForm.assignee_type === 'agent' && !taskForm.assignee_id)
                }
                onClick={() => createTask(taskForm)}
              >
                Create Task
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal
          title="📥 Import Project"
          onClose={() => {
            setShowImportModal(false);
            setImportError('');
            setImportConflict(null);
          }}
          width={500}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {importConflict && (
              <div
                style={{
                  background: '#7c2d1280',
                  border: `1px solid ${C.red}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>
                  ⚠ Project "{importConflict.projectId}" already exists
                </div>
                <button
                  style={{ ...S.btn('danger'), fontSize: 9 }}
                  onClick={importConflict.overwrite}
                >
                  Overwrite & Merge Files
                </button>
              </div>
            )}
            {importError && (
              <div
                style={{
                  background: '#7c2d1280',
                  border: `1px solid ${C.red}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 10, color: C.red }}>{importError}</div>
              </div>
            )}

            {/* Method Tabs */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                borderBottom: `1px solid ${C.border}`,
                marginBottom: 12,
              }}
            >
              <button
                style={{
                  ...S.tab(importMethod === 'buidl', C.green),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('buidl')}
              >
                Paste BUIDL
              </button>
              <button
                style={{
                  ...S.tab(importMethod === 'json', C.blue),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('json')}
              >
                JSON Upload
              </button>
              <button
                style={{
                  ...S.tab(importMethod === 'folder', C.blue2),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('folder')}
              >
                Folder
              </button>
            </div>

            {/* BUIDL Method */}
            {importMethod === 'buidl' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <textarea
                  style={{
                    ...S.input,
                    height: 120,
                    resize: 'vertical',
                    fontFamily: C.mono,
                    fontSize: 10,
                  }}
                  placeholder="Paste BUIDL export here (MANIFEST_START...MANIFEST_END, FILES_START...FILES_END)"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>
            )}

            {/* JSON Method */}
            {importMethod === 'json' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ fontSize: 10, color: C.muted }}>
                  Upload a JSON file with:{' '}
                  {'{projectId, name, files: [{path, content}, ...]}'}
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const text = await f.text();
                      try {
                        const json = JSON.parse(text);
                        setImportText(JSON.stringify(json));
                      } catch (err) {
                        setImportError('Invalid JSON file');
                      }
                    }
                  }}
                  style={{ ...S.input, cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Folder Method */}
            {importMethod === 'folder' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ fontSize: 10, color: C.muted }}>
                  Select a local folder to import all files
                </div>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 10 }}
                  onClick={async () => {
                    if (!window.showDirectoryPicker) {
                      setImportError(
                        'Folder import not supported in your browser (Chrome/Chromium only)'
                      );
                      return;
                    }
                    try {
                      const handle = await window.showDirectoryPicker();
                      const skipPatterns = [
                        '.git',
                        'node_modules',
                        '.DS_Store',
                        '__pycache__',
                        '.env',
                      ];
                      const binaryExtensions = [
                        '.png',
                        '.jpg',
                        '.jpeg',
                        '.gif',
                        '.svg',
                        '.pdf',
                        '.bin',
                        '.exe',
                        '.zip',
                      ];
                      const files = [];

                      async function readDir(dirHandle, basePath = '') {
                        const entries = await dirHandle.entries();
                        for await (const [name, entry] of entries) {
                          if (skipPatterns.some((p) => name.includes(p)))
                            continue;
                          const path = basePath ? `${basePath}/${name}` : name;
                          if (entry.kind === 'directory') {
                            await readDir(entry, path);
                          } else if (entry.kind === 'file') {
                            const ext = name
                              .substring(name.lastIndexOf('.'))
                              .toLowerCase();
                            if (binaryExtensions.includes(ext)) continue;
                            try {
                              const file = await entry.getFile();
                              if (file.size > 1024 * 1024) continue;
                              const content = await file.text();
                              files.push({ path, content });
                            } catch (e) {}
                          }
                        }
                      }

                      await readDir(handle);
                      setImportText(JSON.stringify({ files }));
                      setImportForm((f) => ({
                        ...f,
                        projectId: handle.name,
                        name: handle.name,
                      }));
                    } catch (e) {
                      setImportError('Failed to read folder: ' + e.message);
                    }
                  }}
                >
                  📂 Select Folder
                </button>
              </div>
            )}

            {/* Common Fields */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingTop: 12,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div>
                <span style={S.label()}>Project ID</span>
                <input
                  style={S.input}
                  placeholder="unique-project-slug"
                  value={importForm.projectId}
                  onChange={(e) =>
                    setImportForm((f) => ({
                      ...f,
                      projectId: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '-'),
                    }))
                  }
                />
                <div style={{ fontSize: 8, color: C.dim, marginTop: 3 }}>
                  Lowercase, numbers, and hyphens only
                </div>
              </div>
              <div>
                <span style={S.label()}>Project Name</span>
                <input
                  style={S.input}
                  placeholder="My Project"
                  value={importForm.name}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <span style={S.label()}>Life Area (optional)</span>
                <select
                  style={S.sel}
                  value={importForm.lifeAreaId}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, lifeAreaId: e.target.value }))
                  }
                >
                  <option value="">—None—</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={S.label()}>Template (optional)</span>
                <select
                  style={S.sel}
                  value={importForm.templateId}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, templateId: e.target.value }))
                  }
                >
                  <option value="">—Use Imported Config—</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                paddingTop: 12,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <button
                style={S.btn('ghost')}
                onClick={() => {
                  setShowImportModal(false);
                  setImportError('');
                  setImportConflict(null);
                  setImportText('');
                }}
                disabled={importLoading}
              >
                Cancel
              </button>
              <button
                style={{
                  ...S.btn('primary'),
                  opacity:
                    !importForm.projectId ||
                    !importForm.name ||
                    !importText ||
                    importLoading
                      ? 0.6
                      : 1,
                }}
                onClick={async () => {
                  let data = importText;
                  if (importMethod === 'json' || importMethod === 'folder') {
                    try {
                      data = JSON.parse(importText);
                    } catch (e) {
                      setImportError('Invalid data format');
                      return;
                    }
                  }
                  importProject(
                    importMethod,
                    importForm.projectId,
                    importForm.name,
                    data
                  );
                }}
                disabled={
                  importLoading ||
                  !importForm.projectId ||
                  !importForm.name ||
                  !importText
                }
              >
                {importLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── SEARCH MODAL (Phase 3.3) ── */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        projects={projects}
        searchRes={searchRes}
        runSearch={runSearch}
        searchFilters={searchFilters}
        setSearchFilters={setSearchFilters}
        recentSearches={recentSearches}
        openHub={openHub}
      />

      {/* ── BODY ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '12px' : '16px 20px',
        }}
      >
        {/* Mobile: Floating Session Timer */}
        {isMobile && sessionActive && (
          <div
            style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 200 }}
          >
            <div
              onClick={() => endSession()}
              style={{
                background: 'rgba(16,185,129,0.95)',
                border: '1px solid #10b981',
                borderRadius: 50,
                padding: '12px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtTime(sessionSecs)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.8)',
                  textTransform: 'uppercase',
                }}
              >
                ⏹ End
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            HUB VIEW
        ═══════════════════════════════════════════ */}
        {view === 'hub' &&
          hub &&
          (() => {
            // ── LOADING STATE — files not yet fetched ──
            if (!hub.files || loadingFiles) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'calc(100vh - 200px)',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 32 }}>📂</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Loading project files...
                  </div>
                </div>
              );
            }

            const commKey = `${hubId}:${hub.activeFile}`;
            const fileComs = comments[commKey] || [];
            return (
              <div>
                {hubTab === 'editor' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: isMobile ? 0 : 10,
                      height: isMobile
                        ? 'calc(100vh - 140px)'
                        : 'calc(100vh-160px)',
                      minHeight: 500,
                      flexDirection: isMobile ? 'column' : 'row',
                      position: 'relative',
                    }}
                  >
                    {/* Mobile: File tree toggle button */}
                    {isMobile && (
                      <button
                        style={{
                          ...S.btn('ghost'),
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          zIndex: 10,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          padding: '8px 12px',
                          minHeight: 44,
                        }}
                        onClick={() => setMobileFileTreeOpen(true)}
                      >
                        📁 Files
                      </button>
                    )}

                    {/* Desktop: Persistent sidebar / Mobile: Slide-out drawer */}
                    {(!isMobile || mobileFileTreeOpen) && (
                      <>
                        {isMobile && mobileFileTreeOpen && (
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 350 }}
                            onClick={() => setMobileFileTreeOpen(false)}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.7)',
                              }}
                            />
                          </div>
                        )}
                        <div
                          style={{
                            width: isMobile ? 280 : 210,
                            flexShrink: 0,
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            borderRadius: isMobile ? 0 : 8,
                            overflow: 'hidden',
                            position: isMobile ? 'fixed' : 'relative',
                            top: isMobile ? 0 : 'auto',
                            left: isMobile ? 0 : 'auto',
                            bottom: isMobile ? 0 : 'auto',
                            zIndex: isMobile ? 360 : 'auto',
                          }}
                        >
                          {isMobile && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700 }}>
                                📁 Files
                              </span>
                              <button
                                style={{
                                  ...S.btn('ghost'),
                                  padding: '6px 10px',
                                  fontSize: 16,
                                }}
                                onClick={() => setMobileFileTreeOpen(false)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          <div
                            style={{
                              height: isMobile ? 'calc(100% - 50px)' : '100%',
                              overflow: 'auto',
                            }}
                          >
                            <FileTree
                              files={hub.files || {}}
                              activeFile={hub.activeFile}
                              customFolders={hub.customFolders || []}
                              onSelect={(path) => {
                                setProjects((prev) =>
                                  prev.map((p) =>
                                    p.id === hubId
                                      ? { ...p, activeFile: path }
                                      : p
                                  )
                                );
                                projectsApi
                                  .setActiveFile(hubId, path)
                                  .catch(() => {});
                                fetchMetadata(hubId, path);
                                if (isMobile) setMobileFileTreeOpen(false);
                              }}
                              onNewFile={() => setModal('new-file')}
                              onDelete={(path) => deleteFile(hubId, path)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Roadmap 2.3: Editor pane now in flex layout with metadata panel */}
                    <div
                      style={{
                        flex: 1,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: isMobile ? 0 : 8,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        position: 'relative',
                        marginLeft: isMobile ? 0 : 'auto',
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => handleDrop(e, hubId)}
                    >
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        {dragOver && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(26,79,214,0.12)',
                              border: `2px dashed ${C.blue}`,
                              borderRadius: isMobile ? 0 : 8,
                              zIndex: 50,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <span style={{ fontSize: 14, color: C.blue }}>
                              Drop to stage →
                            </span>
                          </div>
                        )}
                        {hub.activeFile && (
                          <div
                            style={{
                              padding: '4px 10px',
                              borderBottom: `1px solid ${C.border}`,
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              background: C.bg,
                              marginTop: isMobile ? 50 : 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 8,
                                color: C.dim,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                flexShrink: 0,
                              }}
                            >
                              tags
                            </span>
                            <QuickTagRow
                              entityType="file"
                              entityId={`${hubId}/${hub.activeFile}`}
                            />
                          </div>
                        )}
                        {(hub.activeFile &&
                          (() => {
                            const fileType = getFileType(hub.activeFile);
                            const content =
                              (hub.files || {})[hub.activeFile] || '';
                            if (fileType === 'image')
                              return (
                                <ImageViewer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (fileType === 'audio')
                              return (
                                <AudioPlayer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (fileType === 'video')
                              return (
                                <VideoPlayer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (
                              fileType === 'binary' ||
                              fileType === 'document' ||
                              fileType === 'archive'
                            )
                              return (
                                <BinaryViewer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            return (
                              <MarkdownEditor
                                path={hub.activeFile}
                                content={content}
                                onChange={() => {}}
                                onSave={handleHubSave}
                                saving={saving}
                                files={hub.files || {}}
                              />
                            );
                          })()) ||
                          null}
                      </div>

                      {/* Metadata panel (right side) - hidden on mobile */}
                      {hub.activeFile && !isMobile && (
                        <MetadataEditor
                          file={hub.activeFile}
                          projectId={hubId}
                          metadata={fileMetadata}
                          onSave={(data) =>
                            saveMetadata(hubId, hub.activeFile, data)
                          }
                          allTags={userTags}
                          aiSuggestions={aiSuggestions}
                          onRequestSuggestions={requestAiSuggestions}
                          loadingSuggestions={loadingAiSuggestions}
                          onAcceptSuggestion={acceptAiSuggestion}
                        />
                      )}
                    </div>
                  </div>
                )}

                {hubTab === 'overview' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 10,
                    }}
                  >
                    <div style={S.card(true)}>
                      <span style={S.label()}>Status</span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {[
                          { l: 'Phase', v: hub.phase },
                          {
                            l: 'Status',
                            v: <BadgeStatus status={hub.status} />,
                          },
                          { l: 'Priority', v: `#${hub.priority}` },
                          { l: 'Health', v: <HealthBar score={hub.health} /> },
                          { l: 'Momentum', v: <Dots n={hub.momentum} /> },
                          {
                            l: 'Income',
                            v: `${activeGoal?.currency === 'USD' ? '$' : activeGoal?.currency === 'EUR' ? '€' : '£'}${hub.incomeTarget || 0}/mo`,
                          },
                        ].map((r) => (
                          <div
                            key={r.l}
                            style={{
                              background: C.bg,
                              border: `1px solid ${C.border}`,
                              borderRadius: 5,
                              padding: '7px 10px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 8,
                                color: C.dim,
                                textTransform: 'uppercase',
                                marginBottom: 3,
                              }}
                            >
                              {r.l}
                            </div>
                            <div style={{ fontSize: 11 }}>{r.v}</div>
                          </div>
                        ))}
                      </div>
                      <span style={S.label()}>Area</span>
                      <div style={{ marginBottom: 10 }}>
                        <select
                          style={S.sel}
                          value={hub.areaId || ''}
                          onChange={(e) =>
                            updateProject(hubId, { areaId: e.target.value })
                          }
                        >
                          <option value="">No Area</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.icon} {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span style={S.label(C.green)}>Next Action</span>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.green,
                          marginBottom: 8,
                        }}
                      >
                        → {hub.nextAction}
                      </div>
                      {hub.blockers?.length > 0 && (
                        <>
                          {hub.blockers.map((b, i) => (
                            <div
                              key={i}
                              style={{ fontSize: 10, color: '#92400e' }}
                            >
                              ⚠ {b}
                            </div>
                          ))}
                        </>
                      )}
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          gap: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          style={{ ...S.btn('success'), fontSize: 9 }}
                          onClick={() => setBootstrapWiz(hubId)}
                        >
                          🚀 Bootstrap Wizard
                        </button>
                        <button
                          style={S.btn('ghost')}
                          onClick={() => exportProject(hubId)}
                        >
                          ⬇ Export
                        </button>
                      </div>
                    </div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>Project Overview</span>
                      <div
                        style={{ fontSize: 11, lineHeight: 1.8 }}
                        dangerouslySetInnerHTML={{
                          __html: renderMd(
                            (hub.files || {})['PROJECT_OVERVIEW.md'] || ''
                          ),
                        }}
                      />
                    </div>
                  </div>
                )}

                {hubTab === 'folders' && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.blue,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        📁 All Folders
                      </span>
                      <button
                        style={S.btn('ghost')}
                        onClick={() => setModal('new-custom-folder')}
                      >
                        + Custom Folder
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? '1fr'
                          : 'repeat(auto-fill,minmax(220px,1fr))',
                        gap: 8,
                      }}
                    >
                      {hubAllFolders.map((f) => {
                        const files = hub.files || {};
                        const count = Object.keys(files).filter(
                          (k) =>
                            k.startsWith(f.id + '/') && !k.endsWith('.gitkeep')
                        ).length;
                        const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
                        return (
                          <div
                            key={f.id}
                            style={{
                              background: C.bg,
                              border: `1px solid ${isCustom ? C.purple : C.border}`,
                              borderRadius: 6,
                              padding: '10px 12px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4,
                              }}
                            >
                              <span style={{ fontSize: 12 }}>
                                {f.icon}{' '}
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#e2e8f0',
                                    fontWeight: 600,
                                  }}
                                >
                                  {f.label}
                                </span>
                              </span>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 4,
                                  alignItems: 'center',
                                }}
                              >
                                {isCustom && (
                                  <span style={S.badge(C.purple)}>custom</span>
                                )}
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: count > 0 ? C.blue2 : C.dim,
                                  }}
                                >
                                  {count}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 9, color: C.muted }}>
                              {f.desc}
                            </div>
                            {count > 0 && (
                              <div style={{ marginTop: 6 }}>
                                {Object.keys(files)
                                  .filter(
                                    (k) =>
                                      k.startsWith(f.id + '/') &&
                                      !k.endsWith('.gitkeep')
                                  )
                                  .map((path) => (
                                    <div
                                      key={path}
                                      onClick={() => {
                                        setProjects((prev) =>
                                          prev.map((p) =>
                                            p.id === hubId
                                              ? { ...p, activeFile: path }
                                              : p
                                          )
                                        );
                                        setHubTab('editor');
                                      }}
                                      style={{
                                        fontSize: 9,
                                        color: C.blue,
                                        cursor: 'pointer',
                                        padding: '1px 0',
                                      }}
                                    >
                                      {path.split('/').pop()}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hubTab === 'review' && (
                  <div>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => handleDrop(e, hubId)}
                      style={{
                        background: dragOver
                          ? 'rgba(26,79,214,0.08)'
                          : C.surface,
                        border: `2px dashed ${dragOver ? C.blue : C.border}`,
                        borderRadius: 8,
                        padding: 16,
                        textAlign: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: C.muted }}>
                        🌀 Drag & drop files to stage them
                      </div>
                    </div>

                    {/* Phase 2.3: Filter toggle for review items */}
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
                          fontSize: 10,
                          color: C.blue,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        📋 Review Items
                      </span>
                      <select
                        style={{ ...S.sel, fontSize: 9 }}
                        value={reviewFilter}
                        onChange={(e) => setReviewFilter(e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="filed">Filed</option>
                        <option value="all">All</option>
                      </select>
                    </div>

                    {(() => {
                      const filtered = staging
                        .filter((s) => s.project === hubId)
                        .filter((s) => {
                          if (reviewFilter === 'pending') return !s.folder_path;
                          if (reviewFilter === 'filed') return !!s.folder_path;
                          return true;
                        });

                      return filtered.length === 0 ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.dim,
                            textAlign: 'center',
                            padding: '24px 0',
                          }}
                        >
                          No {reviewFilter !== 'all' ? reviewFilter + ' ' : ''}
                          items for {hub.name}.
                        </div>
                      ) : (
                        filtered.map((item) => {
                          const sc = REVIEW_STATUSES[item.status];
                          return (
                            <div
                              key={item.id}
                              style={{
                                background: C.bg,
                                border: `1px solid ${sc.color}25`,
                                borderLeft: `3px solid ${sc.color}`,
                                borderRadius: '0 6px 6px 0',
                                padding: '10px 14px',
                                marginBottom: 7,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  marginBottom: 4,
                                  flexWrap: 'wrap',
                                  gap: 5,
                                }}
                              >
                                <span style={{ fontSize: 11 }}>
                                  {item.name}
                                </span>
                                <span style={S.badge(sc.color)}>
                                  {sc.icon} {sc.label}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: C.muted,
                                  marginBottom: 6,
                                }}
                              >
                                {item.notes} · {item.added}
                              </div>

                              {/* Phase 2.3: Show filing status or move interface */}
                              {item.folder_path ? (
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: C.green,
                                    padding: '4px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span>✓ Filed</span>
                                  <span style={{ fontSize: 8, color: C.dim }}>
                                    → {item.folder_path}
                                  </span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 4,
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                  }}
                                >
                                  {item.status === 'approved' && (
                                    <select
                                      style={{
                                        ...S.sel,
                                        flex: 1,
                                        fontSize: 9,
                                        minWidth: '120px',
                                        padding: '4px 6px',
                                      }}
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value)
                                          moveToFolder(item.id, e.target.value);
                                        e.target.value = '';
                                      }}
                                    >
                                      <option value="">
                                        📁 Move to folder...
                                      </option>
                                      {hubAllFolders
                                        .filter((f) => f.id !== 'staging')
                                        .map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.icon} {f.label}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {['approved', 'rejected', 'deferred']
                                      .filter((s) => s !== item.status)
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
                                            padding: '2px 8px',
                                            fontSize: 8,
                                          }}
                                          onClick={() =>
                                            updateStagingStatus(item.id, s)
                                          }
                                        >
                                          {REVIEW_STATUSES[s].icon} {s}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      );
                    })()}
                  </div>
                )}

                {hubTab === 'devlog' && (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <textarea
                        style={{
                          ...S.input,
                          height: 60,
                          resize: 'vertical',
                          flex: 1,
                        }}
                        placeholder="What did you build/learn/decide?"
                        value={sessionLog}
                        onChange={(e) => setSessionLog(e.target.value)}
                      />
                      <button
                        style={{ ...S.btn('success'), alignSelf: 'flex-end' }}
                        onClick={async () => {
                          if (!sessionLog.trim()) return;
                          const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n\n${sessionLog}\n`;
                          const current = (hub.files || {})['DEVLOG.md'] || '';
                          await saveFile(hubId, 'DEVLOG.md', current + entry);
                          setSessionLog('');
                        }}
                      >
                        Log
                      </button>
                    </div>
                    <div
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '14px 18px',
                        maxHeight: 420,
                        overflowY: 'auto',
                        fontSize: 11,
                        lineHeight: 1.8,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMd(
                          (hub.files || {})['DEVLOG.md'] || '*No entries yet.*'
                        ),
                      }}
                    />
                  </div>
                )}

                {hubTab === 'gantt' && (
                  <div style={S.card(false)}>
                    <span style={S.label()}>Timeline</span>
                    <GanttChart
                      tasks={parseTasks((hub.files || {})['TASKS.md'] || '')}
                    />
                    <div
                      style={{
                        marginTop: 14,
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMd(
                          (hub.files || {})['TASKS.md'] || '*No tasks yet.*'
                        ),
                      }}
                    />
                  </div>
                )}

                {hubTab === 'comments' && (
                  <div>
                    <div
                      style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}
                    >
                      On:{' '}
                      <span style={{ color: C.blue }}>{hub.activeFile}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input
                        style={S.input}
                        placeholder="Add comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newComment.trim()) {
                            const tmp = {
                              id: `tmp-${Date.now()}`,
                              text: newComment,
                              date: new Date().toISOString().slice(0, 10),
                              resolved: false,
                            };
                            setComments((prev) => ({
                              ...prev,
                              [commKey]: [...(prev[commKey] || []), tmp],
                            }));
                            setNewComment('');
                            try {
                              const r = await commentsApi.create(
                                hubId,
                                hub.activeFile,
                                newComment
                              );
                              setComments((prev) => ({
                                ...prev,
                                [commKey]: (prev[commKey] || []).map((c) =>
                                  c.id === tmp.id ? { ...c, id: r.id } : c
                                ),
                              }));
                            } catch {}
                          }
                        }}
                      />
                      <button
                        style={S.btn('primary')}
                        onClick={async () => {
                          if (!newComment.trim()) return;
                          const tmp = {
                            id: `tmp-${Date.now()}`,
                            text: newComment,
                            date: new Date().toISOString().slice(0, 10),
                            resolved: false,
                          };
                          setComments((prev) => ({
                            ...prev,
                            [commKey]: [...(prev[commKey] || []), tmp],
                          }));
                          setNewComment('');
                          try {
                            const r = await commentsApi.create(
                              hubId,
                              hub.activeFile,
                              newComment
                            );
                            setComments((prev) => ({
                              ...prev,
                              [commKey]: (prev[commKey] || []).map((c) =>
                                c.id === tmp.id ? { ...c, id: r.id } : c
                              ),
                            }));
                          } catch {}
                        }}
                      >
                        Add
                      </button>
                    </div>
                    {commentsLoading ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dim,
                          textAlign: 'center',
                          padding: '20px 0',
                        }}
                      >
                        Loading comments...
                      </div>
                    ) : fileComs.length === 0 ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dim,
                          textAlign: 'center',
                          padding: '20px 0',
                        }}
                      >
                        No comments yet.
                      </div>
                    ) : (
                      fileComs.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            background: C.bg,
                            border: `1px solid ${c.resolved ? C.border : C.blue + '40'}`,
                            borderRadius: 6,
                            padding: '10px 14px',
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 9, color: C.muted }}>
                              {c.date}
                            </span>
                            <button
                              style={{
                                ...S.btn(c.resolved ? 'ghost' : 'success'),
                                padding: '1px 7px',
                                fontSize: 8,
                              }}
                              onClick={async () => {
                                setComments((prev) => ({
                                  ...prev,
                                  [commKey]: prev[commKey].map((cm) =>
                                    cm.id === c.id
                                      ? { ...cm, resolved: !cm.resolved }
                                      : cm
                                  ),
                                }));
                                await commentsApi
                                  .resolve(c.id, !c.resolved)
                                  .catch(() => {});
                              }}
                            >
                              {c.resolved ? 'Reopen' : '✓ Resolve'}
                            </button>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: c.resolved ? C.muted : C.text,
                              textDecoration: c.resolved
                                ? 'line-through'
                                : 'none',
                            }}
                          >
                            {c.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {hubTab === 'meta' && (
                  <div>
                    {/* Script Runner Section (Phase 3.6) */}
                    <ScriptRunner
                      projectId={hubId}
                      projectFiles={hub?.files || {}}
                    />

                    {/* Health Check Section (Phase 3.5) */}
                    <HealthCheck
                      project={hub}
                      projectFiles={hub?.files || {}}
                      templates={templates}
                      onFix={async (fixes) => {
                        for (const fix of fixes) {
                          if (fix.type === 'create_file') {
                            await handleHubSave(fix.path, fix.content);
                          }
                        }
                        showToast(
                          `✓ Fixed ${fixes.length} issue${fixes.length !== 1 ? 's' : ''}`
                        );
                      }}
                    />

                    {/* Desktop Sync Section */}
                    <FolderSyncSetup
                      projectId={hubId}
                      syncState={syncState}
                      onSyncStateChange={setSyncState}
                      projectFiles={
                        hub?.files
                          ? Object.entries(hub.files).map(
                              ([path, content]) => ({ path, content })
                            )
                          : []
                      }
                    />

                    {/* File Summaries (Phase 5.2) */}
                    <FileSummaryViewer
                      projectId={hubId}
                      projectFiles={hub?.files || {}}
                    />

                    {/* Manifest and Folder Summary */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <div style={S.card(false)}>
                        <span style={S.label()}>
                          manifest.json{' '}
                          <span style={S.badge(C.purple)}>
                            portability contract
                          </span>
                        </span>
                        <pre
                          style={{
                            fontSize: 9,
                            color: C.muted,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 5,
                            padding: 12,
                            overflow: 'auto',
                            maxHeight: 300,
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {(hub.files || {})['manifest.json'] || '{}'}
                        </pre>
                      </div>
                      <div style={S.card(false)}>
                        <span style={S.label()}>Folder Summary</span>
                        {hubAllFolders.map((f) => {
                          const count = Object.keys(hub.files || {}).filter(
                            (k) =>
                              k.startsWith(f.id + '/') &&
                              !k.endsWith('.gitkeep')
                          ).length;
                          const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 9,
                                padding: '3px 0',
                                borderBottom: `1px solid ${C.border}`,
                                color: count > 0 ? C.text : C.dim,
                              }}
                            >
                              <span>
                                {f.icon} {f.label}{' '}
                                {isCustom && (
                                  <span style={{ color: C.purple }}>
                                    ·custom
                                  </span>
                                )}
                              </span>
                              <span
                                style={{ color: count > 0 ? C.blue2 : C.dim }}
                              >
                                {count}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 16 }}>
                          <button
                            style={S.btn('ghost')}
                            onClick={async () => {
                              const manifest = JSON.parse(
                                hub.files['manifest.json'] || '{}'
                              );
                              const template = {
                                name: `${hub.name} Template`,
                                description: `Extracted from project: ${hub.name}`,
                                icon: hub.emoji,
                                config: {
                                  phases: BUIDL_PHASES.includes(hub.phase)
                                    ? BUIDL_PHASES
                                    : [hub.phase],
                                  folders: Object.keys(hub.files)
                                    .map((p) => p.split('/')[0])
                                    .filter(
                                      (f) =>
                                        f &&
                                        f !== '.gitkeep' &&
                                        !f.endsWith('.md') &&
                                        !f.endsWith('.json')
                                    ),
                                },
                              };
                              try {
                                await templatesApi.create(template);
                                showToast('✓ Saved as template');
                                const data = await templatesApi.list();
                                setTemplates(data.templates || []);
                              } catch (e) {
                                showToast('Failed to save template');
                              }
                            }}
                          >
                            Save as Template
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {hubTab === 'links' && (
                  <div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>
                        🔗 Link this project to another entity
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          alignItems: 'flex-end',
                          marginTop: 8,
                        }}
                      >
                        <div>
                          <span style={S.label()}>Type</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.targetType}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                targetType: e.target.value,
                                targetId: '',
                              }))
                            }
                          >
                            <option value="project">Project</option>
                            <option value="idea">Idea</option>
                            <option value="staging">Staging Item</option>
                            <option value="goal">Goal</option>
                          </select>
                        </div>
                        <div>
                          <span style={S.label()}>Entity</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.targetId}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                targetId: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select...</option>
                            {newLinkForm.targetType === 'project' &&
                              projects
                                .filter((p) => p.id !== hubId)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.emoji} {p.name}
                                  </option>
                                ))}
                            {newLinkForm.targetType === 'idea' &&
                              ideas.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.title}
                                </option>
                              ))}
                            {newLinkForm.targetType === 'staging' &&
                              staging.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            {newLinkForm.targetType === 'goal' &&
                              goals.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.title}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <span style={S.label()}>Relationship</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.relationship}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                relationship: e.target.value,
                              }))
                            }
                          >
                            <option value="related">Related</option>
                            <option value="parent">Parent of</option>
                            <option value="child">Child of</option>
                            <option value="supports">Supports</option>
                            <option value="blocks">Blocks</option>
                          </select>
                        </div>
                        <button
                          style={S.btn('primary')}
                          onClick={async () => {
                            if (!newLinkForm.targetId) {
                              showToast('Select an entity first');
                              return;
                            }
                            try {
                              const res = await linksApi.create(
                                'project',
                                hubId,
                                newLinkForm.targetType,
                                newLinkForm.targetId,
                                newLinkForm.relationship
                              );
                              setHubLinks((prev) => [
                                ...prev,
                                {
                                  id: res.id,
                                  source_type: 'project',
                                  source_id: hubId,
                                  target_type: newLinkForm.targetType,
                                  target_id: newLinkForm.targetId,
                                  relationship: newLinkForm.relationship,
                                  created_at: new Date().toISOString(),
                                },
                              ]);
                              setNewLinkForm((f) => ({ ...f, targetId: '' }));
                              showToast('✓ Link created');
                            } catch (e) {
                              showToast('Failed to create link');
                            }
                          }}
                        >
                          Link
                        </button>
                      </div>
                    </div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>
                        Existing Links ({hubLinks.length})
                      </span>
                      {hubLinks.length === 0 ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.dim,
                            padding: '8px 0',
                          }}
                        >
                          No links yet. Link this project to related ideas,
                          goals, or other projects.
                        </div>
                      ) : (
                        hubLinks.map((link) => {
                          const isSource =
                            link.source_type === 'project' &&
                            String(link.source_id) === String(hubId);
                          const otherType = isSource
                            ? link.target_type
                            : link.source_type;
                          const otherId = isSource
                            ? link.target_id
                            : link.source_id;
                          const rel = isSource
                            ? link.relationship
                            : `← ${link.relationship}`;
                          let otherLabel = '';
                          if (otherType === 'project') {
                            const p = projects.find(
                              (p) => String(p.id) === String(otherId)
                            );
                            otherLabel = p ? `${p.emoji} ${p.name}` : otherId;
                          } else if (otherType === 'idea') {
                            const i = ideas.find(
                              (i) => String(i.id) === String(otherId)
                            );
                            otherLabel = i ? `💡 ${i.title}` : otherId;
                          } else if (otherType === 'staging') {
                            const s = staging.find(
                              (s) => String(s.id) === String(otherId)
                            );
                            otherLabel = s ? `🌀 ${s.name}` : otherId;
                          } else if (otherType === 'goal') {
                            const g = goals.find(
                              (g) => String(g.id) === String(otherId)
                            );
                            otherLabel = g ? `🎯 ${g.title}` : otherId;
                          }
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 0',
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 10,
                                }}
                              >
                                <span
                                  style={{
                                    color: C.blue2,
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {rel}
                                </span>
                                <span style={{ color: C.text }}>
                                  {otherLabel || otherId}
                                </span>
                                <span style={S.badge(C.purple)}>
                                  {otherType}
                                </span>
                              </div>
                              <button
                                style={{
                                  ...S.btn('danger'),
                                  padding: '2px 6px',
                                  fontSize: 8,
                                }}
                                onClick={async () => {
                                  await linksApi.delete(link.id);
                                  setHubLinks((prev) =>
                                    prev.filter((l) => l.id !== link.id)
                                  );
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* ═══════════════════════════════════════════
            BRAIN TABS
        ═══════════════════════════════════════════ */}
        {view === 'brain' && (
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
                              color:
                                todayOutreach.length > 0 ? C.purple : C.dim,
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
                        Spin up a new project with agent control baked in from
                        day one. Generates a Bootstrap Brief + ready-to-paste
                        agent prompts, all saved to your database.
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
                      <div style={{ fontSize: 16, marginBottom: 4 }}>
                        {s.icon}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{ fontSize: 9, color: C.dim, fontWeight: 700 }}
                        >
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
                      <div
                        style={{ fontSize: 9, color: C.muted, lineHeight: 1.6 }}
                      >
                        {s.desc}
                      </div>
                    </div>
                  ))}
                </div>
                {projects.map((p) => {
                  const bf = p.files || {};
                  const briefExists =
                    !!bf['project-artifacts/BOOTSTRAP_BRIEF.md'];
                  const stratDone =
                    !!bf['project-artifacts/STRATEGY_OUTPUT.md'];
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
                        p.status === 'active' &&
                        briefExists &&
                        stratDone &&
                        devDone,
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
                      <span style={{ fontSize: 18, flexShrink: 0 }}>
                        {p.emoji}
                      </span>
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
                                pct === 100
                                  ? C.green
                                  : pct > 0
                                    ? C.amber
                                    : C.dim,
                            }}
                          >
                            {pct}% bootstrapped
                          </span>
                        </div>
                        <div
                          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                        >
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
                              openHub(
                                p.id,
                                'project-artifacts/BOOTSTRAP_BRIEF.md'
                              );
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
                              openHub(
                                p.id,
                                'project-artifacts/STRATEGY_PROMPT.md'
                              );
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
                        <div style={{ fontSize: 9, color: C.dim }}>
                          Nothing here.
                        </div>
                      )}
                      {items.map((item) => {
                        const proj = projects.find(
                          (p) => p.id === item.project
                        );
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
                                <span style={{ fontSize: 11 }}>
                                  {item.name}
                                </span>
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
                            <QuickTagRow
                              entityType="staging"
                              entityId={item.id}
                            />
                            <div
                              style={{ display: 'flex', gap: 4, marginTop: 4 }}
                            >
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
                                    onClick={() =>
                                      updateStagingStatus(item.id, s)
                                    }
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
                    <button
                      style={S.btn('primary')}
                      onClick={() => addIdea(newIdea)}
                    >
                      Bank It
                    </button>
                  </div>
                  <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                    Ideas ≠ projects. Bank now. Promote only when P1–P3 have
                    revenue.
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
                      <div style={{ fontSize: 11, color: C.text }}>
                        {idea.title}
                      </div>
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
              <AICoach
                currentMode={currentMode}
                aiIn={aiIn}
                setAiIn={setAiIn}
                aiLoad={aiLoad}
                aiOut={aiOut}
                aiRef={aiRef}
                askAI={askAI}
                renderAIResponse={renderAIResponse}
                projectsById={projectsById}
                uriToNavigation={uriToNavigation}
                openHub={openHub}
                openFile={openFile}
                projects={projects}
                setShowGoalModal={setShowGoalModal}
                S={S}
                C={C}
              />
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
                    <button
                      style={S.btn('primary')}
                      onClick={() => copy(buildCtx())}
                    >
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
                          onClick={() =>
                            copy(buildBrief('strategy', briefProj))
                          }
                        >
                          📋 Strategy Brief
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={S.label()}>
                      Export Projects (local download)
                    </span>
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
                    <div
                      style={{ fontSize: 10, color: C.dim, padding: '8px 0' }}
                    >
                      No tags yet. Tag a project, idea, staging item, goal, or
                      file to get started.
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
                            onClick={() =>
                              setSelectedTagId(isSel ? null : t.id)
                            }
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
        )}

        <div
          style={{
            marginTop: 24,
            fontSize: 8,
            color: '#1e293b',
            textAlign: 'center',
          }}
        >
          THE BRAIN v6 · WIRED EDITION · {user?.email || ''} · BOOTSTRAP →
          THAILAND 🇹🇭
        </div>
      </div>
    </div>
  );
}
