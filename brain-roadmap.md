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

## PHASE 1 — Foundations (core philosophy support)

_The infrastructure needed for "Life > Parts > Things" to work._

### 1.0 Life Areas (Parts) `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

**Goal:** Make "Parts" real entities, not just folder names.

- [x] `[DB]` Create `life_areas` table: id, user_id, name, color, icon, description, target_hours_weekly, health_score, sort_order
- [x] `[DB]` Migration: Add `life_area_id` FK to `projects` table
- [x] `[API]` CRUD endpoints for `/api/data?resource=areas`
- [x] `[UI]` Area pills in Command Centre (filter projects by area)
- [x] `[UI]` Area selector in New Project modal
- [x] `[UI]` Area display in project Overview tab
- **Done when:** User can assign projects to Life Areas and filter by them
- **How:** Migration v3, v4. Area health computed as weighted average of project health. 5 default areas seeded on user creation.

### 1.1 Generic Goal Tracking `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

**Goal:** Replace hardcoded "Thailand Goal" with configurable goals (any currency, any target).

- [x] `[DB]` Create `goals` table: id, user_id, title, target_amount, current_amount, currency, timeframe, category, status
- [x] `[DB]` Create `goal_contributions` table: id, goal_id, user_id, project_id, source_label, amount, date, notes
- [x] `[API]` CRUD for goals + contributions
- [x] `[UI]` Goal progress bar in Command Centre (reads from DB)
- [x] `[UI]` Goal configuration modal (set target, currency, timeframe)
- [x] `[UI]` "Add Contribution" UI (quick-log toward goal)
- **Done when:** User can set a custom goal and track progress toward it
- **How:** Migrations v5, v6. Goal picker in settings. Contribution tracking in project Meta tab.

### 1.2 Project Templates `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

**Goal:** Different project types need different folder structures and phases.

- [x] `[DB]` Create `templates` table: id, user_id, name, description, icon, category, config (JSON), is_system
- [x] `[API]` CRUD for templates
- [x] `[UI]` Template picker in New Project modal
- [x] `[UI]` "Save as Template" button in project Meta tab
- [x] `[UI]` Template drives project phases and folder structure
- [x] Seed 5 system templates: BUIDL, Software, Content, Business, Personal Goal
- **Done when:** User can create projects from templates and save custom templates
- **How:** Migration v7. Templates have `config.phases[]` and `config.folders[]`. Project creation uses template config.

### 1.3 Tagging & Linking System `[DB]` `[API]` `[UI]` `[EXTENSIBLE]` ✅ COMPLETE (2026-03-08)

**Goal:** Cross-entity relationships without rigid hierarchy.

- [x] `[DB]` Create `tags` table: id, user_id, name, color, category
- [x] `[DB]` Create `entity_tags` junction: tag_id, user_id, entity_type, entity_id
- [x] `[DB]` Create `entity_links` table: user_id, source_type, source_id, target_type, target_id, relationship
- [x] `[API]` CRUD for tags + entity_tags + entity_links
- [x] `[UI]` QuickTagRow component on projects/ideas/staging/goals/files
- [x] `[UI]` 🏷 Tags brain tab: tag cloud + cross-entity query
- [x] `[UI]` 🔗 Links hub tab: entity relationship viewer/creator
- **Done when:** User can tag anything and create relationships between entities
- **How:** Migrations v8, v9, v10. `entity_type` enum: project, idea, staging, goal, file. Relationship types: parent, child, supports, blocks, related.

### 1.4 Settings Persistence `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-08)

**Goal:** User preferences survive across devices.

- [x] `[DB]` Add `settings` JSON column to `users` table
- [x] `[API]` GET/PUT `/api/data?resource=settings`
- [x] `[UI]` Settings modal (⚙ gear icon in header)
- [x] `[UI]` Font family selector (persist to DB)
- [x] `[UI]` Font size selector (persist to DB)
- [ ] `[UI]` Theme selector (dark/light) — deferred to Phase 2
- [ ] `[UI]` Sidebar width persistence — deferred to Phase 2
- **Done when:** Settings persist across sessions and devices
- **How:** Migration v11. Settings merged from DB on load, cached in localStorage for speed.

---

## PHASE 2 — Daily Tool Features

_Make it usable every day without friction._

### 2.1 Project Import `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] Support BUIDL format paste (text area with MANIFEST_START/END, FILES_START/END)
- [x] Support JSON file upload (validated structure)
- [x] Support folder picker (File System Access API) for entire project import
- [x] Conflict detection: show diff when file exists
- [x] Option to overwrite or skip conflicting files
- [x] Auto-navigate to imported project on success
- **Done when:** User can import projects from old Brain format or file system
- **How:** `importMethod` state: "buidl" | "json" | "folder". `parseBuildlFormat()`, `validateImportJson()`, `parseFileSystemEntries()`. Import modal with 3-tab interface.

