************APPEND AND ANNOTATE ALL EDITS************

# THE BRAIN — Master Status Document

**Version:** 6.5 (Phase 1 Complete)
**Live URL:** the-brain-2.vercel.app
**Last Updated:** 2026-03-11
**Status:** Beta — All Phase 1 complete (1.0–1.4 + Phase 0 fixes); Phase 2 starting — next is 2.1 (Project import), following roadmap order through 2.10

---

## 1. What The Brain Is

The Brain is a personal operating system for organising life. The core philosophy is that **Life** is made up of **Parts** (business, health, relationships, creative work, etc.), Parts are made up of **Things** (projects, habits, tasks, ideas, goals), and Things connect across multiple Parts in overlapping, flexible ways.

It's not a to-do app. It's not a project management tool. It's a flexible structure that can absorb any life system — primarily business-focused but extensible to anything — and steer it through an AI agent-centric interface.

The Brain existed as a concept before the ChatGPT conversation analysis (283 conversations, Aug 2024–Feb 2026). That analysis was folded into The Brain to provide real data, project health scores, behavioural patterns, and strategic intelligence. The analysis didn't create The Brain — it enriched it.

**The evolution path:**
1. Original concept: A project management system (Next.js/Firebase/Genkit — heavy stack)
2. Chat analysis: Revealed portfolio, patterns, and the build-don't-ship loop
3. Rebuild: Lighter stack (React/Vite + serverless + TiDB), agent-centric architecture
4. Current: V6 "Wired Edition" — live with persistence, approaching usable beta

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 5 | Single JSX component (TheBrain.jsx, ~1,525 lines) |
| Styling | Inline styles, dark monospace UI | JetBrains Mono / Fira Code |
| API | Vercel serverless functions | `api/ai.js`, `api/auth.js`, `api/data.js`, `api/projects.js` |
| Database | TiDB Cloud Serverless (MySQL-compatible) | Free tier, EU-central-1 |
| Auth | JWT + bcrypt | Register/login/sessions |
| AI | Anthropic API (Claude Sonnet) | Proxied server-side via `/api/ai` — key not exposed |
| Migrations | `scripts/migrate.js` | Versioned schema migrations, `schema_migrations` table |
| Deployment | Vercel (primary) | Netlify config also present |

---

## 3. Database Schema (14 tables)

**Core (original):**
- **users** — email, password_hash, name, goal, monthly_target, currency, timezone, `settings` JSON (theme, font_family, font_size, sidebar_width, default_template_id, etc.)
- **projects** — slug IDs, phase, priority, health, momentum, revenue_ready, blockers/tags/skills (JSON), active_file, `life_area_id` FK
- **project_custom_folders** — per-project folder structure
- **project_files** — LONGTEXT content, full-text search indexed, `deleted_at` for soft deletes
- **staging** — review pipeline items, tagged, linked to projects
- **ideas** — scored idea bank (1-10)
- **sessions** — work session logging with duration and notes
- **comments** — per-file comments with resolved flag
- **refresh_tokens** — auth token store

**Phase 1 additions:**
- **schema_migrations** — versioned migration tracking
- **life_areas** — "Parts" entities (Business, Health, Relationships, Creative, Personal) with health_score
- **goals** — configurable financial/personal goals (title, target_amount, currency, timeframe, status)
- **goal_contributions** — project contributions toward a goal (amount, date, notes)
- **templates** — project structure templates with JSON config (phases, folders, files, skills)

---

## 4. What's Built & Working

