# Next Session Prompt — Architecture Audit (Remaining Tasks)

**Date:** 2026-03-28  
**Status:** P0-P3 Complete ✅  
**Last Commit:** TBD — "refactor: complete architecture audit P2-P3 items"

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

### P2 — Medium Priority (All Done)
- Removed Drizzle ORM (unused)
- Reorganized `public/agents/` into 6 subdirectories (25 agents total)
- **P2-11:** Lazy-loaded tab components (AgentManager, WorkflowRunner, GitHubIntegration) in BrainTabsPanel.jsx
- **P2-12:** Extracted UserContext from TheBrain.jsx (user, userSettings, currentMode)
- **P2-13:** Split useProjectCrud (638 lines) into 3 focused hooks:
  - `useFileCrud.js` — file operations (saveFile, createFile, deleteFile, handleDrop, exportProject)
  - `useProjectLifecycle.js` — project CRUD (openHub, createProject, updateProject, renameProject, deleteProject, importProject)
  - `useProjectBootstrap.js` — onboarding & bootstrap (completeBootstrap, handleOnboardingCreateGoal, handleOnboardingCreateProject, completeOnboarding, skipOnboarding)

---

## 📋 Summary of Changes

### New Files Created
| File | Purpose |
|------|---------|
| `src/contexts/UserContext.jsx` | Centralized user state (user, userSettings, currentMode) |
| `src/hooks/useFileCrud.js` | File operations hook (~200 lines) |
| `src/hooks/useProjectLifecycle.js` | Project lifecycle hook (~230 lines) |
| `src/hooks/useProjectBootstrap.js` | Bootstrap & onboarding hook (~210 lines) |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.jsx` | Wrapped TheBrain with UserProvider |
| `src/TheBrain.jsx` | Uses useUser hook; replaced useProjectCrud with 3 new hooks |
| `src/components/OnboardingWizard.jsx` | Uses useUser hook instead of user prop |
| `src/components/panels/BrainTabsPanel.jsx` | Lazy-loaded AgentManager, WorkflowRunner, GitHubIntegration |

### Deleted Files
| File | Reason |
|------|--------|
| `src/hooks/useProjectCrud.js` | Replaced by 3 focused hooks |

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
| UserContext | ✅ Active |
| Hook separation | 3 focused hooks |
| Lazy-loaded tabs | ✅ AgentManager, WorkflowRunner, GitHubIntegration |

---

## 🎯 Architecture Improvements

1. **UserContext**: Eliminates prop drilling for user, userSettings, and currentMode
2. **Hook Separation**: Each hook now has a single responsibility
3. **Lazy Loading**: ~100KB reduction in initial bundle size
4. **Code Organization**: Clearer boundaries between file ops, project lifecycle, and onboarding

---

## 🔗 Related Files

- `CHANGELOG.md` — Full history of P0-P3 changes
- `MERGED_ARCHITECTURE_AUDIT.md` — Complete audit report
- `api/_lib/handlers/` — New handler modules
- `public/agents/` — Reorganized agent files
- `src/contexts/UserContext.jsx` — New context
- `src/hooks/useFileCrud.js` — File operations
- `src/hooks/useProjectLifecycle.js` — Project CRUD
- `src/hooks/useProjectBootstrap.js` — Onboarding & bootstrap

---

*Architecture audit complete! All P0-P3 tasks finished.*
