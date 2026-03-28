/**
 * Polling Connector
 * 
 * Fallback connector that polls for jobs via HTTP.
 * Used when SSE is not available or as backup.
 */

import EventEmitter from 'events';
import { logger } from '../utils/logger.js';

export class PollingConnector extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.pollingTimer = null;
    this.isRunning = false;
  }

  async connect() {
    logger.info('Starting polling connector...');
    this.isRunning = true;
    this.startPolling();
    this.emit('connected');
  }

  async disconnect() {
    logger.info('Stopping polling connector...');
    this.isRunning = false;
    
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    
    this.emit('disconnected');
  }

  startPolling() {
    const poll = async () => {
      if (!this.isRunning) return;
      
      try {
        const response = await fetch(
          `${this.worker.config.spine_url}/api/worker?action=poll`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${this.worker.workerToken}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Poll failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.jobs && data.jobs.length > 0) {
          for (const job of data.jobs) {
            this.emit('job', job);
          }
        }
      } catch (e) {
        logger.error('Poll error:', e.message);
        this.emit('error', e);
      }
      
      // Schedule next poll
      if (this.isRunning) {
        const interval = (this.worker.config.connection?.poll_interval || 10) * 1000;
        this.pollingTimer = setTimeout(poll, interval);
      }
    };
    
    // Start first poll immediately
    poll();
  }
}

export default PollingConnector;
