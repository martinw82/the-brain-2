# The Brain — Refactoring Task List

_Systematic decomposition of TheBrain.jsx (14,237 lines) into a modular architecture._

---

## Workflow

One focused task per session → update dev-log.md with what was done, line-count reduction, any issues → close session → next.

## Target Folder Structure

```
src/
├── hooks/          # domain logic (useProjectLogic, useAI, etc.)
├── components/     # UI panels, modals, viewers
│   ├── Modals/     # KeyboardShortcutsModal, SearchModal, AIProviderSettings, MetadataEditor
│   ├── viewers/    # ImageViewer, AudioPlayer, VideoPlayer, BinaryViewer
│   ├── panels/     # HubEditorPanel, BrainTabsPanel
│   └── UI/         # AreaPill, TagPill, Dots, HealthBar, Modal, Toast, etc.
├── utils/          # pure helpers (projectFactory, renderers, fileHandlers, constants)
└── TheBrain.jsx    # thin orchestrator + imports
```

---

## Progress

| Task                           | Status  | Lines Removed | Commit                                          |
| ------------------------------ | ------- | ------------- | ----------------------------------------------- |
| Task 0 — Setup                 | ✅ Done | 0             | `refactor: setup module folders`                |
| Task 1 — Extract utilities     | ✅ Done | -540          | `refactor: extract pure utilities`              |
| Step A — Standalone components | ✅ Done | -5,029        | `refactor: remove 5029 lines of extracted code` |
| Step B — Internal hooks        | ✅ Done | -1,119        | B1-B8 extracted and wired                       |
| Step C — Domain panels         | ✅ Done | -3,297        | HubEditorPanel + BrainTabsPanel                 |
| Step D — Cleanup & polish      | ✅ Done | -307          | useMetadata, useDataSync, import cleanup        |

**Final TheBrain.jsx**: 3,962 lines (down from 14,237) — **72% reduction**

---

## Task 0 — Setup ✅

- Created directories: `src/hooks/`, `src/utils/`, `src/components/Modals/`, `src/components/viewers/`
- Added barrel files: `src/hooks/index.js`, `src/utils/index.js`
- Baseline recorded: TheBrain.jsx = 14,237 lines

## Task 1 — Extract Pure Utilities ✅

**Files created:**

- `src/utils/constants.js` — C, S, BREAKPOINTS, BUIDL_VERSION, STANDARD_FOLDERS, STANDARD_FOLDER_IDS, ITEM_TAGS, REVIEW_STATUSES, BUIDL_PHASES, THAILAND_TARGET, STATUS_MAP
- `src/utils/projectFactory.js` — makeManifest, calcHealth, makeDefaultFiles, makeProject
- `src/utils/fileHandlers.js` — getFileType, formatFileSize, buildZipExport

**Result:** TheBrain.jsx reduced by 540 lines (14,237 → 13,697). Build verified.

---

## Step A — Extract Standalone Components (Tasks 4+5 combined) ✅

All components defined OUTSIDE the main TheBrain function (lines 88–5162). Clean cut-and-paste.

**Result:** TheBrain.jsx reduced by 5,029 lines (13,697 → 8,685). Build verified.

### Hooks

- `src/hooks/useUndoRedo.js` ← useUndoRedo (lines 89–159)
- `src/hooks/useBreakpoint.js` ← useBreakpoint (lines 333–358)

### Small UI → `src/components/UI/SmallComponents.jsx`

- AreaPill, TagPill, Dots, HealthBar, BadgeStatus, Modal, Toast (lines 361–532)

### Modals

- `src/components/Modals/KeyboardShortcutsModal.jsx` ← lines 161–252
- `src/components/Modals/AIProviderSettings.jsx` ← lines 534–783
- `src/components/Modals/MetadataEditor.jsx` ← lines 784–1163
- `src/components/Modals/SearchModal.jsx` ← lines 1708–2047

### Renderers & Charts

- `src/components/MermaidRenderer.jsx` ← lines 1165–1250
- `src/components/URILink.jsx` ← URILink + renderAIResponse (lines 1251–1310)
- `src/utils/renderers.js` ← renderMd, parseTasks (lines 1312–1465)
- `src/components/GanttChart.jsx` ← lines 1383–1453
- `src/components/FileTreeInline.jsx` ← lines 1466–1636
- `src/components/MarkdownPreview.jsx` ← lines 1637–1707
- `src/components/ProgressTrends.jsx` ← lines 254–331

### Large Components

- `src/components/OnboardingWizard.jsx` ← ~625 lines
- `src/components/TourTooltip.jsx` ← ~130 lines
- `src/components/GitHubIntegration.jsx` ← ~553 lines
- `src/components/MarkdownEditor.jsx` ← ~140 lines
- `src/components/viewers/ImageViewer.jsx` ← ~55 lines
- `src/components/viewers/AudioPlayer.jsx` ← ~50 lines
- `src/components/viewers/VideoPlayer.jsx` ← ~55 lines
- `src/components/viewers/BinaryViewer.jsx` ← ~78 lines
- `src/components/ScriptRunner.jsx` ← ~302 lines
- `src/components/HealthCheck.jsx` ← ~342 lines
- `src/components/SkillsWorkflows.jsx` ← ~302 lines
- `src/components/BootstrapWizard.jsx` ← ~474 lines

