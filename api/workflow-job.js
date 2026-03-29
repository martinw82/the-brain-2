// api/workflow-job.js — Queue workflow steps for worker execution
// Handles steps that require local resources (Remotion, heavy compute)

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { getCorsHeaders } from './_lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;

function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(h.slice(7), JWT_SECRET);
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

/**
 * Queue a job for worker execution
 * Used by workflow engine for steps requiring local resources
 */
async function queueJob(db, {
  workflow_id,
  task_id,
  project_id,
  user_id,
  job_type,
  payload,
  priority = 5
}) {
  const jobId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO job_queue
     (id, job_id, workflow_id, task_id, project_id, user_id, job_type, status, priority, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
    [jobId, jobId, workflow_id, task_id, project_id, user_id, job_type, priority, JSON.stringify(payload)]
  );

  return {
    job_id: jobId,
    status: 'pending'
  };
}

/**
 * Check if a worker is available for a job
 */
async function checkWorkerAvailability(db, user_id, capability) {
  const [workers] = await db.execute(
    `SELECT worker_id FROM worker_connections 
     WHERE user_id = ? 
       AND status = 'online'
       AND JSON_CONTAINS(capabilities, ?, '$')
     LIMIT 1`,
    [user_id, JSON.stringify(capability)]
  );
  
  return workers.length > 0;
}

/**
 * Get job status and result
 */
async function getJobStatus(db, job_id, user_id) {
  const [jobs] = await db.execute(
    `SELECT * FROM job_queue WHERE id = ? AND user_id = ?`,
    [job_id, user_id]
  );
  
  if (jobs.length === 0) {
    return null;
  }
  
  const job = jobs[0];
  return {
    job_id: job.id,
    job_type: job.job_type,
    status: job.status,
    assigned_to: job.assigned_to || null,
    result: job.result ? JSON.parse(job.result) : null,
    error: job.error_message || null,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at
  };
}

// ═════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.query;
  const db = await getDb();

  try {
    switch (action) {
      case 'queue':
        return await handleQueue(req, res, db, user);
      case 'status':
        return await handleStatus(req, res, db, user);
      case 'check-worker':
        return await handleCheckWorker(req, res, db, user);
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (e) {
    console.error('[WorkflowJob] Error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await db.end();
  }
}

// ═════════════════════════════════════════════════════════════════
// QUEUE JOB
// ═════════════════════════════════════════════════════════════════

async function handleQueue(req, res, db, user) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    workflow_id,
    task_id,
    project_id,
    job_type,
    payload,
    priority = 5
  } = req.body || {};

  if (!project_id || !job_type) {
    return res.status(400).json({ error: 'project_id and job_type are required' });
  }

  // Check if worker is available
  const workerAvailable = await checkWorkerAvailability(db, user.userId, job_type);
  
  if (!workerAvailable) {
    return res.status(503).json({
      error: 'No worker available',
      message: `No online worker with capability: ${job_type}`,
      suggestion: 'Start a Spine worker with: spine-worker start'
    });
  }

  // Queue the job
  const job = await queueJob(db, {
    workflow_id,
    task_id,
    project_id,
    user_id: user.userId,
    job_type,
    payload,
    priority
  });

  return res.status(200).json({
    success: true,
    job_id: job.job_id,
    status: 'pending',
    message: 'Job queued for worker execution'
  });
}

// ═════════════════════════════════════════════════════════════════
// GET JOB STATUS
// ═════════════════════════════════════════════════════════════════

async function handleStatus(req, res, db, user) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { job_id } = req.query;
  
  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  const status = await getJobStatus(db, job_id, user.userId);
  
  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }

  return res.status(200).json(status);
}

// ═════════════════════════════════════════════════════════════════
// CHECK WORKER AVAILABILITY
// ═════════════════════════════════════════════════════════════════

async function handleCheckWorker(req, res, db, user) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { capability } = req.query;
  
  if (!capability) {
    return res.status(400).json({ error: 'capability is required' });
  }

  const available = await checkWorkerAvailability(db, user.userId, capability);
  
  // Get list of online workers for this user
  const [workers] = await db.execute(
    `SELECT worker_id, status, capabilities FROM worker_connections 
     WHERE user_id = ? AND status = 'online'`,
    [user.userId]
  );

  return res.status(200).json({
    available,
    capability,
    online_workers: workers.length,
    workers: workers.map(w => ({
      worker_id: w.worker_id,
      status: w.status,
      capabilities: typeof w.capabilities === 'string' 
        ? JSON.parse(w.capabilities) 
        : w.capabilities
    }))
  });
}
