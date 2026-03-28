# Debug Session: The Brain v2.0 — Post-Refactor Bug Fixes

## Branch
`claude/review-codebase-vAOkc` (current commit: `3f5d057`)

## What happened
A large security hardening + code refactoring sprint was done in a single commit (`6bde806`). TheBrain.jsx (9000+ lines) was broken into extracted components and hooks. The refactoring introduced several "ReferenceError: X is not defined" bugs where functions/variables are used in extracted files but were never imported or passed as props.

## Already fixed
1. **`setShowGoalModal` not defined** — Added missing `useState` in `TheBrain.jsx:226` and wired it to the goal modal render condition at line ~2689
2. **`shouldShow` not defined** — Added missing import in `BrainTabsPanel.jsx:9`

## Known remaining bugs (found via code scan — NOT yet fixed)

### CRITICAL — Will crash on render:

**3. `src/components/CommandCentre.jsx`** — Multiple undefined variables:
- `isMobile` (line 66) — used but never received as prop
- `currentMode` (lines 145, 228, 250, 562, 680) — used in `getBehavior()` and `shouldShow()` calls but never defined
- `weeklyOutreach` (line 621) — used but never received as prop
- **Fix approach:** Check where CommandCentre is rendered in TheBrain.jsx and ensure these are passed as props. Then destructure them in CommandCentre's function signature.

### LIKELY TO CRASH — Missing styles/constants:

**4. `src/components/OnboardingWizard.jsx`** — `S.sel` used (lines 352, 368, 377) but never imported or defined.

**5. `src/components/ScriptRunner.jsx`** — `S.sel` used (line 241) but never imported or defined.

**6. `src/components/GitHubIntegration.jsx`** — `S.sel` used (line 100) but never imported or defined.

**7. `src/components/BootstrapWizard.jsx`** — `C.mono` used (line 436) but `C` object from constants.js has no `mono` property.

## How to fix each bug
For each bug:
1. Read the file to confirm the issue
2. Determine if the fix is an **import** (function exists elsewhere, just needs importing) or a **prop** (value comes from parent component, needs passing down) or a **definition** (needs to be added to constants/declared)
3. Apply the minimal fix
4. Commit with a descriptive message
5. After all fixes, push to branch

## Files changed in the refactoring (for reference)
The main extraction was from `src/TheBrain.jsx` into:
- `src/components/panels/BrainTabsPanel.jsx` — Brain tabs UI
- `src/components/panels/HubEditorPanel.jsx` — Hub/editor panel
- `src/components/CommandCentre.jsx` — Command palette
- `src/components/AICoach.jsx` — AI coaching panel
- `src/hooks/useAI.js`, `useDataSync.js`, `useMetadata.js`, `useNotifications.js`, `useProjectCrud.js`, `useSessionOps.js`, `useStagingOps.js`, `useTagOps.jsx`, `useTaskOps.js` — extracted hooks
- `src/utils/constants.js` — shared style/color constants (C, S objects)
- `src/modeHelper.js` — mode utilities (getMode, getBehavior, shouldShow, MODE_INFO)

## Important patterns
- **Color constants:** `C` object from `src/utils/constants.js` — colors like `C.bg`, `C.fg`, `C.accent`, `C.purple`, etc.
- **Style helpers:** `S` object from `src/utils/constants.js` — style functions like `S.btn()`, `S.card()`, `S.label()`, `S.sel`, `S.input`
- **Mode helpers:** `shouldShow(feature, mode)`, `getBehavior(feature, mode)`, `getMode()` from `src/modeHelper.js`
- **Props pattern:** Extracted components receive a `ctx` prop object from TheBrain.jsx containing state and setters

## Testing
The app is deployed on Vercel. After fixing, the app should load without hitting the ErrorBoundary "Something went wrong" screen. Check browser console for ReferenceErrors.

## Git workflow
- Branch: `claude/review-codebase-vAOkc`
- Commit each fix individually with clear messages
- Push with: `git push -u origin claude/review-codebase-vAOkc`
