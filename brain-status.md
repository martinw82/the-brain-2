************APPEND AND ANNOTATE ALL EDITS************

# THE BRAIN — Master Status Document v2.0
**Agent Orchestration Platform with Adaptive Coaching**

**Version:** 8.2 → **v2.0 Vision**  
**Live URL:** the-brain-2.vercel.app  
**Last Updated:** 2026-03-15 (Session 046)  
**Status:** v1.0 Complete (Phases 0-4) | v2.0 In Progress (Phases 5.1, 5.4 Complete)

---

## 1. What The Brain Is

### v1.0: Personal Operating System (CURRENT)
The Brain is a personal operating system for organising life. The core philosophy is that **Life** is made up of **Parts** (business, health, relationships, creative work, etc.), Parts are made up of **Things** (projects, habits, tasks, ideas, goals), and Things connect across multiple Parts in overlapping, flexible ways.

### v2.0: Agent Orchestration Platform (VISION)
The Brain evolves into an **adaptive intelligence system** that:
1. **Guides Project Setup** — AI-guided creation with intelligent structure
2. **Delegates Work** — Assigns tasks to humans, agents, or tools
3. **Manages Workflows** — Executes multi-step processes with tracking
4. **Adapts to You** — Three modes (Coach/Assistant/Silent) for different needs

**Key Philosophy:** *The system becomes what you need — from drill sergeant to silent tool — while the orchestration engine works consistently behind the scenes.*

### Evolution Path
1. **Original concept:** Project management (Next.js/Firebase/Genkit)
2. **Chat analysis:** Revealed portfolio, patterns, build-don't-ship loop
3. **v1.0 Rebuild:** React/Vite + serverless + TiDB, agent-centric architecture
4. **v1.0 Shipped:** Phases 0-4 complete, full persistence, responsive, 21 tables
5. **v2.0 Vision:** Agent orchestration, adaptive modes, Open Viking integration

---

## 2. v1.0 Tech Stack (CURRENT)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite 5 | Single JSX component (~1,525 lines) |
| Styling | Inline styles, dark monospace UI | JetBrains Mono / Fira Code |
| API | Vercel serverless functions | `api/ai.js`, `api/auth.js`, `api/data.js`, `api/projects.js` |
| Database | TiDB Cloud Serverless (MySQL) | Free tier, EU-central-1, 21 tables |
| Auth | JWT + bcrypt | Register/login/sessions |
| AI | Multi-provider proxy | Anthropic, Moonshot, DeepSeek, Mistral, OpenAI |
| Migrations | `scripts/migrate.js` | Versioned schema migrations |
| Deployment | Vercel (primary) | Netlify config also present |

---

## 3. Database Schema v1.0 (21 tables)

### Core (original)
- **users** — email, password_hash, name, goal, monthly_target, currency, timezone, `settings` JSON
- **projects** — slug IDs, phase, priority, health, momentum, revenue_ready, blockers/tags/skills, active_file, `life_area_id` FK
- **project_custom_folders** — per-project folder structure
- **project_files** — LONGTEXT content, full-text search indexed, `deleted_at` for soft deletes
- **staging** — review pipeline items, tagged, linked to projects
- **ideas** — scored idea bank (1-10)
- **sessions** — work session logging with duration and notes
- **comments** — per-file comments with resolved flag
- **refresh_tokens** — auth token store

### Phase 1 Foundations
- **schema_migrations** — versioned migration tracking (v1–v12)
- **life_areas** — "Parts" entities with health_score
- **goals** / **goal_contributions** — configurable financial/personal goals
- **tags** / **entity_tags** / **entity_links** — cross-entity relationships
- **templates** — project structure templates with JSON config

### Phase 2-4 Features
- **file_metadata** — per-file category, status, custom fields
- **sync_state** / **sync_file_state** — desktop folder sync
- **daily_checkins** — sleep, energy, gut, training tracking
- **training_logs** — training sessions with type/duration
- **outreach_log** — outreach actions tracking
- **weekly_reviews** — weekly snapshots with AI analysis
- **notifications** — in-app notification system
- **project_integrations** — GitHub PAT, repo status

### v2.0 Infrastructure (Partial)
- **tasks** — universal task queue with assignee types (human/agent/integration) ✅
- **file_summaries** — L0/L1 hierarchical summaries, auto-generated on save ✅
- **agents** — file-based agent definitions in `/agents/*.md` ✅

### v2.0 Planned
- **workflow_instances** — executable workflow tracking (Phase 5.5)
- **memories** — auto-extracted patterns (Phase 7.4)

---

## 4. What's Built & Working (v1.0)

