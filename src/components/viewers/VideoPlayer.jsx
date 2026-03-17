import React from 'react';
import { C, S } from '../../utils/constants.js';
import { formatFileSize } from '../../utils/fileHandlers.js';

// ── VIDEO PLAYER ──────────────────────────────────────────────
const VideoPlayer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No video content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:video/mp4;base64,${content}`;
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
        🎥 {path} • {formatFileSize(content)}
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
        }}
      >
        <video
          src={src}
          controls
          style={{
            width: '100%',
            maxWidth: 800,
            maxHeight: '70vh',
            marginBottom: 16,
            borderRadius: 4,
          }}
        />
        <a
          href={src}
          download={path}
          style={{ ...S.btn('ghost'), padding: '6px 14px', fontSize: 10 }}
        >
          ⬇ Download
        </a>
      </div>
    </div>
  );
};

export default VideoPlayer;
