# Workflows & Agents — Practical Guide

> How to use, understand, and extend the orchestration system.

---

## The One-Line Summary

**Agents** are AI workers with specific skills. **Workflows** are sequences of steps that auto-assign work to those agents. You start a workflow, the system does most of it, you only step in where needed.

---

## How It All Connects

The glue between a workflow step and an agent is a **capability string** — a simple dot-notation tag like `code.write` or `outreach.find`.

```
system-dev.md            declares:  capabilities: [code.write, code.review, ...]
                                                          │
workflow step            declares:  capability: "code.write", auto_assign: true
                                                          │
                                                          ▼
                              selectAgent("code.write") → Dev Agent ✓
                              Task created + assigned to Dev Agent
```

That's the whole system. Everything else — the UI, the DB tables, the execution engine — is scaffolding around that simple match.

---

## Part 1: Agents (Skills)

### What an agent is

An agent is a markdown file in `public/agents/` with YAML frontmatter. The frontmatter defines the agent's identity and capabilities. The body is its system prompt — what the AI receives when it executes a task.

### The file format

```markdown
---
id: system-dev-v1          # Unique ID used in task assignment
version: 1                 # Increment when forking
name: Dev Agent            # Display name in the Skills tab
icon: 🛠                   # Emoji icon
description: Code, debug, deploy.

capabilities:              # List of capability strings this agent can handle
  - code.write
  - code.review
  - code.debug
  - code.test
  - code.deploy
  - audit.security

permissions:               # What it can read/write (enforced in execution)
  - read:all
  - write:code-modules
  - write:devlog

ignore_patterns:           # Paths the agent will never touch
  - legal/
  - manifest.json

model: claude-sonnet-4-6   # AI model to use
temperature: 0.7           # 0.0 = precise, 1.0 = creative
cost_per_task_estimate: 0.02
avg_duration_minutes_estimate: 15

handoff_rules:             # What to do when stuck
  on_error: escalate_to_human
  on_complexity: ">3_hours"

created_by: system
created_at: 2026-03-15
---

# Dev Agent

You are a senior developer. You write clean, working code. You don't explain unless asked. You ship.

## Standard Operating Procedure
...
```

### System agents (7 built-in)

| Agent | File | Capabilities |
|-------|------|-------------|
| Dev Agent | `system-dev.md` | `code.write` `code.review` `code.debug` `code.test` `code.deploy` `audit.security` |
| Content Agent | `system-content.md` | `content.write` `content.edit` `content.social` `content.email` `content.docs` |
| Strategy Agent | `system-strategy.md` | `strategy.plan` `strategy.research` `strategy.analyze` `strategy.prioritize` |
| Design Agent | `system-design.md` | `design.ui` `design.assets` `design.brand` `design.prototype` |
| Research Agent | `system-research.md` | `research.market` `research.tech` `research.competitor` `research.user` |
| Outreach Agent | `system-outreach.md` | `outreach.find` `outreach.write` `outreach.track` |
| Finance Agent | `system-finance.md` | `finance.analyze` `finance.price` `finance.report` |

### Full capability taxonomy

```
code.*          code.write  code.review  code.debug  code.test  code.deploy
content.*       content.write  content.edit  content.social  content.email  content.docs
strategy.*      strategy.plan  strategy.research  strategy.analyze  strategy.prioritize
design.*        design.ui  design.assets  design.brand  design.prototype
research.*      research.market  research.tech  research.competitor  research.user
outreach.*      outreach.find  outreach.write  outreach.track
finance.*       finance.analyze  finance.price  finance.report
audit.*         audit.security
```

You can invent new capability strings freely — just make sure your agent file declares them and your workflow step references the same string.

---

### How to create a new agent

**Step 1 — Create the file**

Add `public/agents/my-agent.md` following the format above. Key rules:
- `id` must be unique across all agent files
- `capabilities` is how workflow steps find this agent — get the strings right
- The markdown body is the system prompt the AI will receive

**Step 2 — No restart needed**

Agent files are fetched live via `fetch('/agents/my-agent.md')`. The browser caches them for 60 seconds. Reload the app to see your new agent in the Skills tab.

**Step 3 — Verify it loaded**

Open the **Skills** tab in The Brain. Your agent should appear. If not, check the browser console for 404 errors — the filename or path is wrong.

---

### How to create a custom agent (cloning an existing one)

From the **Skills** tab, select any agent and click **Clone**. This creates a new agent definition you can edit. Useful when you want a project-specific variant (e.g., a Dev Agent tuned for a specific stack).

Cloned agents get an ID like `system-dev-v2-clone-2026-03-18` and are marked `created_by: user`. They behave identically to system agents but aren't overwritten by system updates.

---

## Part 2: Workflows

### What a workflow is

