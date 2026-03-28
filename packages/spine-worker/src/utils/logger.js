/**
 * Logger Utility
 * 
 * Colored console output with log history for reporting.
 */

import chalk from 'chalk';

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

  _log(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const text = args.length > 0 ? `${message} ${args.join(' ')}` : message;
    
    this.logs.push({
      timestamp,
      level,
      message: text
    });
    
    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console output with colors
    const prefix = `[${timestamp.split('T')[1].slice(0, 8)}]`;
    
    switch (level) {
      case 'error':
        console.error(chalk.red(`${prefix} ❌ ${text}`));
        break;
      case 'warn':
        console.warn(chalk.yellow(`${prefix} ⚠️  ${text}`));
        break;
      case 'success':
        console.log(chalk.green(`${prefix} ✅ ${text}`));
        break;
      case 'job':
        console.log(chalk.cyan(`${prefix} 🎯 ${text}`));
        break;
      case 'debug':
        if (process.env.DEBUG) {
          console.log(chalk.gray(`${prefix} ${text}`));
        }
        break;
      default:
        console.log(chalk.gray(prefix), text);
    }
  }

  info(message, ...args) {
    this._log('info', message, ...args);
  }

  error(message, ...args) {
    this._log('error', message, ...args);
  }

  warn(message, ...args) {
    this._log('warn', message, ...args);
  }

  success(message, ...args) {
    this._log('success', message, ...args);
  }

  job(message, ...args) {
    this._log('job', message, ...args);
  }

  debug(message, ...args) {
    this._log('debug', message, ...args);
  }

  getRecentLogs(count = 100) {
    return this.logs.slice(-count);
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
export default logger;
