**APPEND AND ANNOTATE ALL EDITS**

# THE BRAIN / SPINE — Master Status Document v2.2

**Product Name:** Spine (codebase: `the-brain-2`, repo: `martinw82/the-brain-2`)  
**Live URL:** the-brain-2.vercel.app  
**Last Updated:** 2026-03-29  
**Status:** v2.0 SHIPPED ✅ | v2.2 (Brain OS) SHIPPED ✅ | Frontend Refactored ✅ | Test Suite Complete ✅

---

## 1. What This Is

### Product: Spine

Spine is a **personal AI orchestration OS** — a solo-operator's command centre for planning, executing, and compounding digital projects. The product name "Spine" was locked in a branding session in March 2026. The open-source protocol layer will eventually be extracted as **Keystone**.

### Core Architecture (three layers)

1. **Adaptive Interface Layer** — UI adapts to Coach / Assistant / Silent modes
2. **Orchestration Layer** — Task routing, workflow execution, Universal Agent Bridge
3. **Context Layer** — Hierarchical L0/L1/L2 summaries, URI-based addressing, REL entity graph

### Evolution Path

| Version | Date | Milestone |
|---------|------|-----------|
| v0.1 | Pre-2026 | Original concept (Next.js/Firebase/Genkit) |
| v1.0 | 2026-03-12 | React/Vite + TiDB + serverless, Phases 0-4 |
| v2.0 | 2026-03-15 | Agent orchestration, modes, workflows, memory |
| v2.1 | 2026-03-17 | Frontend refactor (14k → 4k lines), test suite |
| **v2.2** | **2026-03-25** | **Brain OS: REL graph, Trust Ladder, UAB, 3 pipelines** |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 6 | Modular: orchestrator + 11 hooks + 2 panels + 20+ components |
| Styling | Inline dark monospace | JetBrains Mono / Fira Code |
| API | Vercel serverless | **7/12 functions used** — see constraints §6 |
| Database | TiDB Cloud Serverless (MySQL) | Free tier, EU-central-1, **39 tables** |
| Auth | JWT + bcrypt | Register/login/sessions |
| AI | Multi-provider proxy | Anthropic, Moonshot, DeepSeek, Mistral, OpenAI |
| Migrations | `scripts/migrate.js` | Versioned; v1–v28 applied |
| Deployment | Vercel (primary) | `vercel.json` present |
| Testing | Jest + React Testing Library | 175+ unit tests + 31 entity graph tests |
| CI | GitHub Actions | `phase0-gate.yml` runs entityGraph tests on every PR |

---

## 3. Database Schema (39 tables)

### Core (v1.0)
`users`, `projects`, `project_files`, `project_custom_folders`, `staging`, `ideas`, `sessions`, `comments`, `refresh_tokens`

### Phase 1 Foundations
`schema_migrations`, `life_areas`, `goals`, `goal_contributions`, `tags`, `entity_tags`, `entity_links`, `templates`

### Phase 2-4 Features
`file_metadata`, `sync_state`, `sync_file_state`, `daily_checkins`, `training_logs`, `outreach_log`, `weekly_reviews`, `notifications`, `project_integrations`

### v2.0 Infrastructure
`ai_usage`, `user_ai_settings`, `tasks`, `file_summaries`, `workflow_templates`, `workflow_instances`, `memories`, `community_workflows`, `user_integrations`, `integration_sync_log`

### v2.2 Brain OS (7 new tables — migration `0002_rel_foundation.sql`)

| Table | Purpose |
|-------|---------|
| `rel_entities` | URI-keyed entity graph nodes. Every file, task, asset, workflow output must be registered here before execution |
| `rel_entity_links` | Directed edges: `depends_on`, `generated_by`, `part_of`, `succeeded_by`, `version_of`, `input_to`, `output_from`, `blocks`, `relates_to`, `awaits_reply_by`, `responds_to` |
| `rel_entity_tags` | Tags on entities; supports inheritance via `propagateTags()` |
| `worker_capabilities` | Worker registry for UAB routing (ClaudeCode, OpenClaw, MCP) |
| `execution_log` | Every worker execution: provider, cost_usd, tokens, duration, quality |
| `workflow_trust` | Trust Ladder state per workflow (current_tier, run_count, approval rates) |
| `trust_events` | Audit log for every trust gate decision |

