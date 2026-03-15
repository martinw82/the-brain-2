# THE BRAIN — Testing Plan

**Approach:** Real-usage testing while building actual projects  
**Goal:** Find and fix issues before they impact productivity  

---

## Phase 1: Critical Path Verification (Day 1)

Before any real usage, verify the critical paths that if broken would cause data loss:

### 1.1 Run Critical Path Tests
```bash
npm run test:critical
```

### 1.2 Verify API Connectivity
Test these API endpoints:

| Endpoint | Test |
|----------|------|
| GET /api/data?resource=projects | List projects |
| POST /api/data?resource=projects | Create project |
| GET /api/data?resource=files | List files |
| POST /api/data?resource=files | Create file |

### 1.3 Verify Authentication
1. Register new user
2. Login with credentials
3. Confirm JWT token works

---

## Phase 2: Core Functionality (Week 1)

### 2.1 Project Management
- Create/update/delete projects
- Phase, health, momentum tracking
- Life area assignment
- Tags and links

### 2.2 File System
- Create/edit/save files
- Folder structure
- Delete and restore
- Full-text search

### 2.3 Editor
- Open and edit files
- Auto-save and manual save
- Undo/Redo
- Preview mode

---

## Phase 3: Daily Workflows (Week 2)

### 3.1 Daily Check-in
- Complete check-in
- Verify persistence
- Training log integration

### 3.2 Session Timer
- Start/stop timer
- Verify session logged
- Session appears in history

### 3.3 Weekly Review
- Generate review
- Verify stats accuracy
- AI analysis works

---

## Phase 4: v2.0 Features (Week 3)

### 4.1 Task System
- Create/complete/delete tasks
- Assign to self
- View "My Tasks"

### 4.2 Workflow System
- View/start workflows
- Complete workflow steps
- View workflow history

### 4.3 Agent System
- View Agent Manager
- Assign tasks to agents

### 4.4 Mode System
- Switch between Coach/Assistant/Silent
- Verify mode-specific UI

---

## Phase 5: Integration (Week 4)

- Desktop sync
- GitHub integration
- Import/Export

---

## Issue Template

**Severity:** Critical/High/Medium/Low
**Feature:**
**Steps:**
1.
2.
3.
**Expected:**
**Actual:**

---

## Success Criteria

1. Critical path tests pass
2. Can manage 3+ real projects
3. Daily check-in works
4. File editor stable
5. No data loss
6. Complete one workflow

---

## Issues Found During Testing

### Issue 1: Missing .env.example
**Severity:** High  
**Status:** ✅ Fixed (created .env.example)  
**Description:** No template for required environment variables

### Issue 2: mysql2 Installation Issue
**Severity:** Medium  
**Status:** ✅ Fixed (reinstalled)  
**Description:** mysql2 package wasn't fully installed

### Issue 3: No Database Connected
**Severity:** High  
**Status:** ⏳ Pending  
**Description:** Need TiDB Cloud account to run critical path tests
