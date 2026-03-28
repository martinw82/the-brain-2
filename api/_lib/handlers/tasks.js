// Handler for task-related resources: tasks, auto-tasks, create-from-proposed
// Extracted from api/data.js

export default async function handleTasks(req, res, { db, userId, ok, err, safeJson }) {
  const { resource, id: resourceId, action } = req.query;

  // ── TASKS (Phase 5.4) ─────────────────────────────────────────
  if (resource === 'tasks') {
    if (req.method === 'GET') {
      const { my_tasks, status: taskStatus, assignee_type, project_id: pid } = req.query;
      let query = 'SELECT * FROM tasks WHERE user_id = ?';
      const params = [userId];
      if (my_tasks) {
        query += ' AND assignee_type = ? AND assignee_id = ?';
        params.push('human', 'user');
      }
      if (taskStatus) { query += ' AND status = ?'; params.push(taskStatus); }
      if (assignee_type) { query += ' AND assignee_type = ?'; params.push(assignee_type); }
      if (pid) { query += ' AND project_id = ?'; params.push(pid); }
      query += ' ORDER BY created_at DESC';
      const [rows] = await db.execute(query, params);
      return ok(res, { tasks: rows });
    }
    if (req.method === 'POST') {
      const { id, project_id: pid, title, description, priority, assignee_type, assignee_id, due_date, workflow_instance_id, workflow_step_id, assigned_by, assignment_reason } = req.body || {};
      if (!title) return err(res, 'title required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        `INSERT INTO tasks (id, user_id, project_id, title, description, priority, assignee_type, assignee_id, due_date, workflow_instance_id, workflow_step_id, assigned_by, assignment_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, pid || null, title, description || '', priority || 'medium', assignee_type || 'human', assignee_id || 'user', due_date || null, workflow_instance_id || null, workflow_step_id || null, assigned_by || 'user', assignment_reason || '']
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      if (action === 'start') {
        await db.execute('UPDATE tasks SET status = ?, started_at = NOW() WHERE id = ? AND user_id = ?', ['in_progress', resourceId, userId]);
        return ok(res, { success: true });
      }
      if (action === 'complete') {
        const { result_summary, output_uris } = req.body || {};
        await db.execute(
          'UPDATE tasks SET status = ?, completed_at = NOW(), result_summary = ?, output_uris = ? WHERE id = ? AND user_id = ?',
          ['complete', result_summary || '', JSON.stringify(output_uris || []), resourceId, userId]
        );
        return ok(res, { success: true });
      }
      if (action === 'block') {
        const { reason } = req.body || {};
        await db.execute('UPDATE tasks SET status = ?, assignment_reason = ? WHERE id = ? AND user_id = ?', ['blocked', reason || '', resourceId, userId]);
        return ok(res, { success: true });
      }
      if (action === 'assign') {
        const { assignee_type: at, assignee_id: aid, reason } = req.body || {};
        await db.execute(
          'UPDATE tasks SET assignee_type = ?, assignee_id = ?, assignment_reason = ? WHERE id = ? AND user_id = ?',
          [at, aid, reason || '', resourceId, userId]
        );
        return ok(res, { success: true });
      }
      // Regular update
      const updates = req.body || {};
      const allowed = ['title', 'description', 'status', 'priority', 'due_date'];
      const fields = [], values = [];
      for (const key of allowed) {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updates[key]);
        }
      }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM tasks WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── AUTO TASKS (Phase 7.3) ───────────────────────────────────
  if (resource === 'auto-tasks') {
    if (req.method === 'GET') {
      // Scan DEVLOG/TODO files for tasks
      const [files] = await db.execute(
        `SELECT pf.project_id, pf.path, pf.content FROM project_files pf
         JOIN projects p ON p.id = pf.project_id
         WHERE p.user_id = ? AND pf.path LIKE '%DEVLOG%' AND pf.deleted_at IS NULL`,
        [userId]
      );
      const proposed = [];
      for (const file of files) {
        const todoMatches = file.content.match(/TODO[:\s]+(.+)/gi) || [];
        for (const match of todoMatches) {
          proposed.push({
            id: `proposed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: match.replace(/TODO[:\s]+/i, '').trim(),
            source_file: file.path,
            project_id: file.project_id,
            confidence: 0.7,
          });
        }
      }
      return ok(res, { proposed: proposed.slice(0, 10) });
    }
  }

  // ── CREATE FROM PROPOSED ─────────────────────────────────────
  if (resource === 'create-from-proposed') {
    if (req.method === 'POST') {
      const { title, project_id, source_file } = req.body || {};
      if (!title) return err(res, 'title required');
      const newId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO tasks (id, user_id, project_id, title, description, assigned_by, assignment_reason) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newId, userId, project_id || null, title, `Extracted from ${source_file || 'DEVLOG'}`, 'ai', 'Auto-extracted from DEVLOG']
      );
      return ok(res, { success: true, id: newId }, 201);
    }
  }

  return null; // Not handled
}
