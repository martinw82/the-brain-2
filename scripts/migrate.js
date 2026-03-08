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
