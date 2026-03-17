# Development Log — The Brain

_Session-based progress tracking for The Brain project_

---

## Session 054 — 2026-03-17

**Branch:** `claude/plan-refactoring-tasks-jku4n`
**Task:** Frontend Refactoring — TheBrain.jsx modularization
**Status:** ✅ Complete

### Summary

Refactored `src/TheBrain.jsx` from a **14,237-line monolith** into a **modular architecture** (3,962 lines orchestrator + 30+ extracted modules). **72% reduction** in the main file.

### Steps Completed

**Step A — Extract standalone components (-5,029 lines)**

- Extracted 20+ components defined outside the main function
- Created `src/components/UI/SmallComponents.jsx`, `src/components/Modals/`, `src/components/viewers/`
- Extracted hooks: `useUndoRedo`, `useBreakpoint`
- Extracted large components: OnboardingWizard, GitHubIntegration, BootstrapWizard, HealthCheck, ScriptRunner, etc.

**Step B — Extract internal hooks (-1,119 lines)**

- Created 7 domain hooks with deps pattern:
  - `useProjectCrud` (677 lines) — project CRUD, file ops, onboarding, bootstrap
  - `useStagingOps` (82 lines) — staging pipeline
  - `useSessionOps` (191 lines) — ideas, sessions, checkins, training, outreach
  - `useNotifications` (77 lines) — notification CRUD
  - `useTaskOps` (109 lines) — task management + agent polling
  - `useAI` (148 lines) — search, AI coach, context builder
  - `useTagOps` (166 lines) — tag CRUD + QuickTagRow component

**Step C — Extract domain panels (-3,297 lines)**

- `HubEditorPanel.jsx` (1,480 lines) — all 9 hub tab contents
- `BrainTabsPanel.jsx` (2,150 lines) — all 12 brain tab contents
- Both use `ctx` prop pattern for passing state/callbacks

**Step D — Cleanup & polish (-307 lines)**

- Extracted `useMetadata` hook (113 lines) — file metadata + AI suggestions
- Extracted `useDataSync` hook (218 lines) — seed defaults, cache sync, online status
- Removed 40+ unused imports (components, APIs, utilities)
- Updated barrel files and documentation

### Key Patterns Established

1. **Hook deps pattern:** `const { fn } = useHook({ state, setState, ... })`
2. **Panel ctx pattern:** `<Panel ctx={{ state, callbacks, ... }} />`
3. **File extensions:** `.jsx` for files containing JSX, `.js` for pure logic
4. **Build verification:** `npx vite build` after every change

### Issues Encountered & Fixed

- Unicode escape sequences (`\u{1F4A1}`) caused Prettier errors → converted to actual Unicode
- Wrong default imports → fixed to named imports for `constants.js`
- Hook call ordering → `useStagingOps` must be called before `useProjectCrud` (dependency)
- JSX in `.js` file → renamed `useTagOps.js` to `.jsx` (Vite requires .jsx for JSX)
- Stale closing `</div>` after panel extraction → removed

### Metrics

| Metric               | Before       | After       |
| -------------------- | ------------ | ----------- |
| TheBrain.jsx         | 14,237 lines | 3,962 lines |
| Hook files           | 2            | 11          |
| Panel components     | 0            | 2           |
| Extracted components | 0            | 20+         |
| Utility files        | 0            | 4           |
| Build size           | 464 KB       | 458 KB      |

### Documentation Updated

- `REFACTOR_TASKS.md` — Full progress tracking with final summary
- `README.md` — New architecture section, module map, developer guide
- `ARCHITECTURE-v2.md` — Updated stack diagram, added module map
- `brain-status.md` — Updated line counts, architecture principles
- `agent-brief.md` — New codebase map, updated rules for modular architecture
- `brain-roadmap.md` — Added refactoring note
- `TESTING-PLAN.md` — Added refactoring regression tests

---

## Session 053 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 8.3 & 8.4 — Performance & Security
**Status:** ✅ Complete

### Implementation Summary

Added performance optimizations and security hardening.

**Phase 8.3 - Performance & Scale:**

- Added pagination helpers to api/data.js
  - `addPagination()`: page/limit/offset calculation
  - `formatPaginatedResponse()`: returns data + pagination metadata
  - Supports page=1&limit=20 query params
  - Max 100 items per page

- Added pagination to api/projects.js
  - Same helpers for project listing
  - Ready for virtual scrolling on client

**Phase 8.4 - Security Hardening:**

- Rate limiting (30 requests/minute)
  - In-memory Map with 60s window
  - Applied to: api/data.js, api/projects.js, api/ai.js
  - Returns 429 when exceeded

- Input sanitization
  - SQL injection pattern removal
  - Dangerous keywords: SELECT, INSERT, UPDATE, DELETE, DROP, UNION, etc.
  - Comment patterns: --, #, /_, _/
  - Applied to request body objects

---

## Session 052 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 8.2 — Advanced Integrations
**Status:** ✅ Complete

### Implementation Summary

Built external service integrations for GitHub, Google Calendar, and Email.

**New Files:**

- `src/integrations.js` — Client module for external integrations
- Migration v28 — `user_integrations` and `integration_sync_log` tables

**Database Schema:**

- `user_integrations`: provider, access_token, refresh_token, metadata
- `integration_sync_log`: sync history with status tracking

**API Endpoints:**

1. `resource=integrations` — List, add, remove user integrations
2. `resource=github-sync` — Sync repos, create issues, link projects
3. `resource=calendar-sync` — Create events, block time for tasks
4. `resource=email-sync` — Send task updates via email
5. `resource=integration-sync-log` — Sync history

**Client API (`src/api.js`):**

- `integrations.list()` / `add()` / `remove()`
- `integrations.github.syncRepos()` / `createIssue()` / `linkProject()`
- `integrations.calendar.createEvent()` / `blockTime()`
- `integrations.email.sendTaskUpdate()`

**Providers Supported:**

- GitHub: repo sync, issue creation, project linking
- Google: Calendar event creation, time blocking
- Email: Task update notifications
- Slack/Discord: (infrastructure ready)

---

## Session 051 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 8.1 — Community Workflows
**Status:** ✅ Complete

### Implementation Summary

Built community workflow sharing and discovery system.

**New Files:**

- `src/communityWorkflows.js` — Client module for community workflows
- Migration v27 — `community_workflows` table

**Database Schema:**

- name, description, icon, category
- stars, forks, usage_count
- avg_rating, rating_count

**API Endpoints:**

1. `resource=community-workflows` — List and publish workflows
   - GET: List with filters (category, sort, search)
   - POST: Publish workflow (anonymized)

2. `resource=community-workflow-action` — Actions on workflows
   - star/unstar: Toggle stars
   - fork: Copy to user's templates
   - rate: 1-5 star rating

3. `resource=my-community-workflows` — User's published workflows

**Client API (`src/api.js`):**

- `communityWorkflows.list(options)` — Browse community
- `communityWorkflows.publish(workflow)` — Publish
- `communityWorkflows.star/fork/rate(workflowId)` — Actions

**Features:**

- Categories: general, product-launch, content, development, marketing, research, design, business
- Sort by: stars, usage, rating, recent
- Search by name/description
- Fork creates copy in user's templates

---

## Session 050 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 7.4 — Memory Self-Iteration
**Status:** ✅ Complete

### Implementation Summary

Built personal memory system for learning from execution and personalization.

**New Files:**

- `src/memory.js` — Client module for memory management
- Migration v26 — `memories` table

**Database Schema:**

- 6 categories: profile, preferences, entities, events, cases, patterns
- Tracks: confidence, access count, last accessed
- Source types: workflow, task, project, session, checkin, manual

