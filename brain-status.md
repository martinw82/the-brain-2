************APPEND AND ANNOTATE ALL EDITS************

# THE BRAIN — Master Status Document

**Version:** 6.1 (Pre-Release)
**Live URL:** the-brain-2.vercel.app
**Last Updated:** 2026-03-08
**Status:** Beta — deployed, functional, bugs to fix before daily use

---

## 1. What The Brain Is

The Brain is a personal operating system for organising life. The core philosophy is that **Life** is made up of **Parts** (business, health, relationships, creative work, etc.), Parts are made up of **Things** (projects, habits, tasks, ideas, goals), and Things connect across multiple Parts in overlapping, flexible ways.

It's not a to-do app. It's not a project management tool. It's a flexible structure that can absorb any life system — primarily business-focused but extensible to anything — and steer it through an AI agent-centric interface.

The Brain existed as a concept before the ChatGPT conversation analysis (283 conversations, Aug 2024–Feb 2026). That analysis was folded into The Brain to provide real data, project health scores, behavioural patterns, and strategic intelligence. The analysis didn't create The Brain — it enriched it.

**The evolution path:**
1. Original concept: A project management system (Next.js/Firebase/Genkit — heavy stack)
2. Chat analysis: Revealed portfolio, patterns, and the build-don't-ship loop
3. Rebuild: Lighter stack (React/Vite + serverless + TiDB), agent-centric architecture
4. Current: V6 "Wired Edition" — live with persistence, approaching usable beta

---

## 2. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 5 | Single JSX component (TheBrain.jsx, 1,227 lines) |
| Styling | Inline styles, dark monospace UI | JetBrains Mono / Fira Code |
| API | Vercel serverless functions | Also configured for Netlify Functions |
| Database | TiDB Cloud Serverless (MySQL-compatible) | Free tier, EU-central-1 |
| Auth | JWT + bcrypt | Register/login/sessions |
| AI | Anthropic API (Claude Sonnet) | Called from frontend currently |
| Deployment | Vercel (primary) | Netlify config also present |

---

## 3. Database Schema (8 tables)

- **users** — email, password_hash, name, goal, monthly_target, currency, timezone
- **projects** — slug IDs, phase, priority, health, momentum, revenue_ready, blockers/tags/skills (JSON), active_file
- **project_custom_folders** — per-project folder structure
- **project_files** — LONGTEXT content, full-text search indexed
- **staging** — review pipeline items, tagged, linked to projects
- **ideas** — scored idea bank (1-10)
- **sessions** — work session logging with duration and notes
- **comments** — per-file comments with resolved flag
- **refresh_tokens** — auth token store

---

## 4. What's Built & Working

### Brain-Level Features (10 tabs)
- **Command Centre** — today's focus selector, priority stack, health alerts, income goal progress bar
- **Projects** — full CRUD with optimistic updates + DB persistence
- **Bootstrap** — guided 5-step project setup wizard generating briefs, strategy prompts, dev prompts, skill overrides, agent onboarding docs
- **Staging** — pipeline with tagging (IDEA_, SKETCH_, DRAFT_, etc.), approve/reject/defer
- **Skills** — 5 agent definitions (Dev, Content, Strategy, Design, Research) with SOPs, permissions, ignore rules, prompt prefixes
- **Workflows** — 4 templates (Product Launch, Content Sprint, Idea→Brief, Weekly Review)
- **Integrations** — UI panel for GitHub, Netlify, TiDB, Farcaster, Twitter, Base Chain (UI only — not wired)
- **Ideas** — bank ideas with score and tags
- **AI Coach** — calls Anthropic API with full project context, preset prompts
- **Export** — full JSON context builder, per-agent briefing generator, local file download