### Brain-Level Features (10 tabs)
- **Command Centre** — today's focus selector, priority stack, health alerts, goal progress bar (configurable), life area filter pills
- **Projects** — full CRUD with optimistic updates + DB persistence, area assignment, template selection
- **Bootstrap** — guided 5-step project setup wizard generating briefs, strategy prompts, dev prompts, skill overrides, agent onboarding docs
- **Staging** — pipeline with tagging (IDEA_, SKETCH_, DRAFT_, etc.), approve/reject/defer
- **Skills** — 5 agent definitions (Dev, Content, Strategy, Design, Research) with SOPs, permissions, ignore rules, prompt prefixes
- **Workflows** — 4 templates (Product Launch, Content Sprint, Idea→Brief, Weekly Review)
- **Integrations** — UI panel for GitHub, Netlify, TiDB, Farcaster, Twitter, Base Chain (UI only — not wired)
- **Ideas** — bank ideas with score and tags
- **AI Coach** — proxied server-side via `/api/ai`, rate-limited (10/min), full project context, preset prompts
- **Export** — full JSON context builder, per-agent briefing generator, local file download

### Hub-Level Features (8 tabs per project)
- **Editor** — file tree + markdown editor with debounced auto-save + manual save, edit/preview modes
- **Overview** — status dashboard (phase, health, momentum, income, next action, blockers), area + template shown
- **Folders** — browse all standard + custom folders with file counts
- **Review** — staging items for this project with drag-and-drop upload
- **Dev Log** — quick-log entries + rendered DEVLOG.md
- **Timeline** — Gantt chart parsed from TASKS.md date format
- **Comments** — per-file comments with resolve/reopen, loaded from DB on file switch
- **Meta** — manifest.json viewer + folder summary, "Save as Template" button

### Infrastructure
- File operations: create, save, delete (soft delete — recoverable), with optimistic UI + DB persistence
- Debounced saves in editor (1.5s) — no per-keystroke DB writes
- Custom folder creation per project
- Full-text search across all files (DB-backed with in-memory fallback)
- Session timer with duration logging to DEVLOG.md and sessions table; `beforeunload` saves on tab close
- Health score auto-calculation (decay by days, blockers, momentum, status)
- Toast notifications for save confirmations
- Markdown renderer (headings, bold, code, checkboxes, tables, blockquotes)
- Project export to local file (BUIDL export format)
- Drag & drop files into staging
- Schema migration runner (`scripts/migrate.js`, versioned)

### Phase 1 Foundations
- **Life Areas (1.0)** — 5 default areas seeded, area health = weighted project average, filter pills in Command Centre, assignment in project create/overview
- **Goals (1.1)** — configurable goal (any currency/target/timeframe), progress bar reads from DB, goal modal, contributions tracked
- **Templates (1.2)** — 6 system templates (BUIDL, Software, Content, Business, Personal Goal, Blank), template picker in New Project modal, "Save as Template" in Meta tab, project phases/folders read from template config
- **Tagging & Linking (1.3)** — `tags`/`entity_tags`/`entity_links` tables + API + UI; QuickTagRow on projects/ideas/staging/goals/files; 🏷 Tags brain tab (cross-entity query); 🔗 Links hub tab (create/view/delete entity relationships)
- **Settings (1.4)** — `settings` JSON column on `users`, GET/PUT `/api/settings`, settings modal (⚙ gear icon in header), font family + font size persist to DB across devices, localStorage cache for speed

---

## 5. Known Bugs (Must Fix for Beta)

### Critical
1. ~~**Files don't load from DB on initial render.**~~ ✅ **FIXED (2026-03-08)** — `api/projects.js` list action now returns `files: null` (lightweight). `openHub()` in TheBrain.jsx lazy-loads files via `projectsApi.get(id)` on first open. `mapProject()` helper centralises snake→camelCase field mapping. FileTree shows a loading guard while files are fetching.
2. ~~**Comments don't load from DB.**~~ ✅ **FIXED (2026-03-08)** — `useEffect` in TheBrain.jsx watches `hubId` + `hub.activeFile`, calls `commentsApi.list()`, maps response fields. `commentsLoading` state prevents "No comments" flash on initial load.
3. ~~**AI Coach API key exposed client-side.**~~ ✅ **FIXED (2026-03-08)** — `api/ai.js` serverless function created to proxy Anthropic calls. `askAI()` in `TheBrain.jsx` updated to use `aiApi.ask()`. API key is now server-side only.

