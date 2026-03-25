/**
 * Worker Registry API
 * Phase 1 - v2.2 Architecture
 * 
 * Endpoints:
 * - POST /api/workers/register - Register a new worker
 * - GET /api/workers - List all workers
 * - POST /api/workers/:id/heartbeat - Worker heartbeat
 */

import { registerWorker, workerHeartbeat, listWorkers } from './executors/UniversalAgentBridge.js';

export default async function handler(req, res) {
  const { method, query, body } = req;
  const { id } = query;

  try {
    // POST /api/workers/register or POST /api/workers (register)
    if (method === 'POST' && (!id || query.action === 'register')) {
      const { worker_id, type, capabilities, config } = body;

      if (!worker_id || !type || !capabilities) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['worker_id', 'type', 'capabilities'],
        });
      }

      const worker = await registerWorker({ worker_id, type, capabilities, config });

      return res.status(201).json({
        success: true,
        message: 'Worker registered successfully',
        data: worker,
      });
    }

    // POST /api/workers/:id/heartbeat
    if (method === 'POST' && id) {
      const { status = 'online' } = body;

      const result = await workerHeartbeat(id, status);

      return res.status(200).json({
        success: true,
        data: result,
      });
    }

    // GET /api/workers - List workers
    if (method === 'GET') {
      const workers = await listWorkers();

      return res.status(200).json({
        success: true,
        data: {
          workers,
          count: workers.length,
          online: workers.filter(w => w.status === 'online').length,
        },
      });
    }

    // Method not allowed
    return res.status(405).json({
      error: 'Method not allowed',
      allowed: ['GET', 'POST'],
    });

  } catch (error) {
    console.error('Worker registry error:', error);
    return res.status(500).json({
      error: 'Worker registry operation failed',
      message: error.message,
    });
  }
}