### Brain-Level Features (11 tabs)
- **Command Centre** — today's focus, priority stack, health alerts, goal progress, life area filters
- **Projects** — full CRUD with optimistic updates, templates, area assignment
- **Bootstrap** — 5-step guided wizard with agent brief generation
- **Staging** — pipeline with tagging (IDEA_, SKETCH_, DRAFT_), approve/reject/defer
- **Skills** — 5 agent definitions (Dev, Content, Strategy, Design, Research) with SOPs
- **Workflows** — 4 templates (Product Launch, Content Sprint, Idea→Brief, Weekly Review)
- **Integrations** — GitHub repo status, commits, connect/disconnect
- **Ideas** — bank ideas with score and tags
- **AI Coach** — Multi-provider proxy, 10 rules, state-based routing (Recovery/Steady/Power)
- **Export** — full JSON context, per-agent briefings, local download
- **Notifications** — bell icon with badge, triggered alerts

### Hub-Level Features (8 tabs per project)
- **Editor** — file tree + markdown editor with debounced auto-save
- **Overview** — status dashboard (phase, health, momentum, next action)
- **Folders** — browse standard + custom folders
- **Review** — staging items for this project
- **Dev Log** — quick-log entries + rendered DEVLOG.md
- **Timeline** — Gantt chart from TASKS.md
- **Comments** — per-file comments with resolve/reopen
- **Meta** — manifest.json, health check, folder sync, script runner

### Daily Tracking
- **Daily Check-in** — Sleep/energy/gut sliders, training checkbox
- **Training Log** — Weekly targets (3×30min), energy correlation
- **Outreach Tracking** — Mandatory minimum enforcement
- **Weekly Reviews** — Auto-aggregated stats + AI analysis
- **Drift Detection** — 5 pattern alerts (training deficit, outreach gap, etc.)

### Infrastructure
- Offline mode with localStorage fallback
- Desktop file sync (File System Access API)
- Search with Cmd+K, filters, highlighting
- Import/Export (BUIDL, JSON, folder)
- Mobile responsive (breakpoints, drawers, touch targets)
- Onboarding wizard (4 steps + tour)

---

## 5. v2.0 Vision: Agent Orchestration

### The Problem v2.0 Solves
**v1.0:** AI Coach gives advice, human executes everything  
**v2.0:** AI Orchestrator assigns work, tracks execution, adapts to user mode

### Three Assistance Modes

| Mode | For Who | Coaching | Delegation | UI Density |
|------|---------|----------|------------|------------|
| **Coach** | Users building habits, need accountability | Mandatory check-ins, drift alerts, "truth over comfort" | AI suggests, human decides | High — alerts, warnings, nudges |
| **Assistant** | Users in flow, just need efficiency | Available on-demand, no prompts | AI auto-assigns with preview | Medium — proactive suggestions |
| **Silent** | Power users who know what they want | Off entirely | Manual trigger only | Low — raw data, minimal AI |

### Mode Examples

**Same Task: "Create landing page"**

| Coach Mode | Assistant Mode | Silent Mode |
|------------|----------------|-------------|
| "You haven't shipped in 3 days. Let's break this down." | "Creating 3 tasks: design mockup (→ Design Agent), copy draft (→ Content Agent), implementation (→ Dev Agent). Preview?" | [User manually creates tasks] |
| Forces check-in first | Shows preview before execution | No interference |

### Open Viking Integration

| Pattern | Implementation | Benefit |
|---------|----------------|---------|
| **URI Scheme** | `brain://project/{id}/file/{path}` | Precise resource addressing |
| **L0/L1/L2 Context** | Auto-generated summaries | Efficient AI retrieval, lower costs |
| **Recursive Retrieval** | Directory exploration vs flat search | Better context understanding |
| **Retrieval Traces** | Visualize what AI considered | Trust, debugging |

### v2.0 Feature Pipeline

**Phase 5: Agent Orchestration Foundation**
- URI scheme & resource addressing
- Hierarchical context (L0/L1/L2)
- Agent registry with capabilities
- Task delegation system
- Workflow execution engine
- Agent task execution (function calling)

**Phase 6: Adaptive Assistance Modes**
- Mode system (Coach/Assistant/Silent)
- Mode-aware UI and AI prompts
- Smart mode suggestions

**Phase 7: Intelligence & Evolution**
- Recursive directory retrieval
- Workflow learning from patterns
- Auto task creation from DEVLOGs
- Memory self-iteration

**Phase 8: Ecosystem & Scale**
- Community workflows
- Advanced integrations (calendar, email, Slack)
- Performance optimizations
- Security hardening

---

## 6. Known Issues

### Critical (Must Fix for v1.0 Stability)
All Phase 0 bugs **FIXED** as of 2026-03-08.

### Important
1. **0.9 AI Rate Limiting — PARTIAL**
   - ✅ Rate limit: 10 calls/min
   - ❌ Prompt caching
   - ✅ Token logging to `ai_usage` table

2. **Phase 0.5 Critical Tests — NOT STARTED**
   - File save/load round-trip
   - Comment persistence
   - Session logging

3. **Soft Delete Cleanup — NOT IMPLEMENTED**
   - No "Recently Deleted" UI yet
   - No 30-day auto-cleanup

