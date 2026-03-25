/**
 * Remotion PoC Composition — Phase 1
 * Brain OS v2.2
 *
 * Validates: Does storyboard JSON map cleanly to a Remotion composition?
 * This is a proof-of-concept, not production code.
 *
 * To render: npx remotion render src/composition.tsx MainComposition --output=output.mp4
 */

import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// Types from storyboard JSON
interface Scene {
  scene_id: string;
  text: string;
  visual_type: 'stock_footage' | 'generated_still' | 'text_overlay';
  keywords: string[];
  duration_s: number;
  generation_prompt: string | null;
}

interface Segment {
  segment_id: number;
  scenes: Scene[];
}

interface Storyboard {
  title: string;
  duration_s: number;
  segments: Segment[];
}

// ── Scene Components ────────────────────────────────────────────

function TextOverlayScene({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = spring({
    frame,
    fps,
    config: { damping: 200, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{
      backgroundColor: '#0a0a0a',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 80,
    }}>
      <div style={{
        opacity,
        transform: `scale(${scale})`,
        color: '#e2e8f0',
        fontSize: 42,
        fontFamily: 'Georgia, serif',
        textAlign: 'center',
        lineHeight: 1.5,
        maxWidth: 900,
      }}>
        {scene.text}
      </div>
    </AbsoluteFill>
  );
}

function StockFootageScene({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Ken Burns effect: slow zoom
  const scale = interpolate(frame, [0, fps * scene.duration_s], [1, 1.08], {
    extrapolateRight: 'clamp',
  });

  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f172a' }}>
      {/* Placeholder for stock footage — actual image/video would go here */}
      <AbsoluteFill style={{
        opacity,
        transform: `scale(${scale})`,
        background: `linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{ color: '#475569', fontSize: 16, fontFamily: 'monospace' }}>
          [{scene.visual_type}] {scene.keywords.join(' | ')}
        </div>
      </AbsoluteFill>

      {/* Lower third caption */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 60,
        right: 60,
        opacity: interpolate(frame, [fps * 0.5, fps * 1], [0, 1], {
          extrapolateRight: 'clamp',
        }),
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          padding: '16px 24px',
          borderRadius: 8,
          color: '#e2e8f0',
          fontSize: 28,
          fontFamily: 'Georgia, serif',
          lineHeight: 1.4,
        }}>
          {scene.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function GeneratedStillScene({ scene }: { scene: Scene }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = interpolate(frame, [0, fps * scene.duration_s], [1.02, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <AbsoluteFill style={{
        transform: `scale(${scale})`,
        background: `linear-gradient(45deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)`,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <div style={{ color: '#6366f1', fontSize: 14, fontFamily: 'monospace', marginBottom: 12 }}>
          [AI Generated: {scene.generation_prompt?.substring(0, 60)}...]
        </div>
        <div style={{ color: '#475569', fontSize: 12 }}>
          {scene.keywords.join(' | ')}
        </div>
      </AbsoluteFill>

      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 60,
        right: 60,
      }}>
        <div style={{
          background: 'rgba(0,0,0,0.75)',
          padding: '16px 24px',
          borderRadius: 8,
          color: '#e2e8f0',
          fontSize: 28,
          fontFamily: 'Georgia, serif',
        }}>
          {scene.text}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Scene Router ────────────────────────────────────────────────

function SceneRenderer({ scene }: { scene: Scene }) {
  switch (scene.visual_type) {
    case 'text_overlay':
      return <TextOverlayScene scene={scene} />;
    case 'stock_footage':
      return <StockFootageScene scene={scene} />;
    case 'generated_still':
      return <GeneratedStillScene scene={scene} />;
    default:
      return <TextOverlayScene scene={scene} />;
  }
}

// ── Main Composition ────────────────────────────────────────────

export function MainComposition({ storyboard }: { storyboard: Storyboard }) {
  const { fps } = useVideoConfig();

  let frameOffset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {storyboard.segments.flatMap((segment) =>
        segment.scenes.map((scene) => {
          const durationInFrames = Math.round(scene.duration_s * fps);
          const from = frameOffset;
          frameOffset += durationInFrames;

          return (
            <Sequence
              key={scene.scene_id}
              from={from}
              durationInFrames={durationInFrames}
            >
              <SceneRenderer scene={scene} />
            </Sequence>
          );
        })
      )}
    </AbsoluteFill>
  );
}
