/**
 * MCP Adapter (Stub)
 * Model Context Protocol adapter for Cursor, VS Code, etc.
 */

export class MCPAdapter {
  constructor(workerConfig) {
    this.workerId = workerConfig.worker_id;
    this.capabilities = workerConfig.capabilities || {};
  }

  async execute(executionPackage, options = {}) {
    return {
      status: 'failed',
      error: 'MCP Adapter not yet implemented.',
    };
  }

  canHandle(capabilities) {
    return false;
  }
}

export default MCPAdapter;
