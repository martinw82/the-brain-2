// seed-projects.js
// Run from repo root with: node seed-projects.js
// Seeds Martin's 7 real projects into TiDB for morepiemedia@googlemail.com

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '4000'),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

// ── Find user ─────────────────────────────────────────────
const [users] = await db.execute(
  'SELECT id FROM users WHERE email = ?',
  ['morepiemedia@googlemail.com']
);
if (!users.length) {
  console.error('❌ User not found.');
  process.exit(1);
}
const userId = users[0].id;
console.log(`✅ Found user: ${userId}`);

// ── Check for existing projects ───────────────────────────
const [existing] = await db.execute(
  'SELECT COUNT(*) as count FROM projects WHERE user_id = ?',
  [userId]
);
if (existing[0].count > 0) {
  console.log(`⚠️  Already has ${existing[0].count} project(s). To re-seed, first run:`);
  console.log(`   DELETE FROM project_files WHERE user_id = '${userId}';`);
  console.log(`   DELETE FROM project_custom_folders WHERE user_id = '${userId}';`);
  console.log(`   DELETE FROM projects WHERE user_id = '${userId}';`);
  await db.end();
  process.exit(0);
}

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

// ── Project data ──────────────────────────────────────────
const projects = [
  {
    id: 'startifi',
    name: 'Startifi',
    emoji: '🏗️',
    phase: 'SHIP',
    status: 'stalled',
    priority: 1,
    revenue_ready: 1,
    income_target: 500,
    momentum: 3,
    last_touched: '2025-10',
    description: 'SaaS MVP — nearest to deployment. Pitch refined, coding near complete.',
    next_action: 'Finish remaining screens → deploy to Netlify → 3 beta users',
    blockers: ['Coding unfinished', 'No beta list'],
    tags: ['saas', 'web3', 'mvp'],
    skills: ['dev', 'strategy'],
    health: 38,
    custom_folders: [
      { id: 'pitch-deck', label: 'Pitch Deck', icon: '🎯', desc: 'Investor & partner pitches' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# Startifi\n\n## What is this?\n\n> SaaS MVP — nearest to deployment. Pitch refined, coding near complete.\n\n## Problem\n\nSolo builders need a structured launchpad for SaaS ideas.\n\n## Solution\n\nStartifi: a guided SaaS builder with agent workflows baked in.\n\n## Target User\n\nBootstrap solo founders, 1-person teams.\n\n## Revenue Model\n\n£9/mo SaaS subscription.\n\n## Current Status\n\nCoding near complete. No beta list yet.\n\n## Next Milestone\n\nFinish remaining screens → deploy → 3 beta users\n`,
      'DEVLOG.md': `# Dev Log — Startifi\n\n## 2025-10\n\n- Project initialised\n- Pitch refined\n- Coding in progress\n`,
      'TASKS.md': `# Tasks — Startifi\n\n## In Progress\n- [ ] Finish remaining screens\n\n## Backlog\n- [ ] Deploy to Netlify\n- [ ] Build beta user list\n- [ ] Set up payments\n\n## Done\n- [x] Refine pitch\n`,
    },
  },
  {
    id: 'bob',
    name: 'Bootstrap Bob',
    emoji: '🧫',
    phase: 'UNLEASH',
    status: 'active',
    priority: 2,
    revenue_ready: 0,
    income_target: 0,
    momentum: 4,
    last_touched: '2026-02',
    description: 'AI mascot & brand. WordPress live. 75 design convos, 0 revenue.',
    next_action: 'Freeze design. Write first build-in-public post. Define monetisation.',
    blockers: ['Design loop', 'No content calendar'],
    tags: ['brand', 'buidl', 'content'],
    skills: ['content', 'design', 'strategy'],
    health: 72,
    custom_folders: [
      { id: 'character-refs', label: 'Character Refs', icon: '🧫', desc: 'All Bob design references' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# Bootstrap Bob\n\n## What is this?\n\n> AI mascot & brand for the BUIDL ecosystem.\n\n## Problem\n\nBuilding in public needs a face and a voice.\n\n## Solution\n\nBootstrap Bob — the nearly-kawaii AI mascot who documents the journey.\n\n## Current Status\n\nWordPress live. 75 design convos completed. 0 revenue.\n\n## Next Milestone\n\nFreeze design → first build-in-public post → define monetisation\n`,
      'DEVLOG.md': `# Dev Log — Bootstrap Bob\n\n## 2026-02\n\n- WordPress site live\n- 75 design iterations completed\n- Logo and character locked\n`,
      'TASKS.md': `# Tasks — Bootstrap Bob\n\n## In Progress\n- [ ] Freeze final design\n- [ ] Write first build-in-public post\n\n## Backlog\n- [ ] Define monetisation model\n- [ ] Set up content calendar\n- [ ] Launch on Twitter/X\n\n## Done\n- [x] WordPress site live\n- [x] Character design (75 convos)\n`,
    },
  },
  {
    id: 'buidl',
    name: 'BUIDL Framework',
    emoji: '🔧',
    phase: 'INNOVATE',
    status: 'done',
    priority: 3,
    revenue_ready: 0,
    income_target: 0,
    momentum: 2,
    last_touched: '2026-02',
    description: 'BOOTSTRAP→UNLEASH→INNOVATE→DECENTRALIZE→LEARN. Logo locked.',
    next_action: 'Stop iterating. Ship the BUIDL site.',
    blockers: ['68 convo loop', 'No live site'],
    tags: ['framework'],
    skills: ['dev', 'content', 'strategy'],
    health: 60,
    custom_folders: [],
    files: {
      'PROJECT_OVERVIEW.md': `# BUIDL Framework\n\n## What is this?\n\n> A 5-phase framework for solo builders: BOOTSTRAP→UNLEASH→INNOVATE→DECENTRALIZE→LEARN.\n\n## Current Status\n\nLogo locked. Framework defined. No live site yet.\n\n## Next Milestone\n\nStop iterating. Ship the BUIDL site.\n`,
      'DEVLOG.md': `# Dev Log — BUIDL Framework\n\n## 2026-02\n\n- Logo locked\n- 5-phase framework defined\n- 68 conversation iterations completed\n`,
      'TASKS.md': `# Tasks — BUIDL Framework\n\n## In Progress\n- [ ] Ship the BUIDL site\n\n## Backlog\n- [ ] Write framework documentation\n- [ ] Create phase templates\n\n## Done\n- [x] Define 5 phases\n- [x] Lock logo\n`,
    },
  },
  {
    id: 'memefactory',
    name: 'MemeFactory',
    emoji: '🎭',
    phase: 'SHIP',
    status: 'active',
    priority: 4,
    revenue_ready: 1,
    income_target: 300,
    momentum: 3,
    last_touched: '2025-06',
    description: 'Meme + NFT creation. AI captions, drag-edit, token-gated packs.',
    next_action: 'Cut scope. Set launch date. Deploy to Base.',
    blockers: ['Scope too large', 'No launch date'],
    tags: ['nft', 'web3', 'saas'],
    skills: ['dev', 'design', 'strategy'],
    health: 22,
    custom_folders: [
      { id: 'smart-contracts', label: 'Contracts', icon: '📜', desc: 'Solidity contracts and ABIs' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# MemeFactory\n\n## What is this?\n\n> Meme + NFT creation tool with AI captions, drag-edit, and token-gated packs.\n\n## Revenue Model\n\nToken-gated NFT packs on Base. £300/mo target.\n\n## Current Status\n\nScope too large. No launch date set.\n\n## Next Milestone\n\nCut scope → set launch date → deploy to Base\n`,
      'DEVLOG.md': `# Dev Log — MemeFactory\n\n## 2025-06\n\n- Project scoped\n- AI caption system designed\n- Drag-edit interface planned\n`,
      'TASKS.md': `# Tasks — MemeFactory\n\n## In Progress\n- [ ] Cut MVP scope\n- [ ] Set hard launch date\n\n## Backlog\n- [ ] Deploy contracts to Base\n- [ ] Build drag-edit UI\n- [ ] Token-gate pack system\n\n## Done\n- [x] Initial concept\n`,
    },
  },
  {
    id: 'dankr',
    name: 'Dankr Bot',
    emoji: '🤖',
    phase: 'BOOTSTRAP',
    status: 'paused',
    priority: 5,
    revenue_ready: 0,
    income_target: 0,
    momentum: 1,
    last_touched: '2025-03',
    description: 'Meme coin on Base. Strain NFT system. Phase 2: cannabis AI bot.',
    next_action: 'Decide: relaunch or archive.',
    blockers: ['Phase 1 stalled'],
    tags: ['memecoin', 'nft'],
    skills: ['dev', 'strategy'],
    health: 5,
    custom_folders: [
      { id: 'strain-nfts', label: 'Strain NFTs', icon: '🌿', desc: 'Character designs and traits' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# Dankr Bot\n\n## What is this?\n\n> Meme coin on Base with Strain NFT system. Phase 2: cannabis AI bot.\n\n## Current Status\n\nPhase 1 stalled. Decision needed: relaunch or archive.\n\n## Next Milestone\n\nDecide: relaunch or archive.\n`,
      'DEVLOG.md': `# Dev Log — Dankr Bot\n\n## 2025-03\n\n- Phase 1 launched\n- Stalled — low traction\n`,
      'TASKS.md': `# Tasks — Dankr Bot\n\n## In Progress\n- [ ] Decision: relaunch or archive\n\n## Backlog\n- [ ] Phase 2 cannabis AI bot (if relaunching)\n\n## Done\n- [x] Phase 1 launch\n`,
    },
  },
  {
    id: 'poopie',
    name: 'Poopie Health',
    emoji: '💩',
    phase: 'BOOTSTRAP',
    status: 'active',
    priority: 6,
    revenue_ready: 0,
    income_target: 200,
    momentum: 2,
    last_touched: '2025-06',
    description: 'AI gut tracker. Wellness characters. App Store potential.',
    next_action: 'Non-crypto MVP brief. Assign build slot.',
    blockers: ['No build timeline'],
    tags: ['health', 'ai', 'app'],
    skills: ['dev', 'design', 'content'],
    health: 22,
    custom_folders: [
      { id: 'health-data', label: 'Health Data', icon: '📊', desc: 'Gut biome research & data models' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# Poopie Health\n\n## What is this?\n\n> AI gut health tracker with wellness characters. App Store potential.\n\n## Revenue Model\n\nFreemium app. £200/mo target.\n\n## Current Status\n\nNo build timeline. Concept validated.\n\n## Next Milestone\n\nWrite non-crypto MVP brief → assign build slot\n`,
      'DEVLOG.md': `# Dev Log — Poopie Health\n\n## 2025-06\n\n- Concept defined\n- Wellness characters designed\n- App Store research done\n`,
      'TASKS.md': `# Tasks — Poopie Health\n\n## In Progress\n- [ ] Write MVP brief\n- [ ] Assign build slot\n\n## Backlog\n- [ ] Build tracker UI\n- [ ] AI integration\n- [ ] App Store submission\n\n## Done\n- [x] Concept validation\n`,
    },
  },
  {
    id: 'sauce',
    name: 'Secret Sauce',
    emoji: '🍯',
    phase: 'BOOTSTRAP',
    status: 'idea',
    priority: 7,
    revenue_ready: 0,
    income_target: 100,
    momentum: 1,
    last_touched: '2025-06',
    description: 'Recipe vault + Momma Marinade AI. Shopify integration.',
    next_action: 'Web-first MVP. One sauce. One Shopify sale.',
    blockers: ['No MVP'],
    tags: ['ecommerce', 'ai', 'food'],
    skills: ['dev', 'content', 'design'],
    health: 5,
    custom_folders: [
      { id: 'recipes', label: 'Recipes', icon: '🍴', desc: 'Recipe vault content' },
    ],
    files: {
      'PROJECT_OVERVIEW.md': `# Secret Sauce\n\n## What is this?\n\n> Recipe vault + Momma Marinade AI with Shopify integration.\n\n## Revenue Model\n\nShopify product sales. £100/mo target.\n\n## Current Status\n\nIdea stage. No MVP yet.\n\n## Next Milestone\n\nWeb-first MVP → one sauce → one Shopify sale\n`,
      'DEVLOG.md': `# Dev Log — Secret Sauce\n\n## 2025-06\n\n- Concept defined\n- Shopify integration planned\n`,
      'TASKS.md': `# Tasks — Secret Sauce\n\n## In Progress\n- [ ] Define web-first MVP\n\n## Backlog\n- [ ] Build recipe vault\n- [ ] Momma Marinade AI\n- [ ] Shopify integration\n- [ ] First sale\n\n## Done\n- [x] Concept\n`,
    },
  },
];

// ── Seed ──────────────────────────────────────────────────
console.log(`\n🌱 Seeding ${projects.length} projects...\n`);

for (const p of projects) {
  // 1. Insert project row
  await db.execute(`
    INSERT INTO projects (
      id, user_id, name, emoji, phase, status, priority,
      revenue_ready, income_target, momentum, last_touched,
      description, next_action, blockers, tags, skills,
      integrations, health, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    p.id, userId, p.name, p.emoji, p.phase, p.status, p.priority,
    p.revenue_ready, p.income_target, p.momentum, p.last_touched,
    p.description, p.next_action,
    JSON.stringify(p.blockers),
    JSON.stringify(p.tags),
    JSON.stringify(p.skills),
    JSON.stringify({}),
    p.health, now, now,
  ]);

  // 2. Insert files
  for (const [path, content] of Object.entries(p.files)) {
    await db.execute(`
      INSERT INTO project_files (project_id, user_id, path, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [p.id, userId, path, content, now, now]);
  }

  // 3. Insert custom folders
  for (let i = 0; i < p.custom_folders.length; i++) {
    const f = p.custom_folders[i];
    await db.execute(`
      INSERT INTO project_custom_folders (project_id, user_id, folder_id, label, icon, description, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [p.id, userId, f.id, f.label, f.icon, f.desc, i]);
  }

  console.log(`  ✅ ${p.emoji}  ${p.name} — ${Object.keys(p.files).length} files, ${p.custom_folders.length} custom folders`);
}

console.log(`\n🎉 Done! All ${projects.length} projects seeded.\n`);
await db.end();
