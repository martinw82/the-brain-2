/**
 * SSE Connector
 * 
 * Uses Server-Sent Events to receive jobs from Spine in real-time.
 * Falls back to polling if SSE is not available.
 */

import EventEmitter from 'events';
import EventSource from 'eventsource';
import chalk from 'chalk';
import { logger } from '../utils/logger.js';

export class SSEConnector extends EventEmitter {
  constructor(worker) {
    super();
    this.worker = worker;
    this.eventSource = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
  }

  async connect() {
    const url = `${this.worker.config.spine_url}/api/worker?action=sse&token=${this.worker.workerToken}`;
    
    logger.info('Connecting via SSE...');
    
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(url);

      // Connection opened
      this.eventSource.onopen = () => {
        logger.success('SSE connection established');
        this.startHeartbeat();
        resolve();
      };

      // Connected event
      this.eventSource.addEventListener('connected', (e) => {
        const data = JSON.parse(e.data);
        logger.info('Worker status:', data.status);
        this.emit('connected', data);
      });

      // Job assigned event
      this.eventSource.addEventListener('job_assigned', (e) => {
        const job = JSON.parse(e.data);
        this.emit('job', job);
      });

      // Heartbeat event
      this.eventSource.addEventListener('heartbeat', (e) => {
        const data = JSON.parse(e.data);
        logger.debug('Heartbeat received:', data.timestamp);
      });

      // Error handling
      this.eventSource.onerror = (err) => {
        logger.error('SSE error:', err.message || 'Connection failed');
        this.emit('error', err);
        
        // Don't reject here - let reconnection logic handle it
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
    });
  }

  async disconnect() {
    logger.info('Closing SSE connection...');
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.emit('disconnected');
  }

  startHeartbeat() {
    // Send heartbeat to Spine periodically
    const interval = (this.worker.config.connection?.heartbeat_interval || 30) * 1000;
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetch(`${this.worker.config.spine_url}/api/worker?action=heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.worker.workerToken}`
          },
          body: JSON.stringify({
            status: this.worker.status,
            current_job: this.worker.currentJob?.job_id || null
          })
        });
      } catch (e) {
        logger.debug('Heartbeat failed:', e.message);
      }
    }, interval);
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return; // Already scheduled
    
    const delay = (this.worker.config.connection?.reconnect_interval || 5) * 1000;
    logger.info(`Reconnecting in ${delay/1000}s...`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (e) {
        logger.error('Reconnection failed:', e.message);
        this.scheduleReconnect();
      }
    }, delay);
  }
}

export default SSEConnector;
