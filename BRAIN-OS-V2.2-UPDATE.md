# Brain OS v2.2 Update Log

_Session date: 2026-03-25_
_Branch: `claude/brain-os-v2.2-update-R4QAc`_
_PR: #58_

---

## Overview

This session implemented the full Brain OS v2.2 PRD across 5 phases: REL Entity Graph foundation, Trust Ladder with Universal Agent Bridge, and three project pipelines (Competition Hunter, B2B Outreach, YouTube Factory). All code is committed and pushed, with 31 unit tests passing and the Vite build succeeding.

---

## Critical Constraints

### 1. Entity Links/Tags Migration Strategy

The existing `entity_links` and `entity_tags` tables use a **type+id based schema** (`source_type/source_id/target_type/target_id` with `user_id` scoping). The v2.2 PRD requires **URI-based schemas** (`source_uri/target_uri` with `relation_type` and `confidence`).

**Decision: Create NEW tables, keep old tables untouched.**

- New tables: `rel_entities`, `rel_entity_links`, `rel_entity_tags`
- Old tables remain in use by existing features (tag management UI, entity linking in `api/data.js`)
- `entityGraph.js` exclusively uses the new `rel_*` tables
- Future migration: backfill old rows into new tables by converting `(source_type, source_id)` to `brain://{source_type}/{source_id}` URIs

**Why:** These are fundamentally different data models. Altering existing tables would break the tag management UI, entity linking features, and all routes in `api/data.js` (lines ~936-1067) that depend on the current schema.

### 2. Vercel Hobby Plan — 12 Serverless Function Limit

**This is the most important operational constraint going forward.**

Vercel's Hobby plan allows a maximum of 12 serverless functions per deployment. Every `.js` file in the `api/` directory (except `api/_lib/`) is counted as a serverless function, regardless of whether it has a default export.

**Current count: 8 functions** (limit is 12)

| Function | Purpose |
|----------|---------|
| `api/agent-execute.js` | Agent execution engine |
| `api/agents.js` | Agent management |
| `api/ai.js` | AI provider integrations |
| `api/auth.js` | Authentication |
| `api/data.js` | Core data operations |
| `api/integrations.js` | External integrations |
| `api/projects.js` | Project operations |
| `api/trust.js` | Trust gate endpoints (GET/POST) |

**Rules for adding new API endpoints:**
- You have **4 remaining slots** before hitting the limit
- Library/utility modules MUST go in `api/_lib/` — Vercel ignores this directory
- Multiple related endpoints should be merged into a single file with method routing (GET/POST/PUT/DELETE)
- The executor adapters (`UniversalAgentBridge.js`, `ClaudeCodeAdapter.js`, `OpenClawAdapter.js`) are in `api/_lib/executors/`
- `trustLadder.js` and `costGuard.js` are in `api/_lib/`

**What happened:** Initially, we had 14 functions (7 existing + `trust-decision.js`, `trust-pending.js`, `trustLadder.js`, `costGuard.js`, and 3 executor files). The Vercel build failed with: _"No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan."_ Fixed by moving library modules to `api/_lib/` and merging trust endpoints.

### 3. TiDB/MySQL JSON Column Defaults

TiDB and MySQL strict mode reject `DEFAULT` values on `BLOB`, `TEXT`, and `JSON` columns. Migration v21 had `step_results JSON DEFAULT '{}'` which caused the migration to fail on the Vercel build. Fixed by removing the default.

**Rule:** Never use `DEFAULT` on JSON columns in migration SQL. Handle defaults in application code instead.

### 4. Pre-commit Hook — Prettier Format Check

The `.husky/pre-commit` hook runs `npm run format:check` which checks **all** `src/**/*.{js,jsx}` files, not just staged ones. Any commit will fail if any source file has formatting issues, even pre-existing ones.

**Rule:** Run `npm run format` before committing to fix all formatting across the codebase.

---

## Files Created/Modified

### Phase 0 — REL Foundation

| File | Type | Description |
|------|------|-------------|
| `src/migrations/0002_rel_foundation.sql` | New | 7 new tables (rel_entities, rel_entity_links, rel_entity_tags, worker_capabilities, execution_log, workflow_trust, trust_events) |
| `src/entityGraph.js` | New | 8 core functions + linkNodes helper. Uses `isValidURI` from `src/uri.js` |
| `src/__tests__/entityGraph.test.js` | New | 31 unit tests with mock DB, 5-node fixture graph |
| `src/db/schema.ts` | Modified | Added Drizzle ORM definitions for new tables |
| `schema.sql` | Modified | Added new table DDL for fresh installs |
| `public/agents/system-relation-maintainer.md` | New | Daily audit agent for graph hygiene |
| `.github/PULL_REQUEST_TEMPLATE.md` | New | PR checklist from PRD philosophy |
| `.github/workflows/phase0-gate.yml` | New | CI gate — runs entityGraph tests on PRs |

### Phase 1 — Trust Ladder + UAB

