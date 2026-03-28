// Handler for file-related resources: file-metadata, file-summaries, scripts
// Extracted from api/data.js

export default async function handleFiles(req, res, { db, userId, ok, err, safeJson }) {
  const { resource, id: resourceId, project_id, file_path } = req.query;

  // ── FILE METADATA (Roadmap 2.3) ───────────────────────────
  if (resource === 'file_metadata') {
    if (req.method === 'GET') {
      if (!project_id || !file_path) return err(res, 'project_id and file_path required');
      const [rows] = await db.execute(
        'SELECT * FROM file_metadata WHERE user_id = ? AND project_id = ? AND file_path = ?',
        [userId, project_id, file_path]
      );
      const metadata = rows.length > 0 ? { ...rows[0], metadata_json: safeJson(rows[0].metadata_json, {}) } : null;
      return ok(res, { metadata });
    }
    if (req.method === 'POST') {
      const { project_id: pid, file_path: fp, category, status, metadata_json } = req.body || {};
      if (!pid || !fp) return err(res, 'project_id and file_path required');
      await db.execute(
        'INSERT INTO file_metadata (project_id, user_id, file_path, category, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?)',
        [pid, userId, fp, category || null, status || 'draft', metadata_json ? JSON.stringify(metadata_json) : null]
      );
      return ok(res, { success: true }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const { category, status, metadata_json } = req.body || {};
      const fields = ['updated_at = NOW()'], values = [];
      if (category !== undefined) { fields.push('category = ?'); values.push(category); }
      if (status !== undefined) { fields.push('status = ?'); values.push(status); }
      if (metadata_json !== undefined) { fields.push('metadata_json = ?'); values.push(metadata_json ? JSON.stringify(metadata_json) : null); }
      if (fields.length > 1) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE file_metadata SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM file_metadata WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── FILE SUMMARIES (Phase 5.2) ───────────────────────────────
  if (resource === 'file-summaries') {
    if (req.method === 'GET') {
      if (project_id && file_path) {
        const [rows] = await db.execute(
          'SELECT * FROM file_summaries WHERE project_id = ? AND file_path = ? AND user_id = ?',
          [project_id, file_path, userId]
        );
        return ok(res, { summary: rows[0] || null });
      } else if (project_id) {
        const [rows] = await db.execute('SELECT * FROM file_summaries WHERE project_id = ? AND user_id = ?', [project_id, userId]);
        return ok(res, { summaries: rows });
      }
      return err(res, 'project_id required');
    }
    if (req.method === 'POST') {
      const { project_id: pid, file_path: fp, l0_abstract, l1_overview, content_hash, token_count } = req.body || {};
      if (!pid || !fp) return err(res, 'project_id and file_path required');
      await db.execute(
        `INSERT INTO file_summaries (id, project_id, user_id, file_path, l0_abstract, l1_overview, content_hash, token_count, generated_at) 
         VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE l0_abstract = VALUES(l0_abstract), l1_overview = VALUES(l1_overview), 
         content_hash = VALUES(content_hash), token_count = VALUES(token_count), generated_at = VALUES(generated_at)`,
        [pid, userId, fp, l0_abstract, l1_overview, content_hash, token_count]
      );
      return ok(res, { success: true }, 201);
    }
  }

  // ── SCRIPT EXECUTION (Phase 3.6) ──────────────────────────────
  if (resource === 'scripts') {
    if (req.method === 'POST') {
      const { script, language, project_id: pid, project_files } = req.body || {};
      if (!script || !language) return err(res, 'script and language required');
      
      // Sandboxed execution - only JavaScript supported for now
      if (language !== 'javascript') return err(res, 'Only javascript is supported');
      
      try {
        // Create a sandbox with limited globals
        const sandbox = {
          console: { log: (...args) => args.join(' ') },
          Math,
          Date,
          JSON,
          projectFiles: project_files || {},
          result: null,
        };
        
        // Simple sandbox execution (in production, use vm2 or similar)
        const fn = new Function('sandbox', `with(sandbox) { ${script} }`);
        const result = fn(sandbox);
        
        return ok(res, { success: true, result: result || sandbox.result, executed: true });
      } catch (e) {
        return ok(res, { success: false, error: e.message, executed: false });
      }
    }
  }

  return null; // Not handled
}
