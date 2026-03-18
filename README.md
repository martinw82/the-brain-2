# The Brain — Personal Operating System v2.0

**Agent Orchestration Platform with Adaptive Coaching**

**Status:** v2.0 COMPLETE ✅
**Live URL:** the-brain-2.vercel.app
**Last Updated:** 2026-03-18

---

## What The Brain Is

The Brain is a **personal operating system** that helps users organize their lives through:

- **Project Management** — Phases, health scores, momentum tracking, templates
- **Life Areas** — Health, business, relationships, creative, personal with health scoring
- **Goal Tracking** — Configurable financial/personal goals with contributions
- **AI Coaching** — Multi-provider AI (Anthropic, Moonshot, DeepSeek, Mistral, OpenAI) with state-based routing
- **Daily Tracking** — Check-ins, training logs, outreach enforcement, weekly reviews
- **Agent Orchestration** — Task delegation, workflow execution, file-based agents

### Three Assistance Modes (v2.0)

| Mode          | For             | Behavior                                                   |
| ------------- | --------------- | ---------------------------------------------------------- |
| **Coach**     | Building habits | Mandatory check-ins, drift alerts, proactive task creation |
| **Assistant** | In flow         | Available on-demand, auto-assigns with preview             |
| **Silent**    | Power users     | Manual only, minimal AI, preview mode for agents           |

---

## Tech Stack

| Layer    | Technology                                                         |
| -------- | ------------------------------------------------------------------ |
| Frontend | React 18 + Vite, modular architecture (orchestrator + 30+ modules) |
| Styling  | Inline dark monospace UI                                           |
| API      | Vercel serverless functions                                        |
| Database | TiDB Cloud Serverless (32 tables)                                  |
| Auth     | JWT + bcrypt                                                       |
| AI       | Multi-provider proxy                                               |
| Testing  | Jest + React Testing Library (175+ tests)                          |

---

## Frontend Architecture

The frontend was refactored from a single 14,237-line file into a modular architecture:

```
src/
├── TheBrain.jsx              # Orchestrator (3,962 lines) — state, hooks wiring, top-bar + nav JSX
│
├── hooks/                    # Domain logic hooks (11 hooks)
│   ├── useProjectCrud.js     # Project CRUD, file ops, onboarding, bootstrap (677 lines)
│   ├── useStagingOps.js      # Staging pipeline (82 lines)
│   ├── useSessionOps.js      # Ideas, sessions, checkins, training, outreach (191 lines)
│   ├── useNotifications.js   # Notification CRUD (77 lines)
│   ├── useTaskOps.js         # Task management + agent polling (109 lines)
│   ├── useAI.js              # Search, AI coach, context builder (148 lines)
│   ├── useTagOps.jsx         # Tag CRUD + QuickTagRow component (166 lines)
│   ├── useMetadata.js        # File metadata + AI suggestions (113 lines)
│   ├── useDataSync.js        # Seed defaults, cache sync, online status (218 lines)
│   ├── useUndoRedo.js        # Undo/redo history
│   ├── useBreakpoint.js      # Responsive breakpoints
│   └── index.js              # Barrel file
│
├── components/
│   ├── panels/
│   │   ├── HubEditorPanel.jsx    # All hub tab content (1,480 lines)
│   │   └── BrainTabsPanel.jsx    # All brain tab content (2,150 lines)
│   ├── Modals/
│   │   ├── KeyboardShortcutsModal.jsx
│   │   ├── AIProviderSettings.jsx
│   │   ├── MetadataEditor.jsx
│   │   └── SearchModal.jsx
│   ├── viewers/
│   │   ├── ImageViewer.jsx
│   │   ├── AudioPlayer.jsx
│   │   ├── VideoPlayer.jsx
│   │   └── BinaryViewer.jsx
│   ├── UI/
│   │   └── SmallComponents.jsx   # AreaPill, TagPill, Dots, HealthBar, Modal, Toast
│   ├── AgentManager.jsx          # Agent registry UI (916 lines)
│   ├── WorkflowRunner.jsx        # Workflow execution UI (687 lines)
│   ├── OnboardingWizard.jsx      # 4-step onboarding (632 lines)
│   ├── GitHubIntegration.jsx     # GitHub PAT integration (561 lines)
│   ├── BootstrapWizard.jsx       # Project bootstrap (480 lines)
│   ├── SkillsWorkflows.jsx       # SKILLS, WORKFLOWS, BOOTSTRAP_STEPS constants
│   └── ... (20+ more components)
│
├── utils/
│   ├── constants.js          # C (colors), S (styles), BREAKPOINTS, STANDARD_FOLDERS, etc.
│   ├── projectFactory.js     # makeManifest, calcHealth, makeDefaultFiles, makeProject
│   ├── fileHandlers.js       # getFileType, formatFileSize, buildZipExport
│   ├── renderers.js          # renderMd, parseTasks
│   └── index.js              # Barrel file
│
├── api.js                    # Client API wrapper (all backend endpoints)
├── agents.js                 # Agent registry service (loadAgents, selectAgent, etc.)
├── workflows.js              # Workflow execution engine
├── modeHelper.js             # Mode-aware behavior (getMode, getBehavior, shouldShow)
├── uri.js                    # brain:// URI parser/generator
├── summaries.js              # L0/L1 summary utilities
├── retrieval.js              # Recursive directory retrieval
├── memory.js                 # Memory management module
├── cache.js                  # localStorage cache for offline mode
├── sync.js                   # Online/offline sync engine
├── desktop-sync.js           # File System Access API sync
├── communityWorkflows.js     # Community workflow client
├── integrations.js           # External integration client
├── workflowLearning.js       # Workflow pattern analysis
├── App.jsx                   # Auth gate wrapper
├── AuthScreen.jsx            # Login/register UI
└── main.jsx                  # Vite entry point
```

### Hook Pattern

All hooks accept a single `deps` object and return operations:

```javascript
const { openHub, saveFile, createProject, ... } = useProjectCrud({
  projects, setProjects, hubId, setHubId, showToast, ...
});
```

### Panel Pattern

Panel components receive a single `ctx` prop containing all needed state and callbacks:

```javascript
<HubEditorPanel ctx={{ hub, hubId, hubTab, saveFile, createFile, ... }} />
<BrainTabsPanel ctx={{ projects, staging, ideas, createProject, ... }} />
```

---

## Quick Start for Developers / AI Agents

### Finding Code

| To find...                                           | Look in...                                  |
| ---------------------------------------------------- | ------------------------------------------- |
| State declarations                                   | `src/TheBrain.jsx` lines 1-320              |
| Hook wiring                                          | `src/TheBrain.jsx` lines 320-1100           |
| Top bar / nav JSX                                    | `src/TheBrain.jsx` lines 1100-3962          |
| Project CRUD logic                                   | `src/hooks/useProjectCrud.js`               |
| Staging operations                                   | `src/hooks/useStagingOps.js`                |
| Session/checkin/training                             | `src/hooks/useSessionOps.js`                |
| Notification logic                                   | `src/hooks/useNotifications.js`             |
| Task management                                      | `src/hooks/useTaskOps.js`                   |
| AI/search logic                                      | `src/hooks/useAI.js`                        |
| Tag operations                                       | `src/hooks/useTagOps.jsx`                   |
| File metadata                                        | `src/hooks/useMetadata.js`                  |
| Data seeding + sync                                  | `src/hooks/useDataSync.js`                  |
| Hub tab content (editor, overview, folders, etc.)    | `src/components/panels/HubEditorPanel.jsx`  |
| Brain tab content (command, projects, staging, etc.) | `src/components/panels/BrainTabsPanel.jsx`  |
| Colors, styles, constants                            | `src/utils/constants.js`                    |
| API endpoints                                        | `src/api.js` (client) + `api/*.js` (server) |
| Agent definitions                                    | `public/agents/system-*.md`                 |
| DB schema                                            | `scripts/migrate.js`                        |