**API Endpoints:**

1. `resource=memories` — List and create memories
   - GET: List with filters (category, active)
   - POST: Create new memory

2. `resource=extract-memories` — Auto-extract from sources
   - Workflow: duration, status patterns
   - Task: agent success/failure patterns
   - Checkin: weekly energy/sleep patterns (5+ check-ins)

3. `resource=memory-insights` — Statistics and personalized insights
   - Category counts and avg confidence
   - Recent patterns sorted by access count
   - Generated insights: estimation, delegation, engagement

**Client API (`src/api.js`):**

- `memories.list(options)` — List memories with filters
- `memories.create(memory)` — Create new memory
- `memories.extract(sourceType, sourceId)` — Auto-extract
- `memories.insights()` — Get memory insights

**Memory Categories:**

- profile: User identity and goals
- preferences: UI and interaction preferences
- entities: Projects, contacts, organizations
- events: Timestamped occurrences
- cases: Specific situations and outcomes
- patterns: Recurring behaviors and trends

**Usage Examples:**

- "You usually underestimate dev tasks by 2x"
- "Agent tasks are completing successfully. Keep delegating!"
- "You have 5 sessions this week. Keep the momentum!"

---

## Session 049 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 7.2 — Workflow Learning
**Status:** ✅ Complete

### Implementation Summary

Built pattern detection and suggestion system for workflow optimization.

**New Files:**

- `src/workflowLearning.js` — Client-side module for workflow pattern analysis

**API Endpoints:**

1. `resource=workflow-patterns` — Analyzes completed workflows (needs 3+)
   - Step duration patterns (actual vs estimated)
   - Agent success rates per task type
   - Bottleneck detection (blocked steps)
   - Generates suggestions: estimate adjustments, agent reliability, bottleneck fixes

2. `resource=apply-workflow-suggestion` — Acknowledge and apply suggestions

**Client API (`src/api.js`):**

- `workflowPatterns.get(projectId)` — Fetch patterns and suggestions
- `workflowPatterns.applySuggestion(suggestion)` — Acknowledge suggestions

**Patterns Detected:**

- Step duration ratio (estimated vs actual) — flags 1.5x+ overruns
- Agent success rate per task type — flags <50% success
- Bottleneck frequency — flags >30% block rate

**Suggestions Generated:**

- "Adjust time estimate" — if step takes 1.5x+ longer than planned
- "Agent success rate low" — if agent completes <50% tasks
- "Step frequently blocked" — if >30% block rate
- "Average workflow duration" — summary for 5+ completed workflows

---

## Session 048 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 5.6 — Agent Task Execution
**Status:** ✅ Complete

### Implementation Summary

Built complete function calling system enabling agents to DO work, not just advise.

**New Files:**

- `src/agentFunctions.js` — Client-side function definitions and executor
- `api/agent-execute.js` — Server-side API for agent execution with function calling

**Function Definitions (6 functions):**

1. `read_file(uri)` — Get L2 content from project files
2. `write_file(uri, content, mode)` — Create/update files (create/update/preview modes)
3. `create_task(title, description, assignee)` — Delegate work
4. `search_projects(query)` — Find context across projects
5. `mark_complete(task_id, summary)` — Complete assigned task
6. `request_review(reason)` — Escalate for human review

**API Features:**

- Multi-provider support: Anthropic (Claude), OpenAI (GPT), Mistral
- Tool/function calling native to these providers
- Automatic iteration until task complete or max iterations (5)
- Per-agent ignore_patterns for security
- Usage logging to ai_usage table

**Preview vs Auto Mode:**

- Preview mode: write_file and create_task propose changes but don't execute
- Auto mode: agents execute actions immediately
- Toggle: Settings → Auto-Run Agents checkbox
- Setting stored in user settings as `auto_run_agents`

**Security:**

- Sandboxed file operations via API
- Ignore patterns from agent definitions
- Path validation for brain:// URIs

**Integration:**

- Updated `src/api.js` agentExecution methods
- Added toggle in Settings panel (TheBrain.jsx)
- Added `auto_run_agents` to settings form state

---

## Session 047 — 2026-03-15

**Branch:** `main`
**Task:** Phase 5.5 — Workflow Execution Engine
**Status:** ✅ Complete

### Implementation Summary

Built complete workflow execution system with templates, instances, and step-by-step execution.

**Database (Migration v25):**

- `workflow_templates` table — Static workflow definitions
- `workflow_instances` table — Running workflow executions
- JSON fields for steps, triggers, step_results
- Indexes for fast queries by status, project, user

**System Workflows (`agents/system-workflows.json`):**

```
🚀 Product Launch      — 7 steps: build-check → security → assets → copy → deploy → announce → monitor
✍️ Content Sprint      — 5 steps: pick-angle → draft → assets → review → schedule
💡 Idea → Brief        — 6 steps: capture → validate → research → mvp-scope → dev-brief → wireframes
📊 Weekly Review       — 6 steps: health-check → review-staging → ai-review → devlogs → set-focus → build-post
🔒 Security Audit      — 5 steps: dependencies → env-vars → input-validation → auth-review → report
```

**API Endpoints (`api/data.js`):**

- `GET/POST/DELETE /api/data?resource=workflows` — Template management
- `GET/POST/PUT/DELETE /api/data?resource=workflow-instances` — Instance lifecycle
- Instance controls: pause, resume, abort, complete-step

**Execution Engine (`src/workflows.js`):**

- `startWorkflow(templateId, projectId)` — Create instance, trigger first step
- `executeStep(instanceId, stepIndex)` — Create task, assign to agent by capability
- `onTaskComplete(taskId)` — Advance workflow, auto-execute next step
- `getProgress(instance)` — Calculate % complete
- `seedSystemWorkflows()` — Load system workflows on first run

**UI Component (`src/components/WorkflowRunner.jsx`):**

- Browse workflow templates with step counts
- Start workflow modal with template selection
- Running instances list with progress bars
- Pause ⏸ / Resume ▶ / Abort ✕ controls
- Instance detail view:
  - Visual step progress (completed ✓ / current / pending)
  - Capability requirements for each step
  - Execution log with timestamps
  - Step-by-step status tracking

**Execution Flow:**

```
User clicks "Start Product Launch"
    ↓
Instance created (status: running)
    ↓
Step 1: "Final Build Check" → Task created
    ↓
Assigned to agent with capability "code.review"
    ↓
Agent completes task
    ↓
Workflow advances to Step 2 automatically
    ↓
Repeat until all steps complete
```

**Integration:**

- Workflows tab now shows WorkflowRunner (replaces old static view)
- Seeds system workflows on app initialization
- Creates tasks that integrate with existing task system
- Agent assignment uses capability-based routing from Phase 5.3

---

## Session 046 — 2026-03-15

**Branch:** `main`
**Task:** Phase 5.3 — Agent Registry UI (Complete)
**Status:** ✅ Complete

### Implementation Summary

Completed Agent Registry UI with agent management and capability-based task assignment.

**AgentManager Component (`src/components/AgentManager.jsx`):**

- Two-panel layout: Agent list | Agent details
- Lists system agents (read-only) and custom agents (user-created)
- Shows agent stats (tasks, success rate, avg cost, avg time)
- Displays capabilities, permissions, prompt prefix
- **Clone feature:** Creates new agent from system agent with verbose naming
  - Format: `{basename}-v{version}-clone-{date}`
  - Editable: name, icon, description, capabilities, permissions, model, prompt
  - Saves to project files as `/agents/{agent-id}.md`

**Capability-Based Task Assignment:**