### Hub-Level Features (8 tabs per project)
- **Editor** — file tree + markdown editor with edit/preview modes
- **Overview** — status dashboard (phase, health, momentum, income, next action, blockers)
- **Folders** — browse all standard + custom folders with file counts
- **Review** — staging items for this project with drag-and-drop upload
- **Dev Log** — quick-log entries + rendered DEVLOG.md
- **Timeline** — Gantt chart parsed from TASKS.md date format
- **Comments** — per-file comments with resolve/reopen
- **Meta** — manifest.json viewer + folder summary

### Infrastructure
- File operations: create, save, delete, with optimistic UI + DB persistence
- Custom folder creation per project
- Full-text search across all files (DB-backed with in-memory fallback)
- Session timer with duration logging to DEVLOG.md and sessions table
- Health score auto-calculation (decay by days, blockers, momentum, status)
- Toast notifications for save confirmations
- Markdown renderer (headings, bold, code, checkboxes, tables, blockquotes)
- Project export to local file (BUIDL export format)
- Drag & drop files into staging

---

## 5. Known Bugs (Must Fix for Beta)

### Critical
1. **Files don't load from DB on initial render.** The component receives `initialProjects` as props — if App.jsx/api.js doesn't populate `files` when fetching projects, the file tree is empty. This is the most blocking bug.
2. **Comments don't load from DB.** Comments state starts empty (`useState({})`). No `useEffect` fetches existing comments on mount or file switch. Comments persist to DB on creation but vanish on reload.
3. **AI Coach API key exposed client-side.** `askAI()` calls `api.anthropic.com` directly from frontend. Needs a serverless proxy function to keep the key server-side.

### Important
4. **Rename project has stale reference.** Line 431 reads `projects` before `setProjects` has re-rendered, so re-saved files may not reflect the rename.
5. **Import functionality incomplete.** `importText`/`importError` state exists but no import UI or parsing logic was built.
6. **Session timer doesn't auto-save.** Closing the tab mid-session loses data. No `beforeunload` handler.
7. **Bootstrap wizard has no validation on complete.** If `projects.find()` returns undefined, subsequent operations silently fail.

---

## 6. Missing Features (from previous version + new requirements)

These are features that existed in the original Next.js version or are needed for the core philosophy to work. Grouped by priority.

### Tier 1 — Required for core philosophy ("Life > Parts > Things")

**Life Areas ("Parts") as first-class entities.** The core philosophy says Life > Parts > Things, but the data model jumps from users directly to projects. Without Parts (Business, Health, Relationships, Creative, Personal) as real entities, you can't see health per life area, can't do capacity planning across areas, and can't apply different agent rules per area (business = revenue-first, health = consistency-first). This is the most important structural addition.

**Hierarchical / Linked project structure.** The old version had parent/sub-projects. But the real need is even more flexible: Things (projects, tasks, ideas) should be taggable and linkable across multiple Parts (life areas). A flat project list doesn't reflect how life actually works. This is THE key structural feature.

**Project management templates/styles.** The BUIDL framework phases (BOOTSTRAP, UNLEASH, INNOVATE, etc.) should be one optional template among many. Different projects/users need different management styles. Templates could include: BUIDL Framework, Software Development, Content Creation, Marketing Campaign, Health Tracking, Personal Goal, Custom. Users should be able to save existing project structures as custom templates.

**Generic financial goal tracking.** The Thailand £3k/mo tracker is too specific. Replace with a configurable goal system: any currency, any target, any timeframe. Users set their own goal (e.g., "£3,000/mo passive income", "$50k savings", "€1,000/mo freelance"). Projects link to the goal with their contribution amount.

### Tier 2 — Required for usable daily tool

**Image handling.** The old version displayed images inline and handled binary files. V6 is text-only. Need: image viewer in editor pane, proper binary file handling, image preview in file tree.

**Metadata editor panel.** The old version had a dedicated UI for per-file metadata (category, status, tags, timestamps, custom fields). V6 stores metadata in manifest.json but has no visual editor for individual files.

**Project import.** Import from: pasted text (BUIDL export format), local folder selection (File System Access API), JSON upload. The state variables exist — the UI doesn't.

