// api/worker.js — Desktop Worker Management (Phase 1A)
// Handles: registration, SSE stream, polling, job results
// Single endpoint to conserve Vercel function slots

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { getCorsHeaders } from './_lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;
const WORKER_TOKEN_SECRET = process.env.WORKER_TOKEN_SECRET || JWT_SECRET;

function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

function getWorkerAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), WORKER_TOKEN_SECRET);
  } catch {
    return null;
  }
}

function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl: { rejectUnauthorized: true },
  });
}

// Generate worker token
function generateWorkerToken(workerId, userId) {
  return jwt.sign(
    { worker_id: workerId, user_id: userId, type: 'worker' },
    WORKER_TOKEN_SECRET,
    { expiresIn: '7d' }
  );
}

// ═════════════════════════════════════════════════════════════════
// ROUTER
// ═════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  try {
    // Route based on action parameter
    switch (action) {
      case 'register':
        return await handleRegister(req, res);
      case 'sse':
        return await handleSSE(req, res);
      case 'poll':
        return await handlePoll(req, res);
      case 'result':
        return await handleResult(req, res);
      case 'heartbeat':
        return await handleHeartbeat(req, res);
      case 'status':
        return await handleStatus(req, res);
      default:
        return res.status(400).json({ error: 'Unknown action. Use: register, sse, poll, result, heartbeat, status' });
    }
  } catch (e) {
    console.error('[Worker API] Error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// ═════════════════════════════════════════════════════════════════
// REGISTER WORKER
// ═════════════════════════════════════════════════════════════════

async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const {
    worker_id,
    capabilities = {},
    platform = 'unknown',
    hostname = 'unknown',
    supported_protocols = ['sse', 'polling'],
    metadata = {}
  } = req.body || {};

  if (!worker_id) {
    return res.status(400).json({ error: 'worker_id is required' });
  }

  const db = await getDb();
  try {
    // Check if worker already exists for this user
    const [existing] = await db.execute(
      'SELECT id FROM worker_connections WHERE worker_id = ? AND user_id = ?',
      [worker_id, user.id]
    );

    const connectionId = existing[0]?.id || crypto.randomUUID();
    const now = new Date();

    if (existing.length > 0) {
      // Update existing
      await db.execute(
        `UPDATE worker_connections 
         SET status = 'online', 
             capabilities = ?,
             supported_protocols = ?,
             metadata = ?,
             last_seen = ?,
             connected_at = ?
         WHERE id = ?`,
        [
          JSON.stringify(capabilities),
          JSON.stringify(supported_protocols),
          JSON.stringify({ platform, hostname, ...metadata }),
          now,
          now,
          connectionId
        ]
      );
    } else {
      // Create new
      await db.execute(
        `INSERT INTO worker_connections 
         (id, worker_id, user_id, connection_type, status, capabilities, 
          supported_protocols, metadata, connected_at, last_seen)
         VALUES (?, ?, ?, 'sse', 'online', ?, ?, ?, ?, ?)`,
        [
          connectionId,
          worker_id,
          user.id,
          JSON.stringify(capabilities),
          JSON.stringify(supported_protocols),
          JSON.stringify({ platform, hostname, ...metadata }),
          now,
          now
        ]
      );
    }

    // Generate token
    const token = generateWorkerToken(worker_id, user.id);

    return res.status(200).json({
      success: true,
      worker_id,
      connection_id: connectionId,
      token,
      endpoints: {
        sse: `/api/worker?action=sse&token=${token}`,
        poll: `/api/worker?action=poll`,
        result: `/api/worker?action=result`,
        heartbeat: `/api/worker?action=heartbeat`
      },
      config: {
        heartbeat_interval: 30,
        poll_interval: 10,
        reconnect_interval: 5
      }
    });
  } finally {
    await db.end();
  }
}

// ═════════════════════════════════════════════════════════════════
// SSE STREAM (Server-Sent Events)
// Delivers jobs to workers in real-time
// ═════════════════════════════════════════════════════════════════

async function handleSSE(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from query param (SSE can't use Authorization header)
  const { token } = req.query;
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  let workerAuth;
  try {
    workerAuth = jwt.verify(token, WORKER_TOKEN_SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { worker_id, user_id } = workerAuth;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  const db = await getDb();
  
  // Update worker status
  await db.execute(
    'UPDATE worker_connections SET status = ?, last_seen = NOW() WHERE worker_id = ? AND user_id = ?',
    ['online', worker_id, user_id]
  );

  // Send initial connection event
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ worker_id, status: 'online', timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      res.write(`event: heartbeat\n`);
      res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      
      // Update last_seen
      await db.execute(
        'UPDATE worker_connections SET last_seen = NOW() WHERE worker_id = ?',
        [worker_id]
      );
    } catch (e) {
      // Client disconnected
      clearInterval(heartbeatInterval);
      clearInterval(jobCheckInterval);
      db.end();
    }
  }, 30000); // 30 second heartbeat

  // Job checking interval
  const jobCheckInterval = setInterval(async () => {
    try {
      // Look for pending jobs assigned to this worker or unassigned jobs
      const [jobs] = await db.execute(
        `SELECT * FROM job_queue 
         WHERE user_id = ? 
           AND status = 'pending'
           AND (assigned_to IS NULL OR assigned_to = ?)
         ORDER BY priority ASC, created_at ASC
         LIMIT 1`,
        [user_id, worker_id]
      );

      if (jobs.length > 0) {
        const job = jobs[0];
        
        // Assign job to this worker
        await db.execute(
          `UPDATE job_queue 
           SET status = 'assigned', assigned_to = ?, updated_at = NOW() 
           WHERE id = ? AND status = 'pending'`,
          [worker_id, job.id]
        );

        // Update worker current_job
        await db.execute(
          'UPDATE worker_connections SET current_job = ?, status = ? WHERE worker_id = ?',
          [job.id, 'busy', worker_id]
        );

        // Send job to worker
        res.write(`event: job_assigned\n`);
        res.write(`data: ${JSON.stringify({
          job_id: job.id,
          job_type: job.job_type,
          payload: JSON.parse(job.payload || '{}'),
          project_id: job.project_id,
          created_at: job.created_at
        })}\n\n`);
      }
    } catch (e) {
      console.error('[Worker SSE] Job check error:', e);
    }
  }, 2000); // Check every 2 seconds

  // Clean up on disconnect
  req.on('close', async () => {
    clearInterval(heartbeatInterval);
    clearInterval(jobCheckInterval);
    
    try {
      await db.execute(
        'UPDATE worker_connections SET status = ?, current_job = NULL WHERE worker_id = ?',
        ['offline', worker_id]
      );
      await db.end();
    } catch (e) {
      console.error('[Worker SSE] Cleanup error:', e);
    }
  });
}

// ═════════════════════════════════════════════════════════════════
// POLL FOR JOBS (Fallback for SSE)
// ═════════════════════════════════════════════════════════════════

async function handlePoll(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const workerAuth = getWorkerAuth(req);
  if (!workerAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { worker_id, user_id } = workerAuth;
  const db = await getDb();

  try {
    // Update last_seen
    await db.execute(
      'UPDATE worker_connections SET last_seen = NOW() WHERE worker_id = ?',
      [worker_id]
    );

    // Look for jobs
    const [jobs] = await db.execute(
      `SELECT * FROM job_queue 
       WHERE user_id = ? 
         AND status = 'pending'
         AND (assigned_to IS NULL OR assigned_to = ?)
       ORDER BY priority ASC, created_at ASC
       LIMIT 1`,
      [user_id, worker_id]
    );

    if (jobs.length === 0) {
      return res.status(200).json({ jobs: [] });
    }

    const job = jobs[0];

    // Assign job to this worker
    await db.execute(
      `UPDATE job_queue 
       SET status = 'assigned', assigned_to = ?, updated_at = NOW() 
       WHERE id = ? AND status = 'pending'`,
      [worker_id, job.id]
    );

    // Update worker status
    await db.execute(
      'UPDATE worker_connections SET current_job = ?, status = ? WHERE worker_id = ?',
      [job.id, 'busy', worker_id]
    );

    return res.status(200).json({
      jobs: [{
        job_id: job.id,
        job_type: job.job_type,
        payload: JSON.parse(job.payload || '{}'),
        project_id: job.project_id,
        created_at: job.created_at
      }]
    });
  } finally {
    await db.end();
  }
}

// ═════════════════════════════════════════════════════════════════
// SUBMIT JOB RESULT
// ═════════════════════════════════════════════════════════════════

async function handleResult(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const workerAuth = getWorkerAuth(req);
  if (!workerAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { worker_id } = workerAuth;
  const { job_id, status, result, error, logs = [] } = req.body || {};

  if (!job_id || !status) {
    return res.status(400).json({ error: 'job_id and status are required' });
  }

  const db = await getDb();

  try {
    // Verify job is assigned to this worker
    const [jobs] = await db.execute(
      'SELECT * FROM job_queue WHERE id = ? AND assigned_to = ?',
      [job_id, worker_id]
    );

    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job not found or not assigned to this worker' });
    }

    // Update job
    await db.execute(
      `UPDATE job_queue 
       SET status = ?,
           result = ?,
           error = ?,
           completed_at = NOW()
       WHERE id = ?`,
      [
        status === 'success' ? 'completed' : 'failed',
        result ? JSON.stringify(result) : null,
        error || null,
        job_id
      ]
    );

    // Insert logs
    for (const log of logs) {
      await db.execute(
        'INSERT INTO job_logs (job_id, timestamp, level, message, metadata) VALUES (?, ?, ?, ?, ?)',
        [
          job_id,
          log.timestamp || new Date(),
          log.level || 'info',
          log.message,
          log.metadata ? JSON.stringify(log.metadata) : null
        ]
      );
    }

    // Update worker status back to online
    await db.execute(
      'UPDATE worker_connections SET current_job = NULL, status = ? WHERE worker_id = ?',
      ['online', worker_id]
    );

    return res.status(200).json({
      success: true,
      job_id,
      status: status === 'success' ? 'completed' : 'failed'
    });
  } finally {
    await db.end();
  }
}

// ═════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═════════════════════════════════════════════════════════════════

async function handleHeartbeat(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const workerAuth = getWorkerAuth(req);
  if (!workerAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { worker_id } = workerAuth;
  const { status, current_job } = req.body || {};

  const db = await getDb();

  try {
    await db.execute(
      `UPDATE worker_connections 
       SET last_seen = NOW(),
           status = COALESCE(?, status),
           current_job = COALESCE(?, current_job)
       WHERE worker_id = ?`,
      [status, current_job, worker_id]
    );

    return res.status(200).json({ success: true, timestamp: new Date().toISOString() });
  } finally {
    await db.end();
  }
}

// ═════════════════════════════════════════════════════════════════
// GET WORKER STATUS (for UI)
// ═════════════════════════════════════════════════════════════════

async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = await getDb();

  try {
    // Get all workers for this user
    const [workers] = await db.execute(
      `SELECT wc.*, jq.job_type as current_job_type, jq.status as job_status
       FROM worker_connections wc
       LEFT JOIN job_queue jq ON wc.current_job = jq.id
       WHERE wc.user_id = ?
       ORDER BY wc.last_seen DESC`,
      [user.id]
    );

    // Get pending jobs count
    const [pendingJobs] = await db.execute(
      'SELECT COUNT(*) as count FROM job_queue WHERE user_id = ? AND status = ?',
      [user.id, 'pending']
    );

    return res.status(200).json({
      workers: workers.map(w => ({
        id: w.id,
        worker_id: w.worker_id,
        status: w.status,
        capabilities: JSON.parse(w.capabilities || '{}'),
        last_seen: w.last_seen,
        current_job: w.current_job ? {
          job_id: w.current_job,
          job_type: w.current_job_type,
          status: w.job_status
        } : null
      })),
      pending_jobs: pendingJobs[0]?.count || 0
    });
  } finally {
    await db.end();
  }
}
