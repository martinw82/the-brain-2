I'll read through the uploaded context file and then explore the GitHub repository to create a comprehensive user guide for The Brain v2.0.
Based on my comprehensive analysis of all the documentation files from the repository, I can now create a complete fool-proof user guide for The Brain v2.0. Let me compile this comprehensive guide:

---

# THE BRAIN v2.0 — COMPLETE USER GUIDE
## Fool-Proof Usage & Testing Manual

**Version:** v2.0 COMPLETE ✅  
**Last Updated:** 2026-03-18  
**Live URL:** https://the-brain-2.vercel.app

---

## TABLE OF CONTENTS

1. [Prerequisites & Installation](#1-prerequisites--installation)
2. [First-Time Setup & Onboarding](#2-first-time-setup--onboarding)
3. [System Overview: Two Views](#3-system-overview-two-views)
4. [BRAIN View: Complete Guide](#4-brain-view-complete-guide)
5. [HUB View: Complete Guide](#5-hub-view-complete-guide)
6. [Daily Operations](#6-daily-operations)
7. [AI Coaching & Modes](#7-ai-coaching--modes)
8. [Agents & Workflows](#8-agents--workflows)
9. [Project Pipelines (v2.2)](#9-project-pipelines-v22)
10. [Testing & Verification](#10-testing--verification)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. PREREQUISITES & INSTALLATION

### 1.1 System Requirements

| Component | Requirement |
|-----------|-------------|
| **Node.js** | v24.x LTS |
| **Package Manager** | npm 10+ or yarn 1.22+ |
| **Database** | TiDB Cloud account (free tier) |
| **AI Provider** | Anthropic (Claude) recommended |
| **Git** | 2.40+ |
| **Browser** | Chrome/Edge/Firefox/Safari (latest) |

### 1.2 Environment Variables

Create `.env` from `.env.example` :

```bash
# Database (TiDB Cloud)
DB_HOST=your-cluster.tidbcloud.com
DB_PORT=4000
DB_USER=your-user
DB_PASSWORD=your-password
DB_NAME=the_brain

# Auth
JWT_SECRET=your-256-bit-secret-here

# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
MOONSHOT_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
OPENAI_API_KEY=sk-...
```

### 1.3 Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/martinw82/the-brain-2.git
cd the-brain-2

# 2. Install dependencies
npm install

# 3. Setup database (creates 32 tables)
npm run db:setup

# 4. Run migrations
npm run db:migrate

# 5. Start development server
npm run dev
# App opens at http://localhost:5173

# 6. Verify build works
npm run build
```

**Verification:** Open browser → see login screen → proceed to registration .

---

## 2. FIRST-TIME SETUP & ONBOARDING

### 2.1 Registration

1. Click **"Create Account"**
2. Enter: Email, Password, Name
3. Select default **Assistance Mode**:
   - **Coach:** Building habits, needs accountability
   - **Assistant:** In flow, needs efficiency
   - **Silent:** Power user, minimal interference
4. System auto-creates 5 Life Areas (Health, Business, Relationships, Creative, Personal)

### 2.2 Onboarding Wizard (4 Steps)

Step 1: **Life Areas** — Review default areas or customize  
Step 2: **First Goal** — Set financial/personal target  
Step 3: **AI Provider** — Configure API key (optional, can use server default)  
Step 4: **Tour** — Interactive guided tour of BRAIN and HUB views 

### 2.3 Create First Project

1. Navigate to **BRAIN → Projects** tab
2. Click **"New Project"**
3. Configure:
   - **Name:** My First Project
   - **Phase:** BOOTSTRAP / UNLEASH / INNOVATE / DECENTRALIZE / LEARN / SHIP
   - **Life Area:** Assign to one of 5 areas
   - **Template:** Choose from 6 system templates or start blank
4. Click **Create** → System generates folder structure automatically 

---

## 3. SYSTEM OVERVIEW: TWO VIEWS

The Brain operates in **two distinct views** :

### 3.1 BRAIN View (Dashboard/Overview)
**Purpose:** System-wide navigation, planning, orchestration  
**Entry:** Left sidebar → "BRAIN" button

**Tabs:**
- **Command:** Dashboard, health alerts, drift detection
- **Projects:** All projects grid with filters
- **Staging:** Intake pipeline for raw ideas
- **Ideas:** Quick capture bank with scoring
- **Goals:** Financial/personal goal tracking
- **Skills:** Agent registry and capabilities
- **Tags:** Cross-entity tagging system

### 3.2 HUB View (Project Workspace)
**Purpose:** Deep work on specific projects  
**Entry:** Click any project card in Projects tab

**Tabs:**
- **Editor:** File tree + markdown editor with live preview
- **Overview:** Project manifest, health score, momentum
- **Folders:** Standard + custom folder management
- **Review:** Staged review workflow
- **Dev Log:** Quick session logging
- **Timeline:** Gantt chart visualization
- **Comments:** Per-file threaded discussions
- **Meta:** File summaries, metadata, AI suggestions

**Switch Views:** Click **"BRAIN"** or **"HUB"** in left sidebar 

---

## 4. BRAIN VIEW: COMPLETE GUIDE

### 4.1 Command Tab — System Dashboard 

**Purpose:** High-level operating system status

**Features:**
- **Area Summary Cards:** Life areas with health scores (0-100)
  - Click any area to filter projects
  - Red warning (🚨) if health < 50
- **Drift Alerts** (Coach mode only):
  - 🥋 Training deficit (3+ days without training)
  - 📣 Outreach gap (no outreach this week)
  - 🌙 Energy decline (trending down)
  - ⏱️ Session gap (5+ days without work)
  - 📉 General momentum loss
- **Goal Progress:** Visual progress bars with contributions
- **Quick Actions:** Daily check-in, start session

**Mode-Aware Behavior:**
- **Coach:** Interruptive popups for drift alerts
- **Assistant:** Badge-only notifications
- **Silent:** No alerts displayed

### 4.2 Projects Tab — Project Management 

**Grid View:** Emoji + Name + Phase + Health bar

**Actions:**
- **Click:** Open in HUB view
- **Right-click:** Context menu with:
  - Export as .zip
  - Import from JSON/BUIDL
  - Bootstrap with template
  - Delete (soft delete)

**Filters:**
- By Life Area (click area in Command tab)
- By Phase
- By Health Score
- Sort: Priority / Last Touched / Health

**Create Project:**
1. Click **"New Project"**
2. Fill: Name, Emoji, Phase, Description, Life Area
3. Select Template (optional)
4. Set Income Target (optional)
5. System creates PROJECT_OVERVIEW.md + 13 default folders 

### 4.3 Staging Tab — Intake Pipeline 

**Purpose:** Inbox for raw files/ideas before filing

**Item Tags:**
- `IDEA_` — Raw concept
- `SKETCH_` — Rough draft
- `RND_` — Research notes
- `REWRITE_` — Needs revision
- `PROMPT_` — AI prompts
- `FINAL_` — Ready to publish
- `DRAFT_` — Work in progress
- `CODE_` — Code snippets

**Status Flow:**
`in-review` → `approved` / `rejected` / `deferred`

**Actions:**
- Move to project folder (drag-and-drop)
- Edit notes
- Change tag
- Approve/Reject/Defer

### 4.4 Ideas Tab — Quick Capture 

**Features:**
- **Quick Add:** Type at top, press Enter
- **Scoring:** 1-10 scale (default 5)
- **Tagging:** Assign multiple tags
- **Search:** Filter by tag or text

**Usage:** Brainstorm without project commitment

### 4.5 Goals Tab — Financial Tracking 

**Goal Types:** Income / Savings / Debt / Custom

**Fields:**
- Target Amount + Currency (GBP/USD/EUR/etc.)
- Timeframe: Monthly / Yearly / Total
- Category assignment

**Contributions:**
- Link income from specific projects
- Auto-aggregates toward target
- Weekly summary on Command dashboard

### 4.6 Skills & Workflows Tab — Agent Management 

**Agent Registry:**

| Agent | Icon | Capabilities | Model |
|-------|------|--------------|-------|
| Dev Agent | 🛠 | code.write, code.review, code.debug, code.test, code.deploy | Claude Sonnet 4.6 |
| Content Agent | ✍️ | content.write, content.edit, content.social, content.email | Claude Sonnet 4.6 |
| Strategy Agent | 📊 | strategy.plan, strategy.research, strategy.analyze | Claude Sonnet 4.6 |
| Design Agent | 🎨 | design.ui, design.assets, design.brand | Claude Sonnet 4.6 |
| Research Agent | 🔍 | research.market, research.tech, research.competitor | Claude Sonnet 4.6 |
| Outreach Agent | 📣 | outreach.find, outreach.write, outreach.track | Claude Sonnet 4.6 |
| Finance Agent | 💰 | finance.analyze, finance.price, finance.report | Claude Sonnet 4.6 |

**System Workflows (7 total):**
1. **Product Launch** (7 steps) — Build → Security → Assets → Copy → Deploy → Announce → Monitor
2. **Content Sprint** (5 steps) — Angle → Draft → Assets → Review → Publish
3. **Idea → Brief** (6 steps) — Capture → Validate → Research → MVP Scope → Dev Brief → Wireframes
4. **Weekly Review** (6 steps) — Health Check → Staging Review → AI Analysis → Dev Logs → Set Focus → Build Post
5. **Security Audit** (5 steps) — Dependencies → Env Vars → Input Validation → Auth Review → Report
6. **Outreach Sprint** (4 steps) — Find Leads → Draft Messages → Human Review → Log & Track
7. **Revenue Check** (4 steps) — Finance Snapshot → Pricing Review → Revenue Priorities → Human Review

**Starting a Workflow:**
1. Open any project (HUB view)
2. Go to **BRAIN → Skills & Workflows**
3. Select workflow template
4. Click **"Start"**
5. Monitor progress in Workflow Runner

**Trust Approval Panel:**
- Shows pending gates by project + workflow
- Approve/Reject/Modify with notes
- Auto-advances workflow on approval 

### 4.7 Tags Tab — Cross-Entity Tagging 

**Features:**
- Tag Library: All tags with color + category
- Tag Stats: Count of tagged entities
- Create New: Custom tag with color picker
- Categories: Area / Skill / Status / Custom

---

## 5. HUB VIEW: COMPLETE GUIDE

### 5.1 Editor Tab — File Work 

**Layout:** File Tree (left) | Editor (center) | Preview (right)

**File Tree:**
- Expand/collapse folders
- Right-click: New file, New folder, Rename, Delete, Move
- Drag-and-drop file organization

**Editor Features:**
- **Markdown editing** with syntax highlighting
- **Live preview** with rendered markdown
- **Mermaid diagrams** (Phase 3.2)
- **Auto-save** (2-second debounce)
- **Manual save:** Ctrl+S / Cmd+S
- **Undo/Redo:** Ctrl+Z / Ctrl+Shift+Z
- **Comments:** Inline file comments (click comment icon)

**Supported File Types:**
- Markdown (.md)
- JSON (.json)
- JavaScript (.js)
- Text files
- Images (viewer with zoom)
- Audio/Video (inline players)
- Binary files (hex viewer)

**L0/L1 Summaries:**
- Auto-generated on file save
- L0: ~100 tokens (essence for search)
- L1: ~2,000 tokens (structure + concepts)
- View in Meta tab 

### 5.2 Overview Tab — Project Status 

**Manifest Display:**
- Project name + emoji + phase + status
- Health score breakdown:
  - File count health
  - Last updated timestamp
  - Momentum (1-10)
  - Blockers count
- Life area assignment
- Income target progress
- Revenue ready status (yes/no)

**Quick Stats:**
- Total files
- Last touched date
- Momentum rating
- Blockers list (editable JSON array)

### 5.3 Folders Tab — Folder Management 

**13 Standard Folders:**
1. `content-assets` — Marketing content
2. `design-assets` — UI/UX files
3. `code-modules` — Code components
4. `staging` — Work in progress
5. `system` — Documentation
6. `tools` — Scripts and utilities
7. `briefs` — Project requirements
8. `research` — Market/competitor research
9. `legal` — Contracts, terms
10. `finance` — Budgets, invoices
11. `outreach` — Sales materials
12. `deliverables` — Client deliverables
13. `archive` — Old versions

**Custom Folders:**
- Create with custom icon + description
- Drag files from staging
- Folder stats (file count)

### 5.4 Review Tab — Staged Review 

**Review Queue:**
- Files awaiting review
- Status: in-review / approved / rejected / deferred
- Filter by status or reviewer

**Review Actions:**
- Approve with comment
- Request changes
- Defer to later
- Assign reviewer
- Batch approve multiple files

**Review Thread:**
- Comments with resolved status tracking
- Notification on new comments

### 5.5 Dev Log Tab — Session Logging 

**Quick Log Entry:**
- Start session timer → work → stop timer
- Auto-logs to DEVLOG.md
- Duration + notes + timestamp

**History:**
- Past sessions list
- Weekly aggregation
- Links to project timeline

### 5.6 Timeline Tab — Gantt Chart 

**Visualization:**
- Project phases as bars
- TASKS.md integration
- Milestone markers
- Dependency lines

### 5.7 Comments Tab — Discussions 

**Per-File Threads:**
- Click comment icon in editor
- Thread with replies
- Resolve/reopen comments
- Notification on mentions

### 5.8 Meta Tab — File Intelligence 

**Metadata Panel:**
- Category (system-generated or custom)
- Status (draft/review/final/archived)
- Custom fields (JSON)
- AI-generated suggestions

**File Summaries:**
- L0 Abstract (vector search index)
- L1 Overview (navigation context)
- Content hash (for sync validation)
- Generation timestamp

---

## 6. DAILY OPERATIONS

### 6.1 Daily Check-In (Coach Mode) 

**Trigger:** 09:00 notification if not completed  
**Mandatory in:** Coach mode  
**Optional in:** Assistant mode  
**Disabled in:** Silent mode

**Fields:**
- Sleep hours (0-24)
- Energy level (0-10)
- Gut health (0-10)
- Training done (yes/no checkbox)
- Notes (text)

**Impact:**
- Affects task assignment routing
- Influences AI coaching tone
- Triggers drift alerts if missed
- Stored in `daily_checkins` table

**Access:** Left sidebar → AI Coach button → Check-in modal

### 6.2 Training Log (Coach Mode) 

**Entry Points:**
- Drift alert → Click train icon
- Tasks tab → Log training
- Daily check-in → Training checkbox

**Fields:**
- Duration (minutes)
- Type: solo / class / sparring / conditioning / other
- Energy after (0-10)
- Notes

**Weekly Target:** 3 sessions minimum  
**Enforcement:** Drift alert if under target

**Correlation:**
- Tracks energy vs. training relationship
- Shows on Command dashboard

### 6.3 Outreach Tracking (Coach Mode) 

**Entry Point:** Tasks tab → Log outreach

**Fields:**
- Type: message / post / call / email / other
- Target: person/platform/channel
- Project ID (optional link)
- Notes

**Weekly Minimum:** 5 actions  
**Enforcement:** "NOT DONE (mandatory)" badge in Coach mode  
**Tracking:** Shows in Command Centre summary

### 6.4 Session Timer 

**Usage:**
1. Click **"Start Session"** in top bar
2. Select project (if not already in one)
3. Work...
4. Click **"Stop"** → Auto-logs to DEVLOG.md

**Features:**
- Persists through page refresh
- Shows duration in real-time
- Beforeunload warning if active
- Links session to project

### 6.5 Weekly Review 

**Trigger:** Sunday 18:00 (or manual start)  
**Location:** Workflows tab → "Weekly Review" template

**Components:**
1. **Health Check** — Aggregate area scores
2. **Staging Review** — What's pending filing
3. **AI Analysis** — Multi-provider summary of week
4. **Dev Logs** — Auto-updated from sessions
5. **Set Focus** — Choose next week's priority
6. **Build Post** — Auto-draft weekly recap

**Output:** Stored in `weekly_reviews` table with:
- what_shipped
- what_blocked
- next_priority
- ai_analysis

---

## 7. AI COACHING & MODES

### 7.1 Three Assistance Modes 

| Mode | Identity | Check-ins | Drift Alerts | Task Creation | AI Tone |
|------|----------|-----------|--------------|---------------|---------|
| **Coach** | "Direct accountability partner" | Mandatory daily | Interruptive popups | Proactive suggestions | Challenging, direct |
| **Assistant** | "Helpful project assistant" | Available, not prompted | Dashboard badge only | Auto-assigns with preview | Supportive, neutral |
| **Silent** | "System tool" | Off | Off | Manual only | Minimal, factual |

### 7.2 Mode Switching 

**Settings:** Left sidebar → Settings icon → Assistance Mode dropdown

**Smart Suggestions:**
- **25+ day streak** → Suggest Assistant mode
- **3+ missed check-ins** → Suggest Coach mode
- **50%+ agent delegation** → Suggest Silent mode

**UI:** Purple banner in Command Centre with one-click switch

### 7.3 AI Coach Panel 

**Entry:** Left sidebar → AI Coach icon (🤖)

**Mode-Aware Visibility:**
- **Coach:** Full interface with presets + free text
- **Assistant:** Free text only (no presets)
- **Silent:** Hidden entirely

**Preset Questions (Coach mode):**
1. "What should I work on?" → Routes to Dev/Strategy
2. "Am I on track?" → Routes to Strategy
3. "How's my energy?" → Routes to Coach
4. "What's blocking me?" → Routes to Research
5. "What should I ship?" → Routes to Product

**Context Building (Automatic):**
- Today's check-in + energy level
- Recent projects + momentum
- Goal progress
- Weekly stats
- File summaries (L1) from active project
- URI-based resource references

### 7.4 Provider Selection 

**Supported Providers:**
- Anthropic (Claude Sonnet 4.6) — Primary, best reasoning
- Moonshot (Kimi) — Cost-effective
- DeepSeek — Low cost, fast
- Mistral — EU provider
- OpenAI (GPT-4) — Broad capabilities

**Routing:** Dynamically selects best provider based on cost + capability + user preference

---

## 8. AGENTS & WORKFLOWS

### 8.1 Agent System 

**File Location:** `public/agents/system-*.md`

**Format (YAML frontmatter):**
```yaml
---
id: system-dev-v1
version: 1
name: Dev Agent
icon: 🛠
capabilities:
  - code.write
  - code.review
  - code.debug
  - code.test
  - code.deploy
  - audit.security
permissions:
  - read:all
  - write:code-modules
ignore_patterns:
  - legal/
  - manifest.json
model: claude-sonnet-4-6
temperature: 0.7
cost_per_task_estimate: 0.02
handoff_rules:
  on_error: escalate_to_human
---
# Dev Agent
You are a senior developer...
```

**Capability Taxonomy:**
- `code.*` — write, review, debug, test, deploy
- `content.*` — write, edit, social, email, docs
- `strategy.*` — plan, research, analyze, prioritize
- `design.*` — ui, assets, brand, prototype
- `research.*` — market, tech, competitor, user
- `outreach.*` — find, write, track
- `finance.*` — analyze, price, report
- `audit.*` — security

**Creating Custom Agents:**
1. Go to **Skills** tab
2. Click any system agent
3. Click **"Clone"**
4. Edit capabilities, permissions, SOP
5. Save to project files

### 8.2 Workflow Execution 

**Step Format:**
```json
{
  "id": "step-1",
  "label": "Research Phase",
  "capability": "research.market",
  "sop": "Research 3 competitors and write findings",
  "auto_assign": true
}
```

**Execution Flow:**
1. User clicks "Start Workflow"
2. Instance created in DB
3. First step executes:
   - `auto_assign: true` → Agent runs immediately
   - `auto_assign: false` → Task appears in "My Tasks"
4. Task completion triggers next step
5. Repeat until done

**Common Patterns:**
- **Fully automated:** All steps `auto_assign: true`
- **Human gate at end:** Last step `auto_assign: false`
- **Mixed ownership:** Strategic steps human, execution steps agent

### 8.3 Creating Custom Workflows

**Option A: Edit JSON**
1. Edit `public/agents/system-workflows.json`
2. Add new entry with unique ID
3. Define steps with capabilities
4. Reload app (auto-seeds on login)

**Option B: Via API**
```javascript
await workflows.create({
  id: 'my-workflow',
  name: 'My Workflow',
  steps: [...],
  is_system: false
});
```

---

## 9. PROJECT PIPELINES (v2.2)

### 9.1 YouTube Factory 

**Purpose:** Produce upload-ready long-form videos (8-15 min)

**12 Steps:**
1. Research — Trending topics, search volume
2. Script — 4-6 segments (600-900 words each)
3. **Script Review** (Trust Gate) — You approve
4. Retention Review — Hook/pattern analysis
5. Storyboard — Remotion-compatible JSON
6. **Storyboard Review** (Trust Gate) — You approve
7. Keywords/SEO — Titles, descriptions, tags
8. Asset Sourcing — Stock footage, stills
9. Render — Remotion video generation
10. Assessment — 5-dimension quality check
11. **Pre-Upload Review** (Trust Gate) — Final approval
12. Upload Prep — Package to upload-ready folder

**Trust Gates:** 3 approval points  
**Cost:** ~$0.18 per video  
**Assessment Thresholds:**
- Factual Accuracy ≥ 7/10
- Narrative Engagement ≥ 6/10
- Visual Variety ≥ 6/10
- SEO Potential ≥ 6/10
- Production Readiness ≥ 7/10

### 9.2 Competition Hunter 

**Purpose:** Find, score, write entries for online competitions

**6 Steps:**
1. Research — Scrape competition sites
2. Score — Filter to 5.0+ composite score
3. Style Detect — Tag with writing style
4. Route to Writer — Match style agent
5. **Review** (Trust Gate) — Approve drafts in staging
6. Submit — Playwright form filling + proof capture

**Scoring Formula:**
```
(prize_value × 0.3) + (effort × 0.2) + (odds × 0.2) + 
(deadline_pressure × 0.1) + (fit × 0.2)
```

**Style Routing:**
- `humorous` → system-content-humorous-v1
- `professional` → system-content-professional-v1
- `fiction` → system-content-fiction-v1
- `sad` → system-content-sad-v1
- `narrative` → system-content-narrative-v1
- `persuasive` → system-content-persuasive-v1

### 9.3 B2B Outreach 

**Purpose:** Cold email pipeline with CRM tracking

**6 Steps:**
1. Research Prospect — Company info, pain points
2. Draft Email — Write to staging/ following tone rules
3. **Review Gate** (Trust Gate) — Approve draft
4. **Send Email** (Trust Gate) — Approve send (CRM: email_sent)
5. Monitor Reply — Watch inbox for replies
6. Follow-Up — 72h and 5-day follow-ups if no reply

**Email Tone Rules:**
- Direct — no pleasantries
- Value-first — lead with offer
- Short paragraphs — scannable
- Human — not template-sounding

**Forbidden Words:** synergy, leverage, circle back, touch base, low-hanging fruit

**CRM Status Chain:**
`lead` → `email_draft` → `email_sent` → `reply_detected` → `meeting_booked`

### 9.4 Trust Ladder System 

**3 Tiers:**
1. **Tier 1 (Full Approval):** Every gate manually reviewed (default)
2. **Tier 2 (Batch Digest):** Routine items batched; bulk approve (requires 20 runs, 90% approval, 5 consecutive approvals)
3. **Tier 3 (Autopilot):** No approval needed; runs autonomously (requires 40 runs, 95% approval, 10 consecutive approvals)

**Regression:** T3→T2 if ≥15% error rate in last 10 runs (24h cooldown)

---

## 10. TESTING & VERIFICATION

### 10.1 Automated Test Suite 

**Unit Tests (175+ tests across 18 modules):**

| Module | Tests | File |
|--------|-------|------|
| URI Utils | 15 | `src/__tests__/utils/uri.test.js` |
| Mode Helper | 12 | `src/__tests__/utils/modeHelper.test.js` |
| Project Factory | 10 | `src/__tests__/utils/projectFactory.test.js` |
| useSessionOps | 11 | `src/__tests__/hooks/useSessionOps.test.js` |
| useTaskOps | 10 | `src/__tests__/hooks/useTaskOps.test.js` |
| Agents | 15 | `src/__tests__/agents.test.js` |
| Workflows | 12 | `src/__tests__/workflows.test.js` |
| Memory | 10 | `src/__tests__/memory.test.js` |
| Summaries | 8 | `src/__tests__/summaries.test.js` |
| **Total** | **175+** | 18 files |

**Run Commands:**
```bash
npm test                    # Run unit tests
npm run test:coverage       # Coverage report (50% threshold)
npm run test:watch          # Watch mode
npm run test:critical       # Critical path tests (DB required)
node scripts/run-tests.js   # Full suite
```

### 10.2 Build Verification 

```bash
npm run build              # Must succeed with no errors
npm run lint               # ESLint must pass
npm run format:check       # Prettier must pass
```

### 10.3 Manual Verification Checklist 

#### A. Database & Auth (7 checks)
- [ ] A1.1 Database connection works
- [ ] A1.2 User registration creates account
- [ ] A1.3 Login returns valid JWT
- [ ] A1.4 JWT works for protected endpoints
- [ ] A1.5 Invalid token rejected (401)
- [ ] A1.6 Rate limiting kicks in after 30 req/min
- [ ] A1.7 SQL injection sanitized

#### B. Core Features (30 checks)
- [ ] B1.1 Create project with name/phase/priority
- [ ] B1.2 Update project fields
- [ ] B1.3 Assign life area
- [ ] B2.1 Create file in project
- [ ] B2.2 File auto-saves (2s debounce)
- [ ] B2.3 Manual save (Ctrl+S)
- [ ] B2.4 Load file content from DB
- [ ] B3.1 Open file in editor
- [ ] B3.4 Preview renders markdown
- [ ] B3.5 Code syntax highlighting

#### C. Daily Workflow (20 checks)
- [ ] C1.1 Open daily check-in modal
- [ ] C1.6 Submit check-in (persists to DB)
- [ ] C2.1 Log training session
- [ ] C3.1 Start session timer
- [ ] C3.3 Stop timer logs session
- [ ] C4.1 Log outreach action
- [ ] C5.1 Generate weekly review

#### D. Orchestration (30 checks)
- [ ] D1.1 Create task manually
- [ ] D1.5 Complete task
- [ ] D2.1 View workflow templates
- [ ] D2.2 Start workflow on project
- [ ] D3.1 View Agent Manager
- [ ] D3.6 Agent executes task (preview)
- [ ] D4.1 Parse brain://project/{id} URI
- [ ] D5.1 L0 abstract generates on save

#### E. Mode System (20 checks)
- [ ] E1.1 Switch to Coach mode
- [ ] E1.2 Switch to Assistant mode
- [ ] E1.3 Switch to Silent mode
- [ ] E2.1 Daily check-in mandatory (Coach)
- [ ] E2.2 Drift alerts interruptive (Coach)
- [ ] E3.4 AI tone supportive (Assistant)
- [ ] E4.1 No check-in prompts (Silent)

### 10.4 Quick Smoke Test (5 minutes) 

**Essential 10 Checks:**
1. ✅ Login works
2. ✅ Create project
3. ✅ Create/save file
4. ✅ Daily check-in saves
5. ✅ AI coach responds
6. ✅ Start workflow
7. ✅ Search works (Cmd+K)
8. ✅ Mode switching persists
9. ✅ Offline mode detection
10. ✅ Export project as ZIP

---

## 11. TROUBLESHOOTING

### 11.1 Common Issues 

| Issue | Cause | Solution |
|-------|-------|----------|
| **Workflows not showing** | Agent fetch error | Check console for 404s to `/agents/` |
| **Agent not auto-assigning** | Capability mismatch | Verify capability string matches agent YAML exactly |
| **Offline mode not working** | localStorage disabled | Check browser settings; enable storage |
| **File summaries not generating** | AI provider issue | Check API key in Settings |
| **Trust gate blocking** | Tier regression | Check error rate; review recent rejections |
| **Mode not persisting** | Settings not saved | Verify `settings` JSON column in DB |
| **L0/L1 summaries missing** | Background job failed | Check network tab for `file-summaries` API calls |

### 11.2 Debug Commands

```bash
# Verify version
grep '"version"' package.json

# Check memory.js imports
head -10 src/memory.js

# Verify agent-stats endpoint
grep "agent-stats" api/data.js

# Check test suite
npm test -- --listTests
```

### 11.3 Getting Help

**Code Locations Reference:**
- State declarations: `src/TheBrain.jsx` lines 1-320
- Hook wiring: `src/TheBrain.jsx` lines 320-1100
- Top bar/navigation: `src/TheBrain.jsx` lines 1100-3962
- Project CRUD: `src/hooks/useProjectCrud.js`
- Task management: `src/hooks/useTaskOps.js`
- AI logic: `src/hooks/useAI.js`
- Hub tabs: `src/components/panels/HubEditorPanel.jsx`
- Brain tabs: `src/components/panels/BrainTabsPanel.jsx`
- Colors/styles: `src/utils/constants.js`
- API endpoints: `src/api.js` + `api/*.js`
- Agent definitions: `public/agents/system-*.md`
- DB schema: `scripts/migrate.js`

---

## APPENDIX: KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + K** | Open search modal |
| **Cmd/Ctrl + S** | Save file |
| **Cmd/Ctrl + Z** | Undo |
| **Cmd/Ctrl + Shift + Z** | Redo |
| **G then C** | Go to Command tab |
| **G then P** | Go to Projects tab |
| **T then H** | Toggle Hub/Brain view |

---

**THE BRAIN v2.0** — From Coach to Orchestrator  
*Complete User Guide v1.0 — March 2026*

---

: README.md — Project overview and architecture
: WORKFLOWS-AND-AGENTS.md — Agent and workflow practical guide
: ARCHITECTURE-v2.md — System architecture and data flow
: TESTING-PLAN.md — Comprehensive testing checklist
: TEST-SUITE-FINAL.md — Test suite implementation (175+ tests)
: BRAIN-ROADMAP.md — Feature implementation roadmap
: ROADMAP-v2.md — v2.0 high-level roadmap
: SCHEMA-REFERENCE.md — Database schema documentation
: REFACTOR_TASKS.md — Frontend refactoring documentation
: AGENT-BRIEF.md — Operating rules for AI agents
: PROJECT-PIPELINES-GUIDE.md — YouTube, Competition, B2B pipeline guides
