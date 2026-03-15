# THE BRAIN — Roadmap v2.0

**Agent Orchestration Platform with Adaptive Coaching**

**Version:** 2.0  
**Last Updated:** 2026-03-15  
**Status:** Phase 8.1 Complete, Next: Phase 8.2 Advanced Integrations

---

## Executive Summary

The Brain evolves from an "AI Coach" application into a **personal operating system with adaptive intelligence**. Three assistance modes (Coach/Assistant/Silent) serve users at different stages of discipline, while an underlying **agent orchestration layer** handles task delegation, workflow management, and project execution.

**Key Innovations from Open Viking Integration:**

- URI-based resource addressing (`brain://`)
- Hierarchical context (L0/L1/L2 summaries)
- Recursive directory retrieval for AI context
- Visualized retrieval traces

**Core Philosophy:** _The system adapts to how you work — from drill sergeant to silent tool — while the orchestration engine works consistently behind the scenes._

---

## Current State (March 2026)

### ✅ COMPLETE — Phase 1: Personal OS Foundation

**Database:** 32 tables, full persistence via TiDB
**API Layer:** Multi-provider AI proxy (Anthropic, Moonshot, DeepSeek, Mistral, OpenAI)
**Frontend:** Single-file React (TheBrain.jsx ~5,829 lines), responsive, offline-capable

| Feature              | Status | Notes                                         |
| -------------------- | ------ | --------------------------------------------- |
| Project management   | ✅     | CRUD, phases, health scores, templates        |
| Life Areas ("Parts") | ✅     | 5 default areas, health tracking, filtering   |
| Goal tracking        | ✅     | Configurable goals, contributions, progress   |
| Tagging & linking    | ✅     | Cross-entity tags, relationship graphs        |
| Session timer        | ✅     | Work logging, DEVLOG.md auto-update           |
| Daily check-in       | ✅     | Sleep/energy/gut/training tracking            |
| Training log         | ✅     | Weekly targets, correlation tracking          |
| Outreach tracking    | ✅     | Mandatory minimum enforcement                 |
| Weekly reviews       | ✅     | Auto-aggregated stats + AI analysis           |
| Drift detection      | ✅     | 5 pattern alerts, AI context integration      |
| AI Coach (v1)        | ✅     | 10 rules, state-based routing, multi-provider |
| File management      | ✅     | Folders, markdown editor, binary handling     |
| Search               | ✅     | Full-text + Cmd+K modal                       |
| Desktop sync         | ✅     | File System Access API, conflict resolution   |
| Import/Export        | ✅     | BUIDL format, JSON, folder import             |
| Notifications        | ✅     | In-app bell, trigger-based alerts             |
| Mobile responsive    | ✅     | Breakpoints, touch targets, drawers           |
| Onboarding           | ✅     | 4-step wizard + guided tour                   |

### 🔄 ACTIVE — Phase 1.5: Critical Hardening

| Task                | Status      | Priority                                              |
| ------------------- | ----------- | ----------------------------------------------------- |
| AI rate limiting    | ⚠️ PARTIAL  | Rate limit ✅, caching ❌, token logging ✅           |
| Critical path tests | ✅ COMPLETE | File round-trip, comment persistence, session logging |

---

## Phase 2: Agent Orchestration Foundation

**Goal:** Transform from "AI gives advice" to "AI assigns and tracks work"

### 2.1 URI Scheme & Resource Addressing

**Deliverable:** Standardized `brain://` URI system for all entities

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

**Implementation:**

- [x] `src/uri.js` — URI parser/generator utility (12 functions)
- [x] Update AI context builder to use URIs
- [x] Clickable URI links in AI responses
- [x] URI-based navigation (Cmd+Click → open resource)

**Done when:** ✅ All resources have canonical URIs, AI references them precisely (Complete 2026-03-14)

---

### 2.2 Hierarchical Context Summarization

**Deliverable:** L0/L1/L2 auto-generated summaries (Open Viking pattern)

| Level       | Tokens    | Purpose                        | Generation      |
| ----------- | --------- | ------------------------------ | --------------- |
| L0 Abstract | ~100      | Vector search, quick filtering | AI on file save |
| L1 Overview | ~2,000    | Navigation, context routing    | AI on file save |
| L2 Detail   | Unlimited | Full content, execution        | Original file   |

**Schema:**