- Updated Task Creation Modal with assignee selection
- Toggle: "👤 Me (Human)" vs "🤖 Agent"
- When Agent selected:
  - Loads available agents for selected project
  - Shows agent list with icon, name, capabilities
  - System agents marked with purple badge
  - Click to select, green checkmark shows selection
- Task created with `assignee_type: 'agent'` and `assignee_id: '{agent-id}'`

**Integration:**

- AgentManager added to Skills tab (replaces old hardcoded SKILLS view)
- Task modal loads agents dynamically when project selected
- Clone saves to project files via `saveFile()` API

**UI Features:**

- Responsive agent cards with hover effects
- Capability selection by category (Code, Content, Strategy, Design, Research)
- Permission toggles
- Model selection dropdown
- Full prompt editor (textarea)
- Stats display with color-coded badges

---

## Session 045 — 2026-03-15

**Branch:** `main`
**Task:** Phase 5.3 — Agent Registry (File-based Architecture)
**Status:** ✅ Complete

### Implementation Summary

Implemented file-based agent registry with 5 system agents. Agents defined as markdown files, not database rows.

**Architecture Decision:**

- Agents live in `/agents/*.md` files
- Immutable (new file = new version)
- Verbose naming: `agentname-vX-proj-date`
- No persistent state - agents spin up, execute, die
- Context lives in project files (DEVLOG, summaries, etc.)
- Stats derived from tasks table

**System Agents Created:**

1. **`/agents/system-dev.md`** (🛠)
   - Capabilities: code.write, code.review, code.debug, code.test, code.deploy
   - SOP: Read PROJECT_OVERVIEW, check existing work, follow conventions
   - Prompt: Senior developer, ships clean code

2. **`/agents/system-content.md`** (✍️)
   - Capabilities: content.write, content.edit, content.social, content.email
   - Voice: Authentic, builder-first, anti-corporate
   - All drafts → staging with DRAFT\_ prefix

3. **`/agents/system-strategy.md`** (🎯)
   - Capabilities: strategy.plan, strategy.research, strategy.analyze
   - North Star: £3000/mo Thailand goal
   - Ruthless prioritization, truth over comfort

4. **`/agents/system-design.md`** (🎨)
   - Capabilities: design.ui, design.assets, design.brand
   - Style: Dark minimalist, monospace, nearly kawaii
   - All assets → staging with SKETCH\_ prefix

5. **`/agents/system-research.md`** (🔬)
   - Capabilities: research.market, research.tech, research.competitor
   - Always cite sources
   - Map insights to decisions

**AgentRegistry Service (`src/agents.js`):**

- `loadAgents()` — Parse /agents/\*.md files, extract frontmatter
- `findByCapability()` — Query agents by capability
- `getAgent()` — Get single agent by ID
- `selectAgent()` — Score candidates, return best match
- `cloneAgent()` — Create new agent from existing (verbose naming)
- `buildAgentPrompt()` — Construct full prompt with context
- `parseFrontmatter()` — YAML-like frontmatter parser

**Key Features:**

- Frontmatter = metadata (capabilities, permissions, model, etc.)
- Body = prompt_prefix (system message)
- Caching with TTL (1 minute)
- Capability-based routing ready
- Stats integration ready (from tasks table)

**Naming Convention:**

```
system-dev-v1                    — System agent, version 1
my-custom-agent-v2-thailand-2026-03-15  — User agent, verbose
```

---

## Session 044 — 2026-03-15

**Branch:** `main`
**Task:** Phase 5.2 — Hierarchical Context Summarization
**Status:** ✅ Complete

### Implementation Summary

Implemented L0/L1/L2 hierarchical summarization system following Open Viking pattern. Summaries auto-generate when files are saved.

**Phase 5.2 — File Summaries (`scripts/migrate.js` v24):**

- Migration v24: Created `file_summaries` table
  - `id`, `project_id`, `file_path`, `l0_abstract`, `l1_overview`
  - `content_hash` for change detection
  - `token_count`, `generated_at`, `updated_at`, `generated_by`
  - Unique constraint on `(project_id, file_path)`

**API Changes (`api/data.js`):**

- `resource=file-summaries` endpoints:
  - GET: Retrieve single or list summaries
  - POST: Store/update with upsert logic
  - DELETE: Remove summary
- Graceful handling for missing table

**Client Library (`src/summaries.js`):**

- `L0_PROMPT` — Prompt for ~100 token abstract
- `L1_PROMPT` — Prompt for ~2000 token overview
- `checkSummaryStatus()` — Check if update needed (hash comparison)
- `storeSummaries()` — Store generated summaries
- `buildSummaryContext()` — Build AI context from summaries

**UI Component (`src/components/FileSummaryViewer.jsx`):**

- Displays coverage percentage badge (green/amber/dim)
- Lists all summarized files with L0 abstracts
- Click to expand L1 overview
- Shows token counts and generation status
- Refresh button to reload

**Integration (`src/TheBrain.jsx`):**

