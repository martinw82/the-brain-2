// api/executors/OpenClawAdapter.js — WebSocket/JSON-RPC adapter (Phase 1)
// Brain OS v2.2
//
// Connects to OpenClaw browser automation workers via WebSocket.
// Used for: Playwright form fills, browser scraping, screenshot capture.

/**
 * OpenClaw WebSocket adapter.
 * Sends execution packages as JSON-RPC messages.
 */
export class OpenClawAdapter {
  constructor(worker) {
    this.worker = worker;
    this.timeout = 300000; // 5 min default for browser tasks
  }

  /**
   * Execute an execution package via WebSocket to OpenClaw worker.
   *
   * @param {object} execPkg - The execution_package portion
   * @returns {object} - { status, output, error }
   */
  async execute(execPkg) {
    const wsUrl = this.worker.capabilities?.websocket_url || 'ws://localhost:8765';

    try {
      const result = await this._sendJsonRpc(wsUrl, {
        method: 'execute',
        params: {
          capabilities_required: execPkg.capabilities_required,
          main_command: execPkg.main_command,
          pre_flight: execPkg.pre_flight || [],
          artifacts: execPkg.artifacts || {},
          browser_config: execPkg.browser_config || {},
        },
      });

      return {
        status: result.success ? 'success' : 'failed',
        output: result.output || null,
        error: result.error || null,
        provider: 'openclaw-ws',
      };
    } catch (e) {
      return {
        status: 'failed',
        error: `OpenClaw connection failed: ${e.message}`,
        provider: 'openclaw-ws',
      };
    }
  }

  /**
   * Send a JSON-RPC message via WebSocket.
   * Phase 1: Stub implementation — logs intent and returns mock.
   * Full WebSocket implementation in Phase 2 when Playwright worker is ready.
   */
  async _sendJsonRpc(wsUrl, payload) {
    // Phase 1 stub: Log the intent and return a placeholder
    console.log(`[OpenClaw] Would connect to ${wsUrl} with payload:`, JSON.stringify(payload).substring(0, 200));

    // TODO: Phase 2 — Replace with real WebSocket connection
    // const ws = new WebSocket(wsUrl);
    // ws.send(JSON.stringify({ jsonrpc: '2.0', id: 1, ...payload }));
    // return await waitForResponse(ws);

    return {
      success: false,
      error: 'OpenClaw adapter is a Phase 1 stub. Full implementation in Phase 2.',
    };
  }
}

export default OpenClawAdapter;
