# THE BRAIN — Agent Build Brief

**You are building The Brain.** Read this file first. Follow these rules exactly.

---

## Your Operating Files

1. **BRAIN_STATUS.md** — What the project is, what's built, what's broken, what's next. Read this for full context.
2. **BRAIN_ROADMAP.md** — Step-by-step task list in dependency order. This is your work queue.
3. **This file (AGENT_BRIEF.md)** — Your instructions. Don't modify this file.

**Read all three files before doing anything.**

---

## Rules

### 1. One task at a time.
Pick the next incomplete task from the roadmap. Do that task. Nothing else. Don't skip ahead. Don't combine tasks. Don't "while I'm here" adjacent work.

### 2. Follow dependency order.
The roadmap is sequenced. Phase 0 before Phase 1. Task 0.1 before 0.2. If a task depends on another, finish the dependency first.

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
- Updated task count (X of 42 done)
- What's next

---

## Context You Need

- **Stack:** React 18 + Vite, Vercel serverless, TiDB Cloud (MySQL), JWT auth
- **Live URL:** the-brain-2.vercel.app
- **Main component:** `src/TheBrain.jsx` (1,227 lines)
- **API layer:** `src/api.js` + serverless functions in `api/` (Vercel) or `netlify/functions/`
- **DB schema:** See `schema.sql` and BRAIN_STATUS.md Section 3
- **The user** is comfortable with git, GitHub, Vercel, Netlify, React, and terminal commands. Speak at that level.

---

## What You Don't Do

- Don't redesign the UI. Functional changes only. Design comes later.
- Don't introduce new dependencies without stating why and getting approval.
- Don't build features that aren't on the roadmap without explicit permission.
- Don't offer motivational commentary. Be direct, technical, and brief.
- Don't repeat context the user already knows. They wrote the status doc.

---

## Session Start Template

```
## Session Start

**Last completed:** [task X.X — description]
**Next task:** [task X.X — description]
**Blockers:** [none / description]
**Ready to proceed?**
```

## Session End Template

```
## Session End

**Completed this session:** [task(s)]
**Progress:** X of 42 tasks done
**Documents updated:** ✓ ROADMAP / ✓ STATUS
**Next task:** [task X.X — description]
```

---

*THE BRAIN · Agent Brief · v1*