**Offline mode / localStorage fallback.** The old version worked without auth via localStorage. V6 requires DB connection. For a tool you'll use daily (including on phone with bad signal), offline resilience is essential.

**Settings UI.** The old version had theme (light/dark/system), font selection, editor font size, sidebar width. V6 is hardcoded dark mode with no settings.

**Mobile responsive layout.** V6 is desktop-first with no responsive breakpoints. Needs to work on phone for low-energy days (the agent ruleset routes phone-only tasks on those days).

### Tier 3 — Enhances power and intelligence

**AI metadata suggestions.** Old version auto-suggested categories and tags for files based on content and project context. Reintroduce as part of the agent layer.

**Mermaid diagram rendering.** Old version rendered dependency graphs from Mermaid syntax. Useful for visualising project relationships and system architecture.

**Local file system sync.** Connect to a local folder, load from local, save to local. The File System Access API approach from the old version.

**Script execution.** Old version had a `/api/run-script` endpoint for Python/Shell/Node scripts from a `/tools/` folder. Low priority but was a differentiating feature.

**File validity checker.** Structural checks on project files — was a placeholder in the old version but the concept has value.

**Search improvements.** Cross-project search, better result display, search within file content with highlighted excerpts.

### Tier 4 — Future evolution

- Real-time collaboration (CRDTs, multi-user)
- Version history per file with revert
- Visual diff/merge for text files
- Plugin system for extensions
- Full GitHub two-way sync
- Task dependencies and sub-tasks
- Calendar integration
- Advanced AI: content generation, code analysis, image generation

---

## 7. The Agent Layer

The Brain's AI Coach currently has a one-line system prompt. The full agent ruleset has been designed but not yet implemented. Here's what exists and what needs building.

### The 10 Assistant Rules (designed, not yet wired)

1. **Revenue-first priority** — Prioritise tasks that lead to payment/delivery in 14-45 days
2. **One primary objective** — Only one major objective at a time until deliverable
3. **Ship before improve** — Block redesign/polish until working version ships
4. **No new features without purpose** — Require explicit justification for new features
5. **Outreach is mandatory** — Track minimum daily outreach actions
6. **Maintain progress without ideal tools** — Phone-only task set when tools are unavailable
7. **Health gates complexity** — Reduce cognitive load when energy/sleep/gut is unstable
8. **Relationship ambiguity awareness** — Periodic boundary check on environmental stability
9. **Risk budget control** — Checklist for high-risk opportunities (legality, reversibility, etc.)
10. **Weekly reality alignment** — Shipped work, money actions, health baseline, next priorities

### Daily Check-In Protocol (designed, not yet built)
- Morning: sleep hours, energy (0-10), gut symptoms (0-10), laptop available?, training sessions this week
- Output: primary objective, 1-3 matched tasks, stabiliser if needed
- State-based routing: energy ≤4 = low-complexity only, 5-7 = shipping/outreach, 8+ = deep work

### Training as Infrastructure (designed, not yet tracked)
- Training is not optional — it's revenue infrastructure (combat sports → cognitive function → shipping capacity)
- Weekly minimum: 3 × 30-minute solo sessions
- Track correlation: training days vs cognitive performance days
- Drift detection: 2 consecutive missed weeks triggers root-cause analysis

### What needs building for the agent layer
- **Daily check-in fields** — extend sessions table or create new `daily_checkin` table (energy, focus, gut, sleep, training_done)
- **Training log** — date, duration, type, weekly count query
- **Outreach tracking** — daily outreach actions logged
- **Agent system prompt upgrade** — replace one-liner with full structured ruleset
- **Weekly review automation** — query sessions, projects, check-ins and generate summary
- **Drift detection** — background check on training/outreach minimums

---

## 8. Development Workflow

### How we work across chats
1. **This document (`BRAIN_STATUS.md`)** is the single source of truth. Updated after each build session.
2. **Per-feature chats** — one chat per thing being built. Focused, clean, disposable.
3. **Synthesis chats** — periodically bring 3-4 session summaries together for strategic review. Reprioritise, cut, refocus.

