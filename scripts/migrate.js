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
