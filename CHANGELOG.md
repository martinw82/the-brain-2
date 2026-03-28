# CHANGELOG

Condensed version history for The Brain / Spine. Replaces `ROADMAP-v2.md`, `brain-roadmap.md`, `REFACTOR_TASKS.md`, `TEST-SUITE-FINAL.md`, `TEST-SUITE-SUMMARY.md`.

---

## [2.2.0] — 2026-03-25 — Brain OS

**Product renamed:** Spine (codebase remains `the-brain-2`)

### REL Entity Graph
- `src/entityGraph.js` — 8 core functions: createNode, realizeNode, linkNodes, getDependencies, getDependents, propagateTags, getLineage, pruneOrphans, queryGraph
- `src/migrations/0002_rel_foundation.sql` — 7 new tables: rel_entities, rel_entity_links, rel_entity_tags, worker_capabilities, execution_log, workflow_trust, trust_events
- 31 unit tests in `src/__tests__/entityGraph.test.js`
- CI gate: `.github/workflows/phase0-gate.yml` — blocks PRs that break entity graph tests
- PR template: `.github/PULL_REQUEST_TEMPLATE.md` — enforces provenance philosophy

### Trust Ladder
- `api/_lib/trustLadder.js` — initWorkflowTrust, checkGate, recordGateDecision
- `src/config/trustLadder.js` — tier thresholds (T1→T2: 20 runs/90%, T2→T3: 40 runs/95%), regression rules
- `api/trust.js` — unified GET/POST endpoint (counts as one function slot)
- `src/components/TrustApprovalPanel.jsx` — approval inbox UI

### Universal Agent Bridge + Executors
- `api/_lib/executors/UniversalAgentBridge.js` — routes execution packages, creates REL nodes
- `api/_lib/executors/ClaudeCodeAdapter.js` — CLI subprocess (child_process.spawn)
- `api/_lib/executors/OpenClawAdapter.js` — WebSocket/JSON-RPC (Phase 1 stub, Phase 2 target)

### Cost Guard
- `api/_lib/costGuard.js` — £15/mo budget, getMonthlySpend, checkBudget, suggestProvider, recordCost, getProviderStats

### Production Pipelines

**YouTube Factory** — `public/agents/video-auto-pipeline.json`  
12 steps: research → script → [Script Review ⛔] → retention → storyboard → [Storyboard Review ⛔] → SEO → assets → render → assessment → [Pre-Upload Review ⛔] → upload prep  
6 agents: system-youtube-research, system-youtube-script, system-youtube-storyboard, system-youtube-keywords, system-youtube-retention, system-assessment-v1  
~$0.18/video

**Competition Hunter** — `public/agents/competition-batch-submit.json`  
6 steps: research → score → style detect → route to writer → [Review ⛔] → submit  
Agents: system-competition-research, system-competition-submitter  
6 style writers: system-content-humorous/professional/fiction/sad/narrative/persuasive

**B2B Outreach** — `public/agents/b2b-outreach-system.json` + `inbound-management.json`  
6 steps: research prospect → draft email → [Review Gate ⛔] → [Send Email ⛔] → monitor reply → follow-up  
3 agents: system-outreach-trade, system-inbound-monitor, system-social-content

### Maintenance Agent
- `public/agents/system-relation-maintainer.md` — daily graph audit, orphan detection, health report

### Remotion PoC
- `remotion/poc/composition.tsx`, `storyboard-mock.json`, `FINDINGS.md` — scaffolding for video render validation. PoC execution pending.

### Discovered Constraints
- Vercel Hobby plan: 12 serverless function limit. Currently 8/12 used.
- TiDB/MySQL strict mode: no `DEFAULT` on JSON/TEXT/BLOB columns
- Pre-commit Husky hook runs Prettier on all `src/` (not just staged)

---

## [2.1.0] — 2026-03-17 — Refactor + Test Suite

### Frontend Refactor
- `src/TheBrain.jsx` reduced from 14,237 → 3,962 lines (72% reduction)
- Extracted: 11 hooks, 2 panel components, 20+ standalone components, 4 utility files
- Established hook deps pattern and panel ctx pattern

### Test Suite
- 175+ unit tests across 18 modules (utils, hooks, services, components, integration)
- Infrastructure: jest.config.cjs, babel.config.cjs, setupTests.js, run-tests.js
- Critical path tests: file save/load, comment persistence, session logging