```sql
-- New table: file_summaries
CREATE TABLE file_summaries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id VARCHAR(64),
  file_path VARCHAR(512),
  l0_abstract TEXT,        -- ~100 tokens
  l1_overview TEXT,        -- ~2k tokens
  l2_detail_ref VARCHAR(768), -- points to project_files
  generated_at DATETIME,
  content_hash VARCHAR(64), -- for invalidation
  INDEX (project_id, file_path)
);
```

**Implementation:**

- [x] Migration v24 for `file_summaries` table
- [x] AI summarization endpoint (`resource=file-summaries`)
- [x] Background summarization on file save (fire-and-forget)
- [x] FileSummaryViewer component in Meta tab
- [x] `src/summaries.js` utility library

**Done when:** ✅ Summaries auto-generate on save, viewable in Meta tab (Complete 2026-03-15)

---

### 2.3 Agent Registry & Capabilities

**Deliverable:** Database-driven agent definitions (currently static SKILLS object)

```sql
-- New table: agents
CREATE TABLE agents (
  id VARCHAR(32) PRIMARY KEY,
  user_id INT,
  name VARCHAR(64),
  icon VARCHAR(8),
  description TEXT,
  capabilities JSON,       -- ['code', 'review', 'write', 'research']
  permissions JSON,        -- ['read:all', 'write:code-modules']
  ignore_patterns JSON,    -- ['node_modules/', '.env']
  prompt_prefix TEXT,
  cost_per_task DECIMAL(10,4),
  avg_duration_minutes INT,
  handoff_rules JSON,      -- {"on_complete": "notify_human", "on_error": "escalate"}
  is_system BOOLEAN DEFAULT FALSE,
  created_at DATETIME
);
```

**Implementation:** (Architecture changed: file-based agents, not DB)

- [x] 5 system agents as .md files in `/agents/`
- [x] AgentRegistry service (`src/agents.js`)
- [x] AgentManager component (browse, clone, edit)
- [x] Capability-based task assignment UI
- [x] Capability-based routing logic

**Done when:** ✅ Users can browse agents, clone to create custom agents, assign tasks by capability (Complete 2026-03-15)

---

### 2.4 Task Delegation System

**Deliverable:** Universal task queue with intelligent assignment

**Schema:**

```sql
-- New table: tasks
CREATE TABLE tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id VARCHAR(64),
  user_id INT,
  title VARCHAR(256),
  description TEXT,
  context_uri VARCHAR(512),      -- brain:// reference
  assignee_type ENUM('human', 'agent', 'integration'),
  assignee_id VARCHAR(64),       -- agent ID, 'user', or integration ID
  assignee_context JSON,         -- extra context for assignee

  status ENUM('pending', 'in_progress', 'blocked', 'review', 'complete', 'cancelled'),
  priority ENUM('critical', 'high', 'medium', 'low'),
  due_date DATE,

  parent_task_id INT,            -- for subtasks
  workflow_instance_id INT,      -- link to workflow execution
  workflow_step_id VARCHAR(64),  -- which step in template

  -- Assignment metadata
  assigned_by ENUM('ai', 'user', 'workflow'),
  assignment_reason TEXT,        -- why this assignee was chosen

  -- Execution tracking
  created_at DATETIME,
  started_at DATETIME,
  completed_at DATETIME,
  result_summary TEXT,           -- what was accomplished
  output_uris JSON,              -- brain:// references to outputs

  INDEX (user_id, status),
  INDEX (assignee_type, assignee_id, status)
);
```

**API Endpoints:**

- `GET/POST/PUT /api/data?resource=tasks` — CRUD
- `POST /api/data?resource=tasks&action=assign` — AI assignment
- `POST /api/data?resource=tasks&action=complete` — Mark done with summary
- `GET /api/data?resource=my-tasks` — For current user

**UI Components:**

- [x] "My Tasks" view in Command Centre
- [ ] Task detail panel (context, assignee, status)
- [x] Task creation modal with project/priority selection
- [ ] "Delegate to Agent" button on any task

**Assignment Logic (v1):**

