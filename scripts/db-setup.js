// scripts/db-setup.js
// Run once to create all tables: npm run db:setup
// Works against TiDB Cloud, Railway MySQL, or any MySQL-compatible DB

import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dir = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dir, '../schema.sql'), 'utf8');

async function setup() {
  console.log('🧠 The Brain — Database Setup\n');

  const config = process.env.DATABASE_URL
    ? { uri: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, multipleStatements: true }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT || '3306'),
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'the_brain',
        ssl:      process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },
        multipleStatements: true,
      };

  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected\n');

    console.log('Running schema...');
    await connection.query(schema);
    console.log('✅ All tables created\n');

    // Verify tables
    const [tables] = await connection.query("SHOW TABLES");
    console.log('Tables created:');
    tables.forEach(t => console.log(' ', Object.values(t)[0]));

    console.log('\n✅ Database setup complete. You can now run the app.');
  } catch (e) {
    console.error('\n❌ Setup failed:', e.message);
    console.error('\nCheck your DATABASE_URL or DB_* variables in .env');
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

setup();