---

## 7. Agent Layer Evolution

### v1.0: AI Coach (CURRENT)
```json
{
  "identity": "Direct accountability partner...",
  "rules": ["Ship or it doesn't exist", "Outreach is non-negotiable", ...],
  "state_routing": {"Recovery": "...", "Steady": "...", "Power": "..."}
}
```
- 10 enforcement rules
- State-based task routing (Recovery/Steady/Power)
- Full context from DB (check-ins, training, outreach, projects)

### v2.0: Orchestrator
```json
{
  "identity": "Mode-dependent...",
  "coach": { "rules": [...], "proactive": true, "tone": "challenging" },
  "assistant": { "rules": [...], "proactive": true, "tone": "supportive" },
  "silent": { "rules": [], "proactive": false, "tone": "minimal" },
  "orchestration": {
    "can_delegate": true,
    "can_execute_workflows": true,
    "can_create_tasks": true
  }
}
```
- Mode-aware personality
- Task delegation to agents/humans/integrations
- Workflow execution with step tracking
- Function calling for file operations

---

## 8. Development Workflow

### How we work across chats
1. **BRAIN_STATUS.md** — Single source of truth (this document)
2. **BRAIN_ROADMAP.md** — Step-by-step task list
3. **AGENT_BRIEF.md** — Operating rules for agents
4. **Per-feature chats** — One chat per feature, focused, disposable
5. **Synthesis chats** — Strategic review across features

### Session Handoff Protocol
At the end of each session, update this document with:
- What was completed
- Bugs found/fixed
- Next 3 priorities
- New parking lot items

---

## 9. Current Priority Stack

### ✅ COMPLETED (v1.0)
All Phases 0, 1, 2, 3, 4 complete as of 2026-03-12.

### 🔄 IN PROGRESS / HARDENING
1. **0.9 AI caching** — Prompt hash caching (5-min window)
2. **Phase 0.5** — Critical path tests

### ✅ COMPLETED (v2.0 Phase 5.1 + 5.4)
- **Phase 5.1 — URI Scheme** (2026-03-14)
  - `src/uri.js` utility with 12 functions
  - AI context builder includes URIs for projects/goals
  - Clickable URI links in AI responses
  - Cmd/Ctrl+Click navigation to projects/files

- **Phase 5.4 — Task Delegation System** (2026-03-14)
  - `tasks` table with 16 columns (assignee, status, priority, context_uri, etc.)
  - Full CRUD API endpoints with actions (start, complete, block, assign)
  - Client API wrapper with 8 methods
  - "My Tasks" card in Command Centre
  - Task creation modal with project/priority selection
  - Complete/delete task functionality

### 📋 v2.0 NEXT UP
1. **Phase 5.2** — Hierarchical Context (L0/L1/L2 summaries)
2. **Phase 5.3** — Agent Registry
3. **Phase 6.1** — Mode System

### 📦 v2.0 PARKING LOT
See BRAIN_ROADMAP.md Phases 5-8 for full pipeline.

---

## 10. Architecture Principles

### v1.0 Principles (Proven)
- **Single-file core** — TheBrain.jsx is the app
- **Optimistic updates** — UI updates immediately, DB syncs background
- **Portable data** — MySQL-compatible, standard schema
- **Agent-first** — AI isn't bolt-on, it's primary interaction
- **Flexible structure** — Accommodates any "life thing"
- **Soft deletes** — Never hard-delete immediately

### v2.0 Principles (Adding)
- **Mode is behavioral config** — Same code, different behavior
- **Orchestration works consistently** — Independent of mode
- **Explainable AI** — Retrieval traces, assignment reasons
- **Human override always** — AI suggests, human decides
- **Start simple, measure, iterate** — No premature optimization

---

## 11. Success Metrics

### v1.0 Success (ACHIEVED)
- ✅ Daily active users (self)
- ✅ All features survive reload
- ✅ Mobile usable
- ✅ Multi-provider AI works

### v2.0 Targets
- Tasks created per week > 10 per active user
- Agent task completion rate > 60%
- Workflow instances completed > 5 per project
- Mode switching used by > 30% of users
- Auto-created tasks accepted > 40% of time

---

*THE BRAIN v1.0 — Wired Edition (COMPLETE)*  
*THE BRAIN v2.0 — Orchestrator Edition (PLANNED)*

*************APPEND AND ANNOTATE ALL EDITS***************

---
**Edit 2026-03-14 (Roadmap v2.0 Update):**
- Document renamed to v2.0 status
- Added "Agent Orchestration Platform" vision
- Documented three assistance modes (Coach/Assistant/Silent)
- Added Open Viking integration patterns
- Mapped v2.0 feature pipeline (Phases 5-8)
- Added v2.0 database tables to planned schema
- Updated Agent Layer Evolution section
- Added v2.0 success metrics
- Next: Phase 5.1 (URI Scheme), 5.4 (Task Schema), 6.1 (Mode System)
