// Handler for sync-related resources: sync-state, drift-check
// Extracted from api/data.js

export default async function handleSync(req, res, { db, userId, ok, err }) {
  const { resource, project_id } = req.query;

  // ── SYNC STATE (Phase 2.4B / 3.4) ────────────────────────────
  if (resource === 'sync-state') {
    if (req.method === 'GET') {
      if (!project_id) return err(res, 'project_id required');
      const [rows] = await db.execute(
        'SELECT * FROM sync_state WHERE project_id = ? AND user_id = ?',
        [project_id, userId]
      );
      return ok(res, { sync: rows[0] || null });
    }
    if (req.method === 'POST') {
      if (!project_id) return err(res, 'project_id required');
      const { folder_handle_key, sync_status } = req.body || {};
      await db.execute(
        `INSERT INTO sync_state (id, project_id, user_id, folder_handle_key, sync_status, last_sync_at) 
         VALUES (UUID(), ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE folder_handle_key = VALUES(folder_handle_key), 
         sync_status = VALUES(sync_status), last_sync_at = VALUES(last_sync_at)`,
        [project_id, userId, folder_handle_key, sync_status || 'idle']
      );
      return ok(res, { success: true }, 201);
    }
  }

  // ── DRIFT DETECTION (Phase 2.10) ──────────────────────────────
  if (resource === 'drift-check') {
    if (req.method === 'GET') {
      const flags = [];
      
      // Check for training deficit
      const [trainingRows] = await db.execute(
        'SELECT COUNT(*) as count FROM training_logs WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
        [userId]
      );
      if (trainingRows[0].count < 3) {
        flags.push({ type: 'training_deficit', message: 'Only ' + trainingRows[0].count + ' training sessions this week', severity: 'medium' });
      }
      
      // Check for outreach gap
      const [outreachRows] = await db.execute(
        'SELECT COUNT(*) as count FROM outreach_log WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
        [userId]
      );
      if (outreachRows[0].count < 3) {
        flags.push({ type: 'outreach_gap', message: 'Only ' + outreachRows[0].count + ' outreach actions this week', severity: 'medium' });
      }
      
      // Check for energy decline
      const [energyRows] = await db.execute(
        'SELECT AVG(energy_level) as avg_energy FROM daily_checkins WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)',
        [userId]
      );
      if (energyRows[0].avg_energy && energyRows[0].avg_energy < 5) {
        flags.push({ type: 'energy_decline', message: 'Average energy level below 5 this week', severity: 'high' });
      }
      
      return ok(res, { flags });
    }
  }

  return null; // Not handled
}
