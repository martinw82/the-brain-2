/**
 * Remotion Executor
 * 
 * Renders videos using Remotion based on storyboard JSON.
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class RemotionExecutor {
  constructor(worker) {
    this.worker = worker;
  }

  async execute(job) {
    const { 
      storyboard_json, 
      output_format = 'mp4',
      output_resolution = '1080p',
      composition_id = 'Main'
    } = job.payload;

    // 1. Create temp workspace
    const workDir = await this.createWorkspace(job.job_id);
    logger.info('Workspace:', workDir);

    try {
      // 2. Write storyboard to file
      const storyboardPath = path.join(workDir, 'storyboard.json');
      await fs.writeJson(storyboardPath, storyboard_json, { spaces: 2 });
      logger.info('Storyboard written');

      // 3. Generate Remotion composition
      await this.generateComposition(workDir, storyboard_json, composition_id);
      logger.info('Composition generated');

      // 4. Install Remotion dependencies if needed
      await this.ensureRemotion(workDir);

      // 5. Run Remotion render
      const outputPath = path.join(workDir, `output.${output_format}`);
      await this.runRender(workDir, composition_id, outputPath, storyboardPath, output_resolution);
      logger.success('Render complete:', outputPath);

      // 6. Verify output
      if (!await fs.pathExists(outputPath)) {
        throw new Error('Output file not created');
      }

      const stats = await fs.stat(outputPath);
      logger.info('Output size:', this.formatBytes(stats.size));

      // 7. Calculate checksum
      const checksum = await this.calculateChecksum(outputPath);

      // 8. For now, return local path (future: upload to cloud)
      // In production, you'd upload to S3/R2 and return a URL
      return {
        file_path: outputPath,
        file_size: stats.size,
        checksum,
        format: output_format,
        resolution: output_resolution,
        work_dir: workDir // Keep for cleanup or reference
      };

    } catch (e) {
      // Cleanup on error
      await this.cleanup(workDir);
      throw e;
    }
  }

  async createWorkspace(jobId) {
    const baseDir = path.join(os.tmpdir(), 'spine-worker', jobId);
    await fs.ensureDir(baseDir);
    return baseDir;
  }

  async generateComposition(workDir, storyboard, compositionId) {
    // Generate a basic Remotion composition that loads the storyboard
    const compositionCode = `
import React from 'react';
import { Composition, AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Series } from 'remotion';

// Load storyboard
const storyboard = require('./storyboard.json');

// Scene components
const KenBurnsScene = ({ imageUrl, durationInFrames, zoomDirection, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
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
          backgroundImage: \`url(\${imageUrl})\`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: \`scale(\${scale})\`,
        }}
      />
      {text && (
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
          <h2 style={{ color: 'white', fontSize: 48, margin: 0, textAlign: 'center' }}>
            {text}
          </h2>
        </div>
      )}
    </AbsoluteFill>
  );
};

const TextOverlayScene = ({ text, backgroundColor = '#1a1a1a' }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1 style={{ color: 'white', fontSize: 64, textAlign: 'center', padding: '0 80px' }}>
        {text}
      </h1>
    </AbsoluteFill>
  );
};

const MapMarkerScene = ({ location }) => {
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
        }}
      />
      <h2 style={{ color: 'white', fontSize: 48, marginTop: 40 }}>
        {location}
      </h2>
    </AbsoluteFill>
  );
};

const ImageGridScene = ({ images }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: \`repeat(\${images.length}, 1fr)\`,
          gap: 20,
          padding: 40,
          height: '100%',
        }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            style={{
              backgroundImage: \`url(\${img})\`,
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

// Main composition
export const VideoComposition = () => {
  const { fps } = useVideoConfig();
  
  // Flatten all scenes from segments
  const allScenes = [];
  for (const segment of storyboard.segments || []) {
    for (const scene of segment.scenes || []) {
      allScenes.push(scene);
    }
  }
  
  return (
    <Series>
      {allScenes.map((scene, index) => {
        const durationInFrames = (scene.duration_s || 5) * fps;
        
        let component;
        switch (scene.visual_type) {
          case 'ken_burns':
            component = (
              <KenBurnsScene
                imageUrl={scene.image_url}
                durationInFrames={durationInFrames}
                zoomDirection={scene.zoom_direction || 'in'}
                text={scene.text}
              />
            );
            break;
          case 'text_overlay':
            component = <TextOverlayScene text={scene.text} backgroundColor={scene.background_color} />;
            break;
          case 'map_marker':
            component = <MapMarkerScene location={scene.location} />;
            break;
          case 'image_grid':
            component = <ImageGridScene images={scene.images || []} />;
            break;
          default:
            component = <TextOverlayScene text={scene.text} />;
        }
        
        return (
          <Series.Sequence key={index} durationInFrames={durationInFrames}>
            {component}
          </Series.Sequence>
        );
      })}
    </Series>
  );
};

// Calculate total duration
let totalSeconds = 0;
for (const segment of storyboard.segments || []) {
  for (const scene of segment.scenes || []) {
    totalSeconds += scene.duration_s || 5;
  }
}

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="${compositionId}"
        component={VideoComposition}
        durationInFrames={totalSeconds * 30}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

export default RemotionRoot;
`;

    const compositionPath = path.join(workDir, 'composition.tsx');
    await fs.writeFile(compositionPath, compositionCode);
  }

  async ensureRemotion(workDir) {
    // Check if Remotion is installed globally or locally
    const packageJsonPath = path.join(workDir, 'package.json');
    
    const packageJson = {
      name: 'spine-render-job',
      version: '1.0.0',
      dependencies: {
        'remotion': '^4.0.0',
        '@remotion/cli': '^4.0.0',
        'react': '^18.0.0',
        'react-dom': '^18.0.0'
      }
    };
    
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
    
    // Install dependencies
    logger.info('Installing Remotion dependencies...');
    await this.runCommand('npm', ['install'], { cwd: workDir });
  }

  async runRender(workDir, compositionId, outputPath, storyboardPath, resolution) {
    const args = [
      'remotion', 'render',
      'composition.tsx',
      compositionId,
      outputPath,
      '--props=storyboard.json',
      '--codec=h264'
    ];

    // Add resolution settings
    if (resolution === '1080p') {
      // Default 1920x1080
    } else if (resolution === '4k') {
      args.push('--width=3840', '--height=2160');
    } else if (resolution === '720p') {
      args.push('--width=1280', '--height=720');
    }

    logger.info('Starting render...');
    
    return new Promise((resolve, reject) => {
      const proc = spawn('npx', args, {
        cwd: workDir,
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const line = data.toString();
        stdout += line;
        
        // Parse progress from Remotion output
        if (line.includes('Rendered')) {
          logger.info(line.trim());
        } else if (line.includes('Encoding')) {
          logger.info(line.trim());
        }
      });

      proc.stderr.on('data', (data) => {
        const line = data.toString();
        stderr += line;
        logger.debug('Render:', line.trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Render failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to start render: ${err.message}`));
      });
    });
  }

  async calculateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async cleanup(workDir) {
    // Optional: cleanup temp files
    // await fs.remove(workDir);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default RemotionExecutor;