```javascript
function assignTask(task, userContext) {
  const rules = [
    {
      if: task.type === 'code' && userContext.energy >= 7,
      then: { type: 'agent', id: 'dev' },
    },
    {
      if: task.type === 'code' && userContext.energy < 7,
      then: { type: 'human', note: 'Low energy, manual review recommended' },
    },
    { if: task.type === 'content', then: { type: 'agent', id: 'content' } },
    { if: task.type === 'strategy', then: { type: 'agent', id: 'strategy' } },
    { if: task.type === 'deploy', then: { type: 'integration', id: 'github' } },
    {
      if: task.urgency === 'critical',
      then: { type: 'human', note: 'Critical tasks need human oversight' },
    },
  ];
  // Return first match with explanation
}
```

**Done when:** ✅ Tasks can be created, assigned, tracked to completion (Complete 2026-03-14, detail panel + delegate button remaining)

---

### 2.5 Workflow Execution Engine

**Deliverable:** From static workflow templates to executable instances

**Schema:**

```sql
-- New table: workflow_instances
CREATE TABLE workflow_instances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workflow_template_id VARCHAR(64),
  project_id VARCHAR(64),
  user_id INT,

  status ENUM('running', 'paused', 'completed', 'failed'),
  current_step_index INT DEFAULT 0,

  step_results JSON,  -- Array of {step_id, status, output, completed_at}
  execution_log TEXT, -- Full trace for debugging

  started_at DATETIME,
  completed_at DATETIME,
  created_by ENUM('user', 'ai', 'trigger')
);
```

**Execution Model:**

```javascript
// Workflow step handoff
async function executeStep(instance, step) {
  // 1. Create task for this step
  const task = await createTask({
    title: step.label,
    description: step.sop,
    assignee_type: step.agent === 'human' ? 'human' : 'agent',
    assignee_id: step.agent,
    workflow_instance_id: instance.id,
    workflow_step_id: step.id,
  });

  // 2. If agent, trigger AI execution
  if (task.assignee_type === 'agent') {
    await triggerAgentTask(task);
  }

  // 3. Wait for completion (async via webhook/polling)
}

// On task completion, auto-advance or branch
async function onTaskComplete(task) {
  const instance = await getWorkflowInstance(task.workflow_instance_id);
  const nextStep = determineNextStep(instance, task);

  if (nextStep) {
    await executeStep(instance, nextStep);
  } else {
    await completeWorkflow(instance);
  }
}
```

**UI Components:**

- [x] Workflow instance viewer (progress, current step, history)
- [x] "Start Workflow" button on projects
- [x] Step-by-step execution view
- [x] Pause/resume/abort controls

**Done when:** ✅ Workflows execute step-by-step, create tasks, track progress (Complete 2026-03-15)

---

### 2.6 Integration: Agent Task Execution ✅ COMPLETE (2026-03-15)

**Deliverable:** Agents can actually DO things, not just advise

**Implementation:**

- [x] `api/agent-execute.js` — Agent execution with function calling
- [x] 6 functions: read_file, write_file, create_task, search_projects, mark_complete, request_review
- [x] Multi-provider support: Anthropic (Claude), OpenAI (GPT), Mistral
- [x] `src/agentFunctions.js` — Client-side function definitions
- [x] Sandboxed file operations (respect ignore_patterns per agent)
- [x] Preview mode: agents propose changes without executing
- [x] Auto mode: agents execute immediately (toggle in Settings)
- [x] `auto_run_agents` setting in user settings JSON

**Function Definitions:**

| Function                             | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| `read_file(uri)`                     | Get L2 content from project files           |
| `write_file(uri, content, mode)`     | Create/update files (create/update/preview) |
| `create_task(title, desc, assignee)` | Delegate work to humans or agents           |
| `search_projects(query)`             | Find context across all projects            |
| `mark_complete(task_id, summary)`    | Complete assigned task                      |
| `request_review(reason)`             | Escalate for human review                   |

**Done when:** ✅ Agents can read, write, create sub-tasks, complete assignments with preview/auto modes (Complete 2026-03-15)

---

## Phase 3: Adaptive Assistance Modes

**Goal:** Three modes (Coach/Assistant/Silent) serving different user needs

### 3.1 Mode System Core

**Schema:**

```sql
-- Add to users.settings JSON:
{
  "assistance_mode": "coach",  // coach | assistant | silent
  "coach_intensity": 0.8,      // 0.0-1.0 (gradual scale within coach)
  "auto_run_agents": true,
  "proactive_suggestions": true,
  "checkin_required": true,
  "interruption_policy": "respect_focus"  // always | respect_focus | never
}
```

**Mode Definitions:**