### Important
4. ~~**Rename project has stale reference.**~~ ✅ **FIXED (2026-03-08)** — `renameProject()` now uses a functional updater for `setProjects` and captures the updated file content locally to ensure the subsequent `saveFile` calls use the correct, updated data.
5. **Import functionality incomplete.** `importText`/`importError` state exists but no import UI or parsing logic was built.
6. ~~**Session timer doesn't auto-save.**~~ ✅ **FIXED (2026-03-08)** — Added `beforeunload` listener to warn user if a session is active. (Beacon saving not implemented due to auth header requirements, but user is now prevented from accidental loss).
7. ~~**Bootstrap wizard has no validation on complete.**~~ ✅ **FIXED (2026-03-08)** — Added null check for project in `completeBootstrap()` with a toast error.
8. ~~**Soft deletes on project_files.**~~ ✅ **FIXED (2026-03-08)** — Added `deleted_at` column to `project_files`. Updated `delete-file` to set `deleted_at`. Updated `get` and `search` to exclude soft-deleted files. Updated `save-file` to restore soft-deleted files if they are re-created.
9. ~~**Debounced saves in markdown editor.**~~ ✅ **FIXED (2026-03-08)** — Added 2-second debounce to `MarkdownEditor` auto-saving. Added "Unsaved changes..." indicator.
10. ~~**AI proxy rate limiting + cost controls.**~~ ✅ **PARTIAL (2026-03-08)** — AI proxy function implemented. Frontend displays error messages from proxy. Server-side rate limiting and caching deferred to Phase 2.

---

## 6. Missing Features (from previous version + new requirements)

These are features that existed in the original Next.js version or are needed for the core philosophy to work. Grouped by priority.

### Tier 1 — Required for core philosophy ("Life > Parts > Things")

✅ **Life Areas ("Parts") as first-class entities** — DONE (Phase 1.0). `life_areas` table, CRUD API, area assignment on projects, health calc, filter pills in Command Centre.

✅ **Project management templates/styles** — DONE (Phase 1.2). `templates` table, 6 system templates, template picker in New Project, "Save as Template" in Meta tab, phases/folders driven by template config.

✅ **Generic financial goal tracking** — DONE (Phase 1.1). `goals` + `goal_contributions` tables, configurable goal in any currency, progress bar reads from DB, goal modal.

✅ **Tagging and linking system** — DONE (Phase 1.3). `tags`, `entity_tags`, `entity_links` tables + API + UI. Tags on all entity types (projects, ideas, staging, goals, individual files). 🏷 Tags brain tab: tag cloud + cross-entity query. 🔗 Links hub tab: entity relationships (parent/child/supports/blocks/related). QuickTagRow: type to create/search, Enter to attach, × to remove. All persists to DB.

### Tier 2 — Required for usable daily tool

**Image handling.** The old version displayed images inline and handled binary files. V6 is text-only. Need: image viewer in editor pane, proper binary file handling, image preview in file tree.

**Metadata editor panel.** The old version had a dedicated UI for per-file metadata (category, status, tags, timestamps, custom fields). V6 stores metadata in manifest.json but has no visual editor for individual files.

**Project import.** Import from: pasted text (BUIDL export format), local folder selection (File System Access API), JSON upload. The state variables exist — the UI doesn't.

**Offline mode / localStorage fallback.** The old version worked without auth via localStorage. V6 requires DB connection. For a tool you'll use daily (including on phone with bad signal), offline resilience is essential.

✅ **Settings UI (1.4)** — DONE. Settings modal with font family + size, persists to DB via `settings` JSON column on users. Theme/sidebar-width extension deferred to Phase 2 (not blocking anything).

