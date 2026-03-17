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
│   └── UI/         # AreaPill, TagPill, Dots, HealthBar, Modal, Toast, etc.
├── utils/          # pure helpers (projectFactory, renderers, fileHandlers, constants)
└── TheBrain.jsx    # thin orchestrator + imports
```

---

## Progress

| Task | Status | Lines Removed | Commit |
|------|--------|---------------|--------|
| Task 0 — Setup | ✅ Done | 0 | `refactor: setup module folders` |
| Task 1 — Extract utilities | ✅ Done | -540 | `refactor: extract pure utilities` |
| Step A — Standalone components | ✅ Done | -5,029 | `refactor: remove 5029 lines of extracted code` |
| Step B — Internal hooks | 🔄 In Progress | -620 so far | B1+B2 wired, B3-B8 files created |
| Step C — Domain panels | 🔲 Pending | ~3,400 est. | — |
| Step D — Cleanup & polish | 🔲 Pending | — | — |

**Current TheBrain.jsx**: 8,065 lines (down from 14,237)

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

## Step B — Extract Internal Hooks (Tasks 2+3 combined)

Functions inside the main TheBrain component are coupled to 60+ state variables. Approach: hooks accept a deps object and return operations.

### `src/hooks/useProjectLogic.js`
- openHub, saveFile, createProject, updateProject, renameProject, deleteProject, importProject, completeBootstrap, exportProject, addCustomFolder, createFile, deleteFile

### `src/hooks/useAI.js`
- askAI, buildCtx, buildBrief + AI state

### `src/hooks/useStaging.js`
- addStaging, updateStagingStatus, moveToFolder

### `src/hooks/useIdeas.js`
- addIdea

### `src/hooks/useSession.js`
- endSession, saveCheckin, saveTraining, saveOutreach + timer state

### `src/hooks/useTasks.js`
- loadTasks, createTask, completeTask, deleteTask + agent polling

**Expected:** ~1,200 lines removed

---

## Step C — Extract Domain Panels (Task 6)

Extract JSX blocks from the return statement into prop-receiving components.

- `src/components/ProjectsPanel.jsx` — project cards, bootstrap, health scores
- `src/components/StagingPanel.jsx` — staging review UI
- `src/components/TagCloudPanel.jsx` — tag browser
- `src/components/AICoachPanel.jsx` — AI coach interface
- `src/components/HubEditor.jsx` — hub tabs: overview, devlog, gantt, comments, links, meta

**Expected:** ~2,000 lines removed

---

## Step D — Cleanup & Polish (Task 7)

- Extract remaining inline functions to `src/utils/renderers.js`
- Move leftover constants to `src/utils/constants.js`
- Update all imports, ensure barrel files export everything
- Run lint + prettier
- Verify build succeeds
- Final target: TheBrain.jsx < 2,000 lines
- Update dev-log.md with full summary

---

## Guidance

- **Order matters**: utilities → standalone components → hooks → panels → cleanup
- **Risk mitigation**: After each step, run `npx vite build` to verify no breakage
- **Context maintenance**: Update dev-log.md after each step with line counts and issues
- **Zero behavior change**: This is a pure structural refactoring
