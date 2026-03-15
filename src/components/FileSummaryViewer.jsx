/**
 * File Summary Viewer (Phase 5.2)
 * Displays L0/L1 summaries for project files
 */

import { useState, useEffect } from 'react';
import { fileSummaries } from '../api.js';

// Colors matching TheBrain.jsx
const C = {
  bg: '#070b14',
  surface: '#0a0f1e',
  border: '#0f1e3a',
  blue: '#1a4fd6',
  blue2: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  text: '#cbd5e1',
  muted: '#475569',
  dim: '#334155',
};

const S = {
  card: (hi) => ({
    background: C.surface,
    border: `1px solid ${hi ? C.blue : C.border}`,
    borderRadius: 8,
    padding: '14px 18px',
    marginBottom: 10,
  }),
  label: (col) => ({
    fontSize: 9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: col || C.dim,
    marginBottom: 8,
    display: 'block',
  }),
  badge: (c) => ({
    fontSize: 9,
    padding: '2px 6px',
    borderRadius: 3,
    background: `${c}18`,
    color: c,
    border: `1px solid ${c}35`,
    letterSpacing: '0.09em',
    fontWeight: 700,
  }),
};

export default function FileSummaryViewer({ projectId, projectFiles }) {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    loadSummaries();
  }, [projectId]);

  const loadSummaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fileSummaries.list(projectId);
      setSummaries(result?.summaries || []);
    } catch (e) {
      setError('Failed to load summaries');
    } finally {
      setLoading(false);
    }
  };

  const fileCount = Object.keys(projectFiles || {}).filter(
    (f) => !f.endsWith('.gitkeep') && f !== 'manifest.json'
  ).length;

  const summarizedCount = summaries.length;
  const coverage =
    fileCount > 0 ? Math.round((summarizedCount / fileCount) * 100) : 0;

  return (
    <div style={S.card(false)}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={S.label(C.blue2)}>
          📝 File Summaries
          <span
            style={{
              ...S.badge(
                coverage >= 80 ? C.green : coverage >= 50 ? C.amber : C.dim
              ),
              marginLeft: 8,
            }}
          >
            {coverage}% covered
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 10, color: C.muted }}>
            {summarizedCount} / {fileCount} files
          </span>
          <button
            onClick={loadSummaries}
            style={{
              fontSize: 9,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.text,
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 10, color: C.muted, padding: '12px 0' }}>
          Loading summaries...
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: '#ef4444', padding: '12px 0' }}>
          {error}
        </div>
      )}

      {!loading && summaries.length === 0 && (
        <div
          style={{
            fontSize: 10,
            color: C.muted,
            padding: '12px 0',
            lineHeight: 1.6,
          }}
        >
          No summaries yet. Summaries are generated automatically when you save
          files (markdown, code, JSON).
          <br />
          <span style={{ color: C.dim }}>
            L0 = 1-sentence abstract | L1 = Structured overview
          </span>
        </div>
      )}

      {!loading && summaries.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 400,
            overflow: 'auto',
          }}
        >
          {summaries.map((s) => (
            <div
              key={s.file_path}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                background: C.bg,
                cursor: 'pointer',
              }}
              onClick={() =>
                setExpanded(expanded === s.file_path ? null : s.file_path)
              }
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: C.text,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {s.file_path}
                  </div>
                  <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.5 }}>
                    {s.l0_abstract || 'No abstract available'}
                  </div>
                </div>
                <span
                  style={{ fontSize: 8, color: C.dim, whiteSpace: 'nowrap' }}
                >
                  {s.token_count ? `~${Math.round(s.token_count)} tokens` : ''}
                </span>
              </div>

              {expanded === s.file_path && s.l1_overview && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 9,
                    color: C.text,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <div style={{ ...S.label(C.blue), marginBottom: 4 }}>
                    L1 Overview
                  </div>
                  {s.l1_overview}
                </div>
              )}

              {expanded === s.file_path && !s.l1_overview && (
                <div
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 9,
                    color: C.dim,
                    fontStyle: 'italic',
                  }}
                >
                  No L1 overview available (file may be too small)
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 8, color: C.dim }}>
        Click any file to expand L1 overview. Summaries update automatically on
        file save.
      </div>
    </div>
  );
}
