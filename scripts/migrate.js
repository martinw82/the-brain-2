import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const config = {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '3306'),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl:      { rejectUnauthorized: true },
    multipleStatements: true,
};

const migrations = [
    {
        version: 1,
        name: 'add_deleted_at_to_project_files',
        sql: 'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL AFTER content;'
    },
    {
        version: 2,
        name: 'create_schema_migrations_table',
        sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          version INT NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    },
    {
        version: 3,
        name: 'create_life_areas_table',
        sql: `CREATE TABLE IF NOT EXISTS life_areas (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          color VARCHAR(16) DEFAULT '#3b82f6',
          icon VARCHAR(8) DEFAULT '🌐',
          description TEXT,
          target_hours_weekly INT DEFAULT NULL,
          health_score INT DEFAULT 100,
          sort_order INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    },
    {
        version: 4,
        name: 'create_goals_table',
        sql: `CREATE TABLE IF NOT EXISTS goals (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(255) NOT NULL,
          target_amount DECIMAL(15,2) DEFAULT 0,
          current_amount DECIMAL(15,2) DEFAULT 0,
          currency VARCHAR(3) DEFAULT 'GBP',
          deadline DATE,
          status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    },
    {
        version: 5,
        name: 'create_goal_contributions_table',
        sql: `CREATE TABLE IF NOT EXISTS goal_contributions (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          goal_id VARCHAR(36) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          source VARCHAR(128),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
        );`
    },
    {
        version: 6,
        name: 'create_tags_tables',
        sql: `CREATE TABLE IF NOT EXISTS tags (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(128) NOT NULL,
          color VARCHAR(16) DEFAULT '#3b82f6',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_tag (user_id, name)
        );

        CREATE TABLE IF NOT EXISTS entity_tags (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          entity_type VARCHAR(32) NOT NULL,
          entity_id VARCHAR(36) NOT NULL,
          tag_id VARCHAR(36) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_entity_tag (entity_type, entity_id, tag_id),
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS entity_links (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          source_type VARCHAR(32) NOT NULL,
          source_id VARCHAR(36) NOT NULL,
          target_type VARCHAR(32) NOT NULL,
          target_id VARCHAR(36) NOT NULL,
          link_type VARCHAR(64) DEFAULT 'related',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_link (source_type, source_id, target_type, target_id)
        );`
    },
    {
        version: 7,
        name: 'create_templates_table',
        sql: `CREATE TABLE IF NOT EXISTS templates (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36),
          name VARCHAR(128) NOT NULL,
          icon VARCHAR(8) DEFAULT '📋',
          description TEXT,
          folders JSON NOT NULL,
          default_files JSON,
          is_system BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    },
    {
        version: 8,
        name: 'create_file_metadata_table',
        sql: `CREATE TABLE IF NOT EXISTS file_metadata (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64) NOT NULL,
          file_path VARCHAR(512) NOT NULL,
          category VARCHAR(64),
          status VARCHAR(64),
          custom_fields JSON,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_project_file (project_id, file_path)
        );`
    },
    {
        version: 9,
        name: 'create_sync_tables',
        sql: `CREATE TABLE IF NOT EXISTS sync_state (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64) NOT NULL,
          folder_handle JSON,
          last_sync_at DATETIME,
          sync_status ENUM('disconnected', 'connected', 'syncing', 'error') DEFAULT 'disconnected',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_project_sync (project_id)
        );

        CREATE TABLE IF NOT EXISTS sync_file_state (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          sync_state_id VARCHAR(36) NOT NULL,
          file_path VARCHAR(512) NOT NULL,
          local_hash VARCHAR(64),
          remote_hash VARCHAR(64),
          last_synced_at DATETIME,
          FOREIGN KEY (sync_state_id) REFERENCES sync_state(id) ON DELETE CASCADE,
          UNIQUE KEY unique_sync_file (sync_state_id, file_path)
        );`
    },
    {
        version: 10,
        name: 'create_daily_checkins_table',
        sql: `CREATE TABLE IF NOT EXISTS daily_checkins (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          checkin_date DATE NOT NULL,
          sleep_hours DECIMAL(3,1),
          energy_level INT,
          gut_health INT,
          training_done BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_date (user_id, checkin_date)
        );`
    },
    {
        version: 11,
        name: 'create_training_logs_table',
        sql: `CREATE TABLE IF NOT EXISTS training_logs (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          training_date DATE NOT NULL,
          training_type VARCHAR(64),
          duration_minutes INT,
          intensity VARCHAR(32),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_training (user_id, training_date, training_type)
        );`
    },
    {
        version: 12,
        name: 'create_outreach_log_table',
        sql: `CREATE TABLE IF NOT EXISTS outreach_log (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          outreach_date DATE NOT NULL,
          contact_name VARCHAR(128),
          contact_platform VARCHAR(64),
          outreach_type VARCHAR(64),
          response_received BOOLEAN DEFAULT FALSE,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    },
    {
        version: 13,
        name: 'create_weekly_reviews_table',
        sql: `CREATE TABLE IF NOT EXISTS weekly_reviews (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          week_start DATE NOT NULL,
          week_end DATE NOT NULL,
          summary TEXT,
          ai_analysis TEXT,
          focus_area VARCHAR(128),
          accomplishments TEXT,
          improvements TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_week (user_id, week_start)
        );`
    },
    {
        version: 14,
        name: 'create_notifications_table',
        sql: `CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(64) NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          action_url VARCHAR(512),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME,
          INDEX idx_notifications_user_read (user_id, read),
          INDEX idx_notifications_created (created_at)
        );`
    },
    {
        version: 15,
        name: 'create_project_integrations_table',
        sql: `CREATE TABLE IF NOT EXISTS project_integrations (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64) NOT NULL,
          provider VARCHAR(32) NOT NULL,
          repo_owner VARCHAR(128),
          repo_name VARCHAR(128),
          branch VARCHAR(64) DEFAULT 'main',
          access_token TEXT,
          sync_enabled BOOLEAN DEFAULT FALSE,
          last_sync_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_project_provider (project_id, provider)
        );`
    },
    {
        version: 16,
        name: 'add_onboarding_completed_to_users',
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;`
    },
    {
        version: 17,
        name: 'create_ai_usage_table',
        sql: `CREATE TABLE IF NOT EXISTS ai_usage (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          usage_date DATE NOT NULL,
          input_tokens INT DEFAULT 0,
          output_tokens INT DEFAULT 0,
          estimated_cost_usd DECIMAL(10,6) DEFAULT 0,
          model VARCHAR(64),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ai_usage_user_date (user_id, usage_date)
        );`
    },
    {
        version: 18,
        name: 'create_user_ai_settings_table',
        sql: `CREATE TABLE IF NOT EXISTS user_ai_settings (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL UNIQUE,
          provider VARCHAR(32) DEFAULT 'anthropic',
          model VARCHAR(64) DEFAULT 'claude-sonnet-4-20250514',
          api_key_encrypted TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );`
    },
    {
        version: 19,
        name: 'create_tasks_table',
        sql: `CREATE TABLE IF NOT EXISTS tasks (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64),
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(256) NOT NULL,
          description TEXT,
          context_uri VARCHAR(512),
          assignee_type ENUM('human', 'agent', 'integration') DEFAULT 'human',
          assignee_id VARCHAR(64),
          assignee_context JSON,
          status ENUM('pending', 'in_progress', 'blocked', 'review', 'complete', 'cancelled') DEFAULT 'pending',
          priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
          due_date DATE,
          parent_task_id VARCHAR(36),
          workflow_instance_id VARCHAR(36),
          workflow_step_id VARCHAR(64),
          assigned_by ENUM('ai', 'user', 'workflow') DEFAULT 'user',
          assignment_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME,
          completed_at DATETIME,
          result_summary TEXT,
          output_uris JSON,
          INDEX idx_tasks_user_status (user_id, status),
          INDEX idx_tasks_assignee (assignee_type, assignee_id, status),
          INDEX idx_tasks_project (project_id),
          INDEX idx_tasks_due_date (due_date),
          INDEX idx_tasks_priority (priority)
        );`
    },
    {
        version: 20,
        name: 'create_file_summaries_table',
        sql: `CREATE TABLE IF NOT EXISTS file_summaries (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64) NOT NULL,
          file_path VARCHAR(512) NOT NULL,
          l0_abstract TEXT,
          l1_overview TEXT,
          content_hash VARCHAR(64),
          token_count INT,
          generated_at DATETIME,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          generated_by VARCHAR(64),
          UNIQUE KEY unique_project_file_summary (project_id, file_path)
        );`
    },
    {
        version: 21,
        name: 'create_workflow_tables',
        sql: `CREATE TABLE IF NOT EXISTS workflow_templates (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(36) DEFAULT NULL,
          name VARCHAR(64) NOT NULL,
          description TEXT,
          icon VARCHAR(8) DEFAULT '📋',
          steps JSON NOT NULL,
          triggers JSON DEFAULT NULL,
          is_system BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_workflow_templates_system (is_system),
          INDEX idx_workflow_templates_active (is_active)
        );

        CREATE TABLE IF NOT EXISTS workflow_instances (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          workflow_template_id VARCHAR(64) NOT NULL,
          project_id VARCHAR(64) DEFAULT NULL,
          user_id VARCHAR(36) NOT NULL,
          status ENUM('pending', 'running', 'paused', 'completed', 'failed', 'aborted') DEFAULT 'pending',
          current_step_index INT DEFAULT 0,
          step_results JSON,
          execution_log TEXT,
          started_by ENUM('user', 'ai', 'trigger') DEFAULT 'user',
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME DEFAULT NULL,
          estimated_completion DATETIME DEFAULT NULL,
          FOREIGN KEY (workflow_template_id) REFERENCES workflow_templates(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_workflow_instances_status (status),
          INDEX idx_workflow_instances_project (project_id),
          INDEX idx_workflow_instances_user (user_id)
        );`
    },
    {
        version: 22,
        name: 'create_memories_table',
        sql: `CREATE TABLE IF NOT EXISTS memories (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          category ENUM('profile', 'preferences', 'entities', 'events', 'cases', 'patterns') NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          source_type ENUM('workflow', 'task', 'project', 'session', 'checkin', 'manual') DEFAULT 'manual',
          source_id VARCHAR(36) DEFAULT NULL,
          confidence FLOAT DEFAULT 0.5,
          is_active BOOLEAN DEFAULT TRUE,
          last_accessed DATETIME DEFAULT NULL,
          accessed_count INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_memories_user_category (user_id, category),
          INDEX idx_memories_source (source_type, source_id)
        );`
    },
    {
        version: 23,
        name: 'create_community_workflows_table',
        sql: `CREATE TABLE IF NOT EXISTS community_workflows (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          original_workflow_id VARCHAR(64),
          original_user_id VARCHAR(36),
          name VARCHAR(64) NOT NULL,
          description TEXT,
          icon VARCHAR(8) DEFAULT '📋',
          category VARCHAR(32) DEFAULT 'general',
          steps JSON NOT NULL,
          is_published BOOLEAN DEFAULT FALSE,
          stars INT DEFAULT 0,
          forks INT DEFAULT 0,
          usage_count INT DEFAULT 0,
          avg_rating FLOAT DEFAULT 0,
          rating_count INT DEFAULT 0,
          published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_community_workflows_category (category),
          INDEX idx_community_workflows_stars (stars DESC),
          INDEX idx_community_workflows_usage (usage_count DESC)
        );`
    },
    {
        version: 24,
        name: 'create_integrations_tables',
        sql: `CREATE TABLE IF NOT EXISTS user_integrations (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          provider ENUM('github', 'google', 'slack', 'discord', 'email') NOT NULL,
          access_token TEXT,
          refresh_token TEXT,
          token_expires_at DATETIME,
          metadata JSON DEFAULT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_provider (user_id, provider),
          INDEX idx_integrations_user (user_id),
          INDEX idx_integrations_provider (provider)
        );

        CREATE TABLE IF NOT EXISTS integration_sync_log (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          integration_id VARCHAR(36) NOT NULL,
          provider ENUM('github', 'google', 'slack', 'discord', 'email') NOT NULL,
          sync_type ENUM('full', 'incremental') DEFAULT 'incremental',
          direction ENUM('inbound', 'outbound', 'bidirectional') DEFAULT 'inbound',
          status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
          items_synced INT DEFAULT 0,
          errors JSON DEFAULT NULL,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (integration_id) REFERENCES user_integrations(id) ON DELETE CASCADE,
          INDEX idx_sync_log_user (user_id),
          INDEX idx_sync_log_status (status)
        );`
    }
];

async function runMigrations() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected to database for migrations.');

        await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          version INT NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`);

        const [applied] = await connection.query('SELECT version FROM schema_migrations');
        const appliedVersions = new Set(applied.map(r => r.version));

        for (const m of migrations) {
            if (!appliedVersions.has(m.version)) {
                console.log(`Applying migration v${m.version}: ${m.name}...`);
                try {
                    await connection.query(m.sql);
                    await connection.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
                    console.log('✅ Success');
                } catch (error) {
                    console.error(`❌ Migration v${m.version} failed:`, error.message);
                    throw error;
                }
            } else {
                console.log(`Migration v${m.version} already applied.`);
            }
        }
        console.log('All migrations complete.');
    } catch (e) {
        console.error('❌ Migration failed:', e.message);
    } finally {
        if (connection) await connection.end();
    }
}

runMigrations();
