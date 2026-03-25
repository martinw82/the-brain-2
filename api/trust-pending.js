// api/trust-pending.js — GET endpoint for listing pending trust gates
// Brain OS v2.2 Phase 1

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { getCorsHeaders } from './_lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;

function getAuth(req) {
  const h = req.headers['authorization'] || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), JWT_SECRET); } catch { return null; }
}

function getDb() {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl: { rejectUnauthorized: true },
  });
}

export default async function handler(req, res) {
  const cors = getCorsHeaders(req);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = getAuth(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { project_id } = req.query || {};

  let db;
  try {
    db = await getDb();

    let query = `
      SELECT wt.*, wi.pending_gate, wi.id as instance_id
      FROM workflow_trust wt
      LEFT JOIN workflow_instances wi ON wi.workflow_template_id = wt.workflow_id
        AND wi.status = 'in_progress'
      WHERE wi.pending_gate IS NOT NULL
    `;
    const params = [];

    if (project_id) {
      query += ' AND wt.project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY wi.updated_at DESC';

    const [rows] = await db.execute(query, params);

    return res.status(200).json({ pending: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    if (db) await db.end();
  }
}
