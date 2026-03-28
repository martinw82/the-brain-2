/**
 * Shell Executor
 * 
 * Executes generic shell commands safely.
 */

import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export class ShellExecutor {
  constructor(worker) {
    this.worker = worker;
    
    // Blocked commands for security
    this.blockedCommands = [
      'rm -rf /',
      'sudo',
      'su ',
      'passwd',
      'mkfs',
      'dd if',
      '> /dev/',
      ':(){ :|:& };:', // fork bomb
    ];
    
    // Allowed commands whitelist (optional - if empty, all except blocked are allowed)
    this.allowedCommands = [];
  }

  async execute(job) {
    const { 
      command, 
      args = [], 
      cwd,
      env = {},
      timeout = 300000 // 5 minutes default
    } = job.payload;

    // Validate command
    this.validateCommand(command, args);

    logger.info('Executing:', command, args.join(' '));

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
        timeout,
        shell: false // Don't use shell to prevent injection
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        const line = data.toString();
        stdout += line;
        logger.debug('stdout:', line.trim());
      });

      proc.stderr.on('data', (data) => {
        const line = data.toString();
        stderr += line;
        logger.debug('stderr:', line.trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({
            exit_code: code,
            stdout: stdout.slice(0, 10000), // Limit output size
            stderr: stderr.slice(0, 5000)
          });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to execute command: ${err.message}`));
      });
    });
  }

  validateCommand(command, args) {
    const fullCommand = `${command} ${args.join(' ')}`;
    
    // Check blocked commands
    for (const blocked of this.blockedCommands) {
      if (fullCommand.includes(blocked)) {
        throw new Error(`Command blocked for security: ${blocked}`);
      }
    }
    
    // If whitelist is defined, check against it
    if (this.allowedCommands.length > 0) {
      const isAllowed = this.allowedCommands.some(allowed => 
        command === allowed || command.endsWith(`/${allowed}`)
      );
      
      if (!isAllowed) {
        throw new Error(`Command not in whitelist: ${command}`);
      }
    }
    
    return true;
  }
}

export default ShellExecutor;
