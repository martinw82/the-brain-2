# THE BRAIN — Implementation Roadmap

**Companion to:** BRAIN_STATUS.md
**Purpose:** Step-by-step task list to reach feature-complete. Design/GUI is out of scope — this is purely functional.
**Principle:** Build foundations that things can be built on top of. Every feature should be a module, not a monolith.

---

## How to read this document

- Tasks are in dependency order — earlier tasks unblock later ones
- Each task has a concrete definition of done
- `[DB]` = needs schema change
- `[API]` = needs new or modified API route
- `[UI]` = needs frontend component work
- `[CONFIG]` = needs configuration/environment change
- Tasks marked `[EXTENSIBLE]` are specifically designed as foundations other features plug into

---

## PHASE 0 — Bug Fixes (unblocks everything)

_Nothing new can be built reliably until these are resolved._

### 0.1 Fix file loading from DB on initial render ✅ COMPLETE (2026-03-08)
- [x] Audit `App.jsx` → confirm it calls the projects API on mount
- [x] Audit `api.js` → confirm `projects.list()` fetches files for each project (or has a separate `projects.getFiles(projectId)` call)
- [x] Audit the serverless function → confirm it joins `project_files` when returning projects
- [x] If files are fetched separately: add a loading state so TheBrain.jsx waits for files before rendering FileTree
- [x] Verify: reload the app → file tree shows all files for all projects
- **Done when:** Browser refresh shows full file tree with all saved content
- **How:** `api/projects.js` list returns `files: null` (lightweight). `openHub()` lazy-loads via `projectsApi.get(id)`. `mapProject()` helper centralises snake→camelCase.

