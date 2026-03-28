// Handler for settings-related resources: settings, user-ai-settings, outreach-log, ai-metadata-suggestions
// Extracted from api/data.js

export default async function handleSettings(req, res, { db, userId, ok, err, safeJson }) {
  const { resource, id: resourceId, date, days } = req.query;

  // ── SETTINGS ──────────────────────────────────────────────
  if (resource === 'settings') {
    if (req.method === 'GET') {
      const [rows] = await db.execute('SELECT settings FROM users WHERE id = ?', [userId]);
      let parsed = {};
      try { parsed = JSON.parse(rows[0]?.settings || '{}'); } catch (_) {}
      return ok(res, { settings: parsed });
    }
    if (req.method === 'PUT') {
      const settingsJson = JSON.stringify(req.body || {});
      await db.execute('UPDATE users SET settings = ? WHERE id = ?', [settingsJson, userId]);
      return ok(res, { success: true });
    }
  }

  // ── USER AI SETTINGS ─────────────────────────────────────────
  if (resource === 'user-ai-settings') {
    if (req.method === 'GET') {
      const [rows] = await db.execute('SELECT ai_provider, ai_settings FROM users WHERE id = ?', [userId]);
      return ok(res, { 
        provider: rows[0]?.ai_provider || null,
        settings: safeJson(rows[0]?.ai_settings, {})
      });
    }
    if (req.method === 'PUT') {
      const { provider, settings: aiSettings } = req.body || {};
      await db.execute(
        'UPDATE users SET ai_provider = ?, ai_settings = ? WHERE id = ?',
        [provider, JSON.stringify(aiSettings || {}), userId]
      );
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE') {
      await db.execute('UPDATE users SET ai_provider = NULL, ai_settings = NULL WHERE id = ?', [userId]);
      return ok(res, { success: true });
    }
  }

  // ── OUTREACH LOG (Phase 2.7) ─────────────────────────────────
  if (resource === 'outreach-log') {
    if (req.method === 'GET') {
      if (date) {
        const [rows] = await db.execute('SELECT * FROM outreach_log WHERE user_id = ? AND date = ?', [userId, date]);
        return ok(res, { entries: rows });
      } else {
        const lookbackDays = parseInt(days || '7');
        const [rows] = await db.execute(
          'SELECT * FROM outreach_log WHERE user_id = ? AND date >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY date DESC',
          [userId, lookbackDays]
        );
        return ok(res, { entries: rows });
      }
    }
    if (req.method === 'POST') {
      const { date: entryDate, type, target, project_id: pid, notes } = req.body || {};
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO outreach_log (id, user_id, date, type, target, project_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, entryDate || new Date().toISOString().split('T')[0], type || 'message', target || null, pid || null, notes || '']
      );
      return ok(res, { success: true, id }, 201);
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM outreach_log WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── AI METADATA SUGGESTIONS (Phase 3.1) ───────────────────────
  if (resource === 'ai-metadata-suggestions') {
    if (req.method === 'POST') {
      const { project_id: pid, file_path: fp, content, project_name, project_phase } = req.body || {};
      if (!content) return err(res, 'content required');
      
      // In production, this would call the AI service
      // For now, return mock suggestions based on content analysis
      const suggestions = {
        category: content.includes('design') ? 'design' : content.includes('code') ? 'code' : 'documentation',
        suggested_tags: [],
        confidence: 0.75,
      };
      
      if (content.match(/\b(function|class|import|export|const|let|var)\b/)) {
        suggestions.category = 'code';
        suggestions.suggested_tags.push('javascript', 'development');
      } else if (content.match(/\b(mockup|wireframe|design|ui|ux|figma)\b/i)) {
        suggestions.category = 'design';
        suggestions.suggested_tags.push('design', 'ui');
      }
      
      return ok(res, { suggestions });
    }
  }

  return null; // Not handled
}