A workflow is a sequence of steps. Each step:
- Has a label and a SOP (standard operating procedure — a one-line instruction)
- Declares which **capability** is needed to complete it
- Says whether to **auto-assign** to an agent or wait for human action

Workflows live in two places:
- **`public/agents/system-workflows.json`** — the source of truth, seeded into the DB on first login
- **The database** (`workflow_templates` table) — what the app actually reads at runtime

### The step format

```json
{
  "id": "step-id",
  "label": "Human-readable step name",
  "capability": "code.write",
  "sop": "One-sentence instruction for the agent",
  "auto_assign": true
}
```

| Field | Effect |
|-------|--------|
| `capability` | Which agent handles this (matched by capability string) |
| `auto_assign: true` | Agent is found and executed immediately when this step is reached |
| `auto_assign: false` | Task is created and assigned to **you** — workflow pauses until you complete it |

### The 7 system workflows

| Workflow | Steps | What it does |
|----------|-------|-------------|
| **Product Launch** | 7 | Build check → security → assets → copy → deploy → announce → monitor |
| **Content Sprint** | 5 | Angle → draft → design assets → human review → publish |
| **Idea → Brief** | 6 | Capture → validate → research → MVP scope → dev brief → wireframes |
| **Weekly Review** | 6 | Health check → staging review → AI analysis → devlogs → set focus → build post |
| **Security Audit** | 5 | Dependencies → env vars → input validation → auth review → report |
| **Outreach Sprint** | 4 | Find leads → draft messages → human review → log & track |
| **Revenue Check** | 4 | Finance snapshot → pricing review → revenue priorities → human review |

---

### How to run a workflow

1. Open a project (any project works — the workflow runs in its context)
2. Go to the **Workflows** tab in the Brain panel
3. Pick a workflow template and click **Start**
4. The first step executes immediately:
   - If `auto_assign: true` → the agent runs, you'll see the task update in real time
   - If `auto_assign: false` → a task appears in your **My Tasks** list; complete it to advance
5. Each completed step triggers the next automatically

### How to complete a human step

When a workflow step is assigned to you (`auto_assign: false`), a task appears in the **Tasks** view with a `PENDING` badge. Click it, do the work, then click **Complete**. The workflow advances to the next step.

---

### How to create a new workflow

**Option A — Edit the JSON (simplest)**

Add a new entry to `public/agents/system-workflows.json`:

```json
{
  "id": "my-custom-workflow",
  "name": "My Workflow",
  "description": "What this workflow does",
  "icon": "🔧",
  "steps": [
    {
      "id": "step-1",
      "label": "Research Phase",
      "capability": "research.market",
      "sop": "Research 3 competitors and write up findings",
      "auto_assign": true
    },
    {
      "id": "step-2",
      "label": "Human Review",
      "capability": "strategy.analyze",
      "sop": "Review research findings and decide direction",
      "auto_assign": false
    },
    {
      "id": "step-3",
      "label": "Write Brief",
      "capability": "content.write",
      "sop": "Turn research into a one-page brief",
      "auto_assign": true
    }
  ],
  "triggers": ["manual"]
}
```

On next login, `seedSystemWorkflows()` will detect this is a new ID and add it to the database automatically. It will then appear in the Workflows tab.

**Option B — Via the Tasks/Workflows API (programmatic)**

```js
// POST /api/data?resource=workflows
await workflows.create({
  id: 'my-custom-workflow',
  name: 'My Workflow',
  description: '...',
  icon: '🔧',
  steps: [...],
  is_system: false,
});
```

---

## Part 3: The Execution Flow (what happens when you click Start)

```
1.  User clicks "Start Workflow" on template X
        │
        ▼
2.  WorkflowRunner.jsx → startWorkflow(templateId, projectId)
        │
        ▼
3.  workflow_instance created in DB
    { status: 'running', current_step_index: 0 }
        │
        ▼
4.  executeStep(instanceId, 0) runs for step 0
        │
        ├─ step.auto_assign = true?
        │       │
        │       ▼
        │   selectAgent(step.capability)
        │   → fetches /agents/system-*.md files
        │   → finds agent with matching capability
        │   → scores by success rate + cost
        │   → returns best match
        │       │
        │       ▼
        │   task created: assignee_type='agent', assignee_id='system-dev-v1'
        │       │
        │       ▼
        │   agentExecution.execute(taskId)
        │   → POST /api/agent-execute
        │   → reads agent .md file server-side
        │   → builds prompt (agent SOP + project context + task description)
        │   → calls AI provider
        │   → saves result to task.result_summary
        │   → marks task complete
        │       │
        │       ▼
        │   onTaskComplete(taskId) → executeStep(instanceId, 1) [next step]
        │
        └─ step.auto_assign = false?
                │
                ▼
            task created: assignee_type='human', assignee_id='user'
            Workflow pauses. Resumes when you mark the task complete.

5.  Repeat for each step until all done.
    workflow_instance.status → 'completed'
```