**Mobile responsive layout.** V6 is desktop-first with no responsive breakpoints. Needs to work on phone for low-energy days (the agent ruleset routes phone-only tasks on those days).

### Tier 3 — Enhances power and intelligence

**AI metadata suggestions.** Old version auto-suggested categories and tags for files based on content and project context. Reintroduce as part of the agent layer.

**Mermaid diagram rendering.** Old version rendered dependency graphs from Mermaid syntax. Useful for visualising project relationships and system architecture.

**Local file system sync.** Connect to a local folder, load from local, save to local. The File System Access API approach from the old version.

**Script execution.** Old version had a `/api/run-script` endpoint for Python/Shell/Node scripts from a `/tools/` folder. Low priority but was a differentiating feature.

**File validity checker.** Structural checks on project files — was a placeholder in the old version but the concept has value.

**Search improvements.** Cross-project search, better result display, search within file content with highlighted excerpts.

### Tier 4 — Future evolution

- Real-time collaboration (CRDTs, multi-user)
- Version history per file with revert
- Visual diff/merge for text files
- Plugin system for extensions
- Full GitHub two-way sync
- Task dependencies and sub-tasks
- Calendar integration
- Advanced AI: content generation, code analysis, image generation

---

## 7. The Agent Layer

The Brain's AI Coach currently has a one-line system prompt. The full agent ruleset has been designed but not yet implemented. Here's what exists and what needs building.

### The 10 Assistant Rules (designed, not yet wired)

1. **Revenue-first priority** — Prioritise tasks that lead to payment/delivery in 14-45 days
2. **One primary objective** — Only one major objective at a time until deliverable
3. **Ship before improve** — Block redesign/polish until working version ships
4. **No new features without purpose** — Require explicit justification for new features
5. **Outreach is mandatory** — Track minimum daily outreach actions
6. **Maintain progress without ideal tools** — Phone-only task set when tools are unavailable
7. **Health gates complexity** — Reduce cognitive load when energy/sleep/gut is unstable
8. **Relationship ambiguity awareness** — Periodic boundary check on environmental stability
9. **Risk budget control** — Checklist for high-risk opportunities (legality, reversibility, etc.)
10. **Weekly reality alignment** — Shipped work, money actions, health baseline, next priorities

### Daily Check-In Protocol (designed, not yet built)
- Morning: sleep hours, energy (0-10), gut symptoms (0-10), laptop available?, training sessions this week
- Output: primary objective, 1-3 matched tasks, stabiliser if needed
- State-based routing: energy ≤4 = low-complexity only, 5-7 = shipping/outreach, 8+ = deep work

### Training as Infrastructure (designed, not yet tracked)
- Training is not optional — it's revenue infrastructure (combat sports → cognitive function → shipping capacity)
- Weekly minimum: 3 × 30-minute solo sessions
- Track correlation: training days vs cognitive performance days
- Drift detection: 2 consecutive missed weeks triggers root-cause analysis

### What needs building for the agent layer
- **Daily check-in fields** — extend sessions table or create new `daily_checkin` table (energy, focus, gut, sleep, training_done)
- **Training log** — date, duration, type, weekly count query
- **Outreach tracking** — daily outreach actions logged
- **Agent system prompt upgrade** — replace one-liner with full structured ruleset
- **Weekly review automation** — query sessions, projects, check-ins and generate summary
- **Drift detection** — background check on training/outreach minimums

---

## 8. Development Workflow

### How we work across chats
1. **This document (`BRAIN_STATUS.md`)** is the single source of truth. Updated after each build session.
2. **Per-feature chats** — one chat per thing being built. Focused, clean, disposable.
3. **Synthesis chats** — periodically bring 3-4 session summaries together for strategic review. Reprioritise, cut, refocus.

### Session handoff protocol
At the end of each build session, update this document with:
- What was completed
- What bugs were found/fixed
- What's next (top 3 priorities)
- Any new parking lot items

---

## 9. Current Priority Stack

