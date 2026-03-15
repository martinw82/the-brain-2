# THE BRAIN — Implementation Roadmap v2.0

**Agent Orchestration Platform with Adaptive Coaching**

**Companion to:** BRAIN_STATUS.md  
**Purpose:** Step-by-step task list from current state to v2.0 vision  
**Principle:** Build foundations that things can be built on top of. Every feature should be a module, not a monolith.

---

## Document Legend

- `[DB]` = needs schema change
- `[API]` = needs new or modified API route
- `[UI]` = needs frontend component work
- `[CONFIG]` = needs configuration/environment change
- `[EXTENSIBLE]` = foundation that other features plug into
- `✅` = Complete
- `🔄` = In Progress
- `📋` = Planned

---

## CURRENT STATE: Phase 1 Complete, v1.0 Shipped

**32 Database tables** — Full persistence via TiDB  
**Multi-provider AI** — Anthropic, Moonshot, DeepSeek, Mistral, OpenAI  
**Responsive UI** — Desktop, tablet, mobile

**See:** BRAIN_STATUS.md Section 4 for full "What's Built" inventory

---

## PHASE 0 — Bug Fixes ✅ COMPLETE (2026-03-08)

| Task                              | Status     | Notes                                     |
| --------------------------------- | ---------- | ----------------------------------------- |
| 0.1 File loading from DB          | ✅         | Lazy loading via `openHub()`              |
| 0.2 Comments loading from DB      | ✅         | `useEffect` watches `[hubId, activeFile]` |
| 0.3 AI Coach proxy function       | ✅         | Server-side, key not exposed              |
| 0.4 Rename project stale ref      | ✅         | Functional updater pattern                |
| 0.5 Session timer beforeunload    | ✅         | Warns on active session                   |
| 0.6 Bootstrap wizard null check   | ✅         | Toast error on missing project            |
| 0.7 Soft deletes on project_files | ✅         | `deleted_at` column                       |
| 0.8 Debounced saves in editor     | ✅         | 2-second debounce                         |
| 0.9 AI rate limiting              | ⚠️ PARTIAL | Rate limit ✅, caching ❌                 |

---

## PHASE 0.5 — Critical Path Tests ✅ COMPLETE (2026-03-15)

- [x] Test: File save/load round-trip
- [x] Test: Comment persistence
- [x] Test: Session logging
- [x] DB migration versioning (schema_migrations table)

---

## PHASE 1 — Foundations ✅ COMPLETE (2026-03-08)

**Core "Life > Parts > Things" infrastructure**

| Task                      | Status | Key Deliverable                     |
| ------------------------- | ------ | ----------------------------------- |
| 1.0 Life Areas (Parts)    | ✅     | `life_areas` table, health tracking |
| 1.1 Generic Goal Tracking | ✅     | Configurable goals, contributions   |
| 1.2 Project Templates     | ✅     | 6 system templates, custom save     |
| 1.3 Tagging & Linking     | ✅     | Cross-entity tags, relationships    |
| 1.4 Settings Persistence  | ✅     | `settings` JSON on users table      |

---

## PHASE 2 — Daily Tool Features ✅ COMPLETE (2026-03-11)

_Make it usable every day without friction._

| Task                            | Status | Key Deliverable                   |
| ------------------------------- | ------ | --------------------------------- |
| 2.1 Project Import              | ✅     | BUIDL, JSON, folder picker        |
| 2.2 Image & Binary Handling     | ✅     | Viewer, base64 upload, download   |
| 2.3 Metadata Editor Panel       | ✅     | `file_metadata` table, categories |
| 2.4 Offline Mode                | ✅     | localStorage cache, sync queue    |
| 2.5 Daily Check-in System       | ✅     | Sleep/energy/gut tracking         |
| 2.6 Training Log                | ✅     | Weekly targets, correlation       |
| 2.7 Outreach Tracking           | ✅     | Mandatory minimum enforcement     |
| 2.8 Agent System Prompt Upgrade | ✅     | 10 rules, state routing           |
| 2.9 Weekly Review Automation    | ✅     | Auto-aggregated stats             |
| 2.10 Drift Detection            | ✅     | 5 pattern alerts                  |

