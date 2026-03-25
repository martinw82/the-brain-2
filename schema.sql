-- ============================================================
-- THE BRAIN v6 — Database Schema
-- MySQL / TiDB compatible
-- Run this once against your TiDB Cloud / MySQL instance
-- ============================================================

CREATE DATABASE IF NOT EXISTS the_brain CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE the_brain;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  email         VARCHAR(255)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  name          VARCHAR(255),
  goal          TEXT,                          -- e.g. "£3000/mo → Thailand"
  monthly_target INT          DEFAULT 3000,
  currency      VARCHAR(8)   DEFAULT 'GBP',
  timezone      VARCHAR(64)  DEFAULT 'Europe/London',
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── PROJECTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              VARCHAR(64)   PRIMARY KEY,   -- user-defined slug e.g. "startifi"
  user_id         VARCHAR(36)   NOT NULL,
  life_area_id    VARCHAR(36)   DEFAULT NULL,
  name            VARCHAR(255)  NOT NULL,
  emoji           VARCHAR(8)    DEFAULT '📁',
  phase           VARCHAR(32)   DEFAULT 'BOOTSTRAP',
  status          VARCHAR(32)   DEFAULT 'active',
  priority        INT           DEFAULT 99,
  revenue_ready   TINYINT(1)    DEFAULT 0,
  income_target   INT           DEFAULT 0,
  momentum        INT           DEFAULT 3,
  last_touched    VARCHAR(8),                  -- YYYY-MM
  description     TEXT,
  next_action     TEXT,
  blockers        JSON,                        -- array of strings
  tags            JSON,                        -- array of strings
  skills          JSON,                        -- array of strings
  integrations    JSON,                        -- key/value pairs
  active_file     VARCHAR(512)  DEFAULT 'PROJECT_OVERVIEW.md',
  health          INT           DEFAULT 100,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_projects (user_id, priority)
);

-- ── PROJECT CUSTOM FOLDERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS project_custom_folders (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  project_id  VARCHAR(64)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  folder_id   VARCHAR(128)  NOT NULL,          -- e.g. "pitch-deck"
  label       VARCHAR(255)  NOT NULL,          -- e.g. "Pitch Deck"
  icon        VARCHAR(8)    DEFAULT '📁',
  description TEXT,
  sort_order  INT           DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY unique_folder (project_id, folder_id),
  INDEX idx_project_folders (project_id)
);

-- ── PROJECT FILES ─────────────────────────────────────────────
-- MIGRATION NOTE (Phase 2.2):
-- Files currently stored as base64 in LONGTEXT (up to 4GB capacity).
-- To migrate to object storage (S3/R2/Azure):
-- 1. Add optional `file_url VARCHAR(2048)` column to project_files
-- 2. ImageViewer/BinaryViewer components accept BOTH base64 (data:) and URLs
-- 3. Gradual migration: new files upload to object storage, old files stay as base64
-- 4. UI detects source: content.startsWith('data:') → base64, else → URL
-- 5. At 100% migration completion, drop content column
-- This design allows zero-downtime migration across all file types.
CREATE TABLE IF NOT EXISTS project_files (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  project_id  VARCHAR(64)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  path        VARCHAR(512)  NOT NULL,          -- e.g. "system/DEVLOG.md"
  content     LONGTEXT,
  deleted_at  DATETIME      DEFAULT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY unique_file (project_id, path),
  INDEX idx_project_files (project_id),
  FULLTEXT INDEX ft_file_content (content)    -- enables full-text search
);

-- ── FILE METADATA (Roadmap 2.3) ───────────────────────────
-- Metadata for files: category, status, custom fields, tags
-- Flexible JSON column allows extensibility without schema changes
CREATE TABLE IF NOT EXISTS file_metadata (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  file_id     INT           NOT NULL,
  project_id  VARCHAR(64)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  file_path   VARCHAR(512)  NOT NULL,
  category    VARCHAR(64)   DEFAULT NULL,     -- e.g., "design", "documentation", "research"
  status      VARCHAR(32)   DEFAULT 'draft',  -- draft/in-progress/review/final/archived
  metadata_json JSON        DEFAULT NULL,     -- {custom: {key: value}} for extensibility
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_file_metadata (project_id, file_path),
  INDEX idx_project_metadata (project_id, category, status),
  INDEX idx_file_status (project_id, status)
);

