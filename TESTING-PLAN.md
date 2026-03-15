# THE BRAIN — Comprehensive Testing Plan

**Approach:** Real-usage testing while building actual projects  
**Goal:** Find and fix all issues before relying on this for real work  
**Updated:** 2026-03-15

---

# PART A: CRITICAL PATH TESTS (Must Pass)

## A1. Database & Auth

- [ ] **A1.1** Database connection works (can connect to TiDB)
- [ ] **A1.2** User registration creates account
- [ ] **A1.3** User login returns valid JWT token
- [ ] **A1.4** JWT token works for protected endpoints
- [ ] **A1.5** Invalid token is rejected (401)
- [ ] **A1.6** Rate limiting kicks in after 30 requests/minute
- [ ] **A1.7** SQL injection sanitization works

## A2. Data Integrity

- [ ] **A2.1** File save/load round-trip preserves exact content
- [ ] **A2.2** Soft delete hides file from normal queries
- [ ] **A2.3** Restore soft-deleted file works
- [ ] **A2.4** Comments persist correctly
- [ ] **A2.5** Session logging works
- [ ] **A2.6** No orphaned records in database
- [ ] **A2.7** Schema migrations table is up to date

---

# PART B: CORE FEATURE TESTS

## B1. Project Management

- [ ] **B1.1** Create project with name, phase, priority, health
- [ ] **B1.2** Update project fields (phase, health, momentum)
- [ ] **B1.3** Assign life area to project
- [ ] **B1.4** Add tags to project
- [ ] **B1.5** Create links between projects
- [ ] **B1.6** Delete project (soft delete)
- [ ] **B1.7** Restore deleted project
- [ ] **B1.8** Project list pagination works
- [ ] **B1.9** Search projects by name works

## B2. File System

- [ ] **B2.1** Create file in project
- [ ] **B2.2** File auto-saves after edit (debounced)
- [ ] **B2.3** Manual save works (Cmd/Ctrl+S)
- [ ] **B2.4** Load file content from DB
- [ ] **B2.5** Create folder in project
- [ ] **B2.6** Move file between folders
- [ ] **B2.7** Delete file (soft delete)
- [ ] **B2.8** File tree displays correctly
- [ ] **B2.9** Full-text search in files works
- [ ] **B2.10** Search finds files by name
- [ ] **B2.11** File metadata (category, status) saves

## B3. Editor

- [ ] **B3.1** Open file in editor
- [ ] **B3.2** Edit content with cursor
- [ ] **B3.3** Undo/Redo in editor
- [ ] **B3.4** Preview mode renders markdown
- [ ] **B3.5** Code syntax highlighting works
- [ ] **B3.6** Editor scrolls for long files
- [ ] **B3.7** Auto-save indicator shows status
- [ ] **B3.8** Save fails gracefully shows error

## B4. Life Areas ("Parts")

- [ ] **B4.1** View all life areas
- [ ] **B4.2** Life area health score calculates
- [ ] **B4.3** Filter projects by life area
- [ ] **B4.4** Create custom life area

---

# PART C: DAILY WORKFLOW TESTS

## C1. Daily Check-in

- [ ] **C1.1** Open daily check-in modal
- [ ] **C1.2** Set sleep slider (0-10)
- [ ] **C1.3** Set energy slider (0-10)
- [ ] **C1.4** Set gut slider (0-10)
- [ ] **C1.5** Mark training done/pending
- [ ] **C1.6** Submit check-in
- [ ] **C1.7** Check-in persists in database
- [ ] **C1.8** Check-in appears in Command Centre
- [ ] **C1.9** Check-in history accessible
- [ ] **C1.10** Coach mode requires check-in

## C2. Training Log

- [ ] **C2.1** Log training session (type, duration)
- [ ] **C2.2** Training log persists
- [ ] **C2.3** Weekly target tracking works
- [ ] **C2.4** Training correlation calculates

## C3. Session Timer

- [ ] **C3.1** Start session timer
- [ ] **C3.2** Timer persists through page refresh
- [ ] **C3.3** Stop timer logs session
- [ ] **C3.4** Session appears in project history
- [ ] **C3.5** Session duration is accurate