---

## PHASE 3 — Power Features ✅ COMPLETE (2026-03-11)

_Features that multiply effectiveness._

| Task                          | Status | Key Deliverable                 |
| ----------------------------- | ------ | ------------------------------- |
| 3.1 AI Metadata Suggestions   | ✅     | Content-based category/tags     |
| 3.2 Mermaid Diagram Rendering | ✅     | SVG diagrams from markdown      |
| 3.3 Search Improvements       | ✅     | Cmd+K, filters, highlighting    |
| 3.4 Local File System Sync    | ✅     | Bi-directional desktop sync     |
| 3.5 File Validity Checker     | ✅     | Structural validation, auto-fix |
| 3.6 Script Execution          | ✅     | Sandboxed JS, `/tools/` folder  |

---

## PHASE 4 — Mobile, Offline, Polish ✅ COMPLETE (2026-03-12)

_Make it work everywhere, reliably._

| Task                         | Status | Key Deliverable                   |
| ---------------------------- | ------ | --------------------------------- |
| 4.1 Mobile Responsive Layout | ✅     | Breakpoints, touch targets        |
| 4.2 Onboarding Flow          | ✅     | 4-step wizard, guided tour        |
| 4.3 Integration Connectors   | ✅     | GitHub PAT integration            |
| 4.4 Notification System      | ✅     | In-app bell, trigger-based alerts |

---

# 🚀 PHASE 5 — Agent Orchestration Foundation

**Goal:** Transform from "AI gives advice" to "AI assigns and tracks work"

## 5.1 URI Scheme & Resource Addressing `[API]` `[EXTENSIBLE]` ✅ COMPLETE (2026-03-14)

**Deliverable:** Standardized `brain://` URI system for all entities

**Schema:**

```
brain://project/{id}
brain://project/{id}/file/{path}
brain://project/{id}/task/{taskId}
brain://goal/{id}
brain://staging/{id}
brain://idea/{id}
brain://agent/{agentId}
brain://workflow/{id}/step/{stepNum}
```

**Tasks:**

- [x] `[API]` Create `src/uri.js` — URI parser/generator utility
- [x] `[API]` Update AI context builder to use URIs
- [x] `[UI]` Clickable URI links in AI responses
- [x] `[UI]` Cmd+Click navigation to resources

**Done when:** ✅ All resources have canonical URIs, AI references them precisely, user can click to navigate

---

## 5.2 Hierarchical Context Summarization `[DB]` `[API]` `[EXTENSIBLE]` ✅ COMPLETE (2026-03-15)

**Deliverable:** L0/L1/L2 auto-generated summaries (Open Viking pattern)

| Level       | Tokens    | Purpose                        | Generation      |
| ----------- | --------- | ------------------------------ | --------------- |
| L0 Abstract | ~100      | Vector search, quick filtering | AI on file save |
| L1 Overview | ~2,000    | Navigation, context routing    | AI on file save |
| L2 Detail   | Unlimited | Full content, execution        | Original file   |

**Schema (Migration v24):**

```sql
CREATE TABLE file_summaries (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id VARCHAR(64) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  l0_abstract TEXT,
  l1_overview TEXT,
  content_hash VARCHAR(64) NOT NULL,
  token_count INT,
  generated_at DATETIME,
  updated_at DATETIME,
  generated_by VARCHAR(64),
  UNIQUE KEY (project_id, file_path)
);
```

**Implementation:**

- [x] `[DB]` Migration v24 for `file_summaries` table
- [x] `[API]` `resource=file-summaries` CRUD endpoints
- [x] `[API]` Background summarization on file save (fire-and-forget)
- [x] `[UI]` FileSummaryViewer component in Meta tab
- [x] `[LIB]` `src/summaries.js` utilities (check, store, build context)

**Done when:** ✅ Summaries auto-generate on save, viewable in Meta tab, used for AI context

---

## 5.3 Agent Registry & Capabilities `[FILE]` `[API]` `[EXTENSIBLE]` ✅ COMPLETE (2026-03-15)