### 0.2 Fix comments loading from DB ✅ COMPLETE (2026-03-08)
- [x] Add `useEffect` in TheBrain.jsx that fetches comments when `hubId` or `hub.activeFile` changes
- [x] Call `commentsApi.list(hubId, hub.activeFile)` (or equivalent)
- [x] Populate `comments` state with the response
- [x] Handle loading state (don't flash "No comments" before fetch completes)
- **Done when:** Comments survive a page reload
- **How:** `useEffect` watches `[hubId, hub?.activeFile]`, maps DB rows (`created_at` → `date`, `resolved` 0/1 → boolean), `commentsLoading` state gates the "No comments" empty state.

### 0.3 Build AI Coach proxy function ✅ COMPLETE (2026-03-08)
- [x] Create serverless function: `/api/ai` (Vercel) or `netlify/functions/ai.js`
- [x] Accepts POST with `{ prompt, context }` body
- [x] Reads `ANTHROPIC_API_KEY` from server-side env (not VITE_ prefixed)
- [x] Calls Anthropic API server-side, returns response
- [x] Update `askAI()` in TheBrain.jsx to call `/api/ai` instead of Anthropic directly
- [x] Remove `VITE_ANTHROPIC_KEY` from `.env.example`
- **Done when:** AI Coach works without exposing API key in browser network tab

### 0.4 Fix rename project stale reference ✅ COMPLETE (2026-03-08)
- [x] In `renameProject()`, use functional updater or read from the updated state after `setProjects`
- [x] Or: build the new file content from parameters rather than reading from `projects` array
- **Done when:** Renaming a project correctly updates PROJECT_OVERVIEW.md and manifest.json in DB

### 0.5 Add beforeunload handler for session timer ✅ COMPLETE (2026-03-08)
- [x] Add `useEffect` with `window.addEventListener('beforeunload', ...)` when `sessionActive` is true
- [x] On unload: save session to DB via `navigator.sendBeacon` or sync XHR
- [x] Clean up listener when session ends
- **Done when:** Closing tab mid-session still logs the session to DB

### 0.6 Add Bootstrap Wizard null check ✅ COMPLETE (2026-03-08)
- [x] In `completeBootstrap()`, guard against `projects.find()` returning undefined
- [x] Show toast error if project not found
- **Done when:** Completing bootstrap on a deleted/missing project shows error instead of silent failure

### 0.7 Add soft deletes to project_files `[DB]` ✅ COMPLETE (2026-03-08)
- [x] Add `deleted_at DATETIME DEFAULT NULL` column to `project_files` table
- [x] Update `deleteFile()` API to SET `deleted_at = NOW()` instead of DELETE
- [x] Update all file queries to include `WHERE deleted_at IS NULL`
- [ ] Add "Recently Deleted" option in project Meta tab (optional, can build UI later)
- [ ] Cleanup rule: hard-delete files where `deleted_at` older than 30 days
- **Done when:** Deleting a file is recoverable within 30 days

### 0.8 Add debounced saves to markdown editor `[UI]` ✅ COMPLETE (2026-03-08)
- [x] In `MarkdownEditor`, debounce the `onChange` handler (1.5-2 seconds)
- [x] Show "unsaved changes" indicator while debounce is pending
- [x] Manual Save button still triggers immediate persist
- [x] Prevents hammering TiDB on every keystroke
- **Done when:** Typing in the editor doesn't fire a DB write per character

### 0.9 Add rate limiting and caching to AI proxy `[API]` ✅ PARTIAL (2026-03-08)
- [x] Rate limit: max 10 AI calls per minute per user (return 429 if exceeded)
- [ ] Cache: hash the prompt — if same hash within 5 minutes, return cached response
- [ ] Token logging: log model, input_tokens, output_tokens per call (server logs minimum, `ai_usage` table ideally)
- [x] Frontend: show "Rate limited, try again shortly" instead of generic error (via error message display)
- **Done when:** AI Coach can't accidentally run up a large bill from repeated/looped calls

---

## PHASE 0.5 — Critical Path Tests (before building new features)

_Not a full test suite — just the 3 paths where data loss would destroy trust._

- [ ] **Test: File save/load round-trip** — create file via API, reload app, verify content matches
- [ ] **Test: Comment persistence** — add comment, reload, verify it appears
- [ ] **Test: Session logging** — start session, end it, verify it persists in DB and appends to DEVLOG.md
- [x] **DB migration versioning:** Create `schema_migrations` table to track which ALTER/CREATE statements have run (Applied 2026-03-08)
- [ ] Write as simple Node scripts runnable via `npm run test:critical` — no framework needed

---

## PHASE 1 — Extensible Foundations

_These are the base systems that everything else plugs into. Get these right and every future feature is easier._

### 1.0 [EXTENSIBLE] Life Areas ("Parts") `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

The core philosophy is Life > Parts > Things. Without Parts as first-class entities, this is a project manager, not a life OS.

- [x] **Schema:** Create `life_areas` table:
  ```
  id, user_id, name, color, icon,
  description,
  target_hours_weekly (int, nullable),
  health_score (int, 0-100, auto-calculated),
  sort_order (int),
  created_at, updated_at
  ```
- [x] **Schema:** Add `life_area_id VARCHAR(36) NULLABLE` to `projects` table (FK to life_areas)
- [x] **Seed defaults** on first user creation (user can rename/delete):
  - Business / Revenue (💼)
  - Health / Body (🏋️)
  - Relationships (❤️)
  - Creative / Learning (🎨)
  - Personal / Admin (🏠)
- [x] **API:** CRUD routes for life areas (`/api/areas`)
- [x] **API:** Assign/unassign project to area (`/api/projects/:id` update with `life_area_id`)
- [x] **Health calculation:** Area health = weighted average of its projects' health scores
- [x] **UI:** Life area pills/tabs in Command Centre — click to filter projects by area
- [x] **UI:** Area assignment dropdown in project creation and project overview
- [x] **UI:** Area health summary card — shows all areas with health bars
- [ ] **Agent integration:** AI Coach receives area context — can say "Business is strong but Health is declining" and route advice accordingly
- [ ] **Allow projects to belong to multiple areas** via the tagging system (Phase 1.3) as an alternative to the FK — both paths should work
- **Done when:** You can see a dashboard that says "Business: 65%, Health: 30%, Creative: 80%" and filter projects by life area

### 1.1 [EXTENSIBLE] Generic goal system `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

Replace the hardcoded Thailand/£3k tracker with a configurable goal engine.

- [x] **Schema:** Create `goals` table:
  ```
  id, user_id, title, target_amount, current_amount,
  currency, timeframe (monthly/yearly/total),
  category (income/savings/debt/custom),
  status (active/achieved/paused),
  created_at, updated_at
  ```
- [x] **Schema:** Create `goal_contributions` table:
  ```
  id, goal_id, project_id (nullable), source_label,
  amount, date, notes
  ```
- [x] **API:** CRUD routes for goals (`/api/goals`)
- [x] **API:** CRUD routes for contributions (`/api/goals/:id/contributions`)
- [x] **UI:** Replace hardcoded `THAILAND_TARGET` with `user.goals[0]` (or active goal)
- [x] **UI:** Progress bar reads from goal data, not project income_target sum
- [x] **UI:** Goal configuration in a modal (title, amount, currency, timeframe)
- [ ] **UI:** Link projects to goals with contribution amounts (Manual contributions implemented)
- [x] Remove all hardcoded `£`, `GBP`, `3000`, `THAILAND` references — read from goal/user config
- **Done when:** A new user can set their own financial goal in any currency and track projects against it

### 1.2 [EXTENSIBLE] Template system `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

Make project structure configurable rather than one-size-fits-all.

- [x] **Schema:** Create `templates` table:
  ```
  id, user_id (null = system template), name, description,
  icon, category,
  config JSON: {
    phases: [...],           -- e.g. BUIDL phases, or custom
    standard_folders: [...], -- which folders to create
    default_files: {...},    -- which files to generate
    skills: [...],           -- which agent skills apply
    workflows: [...],        -- which workflows apply
    metadata_schema: {...}   -- what fields projects of this type track
  },
  is_system (boolean),
  created_at
  ```
- [x] **Seed system templates:**
  - BUIDL Framework (current default — phases, all folders, all skills)
  - Software Project (phases: planning/dev/testing/deployed, code-focused folders)
  - Content Project (phases: research/draft/review/published, content-focused folders)
  - Business / Revenue (phases: validate/build/launch/grow, marketing + analytics folders)
  - Personal Goal (phases: define/plan/execute/maintain, minimal folders)
  - Blank (no phases, no default files beyond PROJECT_OVERVIEW.md)
- [x] **API:** CRUD routes for templates (`/api/templates`)
- [x] **API:** "Save as template" logic — UI extracts project structure into a new template
- [x] **UI:** Template selector in New Project modal (before Bootstrap Wizard)
- [x] **UI:** "Save as Template" button in project Meta tab
- [x] **Refactor:** `makeProject()` and `makeDefaultFiles()` read from template config instead of hardcoded constants
- [x] **Refactor:** `BUIDL_PHASES` becomes `template.config.phases` — if template has no phases, phase UI is hidden
- [x] **Refactor:** `STANDARD_FOLDERS` becomes `template.config.standard_folders`
- [x] **Validation:** Simple runtime checks for configuration JSON.
- **Done when:** Creating a new project lets you pick a template, and projects without BUIDL phases work correctly with no phase-related UI showing

### 1.3 [EXTENSIBLE] Tagging and linking system `[DB]` `[API]` ✅ COMPLETE (2026-03-10)

Foundation for the "Things belong to multiple Parts" philosophy.

- [x] **Schema:** Create `tags` table (migration v8)
- [x] **Schema:** Create `entity_tags` junction table (migration v9)
- [x] **Schema:** Create `entity_links` table (migration v10)
- [x] **API:** CRUD for tags (`/api/tags`)
- [x] **API:** Tag/untag any entity (`/api/tags/:id/attach`, `/api/tags/:id/detach`)
- [x] **API:** Link/unlink entities (`/api/links`)
- [x] **API:** Query: "get all entities with tag X" and "get all links for entity Y"
- [x] **UI:** QuickTagRow on project/idea/staging/goal/file cards — type to search/create, Enter to attach, × to remove
- [x] **UI:** 🏷 Tags brain tab — tag cloud + cross-entity query, click to navigate
- [x] **UI:** 🔗 Links hub tab — create/view/delete entity relationships (parent/child/supports/blocks/related)
- **Done when:** ✓ Tag "health" on a project → Tags tab → see all entities tagged "health" across every type. Link Project A as parent of Project B.
- **Bug fixed post-completion:** POST entity-tags was returning `{success,tag_id}` only — missing name/color/entity fields. Fixed to return full record so tag pills appeared correctly.

### 1.4 [EXTENSIBLE] Settings system `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-10)

User preferences stored in DB, with localStorage cache for speed.

- [x] **Schema:** Add `settings` JSON column to `users` table (migration v11)
- [x] **API:** GET/PUT `/api/settings`
- [x] **UI:** Settings modal (⚙ gear icon in header) with font family + font size options
- [x] **Cache:** Write to localStorage on save, read from localStorage on load
- [x] **Apply:** font-family and font-size applied globally from settings
- [ ] Theme class on root element, sidebar width as CSS variable — deferred to Phase 2 (not blocking)
- [ ] Keyboard shortcuts (Cmd+K, Cmd+N, Cmd+S) — deferred to Phase 3
- **Done when:** ✓ User can change font family + size, settings persist across sessions and devices

---

## PHASE 2 — Core Feature Completion

_Build out every functional feature discussed. Each one plugs into the Phase 1 foundations._

### 2.1 Project import `[UI]` `[API]` ✅ COMPLETE (2026-03-11)

- [x] **BUIDL format import:** Parse the existing export format (MANIFEST_START/FILES_START/etc.)
  - [x] Build parser function (`parseBuildlFormat()`)
  - [x] UI: textarea modal for paste import
  - [x] On import: create project in DB, save all files
- [x] **JSON import:** Accept a JSON file matching the project schema
  - [x] UI: file upload in import modal
  - [x] Validate structure, create project + files
- [x] **Folder import (File System Access API):**
  - [x] UI: "Import from folder" button that calls `window.showDirectoryPicker()`
  - [x] Recursively read directory contents
  - [x] Map to project structure (folder names → folder IDs where possible)
  - [x] Create project + files in DB
- [x] Wire up existing `importText`/`importError` state to the new UI
- [x] Conflict resolution: duplicate projectId shows modal with overwrite option
- **Done when:** All three import methods work and create a fully functional project with files in DB ✓

### 2.2 Image and binary file handling `[UI]` `[API]` ✅ COMPLETE (2026-03-11)

- [x] **Image viewer component:** Renders `<img>` tag for .png/.jpg/.gif/.svg/.webp extensions
- [x] **Binary detection:** Check file extension or content prefix (data:image, etc.)
- [x] **File tree icons:** Show image icon for image files
- [x] **Upload flow:** Dragging an image into staging stores as base64 data URI
- [x] **Download link:** Non-text, non-image files show a download button instead of editor
- [x] **Size limit:** Warns if file content exceeds 500KB as base64
- [x] **Architecture note:** Image viewer accepts both base64 data URIs and URLs — migration to object storage (S3/R2) is non-breaking
- **Done when:** ✓ Drag an image into a project, see it in the file tree, click it, see the image rendered

### 2.3 Metadata editor panel `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Component:** Collapsible metadata panel shown alongside the editor
- [x] **Fields:** category (dropdown), status (dropdown), tags (from tag system), last modified (auto), custom fields (key-value pairs via JSON)
- [x] **Storage:** Separate `file_metadata` table (Option B chosen) — per-file category, status, metadata_json
- [x] **UI:** Collapsible panel on the right side of the editor
- [x] **Save:** Metadata saves with optimistic pattern; `folder_path`/`filed_at` on staging items for filing flow
- **Done when:** ✓ Select a file, see its metadata, edit category/status, it persists in `file_metadata` table

### 2.4 Offline mode / localStorage fallback `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **On load:** Fetch from DB, write full state to localStorage as cache (`cache.js` module)
- [x] **On save:** Write to DB (primary) AND localStorage (cache)
- [x] **On DB failure:** Read from localStorage cache, show "offline" indicator in UI
- [x] **On reconnect:** Sync localStorage changes back to DB (`sync.js` module)
- [x] **Conflict resolution:** Timestamp comparison (last-write-wins with timestamp)
- [ ] **Unauthenticated mode:** If no JWT token, app works entirely from localStorage — deferred (not blocking)
- **Done when:** ✓ App works with no internet; data syncs when connection returns; offline indicator shown

### 2.4B Desktop file sync (BONUS) `[DB]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Schema:** `sync_state` + `sync_file_state` tables for tracking folder sync state
- [x] **Module:** `desktop-sync.js` — folder handle persistence, recursive read/write
- [x] **UI:** `FolderSyncSetup.jsx` — connect to local folder, save handle
- [x] **Conflict detection:** `SyncReviewModal.jsx` — review conflicts before applying sync
- **Done when:** ✓ Connect a local folder, sync project files to/from it with conflict review

### 2.5 Daily check-in system `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

Foundation for the agent layer's state-based task routing.

- [x] **Schema:** Create `daily_checkins` table (migration v12):
  ```
  id, user_id, date (unique per user per day),
  sleep_hours (0-24), energy_level (0-10), gut_symptoms (0-10),
  training_done (boolean), notes (text),
  created_at, updated_at
  ```
- [x] **API:** POST `/api/data?resource=daily-checkins` (upsert — create or update today's)
- [x] **API:** GET `/api/data?resource=daily-checkins&date=YYYY-MM-DD` (specific day)
- [x] **API:** GET `/api/data?resource=daily-checkins&days=N` (last N days history)
- [x] **UI:** `DailyCheckinModal.jsx` — auto-shows on first visit of day (localStorage `lastCheckinDate` gate)
- [x] **UI:** Sleep hours input, energy slider (🌙/🔄/⚡ emoji states), gut slider, training checkbox, notes textarea
- [x] **UI:** Energy level emoji + number shown in top bar
- [x] **Store:** Check-in data passed to AI Coach context for state-based task routing (energy ≤4 = low complexity, 5-7 = shipping/outreach, 8+ = deep work)
- **Done when:** ✓ Opening the app each day prompts a 30-second check-in; energy shows in top bar; data available to AI coach
- **Bug fixed (2026-03-11):** DB migration was missing from `scripts/migrate.js` — added as v12; also added CREATE TABLE to `schema.sql`

### 2.6 Training log `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Schema:** Create `training_logs` table (migration v13):
  ```
  id, user_id, date, duration_minutes,
  type (solo/class/sparring/conditioning/other),
  notes, energy_after (0-10),
  created_at, updated_at
  ```
- [x] **API:** GET `/api/data?resource=training-logs&days=N` — recent logs
- [x] **API:** GET `/api/data?resource=training-logs&weeks=N` — stats mode: weekly buckets, session counts, total minutes, avg energy_after
- [x] **API:** POST/PUT/DELETE CRUD via `/api/data?resource=training-logs`
- [x] **Client:** `trainingLogs.save/list/stats/update/delete` in `src/api.js`
- [x] **UI:** `TrainingLogModal.jsx` — type selector (5 types with emoji), duration input with quick presets (30/45/60/90m), energy-after slider, notes
- [x] **UI:** Training card in Command Centre — session count, total minutes, progress bar toward 3/week target, "+ Log Training" button
- [x] **UI:** 🥋 indicator in top bar showing weekly count (e.g., `2/3`), clickable to open log modal; green when ≥3, amber when ≥1, dim when 0
- [x] **Auto-sync:** Logging training auto-marks today's check-in `training_done = true`
- [x] **Correlation:** Weekly training data included in AI Coach context with "BELOW TARGET" flag if < 3 sessions
- **Done when:** ✓ Log training sessions, see weekly count in top bar and Command Centre card, AI coach references training data

### 2.7 Outreach tracking `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Schema:** Create `outreach_log` table (migration v14):
  ```
  id, user_id, date, type (message/post/call/email/other),
  target (person/platform/channel),
  project_id (nullable), notes, created_at
  ```
- [x] **API:** POST/DELETE via `/api/data?resource=outreach-log`
- [x] **API:** GET `?date=YYYY-MM-DD` (today's entries + count) and `?days=N` (recent with daily_counts map)
- [x] **Client:** `outreachLog.save/list/today/delete` in `src/api.js`
- [x] **UI:** `OutreachLogModal.jsx` — type selector (5 types), target input, optional project link, notes
- [x] **UI:** Outreach card in Command Centre — today's count + weekly total + last 3 entries preview; ⚠ "No outreach yet today" warning when empty
- [x] **UI:** 📣 indicator in top bar — purple when done, dim when zero; shows count or "none"; click to open log modal
- [x] **AI context:** Outreach today count + "NOT DONE (mandatory)" flag in AI Coach system prompt when no outreach logged
- **Done when:** ✓ Log outreach actions, see daily indicator in top bar and card, AI coach enforces mandatory daily minimum

### 2.8 Agent system prompt upgrade + context compression `[API]` `[CONFIG]` ✅ COMPLETE (2026-03-11)

- [x] **Create:** `agent-config.json` — 10 enforcement rules (ship or it doesn't exist, outreach mandatory, match work to state, revenue-ready priority, health score urgency, call the loop, sessions need deliverables, ideas to staging, life before projects, truth over comfort) + state routing table + model/token config
- [x] **Context compression:** Server-side builder queries DB directly — no file content sent; projects compressed to ~60 tokens each (name, phase, health, revenue_ready, next_action, blockers)
- [x] **Token budget:** 4,000 token cap with auto-truncation to top 6 projects if exceeded; rough estimate logged per call
- [x] **Build system prompt dynamically:** `buildSystemPrompt(userId, db)` in `api/ai.js` queries in parallel:
  - User profile (name, currency, monthly_target)
  - Active goal + contribution total + progress %
  - Today's check-in (energy, sleep, gut, training_done)
  - Training this week (count + minutes vs 3/week target)
  - Outreach today (count, mandatory flag if zero)
  - All projects (priority order, compressed single-line per project)
  - Last 3 sessions
- [x] **State-based routing:** Computed server-side — Recovery/Steady/Power mode with allowed/blocked task types
- [x] **Graceful fallback:** If DB query fails, falls back to identity + rules only (no crash)
- [x] **Client simplified:** `askAI()` now sends `{ prompt }` only — no client-side context building; skill briefings still pass their own `systemOverride`
- **Done when:** ✓ Ask "What should I work on today?" — response references real check-in energy, project health scores, outreach status, enforces the 10 rules

### 2.9 Weekly review automation `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **API:** `resource=weekly-review` GET — aggregates sessions, check-in averages, training count, outreach count, staging done, plus loads saved review
- [x] **DB:** `weekly_reviews` table — `week_start`, `what_shipped`, `what_blocked`, `next_priority`, `ai_analysis`, `data_json` (migration v15)
- [x] **UI:** "📋 Review" tab — week nav (prev/next), 7 stat cards, sessions list, reflection fields
- [x] **UI:** Editable reflection fields: what shipped, what blocked, next week's priority
- [x] **AI integration:** "Generate AI Review" button feeds week data + reflections to AI coach; result populates `ai_analysis` field
- [x] **Persist:** POST upserts to `weekly_reviews` table per user + week_start; "Save Review" button
- **Done when:** Every Sunday (or on demand), you can run a weekly review that shows real data and saves an AI-generated analysis ✅

### 2.10 Drift detection `[API]` ✅ COMPLETE (2026-03-11)

- [x] **Background check** (runs on login or daily): query last 14 days of check-ins + training + outreach
- [x] **Rules:**
  - Training < 3 sessions/week for 2 consecutive weeks → flag
  - Outreach = 0 for 5+ days → flag
  - Average energy declining over 7 days → flag
  - No sessions logged for 3+ days → flag
  - Same project focus for 14+ days with no health improvement → flag
- [x] **UI:** Drift alerts in command centre (similar to health alerts)
- [x] **AI integration:** Drift flags included in AI coach context so it can address them
- **Done when:** ✅ The system proactively warns when patterns are slipping, without you having to notice

---

## PHASE 3 — Intelligence & Power Features

_These make the tool genuinely powerful. Each plugs into the foundations from Phase 1-2._

### 3.1 AI metadata suggestions `[API]` ✅ COMPLETE (2026-03-11)

- [x] When a file is saved, optionally send content to AI proxy
- [x] AI returns suggested: category, tags, status, related projects
- [x] Show suggestions in metadata panel as "suggested" pills (click to accept)
- [x] Respect agent.ignore rules (don't analyse files in ignored folders)
- **Done when:** ✅ Saving a markdown file shows AI-suggested tags that you can accept with one click
- **How:** `resource=ai-metadata-suggestions` endpoint in `api/data.js`; Anthropic API call server-side; content truncated to 3000 chars; ignore patterns (node_modules, .git, lockfiles); suggestions shown in MetadataEditor as purple dashed pills with ✓ click-to-accept; confidence score displayed

### 3.2 Mermaid diagram rendering `[UI]` ✅ COMPLETE (2026-03-11)

- [x] Add `mermaid` library (CDN or npm)
- [x] Detect Mermaid code blocks in markdown (```mermaid)
- [x] Render as SVG in preview mode
- [x] Dedicated "Dependency Graph" file: `/system/DEPENDENCY_GRAPH.md`
- [ ] Optional: AI-generated diagram from SYSTEM_INDEX.md (as old version had) — deferred to Phase 4
- **Done when:** ✅ Mermaid diagrams render visually in markdown preview
- **How:** Mermaid loaded via CDN in index.html; `MermaidRenderer` component renders SVG with dark theme; `MarkdownPreview` splits content by mermaid blocks; default `system/DEPENDENCY_GRAPH.md` template with example diagrams

### 3.3 Search improvements `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Cross-project search:** Current search already queries DB full-text — extend to return results grouped by project
- [x] **Better result display:** Show matched line with highlighted search term
- [x] **Search filters:** by project, by folder, by file type, by tag
- [x] **Keyboard shortcut:** Cmd/Ctrl+K opens search
- [x] **Recent searches:** Store last 5 searches in localStorage
- **Done when:** ✅ Cmd+K opens a search that finds content across all projects with highlighted excerpts
- **How:** Enhanced `resource=search` API with filters and grouped results; `SearchModal` component with Cmd+K shortcut, recent searches, filter dropdowns, highlighted match terms

### 3.4 Local file system sync `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Connect:** `window.showDirectoryPicker()` → store handle in state
- [x] **Save to local:** Recursively write project files to connected folder
- [x] **Load from local:** Recursively read folder, update project in DB
- [x] **Sync indicator:** Show "connected to: /path/to/folder" in project meta
- [x] **Caution:** Overwrite confirmation before any destructive sync
- **Done when:** ✅ You can connect a local folder, save your project to it, and load changes back
- **How:** `sync_state`/`sync_file_state` tables (migrations v16, v17); `resource=sync_state` API endpoints; `desktop-sync.js` module with File System Access API integration; `FolderSyncSetup` component in Meta tab; `SyncReviewModal` for conflict resolution with desktop/cloud choice

### 3.5 File validity checker `[UI]` `[API]` ✅ COMPLETE (2026-03-11)

- [x] **Check:** Required files exist (PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json)
- [x] **Check:** manifest.json is valid JSON and matches project state
- [x] **Check:** No orphaned files (files in DB not referenced by any folder)
- [x] **Check:** Template-required folders exist
- [x] **UI:** "Health check" button in Meta tab, shows pass/fail list
- [x] **Auto-fix:** Offer to create missing required files with defaults
- **Done when:** ✅ Running a health check shows structural issues and can auto-fix them
- **How:** `HealthCheck` component in Meta tab; client-side validation using existing project data; checks required files, valid manifest.json, orphaned files, template folders, missing .gitkeep; error/warning/info classification; auto-fix creates files with default content

### 3.6 Script execution `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Schema:** Scripts stored as files in `/tools/` folder per project
- [x] **API:** POST `/api/data?resource=scripts` — accepts script content + language, executes in sandboxed environment
- [x] **Safety:** Whitelist allowed languages (js, python, shell), timeout after 30s, no network access
- [x] **UI:** Script runner panel — select script, run, see output
- [x] **Predefined scripts:** "Export all files as ZIP", "Count words across project", "List all TODOs"
- **Done when:** ✅ You can write a script in a project's /tools/ folder and run it from the UI
- **How:** `/tools/` folder added to `STANDARD_FOLDERS`; predefined scripts in default project files; `resource=scripts` API with sandboxed JS execution (30s timeout, no network, whitelisted globals); `ScriptRunner` component in Meta tab with quick scripts and custom script selection

---

## PHASE 4 — Mobile, Offline, Polish

_Make it work everywhere, reliably._

### 4.1 Mobile responsive layout `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **Breakpoints:** Define mobile (<768px), tablet (768-1024px), desktop (>1024px)
- [x] **Mobile nav:** Hamburger menu with slide-out drawer
- [x] **File tree:** Slide-out drawer instead of persistent sidebar
- [x] **Editor:** Full-width on mobile, no side panels
- [x] **Command centre:** Stack cards vertically
- [x] **Touch targets:** All buttons minimum 44px hit area
- [x] **Session timer:** Floating pill button on mobile
- **Done when:** ✅ All tabs and features are usable on a phone screen
- **How:** `useBreakpoint()` hook, conditional rendering with `isMobile` flag, slide-out drawers for nav and file tree, responsive grid layouts, floating session timer

### 4.2 Onboarding flow `[UI]`

- [ ] **First login detection:** Check if user has 0 projects
- [ ] **Step 1:** Welcome screen — "What do you want to use The Brain for?" (multi-select: business, personal, creative, health, all of the above)
- [ ] **Step 2:** Set your goal (or skip)
- [ ] **Step 3:** Create first project — template picker
- [ ] **Step 4:** Quick tour — highlight key UI areas
- [ ] **Skip option:** "I know what I'm doing" bypasses everything
- **Done when:** A brand new user can go from signup to working project in under 2 minutes

### 4.3 Integration connectors `[API]` `[CONFIG]`

- [ ] **Pattern:** Each integration is a module: `{ id, name, icon, fields, connect(), disconnect(), sync() }`
- [ ] **Store credentials:** Encrypted in DB (or use OAuth where available)
- [ ] **GitHub:** Read repo status, last commit, optionally push/pull files
- [ ] **Netlify/Vercel:** Read deploy status, trigger rebuild
- [ ] **Social (Farcaster/Twitter):** Post content from staging items marked "publish"
- [ ] **Blockchain (Base):** Read wallet balance, contract status
- [ ] Build each as needed — the pattern matters more than having them all now
- **Done when:** At least one integration (GitHub) actually connects and shows real data

### 4.4 Notification / reminder system `[DB]` `[API]`

- [ ] **Schema:** `notifications` table: id, user_id, type, message, read, action_url, created_at
- [ ] **Triggers:**
  - Daily check-in not done by configured time
  - Training minimum not met by end of week
  - Project health dropped below threshold
  - Staging items pending review > 7 days
  - Drift detection alerts
- [ ] **UI:** Notification bell in top bar with count badge
- [ ] **Future:** Email/push notifications (out of scope for now — in-app only)
- **Done when:** Actionable notifications appear in-app when triggers fire

---

## PHASE 5 — Future / Parking Lot

_Don't build until Phases 0-4 are solid._

### 5.1 Real-time collaboration
- [ ] WebSocket or SSE for live updates
- [ ] CRDTs for concurrent text editing
- [ ] User presence indicators
- [ ] Role-based permissions (owner/editor/viewer)

### 5.2 Version history
- [ ] Store file versions on save (or on significant changes)
- [ ] UI: version list per file with timestamps
- [ ] Revert to any previous version
- [ ] Visual diff between versions

### 5.3 Plugin system
- [ ] Define plugin API: hooks for project events, UI extension points, data access
- [ ] Plugin manifest format
- [ ] Plugin loader
- [ ] Example plugins: Pomodoro timer, habit tracker, journal

### 5.4 Advanced AI features
- [ ] Content generation: draft blog posts, social threads from project data
- [ ] Code analysis: review code files, suggest improvements
- [ ] Image generation: create assets from text descriptions
- [ ] Voice input: dictate notes, session logs, check-ins

### 5.5 Full GitHub two-way sync
- [ ] Clone repo into project file structure
- [ ] Commit and push from UI
- [ ] Pull and merge changes
- [ ] Branch management
- [ ] Conflict resolution UI

### 5.6 Calendar integration
- [ ] Google Calendar / iCal sync
- [ ] Show scheduled tasks in timeline view
- [ ] Block time for focus sessions
- [ ] Deadline tracking with reminders

### 5.7 Inter-project dependency graph
- [ ] Visual graph of project relationships (from entity_links)
- [ ] Click to navigate between linked projects
- [ ] Show impact: "if Project A stalls, these depend on it"

---

## Summary: Task Counts by Phase

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 0 — Bug Fixes | 9 | A working, safe beta (includes soft deletes, debounced saves, AI rate limits) |
| 0.5 — Critical Tests | 1 block | Confidence that the 3 core data paths don't lose data |
| 1 — Foundations | 5 | Extensible base: life areas, goals, templates, tags, settings |
| 2 — Core Features | 10 | Full feature set: import, images, metadata, offline, agent layer, check-ins, training, outreach, weekly review, drift detection |
| 3 — Intelligence | 6 | AI metadata, mermaid, search, local sync, file checks, scripts |
| 4 — Mobile & Polish | 4 | Mobile layout, onboarding, integrations, notifications |
| 5 — Future | 7 | Collaboration, versioning, plugins, advanced AI, GitHub, calendar, dependency graph |
| **Total** | **~42 feature blocks** | |

---

## Build Order Cheat Sheet

```
PHASE 0: Fix bugs (file loading → comments → AI proxy → rename → session save → wizard guard → soft deletes → debounced saves → AI rate limits)
    ↓
PHASE 0.5: Critical path tests (file round-trip, comment persistence, session logging, migration versioning)
    ↓
PHASE 1: Foundations (life areas → goals → templates → tags/links → settings)
    ↓
PHASE 2: Core features (import → images → metadata → offline → check-ins → training → outreach → agent prompt + context compression → weekly review → drift detection)
    ↓
PHASE 3: Intelligence (AI metadata → mermaid → search → local sync → file checks → scripts)
    ↓
PHASE 4: Polish (mobile → onboarding → integrations → notifications)
    ↓
PHASE 5: Future (only when Phases 0-4 are rock solid)
```

Each phase can be worked on in per-feature chats. Start each chat by pasting the relevant section from this document + BRAIN_STATUS.md. Update both documents at the end of each session.

---

*THE BRAIN · Implementation Roadmap · v1*
