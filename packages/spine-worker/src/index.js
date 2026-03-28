/**
 * Spine Worker - Main Class
 * 
 * Manages connection to Spine, receives jobs, executes them,
 * and reports results back.
 */

import EventEmitter from 'events';
import chalk from 'chalk';
import { SSEConnector } from './connector/SSEConnector.js';
import { PollingConnector } from './connector/PollingConnector.js';
import { RemotionExecutor } from './executors/RemotionExecutor.js';
import { ShellExecutor } from './executors/ShellExecutor.js';
import { detectCapabilities } from './capabilities/detector.js';
import { logger } from './utils/logger.js';

export class SpineWorker extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.status = 'idle'; // idle, connecting, online, busy, error
    this.currentJob = null;
    this.connector = null;
    this.capabilities = {};
    this.workerToken = null;
    
    // Executor registry
    this.executors = {
      'video.render': new RemotionExecutor(this),
      'shell.execute': new ShellExecutor(this),
    };
  }

  async start() {
    try {
      this.status = 'connecting';
      
      // 1. Detect capabilities
      logger.info('Detecting capabilities...');
      this.capabilities = await detectCapabilities();
      
      // Merge with config capabilities
      if (this.config.capabilities) {
        this.capabilities = {
          ...this.capabilities,
          ...this.config.capabilities
        };
      }
      
      logger.info('Capabilities:', Object.keys(this.capabilities).join(', '));

      // 2. Register with Spine
      logger.info('Registering with Spine...');
      await this.register();

      // 3. Start connection based on protocol
      const protocol = this.config.connection?.protocol || 'sse';
      
      if (protocol === 'sse') {
        this.connector = new SSEConnector(this);
      } else if (protocol === 'polling') {
        this.connector = new PollingConnector(this);
      } else {
        throw new Error(`Unknown protocol: ${protocol}`);
      }

      // 4. Connect and start listening
      await this.connector.connect();
      
      this.status = 'online';
      logger.success('Worker is online and waiting for jobs');
      console.log(chalk.gray('\nWaiting for jobs... (Press Ctrl+C to stop)\n'));

      // Listen for jobs
      this.connector.on('job', (job) => this.handleJob(job));
      this.connector.on('error', (err) => this.handleError(err));
      this.connector.on('disconnected', () => this.handleDisconnect());

    } catch (e) {
      this.status = 'error';
      logger.error('Failed to start:', e.message);
      throw e;
    }
  }

  async stop() {
    logger.info('Stopping worker...');
    
    if (this.currentJob) {
      logger.warn('Cancelling current job...');
      // Cancel current job if possible
    }
    
    if (this.connector) {
      await this.connector.disconnect();
    }
    
    this.status = 'idle';
    logger.success('Worker stopped');
  }

  async register() {
    const response = await fetch(`${this.config.spine_url}/api/worker?action=register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.auth_token}`
      },
      body: JSON.stringify({
        worker_id: this.config.worker_id,
        capabilities: this.capabilities,
        platform: `${process.platform}/${process.arch}`,
        hostname: require('os').hostname(),
        supported_protocols: ['sse', 'polling']
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Registration failed: ${error}`);
    }

    const data = await response.json();
    this.workerToken = data.token;
    
    logger.success('Registered with worker ID:', data.worker_id);
    
    return data;
  }

  async handleJob(job) {
    try {
      this.status = 'busy';
      this.currentJob = job;
      
      logger.job(`Received job: ${job.job_type} (${job.job_id})`);
      console.log(chalk.gray(`  Project: ${job.project_id}`));
      console.log();

      // Get executor for this job type
      const executor = this.executors[job.job_type];
      
      if (!executor) {
        throw new Error(`No executor available for job type: ${job.job_type}`);
      }

      // Execute job
      logger.info(`Executing ${job.job_type}...`);
      const startTime = Date.now();
      
      const result = await executor.execute(job);
      
      const duration = Date.now() - startTime;
      logger.success(`Job completed in ${duration}ms`);

      // Report success
      await this.reportResult(job.job_id, 'success', result);

    } catch (e) {
      logger.error('Job failed:', e.message);
      
      // Report failure
      await this.reportResult(job.job_id, 'failed', null, e.message);
      
    } finally {
      this.status = 'online';
      this.currentJob = null;
      console.log(chalk.gray('\nWaiting for next job...\n'));
    }
  }

  async reportResult(jobId, status, result, error = null) {
    const response = await fetch(`${this.config.spine_url}/api/worker?action=result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.workerToken}`
      },
      body: JSON.stringify({
        job_id: jobId,
        status,
        result,
        error,
        logs: logger.getRecentLogs()
      })
    });

    if (!response.ok) {
      const err = await response.text();
      logger.error('Failed to report result:', err);
    } else {
      logger.success('Result reported to Spine');
    }
  }

  handleError(err) {
    logger.error('Connection error:', err.message);
    this.status = 'error';
    
    // Attempt reconnection
    setTimeout(() => {
      if (this.status !== 'online') {
        logger.info('Attempting to reconnect...');
        this.connector.connect().catch(e => {
          logger.error('Reconnection failed:', e.message);
        });
      }
    }, (this.config.connection?.reconnect_interval || 5) * 1000);
  }

  handleDisconnect() {
    logger.warn('Disconnected from Spine');
    this.status = 'offline';
  }
}

export default SpineWorker;
