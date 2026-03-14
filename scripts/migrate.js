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
        name: 'add_life_area_id_to_projects',
        sql: 'ALTER TABLE projects ADD COLUMN IF NOT EXISTS life_area_id VARCHAR(36) DEFAULT NULL AFTER user_id;'
    },
    {
        version: 5,
        name: 'create_goals_table',
        sql: `CREATE TABLE IF NOT EXISTS goals (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          target_amount INT NOT NULL,
          current_amount INT DEFAULT 0,
          currency VARCHAR(8) DEFAULT 'GBP',
          timeframe VARCHAR(32) DEFAULT 'monthly',
          category VARCHAR(32) DEFAULT 'income',
          status VARCHAR(32) DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    },
    {
        version: 6,
        name: 'create_goal_contributions_table',
        sql: `CREATE TABLE IF NOT EXISTS goal_contributions (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          goal_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          project_id VARCHAR(64) DEFAULT NULL,
          source_label VARCHAR(255),
          amount INT NOT NULL,
          date VARCHAR(10),
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    },
    {
        version: 7,
        name: 'create_templates_table',
        sql: `CREATE TABLE IF NOT EXISTS templates (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) DEFAULT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          icon VARCHAR(8) DEFAULT '📄',
          category VARCHAR(32) DEFAULT 'custom',
          config JSON NOT NULL,
          is_system TINYINT(1) DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );`
    },
    {
        version: 8,
        name: 'create_tags_table',
        sql: `CREATE TABLE IF NOT EXISTS tags (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          name VARCHAR(128) NOT NULL,
          color VARCHAR(16) DEFAULT '#3b82f6',
          category VARCHAR(32) DEFAULT 'custom',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );`
    },
    {
        version: 9,
        name: 'create_entity_tags_table',
        sql: `CREATE TABLE IF NOT EXISTS entity_tags (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          tag_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          entity_type VARCHAR(32) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_entity_tag (tag_id, entity_type, entity_id)
        );`
    },
    {
        version: 10,
        name: 'create_entity_links_table',
        sql: `CREATE TABLE IF NOT EXISTS entity_links (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          source_type VARCHAR(32) NOT NULL,
          source_id VARCHAR(64) NOT NULL,
          target_type VARCHAR(32) NOT NULL,
          target_id VARCHAR(64) NOT NULL,
          relationship VARCHAR(32) DEFAULT 'related',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_link (user_id, source_type, source_id, target_type, target_id)
        );`
    },
    {
        version: 11,
        name: 'add_settings_to_users',
        sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS settings TEXT DEFAULT NULL;'
    },
    {
        version: 12,
        name: 'create_daily_checkins_table',
        sql: `CREATE TABLE IF NOT EXISTS daily_checkins (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          date VARCHAR(10) NOT NULL,
          sleep_hours INT DEFAULT NULL,
          energy_level INT DEFAULT NULL,
          gut_symptoms INT DEFAULT NULL,
          training_done TINYINT(1) DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_date (user_id, date),
          INDEX idx_user_date (user_id, date)
        );`
    },
    {
        version: 13,
        name: 'create_training_logs_table',
        sql: `CREATE TABLE IF NOT EXISTS training_logs (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          date VARCHAR(10) NOT NULL,
          duration_minutes INT NOT NULL,
          type VARCHAR(32) NOT NULL DEFAULT 'solo',
          notes TEXT,
          energy_after INT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_training_user_date (user_id, date)
        );`
    },
    {
        version: 14,
        name: 'create_outreach_log_table',
        sql: `CREATE TABLE IF NOT EXISTS outreach_log (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          date VARCHAR(10) NOT NULL,
          type VARCHAR(32) NOT NULL DEFAULT 'message',
          target VARCHAR(255) DEFAULT NULL,
          project_id VARCHAR(36) DEFAULT NULL,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_outreach_user_date (user_id, date)
        );`
    },
    {
        version: 15,
        name: 'create_weekly_reviews_table',
        sql: `CREATE TABLE IF NOT EXISTS weekly_reviews (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          week_start VARCHAR(10) NOT NULL,
          data_json TEXT,
          what_shipped TEXT,
          what_blocked TEXT,
          next_priority TEXT,
          ai_analysis TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_weekly_reviews_user_week (user_id, week_start)
        );`
    },
    {
        version: 16,
        name: 'create_sync_state_table',
        sql: `CREATE TABLE IF NOT EXISTS sync_state (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          folder_handle_key VARCHAR(255),
          sync_status VARCHAR(32) DEFAULT 'idle',
          last_sync_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_project_sync (project_id, user_id)
        );`
    },
    {
        version: 17,
        name: 'create_sync_file_state_table',
        sql: `CREATE TABLE IF NOT EXISTS sync_file_state (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(36) NOT NULL,
          file_path VARCHAR(512) NOT NULL,
          desktop_content_hash VARCHAR(64),
          cloud_content_hash VARCHAR(64),
          last_sync_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE KEY unique_sync_file (project_id, file_path)
        );`
    },
    {
        version: 18,
        name: 'add_onboarding_completed_to_users',
        sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE AFTER settings;`
    },
    {
        version: 19,
        name: 'create_project_integrations_table',
        sql: `CREATE TABLE IF NOT EXISTS project_integrations (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(36) NOT NULL,
          provider VARCHAR(32) NOT NULL,
          repo_owner VARCHAR(255) NOT NULL,
          repo_name VARCHAR(255) NOT NULL,
          branch VARCHAR(64) DEFAULT 'main',
          access_token TEXT,
          sync_enabled BOOLEAN DEFAULT TRUE,
          last_sync_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_project_provider (project_id, provider),
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );`
    },
    {
        version: 20,
        name: 'create_notifications_table',
        sql: `CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(32) NOT NULL,
          message TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          action_url VARCHAR(512) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_notifications_user_read (user_id, read),
          INDEX idx_notifications_created (created_at)
        );`
    },
    {
        version: 21,
        name: 'create_ai_usage_table',
        sql: `CREATE TABLE IF NOT EXISTS ai_usage (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          date DATE NOT NULL,
          input_tokens INT DEFAULT 0,
          output_tokens INT DEFAULT 0,
          cache_creation_input_tokens INT DEFAULT 0,
          cache_read_input_tokens INT DEFAULT 0,
          estimated_cost_usd DECIMAL(8,4) DEFAULT 0.0000,
          model VARCHAR(50) DEFAULT 'unknown',
          request_count INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_date (user_id, date),
          INDEX idx_ai_usage_date (date)
        );`
    },
    {
        version: 22,
        name: 'create_user_ai_settings_table',
        sql: `CREATE TABLE IF NOT EXISTS user_ai_settings (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          user_id VARCHAR(36) NOT NULL,
          provider VARCHAR(32) DEFAULT 'anthropic',
          api_key_encrypted TEXT,
          model VARCHAR(64) DEFAULT 'claude-sonnet-4-6',
          max_tokens INT DEFAULT 1000,
          temperature DECIMAL(3,2) DEFAULT 0.7,
          enabled TINYINT(1) DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_ai_settings (user_id),
          INDEX idx_provider (provider)
        );`
    },
    {
        version: 23,
        name: 'create_tasks_table',
        sql: `CREATE TABLE IF NOT EXISTS tasks (
          id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
          project_id VARCHAR(64) DEFAULT NULL,
          user_id VARCHAR(36) NOT NULL,
          title VARCHAR(256) NOT NULL,
          description TEXT,
          context_uri VARCHAR(512) DEFAULT NULL,
          assignee_type ENUM('human', 'agent', 'integration') DEFAULT 'human',
          assignee_id VARCHAR(64) DEFAULT 'user',
          assignee_context JSON DEFAULT NULL,
          status ENUM('pending', 'in_progress', 'blocked', 'review', 'complete', 'cancelled') DEFAULT 'pending',
          priority ENUM('critical', 'high', 'medium', 'low') DEFAULT 'medium',
          due_date DATE DEFAULT NULL,
          parent_task_id VARCHAR(36) DEFAULT NULL,
          workflow_instance_id VARCHAR(36) DEFAULT NULL,
          workflow_step_id VARCHAR(64) DEFAULT NULL,
          assigned_by ENUM('ai', 'user', 'workflow') DEFAULT 'user',
          assignment_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME DEFAULT NULL,
          completed_at DATETIME DEFAULT NULL,
          result_summary TEXT,
          output_uris JSON DEFAULT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
          FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
          INDEX idx_tasks_user_status (user_id, status),
          INDEX idx_tasks_assignee (assignee_type, assignee_id, status),
          INDEX idx_tasks_project (project_id),
          INDEX idx_tasks_due_date (due_date),
          INDEX idx_tasks_priority (priority)
        );`
    }
];

async function runMigrations() {
    let connection;
    try {
        connection = await mysql.createConnection(config);
        console.log('Connected to database for migrations.');

        // Ensure migrations table exists (catch-22 for first run)
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
                await connection.query(m.sql);
                await connection.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [m.version, m.name]);
                console.log('✅ Success');
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
