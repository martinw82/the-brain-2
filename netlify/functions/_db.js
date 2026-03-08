// netlify/functions/_db.js
// Shared MySQL connection pool — imported by all functions
// Works with TiDB Cloud, Railway MySQL, plain MySQL, MariaDB
// Just change DATABASE_URL in .env

import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
  if (pool) return pool;

  // TiDB Cloud connection string format:
  // mysql://user:password@host:4000/the_brain?ssl={"rejectUnauthorized":true}
  // Or use individual env vars (see .env.example)
  
  if (process.env.DATABASE_URL) {
    pool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
    });
  } else {
    pool = mysql.createPool({
      host:     process.env.DB_HOST,
      port:     parseInt(process.env.DB_PORT || '3306'),
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME || 'the_brain',
      ssl:      process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: true },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '+00:00',
    });
  }

  return pool;
}

export async function query(sql, params = []) {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows;
}