### 2.2 Image & Binary File Handling `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] Image viewer component for .png/.jpg/.gif/.svg/.webp
- [x] Binary detection by extension
- [x] Base64 upload via drag-drop into staging
- [x] Download link for non-image binaries
- [x] Size warning for files >500KB
- **Done when:** User can view images and download other binary files
- **How:** `ImageViewer` component. Binary extensions list. Base64 encoding for storage.

### 2.3 Metadata Editor Panel `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `[DB]` Create `file_metadata` table: id, project_id, user_id, file_path, category, status, metadata_json
- [x] `[API]` CRUD for file_metadata
- [x] `[UI]` Collapsible right panel in editor showing metadata
- [x] `[UI]` Category dropdown (documentation, planning, research, code, design, marketing, other)
- [x] `[UI]` Status dropdown (draft, review, final, archived)
- [x] `[UI]` Custom JSON fields (extensible)
- [x] `[UI]` "File to Folder" flow: staging items → project folders with metadata
- **Done when:** Every file can have category, status, and custom metadata
- **How:** Migration for `file_metadata`. `MetadataEditor` component in editor. `folder_path`/`filed_at` fields on staging for "file to folder" flow.

### 2.4 Offline Mode & localStorage Fallback `[UI]` `[CONFIG]` ✅ COMPLETE (2026-03-11)

- [x] Full state cached to localStorage on load
- [x] DB-first with cache fallback
- [x] Sync-on-reconnect when back online
- [x] Offline indicator in UI
- [x] Write queue for offline changes
- **Done when:** App works (read-only) when offline, syncs when reconnected
- **How:** `cache.js` module with write queue. `writeWithQueue()` in api.js. Online/offline status indicator in header.

### 2.5 Daily Check-in System `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `[DB]` Create `daily_checkins` table: id, user_id, date, sleep_hours, energy_level, gut_symptoms, training_done, notes
- [x] `[API]` GET/POST daily-checkins
- [x] `[UI]` DailyCheckinModal with sliders for sleep (0-24), energy (0-10), gut (0-10)
- [x] `[UI]` Training done checkbox
- [x] `[UI]` Auto-prompt on first visit of day
- [x] `[UI]` Energy emoji in top bar (🌙/🔄/⚡ based on level)
- [x] `[UI]` Check-in data passed to AI Coach for state-based routing
- **Done when:** User is prompted daily to check in; energy level visible and used by AI
- **How:** Migration v12. `DailyCheckinModal`. localStorage tracks last check-in date. Energy-based routing: ≤4 = low-complexity, 5-7 = shipping/outreach, 8+ = deep work.

### 2.6 Training Log `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `[DB]` Create `training_logs` table: id, user_id, date, duration_minutes, type, notes, energy_after
- [x] `[API]` GET/POST/PUT/DELETE training-logs + stats endpoint
- [x] `[UI]` TrainingLogModal with type selector (solo/class/sparring/conditioning/other)
- [x] `[UI]` Duration with quick presets (30/45/60/90m)
- [x] `[UI]` Energy-after slider
- [x] `[UI]` 🥋 top bar indicator (click to log)
- [x] `[UI]` Command Centre training card: weekly sessions + progress bar
- [x] `[UI]` Auto-marks today's check-in `training_done=true`
- **Done when:** User can log training sessions and track weekly progress
- **How:** Migration v13. `TrainingLogModal`. Stats endpoint with weekly buckets. 3/week target.

### 2.7 Outreach Tracking `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `[DB]` Create `outreach_log` table: id, user_id, date, type, target, project_id, notes
- [x] `[API]` GET/POST/DELETE outreach-log
- [x] `[UI]` OutreachLogModal with type selector (message/post/call/email/other)
- [x] `[UI]` Target input + optional project link
- [x] `[UI]` 📣 top bar indicator (purple when done, dim when zero)
- [x] `[UI]` Command Centre outreach card: today's count + warning when none
- [x] `[UI]` AI Coach context includes outreach count + "NOT DONE" flag
- **Done when:** User logs outreach actions and sees daily progress
- **How:** Migration v14. `OutreachLogModal`. Daily counts shown in Command Centre. Mandatory minimum tracked.

### 2.8 Agent System Prompt Upgrade `[API]` `[CONFIG]` ✅ COMPLETE (2026-03-11)

