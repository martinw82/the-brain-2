************APPEND AND ANNOTATE ALL EDITS************

# THE BRAIN — Master Status Document

**Version:** 8.2 (Phase 4.4 Complete — Notification System)
**Live URL:** the-brain-2.vercel.app
**Last Updated:** 2026-03-12
**Status:** Beta — All Phase 0, Phase 1, Phase 2.1–2.10, Phase 3.1–3.6, and Phase 4.1–4.4 complete; Phase 5 ready when needed

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

## 3. Database Schema (21 tables)

**Core (original):**
- **users** — email, password_hash, name, goal, monthly_target, currency, timezone, `settings` JSON (theme, font_family, font_size, sidebar_width, default_template_id, etc.)
- **projects** — slug IDs, phase, priority, health, momentum, revenue_ready, blockers/tags/skills (JSON), active_file, `life_area_id` FK
- **project_custom_folders** — per-project folder structure
- **project_files** — LONGTEXT content, full-text search indexed, `deleted_at` for soft deletes
- **staging** — review pipeline items, tagged, linked to projects, `folder_path`/`filed_at` for Phase 2.3 filing
- **ideas** — scored idea bank (1-10)
- **sessions** — work session logging with duration and notes
- **comments** — per-file comments with resolved flag
- **refresh_tokens** — auth token store

**Phase 1 additions:**
- **schema_migrations** — versioned migration tracking (v1–v12)
- **life_areas** — "Parts" entities (Business, Health, Relationships, Creative, Personal) with health_score
- **goals** — configurable financial/personal goals (title, target_amount, currency, timeframe, status)
- **goal_contributions** — project contributions toward a goal (amount, date, notes)
- **tags** — user-created tags with color and category
- **entity_tags** — junction: tags attached to any entity type (project/idea/staging/goal/file)
- **entity_links** — entity relationships (parent/child/supports/blocks/related)
- **templates** — project structure templates with JSON config (phases, folders, files, skills)

**Phase 2 additions:**
- **file_metadata** — per-file category, status, JSON custom fields (Phase 2.3)
- **sync_state** + **sync_file_state** — desktop folder sync state, conflict detection (Phase 2.4B)
- **daily_checkins** — daily user state: sleep_hours, energy_level, gut_symptoms, training_done, notes (Phase 2.5; migration v12)
- **training_logs** — training sessions: date, duration_minutes, type (solo/class/sparring/conditioning/other), notes, energy_after (Phase 2.6; migration v13)
- **outreach_log** — outreach actions: date, type (message/post/call/email/other), target, project_id, notes (Phase 2.7; migration v14)
- **weekly_reviews** — weekly review snapshots: week_start, what_shipped, what_blocked, next_priority, ai_analysis, data_json (Phase 2.9; migration v15)
- **drift_detection** — computed on-demand via `resource=drift-check` API, no table needed (Phase 2.10)
- **ai_metadata_suggestions** — computed on-demand via `resource=ai-metadata-suggestions` API, no table needed (Phase 3.1)
- **mermaid_diagrams** — rendered client-side via CDN, no table needed (Phase 3.2)
- **search_improvements** — enhanced search modal with highlighting, filters, recent searches; localStorage only (Phase 3.3)
- **sync_state** — `sync_state` and `sync_file_state` tables, `resource=sync_state` API, desktop folder sync (Phase 3.4)
- **file_validity_checker** — HealthCheck component in Meta tab, structural validation, auto-fix (Phase 3.5)
- **script_execution** — ScriptRunner component, sandboxed JS execution, predefined scripts, /tools/ folder (Phase 3.6)
- **onboarding** — `onboarding_completed` flag in users table, 4-step wizard, interactive tour (Phase 4.2)
- **health_fitness_template** — New system template with phases: ASSESS → BUILD → MAINTAIN → OPTIMIZE (Phase 4.2)
- **github_integration** — `project_integrations` table, PAT auth, repo status + commits, connect/disconnect UI (Phase 4.3)
- **notifications** — `notifications` table with triggers for daily check-in, training goals, project health, staging items, drift alerts (Phase 4.4; migration v20)