**Deliverable:** File-based agent definitions (migrated from static SKILLS object)

**Architecture Decision:** Agents as files, not database rows

- Immutable agent definitions in `/agents/*.md`
- Frontmatter = metadata (capabilities, permissions, etc.)
- Body = prompt_prefix
- New file = new agent version (verbose naming: `agent-v2-proj-date`)
- No persistent agent state - agents spin up, execute, die
- Stats derived from tasks table (execution history)

**System Agents (`/agents/`):**

- `system-dev.md` — Code, debug, deploy (🛠)
- `system-content.md` — Write, draft, social (✍️)
- `system-strategy.md` — Planning, revenue, prioritization (🎯)
- `system-design.md` — UI/UX, branding, visual (🎨)
- `system-research.md` — Market research, competitor analysis (🔬)

**Agent File Format:**

```markdown
---
id: system-dev-v1
version: 1
name: Dev Agent
capabilities: [code.write, code.review, code.debug]
permissions: [read:all, write:code-modules]
ignore_patterns: [legal/, '*.test.js']
model: claude-sonnet-4-6
handoff_rules:
  on_error: escalate_to_human
---

# Dev Agent

You are a senior developer...
```

**Implementation:**

- [x] `[FILE]` 5 system agents as .md files in `/agents/`
- [x] `[API]` AgentRegistry service (`src/agents.js`)
  - `loadAgents()` — Parse all /agents/\*.md files
  - `findByCapability()` — Query by capability
  - `selectAgent()` — Score and select best agent
  - `cloneAgent()` — Create new agent from existing
  - `buildAgentPrompt()` — Construct full prompt with context
- [x] `[UI]` AgentManager component (`src/components/AgentManager.jsx`)
  - Browse system + custom agents
  - View agent details (capabilities, permissions, stats)
  - Clone agent to create custom version
  - Edit capabilities, permissions, prompt
  - Save to project files
- [x] `[UI]` Capability-based task assignment
  - Task modal shows "Me (Human)" vs "Agent" toggle
  - Lists available agents with capabilities
  - Assigns task to selected agent

**Done when:** ✅ Users can browse agents, clone to create custom agents, assign tasks by capability

---

## 5.4 Task Delegation System `[DB]` `[API]` `[UI]` `[EXTENSIBLE]` ✅ COMPLETE (2026-03-14)

**Deliverable:** Universal task queue with intelligent assignment

**Schema:**

```sql
CREATE TABLE tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id VARCHAR(64),
  user_id INT,
  title VARCHAR(256),
  description TEXT,
  context_uri VARCHAR(512),      -- brain:// reference
  assignee_type ENUM('human', 'agent', 'integration'),
  assignee_id VARCHAR(64),
  status ENUM('pending', 'in_progress', 'blocked', 'review', 'complete'),
  priority ENUM('critical', 'high', 'medium', 'low'),
  due_date DATE,
  parent_task_id INT,
  workflow_instance_id INT,
  assigned_by ENUM('ai', 'user', 'workflow'),
  assignment_reason TEXT,
  created_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  result_summary TEXT,
  output_uris JSON,
  INDEX (user_id, status),
  INDEX (assignee_type, assignee_id, status)
);
```

**API Endpoints:**

- `GET/POST/PUT /api/data?resource=tasks`
- `POST /api/data?resource=tasks&action=assign`
- `GET /api/data?resource=my-tasks`

**UI Components:**

- [x] `[UI]` "My Tasks" view in Command Centre
- [x] `[UI]` Task creation modal
- [x] `[UI]` Task complete/delete actions
- [ ] `[UI]` Task detail panel (context, assignee, status)
- [ ] `[UI]` "Delegate to Agent" button (needs Agent Registry from 5.3)

**Assignment Logic (v1):**

```javascript
// Simple rules-based routing
if (task.type === 'code' && user.energy >= 7) → assign to dev agent
if (task.type === 'code' && user.energy < 7) → assign to human + note
if (task.type === 'content') → assign to content agent
if (task.urgency === 'critical') → assign to human
```