**Note:** `workflow_instances` also gained two new columns: `trust_tier INT DEFAULT 1` and `pending_gate TEXT`.

**Note:** Old `entity_links` and `entity_tags` tables remain for the existing UI tag system. The REL graph uses `rel_*` tables exclusively. Migration path: backfill old rows to `brain://{type}/{id}` URIs later.

---

## 4. What's Built

### v1.0 Brain-Level (11 tabs)
Command Centre, Projects, Bootstrap, Staging, Skills, Workflows, Integrations, Ideas, AI Coach, Export, Notifications

### v1.0 Hub-Level (8 tabs per project)
Editor, Overview, Folders, Review, Dev Log, Timeline, Comments, Meta

### v2.0 Orchestration Features
- `brain://` URI scheme (`src/uri.js`, 12 functions)
- L0/L1/L2 hierarchical file summaries (`src/summaries.js`)
- File-based agent registry: 7 system agents in `public/agents/system-*.md`
- Universal task queue with delegation (`tasks` table)
- Workflow execution engine (`src/workflows.js`)
- Agent task execution with function calling (`api/agent-execute.js`)
- Three assistance modes: Coach / Assistant / Silent (`src/modeHelper.js`)
- Smart mode suggestions, auto task creation from DEVLOG
- Memory self-iteration (6 categories, auto-extraction)
- Community workflows, advanced integrations, pagination, rate limiting

### v2.2 Brain OS Features (added 2026-03-25)

**REL Entity Graph (`src/entityGraph.js`)**  
8 core functions: `createNode`, `realizeNode`, `linkNodes`, `getDependencies`, `getDependents`, `propagateTags`, `getLineage`, `pruneOrphans`, `queryGraph`. All entities must be registered before execution. Provenance is tracked from root to output.

**Trust Ladder (`api/_lib/trustLadder.js`, `src/config/trustLadder.js`)**  
Three tiers: T1 = full approval every gate, T2 = batch digest, T3 = autopilot.  
T1→T2: 20 runs + 90% approval + 5 consecutive. T2→T3: 40 runs + 95% + 10 consecutive.  
Regression: T3→T2 if ≥15% errors in last 10 runs, 24h cooldown.

**Universal Agent Bridge (`api/_lib/executors/UniversalAgentBridge.js`)**  
Routes execution packages to capable workers. Creates REL nodes before execution (pending), realizes them with output + `generated_by` edge on completion.  
Adapters: `ClaudeCodeAdapter.js` (CLI subprocess), `OpenClawAdapter.js` (WebSocket/JSON-RPC).

**Cost Guard (`api/_lib/costGuard.js`)**  
Budget cap: £15/mo. Five functions: `getMonthlySpend`, `checkBudget`, `suggestProvider`, `recordCost`, `getProviderStats`. Provider fallback order: Haiku → Sonnet → Opus.

**Trust Approval Panel (`src/components/TrustApprovalPanel.jsx`)**  
Unified approval inbox with project filter. Shows pending gates, approve/reject/modify with notes.

**Trust API (`api/_lib/handlers/trust.js`)**
GET pending gates, POST record decision. Merged into `data.js` router as `?resource=trust`.

**Relation Maintainer Agent (`public/agents/system-relation-maintainer.md`)**  
Daily audit: orphan detection/flagging, circular dependency detection, graph health report.

**Project Pipelines (3 production pipelines)**

| Pipeline | Agents | Trust Gates | Output |
|----------|--------|-------------|--------|
| YouTube Factory | research, script, storyboard, keywords, retention, assessment | 3 (script, storyboard, pre-upload) | Upload-ready video package |
| Competition Hunter | competition-research, 6 style writers, competition-submitter | 2 (review, submit) | Submitted competition entries |
| B2B Outreach | outreach-trade, inbound-monitor, social-content | 2 (review, send) | Sent emails + CRM updates |

