// api/executors/ClaudeCodeAdapter.js — CLI subprocess adapter (Phase 1)
// Brain OS v2.2
//
// Executes commands via child_process.spawn.
// Handles: pre_flight commands, main_command, artifact collection.

import { spawn } from 'child_process';

/**
 * Claude Code / Kilo Code CLI adapter.
 * Runs shell commands as subprocesses with output capture.
 */
export class ClaudeCodeAdapter {
  constructor(worker) {
    this.worker = worker;
    this.timeout = 3600000; // 1 hour default
  }

  /**
   * Execute an execution package via CLI subprocess.
   *
   * @param {object} execPkg - The execution_package portion of the full package
   * @returns {object} - { status, output, error, duration_ms }
   */
  async execute(execPkg) {
    const {
      pre_flight = [],
      main_command,
      artifacts = {},
      timeout,
    } = execPkg;

    const execTimeout = timeout || this.timeout;

    // Run pre-flight commands
    for (const cmd of pre_flight) {
      try {
        await this._runCommand(cmd, execTimeout);
      } catch (e) {
        return {
          status: 'failed',
          error: `Pre-flight failed: ${cmd} — ${e.message}`,
        };
      }
    }

    // Run main command
    if (!main_command) {
      return { status: 'failed', error: 'No main_command specified' };
    }

    try {
      const result = await this._runCommand(main_command, execTimeout);

      return {
        status: 'success',
        output: {
          uri: artifacts.output_path || null,
          stdout: result.stdout,
          exit_code: result.exitCode,
          checksum: null, // TODO: compute sha256 of output file
        },
        provider: 'claude-code-cli',
      };
    } catch (e) {
      return {
        status: 'failed',
        error: e.message,
        output: { stderr: e.stderr || '' },
      };
    }
  }

  /**
   * Run a single shell command as a subprocess.
   */
  _runCommand(command, timeout) {
    return new Promise((resolve, reject) => {
      const proc = spawn('sh', ['-c', command], {
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr, exitCode: code });
        } else {
          const err = new Error(`Command failed with exit code ${code}: ${stderr.slice(0, 500)}`);
          err.stderr = stderr;
          err.exitCode = code;
          reject(err);
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn process: ${err.message}`));
      });
    });
  }
}

export default ClaudeCodeAdapter;