## C4. Outreach Tracking

- [ ] **C4.1** Log outreach action
- [ ] **C4.2** Outreach minimum enforcement works
- [ ] **C4.3** Outreach history displays

## C5. Weekly Review

- [ ] **C5.1** Generate weekly review
- [ ] **C5.2** Stats are accurate (sessions, training, etc.)
- [ ] **C5.3** AI analysis generates
- [ ] **C5.4** Review persists

## C6. Drift Detection

- [ ] **C6.1** Training deficit alert triggers
- [ ] **C6.2** Outreach gap alert triggers
- [ ] **C6.3** Session streak break alert triggers
- [ ] **C6.4** Alerts display in Command Centre
- [ ] **C6.5** Coach mode shows interruptive alerts
- [ ] **C6.6** Assistant mode shows badge only

---

# PART D: v2.0 ORCHESTRATION TESTS

## D1. Task System

- [ ] **D1.1** Create task manually
- [ ] **D1.2** Assign task to self
- [ ] **D1.3** Set task priority (critical/high/medium/low)
- [ ] **D1.4** Set task due date
- [ ] **D1.5** Complete task
- [ ] **D1.6** Delete task
- [ ] **D1.7** View all tasks ("My Tasks")
- [ ] **D1.8** Filter tasks by status
- [ ] **D1.9** Filter tasks by priority
- [ ] **D1.10** Task appears in project context

## D2. Workflow System

- [ ] **D2.1** View available workflow templates
- [ ] **D2.2** Start workflow on project
- [ ] **D2.3** Tasks created for workflow steps
- [ ] **D2.4** Workflow progress shows correctly
- [ ] **D2.5** Complete workflow step manually
- [ ] **D2.6** Workflow advances to next step
- [ ] **D2.7** Complete entire workflow
- [ ] **D2.8** View workflow history
- [ ] **D2.9** Pause workflow
- [ ] **D2.10** Resume workflow
- [ ] **D2.11** Abort workflow

## D3. Agent System

- [ ] **D3.1** View Agent Manager
- [ ] **D3.2** See all system agents listed
- [ ] **D3.3** View agent capabilities
- [ ] **D3.4** View agent permissions
- [ ] **D3.5** Assign task to agent
- [ ] **D3.6** Agent executes task (preview mode)
- [ ] **D3.7** Agent executes task (auto mode)
- [ ] **D3.8** Agent reads file context
- [ ] **D3.9** Agent writes file results
- [ ] **D3.10** Agent creates sub-task
- [ ] **D3.11** Agent ignores files by pattern

## D4. URI System

- [ ] **D4.1** Parse brain://project/{id} URI
- [ ] **D4.2** Parse brain://project/{id}/file/{path} URI
- [ ] **D4.3** Generate project URI
- [ ] **D4.4** Generate file URI
- [ ] **D4.5** Extract URIs from text
- [ ] **D4.6** URI click navigates to resource

## D5. File Summaries (L0/L1/L2)

- [ ] **D5.1** L0 abstract generates on file save
- [ ] **D5.2** L1 overview generates on file save
- [ ] **D5.3** View summaries in Meta tab
- [ ] **D5.4** Summaries update when file changes
- [ ] **D5.5** Build AI context from summaries
- [ ] **D5.6** Retrieval finds relevant files

---

# PART E: MODE SYSTEM TESTS

## E1. Mode Switching

- [ ] **E1.1** Switch to Coach mode
- [ ] **E1.2** Switch to Assistant mode
- [ ] **E1.3** Switch to Silent mode
- [ ] **E1.4** Mode persists across sessions
- [ ] **E1.5** Mode selector in Settings works

## E2. Coach Mode Behavior

- [ ] **E2.1** Daily check-in is mandatory
- [ ] **E2.2** Drift alerts are interruptive popups
- [ ] **E2.3** Outreach enforcement modal appears
- [ ] **E2.4** AI tone is challenging/direct
- [ ] **E2.5** AI creates tasks proactively

