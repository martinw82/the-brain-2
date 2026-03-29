// Handler for integration resources: integrations
// Merged from api/integrations.js into data.js handler pattern

// GitHub API helpers
async function githubFetch(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'TheBrain-App'
    }
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json();
}

export default async function handleIntegrations(req, res, { db, userId, ok, err }) {
  const { provider, project_id } = req.query;

  // GET — fetch integration status and repo data
  if (req.method === 'GET') {
    if (!project_id || !provider) {
      return err(res, 'project_id and provider required');
    }

    // Get integration from DB (verify project ownership)
    const [rows] = await db.query(
      `SELECT pi.* FROM project_integrations pi
       JOIN projects p ON pi.project_id = p.id
       WHERE pi.project_id = ? AND pi.provider = ? AND p.user_id = ?`,
      [project_id, provider, userId]
    );

    if (rows.length === 0) {
      return ok(res, { connected: false });
    }

    const integration = rows[0];

    // Fetch live data from GitHub
    try {
      const [repo, commits] = await Promise.all([
        githubFetch(`/repos/${integration.repo_owner}/${integration.repo_name}`, integration.access_token),
        githubFetch(`/repos/${integration.repo_owner}/${integration.repo_name}/commits?sha=${integration.branch}&per_page=5`, integration.access_token)
      ]);

      return ok(res, {
        connected: true,
        repo: {
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          default_branch: repo.default_branch,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          open_issues_count: repo.open_issues_count,
          updated_at: repo.updated_at
        },
        branch: integration.branch,
        last_sync_at: integration.last_sync_at,
        commits: commits.map(c => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.commit.author.name,
          date: c.commit.author.date,
          html_url: c.html_url
        }))
      });
    } catch (e) {
      // GitHub API failed (token expired, repo deleted, etc.)
      return ok(res, {
        connected: true,
        error: e.message,
        repo: null,
        last_sync_at: integration.last_sync_at
      });
    }
  }

  // POST — create/connect integration
  if (req.method === 'POST') {
    if (!provider) return err(res, 'provider required');

    const { repo_owner, repo_name, access_token, branch = 'main' } = req.body || {};

    if (!repo_owner || !repo_name || !access_token) {
      return err(res, 'repo_owner, repo_name, and access_token required');
    }

    // Validate GitHub credentials by fetching repo
    try {
      await githubFetch(`/repos/${repo_owner}/${repo_name}`, access_token);
    } catch (e) {
      return err(res, `GitHub connection failed: ${e.message}`);
    }

    // Verify project ownership
    if (project_id) {
      const [projCheck] = await db.query(
        'SELECT id FROM projects WHERE id = ? AND user_id = ?',
        [project_id, userId]
      );
      if (projCheck.length === 0) return err(res, 'Project not found or access denied', 403);
    }

    // Store integration (upsert)
    await db.query(
      `INSERT INTO project_integrations
       (project_id, provider, repo_owner, repo_name, branch, access_token, sync_enabled, last_sync_at)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
       ON DUPLICATE KEY UPDATE
       repo_owner = VALUES(repo_owner),
       repo_name = VALUES(repo_name),
       branch = VALUES(branch),
       access_token = VALUES(access_token),
       sync_enabled = TRUE,
       last_sync_at = NOW()`,
      [project_id, provider, repo_owner, repo_name, branch, access_token]
    );

    return ok(res, { connected: true });
  }

  // PUT — update sync settings
  if (req.method === 'PUT') {
    if (!project_id || !provider) {
      return err(res, 'project_id and provider required');
    }

    const { sync_enabled, branch } = req.body || {};

    await db.query(
      `UPDATE project_integrations pi
       JOIN projects p ON pi.project_id = p.id
       SET pi.sync_enabled = COALESCE(?, pi.sync_enabled),
           pi.branch = COALESCE(?, pi.branch),
           pi.updated_at = NOW()
       WHERE pi.project_id = ? AND pi.provider = ? AND p.user_id = ?`,
      [sync_enabled, branch, project_id, provider, userId]
    );

    return ok(res, { success: true });
  }

  // DELETE — disconnect integration
  if (req.method === 'DELETE') {
    if (!project_id || !provider) {
      return err(res, 'project_id and provider required');
    }

    await db.query(
      `DELETE pi FROM project_integrations pi
       JOIN projects p ON pi.project_id = p.id
       WHERE pi.project_id = ? AND pi.provider = ? AND p.user_id = ?`,
      [project_id, provider, userId]
    );

    return ok(res, { disconnected: true });
  }

  return err(res, 'Method not allowed', 405);
}