**Done when:** Tasks can be created, assigned, tracked to completion

---

## 5.5 Workflow Execution Engine `[DB]` `[API]` `[UI]` ✅ COMPLETE (2026-03-15)

**Deliverable:** From static templates to executable instances

**Schema (Migration v25):**

```sql
CREATE TABLE workflow_templates (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36),
  name, description, icon,
  steps JSON, triggers JSON,
  is_system, is_active
);

CREATE TABLE workflow_instances (
  id VARCHAR(36) PRIMARY KEY,
  workflow_template_id, project_id, user_id,
  status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'aborted'),
  current_step_index, step_results JSON, execution_log TEXT,
  started_at, completed_at
);
```

**System Workflows (`agents/system-workflows.json`):**

- 🚀 Product Launch (7 steps)
- ✍️ Content Sprint (5 steps)
- 💡 Idea → Brief (6 steps)
- 📊 Weekly Review (6 steps)
- 🔒 Security Audit (5 steps)

**Implementation:**

- [x] `[DB]` Migration v25 for workflow tables
- [x] `[API]` `resource=workflows` CRUD endpoints
- [x] `[API]` `resource=workflow-instances` lifecycle endpoints
- [x] `[LIB]` `src/workflows.js` execution engine
  - `startWorkflow()` — Create instance, execute first step
  - `executeStep()` — Create task for step, assign to agent
  - `onTaskComplete()` — Advance workflow, trigger next step
  - `getProgress()` — Calculate completion percentage
- [x] `[UI]` WorkflowRunner component
  - List templates with step count
  - Start workflow modal
  - Running instances with progress bars
  - Pause/resume/abort controls
  - Instance detail view with steps and execution log
  - History of completed workflows

**Execution Model:**

1. User clicks "Start Workflow"
2. Instance created, first step executed
3. Task created with capability-based agent assignment
4. Agent completes task → workflow advances
5. Auto-execute next step until complete

**Done when:** ✅ Workflows execute step-by-step, create tasks, track progress

---

## 5.6 Agent Task Execution `[API]` `[CONFIG]` ✅ COMPLETE (2026-03-15)

**Deliverable:** Agents can DO things, not just advise

**Agent Actions (function calling):**

- `read_file(uri)` — Get L2 content
- `write_file(uri, content, mode)` — Create/update/preview
- `create_task(title, desc, assignee)` — Delegate
- `search_projects(query)` — Find context
- `request_review(reason)` — Escalate
- `mark_complete(summary, outputs)` — Finish

**Implementation:**

- [x] `[API]` `api/agent-execute.js` — New endpoint for agent execution with function calling
- [x] `[API]` Multi-provider support: Anthropic (Claude), OpenAI (GPT), Mistral
- [x] `[API]` Tool/function definitions for all 6 actions
- [x] `[CONFIG]` Sandboxed file operations (respect ignore_patterns per agent)
- [x] `[UI]` Auto-run toggle in Settings: `auto_run_agents` setting
- [x] `[UI]` Preview mode: agents propose changes without executing
- [x] `[CONFIG]` Auto mode: trusted agents execute directly
- [x] `[LIB]` `src/agentFunctions.js` — Client-side function definitions

**Function Calling Flow:**

1. Agent receives task with function definitions
2. Agent decides to call function(s) to accomplish task
3. Server executes function (with ignore_patterns check)
4. Results returned to agent
5. Agent continues until task complete or max iterations

**Done when:** ✅ Agents can read, write, create sub-tasks, complete assignments with preview/auto modes

---

# 🎯 PHASE 6 — Adaptive Assistance Modes

**Goal:** Three modes serving different user needs

## 6.1 Mode System Core `[DB]` `[API]` `[UI]` `[CONFIG]` ✅ COMPLETE (2026-03-15)

**Deliverable:** Coach / Assistant / Silent modes

**Settings Schema:**

```json
{
  "assistance_mode": "coach",
  "coach_intensity": 0.8,
  "auto_run_agents": true,
  "proactive_suggestions": true,
  "checkin_required": true,
  "interruption_policy": "respect_focus"
}
```

