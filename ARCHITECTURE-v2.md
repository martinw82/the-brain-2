# THE BRAIN — Architecture Overview v2.0

> **Note:** This is an architecture overview. For the master status document, see `brain-status.md`. For detailed implementation tasks, see `brain-roadmap.md`.

**Agent Orchestration Platform with Adaptive Coaching**

---

## System Overview

The Brain v2.0 is a **personal operating system with three layers**:

1. **Adaptive Interface Layer** — UI that changes based on assistance mode
2. **Orchestration Layer** — Task routing, workflow execution, agent management
3. **Context Layer** — Hierarchical data, URI-based addressing, intelligent retrieval

All three layers work together to provide a system that **adapts to how you work** — from drill sergeant to silent tool.

---

## Core Concepts

### 1. Assistance Modes

The system has three behavioral profiles:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         COACH MODE                                  │
│  For: Users building habits, prone to procrastination               │
│                                                                     │
│  • Daily check-ins: Mandatory prompts                               │
│  • Drift alerts: Interruptive popups                                │
│  • Outreach: "NOT DONE (mandatory)"                                 │
│  • AI Tone: Challenging, direct, "truth over comfort"               │
│  • Proactive: High — creates tasks, suggests actions                │
│  • Interruptions: Allowed during focus time                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                       ASSISTANT MODE                                │
│  For: Users in flow, just need efficiency                           │
│                                                                     │
│  • Daily check-ins: Available, not prompted                         │
│  • Drift alerts: Dashboard badge only                               │
│  • Outreach: Tracked, optional reminders                            │
│  • AI Tone: Supportive, neutral, helpful                            │
│  • Proactive: Medium — suggests, asks permission                    │
│  • Interruptions: Respect focus sessions                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        SILENT MODE                                  │
│  For: Power users who know what they want                           │
│                                                                     │
│  • Daily check-ins: Off entirely                                    │
│  • Drift alerts: Off                                                │
│  • Outreach: Off                                                    │
│  • AI Tone: Minimal, factual, answers only                          │
│  • Proactive: None — manual trigger only                            │
│  • Interruptions: Never                                             │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Principle:** Mode affects the _coaching layer_ only. The orchestration engine (task delegation, workflows, agent execution) works identically in all modes.

---

### 2. Agent Orchestration

**From Advice to Action:**

```
v1.0: User asks question → AI gives advice → User executes manually

v2.0: User states goal → AI breaks down → AI assigns tasks →
      Agents execute → System tracks → Reports completion
```

**The Orchestration Flow:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    INPUT     │────▶│   PLANNER    │────▶│   ROUTER     │
│  (User goal) │     │ (Breakdown)  │     │ (Assignment) │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                       ┌──────────────────────────┼──────────────────────────┐
                       │                          │                          │
                       ▼                          ▼                          ▼
               ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
               │    HUMAN     │          │    AGENT     │          │ INTEGRATION  │
               │  (My Tasks)  │          │  (AI Agent)  │          │  (GitHub,    │
               │              │          │              │          │   Calendar)  │
               └──────┬───────┘          └──────┬───────┘          └──────┬───────┘
                      │                          │                          │
                      └──────────────────────────┼──────────────────────────┘
                                                 │
                                                 ▼
                                        ┌──────────────┐
                                        │    QUEUE     │
                                        │  (Tracking)  │
                                        └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  COMPLETION  │
                                        │   (Report)   │
                                        └──────────────┘
```

**Components:**

| Component           | Responsibility               | Example                                                        |
| ------------------- | ---------------------------- | -------------------------------------------------------------- |
| **Planner**         | Break goals into tasks       | "Create landing page" → [design mockup, write copy, implement] |
| **Router**          | Decide who does what         | Design mockup → Design Agent (auto) or Human (preview)         |
| **Task Queue**      | Track status, assignments    | Pending → In Progress → Review → Complete                      |
| **Workflow Engine** | Execute multi-step processes | Product Launch: 7 steps, track progress                        |
| **Agent Pool**      | Execute assigned work        | Dev Agent, Content Agent, etc.                                 |

---

### 3. Hierarchical Context (Open Viking Pattern)

**The Problem:** Stuffing all file content into prompts is expensive and noisy.

**The Solution:** Three levels of context abstraction:

```
L0 Abstract (~100 tokens)
├── Vector search index
├── Quick filtering
└── "This file is about authentication middleware"

L1 Overview (~2,000 tokens)
├── Navigation, routing decisions
├── Structure and key points
└── "Express middleware that validates JWT tokens.
     Checks Authorization header, verifies signature,
     attaches user to request. Used in protected routes."

L2 Detail (unlimited)
├── Full content
├── Execution time only
└── [Complete file contents]
```

**How It Works:**

```
User asks: "How does auth work in this project?"

