import { useState } from 'react';
import { C, S } from '../TheBrain.jsx';

const FileTree = ({
  files,
  activeFile,
  onSelect,
  onNewFile,
  onDelete,
  customFolders = [],
}) => {
  const [expanded, setExpanded] = useState(
    new Set(['staging', 'system', 'content-assets', 'code-modules'])
  );
  const tree = {};
  Object.keys(files).forEach((p) => {
    const parts = p.split('/');
    let node = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        node[part] = { _file: p };
      } else {
        node[part] = node[part] || {};
      }
      node = node[part];
    });
  });
  const allFolders = [...STANDARD_FOLDERS, ...customFolders];
  const getFolderMeta = (id) => allFolders.find((f) => f.id === id);
  const renderNode = (node, depth = 0, prefix = '') =>
    Object.entries(node)
      .filter(([k]) => !k.startsWith('_'))
      .map(([key, val]) => {
        const fullPath = prefix ? `${prefix}/${key}` : key;
        const isDir = !val._file;
        const isActive = val._file === activeFile;
        const isOpen = expanded.has(fullPath);
        const ext = key.split('.').pop()?.toLowerCase();
        const folderMeta = isDir ? getFolderMeta(key) : null;
        const icon = isDir
          ? folderMeta?.icon || (isOpen ? '📂' : '📁')
          : ext === 'md'
            ? '📝'
            : ext === 'json'
              ? '🔧'
              : ext === 'js'
                ? '⚡'
                : ext === 'py'
                  ? '🐍'
                  : ext === 'sol'
                    ? '💎'
                    : ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)
                      ? '🖼'
                      : ext === 'svg'
                        ? '🎨'
                        : ext === 'pdf'
                          ? '📕'
                          : ['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)
                            ? '📦'
                            : ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
                              ? '🎥'
                              : ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(
                                  ext
                                )
                                ? '🎵'
                                : '📄';
        if (key === '.gitkeep') return null;
        return (
          <div key={fullPath}>
            <div
              onClick={() => {
                if (isDir) {
                  setExpanded((e) => {
                    const n = new Set(e);
                    n.has(fullPath) ? n.delete(fullPath) : n.add(fullPath);
                    return n;
                  });
                } else onSelect(val._file);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 6px',
                paddingLeft: 8 + depth * 14,
                cursor: 'pointer',
                borderRadius: 4,
                background: isActive ? '#1a4fd620' : 'transparent',
                color: isActive ? C.blue2 : C.text,
                fontSize: 11,
              }}
              onMouseEnter={(e) =>
                !isActive && (e.currentTarget.style.background = '#ffffff08')
              }
              onMouseLeave={(e) =>
                !isActive && (e.currentTarget.style.background = 'transparent')
              }}
            >
              <span style={{ fontSize: 12 }}>{icon}</span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {key}
              </span>
              {isDir && folderMeta && !STANDARD_FOLDER_IDS.has(key) && (
                <span style={S.badge(C.purple)}>custom</span>
              )}
              {!isDir && val._file?.startsWith('staging/') && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(val._file);
                  }}
                  style={{
                    fontSize: 9,
                    color: C.red,
                    opacity: 0,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    e.currentTarget.style.opacity = 1;
                  }}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = 0)}>
                  ✕
                </span>
              )}
            </div>
            {isDir && isOpen && (
              <div>{renderNode(val, depth + 1, fullPath)}</div>
            )}
          </div>
        );
      });
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px 6px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: C.blue,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Files
        </span>
        <button
          style={{ ...S.btn('ghost'), padding: '2px 6px', fontSize: 9 }}
          onClick={onNewFile}
        >
          + File
        </button>
      </div>
      <div style={{ padding: '4px 2px' }}>{renderNode(tree)}</div>
    </div>
  );
};

export default FileTree;