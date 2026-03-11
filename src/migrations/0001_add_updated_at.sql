-- Migration: Add updated_at timestamps to tables for offline sync
-- Purpose: Enable timestamp-based conflict resolution in offline mode (Phase 2.4)
-- Date: 2026-03-11

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to ideas table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE ideas
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to sessions table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE sessions
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to comments table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE comments
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to refresh_tokens table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE refresh_tokens
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to goal_contributions table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE goal_contributions
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to tags table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE tags
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to entity_tags table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE entity_tags
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- Add updated_at to entity_links table
-- ────────────────────────────────────────────────────────────────
ALTER TABLE entity_links
ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
AFTER created_at;

-- ────────────────────────────────────────────────────────────────
-- All other tables already have updated_at:
-- - users (already has)
-- - projects (already has)
-- - project_files (already has)
-- - file_metadata (already has)
-- - staging (already has)
-- - life_areas (already has)
-- - goals (already has)
-- - templates (already has)
-- ────────────────────────────────────────────────────────────────

-- Update schema_migrations table to track this migration
INSERT INTO schema_migrations (version, name) VALUES (1, 'add_updated_at');
