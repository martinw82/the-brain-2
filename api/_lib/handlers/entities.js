// Handler for entity resources: areas, goals, templates, contributions, tags, entity-tags, links, search
// Extracted from api/data.js

export default async function handleEntities(req, res, { db, userId, ok, err, safeJson, addPagination, formatPaginatedResponse }) {
  const { resource, id: resourceId, q, project_id, goal_id } = req.query;

  // ── AREAS ─────────────────────────────────────────────────
  if (resource === 'areas') {
    if (req.method === 'GET') {
      try {
        const [rows] = await db.execute(
          'SELECT * FROM life_areas WHERE user_id = ? ORDER BY sort_order ASC',
          [userId]
        );
        return ok(res, { areas: rows });
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) {
          return ok(res, { areas: [] });
        }
        throw e;
      }
    }
    if (req.method === 'POST') {
      const { id, name, color, icon, description, target_hours_weekly } = req.body || {};
      if (!name) return err(res, 'name required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        'INSERT INTO life_areas (id, user_id, name, color, icon, description, target_hours_weekly) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [newId, userId, name, color || '#3b82f6', icon || '🌐', description || '', target_hours_weekly || null]
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const data = req.body || {};
      const fields = [], values = [];
      const map = { name: 'name', color: 'color', icon: 'icon', description: 'description', target_hours_weekly: 'target_hours_weekly', health_score: 'health_score', sort_order: 'sort_order' };
      for (const [k, col] of Object.entries(map)) {
        if (data[k] !== undefined) {
          fields.push(`${col} = ?`);
          values.push(data[k]);
        }
      }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE life_areas SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM life_areas WHERE id = ? AND user_id = ?', [resourceId, userId]);
      await db.execute('UPDATE projects SET life_area_id = NULL WHERE life_area_id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── GOALS ─────────────────────────────────────────────────
  if (resource === 'goals') {
    if (req.method === 'GET') {
      try {
        const [rows] = await db.execute('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return ok(res, { goals: rows });
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) {
          return ok(res, { goals: [] });
        }
        throw e;
      }
    }
    if (req.method === 'POST') {
      const { id, title, target_amount, current_amount, currency, timeframe, category, status } = req.body || {};
      if (!title || target_amount === undefined) return err(res, 'title and target_amount required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        'INSERT INTO goals (id, user_id, title, target_amount, current_amount, currency, timeframe, category, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [newId, userId, title, target_amount, current_amount || 0, currency || 'GBP', timeframe || 'monthly', category || 'income', status || 'active']
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const data = req.body || {};
      const fields = [], values = [];
      const map = { title: 'title', target_amount: 'target_amount', current_amount: 'current_amount', currency: 'currency', timeframe: 'timeframe', category: 'category', status: 'status' };
      for (const [k, col] of Object.entries(map)) {
        if (data[k] !== undefined) {
          fields.push(`${col} = ?`);
          values.push(data[k]);
        }
      }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE goals SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM goals WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── TEMPLATES ───────────────────────────────────────────────
  if (resource === 'templates') {
    if (req.method === 'GET') {
      try {
        const [rows] = await db.execute(
          'SELECT * FROM templates WHERE user_id IS NULL OR user_id = ? ORDER BY is_system DESC, name ASC',
          [userId]
        );
        return ok(res, { templates: rows.map((r) => ({ ...r, config: safeJson(r.config, {}) })) });
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) {
          return ok(res, { templates: [] });
        }
        throw e;
      }
    }
    if (req.method === 'POST') {
      const { id, name, description, icon, category, config, is_system } = req.body || {};
      if (!name || !config) return err(res, 'name and config required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        'INSERT INTO templates (id, user_id, name, description, icon, category, config, is_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [newId, userId, name, description || '', icon || '📄', category || 'custom', JSON.stringify(config), is_system ? 1 : 0]
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const data = req.body || {};
      const fields = [], values = [];
      const map = { name: 'name', description: 'description', icon: 'icon', category: 'category', config: 'config', is_system: 'is_system' };
      for (const [k, col] of Object.entries(map)) {
        if (data[k] !== undefined) {
          fields.push(`${col} = ?`);
          values.push(k === 'config' ? JSON.stringify(data[k]) : data[k]);
        }
      }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(`UPDATE templates SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM templates WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── GOAL CONTRIBUTIONS ──────────────────────────────────────
  if (resource === 'contributions') {
    if (req.method === 'GET') {
      if (!goal_id) return err(res, 'goal_id required');
      try {
        const [rows] = await db.execute(
          'SELECT * FROM goal_contributions WHERE user_id = ? AND goal_id = ? ORDER BY date DESC',
          [userId, goal_id]
        );
        return ok(res, { contributions: rows });
      } catch (e) {
        if (e.message.includes('Table') && e.message.includes("doesn't exist")) {
          return ok(res, { contributions: [] });
        }
        throw e;
      }
    }
    if (req.method === 'POST') {
      const { goal_id: gid, project_id, source_label, amount, date, notes } = req.body || {};
      if (!gid || amount === undefined) return err(res, 'goal_id and amount required');
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO goal_contributions (id, goal_id, user_id, project_id, source_label, amount, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, gid, userId, project_id || null, source_label || '', amount, date || new Date().toISOString().slice(0, 10), notes || '']
      );
      await db.execute(
        'UPDATE goals SET current_amount = current_amount + ? WHERE id = ? AND user_id = ?',
        [amount, gid, userId]
      );
      return ok(res, { success: true, id }, 201);
    }
    if (req.method === 'DELETE' && resourceId) {
      const [rows] = await db.execute('SELECT goal_id, amount FROM goal_contributions WHERE id = ? AND user_id = ?', [resourceId, userId]);
      if (rows.length) {
        const { goal_id: gid, amount } = rows[0];
        await db.execute('DELETE FROM goal_contributions WHERE id = ? AND user_id = ?', [resourceId, userId]);
        await db.execute('UPDATE goals SET current_amount = current_amount - ? WHERE id = ? AND user_id = ?', [amount, gid, userId]);
      }
      return ok(res, { success: true });
    }
  }

  // ── TAGS ──────────────────────────────────────────────────
  if (resource === 'tags') {
    try {
      if (req.method === 'GET') {
        const [rows] = await db.execute('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC', [userId]);
        return ok(res, { tags: rows });
      }
      if (req.method === 'POST') {
        const { name, color, category } = req.body || {};
        if (!name?.trim()) return err(res, 'name required');
        const [existing] = await db.execute('SELECT * FROM tags WHERE user_id = ? AND name = ?', [userId, name.trim()]);
        if (existing.length) return ok(res, { success: true, id: existing[0].id, tag: existing[0] }, 200);
        const id = crypto.randomUUID();
        await db.execute(
          'INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)',
          [id, userId, name.trim(), color || '#3b82f6', category || 'custom']
        );
        return ok(res, { success: true, id, tag: { id, user_id: userId, name: name.trim(), color: color || '#3b82f6', category: category || 'custom' } }, 201);
      }
      if (req.method === 'PUT' && resourceId) {
        const { name, color, category } = req.body || {};
        const fields = [], values = [];
        if (name) { fields.push('name = ?'); values.push(name.trim()); }
        if (color) { fields.push('color = ?'); values.push(color); }
        if (category) { fields.push('category = ?'); values.push(category); }
        if (fields.length) {
          values.push(resourceId, userId);
          await db.execute(`UPDATE tags SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, values);
        }
        return ok(res, { success: true });
      }
      if (req.method === 'DELETE' && resourceId) {
        await db.execute('DELETE FROM entity_tags WHERE tag_id = ? AND user_id = ?', [resourceId, userId]);
        await db.execute('DELETE FROM tags WHERE id = ? AND user_id = ?', [resourceId, userId]);
        return ok(res, { success: true });
      }
    } catch (e) {
      if (e.message.includes('Table') && e.message.includes("doesn't exist")) return ok(res, { tags: [] });
      throw e;
    }
  }

  // ── ENTITY TAGS ───────────────────────────────────────────
  if (resource === 'entity-tags') {
    try {
      if (req.method === 'GET') {
        const [rows] = await db.execute(
          `SELECT et.id, et.tag_id, et.entity_type, et.entity_id, et.created_at, t.name, t.color, t.category
           FROM entity_tags et JOIN tags t ON t.id = et.tag_id WHERE et.user_id = ? ORDER BY et.entity_type, et.entity_id, t.name`,
          [userId]
        );
        return ok(res, { entity_tags: rows });
      }
      if (req.method === 'POST') {
        const { tag_id, tag_name, tag_color, entity_type, entity_id } = req.body || {};
        if (!entity_type || !entity_id) return err(res, 'entity_type and entity_id required');
        let tid = tag_id;
        if (!tid && tag_name) {
          const [existing] = await db.execute('SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, tag_name.trim()]);
          if (existing.length) {
            tid = existing[0].id;
          } else {
            tid = crypto.randomUUID();
            await db.execute('INSERT INTO tags (id, user_id, name, color, category) VALUES (?, ?, ?, ?, ?)', [tid, userId, tag_name.trim(), tag_color || '#3b82f6', 'custom']);
          }
        }
        if (!tid) return err(res, 'tag_id or tag_name required');
        const id = crypto.randomUUID();
        await db.execute('INSERT IGNORE INTO entity_tags (id, tag_id, user_id, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)', [id, tid, userId, entity_type, entity_id]);
        const [tagRows] = await db.execute('SELECT name, color FROM tags WHERE id = ?', [tid]);
        const tag = tagRows[0] || {};
        return ok(res, { id, tag_id: tid, name: tag.name || tag_name, color: tag.color || tag_color || '#3b82f6', entity_type, entity_id, user_id: userId }, 201);
      }
      if (req.method === 'DELETE') {
        const { tag_id: tid, entity_type, entity_id } = req.query;
        if (!tid || !entity_type || !entity_id) return err(res, 'tag_id, entity_type, and entity_id required');
        await db.execute('DELETE FROM entity_tags WHERE tag_id = ? AND user_id = ? AND entity_type = ? AND entity_id = ?', [tid, userId, entity_type, entity_id]);
        return ok(res, { success: true });
      }
    } catch (e) {
      if (e.message.includes('Table') && e.message.includes("doesn't exist")) return ok(res, { entity_tags: [] });
      throw e;
    }
  }

  // ── LINKS ─────────────────────────────────────────────────────
  if (resource === 'links') {
    if (req.method === 'GET') {
      const { entity_type, entity_id } = req.query;
      if (!entity_type || !entity_id) return err(res, 'entity_type and entity_id required');
      const [rows] = await db.execute(
        'SELECT * FROM entity_links WHERE user_id = ? AND source_type = ? AND source_id = ? ORDER BY created_at DESC',
        [userId, entity_type, entity_id]
      );
      return ok(res, { links: rows });
    }
    if (req.method === 'POST') {
      const { source_type, source_id, target_type, target_id, relationship } = req.body || {};
      if (!source_type || !source_id || !target_type || !target_id) return err(res, 'source and target required');
      const id = crypto.randomUUID();
      await db.execute(
        'INSERT INTO entity_links (id, user_id, source_type, source_id, target_type, target_id, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, userId, source_type, source_id, target_type, target_id, relationship || 'related']
      );
      return ok(res, { success: true, id }, 201);
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM entity_links WHERE id = ? AND user_id = ?', [resourceId, userId]);
      return ok(res, { success: true });
    }
  }

  // ── SEARCH ────────────────────────────────────────────────────
  if (resource === 'search') {
    if (req.method === 'GET') {
      if (!q) return err(res, 'q parameter required');
      const searchTerm = `%${q}%`;
      let query = `
        SELECT DISTINCT p.id as project_id, p.name as project_name, p.emoji, pf.path, 
               SUBSTRING(pf.content, 1, 200) as excerpt
        FROM project_files pf
        JOIN projects p ON p.id = pf.project_id
        WHERE pf.user_id = ? AND pf.deleted_at IS NULL
        AND (pf.path LIKE ? OR pf.content LIKE ?)
      `;
      const params = [userId, searchTerm, searchTerm];
      if (project_id) {
        query += ' AND p.id = ?';
        params.push(project_id);
      }
      query += ' LIMIT 50';
      const [rows] = await db.execute(query, params);
      return ok(res, { results: rows });
    }
  }

  return null; // Not handled
}
