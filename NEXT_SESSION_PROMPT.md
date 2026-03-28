# Next Session Prompt — Architecture Audit (Remaining Tasks)

**Date:** 2026-03-28  
**Status:** P0-P2 Complete ✅ | P2-P3 Backlog ⏸️  
**Last Commit:** 0dce871 — "refactor: complete architecture audit P0-P2 items"

---

## ✅ What Was Completed

### P0 — Critical Fixes (All Done)
- Deleted `scripts/migrate.js.backup`
- Fixed `outreach_log.project_id` type mismatch
- Added `idx_project_files_active` index
- Removed duplicate `fileMetadata` prop in Editor.jsx
- Added `workflow_templates` and `workflow_instances` tables to schema.sql
- Added FK constraint on `tasks.workflow_instance_id`

### P1 — High Priority (All Done)
- Split `api/data.js` (4,748 lines → 200 lines) into 8 handler modules
- Co-located 17 test files with source code

### P2 — Medium Priority (Partial)
- Removed Drizzle ORM (unused)
- Reorganized `public/agents/` into 6 subdirectories (25 agents total)

---

## ⏸️ Remaining Tasks for Next Session

### P2-11: Lazy-load Tab Components
**Goal:** Reduce initial bundle size by lazy loading tab-level components

**Files to modify:**
- `src/components/BrainTabsPanel.jsx`

**Implementation:**
```javascript
import { lazy, Suspense } from 'react';

const AgentManager = lazy(() => import('../AgentManager'));
const WorkflowRunner = lazy(() => import('../WorkflowRunner'));
const GitHubIntegration = lazy(() => import('../GitHubIntegration'));

// Wrap in Suspense
<Suspense fallback={<div>Loading...</div>}>
  <AgentManager {...props} />
</Suspense>
```

**Estimated reduction:** ~100KB from initial bundle

---

### P2-12: Extract UserContext from TheBrain.jsx
**Goal:** Remove prop drilling for user/settings/mode state

**Files to create:**
- `src/contexts/UserContext.jsx`

**Files to modify:**
- `src/App.jsx` — wrap with UserProvider
- `src/TheBrain.jsx` — remove user-related useState, use useContext instead
- Components that receive user props — switch to useContext

**State to move to context:**
- userSettings
- user (from props)
- currentMode (derived from userSettings)

**Implementation pattern:**
```javascript
// src/contexts/UserContext.jsx
export const UserContext = createContext();

export function UserProvider({ children, user }) {
  const [userSettings, setUserSettings] = useState({...});
  const currentMode = getMode(userSettings);
  
  return (
    <UserContext.Provider value={{ user, userSettings, setUserSettings, currentMode }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
```

---

### P2-13: Split useProjectCrud Hook
**Goal:** Separate file CRUD from project lifecycle operations

**Current:** `src/hooks/useProjectCrud.js` (638 lines, 3 concerns)

**Files to create:**
- `src/hooks/useFileCrud.js` — file operations (saveFile, createFile, deleteFile, handleDrop)
- `src/hooks/useProjectLifecycle.js` — project CRUD (createProject, updateProject, renameProject, deleteProject, importProject)
- `src/hooks/useProjectBootstrap.js` — onboarding, bootstrap, export

**Files to modify:**
- `src/TheBrain.jsx` — update hook imports and deps

**Function distribution:**
```javascript
// useFileCrud.js
- saveFile
- handleHubSave
- createFile
- deleteFile
- handleDrop
- exportProject (uses file content)

// useProjectLifecycle.js
- openHub
- createProject
- updateProject
- renameProject
- deleteProject
- importProject

// useProjectBootstrap.js
- completeBootstrap
- handleOnboardingCreateGoal
- handleOnboardingCreateProject
- completeOnboarding
- skipOnboarding
```

---

## 📋 Quick Start for Next Session

To continue from here:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies (after Drizzle removal)
npm install

# 3. Verify tests pass
npm test

# 4. Check what was done
git log --oneline -10
```

---

## 🎯 Recommended Order for Next Session

1. **P2-12: UserContext extraction** — Smallest scope, proves context pattern
2. **P2-13: useProjectCrud split** — Most complex, requires careful testing
3. **P2-11: Lazy-load tabs** — Bundle optimization, lowest risk

---

## 📊 Current Repository State

| Metric | Value |
|--------|-------|
| api/data.js | ~200 lines (was 4,748) |
| Test files | 17 co-located with source |
| Agents | 25 in 6 subdirectories |
| Drizzle ORM | Removed |
| Root .md files | 12 (cleaned up) |
| Schema integrity | Fixed |

---

## 🔗 Related Files

- `CHANGELOG.md` — Full history of P0-P2 changes
- `MERGED_ARCHITECTURE_AUDIT.md` — Complete audit report
- `api/_lib/handlers/` — New handler modules
- `public/agents/` — Reorganized agent files

---

*Ready to continue with P2-P3 backlog when you return.*
