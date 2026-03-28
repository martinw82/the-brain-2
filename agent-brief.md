# THE BRAIN / SPINE — Agent Build Brief v2.2

**Product:** Spine (codebase: `the-brain-2`)  
**For:** AI agents working on this repo across sessions

---

## Your Three Operating Files

Read these before doing anything:

1. **`brain-status.md`** — What's built, what's broken, what's next, all constraints
2. **`brain-roadmap.md`** — Deprecated. See `CHANGELOG.md` for history. All phases complete.
3. **This file** — Your operating rules. Do not modify this file.

---

## Assistance Modes

The product serves users in three modes. Features must respect the current mode from `settings.assistance_mode`.

| Mode | Coaching | Delegation | Tone |
|------|----------|------------|------|
| **Coach** | Mandatory, interruptive | Suggests, human decides | Challenging, direct |
| **Assistant** | On-demand | Auto-assigns with preview | Supportive, neutral |
| **Silent** | Off | Manual only | Minimal, factual |

Orchestration (tasks, workflows, agents) works identically in all modes. Only the coaching layer changes.

---

## Rules

### 1. One task at a time.
Pick the next incomplete task. Do that. Nothing else. No "while I'm here" adjacent work.

### 2. Follow dependency order.
If a task depends on another, finish the dependency first. Check for blocked items before starting.

### 3. Ask before starting.
State the task and your approach. Wait for confirmation before writing code.

### 4. Update brain-status.md after every completed task.
Move completed work into the right section. Add bugs discovered to Known Issues. Append an edit annotation at the bottom.

### 5. Test before marking done.
Every task has a "Done when" condition. Verify it. If you can't verify (needs deployment), note it as "Complete — awaiting verification."

### 6. Don't refactor what isn't broken.
Log improvement ideas in brain-status.md parking lot. Don't clean up adjacent code unless the task requires it.

### 7. Preserve the modular architecture.
- Business logic → `src/hooks/` (deps pattern)
- Tab UI → `src/components/panels/` (ctx prop pattern)
- Constants/helpers → `src/utils/`
- `TheBrain.jsx` is the orchestrator — state, wiring, navigation JSX only

### 8. Optimistic update pattern.
1. Update React state immediately
2. Fire API call in background
3. On error: revert state + show toast

### 9. Schema changes need migration tracking.
Write new SQL in `scripts/migrate.js`. Log it in `schema_migrations`. Never run raw `ALTER TABLE` without recording it.

### 10. Mode-aware implementation.
Check `settings.assistance_mode`. Gate coaching features behind mode checks. Never assume Coach mode.

### 11. REL graph before execution. (v2.2)
Every entity (file, task, asset, workflow output) must be registered with `createNode()` in `src/entityGraph.js` **before** execution begins. After completion, call `realizeNode()` with output and checksum. Every entity must have:
- `generated_by` relation (what created it)
- `depends_on` relations (what it requires)
If the full lineage from root to output cannot be traced, the entity is not complete.

### 12. Vercel function slots are scarce. (v2.2)
The Hobby plan allows 12 serverless functions. **8 are used.** New utility/library code must go in `api/_lib/`. New endpoints must be merged into existing files with method routing (GET/POST/PUT/DELETE switch). Never add a new top-level `.js` file to `api/` without removing one.

### 13. No DEFAULT on JSON columns. (v2.2)
TiDB strict mode rejects `DEFAULT '{}'` or any `DEFAULT` on `JSON`, `TEXT`, or `BLOB` columns. Handle defaults in application code.

### 14. Format before every commit. (v2.2)
`.husky/pre-commit` runs Prettier against **all** `src/**/*.{js,jsx}` files, not just staged ones. Run `npm run format` before committing, even for tiny changes.

### 15. Budget awareness. (v2.2)
Cost Guard caps at £15/month. Use `suggestProvider()` before AI calls in pipelines. Prefer Haiku for high-frequency tasks (storyboard, keywords), Sonnet for reasoning tasks (script, research, assessment).

---

## Context You Need

