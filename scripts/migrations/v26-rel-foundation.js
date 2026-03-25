/**
 * Migration v26 - REL Foundation (v2.2 Architecture)
 * 
 * Creates tables for:
 * - rel_entities (entity graph nodes)
 * - worker_capabilities (worker registration)
 * - execution_log (execution tracking)
 * - workflow_trust (trust ladder)
 * - trust_events (trust decisions)
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const migration = {
  version: 26,
  name: 'REL Foundation - v2.2 Architecture',
  description: 'Creates entity graph and trust ladder tables',
};

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'the_brain',
    port: parseInt(process.env.DB_PORT || '3306'),
  });

  console.log(`Running migration v${migration.version}: ${migration.name}`);

  try {
    // Create rel_entities table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rel_entities (
        uri VARCHAR(512) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        checksum VARCHAR(64),
        metadata JSON,
        scope VARCHAR(20) DEFAULT 'project',
        memory_type VARCHAR(20),
        project_id VARCHAR(64),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rel_entity_type (type, status),
        INDEX idx_rel_entity_scope (scope, type),
        INDEX idx_rel_entity_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created rel_entities table');

    // Create worker_capabilities table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS worker_capabilities (
        worker_id VARCHAR(36) PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        capabilities JSON NOT NULL,
        status VARCHAR(20) DEFAULT 'offline',
        last_seen DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created worker_capabilities table');

    // Create execution_log table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS execution_log (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        run_id VARCHAR(36) UNIQUE,
        parent_run_id VARCHAR(36),
        workflow_id VARCHAR(255),
        worker_id VARCHAR(36),
        provider VARCHAR(100),
        cost_usd DECIMAL(10, 6),
        tokens_used INT,
        duration_ms INT,
        quality_score DECIMAL(3, 2),
        status VARCHAR(20),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_execution_run (run_id),
        INDEX idx_execution_workflow (workflow_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created execution_log table');

    // Create workflow_trust table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS workflow_trust (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        workflow_id VARCHAR(255) UNIQUE,
        project_id VARCHAR(64),
        current_tier INT DEFAULT 1,
        run_count INT DEFAULT 0,
        approval_count INT DEFAULT 0,
        consecutive_approvals INT DEFAULT 0,
        last_regression_at DATETIME,
        promoted_to_tier2_at DATETIME,
        promoted_to_tier3_at DATETIME,
        tier_locked TINYINT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_workflow_trust_workflow (workflow_id),
        INDEX idx_workflow_trust_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created workflow_trust table');

    // Create trust_events table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS trust_events (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        workflow_id VARCHAR(255),
        run_id VARCHAR(36),
        gate_name VARCHAR(255),
        decision VARCHAR(20),
        notes TEXT,
        decided_by VARCHAR(255),
        decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_trust_events_workflow (workflow_id),
        INDEX idx_trust_events_run (run_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created trust_events table');

    // Record migration
    await connection.execute(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, NOW())',
      [migration.version, migration.name]
    );
    console.log('✓ Recorded migration in schema_migrations');

    console.log(`\nMigration v${migration.version} completed successfully!`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

run();
