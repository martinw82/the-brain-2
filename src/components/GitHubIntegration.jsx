import { useState, useEffect } from 'react';
import { C, S } from '../utils/constants.js';
import { integrations as integrationsApi } from '../api.js';
import { Modal } from './UI/SmallComponents.jsx';

// ═══════════════════════════════════════════════════════════
// GITHUB INTEGRATION COMPONENT (Phase 4.3)
// ═══════════════════════════════════════════════════════════
const GitHubIntegration = ({ projects, isMobile }) => {
  const [selectedProject, setSelectedProject] = useState(
    projects[0]?.id || null
  );
  const [githubData, setGithubData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [form, setForm] = useState({
    owner: '',
    repo: '',
    token: '',
    branch: 'main',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const selectedProjectData = projects.find((p) => p.id === selectedProject);

  // Load GitHub data when project changes
  useEffect(() => {
    if (!selectedProject) return;
    loadGithubData();
  }, [selectedProject]);

  const loadGithubData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await integrationsApi.get(selectedProject, 'github');
      setGithubData(data);
      if (data.connected && data.repo) {
        setForm({
          owner: data.repo.full_name.split('/')[0],
          repo: data.repo.name,
          branch: data.branch || 'main',
          token: '',
        });
      }
    } catch (e) {
      setError('Failed to load GitHub connection');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!form.owner || !form.repo || !form.token) {
      setError('Please fill in all fields');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await integrationsApi.connect(selectedProject, 'github', {
        repo_owner: form.owner,
        repo_name: form.repo,
        access_token: form.token,
        branch: form.branch || 'main',
      });
      setShowConnect(false);
      await loadGithubData();
    } catch (e) {
      setError(e.message || 'Failed to connect to GitHub');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !confirm(
        'Disconnect GitHub? Your files will remain in The Brain, but sync will stop.'
      )
    )
      return;
    try {
      await integrationsApi.disconnect(selectedProject, 'github');
      setGithubData(null);
      setForm({ owner: '', repo: '', token: '', branch: 'main' });
    } catch (e) {
      setError('Failed to disconnect');
    }
  };

  return (
    <div>
      {/* Header with project selector */}
      <div style={{ marginBottom: 16 }}>
        <span style={S.label()}>Project</span>
        <select
          style={S.sel}
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Help Box */}
      <div
        style={{
          background: `${C.blue}08`,
          border: `1px solid ${C.blue}30`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 600, color: C.blue }}>
            💡 What is GitHub Integration?
          </span>
          <button
            style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 8px' }}
            onClick={() => setShowHelp(!showHelp)}
          >
            {showHelp ? 'Hide' : 'Learn more'}
          </button>
        </div>
        {showHelp && (
          <div style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Connect your Brain project to a <strong>GitHub repository</strong>{' '}
              for backup and version control.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>Sync your project files (markdown, specs, docs) to GitHub</li>
              <li>Track changes with Git history</li>
              <li>Share with collaborators</li>
              <li>Automatic backup</li>
            </ul>
            <p style={{ margin: '8px 0 0', color: C.muted }}>
              💡 <strong>Note:</strong> This syncs your <em>planning files</em>{' '}
              (PROJECT_OVERVIEW.md, specs, etc.). Your actual code repos are
              separate\u2014link to them in your project overview.
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 14, color: C.dim }}>\u27F3 Loading...</div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          style={{
            background: `${C.red}10`,
            border: `1px solid ${C.red}40`,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 10, color: C.red }}>\u26A0 {error}</div>
        </div>
      )}

      {/* Not connected state */}
      {!loading && !githubData?.connected && (
        <div style={S.card(false)}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🐙</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: '#f1f5f9',
                marginBottom: 8,
              }}
            >
              GitHub Not Connected
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 16 }}>
              Connect this project to a GitHub repository to enable sync.
            </div>
            <button
              style={S.btn('primary')}
              onClick={() => setShowConnect(true)}
            >
              Connect GitHub
            </button>
          </div>
        </div>
      )}

      {/* Connected state */}
      {!loading && githubData?.connected && githubData?.repo && (
        <div>
          {/* Repo Card */}
          <div style={S.card(true)}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 32 }}>🐙</span>
                <div>
                  <div
                    style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}
                  >
                    {githubData.repo.name}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>
                    {githubData.repo.full_name}
                  </div>
                  {githubData.repo.description && (
                    <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
                      {githubData.repo.description}
                    </div>
                  )}
                </div>
              </div>
              <span style={S.badge(C.green)}>\u25CF LIVE</span>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.stargazers_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Stars
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.forks_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Forks
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>
                  {githubData.repo.open_issues_count}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    textTransform: 'uppercase',
                  }}
                >
                  Issues
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.btn('ghost')}
                onClick={() => window.open(githubData.repo.html_url, '_blank')}
              >
                🌐 Open Repo
              </button>
              <button
                style={{ ...S.btn('ghost'), borderColor: C.red, color: C.red }}
                onClick={handleDisconnect}
              >
                Disconnect
              </button>
            </div>
          </div>

          {/* Recent Commits */}
          <div style={S.card(false)}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <span style={S.label()}>
                Recent Commits ({githubData.branch})
              </span>
              <span style={{ fontSize: 9, color: C.dim }}>
                Last sync:{' '}
                {githubData.last_sync_at
                  ? new Date(githubData.last_sync_at).toLocaleString()
                  : 'Never'}
              </span>
            </div>

            {githubData.commits?.length === 0 ? (
              <div style={{ fontSize: 10, color: C.dim }}>No commits found</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {githubData.commits?.map((commit, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      padding: '8px',
                      background: C.bg,
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.blue,
                        minWidth: 50,
                      }}
                    >
                      {commit.sha}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: C.text }}>
                        {commit.message}
                      </div>
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 2 }}>
                        {commit.author} \u2022{' '}
                        {new Date(commit.date).toLocaleDateString()}
                      </div>
                    </div>
                    <a
                      href={commit.html_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 9, color: C.blue }}
                    >
                      View \u2192
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connection Error State (token expired, repo deleted, etc.) */}
      {!loading && githubData?.connected && !githubData?.repo && (
        <div style={S.card(false)}>
          <div
            style={{
              background: `${C.amber}10`,
              border: `1px solid ${C.amber}40`,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: C.amber,
                marginBottom: 4,
              }}
            >
              \u26A0 Connection Issue
            </div>
            <div style={{ fontSize: 9, color: C.text }}>
              {githubData.error ||
                'Could not fetch repository data. Your token may have expired or the repo was deleted.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={S.btn('primary')}
              onClick={() => setShowConnect(true)}
            >
              Reconnect
            </button>
            <button style={S.btn('ghost')} onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connect Modal */}
      {showConnect && (
        <Modal
          title="Connect to GitHub"
          onClose={() => {
            setShowConnect(false);
            setError(null);
          }}
          width={420}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 10, color: C.text, lineHeight: 1.6 }}>
                <strong>How to connect:</strong>
                <ol style={{ margin: '8px 0', paddingLeft: 16 }}>
                  <li>Create a repo on GitHub (or use existing)</li>
                  <li>
                    Go to Settings \u2192 Developer Settings \u2192 Personal
                    Access Tokens
                  </li>
                  <li>
                    Generate a token with <code>repo</code> scope
                  </li>
                  <li>Paste the token below</li>
                </ol>
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 9, color: C.blue }}
                >
                  🔗 Open GitHub Token Settings \u2192
                </a>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: `${C.red}10`,
                  border: `1px solid ${C.red}40`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 12,
                }}
              >
                <div style={{ fontSize: 10, color: C.red }}>\u26A0 {error}</div>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Repository Owner</span>
              <input
                style={S.input}
                value={form.owner}
                onChange={(e) =>
                  setForm((f) => ({ ...f, owner: e.target.value }))
                }
                placeholder="your-username or org-name"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Your GitHub username or organization
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Repository Name</span>
              <input
                style={S.input}
                value={form.repo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, repo: e.target.value }))
                }
                placeholder="my-project-docs"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                The repo where your Brain files will sync
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span style={S.label()}>Branch</span>
              <input
                style={S.input}
                value={form.branch}
                onChange={(e) =>
                  setForm((f) => ({ ...f, branch: e.target.value }))
                }
                placeholder="main"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Default branch to sync (usually 'main')
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={S.label()}>Personal Access Token</span>
              <input
                style={{ ...S.input, fontFamily: 'monospace' }}
                type="password"
                value={form.token}
                onChange={(e) =>
                  setForm((f) => ({ ...f, token: e.target.value }))
                }
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              />
              <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                Token with <strong>repo</strong> scope. Never shared or
                displayed again.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={S.btn('primary')}
                onClick={handleConnect}
                disabled={saving}
              >
                {saving ? 'Connecting...' : 'Connect to GitHub'}
              </button>
              <button
                style={S.btn('ghost')}
                onClick={() => setShowConnect(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GitHubIntegration;
