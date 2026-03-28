-- Migration 0003: Worker System (Desktop Job Execution)
-- Date: 2026-03-28
-- Phase: 1A - SSE-Based Job Delivery

-- ── WORKER CONNECTIONS ─────────────────────────────────────────
-- Tracks active desktop worker connections
CREATE TABLE IF NOT EXISTS worker_connections (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  worker_id       VARCHAR(255) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  connection_type ENUM('websocket', 'sse', 'polling') DEFAULT 'sse',
  status          VARCHAR(20) DEFAULT 'connecting', -- connecting, online, busy, offline
  capabilities    JSON DEFAULT NULL,
  ip_address      VARCHAR(45) DEFAULT NULL,
  connected_at    DATETIME DEFAULT NOW(),
  last_seen       DATETIME DEFAULT NOW(),
  current_job     VARCHAR(36) DEFAULT NULL,
  metadata        JSON DEFAULT NULL,
  
  INDEX idx_worker_user (user_id, status),
  INDEX idx_worker_status (status, last_seen),
  INDEX idx_worker_id (worker_id)
);

-- ── JOB QUEUE ─────────────────────────────────────────────────
-- Queue for jobs waiting to be executed by workers
CREATE TABLE IF NOT EXISTS job_queue (
  id              VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  workflow_id     VARCHAR(255) DEFAULT NULL,
  task_id         VARCHAR(36) DEFAULT NULL,
  project_id      VARCHAR(36) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  job_type        VARCHAR(50) NOT NULL, -- video.render, shell.execute, file.process
  status          VARCHAR(20) DEFAULT 'pending', -- pending, assigned, running, completed, failed, cancelled
  priority        INT DEFAULT 5,
  payload         JSON NOT NULL, -- execution package
  assigned_to     VARCHAR(255) DEFAULT NULL, -- worker_id
  result          JSON DEFAULT NULL,
  error           TEXT DEFAULT NULL,
  started_at      DATETIME DEFAULT NULL,
  completed_at    DATETIME DEFAULT NULL,
  created_at      DATETIME DEFAULT NOW(),
  updated_at      DATETIME DEFAULT NOW(),
  
  INDEX idx_job_status (status, priority, created_at),
  INDEX idx_job_user (user_id, status),
  INDEX idx_job_worker (assigned_to, status),
  INDEX idx_job_project (project_id, status),
  INDEX idx_job_workflow (workflow_id, status)
);

-- ── UPDATE EXISTING WORKER_CAPABILITIES ───────────────────────
-- Add connection tracking to existing worker_capabilities table
ALTER TABLE worker_capabilities 
ADD COLUMN IF NOT EXISTS connection_id VARCHAR(36) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS supported_protocols JSON DEFAULT '["sse", "polling"]',
ADD INDEX IF NOT EXISTS idx_worker_conn (connection_id);

-- ── JOB LOGS (for debugging and audit) ────────────────────────
CREATE TABLE IF NOT EXISTS job_logs (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_id      VARCHAR(36) NOT NULL,
  timestamp   DATETIME DEFAULT NOW(),
  level       VARCHAR(10) DEFAULT 'info', -- debug, info, warn, error
  message     TEXT NOT NULL,
  metadata    JSON DEFAULT NULL,
  
  INDEX idx_log_job (job_id, timestamp)
);

-- ── TRIGGER FOR UPDATED_AT ───────────────────────────────────
DELIMITER //

CREATE TRIGGER IF NOT EXISTS job_queue_updated_at 
BEFORE UPDATE ON job_queue
FOR EACH ROW
BEGIN
  SET NEW.updated_at = NOW();
END//

DELIMITER ;

-- ── MIGRATION RECORD ─────────────────────────────────────────
INSERT INTO schema_migrations (version, name, applied_at) 
VALUES ('0003', 'Worker System - Desktop Job Execution', NOW())
ON DUPLICATE KEY UPDATE applied_at = NOW();
