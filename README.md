# The Brain — Personal Operating System v2.0

**Agent Orchestration Platform with Adaptive Coaching**

**Status:** v2.0 COMPLETE ✅  
**Live URL:** the-brain-2.vercel.app  
**Last Updated:** 2026-03-15

---

## What The Brain Is

The Brain is a **personal operating system** that helps users organize their lives through:

- **Project Management** — Phases, health scores, momentum tracking, templates
- **Life Areas** — Health, business, relationships, creative, personal with health scoring
- **Goal Tracking** — Configurable financial/personal goals with contributions
- **AI Coaching** — Multi-provider AI (Anthropic, Moonshot, DeepSeek, Mistral, OpenAI) with state-based routing
- **Daily Tracking** — Check-ins, training logs, outreach enforcement, weekly reviews
- **Agent Orchestration** — Task delegation, workflow execution, file-based agents

### Three Assistance Modes (v2.0)

| Mode          | For             | Behavior                                                   |
| ------------- | --------------- | ---------------------------------------------------------- |
| **Coach**     | Building habits | Mandatory check-ins, drift alerts, proactive task creation |
| **Assistant** | In flow         | Available on-demand, auto-assigns with preview             |
| **Silent**    | Power users     | Manual only, minimal AI, preview mode for agents           |

---

## Tech Stack

| Layer    | Technology                                 |
| -------- | ------------------------------------------ |
| Frontend | React 18 + Vite (single-file ~5,800 lines) |
| Styling  | Inline dark monospace UI                   |
| API      | Vercel serverless functions                |
| Database | TiDB Cloud Serverless (32 tables)          |
| Auth     | JWT + bcrypt                               |
| AI       | Multi-provider proxy                       |

---

## Features

### Core Features

- Project management with phases, health scores, momentum
- Hierarchical file system with markdown editing
- Life Areas ("Parts") with health tracking
- Goal tracking with contributions
- Tagging & cross-entity linking
- Session timer with work logging

### Daily Operations

- Daily check-ins (sleep, energy, gut, training)
- Training log with weekly targets
- Outreach tracking with mandatory minimum
- Weekly reviews with AI analysis
- Drift detection with 5 pattern alerts

### v2.0 Orchestration

- URI-based resource addressing (`brain://project/{id}`)
- L0/L1/L2 hierarchical file summaries
- File-based agent registry (5 system agents)
- Universal task queue with delegation
- Workflow execution engine
- Agent task execution with function calling
- Adaptive assistance modes
- Memory self-iteration
- Community workflows
- External integrations (GitHub, Calendar, Email)

---

## Development

### Prerequisites

- Node.js 24.x
- MySQL-compatible database (TiDB Cloud recommended)

### Setup

```bash
npm install
npm run db:setup
npm run db:migrate
npm run dev
```

### Scripts

| Command               | Description              |
| --------------------- | ------------------------ |
| `npm run dev`         | Start development server |
| `npm run build`       | Build for production     |
| `npm run lint`        | Run ESLint               |
| `npm run test`        | Run Jest unit tests      |
| `npm run cypress:run` | Run Cypress e2e tests    |

---

## Project Structure

```
/
├── src/
│   ├── TheBrain.jsx      # Main application (~5,800 lines)
│   ├── api.js            # Client API wrapper
│   ├── agents.js         # Agent registry service
│   ├── summaries.js      # L0/L1 summary utilities
│   ├── workflows.js      # Workflow execution engine
│   ├── modeHelper.js     # Mode-aware behavior
│   └── ...
├── api/
│   ├── ai.js             # Multi-provider AI proxy
│   ├── data.js           # Generic CRUD endpoints
│   ├── projects.js       # Project operations
│   └── agent-execute.js  # Agent task execution
├── agents/
│   ├── system-dev.md     # Dev agent
│   ├── system-content.md # Content agent
│   ├── system-strategy.md
│   ├── system-design.md
│   └── system-research.md
└── scripts/
    └── migrate.js        # Database migrations
```

---

## Documentation

| File                  | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `README.md`           | This file — quick reference               |
| `brain-status.md`     | Master status — what's built, what's next |
| `brain-roadmap.md`    | Detailed step-by-step roadmap             |
| `schema-reference.md` | Database schema reference                 |
| `agent-brief.md`      | Operating rules for AI agents             |
| `dev-log.md`          | Session-by-session development log        |

---

## API Resources

Core resources via `/api/data?resource=`:

- `projects`, `files`, `folders`
- `life-areas`, `goals`, `contributions`
- `tasks`, `workflows`, `workflow-instances`
- `daily-checkins`, `training-logs`, `outreach`
- `memories`, `community-workflows`, `integrations`
- `file-summaries`, `mode-suggestions`, `auto-tasks`

---

## Deployment

Deploy to Vercel with the included `vercel.json` configuration.

---

_THE BRAIN v2.0 — From Coach to Orchestrator_