- [x] `agent-config.json` with 10 enforcement rules + state routing + model config
- [x] `buildSystemPrompt()` in `api/ai.js` queries DB in parallel
- [x] Server-side context building: user profile, goal + progress, today's check-in, training, outreach, projects, sessions
- [x] Recovery/Steady/Power routing computed server-side
- [x] 4,000 token budget with auto-truncation
- [x] Graceful fallback to rules-only if DB unavailable
- [x] `askAI()` sends `{ prompt }` only — no client-side context
- **Done when:** AI Coach has full context and follows the 10 rules
- **How:** `agent-config.json` loaded server-side. Parallel DB queries for context. Compressed project summaries.

### 2.9 Weekly Review Automation `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `[DB]` Create `weekly_reviews` table: id, user_id, week_start, data_json, what_shipped, what_blocked, next_priority, ai_analysis
- [x] `[API]` GET/POST weekly-review with auto-aggregated stats
- [x] `[UI]` WeeklyReviewPanel with week navigation
- [x] `[UI]` 7 stat cards (sessions, energy, sleep, training, outreach, staging, etc.)
- [x] `[UI]` Reflection fields: what shipped, what blocked, next priority
- [x] `[UI]` AI-generated analysis
- [x] `[UI]` Save to DB
- **Done when:** User can review each week with auto-aggregated data + AI insights
- **How:** Migration v15. `weekly-review` endpoint computes stats in parallel. `WeeklyReviewPanel` component.

### 2.10 Drift Detection `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `resource=drift-check` API with 5 detection rules
  - Training < 3 sessions/week for 2 consecutive weeks
  - Outreach = 0 for 5+ days
  - Average energy declining over 7 days
  - No sessions logged for 3+ days
  - Same project focus 14+ days with no health improvement
- [x] Drift alerts in Command Centre with dismiss functionality
- [x] Drift flags included in AI Coach context
- **Done when:** User sees early warning flags when patterns slip
- **How:** Drift check queries multiple tables, computes trends, returns flags with severity. Dismissed flags stored in localStorage.

---

## PHASE 3 — Power Features

_Features that multiply effectiveness._

### 3.1 AI Metadata Suggestions `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `resource=ai-metadata-suggestions` endpoint
- [x] AI analyzes file content and suggests category, status, tags
- [x] Suggestions shown in MetadataEditor panel as purple dashed pills
- [x] Click to accept
- [x] Ignore patterns (node_modules, .git, etc.)
- [x] Content truncated to 3000 chars for analysis
- **Done when:** AI suggests metadata for files based on content
- **How:** Anthropic API call with structured system prompt. JSON response parsed for suggestions.

### 3.2 Mermaid Diagram Rendering `[UI]` ✅ COMPLETE (2026-03-11)

- [x] Mermaid loaded via CDN in index.html
- [x] `MermaidRenderer` component renders diagrams as SVG
- [x] `MarkdownPreview` splits content and renders mermaid blocks
- [x] `renderMd` detects and extracts mermaid code blocks
- [x] Default `system/DEPENDENCY_GRAPH.md` template with example diagrams
- **Done when:** Mermaid diagrams render visually in markdown preview
- **How:** Mermaid loaded via CDN in index.html; `MermaidRenderer` component renders SVG with dark theme; `MarkdownPreview` splits content by mermaid blocks; default `system/DEPENDENCY_GRAPH.md` template with example diagrams

### 3.3 Search improvements `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] Enhanced search API with filters (project, folder, file type)
- [x] Highlighted excerpts in results
- [x] Grouped results by project
- [x] `SearchModal` component with Cmd+K shortcut
- [x] Recent searches (localStorage)
- [x] Filter dropdowns
- [x] Debounced search with loading indicator
- **Done when:** User can quickly find anything with Cmd+K
- **How:** Search endpoint with SQL filters. Excerpt highlighting with match index. `SearchModal` with keyboard shortcut.

### 3.4 Local File System Sync `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `sync_state` and `sync_file_state` tables
- [x] `resource=sync_state` API endpoints (GET/POST/PUT/DELETE)
- [x] `desktop-sync.js` module with `selectFolder()`, `saveFolderHandle()`, `syncFiles()`
- [x] `FolderSyncSetup` component in Meta tab
- [x] `SyncReviewModal` for conflict resolution
- [x] File System Access API for desktop folder access
- [x] Bi-directional sync with overwrite confirmation
- **Done when:** User can connect a local folder and sync bidirectionally
- **How:** Migrations v16, v17. Folder handle persistence. Content hash comparison for conflict detection.

### 3.5 File Validity Checker `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `HealthCheck` component in Meta tab
- [x] Checks for required files (PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json)
- [x] Validates manifest.json JSON
- [x] Checks manifest-project state consistency
- [x] Detects orphaned files (not in any folder)
- [x] Checks template-required folders
- [x] Shows error/warning/info counts
- [x] Auto-fix for missing files with default content
- **Done when:** Structural issues are flagged automatically
- **How:** `HealthCheck` runs structural validation. Auto-fix creates default content for missing files.