---

## Part 4: Common Patterns

### Pattern 1 — Fully automated workflow

All steps have `auto_assign: true`. You click Start, walk away, come back to results.

Best for: repetitive processes where agent output doesn't need review before moving on (e.g., generating a first draft, running an audit).

```json
"steps": [
  { "capability": "research.market", "auto_assign": true },
  { "capability": "content.write",   "auto_assign": true },
  { "capability": "design.assets",   "auto_assign": true }
]
```

### Pattern 2 — Human gate at the end

Agent does the work, you review and approve once at the end.

Best for: anything where quality matters before it leaves your system (outreach messages, published content, financial decisions).

```json
"steps": [
  { "capability": "outreach.write",   "auto_assign": true  },
  { "capability": "outreach.write",   "auto_assign": false }  ← you review
]
```

### Pattern 3 — Mixed ownership (most common)

Some steps need human judgement, others are pure execution. You stay in the loop on decisions, agents handle grunt work.

Best for: anything creative or strategic where direction must come from you, but production work can be delegated.

```json
"steps": [
  { "capability": "strategy.analyze",  "auto_assign": false },  ← you decide direction
  { "capability": "content.write",     "auto_assign": true  },  ← agent drafts
  { "capability": "design.assets",     "auto_assign": true  },  ← agent creates assets
  { "capability": "strategy.analyze",  "auto_assign": false }   ← you approve
]
```

### Pattern 4 — Multiple agents in one workflow

Steps can target different agents. The capability string routes to whoever can handle it.

Best for: end-to-end processes that span disciplines (strategy → dev → content → design).

```json
"steps": [
  { "capability": "strategy.plan",    "auto_assign": true },  ← Strategy Agent
  { "capability": "code.write",       "auto_assign": true },  ← Dev Agent
  { "capability": "content.write",    "auto_assign": true },  ← Content Agent
  { "capability": "design.assets",    "auto_assign": true }   ← Design Agent
]
```

---

## Part 5: Troubleshooting

### "No workflow templates showing in the Workflows tab"

The workflows haven't been seeded yet. This happens on first login after a fresh database. Check the browser console for `[Workflow] Seeded N new system workflow(s)`. If you see an error instead, check your DB connection and that all env vars are set.

### "Workflow step isn't auto-assigning to an agent"

Two possible causes:

1. **No agent has the required capability.** Open the Skills tab and check which capabilities your agents declare. The step's `capability` string must exactly match one in an agent's frontmatter. Check for typos.

2. **Agent file isn't loading.** Open DevTools → Network and look for requests to `/agents/system-*.md`. If they 404, the file isn't in `public/agents/`. Make sure the filename matches what `src/agents.js` is requesting.

### "I added a new workflow to system-workflows.json but it's not showing up"

The seeding function only adds workflows that aren't already in the database. Check that:
- Your new entry has a unique `id` field
- The app has been reloaded (seeding runs on login)
- The browser console shows `[Workflow] Seeded 1 new system workflow(s)`

If you need to force a re-seed, delete the relevant row from the `workflow_templates` table in TiDB, then reload.

### "Agent completed but result doesn't look right"

The agent prompt is built from:
1. The agent's system prompt (the markdown body in the `.md` file)
2. The project context (name, phase)
3. The task description (the step's `sop` field)
4. File summaries from the project (L0/L1 abstracts, if generated)

To improve results: write more specific `sop` text in the workflow step, or edit the agent's system prompt body to be more precise about output format.

---

## Part 6: Quick Reference

### Adding a new capability area

1. Decide the namespace: `myarea.action`
2. Add to the relevant agent's `.md` file under `capabilities:`
3. Reference it in a workflow step under `capability:`
4. That's it — no code changes needed

### Agent file checklist

- [ ] `id` is unique (check all other `.md` files)
- [ ] `capabilities` list covers what workflow steps will request
- [ ] `model` is a valid model ID (e.g., `claude-sonnet-4-6`)
- [ ] Markdown body is a clear, focused system prompt
- [ ] File is in `public/agents/` (not `agents/` at project root)

### Workflow step checklist

- [ ] `id` is unique within the workflow
- [ ] `capability` exactly matches a capability string in at least one agent
- [ ] `sop` is a one-sentence instruction specific enough to produce useful output
- [ ] `auto_assign` is set intentionally (`true` = agent, `false` = you)

### File locations

| What | Where |
|------|-------|
| Agent definitions | `public/agents/system-*.md` |
| System workflow templates | `public/agents/system-workflows.json` |
| Agent registry (browser) | `src/agents.js` |
| Workflow engine | `src/workflows.js` |
| Workflow UI | `src/components/WorkflowRunner.jsx` |
| Agent manager UI | `src/components/AgentManager.jsx` |
| Agent execution API | `api/agents.js` |
| Task + workflow API routes | `api/data.js` (lines 3181+) |
