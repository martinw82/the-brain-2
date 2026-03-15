# Phase 5.3 & 5.5: Agent Registry + Workflow Execution

## Deep Architecture Discussion

**Date:** 2026-03-15  
**Context:** Phase 5.1, 5.2, 5.4 Complete. Moving to 5.3 (Agent Registry) and 5.5 (Workflow Engine).

---

## 1. The Vision: From Static to Living System

### Current State (Static)

```javascript
// SKILLS is a hardcoded object
const SKILLS = {
  dev: { id: "dev", icon: "🛠", label: "Dev Agent", ... },
  content: { ... },
  // 5 agents total, immutable
};

// WORKFLOWS are static templates
const WORKFLOWS = [
  { id: "product-launch", steps: [...] }, // Never changes
];
```

**Problems:**

- User can't create custom agents
- Can't adjust agent behavior per project
- Workflows are "dead" - just checklists
- No execution tracking
- No learning from past runs

### Target State (Living)

```javascript
// Agents live in database, user-defined + system
const myAgent = await agents.get('custom-security-auditor');
// { id: "custom-security-auditor", capabilities: ["audit", "solidity"],
//   prompt_prefix: "You're a security-focused...", cost_per_task: 0.05 }

// Workflows execute, track progress, learn
const instance = await workflows.start('product-launch', projectId);
// Creates tasks, assigns to agents, tracks completion
```

**What changes:**

- Agents become **configurable personalities** with capabilities
- Workflows become **executable processes** that create/track tasks
- System becomes **orchestrated** - AI assigns work, not just advises
- History becomes **queryable** - "Show me all security audits from last month"

---

## 2. Agent Registry (Phase 5.3)

### 2.1 Core Concept

An **Agent** is a configured AI worker with:

- **Identity:** Name, icon, description
- **Capabilities:** What it can do (skills taxonomy)
- **Permissions:** What it can access (RBAC)
- **Prompt Engineering:** System prefix, SOP
- **Cost/Performance:** Historical data

**Analogy:** Think of agents like Docker containers:

- Static image = Agent definition (in `agents` table)
- Running container = Task execution (in `tasks` table)
- Logs = Execution history (in task results)

### 2.2 Schema Deep Dive

```sql
CREATE TABLE agents (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(36),           -- NULL = system agent (available to all)

  -- Identity
  name VARCHAR(64) NOT NULL,
  icon VARCHAR(8) DEFAULT '🤖',
  description TEXT,

  -- Capabilities (skill taxonomy)
  -- Examples: ["code", "review", "write", "test", "deploy", "audit", "research"]
  -- This enables capability-based routing: "Who can do X?"
  capabilities JSON NOT NULL,

  -- Permissions (RBAC model)
  -- read:all, write:code-modules, write:staging, etc.
  -- Mirrors filesystem + action permissions
  permissions JSON NOT NULL,

  -- Ignore patterns (what this agent shouldn't touch)
  -- Respects .gitignore-style patterns
  ignore_patterns JSON DEFAULT '["node_modules/", ".git/"]',

  -- Prompt engineering
  prompt_prefix TEXT,            -- System message prefix
  temperature DECIMAL(3,2) DEFAULT 0.7,
  model VARCHAR(32) DEFAULT 'claude-sonnet-4-6',

  -- Cost tracking (for "agent economics")
  cost_per_task DECIMAL(10,4),   -- Avg $ cost per assignment
  avg_duration_minutes INT,      -- Avg time to complete

  -- Handoff rules (when to escalate)
  -- { "on_error": "escalate_to_dev", "on_complexity": ">3_hours" }
  handoff_rules JSON,

  -- Meta
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 2.3 System vs Custom Agents

**System Agents** (`is_system = TRUE`, `user_id = NULL`):

- Come with The Brain out-of-box
- Available to all users
- Can be cloned/customized by users
- Examples: dev, content, strategy, design, research

**Custom Agents** (`is_system = FALSE`, `user_id = {userId}`):

- Created by specific user
- Only visible/usable by that user
- Can override system agents
- Examples: "my-security-auditor", "thailand-copywriter"

### 2.4 Capability-Based Routing

Instead of hardcoded `agent: "dev"`, we ask: **"Who can do this?"**

```javascript
// Old: Hardcoded
if (task.type === 'code') assignTo('dev');

