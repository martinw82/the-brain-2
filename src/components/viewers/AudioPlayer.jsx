import React from 'react';
import { C, S } from '../../utils/constants.js';
import { formatFileSize } from '../../utils/fileHandlers.js';

// ── AUDIO PLAYER ──────────────────────────────────────────────
const AudioPlayer = ({ path, content }) => {
  if (!content)
    return (
      <div style={{ padding: '20px', color: C.muted }}>No audio content</div>
    );
  const src = content.startsWith('data:')
    ? content
    : `data:audio/mpeg;base64,${content}`;
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
        🎵 {path} • {formatFileSize(content)}
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
        <audio
          src={src}
          controls
          style={{ width: '100%', maxWidth: 400, marginBottom: 16 }}
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

export default AudioPlayer;
