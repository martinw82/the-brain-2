-- Migration: Worker System Tables
-- Created: 2026-03-28
-- Description: Creates tables for desktop worker connections and job queue

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

-- Add indices for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_pending ON job_queue(status, job_type, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_worker_user_status ON worker_connections(user_id, status, last_seen);
