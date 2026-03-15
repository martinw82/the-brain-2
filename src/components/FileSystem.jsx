import { useState } from 'react';
import { C, S } from '../TheBrain.jsx';
import QuickTagRow from './QuickTagRow.jsx';
import FileTree from './FileTree.jsx';

const FileSystem = ({
  hub,
  hubId,
  isMobile,
  mobileFileTreeOpen,
  setMobileFileTreeOpen,
  projects,
  projectsApi,
  fetchMetadata,
  setProjects,
  setModal,
  deleteFile,
  handleDrop,
  dragOver,
  setDragOver,
  S,
  C
}) => {
  // This component represents the file system portion of the hub view
  // It is a simplified representation of the file tree and related functionality
  
  return (
    <div
      style={{
        display: 'flex',
        gap: isMobile ? 0 : 10,
        height: isMobile
          ? 'calc(100vh - 140px)'
          : 'calc(100vh-160px)',
        minHeight: 500,
        flexDirection: isMobile ? 'column' : 'row',
        position: 'relative',
      }}
    >
      {/* Mobile: File tree toggle button */}
      {isMobile && (
        <button
          style={{
            ...S.btn('ghost'),
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: '8px 12px',
            minHeight: 44,
          }}
          onClick={() => setMobileFileTreeOpen(true)}
        >
          📁 Files
        </button>
      )}

      {/* Desktop: Persistent sidebar / Mobile: Slide-out drawer */}
      {(!isMobile || mobileFileTreeOpen) && (
        <>
          {isMobile && mobileFileTreeOpen && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 350 }}
              onClick={() => setMobileFileTreeOpen(false)}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.7)',
                }}
              />
            </div>
          )}
          <div
            style={{
              width: isMobile ? 280 : 210,
              flexShrink: 0,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: isMobile ? 0 : 8,
              overflow: 'hidden',
              position: isMobile ? 'fixed' : 'relative',
              top: isMobile ? 0 : 'auto',
              left: isMobile ? 0 : 'auto',
              bottom: isMobile ? 0 : 'auto',
              zIndex: isMobile ? 360 : 'auto',
            }}
          >
            {isMobile && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  📁 Files
                </span>
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '6px 10px',
                    fontSize: 16,
                  }}
                  onClick={() => setMobileFileTreeOpen(false)}
                >
                  ✕
                </button>
              </div>
            )}
            <div
              style={{
                height: isMobile ? 'calc(100% - 50px)' : '100%',
                overflow: 'auto',
              }}
            >
              <FileTree
                files={hub.files || {}}
                activeFile={hub.activeFile}
                customFolders={hub.customFolders || []}
                onSelect={(path) => {
                  setProjects((prev) =>
                    prev.map((p) =>
                      p.id === hubId
                        ? { ...p, activeFile: path }
                        : p
                    )
                  );
                  projectsApi
                    .setActiveFile(hubId, path)
                    .catch(() => {});
                  fetchMetadata(hubId, path);
                  if (isMobile) setMobileFileTreeOpen(false);
                }}
                onNewFile={() => setModal('new-file')}
                onDelete={(path) => deleteFile(hubId, path)}
              />
            </div>
          </div>
        </>
      )}
      
      {/* Editor area */}
      <div
        style={{
          flex: 1,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: isMobile ? 0 : 8,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          position: 'relative',
          marginLeft: isMobile ? 0 : 'auto',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => handleDrop(e, hubId)}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {dragOver && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(26,79,214,0.12)',
                border: `2px dashed ${C.blue}`,
                borderRadius: isMobile ? 0 : 8,
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 14, color: C.blue }}>
                Drop to stage →
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileSystem;