// Handler for admin resources: export-all, import-all, agent-stats, wipe-user
// Extracted from api/data.js

export default async function handleAdmin(req, res, { db, userId, ok, err }) {
  const { resource } = req.query;

  // ── EXPORT ALL ────────────────────────────────────────────────
  if (resource === 'export-all') {
    if (req.method === 'GET') {
      // Export all user data
      const [projects] = await db.execute('SELECT * FROM projects WHERE user_id = ?', [userId]);
      const [staging] = await db.execute('SELECT * FROM staging WHERE user_id = ?', [userId]);
      const [ideas] = await db.execute('SELECT * FROM ideas WHERE user_id = ?', [userId]);
      const [goals] = await db.execute('SELECT * FROM goals WHERE user_id = ?', [userId]);
      const [areas] = await db.execute('SELECT * FROM life_areas WHERE user_id = ?', [userId]);
      const [templates] = await db.execute('SELECT * FROM templates WHERE user_id = ?', [userId]);
      const [tags] = await db.execute('SELECT * FROM tags WHERE user_id = ?', [userId]);
      
      const export_data = {
        exported_at: new Date().toISOString(),
        projects,
        staging,
        ideas,
        goals,
        areas,
        templates,
        tags,
      };
      
      return ok(res, { export: export_data });
    }
  }

  // ── IMPORT ALL ────────────────────────────────────────────────
  if (resource === 'import-all') {
    if (req.method === 'POST') {
      const { data } = req.body || {};
      if (!data) return err(res, 'data required');
      
      // Import user data
      let imported = { projects: 0, staging: 0, ideas: 0, goals: 0 };
      
      if (data.projects) {
        for (const p of data.projects) {
          await db.execute(
            'INSERT INTO projects (id, user_id, name, emoji, phase, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
            [p.id, userId, p.name, p.emoji, p.phase, p.status]
          );
          imported.projects++;
        }
      }
      
      return ok(res, { success: true, imported });
    }
  }

  // ── AGENT STATS (Phase 5.3) ───────────────────────────────────
  if (resource === 'agent-stats') {
    if (req.method === 'GET') {
      const { agent_id } = req.query;
      
      if (agent_id) {
        // Stats for specific agent
        const [runs] = await db.execute(
          'SELECT COUNT(*) as run_count, AVG(duration_ms) as avg_duration FROM execution_log WHERE workflow_id = ? AND user_id = ?',
          [agent_id, userId]
        );
        return ok(res, { agent_id, stats: runs[0] });
      } else {
        // Stats for all agents
        const [rows] = await db.execute(
          `SELECT workflow_id, COUNT(*) as run_count, AVG(duration_ms) as avg_duration, AVG(quality_score) as avg_quality
           FROM execution_log WHERE user_id = ? GROUP BY workflow_id`,
          [userId]
        );
        return ok(res, { stats: rows });
      }
    }
  }

  // ── WIPE USER DATA ────────────────────────────────────────────
  if (resource === 'wipe-user') {
    if (req.method === 'POST') {
      const { confirm } = req.body || {};
      if (confirm !== 'DELETE_ALL_MY_DATA') return err(res, 'confirmation required');
      
      // Delete all user data
      await db.execute('DELETE FROM staging WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM ideas WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM sessions WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM comments WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM life_areas WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM goals WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM tags WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM entity_tags WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM entity_links WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM daily_checkins WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM training_logs WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM outreach_log WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM weekly_reviews WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM templates WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM sync_state WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM tasks WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM memories WHERE user_id = ?', [userId]);
      
      // Delete projects last (due to FK constraints)
      await db.execute('DELETE FROM projects WHERE user_id = ?', [userId]);
      
      return ok(res, { success: true, wiped: true });
    }
  }

  return null; // Not handled
}
