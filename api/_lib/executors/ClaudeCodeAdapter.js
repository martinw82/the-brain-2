/**
 * Claude Code Adapter
 * Phase 1 - v2.2 Architecture
 * 
 * CLI subprocess adapter for local execution.
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ClaudeCodeAdapter {
  constructor(workerConfig) {
    this.workerId = workerConfig.worker_id;
    this.capabilities = workerConfig.capabilities || {};
    this.config = {
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
      timeout: 3600000,
      maxOutputSize: 100 * 1024 * 100,
      ...workerConfig.config,
    };
  }

  async execute(executionPackage, options = {}) {
    const { 
      pre_flight = [], 
      main_command, 
      artifacts = {},
      fallback,
    } = executionPackage.execution_package;
    
    const startTime = Date.now();
    const executionId = executionPackage.execution_id;
    
    const workDir = await this._createWorkDir(executionId);
    
    try {
      for (const cmd of pre_flight) {
        await this._runCommand(cmd, workDir, options.onProgress);
      }
      
      const output = await this._runCommand(main_command, workDir, options.onProgress, options.timeout);
      
      const resultArtifacts = {};
      if (artifacts.output_path) {
        try {
          const outputContent = await fs.readFile(artifacts.output_path);
          const checksum = crypto.createHash('sha256').update(outputContent).digest('hex');
          
          resultArtifacts.output = {
            path: artifacts.output_path,
            checksum: `sha256:${checksum}`,
            size: outputContent.length,
          };
          
          if (artifacts.cleanup) {
            await fs.unlink(artifacts.output_path).catch(() => {});
          }
        } catch (err) {
          console.error('Artifact collection failed:', err);
        }
      }
      
      const duration = Date.now() - startTime;
      
      return {
        status: 'success',
        output: {
          uri: executionPackage.brain_context.output_uris?.[0],
          ...resultArtifacts.output,
        },
        stdout: output.stdout,
        stderr: output.stderr,
        exit_code: output.exitCode,
        duration_ms: duration,
        provider: 'claude-code-local',
        cost_usd: 0,
        tokens_used: 0,
      };
      
    } catch (error) {
      if (fallback) {
        console.log(`Primary execution failed, trying fallback: ${fallback.strategy}`);
        return this._executeFallback(fallback, executionPackage, options);
      }
      
      return {
        status: 'failed',
        error: error.message,
        stdout: error.stdout,
        stderr: error.stderr,
        exit_code: error.exitCode || 1,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      await this._cleanupWorkDir(workDir);
    }
  }

  _runCommand(command, cwd, onProgress, timeout = this.config.timeout) {
    return new Promise((resolve, reject) => {
      const stdout = [];
      const stderr = [];
      
      const child = spawn(this.config.shell, 
        process.platform === 'win32' ? ['-Command', command] : ['-c', command],
        { cwd, env: { ...process.env, NODE_ENV: 'production' } }
      );
      
      let timeoutId;
      if (timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      }
      
      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout.push(chunk);
        if (onProgress) onProgress({ type: 'stdout', data: chunk, timestamp: Date.now() });
        
        const totalSize = stdout.join('').length + stderr.join('').length;
        if (totalSize > this.config.maxOutputSize) {
          child.kill('SIGTERM');
          reject(new Error('Output size exceeded maximum'));
        }
      });
      
      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr.push(chunk);
        if (onProgress) onProgress({ type: 'stderr', data: chunk, timestamp: Date.now() });
      });
      
      child.on('close', (exitCode) => {
        if (timeoutId) clearTimeout(timeoutId);
        const result = { stdout: stdout.join(''), stderr: stderr.join(''), exitCode };
        if (exitCode === 0) resolve(result);
        else {
          const error = new Error(`Command failed with exit code ${exitCode}`);
          error.stdout = result.stdout;
          error.stderr = result.stderr;
          error.exitCode = exitCode;
          reject(error);
        }
      });
      
      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async _executeFallback(fallback, executionPackage, options) {
    return {
      status: 'failed',
      error: `Fallback ${fallback.strategy} not implemented`,
    };
  }

  async _createWorkDir(executionId) {
    const tmpDir = process.env.TMPDIR || process.env.TEMP || (process.platform === 'win32' ? 'C:\\temp' : '/tmp');
    const workDir = path.join(tmpDir, `brain-execution-${executionId}`);
    await fs.mkdir(workDir, { recursive: true });
    return workDir;
  }

  async _cleanupWorkDir(workDir) {
    try {
      await fs.rm(workDir, { recursive: true, force: true });
    } catch (err) {
      console.error('WorkDir cleanup failed:', err);
    }
  }

  canHandle(capabilities) {
    const supported = ['shell', 'filesystem', 'node', 'npm'];
    return capabilities.every(cap => supported.includes(cap));
  }
}

export default ClaudeCodeAdapter;
