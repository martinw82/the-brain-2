import React, { useState, useEffect } from 'react';
import { C, S } from '../../utils/constants.js';

// ── METADATA EDITOR (Roadmap 2.3 + 3.1) ───────────────────
const MetadataEditor = ({
  file,
  projectId,
  metadata,
  onSave,
  allTags,
  aiSuggestions,
  onRequestSuggestions,
  loadingSuggestions,
  onAcceptSuggestion,
}) => {
  const [category, setCategory] = useState(metadata?.category || '');
  const [status, setStatus] = useState(metadata?.status || 'draft');
  const [customFields, setCustomFields] = useState(
    metadata?.metadata_json?.custom || {}
  );
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [showAiSection, setShowAiSection] = useState(true);

  // Sync local state when metadata prop changes
  useEffect(() => {
    setCategory(metadata?.category || '');
    setStatus(metadata?.status || 'draft');
    setCustomFields(metadata?.metadata_json?.custom || {});
  }, [metadata]);

  const save = async () => {
    await onSave({ category, status, metadata_json: { custom: customFields } });
  };

  const addCustomField = () => {
    if (newFieldKey.trim()) {
      setCustomFields((prev) => ({ ...prev, [newFieldKey]: newFieldValue }));
      setNewFieldKey('');
      setNewFieldValue('');
    }
  };

  const hasSuggestions =
    aiSuggestions && !aiSuggestions.error && !aiSuggestions.ignored;
  const suggestions = aiSuggestions?.suggestions;

  return (
    <div
      style={{
        borderLeft: `1px solid ${C.border}`,
        padding: 12,
        minWidth: 250,
        maxWidth: 300,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          marginBottom: expanded ? 8 : 0,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          📋 Metadata
        </span>
        <span style={{ fontSize: 12 }}>{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div>
          {/* AI Suggestions (Phase 3.1) */}
          {showAiSection && (
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                background: C.bg,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <span style={{ fontSize: 9, color: C.purple, fontWeight: 600 }}>
                  🤖 AI Suggestions
                </span>
                <button
                  style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 8 }}
                  onClick={() => onRequestSuggestions?.()}
                  disabled={loadingSuggestions}
                >
                  {loadingSuggestions ? '⏳' : '↻ Refresh'}
                </button>
              </div>

              {loadingSuggestions && (
                <div style={{ fontSize: 9, color: C.dim, fontStyle: 'italic' }}>
                  Analyzing content...
                </div>
              )}

              {aiSuggestions?.ignored && (
                <div style={{ fontSize: 9, color: C.dim }}>
                  {aiSuggestions.reason || 'File type not analyzed'}
                </div>
              )}

              {aiSuggestions?.error && (
                <div style={{ fontSize: 9, color: C.red }}>
                  {aiSuggestions.error}
                </div>
              )}

              {hasSuggestions && suggestions && (
                <div>
                  {/* Category suggestion */}
                  {suggestions.category &&
                    suggestions.category !== category && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{ fontSize: 8, color: C.dim, flexShrink: 0 }}
                        >
                          Category:
                        </span>
                        <span
                          style={{
                            fontSize: 8,
                            color: C.purple,
                            border: `1px dashed ${C.purple}`,
                            padding: '2px 6px',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setCategory(suggestions.category);
                            onAcceptSuggestion?.(
                              'category',
                              suggestions.category
                            );
                          }}
                        >
                          {suggestions.category} ✓
                        </span>
                      </div>
                    )}

                  {/* Status suggestion */}
                  {suggestions.status && suggestions.status !== status && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{ fontSize: 8, color: C.dim, flexShrink: 0 }}
                      >
                        Status:
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          color: C.purple,
                          border: `1px dashed ${C.purple}`,
                          padding: '2px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setStatus(suggestions.status);
                          onAcceptSuggestion?.('status', suggestions.status);
                        }}
                      >
                        {suggestions.status} ✓
                      </span>
                    </div>
                  )}

                  {/* Tag suggestions */}
                  {suggestions.tags && suggestions.tags.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <span
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          display: 'block',
                          marginBottom: 4,
                        }}
                      >
                        Suggested tags:
                      </span>
                      <div
                        style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
                      >
                        {suggestions.tags.map((tag, idx) => {
                          const alreadyHas = allTags?.some(
                            (t) => t.name?.toLowerCase() === tag.toLowerCase()
                          );
                          return (
                            <span
                              key={idx}
                              style={{
                                fontSize: 8,
                                color: C.purple,
                                border: `1px dashed ${C.purple}`,
                                padding: '2px 6px',
                                borderRadius: 4,
                                cursor: 'pointer',
                                opacity: alreadyHas ? 0.5 : 1,
                              }}
                              onClick={() =>
                                !alreadyHas && onAcceptSuggestion?.('tag', tag)
                              }
                            >
                              {tag} {alreadyHas ? '(has)' : '✓'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Confidence indicator */}
                  {suggestions.confidence !== undefined && (
                    <div style={{ fontSize: 8, color: C.dim, marginTop: 6 }}>
                      Confidence: {Math.round(suggestions.confidence * 100)}%
                    </div>
                  )}
                </div>
              )}

              {!loadingSuggestions &&
                !hasSuggestions &&
                !aiSuggestions?.error &&
                !aiSuggestions?.ignored && (
                  <div style={{ fontSize: 9, color: C.dim }}>
                    Click refresh to analyze file content
                  </div>
                )}
            </div>
          )}

          {/* Category */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Category</label>
            <input
              type="text"
              style={{ ...S.input, fontSize: 9, width: '100%' }}
              placeholder="design, docs..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          {/* Status */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Status</label>
            <select
              style={{ ...S.sel, fontSize: 9, width: '100%' }}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="in-progress">In Progress</option>
              <option value="review">Review</option>
              <option value="final">Final</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Custom Fields */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, color: C.dim }}>Custom Fields</label>
            {Object.entries(customFields).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  gap: 4,
                  marginBottom: 4,
                  fontSize: 8,
                }}
              >
                <span
                  style={{ flex: 1, color: C.dim, wordBreak: 'break-word' }}
                >
                  {key}:
                </span>
                <span
                  style={{ flex: 1, color: C.text, wordBreak: 'break-word' }}
                >
                  {value}
                </span>
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '2px 4px',
                    color: C.red,
                    flexShrink: 0,
                  }}
                  onClick={() =>
                    setCustomFields((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input
                type="text"
                style={{ ...S.input, flex: 1, fontSize: 8, padding: '4px' }}
                placeholder="key"
                value={newFieldKey}
                onChange={(e) => setNewFieldKey(e.target.value)}
              />
              <input
                type="text"
                style={{ ...S.input, flex: 1, fontSize: 8, padding: '4px' }}
                placeholder="value"
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
              />
              <button
                style={{
                  ...S.btn('success'),
                  fontSize: 8,
                  padding: '4px 8px',
                  flexShrink: 0,
                }}
                onClick={addCustomField}
              >
                +
              </button>
            </div>
          </div>

          {/* Save Button */}
          <button
            style={{ ...S.btn('primary'), width: '100%', fontSize: 9 }}
            onClick={save}
          >
            💾 Save
          </button>
        </div>
      )}
    </div>
  );
};

export default MetadataEditor;