| Aspect              | Coach                           | Assistant                   | Silent           |
| ------------------- | ------------------------------- | --------------------------- | ---------------- |
| **Identity**        | "Direct accountability partner" | "Helpful project assistant" | "System tool"    |
| **Tone**            | Challenging, direct             | Supportive, neutral         | Minimal, factual |
| **Check-ins**       | Mandatory daily prompts         | Available, not prompted     | Off              |
| **Drift alerts**    | Interruptive popups             | Dashboard badge only        | Off              |
| **Outreach**        | "NOT DONE (mandatory)"          | Tracked, optional           | Off              |
| **Task creation**   | Proactive suggestions           | Proactive suggestions       | Manual only      |
| **Agent execution** | Auto-runs when confident        | Auto-runs when confident    | Preview mode     |
| **Health scores**   | Visible + alerts                | Visible, no alerts          | Raw data only    |

**Implementation:**

- [ ] Settings UI: Mode selector with descriptions
- [ ] AI prompt builder: mode-aware system prompts
- [ ] UI components: mode-based feature visibility
- [ ] Notification system: mode-aware interruption logic

---

### 3.2 Smart Mode Suggestions

**Triggers:**

```javascript
// Suggest mode change based on behavior
function checkModeTransition(user) {
  const patterns = {
    // Consistent for 30 days → suggest Assistant
    suggest_assistant: user.checkin_streak >= 30 && user.tasks_completed >= 20,

    // Missing 3 check-ins → suggest back to Coach
    suggest_coach: user.missed_checkins >= 3,

    // Using 50%+ agent delegation → suggest Silent if power user
    suggest_silent:
      user.agent_delegation_rate > 0.5 && user.projects_count > 10,
  };

  return patterns;
}
```

**UI:**

- [ ] Gentle mode suggestion banners (dismissible)
- [ ] "Try Assistant mode for a week?" with easy revert
- [ ] Mode switch tracking in analytics

---

## Phase 4: Intelligence & Evolution

### 4.1 Recursive Directory Retrieval

**Deliverable:** AI can "explore" project structure intelligently (Open Viking pattern)

**Algorithm:**

```javascript
async function retrieveContext(query, projectId) {
  // 1. Intent analysis: what are we looking for?
  const intent = await analyzeIntent(query);

  // 2. L0 vector search to find high-scoring directories
  const candidateDirs = await searchL0Abstracts(intent.keywords);

  // 3. Fine exploration: L1 search within promising directories
  const enrichedCandidates = [];
  for (const dir of candidateDirs) {
    const dirContents = await getL1Overviews(dir);
    const relevance = await scoreRelevance(intent, dirContents);
    enrichedCandidates.push({ dir, relevance, contents: dirContents });
  }

  // 4. Recursive descent if subdirectories found
  // 5. Result aggregation with trace
  return {
    results: sortedByRelevance(enrichedCandidates),
    trace: [
      /* which directories were explored */
    ], // Visualized in UI
  };
}
```

**UI:**

- [ ] "Retrieval trace" expandable section in AI responses
- [ ] Shows: "Explored briefs/ → system/ → skipped marketing/"

---

### 4.2 Workflow Learning

**Deliverable:** Detect patterns, suggest workflow improvements

**Pattern Detection:**

```javascript
// After N similar projects, suggest workflow template
function detectWorkflowPattern(userId, projectType) {
  const completed = await getCompletedProjects(userId, projectType);

  if (completed.length >= 3) {
    const commonSteps = findCommonSequence(completed);
    const avgDurations = calculateStepDurations(completed);
    const bottlenecks = findSlowSteps(completed);

    return {
      suggestion: "Create workflow from this pattern?",
      template: generateWorkflowTemplate(commonSteps, avgDurations),
      optimizations: suggestOptimizations(bottlenecks)
    };
  }
}
```

**Workflow Evolution:**

- Track: planned vs actual duration per step
- Track: agent success rate per task type
- Suggest: "Dev agent always takes 2x. Adjust estimate?"
- Suggest: "Strategy step often loops back. Add checkpoint?"

---

### 4.3 Auto Task Creation

**Deliverable:** System creates tasks from unstructured inputs

**Sources:**

- DEVLOG.md entries: "Started work on auth" → Create "Complete auth system" task
- Blockers: "Waiting for API key" → Create "Follow up on API key" task assigned to user
- Comments: "We should refactor this" → Create "Refactor X" task
- AI suggestions: "This file needs tests" → Create "Add tests for X" task

