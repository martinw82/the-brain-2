import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema.js";

// ────────────────────────────────────────────────────────────────
// Database Connection Pool
// ────────────────────────────────────────────────────────────────

const poolPromise = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "the_brain",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ────────────────────────────────────────────────────────────────
// Drizzle ORM Instance
// ────────────────────────────────────────────────────────────────

export const db = drizzle(await poolPromise, { schema, mode: "default" });

export { schema };
