import React from 'react';
import { C, S } from '../../utils/constants.js';
import { getFileType, formatFileSize } from '../../utils/fileHandlers.js';

// ── BINARY VIEWER ─────────────────────────────────────────────
const BinaryViewer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No file content</div>
    );
  const fileType = getFileType(path);
  const icons = { document: '📕', archive: '📦', unknown: '⚫' };
  const icon = icons[fileType] || '⚫';
  const size = formatFileSize(content);
  const isLarge = content.length > 500 * 1024;
  const downloadFile = () => {
    let mimeType = 'application/octet-stream';
    if (content.startsWith('data:'))
      mimeType = content.split(';')[0].replace('data:', '');
    const blob = new Blob([content.startsWith('data:') ? content : content], {
      type: mimeType,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = path.split('/').pop();
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10,
          color: C.muted,
        }}
      >
        {icon} {path} • {size}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 12, color: C.text, textAlign: 'center' }}>
          This file cannot be previewed
        </div>
        {isLarge && (
          <div
            style={{
              fontSize: 9,
              color: C.amber,
              background: 'rgba(245,158,11,0.1)',
              border: `1px solid ${C.amber}30`,
              borderRadius: 4,
              padding: '8px 12px',
              maxWidth: 300,
            }}
          >
            ⚠ Large file ({size}) — may load slowly
          </div>
        )}
        <button
          onClick={downloadFile}
          style={{ ...S.btn('primary'), padding: '8px 16px', fontSize: 11 }}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  );
};

export default BinaryViewer;