-- ── STAGING ──────────────────────────────────────────────────
-- MIGRATION NOTE (Phase 2.3):
-- Files can now be moved from staging/ to project folders.
-- folder_path tracks the final location (e.g., "design-assets/logo.png")
-- filed_at records when the item was moved from staging to folder.
CREATE TABLE IF NOT EXISTS staging (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(64)   NOT NULL,
  name        VARCHAR(512)  NOT NULL,
  tag         VARCHAR(32)   DEFAULT 'IDEA_',
  status      VARCHAR(32)   DEFAULT 'in-review',
  notes       TEXT,
  folder_path VARCHAR(512)  DEFAULT NULL,     -- e.g., "design-assets/logo.png" (Phase 2.3)
  filed_at    DATETIME      DEFAULT NULL,     -- When moved from staging to folder (Phase 2.3)
  added       VARCHAR(8),                      -- YYYY-MM
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_user_staging (user_id, status),
  INDEX idx_filing (project_id, folder_path, status)  -- Phase 2.3: for filtering filed items
);

-- ── IDEAS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideas (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  title       TEXT          NOT NULL,
  score       INT           DEFAULT 5,
  tags        JSON,
  added       VARCHAR(8),                      -- YYYY-MM
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_ideas (user_id)
);

-- ── SESSIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(64),
  duration_s  INT           DEFAULT 0,         -- seconds
  log         TEXT,
  started_at  DATETIME,
  ended_at    DATETIME,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_sessions (user_id, created_at)
);

-- ── COMMENTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(64)   NOT NULL,
  file_path   VARCHAR(512)  NOT NULL,
  text        TEXT          NOT NULL,
  resolved    TINYINT(1)    DEFAULT 0,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_comments (project_id, file_path)
);

-- ── AUTH TOKENS (refresh token store) ───────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  token_hash  VARCHAR(255)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token_hash)
);

-- ── MIGRATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  version     INT           NOT NULL UNIQUE,
  name        VARCHAR(255)  NOT NULL,
  applied_at  DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ── LIFE AREAS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS life_areas (
  id                  VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id             VARCHAR(36)   NOT NULL,
  name                VARCHAR(255)  NOT NULL,
  color               VARCHAR(16)   DEFAULT '#3b82f6',
  icon                VARCHAR(8)    DEFAULT '🌐',
  description         TEXT,
  target_hours_weekly INT           DEFAULT NULL,
  health_score        INT           DEFAULT 100,
  sort_order          INT           DEFAULT 0,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_areas (user_id, sort_order)
);

-- ── GOALS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  title           VARCHAR(255)  NOT NULL,
  target_amount   INT           NOT NULL,
  current_amount  INT           DEFAULT 0,
  currency        VARCHAR(8)    DEFAULT 'GBP',
  timeframe       VARCHAR(32)   DEFAULT 'monthly', -- monthly/yearly/total
  category        VARCHAR(32)   DEFAULT 'income',  -- income/savings/debt/custom
  status          VARCHAR(32)   DEFAULT 'active',  -- active/achieved/paused
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_goals (user_id, status)
);

-- ── GOAL CONTRIBUTIONS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS goal_contributions (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  goal_id         VARCHAR(36)   NOT NULL,
  user_id         VARCHAR(36)   NOT NULL,
  project_id      VARCHAR(64)   DEFAULT NULL,
  source_label    VARCHAR(255),
  amount          INT           NOT NULL,
  date            VARCHAR(10),                     -- YYYY-MM-DD
  notes           TEXT,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_goal_contributions (goal_id, date)
);

-- ── TAGS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  name        VARCHAR(128)  NOT NULL,
  color       VARCHAR(16)   DEFAULT '#3b82f6',
  category    VARCHAR(32)   DEFAULT 'custom', -- area/skill/status/custom
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_tag (user_id, name),
  INDEX idx_user_tags (user_id)
);

-- ── ENTITY TAGS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_tags (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  tag_id      VARCHAR(36)   NOT NULL,
  user_id     VARCHAR(36)   NOT NULL,
  entity_type VARCHAR(32)   NOT NULL, -- project/idea/staging/goal
  entity_id   VARCHAR(64)   NOT NULL,
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE KEY unique_entity_tag (tag_id, entity_type, entity_id),
  INDEX idx_entity_tags (user_id, entity_type, entity_id)
);

-- ── ENTITY LINKS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_links (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  source_type     VARCHAR(32)   NOT NULL,
  source_id       VARCHAR(64)   NOT NULL,
  target_type     VARCHAR(32)   NOT NULL,
  target_id       VARCHAR(64)   NOT NULL,
  relationship    VARCHAR(32)   DEFAULT 'related', -- parent/child/related/blocks/supports
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_link (user_id, source_type, source_id, target_type, target_id),
  INDEX idx_entity_links_source (user_id, source_type, source_id),
  INDEX idx_entity_links_target (user_id, target_type, target_id)
);

