# Agent Architecture Decision: Files vs Database

**Date:** 2026-03-15  
**Decision:** Hybrid approach - Agent definitions as files, execution as tasks

---

## 1. Your Vision (Paraphrased)

### Agent Lifecycle
```
Task Created
    ↓
Agent "Spins Up" (reads definition from file)
    ↓
Executes Task (reads context from project files)
    ↓
Writes Results (to project files)
    ↓
Agent "Dies" (no persistent state)
    ↓
Next Task = New Agent ID, fresh spin-up
```

### Memory Model
- **No agent has memory** - by design
- **Context lives in files**:
  - Project structure → manifest.json
  - File summaries → file_summaries table (L0/L1)
  - Previous agent outputs → DEVLOG.md, TASKS.md, etc.
  - Agent definition → /agents/agent-name.md
- **Agents are aware of what they need** via:
  - SOP in their definition file
  - URI references (brain://project/{id}/file/{path})
  - Project context built from summaries

### Updates = New Agent
- Change prompt? → Create `/agents/dev-v2.md`
- Different capabilities? → New file, new ID
- Immutable history: "Task X used dev-v1, Task Y used dev-v2"

---

## 2. The Question: DB vs Files for Agent Definitions

### Option A: Pure Files (Everything in /agents/)

**Structure:**
```
/agents/
  ├── system-dev.md
  ├── system-content.md
  ├── system-strategy.md
  ├── system-design.md
  ├── system-research.md
  └── custom-security-auditor.md  (user-created)
```

**Each agent.md:**
```markdown
---
id: dev
name: Dev Agent
icon: 🛠
capabilities: [code.write, code.review, code.debug, code.test]
permissions: [read:all, write:code-modules, write:devlog]
ignore_patterns: [legal/, design-assets/, manifest.json]
cost_per_task: 0.02
avg_duration_minutes: 15
---

# Dev Agent

## System Prompt
Senior developer. Read context JSON. Check code-modules/ for existing work. 
Ask before deleting. Commit frequently.

## SOP
1. Read PROJECT_OVERVIEW.md and DEVLOG.md
2. Check code-modules/ for existing work
3. Never modify manifest.json or agent.ignore
4. Update DEVLOG.md after each change
5. Flag blockers in REVIEW_QUEUE.md

## Handoff Rules
- on_error: escalate_to_strategy
- on_complexity: ">3_hours"
```

**Pros:**
- ✅ Fits "everything in files" philosophy
- ✅ Version controlled (git history of agent changes)
- ✅ Simple to read/write
- ✅ Portable (just copy /agents/ folder)
- ✅ No DB migration needed for new agents
- ✅ Matches your "immutable" vision perfectly

**Cons:**
- ❌ Hard to query "which agents can do X?" (need to parse all files)
- ❌ No easy aggregation (avg cost, success rate across agents)
- ❌ Agent management UI needs to parse files
- ❌ Can't easily filter/sort agents

---

### Option B: Database (agents table)

**Structure:**
```sql
agents: id, name, capabilities JSON, permissions JSON, prompt_prefix, ...
```

**Pros:**
- ✅ Queryable: `SELECT * FROM agents WHERE capabilities CONTAINS 'code.write'`
- ✅ Fast aggregation: avg cost, success rates
- ✅ Easy agent management UI
- ✅ Can track agent usage stats

**Cons:**
- ❌ Feels like "persistent agents" (vs ephemeral)
- ❌ DB migrations for agent updates
- ❌ Not version controlled
- ❌ More complex

---

### Option C: Hybrid (RECOMMENDED)

**Agent Definitions:** Files in `/agents/`
- Source of truth for capabilities, prompts, SOP
- Immutable (new file = new version)
- Human-readable, editable

**Agent Registry Cache:** Lightweight DB table
```sql
CREATE TABLE agent_registry (
  id VARCHAR(32) PRIMARY KEY,
  file_path VARCHAR(256),      -- /agents/dev.md
  capabilities JSON,           -- Parsed from frontmatter
  last_parsed_at DATETIME,     -- For cache invalidation
  use_count INT DEFAULT 0,     -- Derived from tasks table
  avg_cost DECIMAL(10,4),      -- Derived from tasks table
  success_rate DECIMAL(5,2)    -- Derived from tasks table
);
```

**How it works:**
1. System watches `/agents/` folder (or parses on demand)
2. Parses each .md file → populates agent_registry cache
3. UI queries agent_registry (fast)
4. Source of truth remains files
5. Stats are derived from tasks table (agent_id references)

**Pros:**
- ✅ Files are source of truth (your vision)
- ✅ Still queryable for UI (capability filtering)
- ✅ Stats derived from actual task execution
- ✅ No duplication of definition data

---

## 3. Recommended Architecture

### Agent Definition Files

Location: `/agents/` folder (system + project-specific)

**System agents:** Built into The Brain
- `/agents/system-dev.md`
- `/agents/system-content.md`
- etc.

**Project-specific agents:** Created per project
- `/agents/project-{id}-custom-security.md`
- Or: stored in project folder `/project-artifacts/agents/`

**File format:**
```markdown
---
id: dev-v2
version: 2
previous_version: dev-v1
name: Dev Agent
icon: 🛠
capabilities: 
  - code.write
  - code.review
  - code.debug
permissions:
  - read:all
  - write:code-modules
ignore_patterns:
  - legal/
  - "*.test.js"
model: claude-sonnet-4-6
temperature: 0.7
---

Senior developer specializing in React/Vite stack...
```

### Agent Registry Service

```javascript
// src/agents.js

class AgentRegistry {
  // Load all agents from /agents/ folder
  async loadAgents() {
    const files = await this.listAgentFiles();
    return Promise.all(files.map(f => this.parseAgentFile(f)));
  }
  
  // Parse frontmatter + markdown
  async parseAgentFile(path) {
    const content = await fetchAgentFile(path);
    const { frontmatter, body } = parseFrontmatter(content);
    return {
      ...frontmatter,
      prompt_prefix: body,
      file_path: path
    };
  }
  
  // Find by capability (for routing)
  async findByCapability(capability) {
    const agents = await this.loadAgents();
    return agents.filter(a => a.capabilities.includes(capability));
  }
  
  // Get stats from tasks table
  async getAgentStats(agentId) {
    return tasks.getAgentHistory(agentId);
  }
}
```

### Task Execution Flow

```javascript
// 1. Task created
const task = await tasks.create({
  title: "Fix login bug",
  required_capability: "code.debug",
  context_uri: "brain://project/{id}/file/auth.js"
});

// 2. Find suitable agent
const candidates = await agentRegistry.findByCapability("code.debug");
// Returns: [dev, security-auditor] from parsed /agents/*.md files

// 3. Select best agent (with stats)
const bestAgent = await selectBestAgent(candidates, task);
// agent_id = "dev-v2" (just a string reference)

// 4. Update task with assignment
await tasks.assign(task.id, {
  assignee_type: "agent",
  assignee_id: bestAgent.id,  // "dev-v2"
  assignee_version: bestAgent.version  // 2
});

// 5. Agent execution
async function executeAgentTask(task) {
  // Load agent definition from file
  const agent = await agentRegistry.get(task.assignee_id);
  
  // Load project context
  const context = await buildContext(task.project_id);
  
  // Build prompt
  const prompt = `
${agent.prompt_prefix}

PROJECT CONTEXT:
${context}

YOUR TASK:
${task.title}
${task.description}

RULES:
${agent.sop.join('\n')}
  `;
  
  // Execute
  const result = await ai.ask(agent.model, prompt);
  
  // Write results to files
  await writeResults(task, result);
  
  // Mark complete
  await tasks.complete(task.id, {
    result_summary: result.summary,
    cost: result.cost,
    duration_minutes: result.duration
  });
}

// 6. Agent "dies" here - no state persists
```

---

## 4. Database Schema (Minimal)

Only need to track execution, not definitions:

```sql
-- Already exists from Phase 5.4
CREATE TABLE tasks (
  id VARCHAR(36) PRIMARY KEY,
  assignee_type ENUM('human', 'agent', 'integration'),
  assignee_id VARCHAR(64),      -- "dev-v2" (references file, not DB row)
  assignee_version INT,         -- 2
  result_cost DECIMAL(10,4),    -- Actual cost
  result_duration_minutes INT,  -- Actual duration
  -- ... other fields
);

-- New: Cache for fast queries (optional, can rebuild from files)
CREATE TABLE agent_cache (
  id VARCHAR(32) PRIMARY KEY,   -- "dev-v2"
  file_path VARCHAR(256),       -- "/agents/dev-v2.md"
  capabilities JSON,            -- Cached from file
  last_seen_at DATETIME         -- For cleanup
);
```

**No persistent agent state.** Just:
1. Task references agent by ID (string)
2. Agent definition read from file on demand
3. Stats derived from tasks table

---

## 5. Key Principles

### Stateless Agents
```javascript
// BAD: Agent has memory
agent.memory.previousTasks = [...];

// GOOD: Agent reads from files
const previousWork = await readFile('brain://project/{id}/file/DEVLOG.md');
```

### Immutable Definitions
```javascript
// BAD: Update existing agent
await agents.update('dev', { prompt: 'new prompt' });

// GOOD: Create new version
await createAgentFile('dev-v2.md', { ...newConfig });
// Task history still shows "used dev-v1" vs "used dev-v2"
```

### Context in Files
```javascript
// Agent builds context from:
const context = {
  // L0/L1 summaries (from DB, derived from files)
  projectSummaries: await getFileSummaries(projectId),
  
  // Key files (content from project_files table)
  manifest: await readFile('manifest.json'),
  devlog: await readFile('DEVLOG.md'),
  
  // Previous task outputs (from tasks table, but written to files)
  previousResults: await readFile('TASKS.md')
};
```

---

## 6. Migration from Current State

Current: Hardcoded `const SKILLS = {...}`

Migration:
1. Create `/agents/` folder
2. Generate .md files from SKILLS object:
   - `/agents/dev.md` from SKILLS.dev
   - `/agents/content.md` from SKILLS.content
   - etc.
3. Update AI proxy to load from files
4. Remove SKILLS constant
5. Add AgentRegistry service

---

## 7. Questions

1. **Where do agent files live?**
   - A: Global `/agents/` folder (all projects see all agents)
   - B: Per-project `/project-artifacts/agents/` (project-specific)
   - C: Both (system agents global, custom agents per-project)

2. **How are agent files created?**
   - A: User writes .md directly in editor
   - B: UI form generates .md file
   - C: Clone system agent → customize → save as new

3. **Agent versioning:**
   - A: Manual (user names it dev-v2)
   - B: Auto (system appends -v2, -v3)
   - C: Git-style (UUIDs, show "based on dev-v1")

4. **Stats storage:**
   - A: Real-time aggregation from tasks table
   - B: Cached in agent_cache table, updated periodically
   - C: Materialized view

---

## Recommendation

**Go with File-based agent definitions + Task-based execution stats.**

This matches your vision perfectly:
- Agents are ephemeral, stateless
- Context lives in files (L0/L1 summaries, project structure)
- Immutable (new file = new agent version)
- Queryable via lightweight cache
- Fits "everything in files" philosophy

**Next steps:**
1. Create `/agents/` folder with 5 system agents as .md files
2. Build AgentRegistry service (parse, query)
3. Update task assignment to use file-based agents
4. Build agent management UI (reads/writes .md files)

Thoughts?
