// Handler for trust gate resources: trust, trust-events
// Merged from api/trust.js into data.js handler pattern

import { recordGateDecision } from '../trustLadder.js';

export default async function handleTrust(req, res, { db, userId, ok, err }) {
  const { resource, project_id } = req.query;

  // ── TRUST GATES ──────────────────────────────────────────
  if (resource === 'trust') {
    // GET — list pending trust gates
    if (req.method === 'GET') {
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
      return ok(res, { pending: rows });
    }

    // POST — record a trust gate decision
    if (req.method === 'POST') {
      const { workflow_id, run_id, gate_name, decision, notes } = req.body || {};

      if (!workflow_id || !gate_name || !decision) {
        return err(res, 'workflow_id, gate_name, and decision are required');
      }

      if (!['approved', 'rejected', 'modified'].includes(decision)) {
        return err(res, 'decision must be approved, rejected, or modified');
      }

      // Get user email for audit trail
      const [users] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
      const email = users[0]?.email || 'unknown';

      const result = await recordGateDecision(db, workflow_id, run_id, gate_name, decision, email, notes);
      return ok(res, { success: true, trust: result });
    }

    return err(res, 'Method not allowed', 405);
  }

  return err(res, 'Unknown trust resource', 400);
}
