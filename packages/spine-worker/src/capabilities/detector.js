/**
 * Capability Detector
 * 
 * Auto-detects system capabilities for the worker.
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';

export async function detectCapabilities() {
  const caps = {
    platform: `${process.platform}/${process.arch}`,
    node: process.version,
    hostname: os.hostname(),
    cpus: os.cpus().length,
    memory_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
  };

  // Detect Remotion
  caps['video.render'] = await detectRemotion();
  
  // Detect FFmpeg
  caps['ffmpeg'] = await detectFFmpeg();
  
  // Detect Git
  caps['git'] = await detectCommand('git');
  
  // Detect Docker
  caps['docker'] = await detectCommand('docker');
  
  // Detect shell
  caps['shell'] = true;
  
  // Detect Python
  caps['python'] = await detectCommand('python') || await detectCommand('python3');
  
  // File handling
  caps['max_file_size_mb'] = 500; // Conservative default
  
  return caps;
}

async function detectRemotion() {
  try {
    // Check if remotion is installed globally
    execSync('npx remotion --version', { stdio: 'ignore' });
    return {
      available: true,
      engine: 'remotion',
      method: 'npx',
      supported_formats: ['mp4', 'webm', 'mov', 'prores']
    };
  } catch {
    return {
      available: false,
      reason: 'Remotion not installed. Run: npm install -g remotion'
    };
  }
}

async function detectFFmpeg() {
  try {
    const version = execSync('ffmpeg -version', { encoding: 'utf8' });
    const match = version.match(/ffmpeg version ([\d.]+)/);
    return {
      available: true,
      version: match ? match[1] : 'unknown'
    };
  } catch {
    return {
      available: false,
      reason: 'FFmpeg not installed'
    };
  }
}

async function detectCommand(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export default { detectCapabilities };
