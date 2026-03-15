# THE BRAIN — Agent Build Brief v2.0
**From AI Coach to Agent Orchestrator**

---

## Your Operating Files

1. **BRAIN_STATUS.md** — What the project is, what's built, what's broken, what's next
2. **BRAIN_ROADMAP.md** — Step-by-step task list in dependency order
3. **This file (AGENT_BRIEF.md)** — Your instructions. Don't modify this file.

**Read all three files before doing anything.**

---

## v2.0 Vision: Three Assistance Modes

The Brain now serves users in **three modes**. All features must respect the current mode.

| Mode | User Need | Coaching | Delegation | Tone |
|------|-----------|----------|------------|------|
| **Coach** | Building habits, needs accountability | Mandatory, interruptive | Suggests, human decides | Challenging, direct |
| **Assistant** | In flow, needs efficiency | On-demand | Auto-assigns with preview | Supportive, neutral |
| **Silent** | Power user, minimal help | Off | Manual only | Minimal, factual |

**Key Principle:** *Orchestration features (task delegation, workflows) work the same in all modes — only the coaching layer changes intensity.*

---

## Rules

### 1. One task at a time.
Pick the next incomplete task from the roadmap. Do that task. Nothing else. Don't skip ahead. Don't combine tasks. Don't "while I'm here" adjacent work.

### 2. Follow dependency order.
The roadmap is sequenced. Phase 5 before Phase 6. Task 5.1 before 5.2. If a task depends on another, finish the dependency first.

### 3. Ask before starting.
State which task you're about to work on and what your approach will be. Wait for confirmation before writing code.

### 4. Update both documents after every completed task.
- **BRAIN_ROADMAP.md:** Check off completed sub-tasks. Mark the task as done.
- **BRAIN_STATUS.md:** Update "Last Updated" date. Move completed work from "Next Actions" to "What's Built." Add any new bugs discovered to "Known Bugs." Adjust priorities if needed.

Do this immediately after completing each task, not at the end of a session.

### 5. Test before marking done.
Every task in the roadmap has a "Done when" statement. Verify that condition is met before checking it off. If you can't verify (e.g., needs deployment), note it as "Complete — awaiting verification."

### 6. Don't refactor what isn't broken.
You'll see things you want to clean up. Don't. Unless the current task specifically requires changing existing code, leave it alone. Log improvement ideas in the BRAIN_STATUS.md parking lot.

### 7. Preserve the single-file architecture.
TheBrain.jsx is one file by design. Don't split it into components unless explicitly told to. New serverless functions, API routes, and DB migrations are fine — but the frontend stays as one file until the user decides otherwise.

### 8. Optimistic update pattern.
All data operations follow this pattern:
1. Update React state immediately
2. Fire API call in background
3. On error: revert state + show toast
Don't break this pattern.

### 9. Schema changes need migration tracking.
When adding/modifying DB tables, write the SQL as a migration script. Log it in `schema_migrations`. Never run raw ALTER TABLE without recording what changed.

### 10. Keep the user informed.
At the start of each session, state:
- What was last completed
- What's next on the roadmap
- Any blockers or questions

At the end of each session, provide:
- What was completed this session
- Updated task count (X of Y done)
- What's next

### 11. Mode-aware implementation (NEW v2.0).
When building features that interact with the AI Coach or user notifications:
- Check `settings.assistance_mode`
- Gate coaching features behind mode checks
- Assistant mode = available but not intrusive
- Silent mode = feature off or hidden
- Never assume Coach mode (even though it's default)

---

## Context You Need

- **Stack:** React 18 + Vite, Vercel serverless, TiDB Cloud (MySQL), JWT auth
- **Live URL:** the-brain-2.vercel.app
- **Main component:** `src/TheBrain.jsx` (~5,829 lines)
- **API layer:** `src/api.js` + serverless functions in `api/`
- **DB schema:** See `schema.sql` and BRAIN_STATUS.md Section 3
- **Multi-provider AI:** Anthropic, Moonshot, DeepSeek, Mistral, OpenAI via `api/ai.js`

**The user** is comfortable with git, GitHub, Vercel, Netlify, React, and terminal commands. Speak at that level.

---

## v2.0 Architecture Understanding

### Orchestration Layer (New)
```
┌─────────────────────────────────────────────────────────────┐
│  ROUTER — Decides who does what                             │
│  Input: Task description + context                          │
│  Output: {assignee_type, assignee_id, reason}               │
├─────────────────────────────────────────────────────────────┤
│  PLANNER — Breaks down work                                 │
│  Input: High-level goal                                     │
│  Output: List of tasks with dependencies                    │
├─────────────────────────────────────────────────────────────┤
│  WORKFLOW ENGINE — Executes step-by-step                    │
│  Input: Workflow template + project context                 │
│  Output: Running instance, step tracking                    │
├─────────────────────────────────────────────────────────────┤
│  MODE LOGIC — Adapts behavior                               │
│  Input: Current mode setting + user context                 │
│  Output: Filtered/coached/gated actions                     │
└─────────────────────────────────────────────────────────────┘
```

### Open Viking Patterns (Integrating)
- **URI Scheme:** `brain://` for all resources
- **Hierarchical Context:** L0 (100 tokens) → L1 (2K) → L2 (full)
- **Recursive Retrieval:** Directory exploration vs flat search
- **Retrieval Traces:** Visualize AI decision process

---

## What You Don't Do

- Don't redesign the UI. Functional changes only. Design comes later.
- Don't introduce new dependencies without stating why and getting approval.
- Don't build features that aren't on the roadmap without explicit permission.
- Don't offer motivational commentary. Be direct, technical, and brief.
- Don't repeat context the user already knows. They wrote the status doc.
- **Don't assume all users want coaching** — respect the mode setting (NEW v2.0)

---

## Session Start Template

```
## Session Start

**Last completed:** [task X.X — description]
**Next task:** [task X.X — description]
**Mode context:** [If building mode-aware feature, state assumptions]
**Blockers:** [none / description]
**Ready to proceed?**
```

## Session End Template

```
## Session End

**Completed this session:** [task(s)]
**Progress:** X of Y tasks done
**Documents updated:** ✓ ROADMAP / ✓ STATUS
**Mode considerations:** [If applicable: how feature respects modes]
**Next task:** [task X.X — description]
```

---

## v2.0 Development Notes

### When Building Mode-Aware Features

**Example: Daily Check-in**
```javascript
// Coach mode: Mandatory prompt
if (mode === 'coach' && !hasCheckedInToday) {
  showModal(<DailyCheckinModal />);
}

// Assistant mode: Available, not prompted
if (mode === 'assistant') {
  showIndicator(<CheckinStatus />); // Click to open
}

// Silent mode: Off
if (mode === 'silent') {
  // No check-in UI at all
}
```

**Example: AI Coach Response**
```javascript
// System prompt varies by mode
const systemPrompt = {
  coach: `${identity}\n${all10Rules}\n${stateRouting}`,
  assistant: `${identity}\n${reducedRules}\n${helpfulTone}`,
  silent: `${minimalIdentity}\nAnswer questions only.`
}[mode];
```

### When Building Orchestration Features

**Task Creation → Assignment Flow:**
1. User (or AI) creates task
2. Router determines assignee (rules-based v1, ML v2)
3. If agent: trigger with context
4. If human: add to "My Tasks"
5. Track status, completion

**Always:**
- Store assignment reason (explainable AI)
- Allow human override
- Show retrieval traces when AI makes decisions

---

*THE BRAIN · Agent Brief · v2.0*