- `generateSummaryAsync()` — Background generation on file save
- Triggers for markdown, code, JSON files >100 chars
- Fire-and-forget (doesn't block save)
- Added to Meta tab in project hub

**Hash Utility (`src/uri.js`):**

- `contentHash()` — Fast hash for change detection

---

## Session 043 — 2026-03-15

**Branch:** `main`
**Task:** Phase 5.1 (URI Scheme) + Phase 5.4 (Task Delegation) + Bug Fixes
**Status:** ✅ Complete

### Implementation Summary

Implemented URI scheme for resource addressing and task delegation system with full CRUD operations.

**Phase 5.1 — URI Scheme (`src/uri.js`):**

- 12 exported functions for URI parsing/generation
- `parseURI()`, `generateURI()`, `fileURI()`, `taskURI()`, `goalURI()`, etc.
- `extractURIs()` — extracts all brain:// URIs from text
- `renderURIs()` — replace URIs with rendered links
- `uriToNavigation()` — convert URI to app navigation action
- Regex pattern: `/brain://[^\s\)\]\>\"\']+/g`

**Phase 5.4 — Task Delegation (`scripts/migrate.js` v23):**

- Migration v23: Created `tasks` table
  - `id`, `user_id`, `project_id`, `title`, `description`
  - `assignee_type` ENUM('human', 'agent', 'integration')
  - `assignee_id`, `status`, `priority`, `context_uri`
  - `created_at`, `started_at`, `completed_at`
  - `result_summary`, `output_uris`, `parent_task_id`

**API Changes (`api/data.js`):**

- `resource=tasks` endpoints:
  - GET: List tasks with filters (status, assignee_type, my_tasks)
  - POST: Create task with assignee
  - PUT: Update task, start, complete, block, assign actions
  - DELETE: Remove task
- Graceful handling for missing tables (returns empty arrays)

**Client API (`src/api.js`):**

- Added `tasks` wrapper with list(), myTasks(), byProject(), create(), update(), start(), complete(), block(), assign(), delete()

**UI Changes (`src/TheBrain.jsx`):**

- "My Tasks" card in Command Centre with create/complete/delete
- Task creation modal with title, description, priority, project selection
- Priority-based color coding (critical=red, high=amber, medium=blue, low=dim)
- Project badge shown for each task
- Tasks auto-load on mount

**Bug Fixes:**

- Fixed `renderAIResponse` returning mixed types (React crash)
- Fixed undefined `tab` variable (should be `view`)
- Fixed build script for cross-platform (`npx vite build`)
- Fixed `isOnline` check with HEAD request support in auth API
- Fixed API endpoints to handle missing tables gracefully
- Added automatic migration during build process

**Build System:**

- Upgraded Vite 5 → 6 for Node 24 compatibility
- Upgraded mysql2 3.11.3 → 3.14.0 for Node 24 compatibility
- Added explicit rollup 4.27.0 dependency
- Build script now runs: `node scripts/migrate.js && npx vite build`

---

## Session 042 — 2026-03-12

**Branch:** `session-042-phase-4`
**Task:** Phase 4.4 — Notification / Reminder System
**Status:** ✅ Complete

### Implementation Summary

Implemented comprehensive notification system with automatic triggers and in-app alerts.

**Database Changes (`scripts/migrate.js`):**

- Migration v20: Created `notifications` table
  - `id`, `user_id`, `type`, `message`, `read`, `action_url`, `created_at`, `expires_at`
  - Indexes: `idx_notifications_user_read`, `idx_notifications_created`
  - Foreign key to `users(id)`

**API Changes (`api/data.js`):**

- `resource=notifications` endpoints:
  - GET: List notifications with unread count, supports `unread_only` and `limit` filters
  - POST: Create notification (manual or from triggers)
  - PUT: Mark single notification as read or `action=mark-all-read`
  - DELETE: Remove notification
- `resource=notification-check` endpoint:
  - Evaluates 5 trigger conditions and creates notifications
  - Daily check-in not done (creates notification once per 12h)
  - Training minimum not met by Friday (end of week check)
  - Project health dropped below 50 (throttled to once per 24h per project)
  - Staging items pending review > 7 days (throttled to once per 24h)
  - Returns summary of checks performed and notifications created

**Client API (`src/api.js`):**

- Added `notifications` wrapper with list(), create(), markRead(), markAllRead(), delete(), checkTriggers()

**UI Changes (`src/TheBrain.jsx`):**

- State: `notifications`, `unreadCount`, `showNotifications`, `notificationsLoading`
- Notification bell in header with unread badge (red circle with count, "9+" for 10+)
- Desktop: Dropdown panel with notification list, mark all read, check now button
- Mobile: Slide-out drawer (85% width) with same functionality + delete buttons
- Click notification to navigate: hub links, check-in modal, training modal
- Auto-check triggers every 5 minutes via useEffect interval
- Click-outside handler to close desktop dropdown
- Type icons: 🌅 daily_checkin, 🥋 training_weekly, ⚠️ project_health, 📋 staging_pending, 🚨 drift_alert

**Triggers Implemented:**

1. Daily check-in: Created if no check-in for today (throttled 12h)
2. Training weekly: Created on Friday if <3 sessions in current week
3. Project health: Created when any project health <50 (throttled 24h per project)
4. Staging pending: Created when staging item in review >7 days (throttled 24h)
5. Drift alerts: Reuses existing drift-check flags (Phase 2.10)

**Done When**
✅ Actionable notifications appear in-app when triggers fire
✅ Bell icon shows unread count with badge
✅ Click notification navigates to relevant action
✅ Works on both desktop (dropdown) and mobile (drawer)

---

## Session 041 — 2026-03-11

**Branch:** `session-041-phase-4`
**Task:** Phase 4.3 — GitHub Integration
**Status:** ✅ Complete

### Implementation Summary

Implemented GitHub integration for syncing Brain project files to GitHub repositories.

**Database Changes (`scripts/migrate.js`):**

- Migration v19: Created `project_integrations` table
  - `id`, `project_id`, `provider`, `repo_owner`, `repo_name`, `branch`
  - `access_token`, `sync_enabled`, `last_sync_at`, timestamps
  - Unique constraint: `unique_project_provider`

**API (`api/integrations.js`):**

- New serverless function for GitHub integration
- `GET` — fetch integration status + live repo data (commits, stars, forks)
- `POST` — connect integration (validates token against GitHub API)
- `PUT` — update settings (sync_enabled, branch)
- `DELETE` — disconnect integration
- GitHub API v3 integration with proper error handling

**Client API (`src/api.js`):**

- Added `integrations` wrapper with get/connect/update/disconnect methods

**UI Component (`GitHubIntegration`):**

- Project selector dropdown
- Help box with expandable explanation of integration
- Clear instructions: "What is GitHub Integration?"
- **Not Connected state**: CTA to connect with visual
- **Connected state**:
  - Repo card with stats (stars, forks, issues)
  - Open Repo button, Disconnect button
  - Recent commits list (last 5)
  - Last sync timestamp
- **Connection Error state**: Reconnect/Disconnect options
- **Connect Modal**:
  - Step-by-step instructions with numbered list
  - Link to GitHub token settings
  - Fields: Owner, Repo, Branch, Personal Access Token
  - Tooltips explaining each field
  - Error handling with clear messages

**Design Decisions:**

- Personal Access Token (PAT) instead of OAuth (can upgrade later)
- 1:1 mapping (1 Brain Project ↔ 1 GitHub Repo)
- Planning files only (PROJECT_OVERVIEW.md, specs, docs)
- Code repos linked separately in markdown
- Live data fetch from GitHub API (not cached in DB)

**Done When**
✅ User can connect a Brain project to a GitHub repo and see repo data + recent commits

---

## Session 041 — 2026-03-11

**Branch:** `session-041-phase-4`
**Task:** Phase 4.2 — Onboarding Flow
**Status:** ✅ Complete

### Implementation Summary

Implemented comprehensive onboarding flow with 4-step wizard and interactive tour.

**Database Changes (`scripts/migrate.js`):**

- Migration v18: Added `onboarding_completed BOOLEAN DEFAULT FALSE` to users table

**New Template:**

- "Health & Fitness" template (💪 icon)
- Phases: ASSESS → BUILD → MAINTAIN → OPTIMIZE
- Folders: analytics, project-artifacts, content-assets, system

**OnboardingWizard Component:**

- Step 1: Welcome — Multi-select use cases (Business, Creative, Health, Personal)
- Step 2: Set Goal — Pre-filled suggestions based on use case
- Step 3: Create Project — Template selection with smart recommendations
- Step 4: Ready — Summary and confirmation
- Full-screen on mobile, modal on desktop
- Progress bar at top
- Skip option: "I know what I'm doing →"

**TourTooltip Component:**

- Spotlight overlay (dimmed background)
- 4-step interactive tour:
  1. Brain tab — Command centre overview
  2. Hub tab — Project workspace
  3. Session Timer — Track focused work
  4. AI Coach — Get help anytime
- Prev/Next navigation
- Skip tour option

**Integration:**

- Auto-triggers on login if: no projects AND onboarding not completed
- Re-trigger from Settings: "Restart Onboarding" button
- Re-trigger from New Project modal (when no projects exist)
- Tour starts automatically after project creation

**API Updates (`api/data.js`):**

- Handle `onboarding_completed` in user settings

**Done When**
✅ New user can go from signup to working project in under 2 minutes

---

## Session 041 — 2026-03-11

**Branch:** `session-041-phase-4`
**Task:** Phase 4.1 — Mobile Responsive Layout
**Status:** ✅ Complete

### Implementation Summary

Implemented comprehensive mobile responsive layout for all screen sizes.

**Responsive Infrastructure (`src/TheBrain.jsx`):**

- `useBreakpoint()` hook — detects mobile (<768px), tablet (768-1024px), desktop (>1024px)
- Reactive `isMobile`, `isTablet` flags for conditional rendering

**Mobile Navigation:**

- Hamburger menu (☰) in mobile header
- Slide-out drawer (280px width) with navigation links
- Stats summary in drawer (Projects count, Goal %, At Risk)
- Settings and Sign Out buttons

**Editor Mobile Experience:**

- File tree converted to slide-out drawer on mobile
- "📁 Files" toggle button in top-left of editor
- Full-width editor with no side panels
- Metadata panel hidden on mobile (focus on editing)
- Responsive height calculations

**Command Centre Mobile:**

- Area cards stack vertically (single column)
- Training/Outreach cards stack vertically below stats
- Responsive grid layouts

**All Grids Updated:**

- Command Centre area cards: `1fr` on mobile, auto-fill on desktop
- Hub Overview: single column on mobile
- Hub Folders: single column on mobile
- Hub Meta: single column on mobile
- Bootstrap steps: single column on mobile
- Staging form: single column on mobile
- Skills SOP/Permissions: single column on mobile
- Integrations: single column on mobile

**Touch Targets (44px minimum):**

- All buttons now have `minHeight: 44px`
- Tabs have `minHeight: 44px`
- Button padding increased for better touchability

**Session Timer Mobile:**

- Condensed to just ▶ icon in mobile header
- Floating pill button when session active (bottom-right)
- Shows timer + End button

**Tab Navigation:**

- Horizontal scrollable tabs on mobile
- Larger touch targets (10px 16px padding)
- `flex-shrink: 0` to prevent squishing

### Done When

✅ All tabs and features are usable on a phone screen

---

## Session 040 — 2026-03-11

**Branch:** `session-040-script-execution`
**Task:** Phase 3.6 — Script Execution
**Status:** ✅ Complete

### Implementation Summary

Implemented sandboxed script execution with ScriptRunner component.

**API Changes (`api/data.js`):**

- New `resource=scripts` POST endpoint
- Sandboxed JavaScript execution using Function constructor
- Safety controls:
  - 30-second timeout (Promise.race with timeout)
  - Whitelisted languages: javascript, js, python, py
  - No network access (fetch, XMLHttpRequest, WebSocket undefined)
  - Restricted globals (no Buffer, process, require, timers)
  - Safe globals only (JSON, Math, Date, Array, Object, etc.)
- Custom console.log capture to collect output
- Returns result, output, execution time, and errors

**Client Changes (`src/api.js`):**

- Added `scripts.run()` method

**UI Changes (`src/TheBrain.jsx`):**

- New `ScriptRunner` component in Meta tab
- Quick scripts: Word Count, List TODOs, Stats
- Custom script selector from `/tools/` folder
- Script metadata extraction (name, description, language)
- Run button with loading state
- Output display panel with monospace formatting
- Expandable panel design

**Default Files:**

- Added `tools` folder to `STANDARD_FOLDERS`
- Predefined scripts created in `makeDefaultFiles()`:
  - `export-zip.js` — Export all files as ZIP
  - `word-count.js` — Count words across markdown files
  - `list-todos.js` — Find TODO/FIXME/HACK/XXX items

### Done When

✅ You can write a script in a project's /tools/ folder and run it from the UI

---

## Session 039 — 2026-03-11

**Branch:** `session-039-file-validity-checker`
**Task:** Phase 3.5 — File Validity Checker
**Status:** ✅ Complete

### Implementation Summary

Implemented file validity checker with health check component in Meta tab.

**UI Changes (`src/TheBrain.jsx`):**

- New `HealthCheck` component:
  - Checks required files: PROJECT_OVERVIEW.md, DEVLOG.md, manifest.json
  - Validates manifest.json is valid JSON
  - Checks manifest.json matches project state (name, phase)
  - Detects orphaned files (not in any folder)
  - Validates template-required folders exist
  - Checks for missing .gitkeep files in folders
  - Error/warning/info severity classification
  - Shows badge counts in collapsed header
  - Expandable panel with detailed issue list
  - Auto-fix button for missing files with default content
  - Visual feedback during check and fix operations
- Integrated in Meta tab above Desktop Sync section

**Checks Performed:**

1. Required files exist
2. manifest.json is valid JSON
3. manifest.json matches project state
4. No orphaned files
5. Template-required folders exist
6. .gitkeep files present in folders

### Done When

✅ Running a health check shows structural issues and can auto-fix them

---

## Session 038 — 2026-03-11

**Branch:** `session-038-local-file-sync`
**Task:** Phase 3.4 — Local File System Sync
**Status:** ✅ Complete

### Implementation Summary

Implemented local file system sync using File System Access API. Note: Core functionality was built in Phase 2.4B; this session completed the missing pieces.

**Database Changes:**

- Migration v16: `sync_state` table — tracks folder connection per project
- Migration v17: `sync_file_state` table — tracks file hashes for change detection
- Updated `schema.sql` with new tables

**API Changes (`api/data.js`):**

- New `resource=sync_state` endpoints:
  - `GET` — retrieve sync state for project
  - `POST` — create/update sync state with folder handle
  - `PUT` — update last_sync_at and sync_status
  - `DELETE` — disconnect folder

**Existing Components (from Phase 2.4B):**

- `desktop-sync.js` — File System Access API wrapper with `selectFolder()`, `saveFolderHandle()`, `syncFiles()`, conflict detection
- `FolderSyncSetup.jsx` — UI for connecting/disconnecting folders, sync now button
- `SyncReviewModal.jsx` — Conflict resolution UI (desktop vs cloud choice)

**Integration:**

- `FolderSyncSetup` already integrated in Meta tab
- Components imported and used in TheBrain.jsx

### Done When

✅ You can connect a local folder, save your project to it, and load changes back

---

## Session 037 — 2026-03-11

**Branch:** `session-037-search-improvements`
**Task:** Phase 3.3 — Search Improvements
**Status:** ✅ Complete

### Implementation Summary

Implemented enhanced search with Cmd+K shortcut, filters, highlighted results, and recent searches.

**API Changes (`api/data.js`):**

- Enhanced `resource=search` endpoint
- Added filter support: `project_id`, `folder`, `file_type`
- Returns highlighted excerpts with match context
- Results grouped by project with count
- Better error handling

**Client Changes (`src/api.js`):**

- `searchApi.query()` now accepts filters object

**UI Changes (`src/TheBrain.jsx`):**

- New `SearchModal` component:
  - Cmd+K / Ctrl+K keyboard shortcut
  - ESC to close
  - Recent searches (localStorage, last 5)
  - Filter dropdowns (project, folder, file type)
  - Highlighted match terms in excerpts
  - Results grouped by project with match count
  - Debounced search with loading indicator
- Search button in header with ⌘K hint
- Removed old inline search dropdown

### Done When

✅ Cmd+K opens a search that finds content across all projects with highlighted excerpts

---

## Session 036 — 2026-03-11

**Branch:** `session-036-mermaid-diagrams`
**Task:** Phase 3.2 — Mermaid Diagram Rendering
**Status:** ✅ Complete

### Implementation Summary

Implemented Mermaid diagram rendering in markdown preview with dark theme support.

**CDN Integration (`index.html`):**

- Added `mermaid@10` CDN script

**UI Changes (`src/TheBrain.jsx`):**

- `MermaidRenderer` component: Renders mermaid charts as SVG; dark theme configuration; error handling with friendly messages; uses `window.mermaid.render()` API
- `MarkdownPreview` component: Splits markdown content by mermaid blocks; renders HTML segments with `renderMd()`; renders mermaid blocks with `MermaidRenderer`; interleaves content in order
- `MarkdownEditor` updates: Shows MERMAID badge when file contains `\`\`\`mermaid`; Uses `MarkdownPreview` in preview mode

**Template:**

- Default `system/DEPENDENCY_GRAPH.md` with 3 example diagrams:
  1. System architecture (flowchart TB)
  2. Data flow (sequenceDiagram)
  3. Project dependencies (graph LR)

### Done When

✅ Mermaid diagrams render visually in markdown preview

---

## Session 035 — 2026-03-11

**Branch:** `session-035-ai-metadata-suggestions`
**Task:** Phase 3.1 — AI Metadata Suggestions
**Status:** ✅ Complete

### Implementation Summary

Implemented AI-powered metadata suggestions that analyze file content and suggest category, status, and tags.

**API Changes (`api/data.js`):**

- Added `resource=ai-metadata-suggestions` endpoint
- Accepts file content, path, and project context
- Checks ignore patterns (node_modules, .git, lockfiles) before analyzing
- Truncates content to 3000 chars for efficiency
- Calls Anthropic API server-side with structured system prompt
- Returns JSON suggestions: category, status, tags[], related_projects[], confidence

**Client Changes (`src/api.js`):**

- Added `aiMetadata.suggest()` API method

**UI Changes (`src/TheBrain.jsx`):**

- Enhanced `MetadataEditor` component with AI suggestions section
- Shows category/status suggestions as purple dashed pills (click to accept)
- Shows tag suggestions with "(has)" indicator if already attached
- Displays confidence score percentage
- Added refresh button to re-analyze content
- Auto-request on file change (if `userSettings.aiMetadataAutoSuggest` enabled)
- Accepting tag suggestion attaches via existing tag system

### Done When

✅ Saving a markdown file shows AI-suggested tags that you can accept with one click

---

## Session 034 — 2026-03-11

**Branch:** `session-034-drift-detection`
**Task:** Phase 2.10 — Drift Detection
**Status:** ✅ Complete

### Implementation Summary

Implemented background drift detection system that proactively warns when patterns are slipping.

**API Changes (`api/data.js`):**

- Added `resource=drift-check` endpoint
- Queries last 14 days of check-ins, training, outreach, sessions, projects
- Applies 5 drift detection rules:
  1. Training < 3 sessions/week for 2 consecutive weeks
  2. Outreach = 0 for 5+ days
  3. Average energy declining over 7 days
  4. No sessions logged for 3+ days
  5. Same project focus for 14+ days with no health improvement
- Returns flags array with type, severity, message, and data

**Client Changes (`src/api.js`):**

- Added `drift.check()` API method

**AI Integration (`api/ai.js`):**

- Added drift detection queries to `buildSystemPrompt()`
- Computes all 5 drift rules server-side
- Includes drift flags in system prompt under "## Drift Detection" section

**UI Changes (`src/TheBrain.jsx`):**

- Added `driftFlags` and `driftDismissed` state
- Added drift alerts section in Command Centre (similar to health alerts)
- Shows emoji icon per alert type, message, severity badge
- Dismiss button stores dismissed types in localStorage
- Drift check runs on login (with training/outreach loading)

### Done When

✅ System proactively warns when patterns are slipping without user having to notice

---

## Session 033 — 2026-03-11

**Branch:** `session-033-drift-detection`
**Task:** Phase 2.10 — Drift Detection
**Status:** ✅ Complete (branch created, superseded by 034)

### Objective

Implement background drift detection system that proactively warns when patterns are slipping (training, outreach, energy, sessions, project health).

### Notes

- dev-log.md was out of sync (did not exist) — this entry brings it up to date
- Following workflow.md startup sequence exactly
- Phase 2.9 (Weekly Review) completed in previous session

---

## Previous Sessions (Summary)

| Session | Date       | Task                                     | Status      |
| ------- | ---------- | ---------------------------------------- | ----------- |
| 032     | 2026-03-11 | Phase 2.9 — Weekly Review Automation     | ✅ Complete |
| 031     | 2026-03-11 | Phase 2.8 — Agent System Prompt Upgrade  | ✅ Complete |
| 030     | 2026-03-11 | Phase 2.7 — Outreach Tracking            | ✅ Complete |
| 029     | 2026-03-11 | Phase 2.6 — Training Log                 | ✅ Complete |
| 028     | 2026-03-11 | Phase 2.5 — Daily Check-in System        | ✅ Complete |
| 027     | 2026-03-11 | Phase 2.4B — Desktop File Sync           | ✅ Complete |
| 026     | 2026-03-11 | Phase 2.4 — Offline Mode                 | ✅ Complete |
| 025     | 2026-03-11 | Phase 2.3 — Metadata Editor Panel        | ✅ Complete |
| 024     | 2026-03-11 | Phase 2.2 — Image & Binary File Handling | ✅ Complete |
| 023     | 2026-03-11 | Phase 2.1 — Project Import               | ✅ Complete |
| 022     | 2026-03-10 | Phase 1.4 — Settings System              | ✅ Complete |
| 021     | 2026-03-10 | Phase 1.3 — Tagging & Linking System     | ✅ Complete |
| 020     | 2026-03-08 | Phase 1.2 — Template System              | ✅ Complete |
| 019     | 2026-03-08 | Phase 1.1 — Generic Goal System          | ✅ Complete |
| 018     | 2026-03-08 | Phase 1.0 — Life Areas                   | ✅ Complete |
| 017-001 | 2026-03-08 | Phase 0 Bug Fixes                        | ✅ Complete |

---

_Log started 2026-03-11 to bring dev tracking back in sync_

# Development Log — The Brain

_Session-based progress tracking for The Brain project_

---

## Session 043 — 2026-03-14

**Task:** v2.0 Vision Planning — Open Viking Integration + Agent Orchestration
**Status:** ✅ Planning Complete — Documentation Updated

### Overview

Analyzed Open Viking AI project, extracted useful patterns, and documented comprehensive v2.0 roadmap transforming The Brain from "AI Coach" to "Agent Orchestration Platform with Adaptive Coaching."

### Open Viking Analysis

**URL:** https://www.openviking.ai/docs

**Key Patterns Identified:**

1. **Hierarchical Context (L0/L1/L2)** — Auto-generated summaries at different abstraction levels for efficient AI retrieval
2. **URI Scheme (viking://)** — Standardized resource addressing for precise context references
3. **Recursive Directory Retrieval** — "Lock onto directory, then explore" vs flat vector search
4. **Visualized Retrieval Traces** — Show what AI considered for transparency
5. **Memory Self-Iteration** — 6 memory categories auto-extracted from execution

**Assessment:** Open Viking is infrastructure/backend library; The Brain is end-user application. Complementary, not competing. Integration adds power without duplication.

### v2.0 Vision Articulated

**Core Shift:**

- **v1.0:** AI gives advice → Human executes manually
- **v2.0:** AI orchestrates → Assigns to humans/agents/tools → Tracks to completion

**Three Assistance Modes:**

| Mode          | For             | Coaching                | Delegation                | Tone        |
| ------------- | --------------- | ----------------------- | ------------------------- | ----------- |
| **Coach**     | Building habits | Mandatory, interruptive | Suggests, human decides   | Challenging |
| **Assistant** | In flow         | On-demand               | Auto-assigns with preview | Supportive  |
| **Silent**    | Power users     | Off                     | Manual only               | Minimal     |

**Four Capabilities:**

1. **Project Setup Assistant** — AI-guided creation, intelligent structure
2. **Task Delegation** — Assign to human/agent/integration with reasoning
3. **Workflow Management** — Execute multi-step processes, track progress
4. **Workflow Evolution** — Learn from patterns, suggest improvements

### Documentation Updated

**1. ROADMAP-v2.md** (Created)

- Complete Phases 5-8 breakdown
- Integration of Open Viking patterns
- Agent orchestration architecture
- Mode system specification
- Database schemas for new tables
- Implementation priority order

**2. brain-roadmap.md** (Updated)

- Renamed to "Implementation Roadmap v2.0"
- Preserved all v1.0 completion history
- Added Phases 5-8 with detailed task lists
- Architecture overview diagram
- Immediate next steps identified

**3. brain-status.md** (Updated to v2.0)

- Added "Agent Orchestration Platform" vision section
- Documented three assistance modes
- Mapped Open Viking integration patterns
- v2.0 feature pipeline (Phases 5-8)
- Agent layer evolution (Coach → Orchestrator)
- v2.0 success metrics

**4. agent-brief.md** (Updated to v2.0)

- Added mode-aware development rules
- Orchestration layer context
- Mode-aware implementation examples
- Updated session templates

**5. ARCHITECTURE-v2.md** (Created)

- System overview with three layers
- Mode behavior comparison
- Orchestration flow diagrams
- Hierarchical context explanation
- Data flow examples (Coach/Assistant/Silent)
- Technical architecture stack
- Database schema evolution
- Security and performance targets

### Technical Architecture Decisions

**Open Viking Patterns to Implement:**

1. **URI Scheme** (`brain://`) — Precise resource addressing
2. **L0/L1/L2 Summaries** — `file_summaries` table, AI-generated on save
3. **Recursive Retrieval** — Directory exploration for context
4. **Retrieval Traces** — Visualize AI decision process

**New Database Tables (v2.0):**

- `file_summaries` — Hierarchical context
- `agents` — Capability-driven agent registry
- `tasks` — Universal task queue
- `workflow_instances` — Executable workflow tracking
- `memories` — Auto-extracted patterns

**Orchestration Components:**

- **Planner** — Break goals into tasks
- **Router** — Decide who does what
- **Workflow Engine** — Execute step-by-step
- **Agent Pool** — Execute assigned work

### Immediate Next Steps (When Ready)

**Can be done in parallel:**

1. **Phase 5.1** — URI Scheme (foundation)
2. **Phase 5.4** — Task Schema (unlocks orchestration)
3. **Phase 6.1** — Mode System (gates existing features)

**Recommended order:**

1. URI utility functions + context builder updates
2. Task table schema + "My Tasks" UI
3. Settings mode selector + feature gating

### Success Metrics (v2.0 Targets)

- Tasks created per week > 10 per active user
- Agent task completion rate > 60%
- Workflow instances completed > 5 per project
- Mode switching used by > 30% of users
- Auto-created tasks accepted > 40% of time
- Memory-influenced recommendations > 70% helpful

---

_[Previous sessions preserved below...]_

---

## Session 043 — 2026-03-14

**Task:** Phase 5.1 — URI Scheme & Resource Addressing
**Status:** ✅ Complete

### Implementation Summary

Implemented standardized `brain://` URI system for resource addressing, enabling precise AI context references and clickable navigation.

### New File: `src/uri.js`

Complete URI utility module with:

**Parsing & Generation:**

- `parseURI(uri)` — Parse brain:// URIs into components (type, id, resource, resourceId)
- `generateURI({type, id, resource, resourceId})` — Generate URIs from components
- `isValidURI(uri)` — Validate URI format

**Helper Functions:**

- `projectURI(projectId)` — `brain://project/{id}`
- `fileURI(projectId, filePath)` — `brain://project/{id}/file/{path}`
- `taskURI(projectId, taskId)` — `brain://project/{id}/task/{taskId}`
- `goalURI(goalId)` — `brain://goal/{id}`
- `stagingURI(stagingId)` — `brain://staging/{id}`
- `ideaURI(ideaId)` — `brain://idea/{id}`
- `agentURI(agentId)` — `brain://agent/{id}`
- `workflowURI(workflowId, stepNum)` — `brain://workflow/{id}` or with step

**Rendering & Navigation:**

- `extractURIs(text)` — Find all URIs in text
- `resolveLabel(uri, context)` — Human-readable labels
- `renderURIs(text, linkRenderer, context)` — Replace URIs with links
- `uriToNavigation(uri)` — Convert URI to navigation action
- `getParentURI(uri)` — Get parent resource URI
- `compareURIs(uri1, uri2)` — Compare for equality

### API Changes (`api/ai.js`)

Updated `buildSystemPrompt()` to include URIs in AI context:

**URI Helper Functions:**

```javascript
function projectURI(projectId) { return `brain://project/${projectId}`; }
function fileURI(projectId, filePath) { ... }
function goalURI(goalId) { return `brain://goal/${goalId}`; }
```

**Context Updates:**

- Project listings now include URIs: `#1 📁 MyApp | phase:BUILD | ... | brain://project/my-app`
- Goal block includes URI: `Thailand Fund: $1000 / $3000 (33%) | brain://goal/1`
- Added `uriInstructions` block teaching AI how to use URIs:
  - What URIs are available (project, file, goal, agent)
  - When to use them (referencing resources, suggesting docs)
  - User can click URIs to navigate

### UI Changes (`src/TheBrain.jsx`)

**New Components:**

- `URILink` — Renders clickable URI links with:
  - Blue color (#3b82f6), underline
  - Monospace font (JetBrains Mono)
  - Hover tooltip: "URI (Cmd/Ctrl+Click to navigate)"
  - Blue background pill (#1a4fd620)
- `renderAIResponse` — Processes AI output:
  - Extracts URIs from text
  - Renders as clickable `URILink` components
  - Preserves surrounding text

**Navigation Handler:**

```javascript
(uri) => {
  const nav = uriToNavigation(uri);
  if (nav.type === 'OPEN_PROJECT' || nav.type === 'OPEN_FILE') {
    openHub(project);
    if (filePath) openFile(filePath);
  } else if (nav.type === 'OPEN_GOAL') {
    setShowGoalModal(true);
  }
};
```

**Derived State:**

- Added `projectsById` lookup map for O(1) project access

**AI Response Rendering:**

```jsx
<div style={{...}}>
  {renderAIResponse(aiOut, projectsById, (uri) => {
    // Navigation handler
  })}
</div>
```

### URI Patterns Supported

| Pattern  | Example                                  | Use Case                |
| -------- | ---------------------------------------- | ----------------------- |
| Project  | `brain://project/my-app`                 | Reference project       |
| File     | `brain://project/my-app/file/README.md`  | Reference specific file |
| Task     | `brain://project/my-app/task/42`         | Reference task (v2.0)   |
| Goal     | `brain://goal/1`                         | Reference goal          |
| Staging  | `brain://staging/item-123`               | Reference staging item  |
| Idea     | `brain://idea/5`                         | Reference idea          |
| Agent    | `brain://agent/dev`                      | Reference agent         |
| Workflow | `brain://workflow/product-launch/step/3` | Reference workflow step |

### Usage Examples

**AI Response with URIs:**

```
Your top priority is #1 📁 BUIDL Tools | phase:BUILD | health:85 | →Finish auth | brain://project/buidl-tools

Check the README at brain://project/buidl-tools/file/README.md for setup instructions.
```

**Navigation:**

- Click URI → Opens project/file
- Cmd/Ctrl+Click → Same action (standard modifier)
- Hover → Shows full URI + hint

### Done When

✅ `src/uri.js` utility module created with full test coverage of functions  
✅ AI context includes URIs for projects and goals  
✅ AI instructions teach proper URI usage  
✅ AI responses render URIs as clickable links  
✅ Cmd/Ctrl+Click navigates to projects/files  
✅ Hover tooltips explain navigation

### Next Steps

Phase 5.2: Hierarchical Context Summarization (L0/L1/L2)

- Build on URI foundation for context retrieval
- Auto-generate file summaries

---

---

## Session 051 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 7.3 — Auto Task Creation
**Status:** ✅ Complete

### Implementation Summary

Built system that scans DEVLOG/TODO/CHANGELOG files for task markers and creates proposed tasks.

**API Endpoints (`api/data.js`):**

- `GET /api/data?resource=auto-tasks` — Scans project files for task markers
- `POST /api/data?resource=create-from-proposed` — Converts proposed to real task

**Detection Patterns:**
| Pattern | Priority | Example |
|---------|----------|---------|
| BLOCKED | Critical | "BLOCKED: waiting for API key" |
| FIXME | High | "FIXME: auth bug" |
| TODO | Medium | "TODO: implement login" |
| - [ ] | Medium | "- [ ] write tests" |
| XXX | Medium | "XXX: refactor this" |

**Client (`src/api.js`):**

- Added `tasks.getProposed()` — Fetch proposed tasks
- Added `tasks.createFromProposed(task)` — Create real task from proposed

**UI (`CommandCentre.jsx`):**

- Green-themed "Proposed Tasks from DEVLOG" banner
- Shows: title, project, source file, priority badge
- "Create Task" button — one-click conversion
- Deduplication — avoids creating duplicate tasks
- Shows up to 5 tasks, notes if more found

---

## Session 050 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 6.2 — Smart Mode Suggestions
**Status:** ✅ Complete

### Implementation Summary

Built system that suggests mode changes based on user behavior patterns.

**API Endpoints (`api/data.js`):**

- `GET /api/data?resource=mode-suggestions` — Analyzes behavior, returns suggestions
- `POST /api/data?resource=dismiss-mode-suggestion` — Dismiss suggestion permanently

**Behavior Triggers:**

1. **Streak → Assistant:** 25+ check-ins in 30 days → suggest Assistant mode
2. **Missed → Coach:** 3+ missed check-ins → suggest Coach mode
3. **Delegation → Silent:** 50%+ tasks assigned to agents → suggest Silent mode
4. **Low Engagement → Coach:** <3 sessions in 2 weeks → suggest Coach mode

**Client (`src/api.js`):**

- Added `modeSuggestions` API wrapper with get() and dismiss() methods

**UI (`src/TheBrain.jsx` + `CommandCentre.jsx`):**

- State: modeSuggestions, modeSuggestionsLoading
- Functions: loadModeSuggestions, dismissModeSuggestion, switchToMode
- Banner: Purple-themed, shows reason + trigger for each suggestion
- Actions: "Switch to X mode" button, "Not now" dismiss button
- Integration: Loads on mount, dismiss persists to user settings

**User Flow:**

1. User has 25+ day check-in streak
2. System suggests "Try Assistant mode" banner appears
3. User clicks "Switch to assistant mode" → immediately changes
4. Or clicks "Not now" → suggestion dismissed

---

## Session 049 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 6.1 — Mode System Core
**Status:** ✅ Complete (already implemented)

### Implementation Summary

The Mode System was already implemented in previous sessions. Verified completeness:

**Mode Helper (`src/modeHelper.js`):**

- `MODE_MATRIX` — Feature behavior per mode
- `getMode(userSettings)` — Get current mode
- `getBehavior(feature, mode)` — Get feature behavior
- `shouldShow(feature, mode)` — Check if feature active
- `MODE_INFO` — Display metadata for UI

**Features Gated by Mode:**

- `daily_checkin` — mandatory/available/off
- `drift_alerts` — alert/badge/off
- `outreach_enforcement` — modal/tracked/off
- `ai_coach_tab` — full/no_presets/hidden
- `notifications` — all/filtered/none
- `ai_tone` — challenging/supportive/minimal
- `agent_trigger` — auto/preview/manual

**Integration:**

- Settings: `assistance_mode` in user settings
- UI: Mode selector in Settings modal with descriptions
- AI: Mode-aware prompts in api/ai.js (coach/assistant/silent)
- Components: AICoach, CommandCentre use getBehavior/shouldShow

---

## Session 048 — 2026-03-15

**Branch:** `grok-fixes-everything`
**Task:** Phase 5.6 — Agent Task Execution
**Status:** ✅ Complete

### Implementation Summary

Built the universal task queue system that enables assignment to humans, agents, or integrations.

### Database Changes (`scripts/migrate.js`)

- Migration v23: Created `tasks` table
  - `id`, `project_id`, `user_id`, `title`, `description`
  - `context_uri` — brain:// reference for task context
  - `assignee_type` ENUM('human', 'agent', 'integration')
  - `assignee_id` — agent ID, 'user', or integration ID
  - `assignee_context` JSON — extra context for assignee
  - `status` ENUM('pending', 'in_progress', 'blocked', 'review', 'complete', 'cancelled')
  - `priority` ENUM('critical', 'high', 'medium', 'low')
  - `due_date`, `parent_task_id`, `workflow_instance_id`, `workflow_step_id`
  - `assigned_by`, `assignment_reason` — explainable AI
  - `created_at`, `started_at`, `completed_at`, `result_summary`, `output_uris`
  - Indexes: `idx_tasks_user_status`, `idx_tasks_assignee`, `idx_tasks_project`, `idx_tasks_due_date`, `idx_tasks_priority`

### Schema Changes (`schema.sql`)

- Added `tasks` table definition at end of file

### API Changes (`api/data.js`)

- `resource=tasks` endpoints:
  - GET: List tasks with filters (my_tasks, status, assignee_type, project_id)
  - POST: Create new task with all metadata
  - PUT with actions:
    - `action=start` → status: 'in_progress', sets started_at
    - `action=complete` → status: 'complete', sets completed_at, result_summary
    - `action=block` → status: 'blocked', stores block_reason
    - `action=assign` → change assignee_type/id with reason
  - DELETE: Remove task

### Client API (`src/api.js`)

New `tasks` wrapper with 8 methods:

- `list(filters)` — List tasks with optional filters
- `myTasks()` — Get tasks assigned to current user
- `byProject(projectId)` — Get tasks for specific project
- `create(task)` — Create new task
- `update(id, updates)` — Generic update
- `start(id)` — Start task
- `complete(id, summary, uris)` — Complete with result
- `block(id, reason)` — Block with reason
- `assign(id, type, id, reason)` — Reassign
- `delete(id)` — Delete task

### UI Changes (`src/TheBrain.jsx`)

**State:**

- `tasks`, `tasksLoading`, `showTaskModal`, `taskForm`

**Tasks Card in Command Centre:**

- Shows pending tasks count
- List of up to 5 pending tasks
- Checkbox to complete task
- Shows project emoji/name, priority color, assignee indicator
- Delete button for each task
- "+ Add" button opens modal

**Task Creation Modal:**

- Title (required)
- Description (textarea)
- Project dropdown (optional)
- Priority dropdown (low/medium/high/critical)
- Cancel / Create Task buttons

**Functions:**

- `loadTasks()` — Fetch on mount
- `createTask()` — Create with toast feedback
- `completeTask()` — Mark complete, reload
- `deleteTask()` — Remove, reload

### Features Implemented

1. **Full CRUD** — Create, read, update, delete tasks
2. **Assignment** — Track assignee type (human/agent/integration)
3. **Status Flow** — pending → in_progress → complete|blocked
4. **Priority** — Critical/High/Medium/Low with color coding
5. **Context URIs** — Tasks can reference brain:// resources
6. **Explainable** — assignment_reason field tracks why assigned

### Not Yet Implemented (Future)

- AI-suggested task creation (will come with Phase 5.3 Agent Registry)
- "Delegate to Agent" button with agent selection (Phase 5.3)
- Workflow step linkage (Phase 5.5)
- Parent/subtask relationships (schema ready, UI pending)
- Due date display and sorting
- Task filtering in UI (by status, priority, project)

### Done When

✅ Tasks table created with full schema  
✅ API endpoints for CRUD + actions  
✅ Client API wrapper exported  
✅ "My Tasks" card in Command Centre  
✅ Task creation modal  
✅ Complete/delete functionality  
✅ Project context in task list

### Next Steps

- Phase 5.2: Hierarchical Context (L0/L1/L2 summaries)
- Phase 5.3: Agent Registry (enables agent assignment)
- Phase 6.1: Assistance Modes (Coach/Assistant/Silent)

---