**Expected:** ~5,000 lines removed from TheBrain.jsx

---

## Step B — Extract Internal Hooks (Tasks 2+3 combined) ✅

Functions inside the main TheBrain component extracted to domain hooks. Each hook accepts a deps object and returns operations.

**Files created:**

- `src/hooks/useProjectCrud.js` (677 lines) — openHub, saveFile, createFile, deleteFile, createProject, updateProject, renameProject, deleteProject, importProject, completeBootstrap, onboarding handlers, handleDrop, exportProject
- `src/hooks/useStagingOps.js` (82 lines) — addStaging, updateStagingStatus, moveToFolder
- `src/hooks/useSessionOps.js` (191 lines) — addIdea, endSession, saveCheckin, loadWeeklyTraining, saveTraining, loadTodayOutreach, saveOutreach
- `src/hooks/useNotifications.js` (77 lines) — loadNotifications, checkNotificationTriggers, markNotificationRead, markAllNotificationsRead, deleteNotification
- `src/hooks/useTaskOps.js` (109 lines) — loadTasks, createTask, completeTask, deleteTask + agent polling useEffect
- `src/hooks/useAI.js` (148 lines) — runSearch, buildCtx, buildBrief, copy, askAI
- `src/hooks/useTagOps.jsx` (166 lines) — getEntityTags, attachTag, detachTag, QuickTagRow component

**Result:** TheBrain.jsx reduced by 1,119 lines (8,685 → 7,566). Build verified.

---

## Step C — Extract Domain Panels (Task 6) ✅

Extracted JSX blocks from the return statement into panel components using ctx prop pattern.

**Files created:**

- `src/components/panels/HubEditorPanel.jsx` (1480 lines) — all hub tab content (editor, overview, folders, review, devlog, gantt, comments, meta, links)
- `src/components/panels/BrainTabsPanel.jsx` (2150 lines) — all brain tab content (command, projects, bootstrap, staging, skills, workflows, integrations, ideas, ai, review, export, tags)

**Result:** TheBrain.jsx reduced by 3,297 lines (7,566 → 4,269). Build verified.

---

## Step D — Cleanup & Polish (Task 7) ✅

### D1: Extract remaining hooks

- `src/hooks/useMetadata.js` (113 lines) — fetchMetadata, saveMetadata, requestAiSuggestions, acceptAiSuggestion + auto-suggest useEffect
- `src/hooks/useDataSync.js` (218 lines) — seed defaults for areas/goals/templates, cache sync, online-status monitoring

### D2: Import cleanup

- Removed 23+ unused component imports (AgentManager, AudioPlayer, BinaryViewer, etc.)
- Removed 15+ unused API imports (stagingApi, ideasApi, sessionsApi, etc.)
- Removed unused utility imports (parseURI, extractURIs, checkSummaryStatus, etc.)
- Removed unused `useCallback` from React imports

### D3: Build verification

- `npx prettier --write` on all modified files
- `npx vite build` succeeds
- Final line count: **3,962 lines**

**Result:** TheBrain.jsx reduced by 307 lines (4,269 → 3,962). Build verified.

---

## Final Summary

| Metric                | Value        |
| --------------------- | ------------ |
| Original TheBrain.jsx | 14,237 lines |
| Final TheBrain.jsx    | 3,962 lines  |
| Total lines removed   | 10,275       |
| Reduction             | **72%**      |
| New hook files        | 10           |
| New panel files       | 2            |
| New component files   | 16+          |
| New utility files     | 4            |
| Build status          | ✅ Passing   |

### What remains in TheBrain.jsx (3,962 lines)

- ~75 lines: imports
- ~215 lines: useState declarations (59 state variables)
- ~180 lines: hook calls + wiring (deps objects)
- ~200 lines: derived values, useEffects (comments, links, settings, checkin, notifications, keyboard shortcuts)
- ~55 lines: integrations config
- ~100 lines: tab definitions + keyboard shortcuts
- ~2,700 lines: top bar + navigation JSX (the orchestrator UI)
- ~400 lines: modal/overlay JSX

### Architecture

```
TheBrain.jsx (orchestrator)
  ├── hooks/useProjectCrud.js      → project CRUD + file ops
  ├── hooks/useStagingOps.js       → staging pipeline
  ├── hooks/useSessionOps.js       → ideas, sessions, checkins, training, outreach
  ├── hooks/useNotifications.js    → notification CRUD
  ├── hooks/useTaskOps.js          → task management + agent polling
  ├── hooks/useAI.js               → search, AI coach, context builder
  ├── hooks/useTagOps.jsx          → tag CRUD + QuickTagRow UI
  ├── hooks/useMetadata.js         → file metadata + AI suggestions
  ├── hooks/useDataSync.js         → seed defaults, cache sync, online status
  ├── hooks/useUndoRedo.js         → undo/redo history
  ├── hooks/useBreakpoint.js       → responsive breakpoints
  ├── panels/HubEditorPanel.jsx    → all hub tab content
  └── panels/BrainTabsPanel.jsx    → all brain tab content
```

---

## Guidance

- **Order matters**: utilities → standalone components → hooks → panels → cleanup
- **Risk mitigation**: After each step, run `npx vite build` to verify no breakage
- **Context maintenance**: Update dev-log.md after each step with line counts and issues
- **Zero behavior change**: This is a pure structural refactoring