// New: Capability matching
const candidates = await agents.findByCapability('code');
// Returns: [dev, security-auditor, bolt-prompt-engineer]

// Filter by availability, cost, history
const best = await selectBestAgent(candidates, task);
```

**Capability Taxonomy (v1):**

```javascript
const CAPABILITIES = [
  // Code
  'code.write', // Write new code
  'code.review', // Review existing code
  'code.debug', // Fix bugs
  'code.test', // Write tests
  'code.deploy', // Deployment scripts

  // Content
  'content.write', // Draft content
  'content.edit', // Edit/improve
  'content.social', // Social posts
  'content.email', // Email sequences

  // Strategy
  'strategy.plan', // Planning
  'strategy.research', // Market research
  'strategy.analyze', // Data analysis

  // Design
  'design.ui', // UI design
  'design.assets', // Asset creation
  'design.brand', // Brand work

  // Research
  'research.market', // Market research
  'research.tech', // Tech research
  'research.competitor', // Competitive analysis

  // Special
  'audit.security', // Security audit
  'audit.performance', // Performance audit
  'legal.review', // Legal review (integration)
];
```

### 2.5 Agent Selection Algorithm

```javascript
async function selectAgentForTask(task, userId) {
  // 1. Find agents with required capabilities
  const candidates = await agents.findByCapability(task.required_capability);

  // 2. Filter by permissions (can access required files?)
  const permitted = candidates.filter((a) =>
    hasPermission(a.permissions, task.required_access)
  );

  // 3. Score by historical performance
  const scored = await Promise.all(
    permitted.map(async (a) => {
      const history = await tasks.getAgentHistory(a.id, { days: 30 });
      return {
        ...a,
        score: calculateScore(history, task),
        avgCost: history.avgCost,
        avgDuration: history.avgDuration,
        successRate: history.successRate,
      };
    })
  );

  // 4. Select best (or let user choose if close)
  scored.sort((a, b) => b.score - a.score);

  if (scored[0].score - scored[1]?.score > 0.3) {
    return scored[0]; // Clear winner
  }

  // Close call - return top 3 for user to choose
  return { ambiguous: true, options: scored.slice(0, 3) };
}
```

---

## 3. Workflow Execution Engine (Phase 5.5)

### 3.1 Core Concept

**Templates** → **Instances** → **Tasks**

```
Workflow Template (static)
    ↓
[User clicks "Start Product Launch"]
    ↓
Workflow Instance (running state)
    ↓
Creates Task #1 (assigned to Agent X)
    ↓