-- ── DAILY CHECKINS (Phase 2.5) ─────────────────────────────
-- Track daily user state for AI-driven task routing
CREATE TABLE IF NOT EXISTS daily_checkins (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  date            VARCHAR(10)   NOT NULL,          -- YYYY-MM-DD
  sleep_hours     INT           DEFAULT NULL,      -- 0-24
  energy_level    INT           DEFAULT NULL,      -- 0-10
  gut_symptoms    INT           DEFAULT NULL,      -- 0-10
  training_done   TINYINT(1)    DEFAULT 0,
  notes           TEXT,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_date (user_id, date),
  INDEX idx_user_date (user_id, date)
);

-- ── TRAINING LOGS (Phase 2.6) ─────────────────────────────
-- Track individual training sessions for weekly count + correlation with energy
CREATE TABLE IF NOT EXISTS training_logs (
  id                VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id           VARCHAR(36)   NOT NULL,
  date              VARCHAR(10)   NOT NULL,          -- YYYY-MM-DD
  duration_minutes  INT           NOT NULL,          -- session length in minutes
  type              VARCHAR(32)   NOT NULL DEFAULT 'solo',  -- solo/class/sparring/conditioning/other
  notes             TEXT,
  energy_after      INT           DEFAULT NULL,      -- 0-10
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_training_user_date (user_id, date)
);

-- ── OUTREACH LOG (Phase 2.7) ─────────────────────────────────
-- Track daily outreach actions for AI coach enforcement
CREATE TABLE IF NOT EXISTS outreach_log (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  date            VARCHAR(10)   NOT NULL,          -- YYYY-MM-DD
  type            VARCHAR(32)   NOT NULL DEFAULT 'message',  -- message/post/call/email/other
  target          VARCHAR(255)  DEFAULT NULL,      -- person/platform/channel
  project_id      VARCHAR(36)   DEFAULT NULL,
  notes           TEXT,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_outreach_user_date (user_id, date)
);

-- ── WEEKLY REVIEWS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_reviews (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   NOT NULL,
  week_start      VARCHAR(10)   NOT NULL,             -- YYYY-MM-DD (Monday)
  data_json       TEXT,                               -- aggregated stats snapshot
  what_shipped    TEXT,
  what_blocked    TEXT,
  next_priority   TEXT,
  ai_analysis     TEXT,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_weekly_reviews_user_week (user_id, week_start)
);

-- ── TEMPLATES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id              VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id         VARCHAR(36)   DEFAULT NULL, -- NULL means system-wide
  name            VARCHAR(255)  NOT NULL,
  description     TEXT,
  icon            VARCHAR(8)    DEFAULT '📄',
  category        VARCHAR(32)   DEFAULT 'custom',
  config          JSON          NOT NULL,
  is_system       TINYINT(1)    DEFAULT 0,
  created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_templates (user_id, category)
);

-- ── SYNC STATE (Phase 2.4B / 3.4) ────────────────────────────
CREATE TABLE IF NOT EXISTS sync_state (
  id                VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  project_id        VARCHAR(36)   NOT NULL,
  user_id           VARCHAR(36)   NOT NULL,
  folder_handle_key VARCHAR(255),              -- IndexedDB key reference
  sync_status       VARCHAR(32)   DEFAULT 'idle', -- idle, syncing, error
  last_sync_at      DATETIME,
  created_at        DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_project_sync (project_id, user_id)
);

-- ── SYNC FILE STATE (Phase 2.4B) ─────────────────────────────
CREATE TABLE IF NOT EXISTS sync_file_state (
  id                  VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  project_id          VARCHAR(36)   NOT NULL,
  file_path           VARCHAR(512)  NOT NULL,
  desktop_content_hash VARCHAR(64),             -- SHA256 of desktop version
  cloud_content_hash   VARCHAR(64),             -- SHA256 of cloud version
  last_sync_at        DATETIME,
  created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE KEY unique_sync_file (project_id, file_path)
);

-- ── TASKS (Phase 5.4) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  project_id VARCHAR(64) DEFAULT NULL,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(256) NOT NULL,
  description TEXT,
  context_uri VARCHAR(512) DEFAULT NULL,         -- brain:// reference
  assignee_type ENUM('human', 'agent', 'integration') DEFAULT 'human',
  assignee_id VARCHAR(64) DEFAULT 'user',        -- agent ID, 'user', or integration ID
  assignee_context JSON DEFAULT NULL,            -- extra context for assignee
  status ENUM('pending', 'in_progress', 'blocked', 'review', 'complete', 'cancelled') DEFAULT 'pending',
  priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
  due_date DATE DEFAULT NULL,
  parent_task_id VARCHAR(36) DEFAULT NULL,       -- for subtasks
  workflow_instance_id VARCHAR(36) DEFAULT NULL, -- link to workflow execution
  workflow_step_id VARCHAR(64) DEFAULT NULL,     -- which step in template
  assigned_by ENUM('ai', 'user', 'workflow') DEFAULT 'user',
  assignment_reason TEXT,                        -- why this assignee was chosen
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  result_summary TEXT,                           -- what was accomplished
  output_uris JSON DEFAULT NULL,                 -- brain:// references to outputs
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
  INDEX idx_tasks_user_status (user_id, status),
  INDEX idx_tasks_assignee (assignee_type, assignee_id, status),
  INDEX idx_tasks_project (project_id),
  INDEX idx_tasks_due_date (due_date),
  INDEX idx_tasks_priority (priority)
);