┌─────────────────────────────────────────────────────────────┐
│  1. INTENT ANALYSIS                                         │
│     Query: "auth", "work", "project"                        │
│     Intent: Understand authentication system                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  2. L0 VECTOR SEARCH                                        │
│     Search: auth-related abstracts                          │
│     Result: [middleware/auth.js, routes/login.js, ...]      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  3. L1 OVERVIEW RETRIEVAL                                   │
│     Get ~2k token summaries of top matches                  │
│     Result: Structured overview of auth system              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  4. RECURSIVE EXPLORATION (if needed)                       │
│     If unclear, explore related directories                 │
│     Result: Broader context about auth patterns             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  5. L2 DETAIL (on demand)                                   │
│     Only fetch full files when needed                       │
│     Result: Complete implementation details                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  6. RESPONSE + RETRIEVAL TRACE                              │
│     Answer + "Based on overview of X files..."              │
│     Trace: "Explored: middleware/ → routes/ → skipped tests/"│
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**

- **Cost:** Use L0/L1 for 90% of queries, L2 only when needed
- **Quality:** Better context understanding via structured exploration
- **Trust:** Users see what AI considered, can verify

---

### 4. URI Scheme

**Standardized Resource Addressing:**

```
brain://project/my-app                    → Project reference
brain://project/my-app/file/README.md     → Specific file
brain://project/my-app/task/42            → Task #42
brain://goal/thailand-fund                → Goal reference
brain://staging/item-123                  → Staging item
brain://agent/dev                         → Agent reference
brain://workflow/product-launch/step-3    → Workflow step
```

**Usage:**

- AI references resources precisely: "See brain://project/my-app/file/auth.js#L15"
- Task context links: Task assigned with `context_uri: "brain://..."`
- Cross-references: Links between projects, goals, tasks

---

## Data Flow Examples

### Example 1: User Creates Task in Coach Mode

```
1. User: "I need to build auth"

2. AI (Coach Mode):
   "You haven't shipped in 3 days. Let's break this down properly.
   First — check in. How's your energy?"

3. [Forces check-in before proceeding]

4. AI (Planner):
   "Breaking 'build auth' into tasks:"
   - Design auth flow → Design Agent
   - Implement JWT middleware → Dev Agent
   - Write login page → Dev Agent
   - Create tests → Dev Agent

5. AI (Router):
   "Energy is 8/10 → Power mode. I can auto-run these.
   Preview:"
   [Shows task list with assignees]

6. User: "Go"

7. [Tasks created, assigned to agents, execution begins]

8. [Notifications as each task completes]
```

### Example 2: User Creates Task in Assistant Mode

```
1. User: "I need to build auth"

2. AI (Assistant Mode):
   "Creating 4 tasks for auth system:"
   - Design auth flow → Design Agent
   - Implement JWT middleware → Dev Agent
   - Write login page → Dev Agent
   - Create tests → Dev Agent

   "Auto-assign? (You can review first)"

3. User: "Review"

4. [Shows task detail panel, user can edit/approve each]

5. User approves → Tasks assigned → Execution begins

6. [Dashboard updates, no popups unless blocked]
```

### Example 3: User Creates Task in Silent Mode

```
1. User clicks "New Task"

2. [No AI involvement]

3. User fills: Title, Description, Assignee

4. [Task created directly]

5. If assignee is agent:
   - Shows "Run Agent" button
   - User clicks when ready
   - Preview shown
   - User confirms execution

6. [Minimal notifications]
```

---

## Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                           │
│  React 18 + Vite 5                                                  │
│  ├─ TheBrain.jsx (single-file app)                                  │
│  ├─ Mode-aware UI components                                        │
│  └─ Inline styles (dark monospace theme)                            │
├─────────────────────────────────────────────────────────────────────┤
│                         ORCHESTRATION LAYER                          │
│  Vercel Serverless Functions                                        │
│  ├─ api/ai.js — Multi-provider AI proxy + system prompt builder     │
│  ├─ api/data.js — Generic CRUD + resource routing                   │
│  ├─ api/projects.js — Project operations                            │
│  └─ api/integrations.js — External service connectors               │
├─────────────────────────────────────────────────────────────────────┤
│                          CONTEXT LAYER                               │
│  Open Viking Patterns                                               │
│  ├─ URI resolver (brain://)                                         │
│  ├─ L0/L1/L2 summarization                                          │
│  └─ Recursive directory retrieval                                   │
├─────────────────────────────────────────────────────────────────────┤
│                          DATA LAYER                                  │
│  TiDB Cloud Serverless (MySQL-compatible)                           │
│  ├─ 25 tables (v1.0 schema.sql)                                     │
│  ├─ + 7 tables via migrations (v2.0) = 32 total                    │
│  ├─ + agents as files in /agents/*.md (v2.0)                       │
│  └─ + memories (v2.0 planned)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

| Decision             | Rationale                                            |
| -------------------- | ---------------------------------------------------- |
| Single-file frontend | Simplicity, fast iteration, fits in context window   |
| Serverless functions | Scale to zero, no server management, edge deployment |
| TiDB Serverless      | MySQL-compatible, free tier, global distribution     |
| Multi-provider AI    | Avoid vendor lock-in, cost optimization              |
| JWT auth             | Stateless, works with serverless                     |
| Optimistic updates   | Feels instant, revert on error                       |
| Soft deletes         | Never lose user data                                 |

---

## Database Schema Evolution

### v1.0 Tables (Complete)

**Core:** users, projects, project_files, project_custom_folders, staging, ideas, sessions, comments, refresh_tokens

**Phase 1:** life_areas, goals, goal_contributions, tags, entity_tags, entity_links, templates, schema_migrations

**Phase 2-4:** file_metadata, sync_state, sync_file_state, daily_checkins, training_logs, outreach_log, weekly_reviews, notifications, project_integrations

### v2.0 Tables (Complete)

```sql
-- AI infrastructure (migrations v21-22)
ai_usage (user_id, date, input_tokens, output_tokens, estimated_cost_usd, model)
user_ai_settings (user_id, provider, model, api_key_encrypted)

-- Hierarchical context (migration v24)
file_summaries (project_id, file_path, l0_abstract, l1_overview, content_hash)

-- Task orchestration (migration v23)
tasks (project_id, assignee_type, assignee_id, status, workflow_instance_id)

-- Workflow execution (migration v25)
workflow_templates (id, name, steps JSON, triggers JSON, is_system)
workflow_instances (workflow_template_id, status, current_step_index, step_results)

-- Agent definitions: file-based in /agents/*.md (not a DB table)

-- Intelligence (planned)
memories (user_id, category, content, confidence, source_task_id)
```

---

## Integration Points

### External Services

| Service               | Integration                    | Status           |
| --------------------- | ------------------------------ | ---------------- |
| **GitHub**            | Repo status, commits, PAT auth | ✅ v1.0 Complete |
| **Vercel/Netlify**    | Deployment status              | 📋 v2.0 Planned  |
| **Calendar**          | Block time for tasks           | 📋 v2.0 Planned  |
| **Email**             | Send/receive as tasks          | 📋 v2.0 Planned  |
| **Slack/Discord**     | Channel as project feed        | 📋 v2.0 Planned  |
| **Farcaster/Twitter** | Social integrations            | 📋 v2.0 Future   |

### AI Providers

| Provider               | Status | Use Case                |
| ---------------------- | ------ | ----------------------- |
| **Anthropic (Claude)** | ✅     | Primary, best reasoning |
| **Moonshot (Kimi)**    | ✅     | Cost-effective          |
| **DeepSeek**           | ✅     | Low cost, fast          |
| **Mistral**            | ✅     | EU provider             |
| **OpenAI (GPT)**       | ✅     | Broad capabilities      |

---

## Security Considerations

### Current (v1.0)

- JWT tokens with expiration
- API keys server-side only
- Rate limiting on AI proxy (10/min)
- Soft deletes on user content

### Planned (v2.0)

- Rate limiting on all endpoints
- Input sanitization audit
- SQL injection prevention review
- XSS prevention review
- Agent sandboxing (file operations)

---

## Performance Targets

| Metric            | Target  | v1.0 Status | v2.0 Target |
| ----------------- | ------- | ----------- | ----------- |
| Initial load      | < 2s    | ✅          | ✅          |
| Search response   | < 500ms | ✅          | ✅          |
| AI response       | < 5s    | ✅          | ✅          |
| Task creation     | < 100ms | N/A         | 🎯          |
| Workflow step     | < 100ms | N/A         | 🎯          |
| Context retrieval | < 200ms | N/A         | 🎯          |

---

## Development Principles

1. **Mode is config, not code** — Same features, different behavior
2. **Orchestration is consistent** — Works the same regardless of mode
3. **Explainable AI** — Show traces, reasons, assignment logic
4. **Human override** — AI suggests, human decides
5. **Start simple** — Measure, iterate, don't over-engineer
6. **Preserve foundations** — v1.0 features stay working
7. **Single-file simplicity** — Frontend stays unified

---

## Success Metrics

### v1.0 (Achieved)

- ✅ Daily active usage
- ✅ All features survive reload
- ✅ Mobile responsive
- ✅ Multi-provider AI stable

### v2.0 (Targets)

- 🎯 Tasks created per week > 10 per user
- 🎯 Agent task completion > 60%
- 🎯 Workflow instances > 5 per project
- 🎯 Mode switching used by > 30%
- 🎯 Auto-tasks accepted > 40%
- 🎯 Memory-influenced recommendations > 70% helpful

---

_THE BRAIN v2.0 Architecture — March 2026_
