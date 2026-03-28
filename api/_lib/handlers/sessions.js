// Handler for session-related resources: sessions, comments, daily-checkins, training-logs, weekly-reviews
// Extracted from api/data.js

export default async function handleSessions(req, res, { db, userId, ok, err, limit }) {
  const { resource, id: resourceId, project_id, file_path, date, days, weeks } = req.query;

  // ── SESSIONS ──────────────────────────────────────────────
  if (resource === 'sessions') {
    if (req.method === 'GET') {
      const lim = parseInt(limit || '20');
      const [rows] = await db.execute(
        'SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, lim]
      );
      return ok(res, { sessions: rows });
    }
    if (req.method === 'POST') {
      const { project_id: pid, duration_s, log, started_at, ended_at } = req.body || {};
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO sessions (id, user_id, project_id, duration_s, log, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, pid || null, duration_s || 0, log || '', started_at || null, ended_at || null]
      );
      return ok(res, { success: true, id }, 201);
    }
  }

  // ── COMMENTS ─────────────────────────────────────────────
  if (resource === 'comments') {
    if (req.method === 'GET') {
      if (!project_id || !file_path) return err(res, 'project_id and file_path required');
      const [rows] = await db.execute(
        'SELECT * FROM comments WHERE user_id = ? AND project_id = ? AND file_path = ? ORDER BY created_at ASC',
        [userId, project_id, file_path]
      );
      return ok(res, { comments: rows });
    }
    if (req.method === 'POST') {
      const { project_id: pid, file_path: fp, text } = req.body || {};
      if (!pid || !fp || !text) return err(res, 'project_id, file_path and text required');
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO comments (id, user_id, project_id, file_path, text) VALUES (?, ?, ?, ?, ?)',
        [id, userId, pid, fp, text]
      );
      return ok(res, { success: true, id }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const { resolved } = req.body || {};
      await db.execute('UPDATE comments SET resolved = ? WHERE id = ? AND user_id = ?', [resolved ? 1 : 0, resourceId, userId]);
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM comments WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── DAILY CHECKINS (Phase 2.5) ────────────────────────────────
  if (resource === 'daily-checkins') {
    if (req.method === 'GET') {
      const checkDate = date || new Date().toISOString().split('T')[0];
      const [rows] = await db.execute(
        'SELECT * FROM daily_checkins WHERE user_id = ? AND date = ?',
        [userId, checkDate]
      );
      return ok(res, { checkin: rows[0] || null });
    }
    if (req.method === 'POST') {
      const { date: checkDate, sleep_hours, energy_level, gut_symptoms, training_done, notes } = req.body || {};
      const checkinDate = checkDate || new Date().toISOString().split('T')[0];
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO daily_checkins (id, user_id, date, sleep_hours, energy_level, gut_symptoms, training_done, notes) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE sleep_hours = VALUES(sleep_hours), energy_level = VALUES(energy_level), 
         gut_symptoms = VALUES(gut_symptoms), training_done = VALUES(training_done), notes = VALUES(notes)`,
        [id, userId, checkinDate, sleep_hours, energy_level, gut_symptoms, training_done ? 1 : 0, notes]
      );
      return ok(res, { success: true, id }, 201);
    }
  }

  // ── TRAINING LOGS (Phase 2.6) ────────────────────────────────
  if (resource === 'training-logs') {
    if (req.method === 'GET') {
      const lookbackDays = parseInt(days || '7');
      const [rows] = await db.execute(
        'SELECT * FROM training_logs WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY date DESC',
        [userId, lookbackDays]
      );
      return ok(res, { logs: rows });
    }
    if (req.method === 'POST') {
      const { date: logDate, duration_minutes, type, notes, energy_after } = req.body || {};
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO training_logs (id, user_id, date, duration_minutes, type, notes, energy_after) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, logDate || new Date().toISOString().split('T')[0], duration_minutes, type || 'solo', notes || '', energy_after]
      );
      return ok(res, { success: true, id }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const { duration_minutes, type, notes, energy_after } = req.body || {};
      const fields = [], values = [];
      if (duration_minutes !== undefined) { fields.push('duration_minutes = ?'); values.push(duration_minutes); }
      if (type) { fields.push('type = ?'); values.push(type); }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
      if (energy_after !== undefined) { fields.push('energy_after = ?'); values.push(energy_after); }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE training_logs SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM training_logs WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── WEEKLY REVIEW (Phase 2.9) ─────────────────────────────────
  if (resource === 'weekly-review') {
    if (req.method === 'GET') {
      const weekStart = req.query.week;
      if (weekStart) {
        const [rows] = await db.execute('SELECT * FROM weekly_reviews WHERE user_id = ? AND week_start = ?', [userId, weekStart]);
        return ok(res, { review: rows[0] || null });
      } else {
        const listCount = parseInt(req.query.list || '8');
        const [rows] = await db.execute('SELECT * FROM weekly_reviews WHERE user_id = ? ORDER BY week_start DESC LIMIT ?', [userId, listCount]);
        return ok(res, { reviews: rows });
      }
    }
    if (req.method === 'POST') {
      const { week_start, data_json, what_shipped, what_blocked, next_priority, ai_analysis } = req.body || {};
      const id = crypto.randomUUID();
      await db.execute(
        `INSERT INTO weekly_reviews (id, user_id, week_start, data_json, what_shipped, what_blocked, next_priority, ai_analysis) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE data_json = VALUES(data_json), what_shipped = VALUES(what_shipped),
         what_blocked = VALUES(what_blocked), next_priority = VALUES(next_priority), ai_analysis = VALUES(ai_analysis)`,
        [id, userId, week_start, JSON.stringify(data_json || {}), what_shipped, what_blocked, next_priority, ai_analysis]
      );
      return ok(res, { success: true, id }, 201);
    }
  }

  return null; // Not handled
}
