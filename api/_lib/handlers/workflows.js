// api/_lib/handlers/workflows.js — Workflow templates and instances handler

export default async function handleWorkflows(req, res, { db, userId, ok, err, safeJson }) {
  const { resource, id, instance_id, action } = req.query;

  // ═══════════════════════════════════════════════════════════════
  // WORKFLOW TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  
  if (resource === 'workflows') {
    // GET /api/data?resource=workflows — list templates
    if (req.method === 'GET') {
      const [templates] = await db.execute(
        `SELECT id, name, description, icon, steps, triggers, is_system, created_at
         FROM workflow_templates
         WHERE user_id = ? OR is_system = 1
         ORDER BY is_system DESC, name ASC`,
        [userId]
      );
      
      return ok(res, {
        templates: templates.map(t => ({
          ...t,
          steps: safeJson(t.steps, []),
          triggers: safeJson(t.triggers, ['manual'])
        }))
      });
    }

    // POST /api/data?resource=workflows — create template
    if (req.method === 'POST') {
      const { id: wfId, name, description, icon, steps, triggers, is_system } = req.body;
      
      await db.execute(
        `INSERT INTO workflow_templates 
         (id, user_id, name, description, icon, steps, triggers, is_system, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         icon = VALUES(icon),
         steps = VALUES(steps),
         triggers = VALUES(triggers)`,
        [
          wfId,
          userId,
          name,
          description || '',
          icon || '📋',
          JSON.stringify(steps || []),
          JSON.stringify(triggers || ['manual']),
          is_system ? 1 : 0
        ]
      );
      
      return ok(res, { success: true, id: wfId });
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // WORKFLOW INSTANCES
  // ═══════════════════════════════════════════════════════════════

  if (resource === 'workflow-instances') {
    // GET /api/data?resource=workflow-instances — list instances
    if (req.method === 'GET') {
      if (instance_id) {
        // Get specific instance
        const [instances] = await db.execute(
          `SELECT wi.*, wt.name as template_name, wt.icon as template_icon, wt.steps as template_steps
           FROM workflow_instances wi
           JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
           WHERE wi.id = ? AND wi.user_id = ?`,
          [instance_id, userId]
        );
        
        if (instances.length === 0) {
          return err(res, 'Instance not found', 404);
        }
        
        return ok(res, {
          instance: {
            ...instances[0],
            template_steps: safeJson(instances[0].template_steps, []),
            step_results: safeJson(instances[0].step_results, {}),
            execution_log: instances[0].execution_log || ''
          }
        });
      }
      
      // List instances
      let query = `SELECT wi.*, wt.name as template_name, wt.icon as template_icon
                   FROM workflow_instances wi
                   JOIN workflow_templates wt ON wi.workflow_template_id = wt.id
                   WHERE wi.user_id = ?`;
      const params = [userId];
      
      if (req.query.project_id) {
        query += ' AND wi.project_id = ?';
        params.push(req.query.project_id);
      }
      
      if (req.query.status) {
        query += ' AND wi.status = ?';
        params.push(req.query.status);
      }
      
      query += ' ORDER BY wi.created_at DESC';
      
      const [instances] = await db.execute(query, params);
      
      return ok(res, {
        instances: instances.map(i => ({
          ...i,
          step_results: safeJson(i.step_results, {})
        }))
      });
    }

    // POST /api/data?resource=workflow-instances — start instance
    if (req.method === 'POST') {
      const { template_id, project_id } = req.body;
      
      if (!template_id || !project_id) {
        return err(res, 'template_id and project_id required');
      }
      
      // Get template
      const [templates] = await db.execute(
        'SELECT * FROM workflow_templates WHERE id = ?',
        [template_id]
      );
      
      if (templates.length === 0) {
        return err(res, 'Template not found', 404);
      }
      
      const template = templates[0];
      const instanceId = `wi-${Date.now()}`;
      
      await db.execute(
        `INSERT INTO workflow_instances
         (id, user_id, project_id, workflow_template_id, status, current_step_index, 
          step_results, execution_log, created_at)
         VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, NOW())`,
        [
          instanceId,
          userId,
          project_id,
          template_id,
          JSON.stringify({}),
          `Started at ${new Date().toISOString()}\n`
        ]
      );
      
      return ok(res, {
        success: true,
        instance: {
          id: instanceId,
          template_id,
          project_id,
          status: 'pending'
        }
      });
    }

    // PUT /api/data?resource=workflow-instances&id=xxx — update instance
    if (req.method === 'PUT' && id) {
      const { action: updateAction, step_result } = req.body;
      
      // Get current instance
      const [instances] = await db.execute(
        'SELECT * FROM workflow_instances WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      
      if (instances.length === 0) {
        return err(res, 'Instance not found', 404);
      }
      
      const instance = instances[0];
      
      if (updateAction === 'complete-step') {
        const stepResults = safeJson(instance.step_results, {});
        stepResults[`step_${step_result.step_id}`] = step_result;
        
        const newStepIndex = (instance.current_step_index || 0) + 1;
        
        await db.execute(
          `UPDATE workflow_instances
           SET current_step_index = ?,
               step_results = ?,
               execution_log = CONCAT(execution_log, ?),
               updated_at = NOW()
           WHERE id = ?`,
          [
            newStepIndex,
            JSON.stringify(stepResults),
            `Step ${step_result.step_id}: ${step_result.status}\n`,
            id
          ]
        );
        
        return ok(res, { success: true });
      }
      
      if (updateAction === 'pause') {
        await db.execute(
          "UPDATE workflow_instances SET status = 'paused', updated_at = NOW() WHERE id = ?",
          [id]
        );
        return ok(res, { success: true });
      }
      
      if (updateAction === 'resume') {
        await db.execute(
          "UPDATE workflow_instances SET status = 'running', updated_at = NOW() WHERE id = ?",
          [id]
        );
        return ok(res, { success: true });
      }
      
      if (updateAction === 'abort') {
        await db.execute(
          "UPDATE workflow_instances SET status = 'aborted', updated_at = NOW() WHERE id = ?",
          [id]
        );
        return ok(res, { success: true });
      }
      
      return err(res, 'Unknown action');
    }

    // DELETE /api/data?resource=workflow-instances&id=xxx
    if (req.method === 'DELETE' && id) {
      await db.execute(
        'DELETE FROM workflow_instances WHERE id = ? AND user_id = ?',
        [id, userId]
      );
      return ok(res, { success: true });
    }
  }

  return err(res, 'Unknown workflow resource');
}
