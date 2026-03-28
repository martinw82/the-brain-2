// api/quick-test.js — Quick test endpoints for development
// POST /api/quick-test?action=video-render — Queue a test video render

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

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = getAuth(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action } = req.query;
  const db = await getDb();

  try {
    if (action === 'video-render') {
      return await handleQuickVideoRender(req, res, db, user);
    }
    
    return res.status(400).json({ error: 'Unknown action. Use: video-render' });
  } catch (e) {
    console.error('[QuickTest] Error:', e);
    return res.status(500).json({ error: e.message });
  } finally {
    await db.end();
  }
}

async function handleQuickVideoRender(req, res, db, user) {
  const { project_id } = req.body || {};

  if (!project_id) {
    return res.status(400).json({ error: 'project_id is required' });
  }

  // Check if worker is available
  const [workers] = await db.execute(
    `SELECT worker_id FROM worker_connections 
     WHERE user_id = ? 
       AND status = 'online'
       AND JSON_CONTAINS(capabilities, '"video.render"', '$')
     LIMIT 1`,
    [user.userId]
  );

  if (workers.length === 0) {
    return res.status(503).json({
      error: 'No video worker available',
      message: 'Start a Spine worker with: node bin/spine-worker.js start',
      setup_guide: 'https://github.com/martinw82/the-brain-2/blob/main/WORKER_TESTING_GUIDE.md'
    });
  }

  // Queue the job
  const storyboard = {
    composition_id: 'quick-test-video',
    title: 'Spine Quick Test Video',
    segments: [
      {
        segment_id: 'intro',
        scenes: [
          {
            scene_id: 'scene-1',
            text: 'Hello from Spine!',
            visual_type: 'text_overlay',
            background_color: '#1a4fd6',
            duration_s: 3
          },
          {
            scene_id: 'scene-2',
            text: 'Your desktop worker is working!',
            visual_type: 'text_overlay',
            background_color: '#0a0f1e',
            duration_s: 4
          },
          {
            scene_id: 'scene-3',
            text: 'Ready to create real content! 🎬',
            visual_type: 'text_overlay',
            background_color: '#10b981',
            duration_s: 3
          }
        ]
      }
    ]
  };

  const [result] = await db.execute(
    `INSERT INTO job_queue 
     (id, project_id, user_id, job_type, status, priority, payload, created_at)
     VALUES (UUID(), ?, ?, 'video.render', 'pending', 5, ?, NOW())`,
    [
      project_id,
      user.userId,
      JSON.stringify({
        storyboard_json: storyboard,
        output_format: 'mp4',
        output_resolution: '1080p'
      })
    ]
  );

  return res.status(200).json({
    success: true,
    message: 'Test video render queued',
    job_id: result.insertId,
    worker_id: workers[0].worker_id,
    estimated_duration: '30-60 seconds',
    storyboard: storyboard
  });
}
