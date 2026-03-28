import { useState } from 'react';
import { C, S } from '../TheBrain.jsx';
import QuickTagRow from './QuickTagRow.jsx';
import MarkdownEditor from './MarkdownEditor.jsx';
import ImageViewer from './ImageViewer.jsx';
import AudioPlayer from './AudioPlayer.jsx';
import VideoPlayer from './VideoPlayer.jsx';
import BinaryViewer from './BinaryViewer.jsx';
import MetadataEditor from './MetadataEditor.jsx';

const Editor = ({
  hub,
  hubId,
  isMobile,
  hubTab,
  activeFile,
  fileMetadata,
  saveMetadata,
  userTags,
  aiSuggestions,
  requestAiSuggestions,
  loadingAiSuggestions,
  acceptAiSuggestion,
  handleHubSave,
  saving,
  projectsApi,
  getFileType,
  setModal,
  deleteFile,
  setProjects,
  projects,
  setMobileFileTreeOpen,
  mobileFileTreeOpen,
  setDragOver,
  dragOver,
  handleDrop,
  S,
  C,
}) => {
  // This component represents the editor portion of the hub view
  // It handles displaying different file types based on extension

  if (!hub.activeFile) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 'calc(100vh - 200px)',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 32 }}>📄</div>
        <div
          style={{
            fontSize: 10,
            color: C.muted,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Select a file to edit
        </div>
      </div>
    );
  }

  const fileType = getFileType(hub.activeFile);
  const content = (hub.files || {})[hub.activeFile] || '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {hub.activeFile && (
        <div
          style={{
            padding: '4px 10px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            flexWrap: 'wrap',
            background: C.bg,
            marginTop: isMobile ? 50 : 0,
          }}
        >
          <span
            style={{
              fontSize: 8,
              color: C.dim,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              flexShrink: 0,
            }}
          >
            tags
          </span>
          <QuickTagRow
            entityType="file"
            entityId={`${hubId}/${hub.activeFile}`}
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {fileType === 'image' ? (
          <ImageViewer path={hub.activeFile} content={content} />
        ) : fileType === 'audio' ? (
          <AudioPlayer path={hub.activeFile} content={content} />
        ) : fileType === 'video' ? (
          <VideoPlayer path={hub.activeFile} content={content} />
        ) : fileType === 'binary' ||
          fileType === 'document' ||
          fileType === 'archive' ? (
          <BinaryViewer path={hub.activeFile} content={content} />
        ) : (
          <MarkdownEditor
            path={hub.activeFile}
            content={content}
            onChange={() => {}}
            onSave={handleHubSave}
            saving={saving}
            files={hub.files || {}}
          />
        )}
      </div>

      {/* Metadata panel (right side) - hidden on mobile */}
      {hub.activeFile && !isMobile && (
        <MetadataEditor
          file={hub.activeFile}
          projectId={hubId}
          metadata={fileMetadata}
          onSave={(data) => saveMetadata(hubId, hub.activeFile, data)}
          allTags={userTags}
          aiSuggestions={aiSuggestions}
          onRequestSuggestions={requestAiSuggestions}
          loadingSuggestions={loadingAiSuggestions}
          onAcceptSuggestion={acceptAiSuggestion}
        />
      )}
    </div>
  );
};

export default Editor;