**Mode Definitions:**

| Aspect          | Coach                           | Assistant                   | Silent           |
| --------------- | ------------------------------- | --------------------------- | ---------------- |
| Identity        | "Direct accountability partner" | "Helpful project assistant" | "System tool"    |
| Tone            | Challenging, direct             | Supportive, neutral         | Minimal, factual |
| Check-ins       | Mandatory daily                 | Available, not prompted     | Off              |
| Drift alerts    | Interruptive popups             | Dashboard badge only        | Off              |
| Outreach        | "NOT DONE (mandatory)"          | Tracked, optional           | Off              |
| Task creation   | Proactive                       | Proactive                   | Manual only      |
| Agent execution | Auto-runs                       | Auto-runs                   | Preview mode     |

**Implementation:**

- [x] `[DB]` Add `assistance_mode` to settings JSON
- [x] `[UI]` Mode selector in Settings with descriptions (TheBrain.jsx)
- [x] `[API]` Mode-aware system prompt builder (api/ai.js)
- [x] `[UI]` Mode-based feature visibility (modeHelper.js + components)
- [x] `[API]` Mode-aware interruption logic (UI gating via modeHelper)

**Components:**

- `src/modeHelper.js` — Mode matrix, getMode, getBehavior, shouldShow functions
- `MODE_INFO` — Display metadata for each mode
- Settings toggle in Settings modal
- AICoach, CommandCentre gated by mode

**Done when:** ✅ User can switch modes, UI adapts, AI tone changes (Complete 2026-03-15)

---

## 6.2 Smart Mode Suggestions `[API]` `[UI]` ✅ COMPLETE (2026-03-15)

**Deliverable:** System suggests mode changes based on behavior

**Triggers:**

- 25+ day check-in streak → suggest Assistant mode
- 3+ missed check-ins in 30 days → suggest back to Coach
- 50%+ agent delegation rate → suggest Silent mode
- Low engagement (less than 3 sessions in 2 weeks) → suggest Coach

**Implementation:**

- [x] `[API]` `resource=mode-suggestions` endpoint — Analyzes user behavior, returns suggestions
- [x] `[API]` `resource=dismiss-mode-suggestion` — Dismiss suggestion permanently
- [x] `[UI]` Mode suggestion banner in Command Centre
- [x] `[UI]` "Switch to X mode" button with one-click mode change
- [x] `[UI]` "Not now" button to dismiss suggestion

**UI Features:**

- Purple-themed banner (distinguishes from drift alerts)
- Shows reason and trigger for each suggestion
- One-click mode switch button
- Dismiss button to hide suggestion
- Persists dismissed suggestions in user settings

**Done when:** ✅ Users get helpful mode transition suggestions (Complete 2026-03-15)

---

# 🧠 PHASE 7 — Intelligence & Evolution

## 7.1 Recursive Directory Retrieval `[API]` `[EXTENSIBLE]` 📋

**Deliverable:** AI explores project structure intelligently (Open Viking pattern)

**Algorithm:**

1. Intent analysis → extract keywords
2. L0 vector search → find candidate directories
3. L1 exploration within candidates
4. Recursive descent if subdirectories found
5. Return results + trace

**UI:**

- [ ] `[UI]` "Retrieval trace" in AI responses
- [ ] Shows: "Explored briefs/ → system/ → skipped marketing/"

**Done when:** AI finds context by exploring structure, not just flat search

---

## 7.2 Workflow Learning `[API]` `[DB]` 📋

**Deliverable:** Detect patterns, suggest workflow improvements

**Pattern Detection:**

- After 3 similar projects → "Create workflow from this pattern?"
- Track: planned vs actual duration
- Track: agent success rates
- Suggest: "Dev agent always takes 2x. Adjust estimate?"

**Done when:** System suggests workflow templates from completed work

---

## 7.3 Auto Task Creation `[API]` `[DB]` 📋

**Deliverable:** Create tasks from unstructured inputs

**Sources:**