### 3.6 Script Execution `[API]` `[UI]` ✅ COMPLETE (2026-03-11)

- [x] `resource=scripts` POST endpoint
- [x] Sandboxed JavaScript execution using Function constructor
- [x] Safety controls: 30s timeout, no network, whitelisted globals
- [x] `ScriptRunner` component in Meta tab
- [x] Quick scripts: Word Count, List TODOs, Stats
- [x] Custom script selector from `/tools/` folder
- [x] Output display panel
- **Done when:** User can run sandboxed scripts against project data
- **How:** Server-side sandbox with restricted globals. Timeout via Promise.race. Script metadata extraction.

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

### 4.2 Onboarding flow `[UI]` ✅ COMPLETE (2026-03-11)

- [x] **First login detection:** Check if user has 0 projects
- [x] **Step 1:** Welcome screen — multi-select use cases (business, creative, health, personal)
- [x] **Step 2:** Set goal — pre-filled suggestions based on use case, always saved to DB
- [x] **Step 3:** Create first project — template picker with smart recommendations
- [x] **Step 4:** Quick tour — spotlight tooltips highlighting Brain, Hub, Session Timer, AI Coach
- [x] **Skip option:** "I know what I'm doing" bypasses everything
- [x] **Re-trigger:** Available in Settings and New Project modal
- **Done when:** ✅ A brand new user can go from signup to working project in under 2 minutes
- **How:** `OnboardingWizard` component with 4 steps, `TourTooltip` with spotlight overlay, `useEffect` check on login, `settingsApi.update({onboarding_completed:true})` persistence

### 4.3 Integration connectors `[API]` `[CONFIG]` ✅ COMPLETE (2026-03-11)

- [x] **Pattern:** Modular integration system with API endpoints
- [x] **Store credentials:** Personal Access Token in `project_integrations` table
- [x] **GitHub:** Full implementation — repo status, commits, connect/disconnect
- [ ] **Netlify/Vercel:** Phase 5 (when needed)
- [ ] **Social (Farcaster/Twitter):** Phase 5
- [ ] **Blockchain (Base):** Phase 5
- **Done when:** ✅ GitHub integration connects and shows real repo data
- **How:** `project_integrations` table, `/api/integrations.js` serverless function, `GitHubIntegration` component with step-by-step setup instructions, PAT-based auth (OAuth upgradeable)

### 4.4 Notification / reminder system `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-12)

- [x] **Schema:** `notifications` table: id, user_id, type, message, read, action_url, created_at (migration v20)
- [x] **Triggers:**
  - Daily check-in not done by configured time
  - Training minimum not met by end of week
  - Project health dropped below threshold
  - Staging items pending review > 7 days
  - Drift detection alerts
- [x] **UI:** Notification bell in top bar with count badge
- [x] **API:** `/api/data?resource=notifications` for CRUD, `/api/data?resource=notification-check` for trigger evaluation
- [x] **Auto-check:** Every 5 minutes for new triggers
- [x] **Mobile:** Slide-out drawer for notifications on mobile
- [ ] **Future:** Email/push notifications (out of scope for now — in-app only)
- **Done when:** ✅ Actionable notifications appear in-app when triggers fire
- **How:** Migration v20. `notificationsApi` client methods. Bell icon with badge in header. Desktop dropdown + mobile drawer. Click to navigate to relevant action. Dismiss/delete individual notifications or mark all read.

---

## PHASE 5 — Future / Parking Lot

_Don't build until Phases 0-4 are solid._

### 5.1 Real-time collaboration
- [ ] WebSocket or SSE for live updates
- [ ] Presence indicators (who's viewing what)
- [ ] Cursor/selection sync for shared editing

### 5.2 Version history
- [ ] Per-file version history with diff
- [ ] Revert to any previous version
- [ ] Auto-snapshots on significant changes

### 5.3 Advanced AI features
- [ ] Content generation (write from prompts)
- [ ] Code analysis and suggestions
- [ ] Image generation for projects

### 5.4 External integrations
- [ ] Calendar sync (Google/Outlook)
- [ ] Email notifications
- [ ] Slack/Discord webhooks

### 5.5 Performance & scale
- [ ] Pagination for large project lists
- [ ] Virtual scrolling for long files
- [ ] Lazy loading for images
- [ ] CDN for static assets

### 5.6 Security hardening
- [ ] Rate limiting on all endpoints
- [ ] Input sanitization audit
- [ ] SQL injection prevention review
- [ ] XSS prevention review
