# AGENTS.md — Critical Architecture Notes

**Last Updated:** 2026-03-28

This file contains critical architectural details that AI agents working on this codebase MUST know.

---

## 🔐 JWT Token Structure

When decoding a JWT token from `Authorization: Bearer <token>` header:

```javascript
// The JWT payload contains:
{
  userId: string,      // User ID (NOT "id"!)
  email: string,       // User email
  iat: number,         // Issued at timestamp
  exp: number          // Expiration timestamp
}
```

**⚠️ CRITICAL:** Always use `user.userId`, NEVER `user.id`.

### Correct Usage
```javascript
const user = getAuth(req);
const userId = user.userId;  // ✅ Correct
const userId = user.id;      // ❌ Wrong - undefined!
```

### Where This Matters
- All API endpoints in `api/*.js` files
- Database queries filtering by user
- Row-level security checks

---

## 🗄️ Database Conventions

### TiDB/MySQL Strict Mode
- TiDB runs in strict mode
- **NO DEFAULT values on JSON, TEXT, or BLOB columns**
- Handle defaults in application code

### Common Tables
| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, email, settings) |
| `projects` | Projects (id, user_id, name, files) |
| `project_files` | File contents (project_id, path, content) |
| `workflow_templates` | Workflow definitions |
| `workflow_instances` | Running workflows |
| `tasks` | Task queue (assignee_type: 'human' \| 'agent') |
| `worker_connections` | Desktop workers |
| `job_queue` | Jobs for worker execution |

---

## 🏗️ API Structure

### Vercel Functions (9/12 slots used)
Located in `api/*.js`. Each file = 1 function slot.

| File | Purpose |
|------|---------|
| `auth.js` | Login/register/me |
| `data.js` | Main data router (delegates to handlers) |
| `ai.js` | AI provider proxy |
| `agent-execute.js` | Agent execution with tools |
| `integrations.js` | GitHub/Netlify/etc |
| `projects.js` | Project file operations |
| `trust.js` | Trust gates |
| `worker.js` | Desktop worker management |
| `workflow-job.js` | Job queue for workers |

### Handler Modules
In `api/_lib/handlers/` - imported by `data.js`, don't count as separate functions.

---

## 🎬 Worker System Architecture

### Desktop Worker (`packages/spine-worker/`)
- Connects via SSE (Server-Sent Events) or polling
- Executes jobs locally (Remotion, shell commands)
- Registers capabilities: `video.render`, `shell`, etc.

### Job Flow
```
Workflow Step (worker_required: true)
    ↓
Queue job in job_queue table
    ↓
Worker polls/SSE receives job
    ↓
Worker executes (e.g., npx remotion render)
    ↓
Worker uploads result to R2
    ↓
Worker reports completion
    ↓
Workflow advances
```

### Required Worker Capability Flags
- `video.render` — Can run Remotion
- `shell` — Can execute shell commands
- `ffmpeg` — Has FFmpeg installed

---

## 🎥 Video Production Pipeline

### Workflows
| ID | Purpose |
|----|---------|
| `quick-video-render` | 10s test video (no research) |
| `video-auto-pipeline` | Full YouTube pipeline |

### Key Steps
1. **Research** — AI finds topic, validates search volume
2. **Script** — AI writes 4-6 segment script
3. **Script Review** ⛔ — Human approval gate
4. **Storyboard** — AI generates Remotion JSON
5. **Storyboard Review** ⛔ — Human approval gate
6. **Render** 🎬 — **Worker renders video locally**
7. **Assessment** — AI scores video 0-10
8. **Pre-Upload Review** ⛔ — Human watches & approves

⛔ = Trust gate (requires approval)

---

## 🔌 Frontend Architecture

### State Management
- `TheBrain.jsx` — Main orchestrator (~4000 lines)
- `UserContext` — User, userSettings, currentMode
- Hooks in `src/hooks/` — Business logic
- Panels in `src/components/panels/` — Tab UI

### Mode-Aware Features
Three assistance modes from `settings.assistance_mode`:
- `coach` — Mandatory check-ins, interruptive
- `assistant` — On-demand, preview mode
- `silent` — Minimal, no notifications

Check mode: `const currentMode = getMode(userSettings);`

---

## 🧪 Testing Endpoints

### Quick Test API
```bash
# Test video rendering
POST /api/quick-test?action=video-render
Body: { "project_id": "..." }
```

### Worker Status
```bash
GET /api/worker?action=status
```

---

## ⚠️ Common Mistakes to Avoid

1. **Using `user.id` instead of `user.userId`** — See JWT section above
2. **Assuming Vercel supports WebSockets** — Use SSE or polling instead
3. **Adding DEFAULT to JSON columns** — TiDB rejects this
4. **Creating new api/*.js files** — Only 12 function slots available
5. **Forgetting to apply migrations** — Always run SQL migrations on TiDB

---

## 📚 Key Files to Read

| File | Why |
|------|-----|
| `api/auth.js` | JWT structure, auth patterns |
| `schema.sql` | Database schema |
| `brain-status.md` | Current project status |
| `agent-brief.md` | Operating rules |
| `src/api.js` | Frontend API client |

---

*Remember: When in doubt, check the source code. Never assume.*