## E3. Assistant Mode Behavior

- [ ] **E3.1** Daily check-in available, not prompted
- [ ] **E3.2** Drift alerts show as badge only
- [ ] **E3.3** Outreach is tracked but optional
- [ ] **E3.4** AI tone is supportive/neutral
- [ ] **E3.5** AI suggests with preview

## E4. Silent Mode Behavior

- [ ] **E4.1** No daily check-in prompts
- [ ] **E4.2** No drift alerts
- [ ] **E4.3** No outreach tracking
- [ ] **E4.4** AI tone is minimal/factual
- [ ] **E4.5** Task creation is manual only
- [ ] **E4.6** Agent preview mode enforced

## E5. Mode Suggestions

- [ ] **E5.1** Suggest Assistant after 25+ day streak
- [ ] **E5.2** Suggest Coach after 3+ missed check-ins
- [ ] **E5.3** Suggest Silent after 50%+ delegation
- [ ] **E5.4** Suggestion banner displays
- [ ] **E5.5** One-click mode switch works

---

# PART F: DAILY TRACKING TESTS

## F1. Import/Export

- [ ] **F1.1** Export project as JSON
- [ ] **F1.2** Export project as BUIDL format
- [ ] **F1.3** Import from JSON
- [ ] **F1.4** Import from BUIDL
- [ ] **F1.5** Folder picker import works

## F2. Desktop Sync

- [ ] **F2.1** Connect desktop folder
- [ ] **F2.2** Files sync to desktop
- [ ] **F2.3** Desktop changes sync to app
- [ ] **F2.4** Conflict detection works
- [ ] **F2.5** Offline changes queue

## F3. GitHub Integration

- [ ] **F3.1** Connect GitHub account
- [ ] **F3.2** Link project to repo
- [ ] **F3.3** View repo status
- [ ] **F3.4** View recent commits

---

# PART G: MEMORY & INTELLIGENCE

## G1. Auto Task Creation

- [ ] **G1.1** Scan DEVLOG for TODO markers
- [ ] **G1.2** Scan for FIXME markers
- [ ] **G1.3** Scan for XXX markers
- [ ] **G1.4** Scan for BLOCKED markers
- [ ] **G1.5** Proposed tasks banner shows
- [ ] **G1.6** Create task from proposed

## G2. Memory System

- [ ] **G2.1** List memories
- [ ] **G2.2** Create manual memory
- [ ] **G2.3** Extract memories from workflow
- [ ] **G2.4** Extract memories from task
- [ ] **G2.5** View memory insights
- [ ] **G2.6** Memory appears in AI context

## G3. Workflow Learning

- [ ] **G3.1** Detect step duration patterns
- [ ] **G3.2** Detect agent success rates
- [ ] **G3.3** Suggest workflow improvements

---

# PART H: COMMUNITY & INTEGRATIONS

## H1. Community Workflows

- [ ] **H1.1** View community workflows
- [ ] **H1.2** Search workflows by name
- [ ] **H1.3** Filter by category
- [ ] **H1.4** Sort by stars/rating
- [ ] **H1.5** Publish workflow
- [ ] **H1.6** Star workflow
- [ ] **H1.7** Fork workflow

## H2. External Integrations

- [ ] **H2.1** Add GitHub integration
- [ ] **H2.2** Add Google Calendar integration
- [ ] **H2.3** Add Email integration
- [ ] **H2.4** View integration status
- [ ] **H2.5** Remove integration

---

# PART I: UI/UX TESTS

## I1. Navigation

- [ ] **I1.1** Command Centre loads
- [ ] **I1.2** Projects view loads
- [ ] **I1.3** Project hub loads
- [ ] **I1.4** Tab navigation works
- [ ] **I1.5** Back navigation works

## I2. Search

- [ ] **I2.1** Cmd/Ctrl+K opens search
- [ ] **I2.2** Search finds projects
- [ ] **I2.3** Search finds files
- [ ] **I2.4** Search finds ideas
- [ ] **I2.5** Search highlights results

