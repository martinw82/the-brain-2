import { useState, useEffect, useRef } from 'react';
import { C, S } from '../utils/constants.js';
import MarkdownPreview from './MarkdownPreview.jsx';

// ── MARKDOWN EDITOR ───────────────────────────────────────────
const MarkdownEditor = ({
  path,
  content,
  onChange,
  onSave,
  saving,
  files = {},
}) => {
  const [mode, setMode] = useState('edit');
  const [val, setVal] = useState(content);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setVal(content);
    setDirty(false);
  }, [content, path]);

  // Debounced auto-save
  useEffect(() => {
    if (!dirty) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave(path, val);
      setDirty(false);
    }, 2000);
    return () => clearTimeout(timerRef.current);
  }, [val, dirty, path, onSave]);

  const isJson = path?.endsWith('.json');
  const isReadonly = path === 'system/agent.ignore' || path === 'manifest.json';
  const hasMermaid = val.includes('```mermaid');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '7px 12px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 10,
              color: C.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 300,
            }}
          >
            {path}
          </span>
          {isReadonly && <span style={S.badge(C.amber)}>READONLY</span>}
          {path === 'manifest.json' && (
            <span style={S.badge(C.purple)}>MANIFEST</span>
          )}
          {hasMermaid && <span style={S.badge(C.blue)}>MERMAID</span>}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 4,
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          {dirty && (
            <span style={{ fontSize: 9, color: C.amber, marginRight: 8 }}>
              Unsaved changes...
            </span>
          )}
          {!isJson && !isReadonly && (
            <>
              <button
                style={S.tab(mode === 'edit', '#10b981')}
                onClick={() => setMode('edit')}
              >
                Edit
              </button>
              <button
                style={S.tab(mode === 'preview', '#10b981')}
                onClick={() => setMode('preview')}
              >
                Preview
              </button>
            </>
          )}
          {!isReadonly && (
            <button
              style={{
                ...S.btn('success'),
                padding: '4px 10px',
                opacity: saving ? 0.6 : 1,
              }}
              onClick={() => {
                onSave(path, val);
                setDirty(false);
              }}
              disabled={saving}
            >
              {saving ? 'Saving\u2026' : 'Save'}
            </button>
          )}
        </div>
      </div>
      {mode === 'edit' || isJson ? (
        <textarea
          style={{
            ...S.input,
            flex: 1,
            resize: 'none',
            border: 'none',
            borderRadius: 0,
            fontSize: isJson ? 11 : 12,
            lineHeight: 1.7,
            padding: '14px 16px',
            background: '#050810',
          }}
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            onChange(e.target.value);
            setDirty(true);
          }}
          readOnly={isReadonly}
          spellCheck={false}
        />
      ) : (
        <MarkdownPreview content={val} files={files} />
      )}
    </div>
  );
};

export default MarkdownEditor;
