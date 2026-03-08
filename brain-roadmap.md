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

### 0.1 Fix file loading from DB on initial render
- [x] Audit `App.jsx` → confirm it calls the projects API on mount
- [x] Audit `api.js` → confirm `projects.list()` fetches files for each project (or has a separate `projects.getFiles(projectId)` call)
- [x] Audit the serverless function → confirm it joins `project_files` when returning projects
- [x] If files are fetched separately: add a loading state so TheBrain.jsx waits for files before rendering FileTree
- [x] Verify: reload the app → file tree shows all files for all projects
- **Done when:** Browser refresh shows full file tree with all saved content

### 0.2 Fix comments loading from DB
- [ ] Add `useEffect` in TheBrain.jsx that fetches comments when `hubId` or `hub.activeFile` changes
- [ ] Call `commentsApi.list(hubId, hub.activeFile)` (or equivalent)
- [ ] Populate `comments` state with the response
- [ ] Handle loading state (don't flash "No comments" before fetch completes)
- **Done when:** Comments survive a page reload

### 0.3 Build AI Coach proxy function
- [ ] Create serverless function: `/api/ai` (Vercel) or `netlify/functions/ai.js`
- [ ] Accepts POST with `{ prompt, context }` body
- [ ] Reads `ANTHROPIC_API_KEY` from server-side env (not VITE_ prefixed)
- [ ] Calls Anthropic API server-side, returns response
- [ ] Update `askAI()` in TheBrain.jsx to call `/api/ai` instead of Anthropic directly
- [ ] Remove `VITE_ANTHROPIC_KEY` from `.env.example`
- **Done when:** AI Coach works without exposing API key in browser network tab

### 0.4 Fix rename project stale reference
- [ ] In `renameProject()`, use functional updater or read from the updated state after `setProjects`
- [ ] Or: build the new file content from parameters rather than reading from `projects` array
- **Done when:** Renaming a project correctly updates PROJECT_OVERVIEW.md and manifest.json in DB

### 0.5 Add beforeunload handler for session timer
- [ ] Add `useEffect` with `window.addEventListener('beforeunload', ...)` when `sessionActive` is true
- [ ] On unload: save session to DB via `navigator.sendBeacon` or sync XHR
- [ ] Clean up listener when session ends
- **Done when:** Closing tab mid-session still logs the session to DB

### 0.6 Add Bootstrap Wizard null check
- [ ] In `completeBootstrap()`, guard against `projects.find()` returning undefined
- [ ] Show toast error if project not found
- **Done when:** Completing bootstrap on a deleted/missing project shows error instead of silent failure

### 0.7 Add soft deletes to project_files `[DB]`
- [ ] Add `deleted_at DATETIME DEFAULT NULL` column to `project_files` table
- [ ] Update `deleteFile()` API to SET `deleted_at = NOW()` instead of DELETE
- [ ] Update all file queries to include `WHERE deleted_at IS NULL`
- [ ] Add "Recently Deleted" option in project Meta tab (optional, can build UI later)
- [ ] Cleanup rule: hard-delete files where `deleted_at` older than 30 days
- **Done when:** Deleting a file is recoverable within 30 days

### 0.8 Add debounced saves to markdown editor `[UI]`
- [ ] In `MarkdownEditor`, debounce the `onChange` handler (1.5-2 seconds)
- [ ] Show "unsaved changes" indicator while debounce is pending
- [ ] Manual Save button still triggers immediate persist
- [ ] Prevents hammering TiDB on every keystroke
- **Done when:** Typing in the editor doesn't fire a DB write per character

### 0.9 Add rate limiting and caching to AI proxy `[API]`
- [ ] Rate limit: max 10 AI calls per minute per user (return 429 if exceeded)
- [ ] Cache: hash the prompt — if same hash within 5 minutes, return cached response
- [ ] Token logging: log model, input_tokens, output_tokens per call (server logs minimum, `ai_usage` table ideally)
- [ ] Frontend: show "Rate limited, try again shortly" instead of generic error
- **Done when:** AI Coach can't accidentally run up a large bill from repeated/looped calls

---

## PHASE 0.5 — Critical Path Tests (before building new features)

_Not a full test suite — just the 3 paths where data loss would destroy trust._

- [ ] **Test: File save/load round-trip** — create file via API, reload app, verify content matches
- [ ] **Test: Comment persistence** — add comment, reload, verify it appears
- [ ] **Test: Session logging** — start session, end it, verify it persists in DB and appends to DEVLOG.md
- [ ] **DB migration versioning:** Create `schema_migrations` table to track which ALTER/CREATE statements have run
- [ ] Write as simple Node scripts runnable via `npm run test:critical` — no framework needed

---

## PHASE 1 — Extensible Foundations

_These are the base systems that everything else plugs into. Get these right and every future feature is easier._

### 1.0 [EXTENSIBLE] Life Areas ("Parts") `[DB]` `[API]` `[UI]`

The core philosophy is Life > Parts > Things. Without Parts as first-class entities, this is a project manager, not a life OS.

- [ ] **Schema:** Create `life_areas` table:
  ```
  id, user_id, name, color, icon,
  description,
  target_hours_weekly (int, nullable),
  health_score (int, 0-100, auto-calculated),
  sort_order (int),
  created_at, updated_at
  ```
- [ ] **Schema:** Add `life_area_id VARCHAR(36) NULLABLE` to `projects` table (FK to life_areas)
- [ ] **Seed defaults** on first user creation (user can rename/delete):
  - Business / Revenue (💼)
  - Health / Body (🏋️)
  - Relationships (❤️)
  - Creative / Learning (🎨)
  - Personal / Admin (🏠)
- [ ] **API:** CRUD routes for life areas (`/api/areas`)
- [ ] **API:** Assign/unassign project to area (`/api/projects/:id` update with `life_area_id`)
- [ ] **Health calculation:** Area health = weighted average of its projects' health scores
- [ ] **UI:** Life area pills/tabs in Command Centre — click to filter projects by area
- [ ] **UI:** Area assignment dropdown in project creation and project overview
- [ ] **UI:** Area health summary card — shows all areas with health bars
- [ ] **Agent integration:** AI Coach receives area context — can say "Business is strong but Health is declining" and route advice accordingly
- [ ] **Allow projects to belong to multiple areas** via the tagging system (Phase 1.3) as an alternative to the FK — both paths should work
- **Done when:** You can see a dashboard that says "Business: 65%, Health: 30%, Creative: 80%" and filter projects by life area

### 1.1 [EXTENSIBLE] Generic goal system `[DB]` `[API]` `[UI]`

Replace the hardcoded Thailand/£3k tracker with a configurable goal engine.

- [ ] **Schema:** Create `goals` table:
  ```
  id, user_id, title, target_amount, current_amount,
  currency, timeframe (monthly/yearly/total),
  category (income/savings/debt/custom),
  status (active/achieved/paused),
  created_at, updated_at
  ```
- [ ] **Schema:** Create `goal_contributions` table:
  ```
  id, goal_id, project_id (nullable), source_label,
  amount, date, notes
  ```
- [ ] **API:** CRUD routes for goals (`/api/goals`)
- [ ] **API:** CRUD routes for contributions (`/api/goals/:id/contributions`)
- [ ] **UI:** Replace hardcoded `THAILAND_TARGET` with `user.goals[0]` (or active goal)
- [ ] **UI:** Progress bar reads from goal data, not project income_target sum
- [ ] **UI:** Goal configuration in a modal (title, amount, currency, timeframe)
- [ ] **UI:** Link projects to goals with contribution amounts
- [ ] Remove all hardcoded `£`, `GBP`, `3000`, `THAILAND` references — read from goal/user config
- **Done when:** A new user can set their own financial goal in any currency and track projects against it

### 1.2 [EXTENSIBLE] Template system `[DB]` `[API]` `[UI]`

Make project structure configurable rather than one-size-fits-all.

- [ ] **Schema:** Create `templates` table:
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
- [ ] **Seed system templates:**
  - BUIDL Framework (current default — phases, all folders, all skills)
  - Software Project (phases: planning/dev/testing/deployed, code-focused folders)
  - Content Project (phases: research/draft/review/published, content-focused folders)
  - Business / Revenue (phases: validate/build/launch/grow, marketing + analytics folders)
  - Personal Goal (phases: define/plan/execute/maintain, minimal folders)
  - Blank (no phases, no default files beyond PROJECT_OVERVIEW.md)
- [ ] **API:** CRUD routes for templates (`/api/templates`)
- [ ] **API:** "Save as template" endpoint — takes a project ID, extracts its structure into a template
- [ ] **UI:** Template selector in New Project modal (before Bootstrap Wizard)
- [ ] **UI:** "Save as Template" button in project Meta tab
- [ ] **Refactor:** `makeProject()` and `makeDefaultFiles()` read from template config instead of hardcoded constants
- [ ] **Refactor:** `BUIDL_PHASES` becomes `template.config.phases` — if template has no phases, phase UI is hidden
- [ ] **Refactor:** `STANDARD_FOLDERS` becomes `template.config.standard_folders`
- [ ] **Validation:** Use Zod (or simple runtime checks) to validate template config JSON before saving — prevents malformed templates from breaking project creation
- **Done when:** Creating a new project lets you pick a template, and projects without BUIDL phases work correctly with no phase-related UI showing

### 1.3 [EXTENSIBLE] Tagging and linking system `[DB]` `[API]`

Foundation for the "Things belong to multiple Parts" philosophy.

- [ ] **Schema:** Create `tags` table:
  ```
  id, user_id, name, color, category (area/skill/status/custom),
  created_at
  ```
- [ ] **Schema:** Create `entity_tags` junction table:
  ```
  id, tag_id, entity_type (project/idea/staging/session/goal),
  entity_id, created_at
  ```
- [ ] **Schema:** Create `entity_links` table:
  ```
  id, user_id,
  source_type, source_id,
  target_type, target_id,
  relationship (parent/child/related/blocks/supports),
  created_at
  ```
- [ ] **API:** CRUD for tags (`/api/tags`)
- [ ] **API:** Tag/untag any entity (`/api/tags/:id/attach`, `/api/tags/:id/detach`)
- [ ] **API:** Link/unlink entities (`/api/links`)
- [ ] **API:** Query: "get all entities with tag X" and "get all links for entity Y"
- [ ] **UI:** Tag pills on project cards, idea cards, staging items
- [ ] **UI:** Quick-tag input (type to search/create tags)
- [ ] **UI:** Link indicator on project overview ("Related: Project X, Idea Y")
- **Done when:** You can tag a project with "health" and "revenue" and query all entities tagged "health" across projects, ideas, and staging items. You can link Project A as parent of Project B.

### 1.4 [EXTENSIBLE] Settings system `[DB]` `[API]` `[UI]`

User preferences stored in DB, with localStorage cache for speed.

- [ ] **Schema:** Add `settings` JSON column to `users` table (or create `user_settings` table):
  ```
  {
    theme: "dark" | "light" | "system",
    font_family: "JetBrains Mono" | "Fira Code" | "Inter" | ...,
    font_size: 12,
    sidebar_width: 210,
    default_template_id: "buidl" | null,
    goal_display: "bar" | "number" | "hidden",
    ai_coach_enabled: true,
    custom_agent_rules: {...}  -- future: user-editable agent config
    keyboard_shortcuts: {...}  -- future: customisable keybindings
  }
  ```
- [ ] **API:** GET/PUT `/api/settings`
- [ ] **UI:** Settings modal with form fields for each option
- [ ] **Cache:** Write to localStorage on save, read from localStorage on load (DB is source of truth, localStorage is speed cache)
- [ ] **Apply:** Theme class on root element, font-family on body, sidebar width as CSS variable
- [ ] **Keyboard foundation:** Register global shortcuts (Cmd+K search, Cmd+N new file, Cmd+S save). Read overrides from settings. Use a simple `useEffect` with `keydown` listener — no framework needed yet.
- **Done when:** User can change theme and font, settings persist across sessions and devices, Cmd+K opens search

---

## PHASE 2 — Core Feature Completion

_Build out every functional feature discussed. Each one plugs into the Phase 1 foundations._

### 2.1 Project import `[UI]` `[API]`

- [ ] **BUIDL format import:** Parse the existing export format (MANIFEST_START/FILES_START/etc.)
  - [ ] Build parser function
  - [ ] UI: textarea modal for paste import
  - [ ] On import: create project in DB, save all files
- [ ] **JSON import:** Accept a JSON file matching the project schema
  - [ ] UI: file upload in import modal
  - [ ] Validate structure, create project + files
- [ ] **Folder import (File System Access API):**
  - [ ] UI: "Import from folder" button that calls `window.showDirectoryPicker()`
  - [ ] Recursively read directory contents
  - [ ] Map to project structure (folder names → folder IDs where possible)
  - [ ] Create project + files in DB
- [ ] Wire up existing `importText`/`importError` state to the new UI
- **Done when:** All three import methods work and create a fully functional project with files in DB

### 2.2 Image and binary file handling `[UI]` `[API]`

- [ ] **Image viewer component:** When a file has an image extension (.png, .jpg, .gif, .svg, .webp), render an `<img>` tag instead of the text editor
- [ ] **Binary detection:** Check file extension or content prefix (data:image, etc.)
- [ ] **File tree icons:** Show image icon for image files (already partially done)
- [ ] **Upload flow:** When dragging an image into staging, store as base64 data URI in file content
- [ ] **Download link:** For non-text, non-image files, show a download button instead of editor
- [ ] **Size limit:** Warn if file content exceeds 500KB as base64
- [ ] **Architecture note — future migration:** Base64 in LONGTEXT works for now but won't scale. When storage becomes an issue, migrate to object storage (S3/Cloudflare R2) with DB storing URLs instead of content. Design the image viewer component to accept both base64 data URIs and URLs so this migration is non-breaking.
- **Done when:** You can drag an image into a project, see it in the file tree, click it, and see the image rendered

### 2.3 Metadata editor panel `[UI]`

- [ ] **Component:** `MetadataEditor` — shows when a file is selected, alongside the main editor
- [ ] **Fields:** category (dropdown), status (dropdown), tags (multi-select from tag system), last modified (auto), custom fields (key-value pairs)
- [ ] **Storage:** Metadata stored per-file. Options:
  - Option A: JSON column on `project_files` table
  - Option B: Separate `file_metadata` table
  - Option C: Stored in a per-folder `meta.json` file (as old version did)
- [ ] **UI:** Collapsible panel on the right side of the editor
- [ ] **Save:** Metadata saves with the same optimistic pattern as file content
- **Done when:** You can select a file, see its metadata, edit tags/category/status, and it persists

### 2.4 Offline mode / localStorage fallback `[UI]`

- [ ] **On load:** Fetch from DB, write full state to localStorage as cache
- [ ] **On save:** Write to DB (primary) AND localStorage (cache)
- [ ] **On DB failure:** Read from localStorage cache, show "offline" indicator
- [ ] **On reconnect:** Sync localStorage changes back to DB
- [ ] **Conflict resolution:** Last-write-wins (simple) or timestamp comparison (better)
- [ ] **Unauthenticated mode:** If no JWT token, app works entirely from localStorage (as old version did)
- **Done when:** You can use the app with no internet connection, and data syncs when connection returns

### 2.5 Daily check-in system `[DB]` `[API]` `[UI]`

Foundation for the agent layer's state-based task routing.

- [ ] **Schema:** Create `daily_checkins` table:
  ```
  id, user_id, date (unique per user per day),
  energy (0-10), focus (0-10), gut (0-10),
  sleep_hours (decimal), laptop_available (boolean),
  training_done (boolean), training_minutes (int),
  outreach_done (boolean), outreach_notes (text),
  primary_objective (text), notes (text),
  created_at, updated_at
  ```
- [ ] **API:** POST/PUT `/api/checkin` (create or update today's)
- [ ] **API:** GET `/api/checkin?date=YYYY-MM-DD` (get specific day)
- [ ] **API:** GET `/api/checkin/history?days=30` (recent history for pattern detection)
- [ ] **UI:** Check-in prompt — shows on first visit of the day (or manually triggered)
- [ ] **UI:** Quick form: energy slider, sleep hours, gut slider, laptop toggle, training toggle
- [ ] **UI:** "Today's state" indicator in the top bar (colour-coded dot based on energy level)
- [ ] **Store:** Today's check-in accessible to AI Coach for task routing
- **Done when:** Opening the app each day prompts a 30-second check-in, and the data is available to the AI coach

### 2.6 Training log `[DB]` `[API]` `[UI]`

- [ ] **Schema:** Create `training_log` table:
  ```
  id, user_id, date, duration_minutes,
  type (solo/class/sparring/conditioning/other),
  notes, energy_after (0-10),
  created_at
  ```
- [ ] **API:** CRUD routes for training (`/api/training`)
- [ ] **API:** GET `/api/training/stats?weeks=4` — weekly counts, averages
- [ ] **UI:** Quick-log in command centre ("Log training" button)
- [ ] **UI:** Training count in top bar or daily check-in (e.g., "2/3 this week")
- [ ] **Correlation:** Query: compare training days vs energy/focus scores from check-ins
- **Done when:** You can log training sessions and see your weekly count. AI coach can reference training data.

### 2.7 Outreach tracking `[DB]` `[API]` `[UI]`

- [ ] **Schema:** Create `outreach_log` table:
  ```
  id, user_id, date, type (message/post/call/email/other),
  target (person/platform/channel),
  project_id (nullable), notes,
  created_at
  ```
- [ ] **API:** CRUD routes (`/api/outreach`)
- [ ] **API:** GET `/api/outreach/stats?days=7` — daily counts
- [ ] **UI:** Quick-log in command centre
- [ ] **UI:** Daily outreach indicator (done/not done)
- **Done when:** Outreach actions are tracked daily. AI coach can enforce the "outreach is mandatory" rule.

### 2.8 Agent system prompt upgrade + context compression `[API]` `[CONFIG]`

- [ ] **Create:** `agent-config.json` — structured version of the 10 assistant rules
- [ ] **Context compression:** The AI cannot receive all files for all projects. Build a smart context builder:
  - Per-project summary (2-3 sentences) auto-generated and cached in a `project_summaries` column or table
  - Summaries regenerate when: project files change, health score changes, or manually triggered
  - When asking about a specific project: include that project's summary + recent devlog entries (last 5) + current active file content + next action
  - When asking a general question: include all project summaries + today's check-in + active goal progress + life area health scores
  - Token budget: keep total context under 4,000 tokens (leaves room for response)
- [ ] **Build system prompt dynamically:** Read from:
  - User profile (name, goal, currency)
  - Active goal + progress
  - Today's check-in (energy, training count, outreach status)
  - Project data (priorities, health scores, next actions)
  - Recent session logs
  - The 10 enforcement rules
- [ ] **State-based routing in prompt:** Include the task complexity table:
  - Energy ≤4 OR gut ≥6 OR sleep <6 → low-complexity only
  - Energy 5-7, stable → shipping/outreach/medium tasks
  - Energy 8+, laptop available → deep work
- [ ] **Update AI proxy function** to build this prompt server-side
- [ ] **Test:** Ask "What should I work on today?" and verify it references your actual check-in data and enforces the rules
- **Done when:** AI Coach gives state-aware, rule-enforced responses based on real data

### 2.9 Weekly review automation `[API]` `[UI]`

- [ ] **API:** GET `/api/review/weekly` — aggregates:
  - Sessions logged this week (count, total hours, by project)
  - Check-in averages (energy, focus, training count)
  - Outreach count
  - Staging items processed (approved/rejected/deferred)
  - Project health changes (improved/declined)
  - Goal progress delta
- [ ] **UI:** "Weekly Review" view — summary dashboard with the above data
- [ ] **UI:** Editable "reflection" fields: what shipped, what blocked, next week's priority
- [ ] **AI integration:** "Generate review" button that feeds the data to AI coach and gets a structured analysis
- [ ] **Persist:** Save weekly review to `sessions` table (or new `reviews` table) with type="weekly-review"
- **Done when:** Every Sunday (or on demand), you can run a weekly review that shows real data and saves an AI-generated analysis

### 2.10 Drift detection `[API]`

- [ ] **Background check** (runs on login or daily): query last 14 days of check-ins + training + outreach
- [ ] **Rules:**
  - Training < 3 sessions/week for 2 consecutive weeks → flag
  - Outreach = 0 for 5+ days → flag
  - Average energy declining over 7 days → flag
  - No sessions logged for 3+ days → flag
  - Same project focus for 14+ days with no health improvement → flag
- [ ] **UI:** Drift alerts in command centre (similar to health alerts)
- [ ] **AI integration:** Drift flags included in AI coach context so it can address them
- **Done when:** The system proactively warns when patterns are slipping, without you having to notice

---

## PHASE 3 — Intelligence & Power Features

_These make the tool genuinely powerful. Each plugs into the foundations from Phase 1-2._

### 3.1 AI metadata suggestions `[API]`

- [ ] When a file is saved, optionally send content to AI proxy
- [ ] AI returns suggested: category, tags, status, related projects
- [ ] Show suggestions in metadata panel as "suggested" pills (click to accept)
- [ ] Respect agent.ignore rules (don't analyse files in ignored folders)
- **Done when:** Saving a markdown file shows AI-suggested tags that you can accept with one click

### 3.2 Mermaid diagram rendering `[UI]`

- [ ] Add `mermaid` library (CDN or npm)
- [ ] Detect Mermaid code blocks in markdown (```mermaid)
- [ ] Render as SVG in preview mode
- [ ] Dedicated "Dependency Graph" file: `/system/DEPENDENCY_GRAPH.md`
- [ ] Optional: AI-generated diagram from SYSTEM_INDEX.md (as old version had)
- **Done when:** Mermaid diagrams render visually in markdown preview

### 3.3 Search improvements `[API]` `[UI]`

- [ ] **Cross-project search:** Current search already queries DB full-text — extend to return results grouped by project
- [ ] **Better result display:** Show matched line with highlighted search term
- [ ] **Search filters:** by project, by folder, by file type, by tag
- [ ] **Keyboard shortcut:** Cmd/Ctrl+K opens search
- [ ] **Recent searches:** Store last 5 searches in localStorage
- **Done when:** Cmd+K opens a search that finds content across all projects with highlighted excerpts

### 3.4 Local file system sync `[UI]`

- [ ] **Connect:** `window.showDirectoryPicker()` → store handle in state
- [ ] **Save to local:** Recursively write project files to connected folder
- [ ] **Load from local:** Recursively read folder, update project in DB
- [ ] **Sync indicator:** Show "connected to: /path/to/folder" in project meta
- [ ] **Caution:** Overwrite confirmation before any destructive sync
- **Done when:** You can connect a local folder, save your project to it, and load changes back

### 3.5 File validity checker `[UI]` `[API]`

- [ ] **Check:** Required files exist (PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json)
- [ ] **Check:** manifest.json is valid JSON and matches project state
- [ ] **Check:** No orphaned files (files in DB not referenced by any folder)
- [ ] **Check:** Template-required folders exist
- [ ] **UI:** "Health check" button in Meta tab, shows pass/fail list
- [ ] **Auto-fix:** Offer to create missing required files with defaults
- **Done when:** Running a health check shows structural issues and can auto-fix them

### 3.6 Script execution `[API]` `[UI]`

- [ ] **Schema:** Scripts stored as files in `/tools/` folder per project
- [ ] **API:** POST `/api/scripts/run` — accepts script content + language, executes in sandboxed environment
- [ ] **Safety:** Whitelist allowed languages (js, python, shell), timeout after 30s, no network access
- [ ] **UI:** Script runner panel — select script, run, see output
- [ ] **Predefined scripts:** "Export all files as ZIP", "Count words across project", "List all TODOs"
- **Done when:** You can write a script in a project's /tools/ folder and run it from the UI

---

## PHASE 4 — Mobile, Offline, Polish

_Make it work everywhere, reliably._

### 4.1 Mobile responsive layout `[UI]`

- [ ] **Breakpoints:** Define mobile (<768px), tablet (768-1024px), desktop (>1024px)
- [ ] **Mobile nav:** Hamburger menu or bottom tab bar replacing top tab row
- [ ] **File tree:** Slide-out drawer instead of persistent sidebar
- [ ] **Editor:** Full-width on mobile, no side panels
- [ ] **Command centre:** Stack cards vertically
- [ ] **Touch targets:** All buttons minimum 44px hit area
- [ ] **Session timer:** Floating or sticky on mobile
- **Done when:** All tabs and features are usable on a phone screen

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

_Documented for completeness. Don't build until Phases 0-4 are solid._

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