-- ============================================================
-- BRAIN OS v2.2 — REL Foundation Tables
-- Phase 0: Relational Entity Graph + Trust Ladder + Worker Registry
-- ============================================================

-- ── REL ENTITIES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rel_entities (
  uri           VARCHAR(255)  PRIMARY KEY,
  type          VARCHAR(50)   NOT NULL,
  status        VARCHAR(20)   DEFAULT 'pending',
  checksum      VARCHAR(64)   DEFAULT NULL,
  metadata      JSON          DEFAULT NULL,
  scope         VARCHAR(20)   DEFAULT NULL,
  memory_type   VARCHAR(20)   DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_rel_type_status (type, status),
  INDEX idx_rel_scope (scope, memory_type)
);

-- ── REL ENTITY LINKS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rel_entity_links (
  id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  source_uri    VARCHAR(255)  NOT NULL,
  target_uri    VARCHAR(255)  NOT NULL,
  relation_type VARCHAR(30)   NOT NULL,
  confidence    FLOAT         DEFAULT 1.0,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_uri) REFERENCES rel_entities(uri) ON DELETE CASCADE,
  FOREIGN KEY (target_uri) REFERENCES rel_entities(uri) ON DELETE CASCADE,
  UNIQUE KEY unique_rel_link (source_uri, target_uri, relation_type),
  INDEX idx_rel_source (source_uri, relation_type),
  INDEX idx_rel_target (target_uri, relation_type)
);

-- ── REL ENTITY TAGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rel_entity_tags (
  uri           VARCHAR(255)  NOT NULL,
  tag           VARCHAR(100)  NOT NULL,
  inherited     BOOLEAN       DEFAULT FALSE,
  PRIMARY KEY (uri, tag),
  FOREIGN KEY (uri) REFERENCES rel_entities(uri) ON DELETE CASCADE
);

-- ── WORKER CAPABILITIES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_capabilities (
  worker_id     VARCHAR(255)  PRIMARY KEY,
  type          VARCHAR(20)   NOT NULL,
  capabilities  JSON          DEFAULT NULL,
  status        VARCHAR(20)   DEFAULT 'offline',
  last_seen     DATETIME      DEFAULT NULL,
  INDEX idx_worker_status (status)
);

-- ── EXECUTION LOG ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS execution_log (
  id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  run_id        VARCHAR(36)   DEFAULT NULL,
  parent_run_id VARCHAR(36)   DEFAULT NULL,
  workflow_id   VARCHAR(255)  DEFAULT NULL,
  worker_id     VARCHAR(255)  DEFAULT NULL,
  provider      VARCHAR(100)  DEFAULT NULL,
  cost_usd      DECIMAL(10,6) DEFAULT NULL,
  tokens_used   INT           DEFAULT NULL,
  duration_ms   INT           DEFAULT NULL,
  quality_score FLOAT         DEFAULT NULL,
  status        VARCHAR(20)   DEFAULT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_run (run_id),
  INDEX idx_exec_workflow (workflow_id)
);

-- ── WORKFLOW TRUST ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflow_trust (
  id                    VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  workflow_id           VARCHAR(255)  NOT NULL,
  project_id            VARCHAR(255)  DEFAULT NULL,
  current_tier          INT           DEFAULT 1,
  run_count             INT           DEFAULT 0,
  approval_count        INT           DEFAULT 0,
  consecutive_approvals INT           DEFAULT 0,
  last_regression_at    DATETIME      DEFAULT NULL,
  promoted_to_tier2_at  DATETIME      DEFAULT NULL,
  promoted_to_tier3_at  DATETIME      DEFAULT NULL,
  tier_locked           BOOLEAN       DEFAULT FALSE,
  created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_workflow_trust (workflow_id)
);

-- ── TRUST EVENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trust_events (
  id            VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  workflow_id   VARCHAR(255)  NOT NULL,
  run_id        VARCHAR(36)   DEFAULT NULL,
  gate_name     VARCHAR(255)  DEFAULT NULL,
  decision      VARCHAR(20)   NOT NULL,
  notes         TEXT          DEFAULT NULL,
  decided_by    VARCHAR(255)  DEFAULT NULL,
  decided_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trust_workflow (workflow_id)
);