- DEVLOG.md: "Started work on auth" → Task: "Complete auth"
- Blockers: "Waiting for API key" → Task: "Follow up on API key"
- Comments: "We should refactor this" → Task: "Refactor X"

**Implementation:**

- [ ] `[API]` Background job: scan DEVLOG.md daily
- [ ] `[API]` Extract keywords: TODO|FIXME|XXX|BLOCKED
- [ ] `[API]` AI classification: type, priority, assignee
- [ ] `[UI]` "Proposed Tasks" queue for approval

**Done when:** Unstructured inputs become structured tasks

---

## 7.4 Memory Self-Iteration `[DB]` `[API]` 📋

**Deliverable:** Learn from execution (Open Viking pattern)

**Six Memory Categories:**

```sql
CREATE TABLE memories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  category ENUM('profile', 'preferences', 'entities', 'events', 'cases', 'patterns'),
  content TEXT,
  source_task_id INT,
  confidence FLOAT,
  created_at DATETIME
);
```

**Auto-Extraction:**

- After workflow completion → extract patterns
- After task completion → update skill success rates
- After project completion → update entity relationships

**Usage:**

- "You usually underestimate dev tasks by 2x"
- "You work best on strategy in the morning"

**Done when:** System personalizes based on execution history

---

# 📦 PHASE 8 — Ecosystem & Scale

## 8.1 Community Workflows `[API]` `[UI]` 📋

- Publish workflows (anonymized)
- Star/fork templates
- "Most used workflows for SaaS launches"

## 8.2 Advanced Integrations `[API]` `[CONFIG]` 📋

**Two-Way Sync:**

- GitHub: PR creation, issue sync
- Calendar: Block time for tasks
- Email: Send/receive as task interactions
- Slack/Discord: Channel as project feed

## 8.3 Performance & Scale `[CONFIG]` 📋

- Pagination for large project lists
- Virtual scrolling for long files
- CDN for static assets

## 8.4 Security Hardening `[CONFIG]` 📋

- Rate limiting on all endpoints
- Input sanitization audit
- SQL injection prevention review
- XSS prevention review

---

# Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           THE BRAIN UI                               │
│  ┌──────────────┐ ┌──────────┐ ┌────────┐ ┌──────────────────────┐ │
│  │Command Centre│ │ Projects │ │ Tasks  │ │ AI Orchestrator      │ │
│  │  (mode-aware)│ │          │ │(My/All)│ │ (Coach/Asst/Silent)  │ │
│  └──────────────┘ └──────────┘ └────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │   Router    │  │   Planner   │  │    Workflow Engine          │ │
│  │ (who does   │  │ (breakdown) │  │  (execute + track steps)    │ │
│  │  what)      │  │             │  │                             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐ │
│  │  Mode Logic │  │ Task Queue  │  │  Agent Capability Matcher   │ │
│  │ (Coach/Asst │  │             │  │                             │ │
│  │  /Silent)   │  │             │  │                             │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌──────────────┐    ┌─────────────────────┐    ┌──────────────┐
│    HUMAN     │    │     AGENT POOL      │    │INTEGRATIONS  │
│  (Tasks UI)  │    │  dev, content, etc. │    │ GitHub, etc. │
└──────────────┘    └─────────────────────┘    └──────────────┘
                              │
┌─────────────────────────────────────────────────────────────────────┐
│              CONTEXT LAYER (Open Viking Patterns)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ URI Resolver │  │ L0/L1/L2     │  │ Recursive Directory      │  │
│  │              │  │ Summaries    │  │ Retrieval                │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                   │
│  TiDB: projects, files, tasks, workflows, memories, agents, etc.    │
└─────────────────────────────────────────────────────────────────────┘
```

---

# Immediate Next Steps

Phase 5 (5.1-5.6) and Phase 6 (6.1-6.2) are complete! Next priorities:

1. **Phase 7 Intelligence** — Recursive directory retrieval, workflow learning, auto task creation
2. **Phase 8** — Ecosystem & Scale

Phase 5.6 complete: Agents can now read/write files, create tasks, search projects, and complete assignments with preview/auto modes.

---

_THE BRAIN v2.0 — From Coach to Orchestrator_