## I3. Responsiveness

- [ ] **I3.1** Desktop layout works
- [ ] **I3.2** Tablet layout works
- [ ] **I3.3** Mobile layout works
- [ ] **I3.4** Touch targets sized correctly

## I4. Notifications

- [ ] **I4.1** Bell icon shows notification count
- [ ] **I4.2** Click opens notification panel
- [ ] **I4.3** Mark as read works
- [ ] **I4.4** Delete notification works

---

# PART J: PERFORMANCE & SECURITY

## J1. Performance

- [ ] **J1.1** Initial load < 2 seconds
- [ ] **J1.2** Search response < 500ms
- [ ] **J1.3** AI response < 5 seconds
- [ ] **J1.4** File save < 100ms
- [ ] **J1.5** Pagination works for large lists

## J2. Security

- [ ] **J2.1** Rate limiting blocks excess requests
- [ ] **J2.2** SQL injection sanitized
- [ ] **J2.3** XSS prevention works
- [ ] **J2.4** API keys not exposed to client

---

# PART K: BUG REGRESSION TESTS

## K1. Previously Fixed Issues

- [ ] **K1.1** File loading from DB works (was lazy loading bug)
- [ ] **K1.2** Comments loading from DB works (was useEffect bug)
- [ ] **K1.3** AI Coach proxy function works (was server-side issue)
- [ ] **K1.4** Rename project stale ref fixed (was functional updater)
- [ ] **K1.5** Session timer beforeunload warning works
- [ ] **K1.6** Bootstrap wizard null check works
- [ ] **K1.7** Soft deletes on project_files work
- [ ] **K1.8** Debounced saves in editor work

---

# TEST EXECUTION LOG

| Date | Tester | Area | Tests Run | Pass | Fail | Notes |
|------|--------|------|-----------|------|------|-------|
|      |        |      |           |      |      |       |

---

# ISSUES FOUND

| # | Date | Severity | Feature | Description | Status |
|---|------|----------|---------|--------------|--------|
| 1 |      |          |         |              |        |

---

# SUCCESS CRITERIA

Testing is complete when:

1. [ ] All Critical Path Tests (Part A) pass
2. [ ] Can create and manage 3+ real projects
3. [ ] Daily check-in workflow is stable
4. [ ] File editor is reliable for daily use
5. [ ] At least one complete workflow run works
6. [ ] Task system is fully functional
7. [ ] Mode switching works correctly
8. [ ] No data loss or corruption
9. [ ] No critical bugs found

**Estimated test count:** 200+ tests
**Estimated time:** 2-3 weeks of real usage

---

# CODE ANALYSIS ISSUES FOUND

## Issues in Source Code:

### Issue 1: memory.js imports non-existent functions
**File:** `src/memory.js`  
**Severity:** HIGH  
**Description:** Line 6 imports `get` and `post` from `./api.js` but these functions don't exist. API uses named exports like `memories.list()`, `memories.create()` etc.  
**Impact:** Memory module will fail at runtime  
**Fix:** Rewrite to use the `memories` export from api.js

### Issue 2: Version confusion
**File:** Multiple  
**Severity:** LOW  
**Description:** 
- `package.json` says v6.0.0
- Header in TheBrain.jsx says "v6 — Wired Edition"
- Documentation says v2.0
- Should be unified

### Issue 3: Agent stats return zeros
**File:** `src/agents.js` line 179-199  
**Severity:** MEDIUM  
**Description:** `getAgentStats()` always returns zeros - no backend aggregation implemented  
**Impact:** Agent selection scoring won't work properly

### Issue 4: Rate limiting in-memory only
**File:** `api/data.js`  
**Severity:** MEDIUM  
**Description:** Rate limiting uses in-memory Map - resets on server restart/redeploy  
**Impact:** Rate limiting less effective in serverless

### Issue 5: Missing error handling in workflow
**File:** `src/workflows.js`  
**Severity:** LOW  
**Description:** Some async operations don't have error handling  
**Impact:** Silent failures possible

---

*Plan created: 2026-03-15*
