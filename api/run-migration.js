// api/run-migration.js — Run database migrations (v2)
import mysql from 'mysql2/promise';
import { getCorsHeaders } from './_lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;

// Simple auth check - only allow admin/development
function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    // In production, verify JWT and check admin role
    // For now, allow with any valid token in dev
    return { authorized: true };
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
    multipleStatements: true,
  });
}

const MIGRATION_SQL = `
-- Worker connections table (tracks registered desktop workers)
CREATE TABLE IF NOT EXISTS worker_connections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  worker_id VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  capabilities JSON,
  status ENUM('online', 'offline', 'busy') DEFAULT 'offline',
  version VARCHAR(50),
  platform VARCHAR(50),
  current_job_id VARCHAR(64),
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_last_seen (last_seen)
);

-- Job queue table (tracks jobs waiting for workers)
CREATE TABLE IF NOT EXISTS job_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  payload JSON,
  status ENUM('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  priority INT DEFAULT 0,
  worker_id VARCHAR(64),
  result JSON,
  error_message TEXT,
  progress_percent INT DEFAULT 0,
  progress_message VARCHAR(500),
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_job_type (job_type),
  INDEX idx_worker_id (worker_id),
  INDEX idx_created_at (created_at)
);
`;

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200, cors);
    res.end();
    return;
  }

  // Simple auth check
  const auth = getAuth(req);
  if (!auth) {
    res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  let db;
  try {
    db = await getDb();
    
    // Execute migration
    await db.query(MIGRATION_SQL);
    
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: true, 
      message: 'Worker tables created successfully',
      tables: ['worker_connections', 'job_queue']
    }));
  } catch (error) {
    console.error('Migration error:', error);
    res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Migration failed', 
      message: error.message 
    }));
  } finally {
    if (db) await db.end();
  }
}