---

## 4. What's Built & Working

### Brain-Level Features (11 tabs)
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
- **Notifications** — bell icon with unread badge in header, dropdown (desktop) / drawer (mobile), auto-triggered by daily check-in, training goals, project health, staging items, drift detection; click to navigate to relevant action

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

### Phase 2 Features (2.1–2.10)
- **Project Import (2.1)** — BUIDL format paste, JSON file upload, folder picker (File System Access API); conflict resolution with overwrite option; auto-navigate on success
- **Image & Binary File Handling (2.2)** — image viewer component (renders `<img>` for .png/.jpg/.gif/.svg/.webp), binary detection by extension, base64 upload via drag-drop into staging, download link for non-text files, size warning >500KB
- **Metadata Editor Panel (2.3)** — `file_metadata` table + API; collapsible right panel per file; category/status dropdowns; `folder_path`/`filed_at` fields on staging for "file to folder" flow; JSON custom fields extensible
- **Offline Mode / localStorage Fallback (2.4)** — full state cached to localStorage on load; DB-first with cache fallback; sync-on-reconnect; offline indicator in UI; `cache.js` + `sync.js` modules
- **Desktop File Sync (2.4B BONUS)** — `sync_state`/`sync_file_state` tables; `desktop-sync.js` module; folder handle persistence via `FolderSyncSetup.jsx`; conflict detection with `SyncReviewModal.jsx`
- **Daily Check-in System (2.5)** — `daily_checkins` table (migration v12); `DailyCheckinModal.jsx` with sleep/energy/gut sliders + training checkbox + notes; auto-prompts on first visit of day (tracked via localStorage `lastCheckinDate`); energy level emoji in top bar; check-in data passed to AI Coach for state-based task routing (energy ≤4 = low-complexity, 5-7 = shipping/outreach, 8+ = deep work); POST/GET `/api/data?resource=daily-checkins`
- **Training Log (2.6)** — `training_logs` table (migration v13); `TrainingLogModal.jsx` with type selector (solo/class/sparring/conditioning/other), duration + quick presets (30/45/60/90m), energy-after slider, notes; Command Centre training card: weekly sessions/minutes + progress bar toward 3/week target; 🥋 top bar indicator (click to log); auto-marks today's check-in `training_done=true`; weekly training count + below-target flag in AI Coach context; stats endpoint with weekly bucket aggregation
- **Outreach Tracking (2.7)** — `outreach_log` table (migration v14); `OutreachLogModal.jsx` with type selector (5 types), target input, optional project link, notes; Command Centre outreach card: today's count + weekly total + last 3 entries preview + ⚠ warning when none; 📣 top bar indicator (purple when done, dim when zero, click to log); AI Coach context includes outreach count + "NOT DONE (mandatory)" flag
- **Agent System Prompt Upgrade (2.8)** — `agent-config.json` (10 enforcement rules + state routing + model config); `buildSystemPrompt(userId, db)` in `api/ai.js` queries DB in parallel (user profile, active goal + progress %, today's check-in, training this week, outreach today, all projects compressed, last 3 sessions); Recovery/Steady/Power routing computed server-side; 4,000 token budget with auto-truncation; graceful fallback to rules-only if DB unavailable; `askAI()` now sends `{ prompt }` only — no client-side context
- **Weekly Review Automation (2.9)** — `weekly_reviews` table (migration v15); `WeeklyReviewPanel` with week navigation, 7 stat cards, sessions list, reflection fields (what shipped, what blocked, next priority), AI-generated analysis, save to DB
- **Drift Detection (2.10)** — `resource=drift-check` API with 5 detection rules (training deficit, outreach gap, energy decline, session gap, stagnant project); drift alerts in Command Centre with dismiss functionality; drift flags included in AI Coach context

### Phase 3 Features
- **AI Metadata Suggestions (3.1)** — `resource=ai-metadata-suggestions` API endpoint; AI analyzes file content and suggests category, status, tags; suggestions shown in MetadataEditor panel as purple dashed pills; click to accept; ignores files matching patterns (node_modules, .git, etc.); content truncated to 3000 chars; confidence score displayed
- **Mermaid Diagram Rendering (3.2)** — Mermaid loaded via CDN in index.html; `MermaidRenderer` component renders diagrams as SVG; `MarkdownPreview` component splits content and renders mermaid blocks; `renderMd` detects and extracts mermaid code blocks; default `system/DEPENDENCY_GRAPH.md` template with example diagrams (system architecture, data flow, project dependencies); MERMAID badge shown in editor when file contains diagrams
- **Search Improvements (3.3)** — Enhanced search API with filters (project, folder, file type), highlighted excerpts, grouped results by project; `SearchModal` component with Cmd+K shortcut, recent searches (localStorage), filter dropdowns, highlighted match terms; search button with keyboard shortcut hint; debounced search with loading indicator
- **Local File System Sync (3.4)** — `sync_state` and `sync_file_state` tables (migrations v16, v17); `resource=sync_state` API endpoints (GET/POST/PUT/DELETE); `desktop-sync.js` module with `selectFolder()`, `saveFolderHandle()`, `syncFiles()`, conflict detection; `FolderSyncSetup` component in Meta tab for folder connection; `SyncReviewModal` for conflict resolution; File System Access API for desktop folder access; bi-directional sync with overwrite confirmation
- **File Validity Checker (3.5)** — `HealthCheck` component in Meta tab; checks for required files (PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json), valid manifest.json JSON, manifest-project state consistency, orphaned files (not in any folder), template-required folders, missing .gitkeep files; shows error/warning/info counts; auto-fix for missing files with default content; expandable panel with detailed issue list
- **Script Execution (3.6)** — `ScriptRunner` component in Meta tab; `/tools/` folder in default project files with predefined scripts (export-zip.js, word-count.js, list-todos.js); `resource=scripts` API endpoint with sandboxed JavaScript execution; safety controls (30s timeout, no network access, whitelisted globals); quick scripts (Word Count, List TODOs, Stats); custom script selection from tools/ folder; output display panel

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

✅ **Image handling (2.2)** — DONE (2026-03-11). Image viewer renders inline for .png/.jpg/.gif/.svg/.webp. Binary detection, base64 upload, download link for non-image binaries.

✅ **Metadata editor panel (2.3)** — DONE (2026-03-11). `file_metadata` table + API + collapsible right panel. Category/status/custom fields per file. Staging items can be filed to project folders with `folder_path`.

✅ **Project import (2.1)** — DONE (2026-03-11). BUIDL format paste, JSON upload, folder picker. Conflict resolution, auto-navigate on success.

✅ **Offline mode / localStorage fallback (2.4)** — DONE (2026-03-11). Full state cached; DB-first with offline fallback; sync on reconnect; offline indicator.

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

### Daily Check-In Protocol ✅ BUILT (Phase 2.5)
- `DailyCheckinModal.jsx` prompts on first visit of day
- Fields: sleep hours (0-24), energy slider (0-10), gut symptoms slider (0-10), training done checkbox, notes
- Energy emoji shown in top bar (🌙/🔄/⚡ based on level)
- Check-in data passed to AI Coach: energy ≤4 = low-complexity only, 5-7 = shipping/outreach, 8+ = deep work
- DB: `daily_checkins` table (migration v12), POST/GET via `/api/data?resource=daily-checkins`

### Training as Infrastructure (designed, not yet tracked — Phase 2.6 next)
- Training is not optional — it's revenue infrastructure (combat sports → cognitive function → shipping capacity)
- Weekly minimum: 3 × 30-minute solo sessions
- Track correlation: training days vs cognitive performance days
- Drift detection: 2 consecutive missed weeks triggers root-cause analysis

### What needs building for the agent layer
- ✅ **Daily check-in fields** — `daily_checkins` table, modal UI, energy routing (Phase 2.5 DONE)
- ✅ **Training log** — `training_logs` table, `TrainingLogModal`, weekly count in top bar + Command Centre card (Phase 2.6 DONE)
- ✅ **Outreach tracking** — `outreach_log` table, `OutreachLogModal`, daily indicator in top bar + Command Centre card, AI coach mandatory enforcement (Phase 2.7 DONE)
- ✅ **Agent system prompt upgrade + context compression** — `agent-config.json` (10 rules + state routing), `buildSystemPrompt()` in `api/ai.js` queries DB server-side, 4k token budget, Recovery/Steady/Power routing, graceful fallback (Phase 2.8 DONE)
- ✅ **Weekly review automation** — `weekly_reviews` table, `WeeklyReviewPanel` (week nav, 7 stat cards, sessions list, reflection fields, AI generate, save), upsert API (Phase 2.9 DONE)
- ✅ **Drift detection** — `resource=drift-check` API with 5 detection rules, drift alerts in Command Centre, drift flags in AI coach context (Phase 2.10 DONE)

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

### Completed (Phase 2 — so far)
- ✅ **Phase 2.1 — Project import** (2026-03-11) — BUIDL format paste, JSON file upload, folder picker; conflict resolution modal
- ✅ **Phase 2.2 — Image & binary file handling** (2026-03-11) — image viewer, binary detection, base64 upload, download link
- ✅ **Phase 2.3 — Metadata editor panel** (2026-03-11) — `file_metadata` table, collapsible panel, category/status/custom fields, staging filing
- ✅ **Phase 2.4 — Offline mode / localStorage fallback** (2026-03-11) — cache layer, sync module, offline indicator
- ✅ **Phase 2.4B — Desktop file sync (BONUS)** (2026-03-11) — folder handle sync, conflict detection, `SyncReviewModal`
- ✅ **Phase 2.5 — Daily check-in system** (2026-03-11) — `daily_checkins` table (migration v12), `DailyCheckinModal`, energy routing, top bar indicator
- ✅ **Phase 2.6 — Training log** (2026-03-11) — `training_logs` table (migration v13), `TrainingLogModal`, Command Centre card, 🥋 top bar indicator, AI Coach context integration
- ✅ **Phase 2.7 — Outreach tracking** (2026-03-11) — `outreach_log` table (migration v14), `OutreachLogModal`, Command Centre card, 📣 top bar indicator, AI Coach mandatory enforcement
- ✅ **Phase 2.8 — Agent system prompt upgrade** (2026-03-11) — `agent-config.json`, `buildSystemPrompt()` in `api/ai.js`, DB-driven context, 4k token budget, Recovery/Steady/Power routing
- ✅ **Phase 2.9 — Weekly review automation** (2026-03-11) — `weekly_reviews` table (migration v15), `resource=weekly-review` API (aggregation + upsert), `WeeklyReviewPanel` (week nav, stats, sessions, reflection, AI generate, save)
- ✅ **Phase 2.10 — Drift detection** (2026-03-11) — `resource=drift-check` API with 5 detection rules, drift alerts in Command Centre with dismiss, drift flags in AI context

### Completed (Phase 3 — so far)
- ✅ **Phase 3.1 — AI metadata suggestions** (2026-03-11) — `resource=ai-metadata-suggestions` API endpoint; AI analyzes file content and suggests category, status, tags; suggestions shown in MetadataEditor panel as purple dashed pills; click to accept; ignores files matching patterns (node_modules, .git, etc.); content truncated to 3000 chars; confidence score displayed
- ✅ **Phase 3.2 — Mermaid diagram rendering** (2026-03-11) — Mermaid loaded via CDN; `MermaidRenderer` component renders diagrams as SVG; `MarkdownPreview` component splits content and renders mermaid blocks; default `system/DEPENDENCY_GRAPH.md` template with example diagrams
- ✅ **Phase 3.3 — Search improvements** (2026-03-11) — Enhanced search API with filters (project, folder, file type), highlighted excerpts, grouped results by project; `SearchModal` component with Cmd+K shortcut, recent searches (localStorage), filter dropdowns, highlighted match terms
- ✅ **Phase 3.4 — Local file system sync** (2026-03-11) — `sync_state`/`sync_file_state` tables (migrations v16, v17); `resource=sync_state` API; `desktop-sync.js` module; `FolderSyncSetup` component in Meta tab; `SyncReviewModal` for conflict resolution; File System Access API integration
- ✅ **Phase 3.5 — File validity checker** (2026-03-11) — `HealthCheck` component in Meta tab; checks required files, valid manifest.json, orphaned files, template folders; error/warning/info classification; auto-fix for missing files; expandable results panel
- ✅ **Phase 3.6 — Script execution** (2026-03-11) — `ScriptRunner` component in Meta tab; `/tools/` folder with predefined scripts; `resource=scripts` API with sandboxed JS execution; safety controls; quick scripts and custom script support

### Next Up — Phase 4
1. **Phase 4.1 — Mobile responsive layout** ← NEXT — Breakpoints, mobile nav, touch targets

### Parking Lot
**Phase 3:**
- ✅ ALL COMPLETE (3.1–3.6)

**Phase 4:**
- Mobile responsive layout (4.1) — NEXT
- Onboarding flow (4.2)
- Integration connectors (4.3)
- Notification system (4.4)
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
**Edit 2026-03-11 (session 19 — Phase 3.6 Script Execution complete):**
- Version bumped to **7.8** (Phase 3.6 Complete — Script Execution)
- No new DB table — scripts are files stored in project
- API: New `resource=scripts` endpoint in `api/data.js` with sandboxed JavaScript execution
- Safety: 30-second timeout, whitelisted languages (javascript/python), no network access (fetch, XHR, WebSocket disabled), restricted globals (no Buffer, process, require, timers)
- Client: `ScriptRunner` component in Meta tab; predefined quick scripts (Word Count, List TODOs, Stats); custom script selection from `/tools/` folder; script metadata extraction; output display panel
- Default files: Added `/tools/` folder to `STANDARD_FOLDERS`; predefined scripts (export-zip.js, word-count.js, list-todos.js) with metadata exports
- Integration: Added above Health Check in Meta tab
- Priority Stack: 3.6 moved to Completed (Phase 3 Features section); Phase 3 complete! Next Up now Phase 4.1 (Mobile Responsive Layout)
- Next: **Phase 4.1 — Mobile Responsive Layout**

---
**Edit 2026-03-11 (session 18 — Phase 3.5 File Validity Checker complete):**
- Version bumped to **7.7** (Phase 3.5 Complete — File Validity Checker)
- No new DB table — health check is client-side only using existing project data
- Component: New `HealthCheck` component in `src/TheBrain.jsx`; checks required files (PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json), valid JSON in manifest.json, manifest-project state consistency, orphaned files (not in any folder), template-required folders, missing .gitkeep files
- UI: "🏥 Health Check" section in Meta tab; error/warning/info badge counts; "Check" button runs validation; expandable panel shows detailed issues; auto-fix button for missing files
- Auto-fix: Creates missing required files with default content; creates missing .gitkeep files
- Priority Stack: 3.5 moved to Completed (Phase 3 Features section); Next Up now Phase 3.6 (Script Execution)
- Next: **Phase 3.6 — Script Execution**

---
**Edit 2026-03-11 (session 17 — Phase 3.4 Local File System Sync complete):**
- Version bumped to **7.6** (Phase 3.4 Complete — Local File System Sync)
- DB schema: 23 tables; added `sync_state` and `sync_file_state` (migrations v16, v17)
- API: New `resource=sync_state` endpoints (GET/POST/PUT/DELETE) in `api/data.js`
- Core components already existed from Phase 2.4B: `desktop-sync.js` module, `FolderSyncSetup.jsx`, `SyncReviewModal.jsx`
- Integration: `FolderSyncSetup` component in Meta tab for folder connection; sync status badge; last sync time display
- Features: File System Access API for desktop folder selection; bi-directional sync; conflict detection with desktop/cloud choice; IndexedDB for handle persistence
- Priority Stack: 3.4 moved to Completed (Phase 3 Features section); Next Up now Phase 3.5 (File Validity Checker)
- Next: **Phase 3.5 — File Validity Checker**

---
**Edit 2026-03-11 (session 16 — Phase 3.3 Search Improvements complete):**
- Version bumped to **7.5** (Phase 3.3 Complete — Search Improvements)
- No new DB table — search uses existing `project_files` table
- API: Enhanced `resource=search` endpoint in `api/data.js` with filters (project_id, folder, file_type), highlighted excerpts, grouped results by project
- Client: `searchApi.query()` updated to accept filter object; `runSearch()` uses new API
- UI: New `SearchModal` component (Cmd+K shortcut, recent searches from localStorage, filter dropdowns, highlighted match terms, grouped results); search button with ⌘K hint
- Keyboard shortcuts: Cmd/Ctrl+K opens search; ESC closes; debounced search with loading indicator
- Priority Stack: 3.3 moved to Completed (Phase 3 Features section); Next Up now Phase 3.4 (Local File System Sync)
- Next: **Phase 3.4 — Local File System Sync**

---
**Edit 2026-03-11 (session 15 — Phase 3.2 Mermaid Diagram Rendering complete):**
- Version bumped to **7.4** (Phase 3.2 Complete — Mermaid Diagram Rendering)
- No new DB table — diagrams rendered client-side via Mermaid CDN
- CDN: Added `mermaid@10` CDN script to index.html
- Components: `MermaidRenderer` component (SVG rendering, dark theme, error handling); `MarkdownPreview` component (splits content by mermaid blocks, renders interleaved HTML/diagrams)
- Integration: `MarkdownEditor` shows MERMAID badge when file contains diagrams; Preview mode uses `MarkdownPreview` instead of raw `renderMd`
- Template: Default `system/DEPENDENCY_GRAPH.md` with 3 example diagrams (system architecture flowchart, data flow sequence diagram, project dependencies graph)
- Features: Dark theme matching The Brain UI; error handling with helpful messages; supports flowcharts, sequence diagrams, Gantt charts
- Priority Stack: 3.2 moved to Completed (Phase 3 Features section); Next Up now Phase 3.3 (Search Improvements)
- Next: **Phase 3.3 — Search Improvements**

---
**Edit 2026-03-11 (session 14 — Phase 3.1 AI Metadata Suggestions complete):**
- Version bumped to **7.3** (Phase 3.1 Complete — AI Metadata Suggestions)
- No new DB table — suggestions computed on-demand via AI API
- API: `resource=ai-metadata-suggestions` endpoint in `api/data.js`; calls Anthropic API server-side; content truncated to 3000 chars; ignores files matching patterns (node_modules, .git, lockfiles)
- Client: `aiMetadata.suggest()` in `src/api.js`; `aiSuggestions` + `loadingAiSuggestions` state in TheBrain.jsx
- UI: MetadataEditor panel shows "🤖 AI Suggestions" section with refresh button; category/status suggestions as clickable purple dashed pills; tag suggestions with "(has)" indicator if already attached; confidence score displayed
- Integration: Accepting tag suggestion attaches via existing `tagsApi.attachByName()`; auto-save optional via `userSettings.aiMetadataAutoSuggest`
- Priority Stack: 3.1 moved to Completed (Phase 3 Features section); Next Up now Phase 3.2 (Mermaid Diagram Rendering)

---
**Edit 2026-03-11 (session 13 — Phase 2.10 Drift Detection complete):**
- Version bumped to **7.2** (Phase 2.10 Complete — Drift Detection)
- DB schema: 21 tables (no new table — drift is computed on-demand)
- What's Built: added Drift Detection entry in Phase 2 additions + Agent Layer section
- API: `resource=drift-check` endpoint in `api/data.js` with 5 detection rules
- AI Integration: drift flags computed in `buildSystemPrompt()` and included in context
- UI: drift alerts in Command Centre with dismiss functionality, persists dismissed state in localStorage
- Priority Stack: 2.10 moved to Completed; Next Up now Phase 3.1 (AI Metadata Suggestions)
- Next: **Phase 3.1 — AI Metadata Suggestions**

---
**Edit 2026-03-11 (session 12 — Phase 2.9 Weekly Review Automation complete):**
- Version bumped to **7.1** (Phase 2.9 Complete — Weekly Review Automation)
- DB schema: 20 → 21 tables; added `weekly_reviews` (migration v15)
- What's Built: added Weekly Reviews entry in Phase 2 additions + Agent Layer section
- Priority Stack: 2.9 moved to Completed; Next Up now 2.10 (Drift Detection)
- Next: **Phase 2.10 — Drift Detection**

---
**Edit 2026-03-11 (session 11 — Phase 2.8 Agent Upgrade complete):**
- Version bumped to **7.0** (Phase 2.8 Complete — Agent Upgrade)
- What's Built: added Agent System Prompt Upgrade (2.8) entry
- Agent Layer: all agent infrastructure items now DONE (2.5–2.8)
- Priority Stack: 2.8 moved to Completed; Next Up now 2.9 (Weekly Review)
- Next: **Phase 2.9 — Weekly Review Automation**

---
**Edit 2026-03-11 (session 10 — Phase 2.7 Outreach Tracking complete):**
- Version bumped to **6.9** (Phase 2.7 Complete)
- DB schema: 19 → 20 tables; added `outreach_log` (migration v14)
- What's Built: added Outreach Tracking (2.7) entry in Phase 2 Features block
- Agent Layer: outreach updated from pending to DONE
- Priority Stack: 2.7 moved to Completed; Next Up now 2.8 (Agent Prompt Upgrade)
- Next: **Phase 2.8 — Agent System Prompt Upgrade + Context Compression**

---
**Edit 2026-03-11 (session 9 — Phase 2.6 Training Log complete):**
- Version bumped to **6.8** (Phase 2.6 Complete)
- DB schema: 18 → 19 tables; added `training_logs` (migration v13)
- What's Built: added Training Log (2.6) entry in Phase 2 Features block
- Agent Layer: Training log updated from "NEXT" to "DONE"
- Priority Stack: 2.6 moved to Completed; Next Up now 2.7 (Outreach Tracking)
- Next: **Phase 2.7 — Outreach Tracking**

---
**Edit 2026-03-11 (session 8 — Phase 2.5 complete, docs updated to reflect 2.1–2.5):**
- Version bumped to **6.7** (Phase 2.5 Complete)
- **Bug fixed:** `daily_checkins` table was missing from `scripts/migrate.js` and `schema.sql` — the Phase 2.5 code (Drizzle schema, API routes, UI) was complete but the DB migration was never written. Added migration v12 and CREATE TABLE in schema.sql.
- **DB Schema section** updated: 14 → 18 tables; added file_metadata, sync_state, sync_file_state, daily_checkins with notes on which phase added each
- **What's Built section** updated: added Phase 2 Features block documenting 2.1–2.5 completions
- **Missing Features Tier 2** updated: image handling (2.2), metadata editor (2.3), project import (2.1), offline mode (2.4) all marked ✅ DONE
- **Agent Layer section** updated: Daily Check-In Protocol changed from "not yet built" to "✅ BUILT (Phase 2.5)"; Training log and others updated with correct phase references
- **Priority Stack** fully rewritten: added "Completed Phase 2 so far" block (2.1–2.5), "Next Up" now starts at 2.6 (Training Log)
- Next: **Phase 2.6 — Training Log**

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
