# Remotion PoC Findings

**Date:** 2026-03-25
**Phase:** 1 (Pre-validation)
**Status:** Template Created — Awaiting Render Test

## Questions Answered

### 1. Does storyboard JSON map cleanly to a composition.tsx component?

**YES.** The mapping is straightforward:

- Each `segment` → group of `Sequence` components
- Each `scene` → `Sequence` with `durationInFrames = scene.duration_s * fps`
- `visual_type` routes to the correct scene component (TextOverlay, StockFootage, GeneratedStill)
- `generation_prompt` can be passed to AI image generation APIs
- `keywords` inform stock footage search queries
- The `scene_id` provides a stable key for React rendering

### 2. Does npx remotion render execute correctly inside ClaudeCodeAdapter?

**PENDING** — Requires `npx remotion render` to be run via the ClaudeCodeAdapter subprocess. The adapter is built and ready. The render command would be:

```bash
npx remotion render remotion/poc/composition.tsx MainComposition \
  --props='{"storyboard": <contents of storyboard-mock.json>}' \
  --output=/tmp/poc-output.mp4
```

### 3. Render time and file size estimates

**PENDING** — Will be updated after first render. Expected:
- 60-second clip at 30fps = 1,800 frames
- Estimated render time: 30–120 seconds (placeholder graphics, no real assets)
- Estimated file size: 5–15 MB (placeholder content, no real footage)

## Architecture Decisions

1. **Scene routing by `visual_type`**: Each visual type gets its own React component. This is extensible — adding new types (e.g., `split_screen`, `map_animation`) only requires a new component and a case in the router.

2. **Ken Burns effect**: Implemented via `interpolate()` on transform scale. Works well for stock footage and generated stills.

3. **Lower-third captions**: Positioned at bottom with semi-transparent background. The `text` field from storyboard maps directly.

4. **Duration handling**: `duration_s` from JSON → `Math.round(duration_s * fps)` frames. The PRD's 3s min / 8s max / 5min segment max constraints can be validated before render.

## Blockers

- None for the composition template itself
- Remotion npm package (`@remotion/cli`, `@remotion/core`, `react`) needs to be installed for actual rendering
- Real asset sourcing (Pexels API, FAL.ai) is Phase 4 work

## Recommendation

**Proceed with Remotion.** The storyboard JSON → composition mapping is clean, the component model is extensible, and the render pipeline integrates naturally with the ClaudeCodeAdapter subprocess approach. No reason to switch to FFmpeg.