### Making Changes

1. **Bug in a specific feature?** Find the relevant hook or panel component using the table above.
2. **Adding a new hook?** Create `src/hooks/useNewThing.js`, follow the deps pattern, wire it in `TheBrain.jsx`, export from `src/hooks/index.js`.
3. **Adding UI to a tab?** Edit `HubEditorPanel.jsx` (hub tabs) or `BrainTabsPanel.jsx` (brain tabs).
4. **New API endpoint?** Add to `api/data.js` (generic) or create `api/newresource.js` (dedicated).
5. **DB schema change?** Add migration to `scripts/migrate.js`, run `npm run db:migrate`.

### Build & Verify

```bash
npm run dev              # Start dev server (localhost:5173)
npm run build            # Production build (npx vite build)
npm run lint             # ESLint
npm run test             # Unit tests (Jest)
npm run test:coverage    # Tests with coverage report
npm run test:watch       # Tests in watch mode
npm run test:critical    # Critical path tests (DB required)
node scripts/run-tests.js # Full test suite
```

**Pre-commit hook:** Prettier + tests run automatically via Husky. Run `npx prettier --write src/` to fix formatting.

---

## Features

### Core Features

- Project management with phases, health scores, momentum
- Hierarchical file system with markdown editing
- Life Areas ("Parts") with health tracking
- Goal tracking with contributions
- Tagging & cross-entity linking
- Session timer with work logging

### Daily Operations

- Daily check-ins (sleep, energy, gut, training)
- Training log with weekly targets
- Outreach tracking with mandatory minimum
- Weekly reviews with AI analysis
- Drift detection with 5 pattern alerts

### v2.0 Orchestration

- URI-based resource addressing (`brain://project/{id}`)
- L0/L1/L2 hierarchical file summaries
- File-based agent registry (7 system agents)
- Universal task queue with delegation
- Workflow execution engine
- Agent task execution with function calling
- Adaptive assistance modes (Coach/Assistant/Silent)
- Memory self-iteration
- Community workflows
- External integrations (GitHub, Calendar, Email)

---

## Documentation

| File                             | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `README.md`                      | This file — quick reference + architecture guide      |
| `WORKFLOWS-AND-AGENTS.md`        | **Start here** — practical guide to using Workflows + Agents/Skills |
| `REFACTOR_TASKS.md`              | Refactoring progress and module inventory             |
| `brain-status.md`                | Master status — what's built, what's next             |
| `brain-roadmap.md`               | Detailed step-by-step roadmap                         |
| `ARCHITECTURE-v2.md`             | Architecture overview (orchestration, modes, etc.)    |
| `schema-reference.md`            | Database schema reference                             |
| `agent-brief.md`                 | Operating rules for AI agents working on this project |
| `agent-architecture-decision.md` | Agent design decisions (files vs DB)                  |
| `agent-workflow-architecture.md` | Agent + workflow deep architecture                    |
| `TESTING-PLAN.md`                | Comprehensive testing checklist (200+ tests)          |
| `dev-log.md`                     | Session-by-session development log                    |

---

## API Resources

Core resources via `/api/data?resource=`:

- `projects`, `files`, `folders`
- `life-areas`, `goals`, `contributions`
- `tasks`, `workflows`, `workflow-instances`
- `daily-checkins`, `training-logs`, `outreach`
- `memories`, `community-workflows`, `integrations`
- `file-summaries`, `mode-suggestions`, `auto-tasks`
- `agent-stats`, `workflow-patterns`

---

## Deployment

Deploy to Vercel with the included `vercel.json` configuration.

---

_THE BRAIN v2.0 — From Coach to Orchestrator_
