import React, { useState, useEffect, useCallback, useRef } from 'react';
import { C, S } from '../../utils/constants.js';
import { search as searchApi } from '../../api.js';
import { getFileType } from '../../utils/fileHandlers.js';
import { Modal } from '../UI/SmallComponents.jsx';

// ── SEARCH MODAL (Phase 3.3) ────────────────────────────────
const SearchModal = ({
  isOpen,
  onClose,
  projects,
  searchRes,
  runSearch,
  searchFilters,
  setSearchFilters,
  recentSearches,
  openHub,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim()) {
        setLoading(true);
        runSearch(query).then(() => setLoading(false));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, searchFilters]);

  if (!isOpen) return null;

  // Group results by project
  const grouped = {};
  searchRes.forEach((r) => {
    if (!grouped[r.project_id]) {
      grouped[r.project_id] = {
        project_id: r.project_id,
        project_name: r.project_name,
        emoji: r.emoji,
        matches: [],
      };
    }
    grouped[r.project_id].matches.push(r);
  });

  // Highlight match in excerpt
  const highlightExcerpt = (excerpt, q) => {
    if (!q || !excerpt) return excerpt;
    const parts = excerpt.split(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    );
    return parts.map((part, i) => {
      if (part.toLowerCase() === q.toLowerCase()) {
        return (
          <span
            key={i}
            style={{
              background: 'rgba(26,79,214,0.4)',
              color: '#fff',
              padding: '0 2px',
              borderRadius: 2,
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // Get unique folders and file types for filters
  const allFolders = [
    ...new Set(searchRes.map((r) => r.folder).filter(Boolean)),
  ];
  const allTypes = [
    ...new Set(searchRes.map((r) => r.extension).filter(Boolean)),
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 700,
          maxHeight: '70vh',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search files... (Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: C.text,
              fontSize: 16,
              outline: 'none',
            }}
          />
          {loading && <span style={{ fontSize: 12, color: C.dim }}>⏳</span>}
          <button
            onClick={onClose}
            style={{ ...S.btn('ghost'), padding: '4px 8px', fontSize: 12 }}
          >
            ESC
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: '10px 20px',
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <select
            value={searchFilters.project_id}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, project_id: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 120 }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji}
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.folder}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, folder: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 100 }}
          >
            <option value="">All Folders</option>
            {allFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={searchFilters.file_type}
            onChange={(e) =>
              setSearchFilters((f) => ({ ...f, file_type: e.target.value }))
            }
            style={{ ...S.sel, fontSize: 10, minWidth: 100 }}
          >
            <option value="">All Types</option>
            {allTypes.map((t) => (
              <option key={t} value={t}>
                .{t}
              </option>
            ))}
          </select>
          {(searchFilters.project_id ||
            searchFilters.folder ||
            searchFilters.file_type) && (
            <button
              onClick={() =>
                setSearchFilters({
                  project_id: '',
                  folder: '',
                  file_type: '',
                  tag: '',
                })
              }
              style={{ ...S.btn('ghost'), fontSize: 10, padding: '4px 8px' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {!query.trim() && recentSearches.length > 0 && (
            <div style={{ padding: '10px 20px' }}>
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Recent Searches
              </div>
              {recentSearches.map((s, i) => (
                <div
                  key={i}
                  onClick={() => setQuery(s)}
                  style={{
                    padding: '6px 10px',
                    cursor: 'pointer',
                    borderRadius: 4,
                    fontSize: 12,
                    color: C.text,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = '#ffffff08')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          {query.trim() && Object.keys(grouped).length === 0 && !loading && (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: C.dim,
                fontSize: 12,
              }}
            >
              No results found
            </div>
          )}

          {Object.values(grouped).map((group) => [
            <div
              key={`h-${group.project_id}`}
              style={{
                padding: '12px 20px 6px',
                fontSize: 11,
                color: C.blue,
                fontWeight: 600,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              {group.emoji}
              {group.project_name}({group.matches.length})
            </div>,
            ...group.matches.map((m, i) => (
              <div
                key={`${m.project_id}-${m.path}-${i}`}
                onClick={() => {
                  openHub(m.project_id, m.path);
                  onClose();
                }}
                style={{ padding: '8px 20px', cursor: 'pointer' }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = '#ffffff08')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <div style={{ fontSize: 11, color: C.text }}>{m.path}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: C.dim,
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {highlightExcerpt(m.excerpt, query)}
                </div>
              </div>
            )),
          ])}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 20px',
            borderTop: `1px solid ${C.border}`,
            background: C.bg,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: C.dim,
          }}
        >
          <span>{searchRes.length}results</span>
          <span>
            Cmd+K to open · ESC to close · ↑↓ to navigate · Enter to select
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