- **Stack:** React 18 + Vite 6, Vercel serverless, TiDB Cloud (MySQL), JWT auth
- **Live URL:** the-brain-2.vercel.app
- **Orchestrator:** `src/TheBrain.jsx` (~3,962 lines) — state + hook wiring + navigation JSX
- **Business logic:** 11 hooks in `src/hooks/` (each accepts deps object, returns operations)
- **Panel UI:** `src/components/panels/HubEditorPanel.jsx` and `BrainTabsPanel.jsx` (receive ctx prop)
- **API layer:** `src/api.js` (client) + 8 serverless functions in `api/`
- **DB schema:** `schema.sql`, `schema-reference.md`, `brain-status.md §3`
- **Multi-provider AI:** Anthropic, Moonshot, DeepSeek, Mistral, OpenAI via `api/ai.js`
- **Pre-commit:** Prettier on all `src/`. Run `npm run format` before committing.

**The user** (Martin) is a London-based solo builder, comfortable with git, GitHub, Vercel, Netlify, React, and terminal. Speak at that level. He is working toward Thailand income freedom (£3k/mo target) and values autonomy, shipping over planning, and anti-establishment independence.

---

## Codebase Map

### Where to find and fix things

| Area | Primary File(s) |
|------|----------------|
| State declarations | `src/TheBrain.jsx` lines 1-320 |
| Hook wiring + derived values | `src/TheBrain.jsx` lines 320-1100 |
| Top bar, navigation, modals JSX | `src/TheBrain.jsx` lines 1100-3962 |
| Project CRUD, file ops | `src/hooks/useProjectCrud.js` |
| Staging pipeline | `src/hooks/useStagingOps.js` |
| Session, checkin, training | `src/hooks/useSessionOps.js` |
| Notifications | `src/hooks/useNotifications.js` |
| Task management + agent polling | `src/hooks/useTaskOps.js` |
| AI, search, context | `src/hooks/useAI.js` |
| Tags | `src/hooks/useTagOps.jsx` |
| File metadata + AI suggestions | `src/hooks/useMetadata.js` |
| Data seeding, cache, online sync | `src/hooks/useDataSync.js` |
| Hub tabs (editor, folders, etc.) | `src/components/panels/HubEditorPanel.jsx` |
| Brain tabs (command, projects) | `src/components/panels/BrainTabsPanel.jsx` |
| Colors, styles, constants | `src/utils/constants.js` |
| Health calculation | `src/utils/projectFactory.js` |
| File type detection, ZIP export | `src/utils/fileHandlers.js` |
| Markdown rendering | `src/utils/renderers.js` |
| REL entity graph | `src/entityGraph.js` |
| Trust Ladder config | `src/config/trustLadder.js` |
| Trust Approval UI | `src/components/TrustApprovalPanel.jsx` |
| brain:// URI utilities | `src/uri.js` |
| L0/L1 summary utilities | `src/summaries.js` |
| Mode matrix | `src/modeHelper.js` |
| Workflow execution engine | `src/workflows.js` |
| Recursive directory retrieval | `src/retrieval.js` |
| Memory management | `src/memory.js` |
| Agent registry service | `src/agents.js` |
| Agent function definitions | `src/agentFunctions.js` |
| Trust Ladder API logic | `api/_lib/trustLadder.js` |
| Cost Guard | `api/_lib/costGuard.js` |
| Universal Agent Bridge | `api/_lib/executors/UniversalAgentBridge.js` |
| CLI subprocess adapter | `api/_lib/executors/ClaudeCodeAdapter.js` |
| WebSocket adapter (OpenClaw) | `api/_lib/executors/OpenClawAdapter.js` |
| Agent execution with function calling | `api/agent-execute.js` |
| Trust gate endpoints | `api/trust.js` |
| Agent definitions | `public/agents/system-*.md` |
| Pipeline workflow JSONs | `public/agents/*.json` |
| REL graph tests | `src/__tests__/entityGraph.test.js` |
| Entity graph migration | `src/migrations/0002_rel_foundation.sql` |

### Patterns to follow

**Adding a new hook:**
```javascript
// src/hooks/useNewThing.js
export default function useNewThing(deps) {
  const { x, setX } = deps;
  // ...
  return { doThing };
}
// Wire in TheBrain.jsx: const { doThing } = useNewThing({ x, setX });
// Export from src/hooks/index.js
```

