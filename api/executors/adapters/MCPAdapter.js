/**
 * MCP Adapter (Stub)
 * Phase 1 - v2.2 Architecture
 * 
 * Model Context Protocol adapter for Cursor, VS Code, and other MCP-compatible tools.
 * This is a placeholder for Phase 6+ implementation.
 */

export class MCPAdapter {
  constructor(workerConfig) {
    this.workerId = workerConfig.worker_id;
    this.capabilities = workerConfig.capabilities || {};
    this.config = workerConfig.config || {};
  }

  /**
   * Execute an execution package (not implemented)
   */
  async execute(executionPackage, options = {}) {
    return {
      status: 'failed',
      error: 'MCP Adapter not yet implemented. Use ClaudeCodeAdapter or OpenClawAdapter.',
    };
  }

  /**
   * Check if this adapter can handle the required capabilities
   */
  canHandle(capabilities) {
    // MCP adapter is not ready yet
    return false;
  }
}

export default MCPAdapter;
