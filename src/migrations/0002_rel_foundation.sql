-- Migration: REL Foundation (Brain OS v2.2 Phase 0)
-- Purpose: Create relational entity graph, trust ladder, worker registry, and execution log tables
-- Date: 2026-03-25
-- BLOCKS ALL OTHER v2.2 WORK — Phase 0 hard gate

-- ── REL ENTITIES ────────────────────────────────────────────────
-- Core entity node table. URI-keyed (brain:// scheme).
-- Every file, task, asset, workflow, agent output must be registered here.
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
-- Directed edges between entities. URI-based source/target.
-- relation_type: depends_on, generated_by, part_of, succeeded_by,
--   version_of, input_to, output_from, blocks, relates_to,
--   awaits_reply_by, responds_to
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
-- Tags attached to entities. Supports inheritance (propagateTags).
CREATE TABLE IF NOT EXISTS rel_entity_tags (
  uri           VARCHAR(255)  NOT NULL,
  tag           VARCHAR(100)  NOT NULL,
  inherited     BOOLEAN       DEFAULT FALSE,
  PRIMARY KEY (uri, tag),
  FOREIGN KEY (uri) REFERENCES rel_entities(uri) ON DELETE CASCADE
);

-- ── WORKER CAPABILITIES ─────────────────────────────────────────
-- Worker registry for UAB routing.
CREATE TABLE IF NOT EXISTS worker_capabilities (
  worker_id     VARCHAR(255)  PRIMARY KEY,
  type          VARCHAR(20)   NOT NULL,
  capabilities  JSON          DEFAULT NULL,
  status        VARCHAR(20)   DEFAULT 'offline',
  last_seen     DATETIME      DEFAULT NULL,
  INDEX idx_worker_status (status)
);

-- ── EXECUTION LOG ───────────────────────────────────────────────
-- Tracks every worker execution: provider, cost, tokens, duration.
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
  INDEX idx_exec_workflow (workflow_id),
  INDEX idx_exec_run (run_id)
);

-- ── WORKFLOW TRUST ──────────────────────────────────────────────
-- Trust Ladder state per workflow.
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
-- Audit log for every trust gate decision.
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

-- ── ALTER WORKFLOW INSTANCES ────────────────────────────────────
-- Add trust columns to existing workflow_instances table.
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS trust_tier INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pending_gate TEXT DEFAULT NULL;
