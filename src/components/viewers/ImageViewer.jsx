import React, { useState } from 'react';
import { C, S } from '../../utils/constants.js';
import { formatFileSize } from '../../utils/fileHandlers.js';

// ── IMAGE VIEWER ──────────────────────────────────────────────
const ImageViewer = ({ path, content }) => {
  const [imgError, setImgError] = useState(false);
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No image content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:image/png;base64,${content}`;
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
        📷 {path} • {formatFileSize(content)}
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          background: '#050810',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imgError ? (
          <div style={{ color: C.red, textAlign: 'center', fontSize: 11 }}>
            Failed to load image
          </div>
        ) : (
          <img
            src={src}
            alt={path}
            onError={() => setImgError(true)}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
              borderRadius: 4,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ImageViewer;
