import React from 'react';

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

export { SKILLS, WORKFLOWS, BOOTSTRAP_STEPS };
export default { SKILLS, WORKFLOWS, BOOTSTRAP_STEPS };