**Adding UI to a tab:**
- Hub tabs → `src/components/panels/HubEditorPanel.jsx`
- Brain tabs → `src/components/panels/BrainTabsPanel.jsx`
- Both receive a single `ctx` prop

**Adding a new API resource:**
- Generic CRUD → add case in `api/data.js`
- Dedicated endpoint → only if you can remove another function, or it fits in `api/_lib/`
- Client wrapper → `src/api.js`

**Adding a new agent:**
- Create `public/agents/system-{name}.md` with YAML frontmatter
- Declare `capabilities`, `permissions`, `model`, `temperature`
- Body = system prompt
- No DB changes needed

**Adding a new pipeline:**
- Create `public/agents/{pipeline-name}.json` with workflow steps
- Each step: `capability`, `sop`, `auto_assign`, optionally `trust_gate: true`
- Seeds automatically on next login via `seedSystemWorkflows()`

**Registering an entity in the REL graph:**
```javascript
import { createNode, realizeNode, linkNodes } from '../src/entityGraph.js';

// Before execution:
await createNode(db, 'brain://project/my-proj/file/output.md', 'file', 'project', null, { title: 'Output' });
await linkNodes(db, 'brain://project/my-proj/file/output.md', 'brain://task/task-123', 'generated_by');

// After execution:
await realizeNode(db, 'brain://project/my-proj/file/output.md', { result: '...' }, sha256checksum);
```

**Build verification:** Always run `npx vite build` after changes. Always run `npm run format` before committing.

---

## v2.2 Architecture Understanding

### Brain OS Layers

```
┌─────────────────────────────────────────────────────────────┐
│  ROUTER — Decides who does what                             │
│  Input: Task description + context                          │
│  Output: {assignee_type, assignee_id, reason}               │
├─────────────────────────────────────────────────────────────┤
│  UNIVERSAL AGENT BRIDGE — Routes execution packages         │
│  Validates policy, selects capable worker, creates REL nodes│
├─────────────────────────────────────────────────────────────┤
│  TRUST LADDER — Gates autonomy                              │
│  T1: every gate reviewed │ T2: batch │ T3: autopilot        │
├─────────────────────────────────────────────────────────────┤
│  REL ENTITY GRAPH — Provenance for everything               │
│  Every entity: knows what created it, what it requires,     │
│  what it enables. Full lineage traceable to root.           │
├─────────────────────────────────────────────────────────────┤
│  COST GUARD — Budget enforcement                            │
│  £15/mo cap, provider fallback, spend analytics             │
└─────────────────────────────────────────────────────────────┘
```

### PR Checklist (enforced via `.github/PULL_REQUEST_TEMPLATE.md`)
Before any PR merges to main:
- [ ] Does this entity know what created it? (`generated_by` relation exists)
- [ ] Does this entity know what it requires? (`depends_on` relations exist)
- [ ] Does this entity know what it enables? (`succeeded_by` relations exist)
- [ ] Can the full lineage of any asset be traced to root?
- [ ] If this entity is deleted, do we know what breaks?
- [ ] Is this workflow gated by Trust Ladder? (All workflows start Tier 1)
- [ ] Is the execution package signed? (`policy_id` present)
- [ ] Are worker capabilities checked before routing?

---

## What You Don't Do

- Don't redesign the UI. Functional changes only.
- Don't introduce new dependencies without stating why and getting approval.
- Don't build features not on the roadmap without explicit permission.
- Don't offer motivational commentary. Be direct, technical, brief.
- Don't assume all users want coaching — respect the mode setting.
- Don't add a new file to `api/` without confirming the function slot count.
- Don't use `DEFAULT` on JSON/TEXT/BLOB columns in migrations.

---

## Session Templates

**Start:**
```
## Session Start

Last completed: [task — description]
Next task: [task — description]
Constraints to note: [Vercel slots, budget, anything else]
Blockers: [none / description]
Ready to proceed?
```

**End:**
```
## Session End

Completed: [task(s)]
brain-status.md updated: ✓
REL graph coverage: [any new entities registered?]
Next task: [task — description]
```

---

_THE BRAIN / SPINE · Agent Brief · v2.2_
