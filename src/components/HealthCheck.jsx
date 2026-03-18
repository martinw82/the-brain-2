import React, { useState } from 'react';
import { C, S } from '../utils/constants.js';

// ── HEALTH CHECK (Phase 3.5) ─────────────────────────────────
const HealthCheck = ({ project, projectFiles, templates, onFix }) => {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState([]);
  const [fixing, setFixing] = useState(false);

  const REQUIRED_FILES = [
    {
      path: 'PROJECT_OVERVIEW.md',
      defaultContent: (name) =>
        `# ${name}\n\n## What is this?\n\n> One sentence description here.\n\n## Problem\n\n## Solution\n\n## Target User\n\n## Revenue Model\n\n## Current Status\n\n## Next Milestone\n`,
    },
    {
      path: 'DEVLOG.md',
      defaultContent: (name) =>
        `# Dev Log — ${name}\n\n## ${new Date().toISOString().slice(0, 10)}\n\n- Project initialised\n`,
    },
    {
      path: 'manifest.json',
      defaultContent: (name, id) =>
        JSON.stringify(
          {
            bidl_version: '1.0',
            id,
            name,
            emoji: '📁',
            phase: 'BOOTSTRAP',
            status: 'active',
            priority: 1,
            revenue_ready: false,
            income_target: 0,
            momentum: 3,
            last_touched: new Date().toISOString().slice(0, 7),
            desc: '',
            next_action: '',
            blockers: [],
            tags: [],
            skills: ['dev', 'strategy'],
            custom_folders: [],
            integrations: {},
            created: new Date().toISOString(),
            exported: new Date().toISOString(),
          },
          null,
          2
        ),
    },
  ];

  const runCheck = async () => {
    setChecking(true);
    setIssues([]);

    await new Promise((r) => setTimeout(r, 300)); // Visual feedback

    const foundIssues = [];
    const files = projectFiles || {};
    const template = templates.find((t) => t.id === project?.templateId);
    const allFolderIds = [
      ...(template?.config?.folders || []),
      ...(project?.customFolders?.map((f) => f.id) || []),
    ];

    // Check 1: Required files exist
    for (const req of REQUIRED_FILES) {
      if (!files[req.path]) {
        foundIssues.push({
          type: 'missing_file',
          severity: 'error',
          message: `Missing required file: ${req.path}`,
          path: req.path,
          autoFix: () =>
            req.defaultContent(
              project?.name || 'Project',
              project?.id || 'project'
            ),
        });
      }
    }

    // Check 2: manifest.json is valid JSON
    if (files['manifest.json']) {
      try {
        const manifest = JSON.parse(files['manifest.json']);
        // Check if manifest matches project state
        if (manifest.name !== project?.name) {
          foundIssues.push({
            type: 'manifest_mismatch',
            severity: 'warning',
            message: `Manifest name "${manifest.name}" doesn't match project name "${project?.name}"`,
            path: 'manifest.json',
          });
        }
        if (manifest.phase !== project?.phase) {
          foundIssues.push({
            type: 'manifest_mismatch',
            severity: 'warning',
            message: `Manifest phase "${manifest.phase}" doesn't match project phase "${project?.phase}"`,
            path: 'manifest.json',
          });
        }
      } catch (e) {
        console.error('[catch]', e.message);
        foundIssues.push({
          type: 'invalid_json',
          severity: 'error',
          message: 'manifest.json contains invalid JSON',
          path: 'manifest.json',
        });
      }
    }

    // Check 3: Orphaned files (files not in any folder)
    const orphaned = Object.keys(files).filter((path) => {
      if (path === 'manifest.json') return false;
      const folder = path.split('/')[0];
      return !allFolderIds.includes(folder) && !path.includes('/');
    });
    if (orphaned.length > 0) {
      foundIssues.push({
        type: 'orphaned_files',
        severity: 'warning',
        message: `${orphaned.length} file(s) not in any folder`,
        paths: orphaned,
      });
    }

    // Check 4: Template-required folders exist
    if (template?.config?.folders) {
      const missingFolders = template.config.folders.filter(
        (f) => !allFolderIds.includes(f)
      );
      for (const folderId of missingFolders) {
        foundIssues.push({
          type: 'missing_folder',
          severity: 'warning',
          message: `Missing template folder: ${folderId}`,
          folderId,
        });
      }
    }

    // Check 5: Empty .gitkeep files in folders
    for (const folderId of allFolderIds) {
      const gitkeepPath = `${folderId}/.gitkeep`;
      if (!files[gitkeepPath]) {
        foundIssues.push({
          type: 'missing_gitkeep',
          severity: 'info',
          message: `Missing .gitkeep in ${folderId}`,
          path: gitkeepPath,
          autoFix: () => '',
        });
      }
    }

    setIssues(foundIssues);
    setChecking(false);
  };

  const handleFixAll = async () => {
    const fixable = issues.filter((i) => i.autoFix);
    if (fixable.length === 0) return;

    setFixing(true);
    const fixes = [];
    for (const issue of fixable) {
      fixes.push({
        type: 'create_file',
        path: issue.path,
        content: issue.autoFix(),
      });
    }
    await onFix(fixes);

    // Re-run check
    await runCheck();
    setFixing(false);
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  const fixableCount = issues.filter((i) => i.autoFix).length;

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: C.blue,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            🏥 Health Check
          </span>
          {issues.length > 0 && (
            <>
              {errorCount > 0 && (
                <span style={{ ...S.badge(C.red), fontSize: 8 }}>
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span style={{ ...S.badge(C.amber), fontSize: 8 }}>
                  {warningCount} warning{warningCount !== 1 ? 's' : ''}
                </span>
              )}
              {infoCount > 0 && (
                <span style={{ ...S.badge(C.dim), fontSize: 8 }}>
                  {infoCount} info
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            style={{ ...S.btn('primary'), fontSize: 9, padding: '4px 10px' }}
            onClick={(e) => {
              e.stopPropagation();
              runCheck();
              setExpanded(true);
            }}
            disabled={checking}
          >
            {checking ? '⟳ Checking...' : '🔍 Check'}
          </button>
          <span style={{ fontSize: 12, color: C.dim }}>
            {expanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {issues.length === 0 ? (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: C.green,
                fontSize: 12,
              }}
            >
              ✓ All checks passed — project structure is healthy
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                {fixableCount > 0 && (
                  <button
                    style={{
                      ...S.btn('success'),
                      fontSize: 9,
                      padding: '4px 10px',
                    }}
                    onClick={handleFixAll}
                    disabled={fixing}
                  >
                    {fixing
                      ? '⟳ Fixing...'
                      : `✓ Auto-fix ${fixableCount} issue${fixableCount !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>

              {issues.map((issue, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 12px',
                    marginBottom: 6,
                    borderRadius: 4,
                    background:
                      issue.severity === 'error'
                        ? `${C.red}10`
                        : issue.severity === 'warning'
                          ? `${C.amber}10`
                          : C.bg,
                    border: `1px solid ${issue.severity === 'error' ? C.red : issue.severity === 'warning' ? C.amber : C.border}`,
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 10 }}>
                      {issue.severity === 'error'
                        ? '❌'
                        : issue.severity === 'warning'
                          ? '⚠️'
                          : 'ℹ️'}
                    </span>
                    <span style={{ fontSize: 10, color: C.text, flex: 1 }}>
                      {issue.message}
                    </span>
                    {issue.autoFix && (
                      <span style={{ fontSize: 8, color: C.green }}>
                        ✓ Auto-fixable
                      </span>
                    )}
                  </div>
                  {issue.paths && (
                    <div
                      style={{
                        marginTop: 4,
                        paddingLeft: 20,
                        fontSize: 9,
                        color: C.dim,
                      }}
                    >
                      {issue.paths.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HealthCheck;