### Bug Fixes (pre-user-testing review)
- `agentExecution.status()` non-existent → replaced with `tasksApi.myTasks()` re-fetch
- `endSession` unconditionally created zero-duration DB records → guarded
- `saveTraining` checkin sync fire-and-forget → awaited
- `buildCtx` JSON.stringify no error handling → wrapped in try/catch

---

## [2.0.0] — 2026-03-15 — Agent Orchestration Platform

### URI Scheme (Phase 5.1)
- `src/uri.js` — 12 functions: parseURI, generateURI, fileURI, taskURI, goalURI, etc.
- `brain://` scheme for all entities; AI context includes clickable URIs

### Hierarchical Context (Phase 5.2)
- `file_summaries` table (migration v24) — L0 (~100 tokens), L1 (~2k tokens)
- `src/summaries.js` — auto-generation on file save
- FileSummaryViewer in Meta tab

### Agent Registry (Phase 5.3)
- 5 system agents as `.md` files in `public/agents/`
- `src/agents.js` — loadAgents, findByCapability, selectAgent, cloneAgent
- AgentManager component

### Task Delegation (Phase 5.4)
- `tasks` table (migration v23) — universal queue, human/agent/integration assignees
- Full CRUD API + "My Tasks" in Command Centre

### Workflow Engine (Phase 5.5)
- `workflow_templates` + `workflow_instances` tables (migration v25)
- 7 system workflows seeded from `public/agents/system-workflows.json`
- `src/workflows.js` — startWorkflow, executeStep, onTaskComplete
- WorkflowRunner component

### Agent Execution (Phase 5.6)
- `api/agent-execute.js` — function calling with 6 functions: read_file, write_file, create_task, search_projects, mark_complete, request_review
- Preview mode vs Auto mode (`auto_run_agents` setting)

### Assistance Modes (Phase 6)
- `src/modeHelper.js` — Coach/Assistant/Silent behavior matrix
- Smart mode suggestions based on behavior patterns

### Intelligence (Phase 7)
- Recursive directory retrieval (`src/retrieval.js`)
- Workflow pattern learning (`src/workflowLearning.js`)
- Auto task creation from DEVLOG markers
- Memory self-iteration (`memories` table, migration v26, 6 categories)

### Ecosystem (Phase 8)
- Community workflows (`community_workflows` table, migration v27)
- Integrations: GitHub, Calendar, Email (`user_integrations` table, migration v28)
- Pagination helpers, rate limiting (30 req/min), input sanitization

---

## [1.0.0] — 2026-03-12 — Personal OS Foundation

### Phases 0-4 Complete
- **Phase 0:** Bug fixes — file lazy loading, comment DB, AI proxy, soft deletes, debounced saves
- **Phase 1:** Life areas, goals, templates, tags, entity links, settings persistence
- **Phase 2:** Project import, binary files, metadata editor, offline mode + desktop sync, daily check-ins, training log, outreach tracking, weekly reviews, drift detection
- **Phase 3:** AI metadata suggestions, Mermaid diagrams, Cmd+K search, file validity checker, sandboxed script execution
- **Phase 4:** Mobile responsive, onboarding wizard (4-step + tour), GitHub PAT integration, notification system

### Infrastructure
- React 18 + Vite, TiDB Cloud (MySQL), Vercel serverless
- JWT auth, multi-provider AI proxy (Anthropic, Moonshot, DeepSeek, Mistral, OpenAI)
- 32 database tables (v1.0), responsive UI, offline mode with localStorage cache

---

## Archive

The following files have been moved to `docs/archive/` as their content is superseded by this CHANGELOG and the current status/guide docs:

- `ROADMAP-v2.md` → superseded by CHANGELOG.md
- `brain-roadmap.md` → superseded by CHANGELOG.md (all phases ✅)
- `REFACTOR_TASKS.md` → superseded by v2.1.0 entry above
- `TEST-SUITE-FINAL.md` → superseded by v2.1.0 entry above
- `TEST-SUITE-SUMMARY.md` → superseded by v2.1.0 entry above
- `SESSION-PROMPT.md` → specific debug session, branch long merged
- `the-brain-v2-2-userguide.md` → AI-generated artifact, superseded by current docs
- `agent-architecture-decision.md` → decision made and implemented, see agent-brief.md
- `agent-workflow-architecture.md` → implemented, see WORKFLOWS-AND-AGENTS.md
- `ARCHITECTURE-v2.md` → superseded by README.md + brain-status.md
- `BRAIN-OS-V2.2-UPDATE.md` → superseded by v2.2.0 entry above
