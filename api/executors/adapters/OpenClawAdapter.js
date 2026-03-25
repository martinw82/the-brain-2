/**
 * OpenClaw Adapter
 * Phase 1 - v2.2 Architecture
 * 
 * WebSocket/JSON-RPC adapter for browser automation workers.
 * Communicates with Playwright-based workers for web scraping and form submission.
 */

import WebSocket from 'ws';

export class OpenClawAdapter {
  constructor(workerConfig) {
    this.workerId = workerConfig.worker_id;
    this.capabilities = workerConfig.capabilities || {};
    this.config = {
      host: 'localhost',
      port: 8765,
      timeout: 300000, // 5 minutes default for browser tasks
      ...workerConfig.config,
    };
    this.ws = null;
  }

  /**
   * Execute an execution package via WebSocket
   * @param {Object} executionPackage - The execution package
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} - Execution result
   */
  async execute(executionPackage, options = {}) {
    const startTime = Date.now();
    const executionId = executionPackage.execution_id;
    
    try {
      // Connect to worker
      await this._connect();
      
      // Send execution request
      const result = await this._sendRequest({
        jsonrpc: '2.0',
        method: 'execute',
        params: {
          execution_id: executionId,
          execution_package: executionPackage.execution_package,
          timeout: options.timeout || this.config.timeout,
        },
        id: executionId,
      }, options.timeout || this.config.timeout);
      
      const duration = Date.now() - startTime;
      
      if (result.error) {
        return {
          status: 'failed',
          error: result.error.message,
          duration_ms: duration,
        };
      }
      
      return {
        status: 'success',
        output: result.result?.output,
        artifacts: result.result?.artifacts,
        duration_ms: duration,
        provider: 'openclaw-browser',
        cost_usd: result.result?.cost_usd || 0,
        tokens_used: result.result?.tokens_used || 0,
      };
      
    } catch (error) {
      return {
        status: 'failed',
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    } finally {
      this._disconnect();
    }
  }

  /**
   * Connect to WebSocket worker
   * @returns {Promise<void>}
   */
  _connect() {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${this.config.host}:${this.config.port}`;
      
      this.ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      this.ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Disconnect from WebSocket worker
   */
  _disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send JSON-RPC request
   * @param {Object} request - JSON-RPC request
   * @param {number} timeout - Request timeout
   * @returns {Promise<Object>} - JSON-RPC response
   */
  _sendRequest(request, timeout) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
      
      const handleMessage = (data) => {
        clearTimeout(timeoutId);
        
        try {
          const response = JSON.parse(data.toString());
          
          // Check if this is the response to our request
          if (response.id === request.id) {
            this.ws.off('message', handleMessage);
            resolve(response);
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      };
      
      this.ws.on('message', handleMessage);
      
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Check if this adapter can handle the required capabilities
   * @param {Array<string>} capabilities - Required capabilities
   * @returns {boolean} - Whether this adapter can handle them
   */
  canHandle(capabilities) {
    const supported = ['browser', 'playwright', 'web-scraping', 'form-fill'];
    return capabilities.every(cap => supported.includes(cap));
  }

  /**
   * Check worker health
   * @returns {Promise<Object>} - Health status
   */
  async healthCheck() {
    try {
      await this._connect();
      
      const response = await this._sendRequest({
        jsonrpc: '2.0',
        method: 'health',
        params: {},
        id: 'health-check',
      }, 5000);
      
      this._disconnect();
      
      return {
        healthy: !response.error,
        status: response.result?.status || 'unknown',
        capabilities: response.result?.capabilities || {},
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }
}

export default OpenClawAdapter;
