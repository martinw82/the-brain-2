// Handler for staging and ideas resources
// Extracted from api/data.js

export default async function handleStaging(req, res, { db, userId, ok, err, safeJson }) {
  const { resource, id: resourceId, project_id } = req.query;

  // ── STAGING ──────────────────────────────────────────────
  if (resource === 'staging') {
    if (req.method === 'GET') {
      const [rows] = project_id
        ? await db.execute(
            'SELECT * FROM staging WHERE user_id = ? AND project_id = ? ORDER BY created_at DESC',
            [userId, project_id]
          )
        : await db.execute(
            'SELECT * FROM staging WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
          );
      return ok(res, { staging: rows });
    }
    if (req.method === 'POST') {
      const {
        id,
        project_id: pid,
        name,
        tag,
        status,
        notes,
        added,
      } = req.body || {};
      if (!name || !pid) return err(res, 'name and project_id required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        'INSERT INTO staging (id, user_id, project_id, name, tag, status, notes, added) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newId,
          userId,
          pid,
          name,
          tag || 'IDEA_',
          status || 'in-review',
          notes || '',
          added || new Date().toISOString().slice(0, 7),
        ]
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const { action } = req.query;
      const { status, notes, folder_id, filename } = req.body || {};

      if (action === 'moveToFolder' && folder_id && filename) {
        try {
          const [stagingRows] = await db.execute(
            'SELECT * FROM staging WHERE id = ? AND user_id = ?',
            [resourceId, userId]
          );
          if (!stagingRows.length)
            return err(res, 'Staging item not found', 404);
          const stagingItem = stagingRows[0];

          const [existingFiles] = await db.execute(
            'SELECT * FROM project_files WHERE project_id = ? AND path = ?',
            [stagingItem.project_id, `${folder_id}/${filename}`]
          );

          let finalPath = `${folder_id}/${filename}`;
          if (existingFiles.length > 0) {
            const ext = filename.split('.').pop();
            const base = filename.replace(new RegExp(`\\.${ext}$`), '');
            const timestamp = new Date()
              .toISOString()
              .replace(/[:-]/g, '')
              .slice(0, 15);
            finalPath = `${folder_id}/${base}_${timestamp}.${ext}`;
          }

          const [stagingFileRows] = await db.execute(
            'SELECT * FROM project_files WHERE project_id = ? AND path = ?',
            [stagingItem.project_id, `staging/${stagingItem.name}`]
          );

          if (stagingFileRows.length > 0) {
            const stagingFile = stagingFileRows[0];
            await db.execute(
              'INSERT INTO project_files (project_id, user_id, path, content) VALUES (?, ?, ?, ?)',
              [
                stagingItem.project_id,
                userId,
                finalPath,
                stagingFile.content,
              ]
            );
            await db.execute(
              'DELETE FROM project_files WHERE project_id = ? AND path = ?',
              [stagingItem.project_id, `staging/${stagingItem.name}`]
            );
          }

          const filedAt = new Date().toISOString();
          await db.execute(
            'UPDATE staging SET folder_path = ?, filed_at = ? WHERE id = ? AND user_id = ?',
            [finalPath, filedAt, resourceId, userId]
          );

          return ok(res, {
            success: true,
            folder_path: finalPath,
            filed_at: filedAt,
          });
        } catch (e) {
          console.error('moveToFolder error:', e);
          return err(res, 'Failed to move file to folder');
        }
      }

      const fields = [],
        values = [];
      if (status !== undefined) {
        fields.push('status = ?');
        values.push(status);
      }
      if (notes !== undefined) {
        fields.push('notes = ?');
        values.push(notes);
      }
      if (fields.length) {
        values.push(resourceId, userId);
        await db.execute(
          `UPDATE staging SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
          values
        );
      }
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM staging WHERE id = ? AND user_id = ?', [
        resourceId,
        userId,
      ]);
      return ok(res, { success: true });
    }
  }

  // ── IDEAS ─────────────────────────────────────────────────
  if (resource === 'ideas') {
    if (req.method === 'GET') {
      const [rows] = await db.execute(
        'SELECT * FROM ideas WHERE user_id = ? ORDER BY score DESC, created_at DESC',
        [userId]
      );
      return ok(res, {
        ideas: rows.map((r) => ({ ...r, tags: safeJson(r.tags, []) })),
      });
    }
    if (req.method === 'POST') {
      const { id, title, score, tags, added } = req.body || {};
      if (!title) return err(res, 'title required');
      const newId = id || crypto.randomUUID();
      await db.execute(
        'INSERT INTO ideas (id, user_id, title, score, tags, added) VALUES (?, ?, ?, ?, ?, ?)',
        [
          newId,
          userId,
          title,
          score || 5,
          JSON.stringify(tags || []),
          added || new Date().toISOString().slice(0, 7),
        ]
      );
      return ok(res, { success: true, id: newId }, 201);
    }
    if (req.method === 'PUT' && resourceId) {
      const { score, tags } = req.body || {};
      await db.execute(
        'UPDATE ideas SET score = ?, tags = ? WHERE id = ? AND user_id = ?',
        [score, JSON.stringify(tags || []), resourceId, userId]
      );
      return ok(res, { success: true });
    }
    if (req.method === 'DELETE' && resourceId) {
      await db.execute('DELETE FROM ideas WHERE id = ? AND user_id = ?', [
        resourceId,
        userId,
      ]);
      return ok(res, { success: true });
    }
  }

  return null; // Not handled
}