### Completed (Phase 0)
- ✅ File loading from DB (0.1)
- ✅ Comments loading from DB (0.2)
- ✅ AI Coach proxy — key server-side (0.3)
- ✅ Rename project stale ref fix (0.4)
- ✅ Session timer beforeunload (0.5)
- ✅ Bootstrap wizard null check (0.6)
- ✅ Soft deletes on project_files (0.7)
- ✅ Debounced saves in editor (0.8)
- ⚠️ AI rate limiting (0.9 PARTIAL) — rate limiting ✅, frontend error display ✅; prompt caching + token logging still TODO
- ✅ DB migration versioning (schema_migrations table)

### Completed (Phase 1)
- ✅ Life Areas / Parts (1.0)
- ✅ Generic goal system (1.1)
- ✅ Template system (1.2)
- ✅ Tagging & linking system (1.3) — QuickTagRow on projects/ideas/staging/goals/files; 🏷 Tags brain tab; 🔗 Links hub tab; DB tables v8–v10; API handlers; attach/detach/persist
- ✅ Settings system (1.4) — `settings` JSON on users, GET/PUT API, settings modal, font family + size, localStorage cache

### Next Up — Phase 2 (roadmap order)
1. ✅ **Phase 2.1 — Project import** (2026-03-11) — BUIDL format paste, JSON file upload, folder picker (File System Access API); import modal with conflict resolution
2. **Phase 2.2 — Image & binary file handling** ← NEXT — image viewer in editor pane, binary detection, base64 upload, download link for non-text files
3. **Phase 2.3 — Metadata editor panel** — per-file category/status/tags/custom fields, collapsible right panel, JSON column on project_files

### Then (Phase 2 continued — in order)
4. **Phase 2.4 — Offline mode / localStorage fallback** — cache full state to localStorage, DB-first with offline fallback, sync on reconnect
5. **Phase 2.5 — Daily check-in system** — `daily_checkins` table, energy/sleep/gut/training fields, check-in prompt on first visit of day, today's state in top bar; gates AI task routing
6. **Phase 2.6 — Training log** — `training_log` table, quick-log UI, weekly count, correlation with check-in energy scores
7. **Phase 2.7 — Outreach tracking** — `outreach_log` table, daily outreach indicator, AI coach enforces mandatory minimum
8. **Phase 2.8 — Agent system prompt upgrade + context compression** — `agent-config.json`, dynamic system prompt from real data (check-in + goals + projects + rules), state-based task routing, token budget < 4k
9. **Phase 2.9 — Weekly review automation** — `/api/review/weekly` aggregation, review dashboard UI, AI-generated analysis, persists to sessions/reviews table
10. **Phase 2.10 — Drift detection** — background checks on training/outreach/energy/session minimums, alerts in Command Centre, included in AI coach context

### Parking Lot (after Phase 2 — not now)
**Phase 3:**
- AI metadata suggestions (3.1) — auto-suggest tags/category on file save
- Mermaid diagram rendering (3.2)
- Search improvements — Cmd+K, cross-project, highlighted excerpts (3.3)
- Local file system sync via File System Access API (3.4)
- File validity checker — missing required files, orphaned entries (3.5)
- Script execution — /tools/ folder, sandboxed JS/Python/shell (3.6)

**Phase 4:**
- Mobile responsive layout (4.1)
- Onboarding flow for new users (4.2)
- Integration connectors actually working — GitHub, Netlify, Farcaster (4.3)
- Notification / reminder system — in-app bell, drift alerts, training reminders (4.4)

**Phase 5 / Future:**
- Monaco/CodeMirror editor upgrade
- Vector embeddings for semantic search
- Real-time collaboration (CRDTs)
- Version history per file with revert
- Plugin system
- Full GitHub two-way sync
- Push notifications / email digests
- Notion/Todoist/Linear importers

---

## 10. Architecture Notes