**Implementation:**

- [ ] Background job: scan DEVLOG.md daily
- [ ] Pattern: "TODO|FIXME|XXX|BLOCKED" keyword extraction
- [ ] AI classification: task type, priority, assignee suggestion
- [ ] Approval queue: Suggested tasks appear in "Proposed" state

---

## Phase 5: Ecosystem & Scale

### 5.1 Memory Self-Iteration (Open Viking Pattern)

**Six Memory Categories:**

```sql
-- New table: memories
CREATE TABLE memories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  category ENUM('profile', 'preferences', 'entities', 'events', 'cases', 'patterns'),
  content TEXT,
  source_task_id INT,  -- what generated this memory
  confidence FLOAT,    -- AI certainty
  last_accessed DATETIME,
  created_at DATETIME
);
```

**Auto-Extraction:**

- After workflow completion: extract patterns
- After task completion: update skill success rates
- After project completion: update entity relationships

**Usage:**

- "You usually underestimate dev tasks by 2x"
- "You work best on strategy in the morning"
- "This client always needs 3 review rounds"

---

### 5.2 Community Workflows

**Deliverable:** Share and discover workflow templates

**Features:**

- Publish workflows (anonymized)
- Star/fork workflow templates
- "Most used workflows for SaaS launches"
- Workflow ratings and success metrics

---

### 5.3 Advanced Integrations

**Two-Way Sync:**

- GitHub: PR creation, issue sync, commit tracking
- Calendar: Block time for tasks, schedule reviews
- Email: Send/receive as task interactions
- Slack/Discord: Channel as project feed

---

## Implementation Priority

### ✅ Complete

1. **URI Scheme** — `src/uri.js` with 12 functions (2026-03-14)
2. **File Summarization** — L0/L1 auto-generation on save (2026-03-15)
3. **Agent Registry** — File-based agents, AgentManager UI (2026-03-15)
4. **Task Delegation** — Universal task queue, My Tasks UI (2026-03-14)
5. **Workflow Engine** — Instance tracking, step execution, WorkflowRunner (2026-03-15)
6. **Agent Task Execution** — Function calling, sandboxed actions, preview mode (2026-03-15)
7. **Assistance Mode Setting** — UI selector, gated features (Coach/Assistant/Silent) (2026-03-15)
8. **Smart Mode Suggestions** — Behavior-based mode change suggestions (2026-03-15)
9. **Auto Task Creation** — DEVLOG/TODO scanning, proposed task queue (2026-03-15)
10. **Recursive Directory Retrieval** — Intent analysis, L0/L1 exploration, trace visualization (2026-03-15)
11. **Workflow Learning** — Pattern detection, step duration analysis, agent success rates, suggestions (2026-03-15)
12. **Memory Self-Iteration** — Memories table, auto-extraction, insights (2026-03-15)
13. **Community Workflows** — Publish, star, fork, rate workflows (2026-03-15)

### Next Up (Phase 8.2)

1. **Advanced Integrations** — GitHub, Calendar, Email sync

---

## Architecture Overview

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

## Success Metrics

### Phase 2 Success

- Tasks created per week > 10 per active user
- Agent task completion rate > 60%
- Workflow instances completed > 5 per project

### Phase 3 Success

- Mode switching used by > 30% of users
- Coach → Assistant transitions stick (> 7 days)
- Silent mode users still create tasks (just manually)

### Phase 4 Success

- Auto-created tasks accepted > 40% of time
- Workflow suggestions adopted > 20% of time
- Memory-influenced recommendations rated helpful > 70%

---

## Notes

**From Open Viking:**

- Hierarchical context (L0/L1/L2) dramatically improves retrieval quality
- URI scheme enables deterministic resource access
- Directory recursive retrieval > flat vector search for complex queries
- Visualized traces build trust in AI decisions

**From The Brain v1:**

- Single-file frontend simplicity scales well
- Optimistic updates + background sync feels instant
- State-based routing (Recovery/Steady/Power) works
- Daily check-ins create engagement habit

**Principles:**

1. Mode is behavioral config, not code fork
2. Orchestration works the same regardless of mode
3. AI should explain its decisions (retrieval traces)
4. Human always has override authority
5. Start simple, measure, iterate

---

_THE BRAIN v2.0 — From Coach to Orchestrator_