[Agent completes Task #1]
    ↓
Auto-advances to Step 2
    ↓
Creates Task #2 (assigned to Agent Y)
    ↓
...
```

**Key Insight:** Workflows are **orchestrators**, not just checklists. They:

1. Create tasks at the right time
2. Assign to appropriate agents
3. Track completion
4. Handle branching (if step X fails, do Y)
5. Maintain execution log

### 3.2 Schema Deep Dive

**Workflow Templates** (static definitions):

```sql
CREATE TABLE workflow_templates (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(36),           -- NULL = system template

  name VARCHAR(64) NOT NULL,
  description TEXT,
  icon VARCHAR(8) DEFAULT '📋',

  -- Step definitions (JSON array)
  -- Each step: { id, label, capability_required, agent_id (optional),
  --              auto_assign (boolean), approval_required (boolean) }
  steps JSON NOT NULL,

  -- Trigger conditions
  -- When can this workflow be started?
  triggers JSON,  -- { "manual": true, "on_event": "project_created" }

  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Workflow Instances** (running executions):

```sql
CREATE TABLE workflow_instances (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  workflow_template_id VARCHAR(32) NOT NULL,
  project_id VARCHAR(64),
  user_id VARCHAR(36) NOT NULL,

  -- State
  status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'aborted')
    DEFAULT 'pending',
  current_step_index INT DEFAULT 0,  -- Which step we're on

  -- Step results tracking
  -- { "step_1": { task_id: "...", status: "complete", result: "...", completed_at: "..." }, ... }
  step_results JSON DEFAULT '{}',

  -- Execution log (append-only)
  -- ["2026-03-15T10:00:00Z: Instance created",
  --  "2026-03-15T10:05:00Z: Step 1 assigned to dev agent",
  --  "2026-03-15T10:30:00Z: Step 1 completed", ...]
  execution_log TEXT,

  -- Metadata
  started_by ENUM('user', 'ai', 'trigger') DEFAULT 'user',
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  estimated_completion DATETIME DEFAULT NULL,

  FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 3.3 Execution Model

```javascript
// Starting a workflow
async function startWorkflow(templateId, projectId, userId) {
  const template = await workflowTemplates.get(templateId);

  // Create instance
  const instance = await workflowInstances.create({
    workflow_template_id: templateId,
    project_id: projectId,
    user_id: userId,
    status: 'running',
    step_results: {},
    execution_log: [`${new Date().toISOString()}: Workflow started by user`],
  });

  // Execute first step
  await executeStep(instance.id, 0);

  return instance;
}

// Executing a step
async function executeStep(instanceId, stepIndex) {
  const instance = await workflowInstances.get(instanceId);
  const template = await workflowTemplates.get(instance.workflow_template_id);
  const step = template.steps[stepIndex];

  // Determine assignee
  let assignee;
  if (step.agent_id) {
    // Specific agent requested
    assignee = { type: 'agent', id: step.agent_id };
  } else if (step.capability_required) {
    // Find agent by capability
    const agent = await selectAgentForCapability(step.capability_required);
    assignee = { type: 'agent', id: agent.id };
  } else {
    // Default to human
    assignee = { type: 'human', id: 'user' };
  }

  // Create task for this step
  const task = await tasks.create({
    project_id: instance.project_id,
    title: step.label,
    description: step.sop || `Complete step ${stepIndex + 1} of workflow`,
    assignee_type: assignee.type,
    assignee_id: assignee.id,
    workflow_instance_id: instance.id,
    workflow_step_id: step.id,
    priority: 'medium',
    context_uri: `brain://workflow/${instance.id}/step/${step.id}`,
  });

  // Update instance
  await workflowInstances.update(instanceId, {
    current_step_index: stepIndex,
    [`step_results.step_${step.id}`]: {
      task_id: task.id,
      status: 'pending',
      assigned_at: new Date().toISOString(),
    },
    $append: {
      execution_log: `${new Date().toISOString()}: Step ${stepIndex + 1} (${step.label}) assigned to ${assignee.type}:${assignee.id}`,
    },
  });

  // If auto-assigned to agent, trigger execution (Phase 5.6)
  if (assignee.type === 'agent' && step.auto_assign) {
    await triggerAgentExecution(task.id);
  }
}

// When task completes
async function onTaskComplete(taskId) {
  const task = await tasks.get(taskId);
  if (!task.workflow_instance_id) return; // Not part of workflow

  const instance = await workflowInstances.get(task.workflow_instance_id);
  const template = await workflowTemplates.get(instance.workflow_template_id);

  // Update step result
  await workflowInstances.update(instance.id, {
    [`step_results.step_${task.workflow_step_id}.status`]: 'complete',
    [`step_results.step_${task.workflow_step_id}.completed_at`]:
      new Date().toISOString(),
    $append: {
      execution_log: `${new Date().toISOString()}: Step ${instance.current_step_index + 1} completed`,
    },
  });

  // Advance to next step
  const nextStepIndex = instance.current_step_index + 1;
  if (nextStepIndex < template.steps.length) {
    await executeStep(instance.id, nextStepIndex);
  } else {
    // Workflow complete
    await workflowInstances.update(instance.id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      $append: {
        execution_log: `${new Date().toISOString()}: Workflow completed`,
      },
    });
  }
}
```

### 3.4 Branching & Conditions

Simple workflows are linear. Advanced workflows need branching:

```json
{
  "steps": [
    { "id": "1", "label": "Security Audit", "capability": "audit.security" },
    {
      "id": "2",
      "label": "Fix Issues",
      "capability": "code.fix",
      "condition": "step_1.issues_found > 0"
    },
    {
      "id": "3",
      "label": "Deploy",
      "capability": "code.deploy",
      "condition": "step_1.status === 'passed' || step_2.status === 'complete'"
    }
  ]
}
```

### 3.5 Parallel Execution

Some steps can run in parallel:

```json
{
  "steps": [
    { "id": "1", "label": "Plan", "capability": "strategy.plan" },
    {
      "id": "parallel_1",
      "parallel": [
        { "id": "2a", "label": "Design Assets", "capability": "design.assets" },
        { "id": "2b", "label": "Write Copy", "capability": "content.write" }
      ],
      "wait_for": "all" // or "any"
    },
    { "id": "3", "label": "Review", "agent_id": "human" }
  ]
}
```

---

## 4. Integration: Agents + Workflows + Tasks

### 4.1 The Complete Flow

```
User: "Launch this product"
  ↓
Orchestrator AI:
  1. Selects "Product Launch" workflow template
  2. Creates workflow instance
  3. Step 1: "Security Audit"
     - Needs capability: audit.security
     - Queries agents table → finds "security-auditor"
     - Creates task assigned to agent
     - Task: { assignee_type: 'agent', assignee_id: 'security-auditor', ... }
  ↓
Agent Execution (async):
  - Agent reads context (file summaries)
  - Performs security audit
  - Writes results to project
  - Marks task complete
  ↓
Workflow Engine:
  - Detects task completion
  - Evaluates condition: issues_found?
  - If yes → Step 2: "Fix Issues" (assign to dev agent)
  - If no → Step 3: "Deploy" (assign to dev agent)
  ↓
Repeat until workflow complete
```

### 4.2 URI Integration

Everything has a URI:

```
brain://agent/dev                    → Agent definition
brain://workflow/product-launch      → Workflow template
brain://workflow-instance/{id}       → Running instance
brain://task/{id}                    → Task
brain://project/{id}/file/{path}     → File (existing)
```

This enables:

- Deep linking from notifications
- Context references in tasks
- Audit trails
- "Show me everything related to this workflow"

### 4.3 Context Passing

When a workflow creates a task, what context does the agent get?

```javascript
const context = {
  // Workflow context
  workflow: {
    id: instance.id,
    name: template.name,
    step: currentStep.label,
    step_number: currentStepIndex + 1,
    total_steps: template.steps.length,
    previous_results: instance.step_results,
  },

  // Project context (via file summaries)
  project: {
    id: project.id,
    name: project.name,
    summaries: await buildSummaryContext(project.id),
    active_files: project.active_files,
  },

  // Task context
  task: {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
  },

  // Agent's own configuration
  agent: {
    id: agent.id,
    capabilities: agent.capabilities,
    permissions: agent.permissions,
    prompt_prefix: agent.prompt_prefix,
  },
};
```

---

## 5. User Experience

### 5.1 Agent Management UI

```
┌─────────────────────────────────────┐
│ 🤖 Agent Registry          [+ New]  │
├─────────────────────────────────────┤
│ System Agents (5)                   │
│ 🛠 Dev Agent        code, debug... │
│ ✍️ Content Agent    write, edit... │
│ ...                                 │
│                                     │
│ Your Custom Agents (3)              │
│ 🔒 Security Auditor audit, solid.. │
│ 📝 Copywriter       content...     │
│ ...                                 │
└─────────────────────────────────────┘
```

**Creating an Agent:**

1. Clone system agent OR start from scratch
2. Configure capabilities (checkboxes)
3. Set permissions (file tree selector)
4. Write prompt prefix
5. Test on sample task
6. Save

### 5.2 Workflow Instance UI

```
┌─────────────────────────────────────────────────┐
│ 🚀 Product Launch Workflow         [▶] [⏸] [✕] │
│ Project: MyApp                    Status: Running│
├─────────────────────────────────────────────────┤
│                                                 │
│ ✅ Step 1: Security Audit              (done)   │
│    Assigned to: 🔒 Security Auditor    10:05 AM │
│    Result: 2 issues found, see SECURITY_AUDIT.md│
│                                                 │
│ ▶️ Step 2: Fix Issues                  (active) │
│    Assigned to: 🛠 Dev Agent           10:30 AM │
│    Task: Fix SQL injection and XSS vulnerabilities│
│    [View Task] [Reassign] [Mark Complete]       │
│                                                 │
│ ⏳ Step 3: Deploy                      (pending)│
│                                                 │
│ ⏳ Step 4: Post Thread                 (pending)│
│                                                 │
├─────────────────────────────────────────────────┤
│ Execution Log:                                  │
│ 10:00: Workflow started by martin              │
│ 10:05: Step 1 completed - issues found         │
│ 10:30: Step 2 assigned to Dev Agent            │
└─────────────────────────────────────────────────┘
```

### 5.3 Task Delegation Flow

```
User creates task: "Write landing page copy"
  ↓
System analyzes:
  - Required capability: content.write
  - Available agents: [content, copywriter-custom, strategy]
  ↓
Presents options:
  ┌────────────────────────────────────────┐
  │ Who should do this?                   │
  │                                        │
  │ ○ ✍️ Content Agent (system)           │
  │   Avg cost: $0.02 | Success: 95%       │
  │                                        │
  │ ● 📝 Copywriter (custom) ← Recommended│
  │   Avg cost: $0.03 | Success: 98%       │
  │   Specializes in landing pages         │
│                                        │
  │ ○ 👤 Assign to me (human)             │
  └────────────────────────────────────────┘
  ↓
User selects → Task created → Agent notified
```

---

## 6. Open Questions & Decisions

### 6.1 Agent Versioning

- Do we version agents? (v1, v2 of "dev" agent)
- If an agent is updated, do running workflows use old or new definition?
- **Proposal:** Agents are immutable once created. Updates create new agent IDs.

### 6.2 Agent "Memory"

- Should agents remember past interactions?
- Per-project memory? Per-user memory?
- **Proposal:** Use existing file_summaries + task history. Agents don't have separate memory.

### 6.3 Cost Tracking

- Do we track actual API costs per agent?
- Show user "This agent costs ~$0.05 per task"?
- **Proposal:** Track estimated costs. Show warnings if expensive.

### 6.4 Human-in-the-Loop

- Every step can require human approval?
- Or only specific steps?
- **Proposal:** Per-step config: `approval_required: true/false`

### 6.5 Failure Handling

- What happens when an agent fails?
- Retry? Escalate? Abort workflow?
- **Proposal:** Configurable per workflow: retry_count, on_failure: 'escalate'|'abort'|'skip'

### 6.6 Agent Marketplace

- Share custom agents with other users?
- Import agents from community?
- **Future consideration:** Not for MVP.

---

## 7. Implementation Phases

### Phase 5.3: Agent Registry

**Goal:** Replace static SKILLS with database

Week 1:

- [ ] Migration: `agents` table
- [ ] Seed system agents (migrate SKILLS → DB)
- [ ] API: `resource=agents` CRUD
- [ ] Update AI proxy to load from DB

Week 2:

- [ ] UI: Agent management page
- [ ] UI: Clone/customize system agent
- [ ] Capability-based routing logic
- [ ] Update Bootstrap Wizard to use DB agents

### Phase 5.5: Workflow Execution

**Goal:** Execute workflows, create tasks

Week 1:

- [ ] Migration: `workflow_templates`, `workflow_instances`
- [ ] Seed system workflows (migrate WORKFLOWS → DB)
- [ ] API: `resource=workflow-templates` CRUD
- [ ] API: `resource=workflow-instances` lifecycle

Week 2:

- [ ] Workflow execution engine
- [ ] Task completion → workflow advance
- [ ] UI: Workflow instance viewer
- [ ] UI: "Start Workflow" buttons

Week 3:

- [ ] Branching logic
- [ ] Parallel execution
- [ ] Execution logs
- [ ] Pause/resume/abort

### Phase 5.6: Agent Task Execution ✅ COMPLETE (2026-03-15)

**Goal:** Agents actually DO work (function calling)
**Depends on:** Both 5.3 and 5.5

- [x] Define agent actions (read_file, write_file, create_task, search_projects, mark_complete, request_review)
- [x] Implement function calling in AI proxy (api/agent-execute.js)
- [x] Sandbox file operations (ignore_patterns per agent)
- [x] Preview mode vs Auto mode (auto_run_agents setting)
- [x] Execution tracing (functionResults in response)

---

## 8. Summary

**Agent Registry** transforms agents from static code to configurable, trackable, selectable workers.

**Workflow Engine** transforms workflows from dead checklists to living orchestrators that create tasks and track execution.

**Together** they create an **Orchestration Layer** where:

- AI assigns work based on capabilities
- Workflows execute step-by-step
- Progress is tracked and visible
- History is queryable
- System learns from performance

**The Vision:** User says "Launch this product" and the system:

1. Selects appropriate workflow
2. Assigns each step to best agent
3. Tracks progress
4. Handles handoffs
5. Reports completion

User is conductor, not musician.