### What was deliberately dropped from the old version
- **Firebase dependency** — replaced with JWT + TiDB (more portable, no vendor lock)
- **Genkit/Google AI** — replaced with direct Anthropic API calls (simpler, one provider)
- **Next.js/TypeScript** — replaced with React/Vite (faster dev, lighter bundle)
- **ShadCN/Radix/Tailwind** — replaced with inline styles (single-file simplicity)
- **EventBus pattern** — replaced with prop drilling + simple state (appropriate at current scale)

### What should come back
- **Templates** — but lighter, as JSON config not full component trees
- **Metadata system** — but simplified, per-file tags/status/category
- **Offline fallback** — localStorage cache of current state
- **Image handling** — viewer component in editor pane
- **Import/export round-trip** — folder import, JSON import, BUIDL format import

### Key design principles
- **Single-file core** — TheBrain.jsx is the app. Simplicity over architecture.
- **Optimistic updates** — UI updates immediately, DB syncs in background, revert on error.
- **Portable data** — MySQL-compatible DB, standard schema, can switch providers by changing one env var.
- **Agent-first** — the AI coach isn't a bolt-on feature, it's the primary interaction layer.
- **Flexible structure** — the system must accommodate any type of "life thing," not just software projects.
- **Soft deletes** — never hard-delete user content immediately. `deleted_at` timestamps with 30-day retention.
- **Context compression** — AI receives project summaries + recent changes, not raw file dumps. Token budget per call. Summaries cached and regenerated on change.
- **Binary migration path** — images stored as base64 now, but viewer component accepts both base64 and URLs so migration to object storage (S3/R2) is non-breaking.

---

*THE BRAIN v6 · Wired Edition · Bootstrap → Freedom*
*THE BRAIN v6 · Wired Edition · Bootstrap → Freedom*
*************APPEND AND ANNOTATE ALL EDITS***************
Last edited 11/03/26 session
*THE BRAIN v6 · Wired Edition · Bootstrap → Freedom*

---
**Edit 2026-03-11 (session 7 — Phase 2.1 Project Import complete):**
- Version bumped to **6.6** (Phase 2.1 Complete)
- Phase 2.1 implementation complete:
  - Added `parseBuildlFormat()`, `validateImportJson()`, `parseFileSystemEntries()` to src/api.js
  - Added `projects.import()` API call to src/api.js
  - Added POST `/api/projects?action=import` handler to api/projects.js
  - Supports three import methods: BUIDL format paste, JSON upload, Folder picker (showDirectoryPicker)
  - Conflict resolution: duplicate projectId returns 409 with overwrite option
  - Added complete import modal UI to src/TheBrain.jsx with:
    - Tab-based method selection
    - Form fields: projectId, name, lifeAreaId, templateId
    - Client-side projectId validation (lowercase, numbers, hyphens)
    - Folder picker with skip patterns (.git, node_modules, .env*)
    - Binary file skipping (>1MB or known binary extensions)
    - Conflict modal: show option to overwrite existing project
    - Success navigation: auto-navigate to imported project + toast
- Import button added to Brain → Projects tab
- Build passes without errors
- Commit: Phase 2.1: Project Import — BUIDL, JSON, and Folder Support
- Next: Phase 2.2 (Image & binary file handling)

---
**Edit 2026-03-11 (session 6 — docs alignment: Phase 1 complete, Phase 2 roadmap corrected):**
- Version bumped to **6.5** (Phase 1 Complete)
- Phase 1.4 (Settings) confirmed complete — added to completed list, DB schema, What's Built, Missing Features sections
- 0.9 corrected from "complete" to "PARTIAL" — rate limiting done, prompt caching + token logging still TODO
- **Priority Stack completely rewritten to match brain-roadmap.md:**
  - All Phase 2 tasks now listed in roadmap order (2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8 → 2.9 → 2.10)
  - 2.2 (Image handling) and 2.3 (Metadata editor) were wrongly in Parking Lot — moved back into active Phase 2 queue
  - Phase 2.10 (Drift detection) was missing entirely — added
  - Previous "Then" section had 2.5 before 2.1 and was missing 2.2, 2.3, 2.10 — fixed