**Agent Count:** 7 original + 14 new = 21 agents total in `public/agents/`

**Remotion PoC (`remotion/poc/`)**  
Scaffolding for `composition.tsx` and storyboard JSON. Results template at `FINDINGS.md`. PoC execution pending — determines whether Remotion or FFmpeg assembly is used for Phase 4 rendering.

**CI Gate**  
`.github/workflows/phase0-gate.yml` runs `entityGraph.test.js` (31 tests) on every PR to main. All PRs require the checklist in `.github/PULL_REQUEST_TEMPLATE.md` (provenance, depends_on, succeeded_by, Trust Ladder compliance).

---

## 5. Known Issues & Remaining Work

### Fixed in v2.1 (pre-user-testing review)
- `agentExecution.status()` non-existent → replaced with `tasksApi.myTasks()` re-fetch
- `endSession` created zero-duration DB records → guarded with `dur > 0 && focusId`
- `saveTraining` checkin sync was fire-and-forget → now awaited
- `buildCtx` JSON.stringify had no error handling → wrapped in try/catch

### Remaining Known Issues (not blocking)
- `beforeunload` prompt always shows when session active (intentional)
- Optimistic CRUD not rolled back on API failure (medium priority)
- `useMetadata` rapid file-switch race condition (no AbortController)
- AI rate limit: 10/min implemented, prompt caching not implemented
- Remotion PoC not yet executed — renders unvalidated

### v2.2 Specific
- `OpenClawAdapter.js` is Phase 1 stub — logs intent, returns mock. Real WebSocket in Phase 2 when Playwright worker is ready
- OAuth flows for Gmail/LinkedIn not implemented — required for inbound monitor and LinkedIn outreach
- Checkpoint/resume schema for long-running agents not yet designed
- Automated testing for pipelines not yet written (unit tests cover entityGraph only)

---

## 6. Critical Constraints (read before adding anything)

### Vercel Hobby Plan — 7/12 Serverless Functions Used

Every `.js` file in `api/` (except `api/_lib/`) counts as a function. **5 slots remain.**

| Function | Purpose |
|----------|---------|
| `api/agent-execute.js` | Agent execution with function calling |
| `api/agents.js` | Agent task execution (mode-aware) |
| `api/ai.js` | Multi-provider AI proxy (streaming) |
| `api/data.js` | Router hub — CRUD, auth, trust, upload, integrations, workflows (14+ resource types) |
| `api/projects.js` | Project CRUD + file/folder operations |
| `api/worker.js` | Desktop worker management (SSE, polling, job results) |
| `api/workflow-job.js` | Queue workflow steps for worker execution |

**Consolidated (2026-03-29):** `auth.js`, `trust.js`, `upload.js`, `integrations.js` merged into `data.js` handlers. `quick-test.js` (dev-only) deleted.

**Rule:** New utility/library modules go in `api/_lib/`. Multiple related endpoints must be merged into one file with method routing.

### MySQL / TiDB JSON Column Defaults

Never use `DEFAULT '{}'` or any `DEFAULT` on `JSON`, `TEXT`, or `BLOB` columns. TiDB strict mode rejects them. Handle defaults in application code.

### Pre-commit Hook

`.husky/pre-commit` runs `npm run format:check` against **all** `src/**/*.{js,jsx}` files, not just staged ones. Run `npm run format` before every commit.

### Budget

Cost Guard enforces £15/month. Provider fallback: Haiku first, Sonnet for complex tasks, Opus never (too expensive at scale).

---

## 7. Agent Layer

### Current Agent Roster (21 agents)

**Original 7 (v2.0):** system-dev, system-content, system-strategy, system-design, system-research, system-outreach, system-finance

