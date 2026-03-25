// api/trust.js — Trust gate endpoints (GET pending, POST decision)
// Brain OS v2.2 Phase 1

import jwt from 'jsonwebtoken';
import mysql from 'mysql2/promise';
import { getCorsHeaders } from './_lib/cors.js';
import { recordGateDecision } from './_lib/trustLadder.js';

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

  let db;
  try {
    db = await getDb();

    // GET — list pending trust gates
    if (req.method === 'GET') {
      const { project_id } = req.query || {};

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
    }

    // POST — record a trust gate decision
    if (req.method === 'POST') {
      const { workflow_id, run_id, gate_name, decision, notes } = req.body || {};

      if (!workflow_id || !gate_name || !decision) {
        return res.status(400).json({ error: 'workflow_id, gate_name, and decision are required' });
      }

      if (!['approved', 'rejected', 'modified'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be approved, rejected, or modified' });
      }

      const result = await recordGateDecision(db, workflow_id, run_id, gate_name, decision, user.email, notes);
      return res.status(200).json({ success: true, trust: result });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    if (db) await db.end();
  }
}
