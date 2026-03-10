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

-- ── STAGING ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staging (
  id          VARCHAR(36)   PRIMARY KEY DEFAULT (UUID()),
  user_id     VARCHAR(36)   NOT NULL,
  project_id  VARCHAR(64)   NOT NULL,
  name        VARCHAR(512)  NOT NULL,
  tag         VARCHAR(32)   DEFAULT 'IDEA_',
  status      VARCHAR(32)   DEFAULT 'in-review',
  notes       TEXT,
  added       VARCHAR(8),                      -- YYYY-MM
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_user_staging (user_id, status)
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