### Session handoff protocol
At the end of each build session, update this document with:
- What was completed
- What bugs were found/fixed
- What's next (top 3 priorities)
- Any new parking lot items

---

## 9. Current Priority Stack

### Next 3 Actions (in order)
1. **Fix file loading from DB** — ensure App.jsx/api.js populates project files on fetch. This unblocks everything.
2. **Fix comments loading from DB** — add useEffect to fetch comments on mount/file switch.
3. **Build AI Coach proxy function** — serverless function to keep API key server-side, with rate limiting and caching.

### After that (Phase 0 completion)
4. Fix rename stale reference bug
5. Add `beforeunload` handler for session timer
6. Bootstrap wizard null check
7. Soft deletes on project_files (safety net against data loss)
8. Debounced saves in markdown editor
9. AI proxy rate limiting + cost controls
10. Critical path tests (file round-trip, comments, sessions)

### Then (Phase 1 foundations)
11. **Life Areas** — first-class "Parts" entities (the philosophical foundation)
12. Generic goal system (replace hardcoded Thailand tracker)
13. Template system (BUIDL phases become optional)
14. Tagging and linking system
15. Settings system

### Parking Lot (good ideas, not now)
- Parent/sub-project or tagging/linking system (critical but architecturally significant — needs design first)
- Image handling in editor
- Metadata editor panel
- Mermaid diagram rendering
- Mobile responsive layout
- Offline localStorage fallback
- Settings UI (themes, fonts)
- Local file system sync
- Script execution
- Integration connectors actually working
- Onboarding flow for new users
- Keyboard shortcuts beyond Cmd+K/S/N
- Monaco/CodeMirror editor upgrade (enables proper undo/redo)
- Vector embeddings for semantic search (only when full-text search proves insufficient)
- Push notifications / email digests (only after in-app notifications work)
- Notion/Todoist/Linear importers (only if going multi-user)

---

## 10. Architecture Notes

### What was deliberately dropped from the old version
- **Firebase dependency** — replaced with JWT + TiDB (more portable, no vendor lock)
- **Genkit/Google AI** — replaced with direct Anthropic API calls (simpler, one provider)
- **Next.js/TypeScript** — replaced with React/Vite (faster dev, lighter bundle)
- **ShadCN/Radix/Tailwind** — replaced with inline styles (single-file simplicity)
- **EventBus pattern** — replaced with prop drilling + simple state (appropriate at current scale)

### What should come back
- **Templates** — but lighter, as JSON config not full component trees
- **Metadata system** — but simplified, per-file tags/status/category
- **Offline fallback** — localStorage cache of current state
- **Image handling** — viewer component in editor pane
- **Import/export round-trip** — folder import, JSON import, BUIDL format import

### Key design principles
- **Single-file core** — TheBrain.jsx is the app. Simplicity over architecture.
- **Optimistic updates** — UI updates immediately, DB syncs in background, revert on error.
- **Portable data** — MySQL-compatible DB, standard schema, can switch providers by changing one env var.
- **Agent-first** — the AI coach isn't a bolt-on feature, it's the primary interaction layer.
- **Flexible structure** — the system must accommodate any type of "life thing," not just software projects.
- **Soft deletes** — never hard-delete user content immediately. `deleted_at` timestamps with 30-day retention.
- **Context compression** — AI receives project summaries + recent changes, not raw file dumps. Token budget per call. Summaries cached and regenerated on change.
- **Binary migration path** — images stored as base64 now, but viewer component accepts both base64 and URLs so migration to object storage (S3/R2) is non-breaking.

---

*THE BRAIN v6 · Wired Edition · Bootstrap → Freedom*
*************APPEND AND ANNOTATE ALL EDITS***************
Last edited 08/03/26 14:51
*THE BRAIN v6 · Wired Edition · Bootstrap → Freedom*
