// ── CONSTANTS ─────────────────────────────────────────────────
// Extracted from TheBrain.jsx

export const BUIDL_VERSION = '1.0';

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

export const THAILAND_TARGET = 3000;

export const BUIDL_PHASES = [
  'BOOTSTRAP',
  'UNLEASH',
  'INNOVATE',
  'DECENTRALIZE',
  'LEARN',
  'SHIP',
];

export const STANDARD_FOLDERS = [
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

export const STANDARD_FOLDER_IDS = new Set(STANDARD_FOLDERS.map((f) => f.id));

export const ITEM_TAGS = [
  'IDEA_',
  'SKETCH_',
  'RND_',
  'REWRITE_',
  'PROMPT_',
  'FINAL_',
  'DRAFT_',
  'CODE_',
];

export const REVIEW_STATUSES = {
  'in-review': { label: 'IN REVIEW', color: '#f59e0b', icon: '🔄' },
  approved: { label: 'APPROVED', color: '#10b981', icon: '✅' },
  rejected: { label: 'REJECTED', color: '#ef4444', icon: '❌' },
  deferred: { label: 'DEFERRED', color: '#6366f1', icon: '⏳' },
};

export const C = {
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

export const S = {
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

export const STATUS_MAP = {
  active: { l: 'ACTIVE', c: C.green },
  stalled: { l: 'STALLED', c: C.amber },
  paused: { l: 'PAUSED', c: C.purple },
  done: { l: 'DONE', c: C.blue2 },
  idea: { l: 'IDEA', c: '#94a3b8' },
};
