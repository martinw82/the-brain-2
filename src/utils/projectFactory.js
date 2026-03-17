// ── MANIFEST + PROJECT FACTORY ────────────────────────────────
// Extracted from TheBrain.jsx

import { BUIDL_VERSION, STANDARD_FOLDERS } from './constants.js';

export const makeManifest = (p) => ({
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

export const calcHealth = (p) => {
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

export const makeDefaultFiles = (name, templateConfig = null) => {
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

export const makeProject = (
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
