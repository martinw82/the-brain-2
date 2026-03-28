/**
 * API Client for Worker
 * 
 * Communicates with Spine API
 */

import fs from 'fs-extra';

export class SpineAPI {
  constructor(config) {
    this.baseUrl = config.spine_url;
    this.token = config.auth_token;
    this.workerToken = null;
  }

  setWorkerToken(token) {
    this.workerToken = token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Use worker token if available, otherwise use auth token
    const token = this.workerToken || this.token;
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Dynamic import fetch for Node 18+ compatibility
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    return response.json();
  }

  // Worker registration
  async registerWorker(workerId, capabilities) {
    return this.request('/api/worker?action=register', {
      method: 'POST',
      body: JSON.stringify({
        worker_id: workerId,
        capabilities,
        platform: `${process.platform}/${process.arch}`,
        hostname: require('os').hostname(),
        supported_protocols: ['sse', 'polling'],
      }),
    });
  }

  // Get upload URL for rendered video
  async getUploadUrl(projectId, workflowId, filename, contentType, fileSize) {
    return this.request('/api/upload', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        workflow_id: workflowId,
        filename,
        content_type: contentType,
        file_size: fileSize,
      }),
    });
  }

  // Upload file to presigned URL
  async uploadFile(filePath, uploadUrl) {
    const fetch = (await import('node-fetch')).default;
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stats.size.toString(),
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return true;
  }

  // Submit job result
  async submitJobResult(jobId, status, result, error = null, logs = []) {
    return this.request('/api/worker?action=result', {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId,
        status,
        result,
        error,
        logs,
      }),
    });
  }

  // Send heartbeat
  async sendHeartbeat(status, currentJob) {
    return this.request('/api/worker?action=heartbeat', {
      method: 'POST',
      body: JSON.stringify({
        status,
        current_job: currentJob,
      }),
    });
  }
}

export default SpineAPI;
