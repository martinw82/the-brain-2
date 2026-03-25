/**
 * Remotion Proof of Concept Composition
 * 
 * Tests:
 * 1. Can npx remotion render execute in subprocess?
 * 2. Does storyboard JSON map cleanly to component?
 * 3. What is render time and file size for 60s clip?
 */

import React from 'react';
import {
  Composition,
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from 'remotion';

// Scene components
const KenBurnsScene: React.FC<{
  imageUrl: string;
  durationInFrames: number;
  zoomDirection: 'in' | 'out';
  text: string;
}> = ({ imageUrl, durationInFrames, zoomDirection, text }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const scale = interpolate(
    frame,
    [0, durationInFrames],
    zoomDirection === 'in' ? [1, 1.2] : [1.2, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `scale(${scale})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 100,
          left: 0,
          right: 0,
          padding: '40px 80px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        }}
      >
        <h2
          style={{
            color: 'white',
            fontSize: 48,
            fontFamily: 'Inter, sans-serif',
            margin: 0,
            textAlign: 'center',
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          {text}
        </h2>
      </div>
    </AbsoluteFill>
  );
};

const TextOverlayScene: React.FC<{
  text: string;
  backgroundColor: string;
}> = ({ text, backgroundColor }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1
        style={{
          color: 'white',
          fontSize: 64,
          fontFamily: 'Inter, sans-serif',
          textAlign: 'center',
          padding: '0 80px',
          textShadow: '0 4px 8px rgba(0,0,0,0.3)',
        }}
      >
        {text}
      </h1>
    </AbsoluteFill>
  );
};

const MapMarkerScene: React.FC<{
  location: string;
}> = ({ location }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #e94560 0%, transparent 70%)',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      <h2
        style={{
          color: 'white',
          fontSize: 48,
          fontFamily: 'Inter, sans-serif',
          marginTop: 40,
        }}
      >
        {location}
      </h2>
    </AbsoluteFill>
  );
};

const ImageGridScene: React.FC<{
  images: string[];
}> = ({ images }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${images.length}, 1fr)`,
          gap: 20,
          padding: 40,
          height: '100%',
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            style={{
              backgroundImage: `url(${img})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: 8,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Main Documentary composition
export const DocumentaryComposition: React.FC<{
  storyboard: {
    segments: Array<{
      scenes: Array<{
        scene_id: string;
        text: string;
        visual_type: string;
        image_url?: string;
        background_color?: string;
        duration_s: number;
        zoom_direction?: 'in' | 'out';
        images?: string[];
        location?: string;
      }>;
    }>;
    title: string;
  };
}> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  // Flatten scenes with timing
  let currentFrame = 0;
  const scenes: Array<{
    scene: any;
    startFrame: number;
    endFrame: number;
  }> = [];
  
  for (const segment of storyboard.segments) {
    for (const scene of segment.scenes) {
      const durationFrames = scene.duration_s * fps;
      scenes.push({
        scene,
        startFrame: currentFrame,
        endFrame: currentFrame + durationFrames,
      });
      currentFrame += durationFrames;
    }
  }
  
  // Find current scene
  const currentScene = scenes.find(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );
  
  if (!currentScene) {
    return <AbsoluteFill style={{ backgroundColor: '#000' }} />;
  }
  
  const { scene } = currentScene;
  
  // Render based on visual type
  switch (scene.visual_type) {
    case 'ken_burns':
      return (
        <KenBurnsScene
          imageUrl={scene.image_url || ''}
          durationInFrames={scene.duration_s * fps}
          zoomDirection={scene.zoom_direction || 'in'}
          text={scene.text}
        />
      );
      
    case 'text_overlay':
      return (
        <TextOverlayScene
          text={scene.text}
          backgroundColor={scene.background_color || '#1a1a1a'}
        />
      );
      
    case 'map_marker':
      return <MapMarkerScene location={scene.location || ''} />;
      
    case 'image_grid':
      return <ImageGridScene images={scene.images || []} />;
      
    default:
      return (
        <TextOverlayScene
          text={scene.text}
          backgroundColor="#1a1a1a"
        />
      );
  }
};

// Remotion root component
export const RemotionRoot: React.FC = () => {
  // Load storyboard from props or file
  const storyboard = require('./storyboard-mock.json');
  
  // Calculate total duration
  let totalSeconds = 0;
  for (const segment of storyboard.segments) {
    for (const scene of segment.scenes) {
      totalSeconds += scene.duration_s;
    }
  }
  
  return (
    <>
      <Composition
        id="TestDocumentary"
        component={DocumentaryComposition}
        durationInFrames={totalSeconds * 30}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          storyboard,
        }}
      />
    </>
  );
};

export default RemotionRoot;