| File | Type | Description |
|------|------|-------------|
| `src/config/trustLadder.js` | New | Tier thresholds (T1→T2: 20 runs/90%, T2→T3: 40 runs/95%), regression rules |
| `api/_lib/trustLadder.js` | New | 3 functions: initWorkflowTrust, checkGate, recordGateDecision |
| `api/trust.js` | New | Combined GET (pending gates) + POST (record decision) endpoint |
| `src/components/TrustApprovalPanel.jsx` | New | Approval inbox UI with project filters |
| `api/_lib/executors/UniversalAgentBridge.js` | New | Routes execution packages to capable workers, creates REL nodes |
| `api/_lib/executors/ClaudeCodeAdapter.js` | New | CLI subprocess adapter via child_process.spawn |
| `api/_lib/executors/OpenClawAdapter.js` | New | WebSocket/JSON-RPC adapter |
| `api/_lib/costGuard.js` | New | £15/mo budget cap, provider fallback, spend analytics |
| `remotion/poc/composition.tsx` | New | Remotion PoC scaffolding |
| `remotion/poc/storyboard-mock.json` | New | Mock storyboard data |
| `remotion/poc/FINDINGS.md` | New | PoC results template |

### Phase 2 — Competition Hunter

| File | Description |
|------|-------------|
| `public/agents/system-competition-research.md` | Playwright scraping + structured extraction |
| `public/agents/system-competition-submitter.md` | Form fill + screenshot proof |
| `public/agents/system-content-humorous.md` | Humorous writing style agent |
| `public/agents/system-content-professional.md` | Professional writing style agent |
| `public/agents/system-content-fiction.md` | Fiction writing style agent |
| `public/agents/system-content-sad.md` | Emotional/sad writing style agent |
| `public/agents/system-content-narrative.md` | Narrative writing style agent |
| `public/agents/system-content-persuasive.md` | Persuasive writing style agent |
| `public/agents/competition-batch-submit.json` | Batch submission pipeline template |

### Phase 3 — B2B Outreach

| File | Description |
|------|-------------|
| `public/agents/system-outreach-trade.md` | Cold email with tone rules |
| `public/agents/system-inbound-monitor.md` | Gmail API classification |
| `public/agents/system-social-content.md` | LinkedIn/Facebook post drafts |
| `public/agents/b2b-outreach-system.json` | Outreach pipeline template |
| `public/agents/inbound-management.json` | Inbound management pipeline |

### Phase 4 — YouTube Factory

| File | Description |
|------|-------------|
| `public/agents/system-youtube-research.md` | Topic research agent |
| `public/agents/system-youtube-script.md` | Script writing agent |
| `public/agents/system-youtube-storyboard.md` | Visual storyboard agent |
| `public/agents/system-youtube-keywords.md` | SEO/keyword agent |
| `public/agents/system-youtube-retention.md` | Retention analysis agent |
| `public/agents/system-assessment-v1.md` | Quality assessment agent |
| `public/agents/video-auto-pipeline.json` | Full video production pipeline |

### Config Changes

| File | Change |
|------|--------|
| `babel.config.js` → `babel.config.cjs` | Renamed for ESM compatibility |
| `jest.config.js` → `jest.config.cjs` | Renamed for ESM compatibility |
| `scripts/migrate.js` | Fixed JSON column default in migration v21 |

---

## Entity Graph API Reference

`src/entityGraph.js` exports 8 core functions + 1 helper, all taking `db` (mysql2 pool) as first argument:

| Function | Purpose |
|----------|---------|
| `createNode(db, uri, type, scope, memType, meta)` | Register entity before execution |
| `realizeNode(db, uri, output, checksum)` | Mark entity as complete with output |
| `linkNodes(db, sourceUri, targetUri, relationType, confidence)` | Create directed edge |
| `getDependencies(db, uri)` | Get upstream dependencies |
| `getDependents(db, uri)` | Get downstream dependents |
| `propagateTags(db, uri)` | Cascade tags to children (inherited=true) |
| `getLineage(db, uri)` | Recursive CTE walk to root ancestors |
| `pruneOrphans(db, maxAgeHours)` | Flag entities with 0 links as orphaned |
| `queryGraph(db, filters)` | Dynamic query by scope/type/status/memory_type |

Valid entity types: `file`, `task`, `asset`, `workflow`, `agent`, `worker`, `email`, `competition`
Valid relation types: `depends_on`, `generated_by`, `part_of`, `succeeded_by`, `version_of`, `input_to`, `output_from`, `blocks`, `relates_to`, `awaits_reply_by`, `responds_to`

---

## Trust Ladder Tiers

| Tier | Name | Behaviour |
|------|------|-----------|
| T1 | Guard Rails | Every gate requires human approval |
| T2 | Batch Digest | Approval required but can be batched |
| T3 | Autopilot | No approval needed |

**Promotion:** T1→T2 requires 20 runs with 90% approval rate and 5 consecutive approvals. T2→T3 requires 40 runs with 95% approval rate and 10 consecutive approvals.

**Regression:** T3→T2 if error rate exceeds 15% in last 10 runs (with 24h cooldown).

---

## Verification Results

- Entity graph tests: **31/31 passing**
- Vite build: **succeeds** (493KB bundle, 144KB gzipped)
- Prettier: **all files formatted**
- Serverless functions: **8/12 limit**
