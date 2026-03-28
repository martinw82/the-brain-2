# The Brain / Spine — Personal AI Orchestration OS

**Product name:** Spine · **Codebase:** `the-brain-2` · **Live:** the-brain-2.vercel.app  
**Status:** v2.2 (Brain OS) ✅ — REL graph, Trust Ladder, UAB, 3 production pipelines

---

## What It Is

Spine is a personal operating system for a solo AI-powered builder. It manages projects, delegates work to AI agents, executes multi-step pipelines, and adapts its coaching intensity to how you work.

Three assistance modes: **Coach** (mandatory check-ins, interruptive drift alerts) / **Assistant** (on-demand, preview before execution) / **Silent** (manual only, minimal AI).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6, modular (orchestrator + 11 hooks + 2 panels + 20+ components) |
| API | Vercel serverless — **8/12 functions used** |
| Database | TiDB Cloud Serverless — **39 tables** |
| Auth | JWT + bcrypt |
| AI | Multi-provider: Anthropic, Moonshot, DeepSeek, Mistral, OpenAI |
| Testing | Jest (175+ unit) + 31 entity graph tests |
| CI | GitHub Actions — phase0 gate on every PR |

---

## Frontend Structure

```
src/
├── TheBrain.jsx              # Orchestrator (~3,962 lines) — state, hook wiring, nav JSX
│
├── hooks/                    # All business logic (11 hooks)
│   ├── useProjectCrud.js     useSessionOps.js    useAI.js
│   ├── useStagingOps.js      useNotifications.js  useTagOps.jsx
│   ├── useTaskOps.js         useMetadata.js       useDataSync.js
│   └── useUndoRedo.js        useBreakpoint.js
│
├── components/
│   ├── panels/
│   │   ├── HubEditorPanel.jsx    # All hub tab content
│   │   └── BrainTabsPanel.jsx    # All brain tab content
│   ├── TrustApprovalPanel.jsx    # v2.2: approval inbox
│   └── ...20+ modals, viewers, features
│
├── utils/                    # constants.js  projectFactory.js  fileHandlers.js  renderers.js
│
├── entityGraph.js            # v2.2: REL entity graph (8 core functions)
├── agents.js                 # Agent registry service
├── workflows.js              # Workflow execution engine
├── modeHelper.js             # Coach/Assistant/Silent behavior matrix
├── uri.js                    # brain:// URI utilities (12 functions)
├── summaries.js              # L0/L1 summary utilities
├── retrieval.js              # Recursive directory retrieval
└── memory.js                 # Memory management

api/
├── agent-execute.js  agents.js  ai.js  auth.js
├── data.js           integrations.js  projects.js  trust.js   # ← 8/12 functions
└── _lib/
    ├── trustLadder.js   costGuard.js   cors.js   crypto.js
    └── executors/
        ├── UniversalAgentBridge.js
        ├── ClaudeCodeAdapter.js
        └── OpenClawAdapter.js

public/agents/               # 21 agent .md files + 4 pipeline .json files
src/migrations/              # 0001_add_updated_at.sql  0002_rel_foundation.sql
```

---

## Quick Start (Developers / AI Agents)

### Finding code

| To find... | Look in... |
|-----------|-----------|
| State declarations | `src/TheBrain.jsx` lines 1-320 |
| Hook wiring | `src/TheBrain.jsx` lines 320-1100 |
| Top bar / nav JSX | `src/TheBrain.jsx` lines 1100+ |
| Project CRUD, file ops | `src/hooks/useProjectCrud.js` |
| Task management + agent polling | `src/hooks/useTaskOps.js` |
| AI / search / context builder | `src/hooks/useAI.js` |
| Hub tab content | `src/components/panels/HubEditorPanel.jsx` |
| Brain tab content | `src/components/panels/BrainTabsPanel.jsx` |
| Colors, styles, constants | `src/utils/constants.js` |
| REL entity graph | `src/entityGraph.js` |
| Trust Ladder logic | `api/_lib/trustLadder.js` |
| Universal Agent Bridge | `api/_lib/executors/UniversalAgentBridge.js` |
| Cost Guard | `api/_lib/costGuard.js` |
| Agent definitions | `public/agents/system-*.md` |
| Pipeline definitions | `public/agents/*.json` |
| DB schema / migrations | `scripts/migrate.js` |

### Key patterns

- **Hooks:** accept a single `deps` object, return operations — `const { doThing } = useHook({ state, setState })`
- **Panels:** receive a single `ctx` prop — `<HubEditorPanel ctx={{ hub, saveFile, ... }} />`
- **New API code:** goes in `api/_lib/` or merged into an existing function file (4 slots remain)
- **New agents:** create `public/agents/system-{name}.md` with YAML frontmatter, no DB changes needed
- **New pipelines:** create `public/agents/{name}.json`, seeds automatically on login

### Build & verify

```bash
npm run dev              # localhost:5173
npm run build            # production build (runs migrate.js first)
npm run format           # run before every commit (pre-commit checks all src/)
npm test                 # unit tests (Jest)
npm run test:critical    # critical path tests (DB required)
node scripts/run-tests.js # full suite
```

---

## v2.2 Brain OS — Key Additions

**REL Entity Graph** — every entity registers before execution, realizes after; full provenance from root to output  
**Trust Ladder** — T1 (every gate reviewed) → T2 (batch) → T3 (autopilot) earned through track record  
**Universal Agent Bridge** — routes execution packages to ClaudeCode / OpenClaw / MCP workers  
**Cost Guard** — £15/month cap, automatic provider fallback  
**3 Production Pipelines** — YouTube Factory (12 steps, 3 trust gates), Competition Hunter (6 steps, 2 gates), B2B Outreach (6 steps, 2 gates)  
**21 agents** (was 7), **39 DB tables** (was 32), **CI phase0 gate** on every PR

---

## Documentation

| File | Purpose |
|------|---------|
| `brain-status.md` | **Master status** — what's built, constraints, schema, known issues |
| `agent-brief.md` | **Agent operating rules** — read at every session start |
| `WORKFLOWS-AND-AGENTS.md` | Practical guide to using agents and workflows |
| `PROJECT-PIPELINES-GUIDE.md` | YouTube, Competition Hunter, B2B Outreach pipeline docs |
| `TESTING-PLAN.md` | Manual test checklist (200+ checks) |
| `CHANGELOG.md` | Condensed version history |
| `schema-reference.md` | DB schema design reference |
| `docs/archive/` | Completed roadmaps, old test summaries, refactor logs |

---

## API Resources

All generic resources via `/api/data?resource=`:

`projects` · `files` · `folders` · `life-areas` · `goals` · `contributions`  
`tasks` · `workflows` · `workflow-instances` · `daily-checkins` · `training-logs` · `outreach`  
`memories` · `community-workflows` · `integrations` · `file-summaries`  
`mode-suggestions` · `auto-tasks` · `agent-stats` · `workflow-patterns`

Trust gate endpoints: `GET /api/trust` (pending gates) · `POST /api/trust` (record decision)

---

## Critical Constraints

- **Vercel:** 8/12 serverless functions used. New code → `api/_lib/` or merge into existing files
- **MySQL:** Never use `DEFAULT` on `JSON`/`TEXT`/`BLOB` columns in migrations
- **Pre-commit:** Prettier runs on ALL `src/` — run `npm run format` before committing
- **Budget:** £15/month cap enforced by Cost Guard. Use Haiku for high-frequency tasks

---

_Spine · built by Martin Wager · London_