**v2.2 Additions (14):**
- Pipelines: system-competition-research, system-competition-submitter, system-inbound-monitor, system-outreach-trade, system-social-content
- Content styles: system-content-humorous, system-content-professional, system-content-fiction, system-content-sad, system-content-narrative, system-content-persuasive
- YouTube: system-youtube-research, system-youtube-script, system-youtube-storyboard, system-youtube-keywords, system-youtube-retention, system-assessment-v1
- Maintenance: system-relation-maintainer

### Agent Architecture
- Definitions: `public/agents/system-*.md` (YAML frontmatter + system prompt body)
- Ephemeral: agents spin up, execute, die — no persistent state
- Immutable: change prompt → new file with new version ID
- Stats: derived from `tasks` table (execution history)

---

## 8. Development Workflow

1. `brain-status.md` — single source of truth (this document)
2. `agent-brief.md` — operating rules for agents working on the repo
3. `WORKFLOWS-AND-AGENTS.md` — practical guide for using agents/workflows
4. `PROJECT-PIPELINES-GUIDE.md` — YouTube, Competition, B2B pipeline docs
5. Per-feature chats — one chat per feature, disposable

**Session handoff:** Update this document at end of each session. Append edit annotation at bottom.

---

## 9. Documentation Map

| File | Keep? | Purpose |
|------|-------|---------|
| `brain-status.md` | ✅ | Master status (this file) |
| `agent-brief.md` | ✅ | Agent operating rules |
| `WORKFLOWS-AND-AGENTS.md` | ✅ | Practical orchestration guide |
| `PROJECT-PIPELINES-GUIDE.md` | ✅ | Pipeline user guide |
| `TESTING-PLAN.md` | ✅ | Manual test checklist |
| `schema-reference.md` | ✅ | DB schema design reference |
| `README.md` | ✅ | Repo overview (trimmed) |
| `CHANGELOG.md` | ✅ | Condensed version history |
| `docs/archive/` | 📦 | Completed roadmaps, refactor tasks, old test summaries |

---

## 10. Architecture Principles

**Proven (v1.0+)**
- Modular orchestrator: TheBrain.jsx is state + wiring, business logic in hooks, UI in panels
- Optimistic updates: UI first, DB background, revert on error
- Soft deletes: never hard-delete user content
- File-based agents: immutable, version-controlled, no DB migration for updates

**Added (v2.0)**
- Mode is config, not code: same features, different behaviour
- Explainable AI: retrieval traces, assignment reasons
- Human override always: AI suggests, human decides

**Added (v2.2)**
- Provenance before execution: every entity registered in REL graph with `createNode()` before work begins
- Trust is earned, not granted: all pipelines start T1, earn autonomy through track record
- £15/month budget ceiling: Cost Guard enforces it, provider fallback is automatic
- Vercel function slots are scarce: shared files and `api/_lib/` for new code

---

## 11. Success Metrics

**v1.0 (achieved):** Daily active use, all features survive reload, mobile usable, multi-provider AI stable

**v2.0 (targets):** Tasks/week >10, agent task completion >60%, workflow instances >5/project, mode switching >30% users

**v2.2 (new targets):** Pipelines run end-to-end with <3 trust gate rejections per 10 runs; entity graph orphan rate <5%; cost <£10/month per active pipeline

---

_THE BRAIN / SPINE v2.2 — Brain OS Edition_

**v2.2 SHIPPED** ✅

**APPEND AND ANNOTATE ALL EDITS**

---

**Edit 2026-03-28 (v2.2 docs consolidation):**
- Renamed product to **Spine** throughout; repo and URL unchanged
- Updated table count: 32 → 39 (7 new REL foundation tables)
- Added v2.2 features: REL Entity Graph, Trust Ladder, UAB, Cost Guard, Trust Approval Panel, 3 project pipelines, 14 new agents, CI gate, PR template
- Added §6 Critical Constraints (Vercel 8/12 limit, JSON column defaults, pre-commit hook, budget)
- Updated API function count: 8/12 used
- Updated documentation map (archive pattern)
- Removed verbose repetition from sections 5-8 (content now in dedicated docs)
- Dev log gap noted: Sessions 033-056 logged, Session 057 (v2.2) missing from dev-log.md — see CHANGELOG.md