- **Parking Lot restructured** by phase (3, 4, 5/Future) — removed all active Phase 2 items from it, removed stale "Settings UI full" entry (1.4 done)
- Status doc now accurately mirrors brain-roadmap.md build order cheat sheet

---
**Edit 2026-03-10 (session 5 — Phase 1.3 fully complete, Phase 1.4 starts):**
- Version bumped to **6.4** (Phase 1.3 Complete)
- Phase 1.3 scope was broader than previously recorded — full completion includes:
  - **Goal tagging** — QuickTagRow on each goal in Manage Goals modal (`entity_type='goal'`)
  - **File tagging** — QuickTagRow in Hub editor header bar for active file (`entity_type='file'`, `entity_id='${projectId}/${filePath}'`)
  - **🏷 Tags brain tab** — tag cloud with entity counts; click any tag to see ALL entities tagged with it across every type (projects, ideas, staging, goals, files) with click-to-navigate
  - **🔗 Links hub tab** — per-project: create/view/delete entity relationships (parent/child/supports/blocks/related) linking to projects/ideas/staging/goals; auto-loads when hub opens
  - **BRAIN_TABS** updated: Tags tab added with count badge
  - **HUB_TABS** updated: Links tab added with count badge
- Commit: `72fdfb9` — all Phase 1.3 completion code
- Phase 1.3 done-condition met: tag "health" on a project → Tags tab → see all entities tagged "health" across every type. Link Project A as parent of Project B via Hub → Links tab.
- **Phase 1.4 (Settings system) is now next**
- Priority stack section 9 updated:
  - Phase 1.3 entry updated to reflect full completion
  - Phase 1.4 is #1 next action
- Phase 1.3 (Tagging & Linking) code confirmed deployed: migrations v8–v10, API handlers, QuickTagRow/TagPill UI on project/idea/staging cards
- Version bumped to 6.3 (Phase 1.3 Deployed)
- **Bug found & fixed:** POST `/api/data?resource=entity-tags` was returning `{success,tag_id}` only — missing `name`, `color`, `entity_type`, `entity_id`. TheBrain.jsx `attachTag()` spreads the response into `entityTags` state; without those fields, `getEntityTags()` (which filters by `entity_type`+`entity_id`) never found the new tag, so tag pills never appeared. Fixed by fetching tag name/color from DB after insert and returning the full record.
- DB tables confirmed present in production (migrations ran successfully)
- Phase 1.3 now fully operational — tags attach/detach/persist on projects, ideas, staging items
- **Next priorities:** Phase 1.4 (Settings system), Phase 0.9 completion (AI prompt caching + token logging)
- Priority stack updated below

---
**Edit 2026-03-09 (session 3 — status review):**
- Doc updated to reflect actual current codebase state (was stale — still showed Phase 0 bugs as open)
- Version bumped to 6.2 (Phase 1 Beta)
- Sections 2–6, 9 rewritten to reflect Phase 0.3–0.9 + Phase 1.0–1.2 completions
- DB schema updated: 14 tables now (added schema_migrations, life_areas, goals, goal_contributions, templates)
- What's Built section updated with Life Areas, Goals, Templates UI + Infrastructure additions
- Known Bugs section condensed: all Phase 0 bugs marked fixed, 4 open items remain (import, recently deleted UI, AI caching, token logging)
- Missing Features Tier 1 updated: Life Areas, Goals, Templates marked done; Tagging/Links noted as next
- Priority Stack rewritten: clear next-3-actions (1.3 Tags, 1.4 Settings, 0.9 completion), Phase 2 ordered
- .gitignore added to repo (excludes dist/, node_modules/, .env*, logs)
