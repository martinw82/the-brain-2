import { useState, useRef } from 'react';
import {
  C,
  S,
  STANDARD_FOLDERS,
  STANDARD_FOLDER_IDS,
  REVIEW_STATUSES,
  BUIDL_PHASES,
} from '../../utils/constants.js';
import { getFileType } from '../../utils/fileHandlers.js';
import { renderMd, parseTasks } from '../../utils/renderers.js';
import FileTreeInline from '../FileTreeInline.jsx';
import MarkdownEditor from '../MarkdownEditor.jsx';
import ImageViewer from '../viewers/ImageViewer.jsx';
import AudioPlayer from '../viewers/AudioPlayer.jsx';
import VideoPlayer from '../viewers/VideoPlayer.jsx';
import BinaryViewer from '../viewers/BinaryViewer.jsx';
import MetadataEditor from '../Modals/MetadataEditor.jsx';
import GanttChart from '../GanttChart.jsx';
import ScriptRunner from '../ScriptRunner.jsx';
import HealthCheck from '../HealthCheck.jsx';
import FileSummaryViewer from '../FileSummaryViewer.jsx';
import FolderSyncSetup from '../FolderSyncSetup.jsx';
import { BadgeStatus, HealthBar, Dots } from '../UI/SmallComponents.jsx';
import {
  projects as projectsApi,
  comments as commentsApi,
  links as linksApi,
  templates as templatesApi,
  tags as tagsApi,
} from '../../api.js';

/**
 * HubEditorPanel — all hub tab content (editor, overview, folders,
 * review, devlog, gantt, comments, meta, links).
 * Accepts a single ctx prop with all required state/callbacks.
 */
export default function HubEditorPanel({ ctx }) {
  const {
    hub,
    hubId,
    hubTab,
    hubAllFolders,
    projects,
    staging,
    areas,
    goals,
    templates,
    tasks,
    comments,
    newComment,
    setNewComment,
    setComments,
    hubLinks,
    setHubLinks,
    newLinkForm,
    setNewLinkForm,
    reviewFilter,
    setReviewFilter,
    dragOver,
    setDragOver,
    mobileFileTreeOpen,
    setMobileFileTreeOpen,
    modal,
    setModal,
    setProjects,
    setBootstrapWiz,
    setTemplates,
    sessionLog,
    setSessionLog,
    fileMetadataState,
    setFileMetadata,
    loadingMetadata,
    setLoadingMetadata,
    aiSuggestions,
    setAiSuggestions,
    loadingAiSuggestions,
    setLoadingAiSuggestions,
    userSettings,
    syncState,
    setSyncState,
    isMobile,
    isTablet,
    hubTabRef,
    activeGoal,
    areaStats,
    // functions
    saveFile,
    handleHubSave,
    deleteFile,
    handleDrop,
    updateProject,
    exportProject,
    updateStagingStatus,
    moveToFolder,
    QuickTagRow,
    fetchMetadata,
    saveMetadata,
    requestAiSuggestions,
    acceptAiSuggestion,
    showToast,
    fmtTime,
  } = ctx;

  const commKey = `${hubId}:${hub.activeFile}`;
  const fileComs = comments[commKey] || [];

  return (
    <div>
      {hubTab === 'editor' && (
        <div
          style={{
            display: 'flex',
            gap: isMobile ? 0 : 10,
            height: isMobile ? 'calc(100vh - 140px)' : 'calc(100vh-160px)',
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
                  <FileTreeInline
                    files={hub.files || {}}
                    activeFile={hub.activeFile}
                    customFolders={hub.customFolders || []}
                    onSelect={(path) => {
                      setProjects((prev) =>
                        prev.map((p) =>
                          p.id === hubId ? { ...p, activeFile: path } : p
                        )
                      );
                      projectsApi.setActiveFile(hubId, path).catch(e => console.error('[sync]', e.message));
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

          {/* Roadmap 2.3: Editor pane now in flex layout with metadata panel */}
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
              {(hub.activeFile &&
                (() => {
                  const fileType = getFileType(hub.activeFile);
                  const content = (hub.files || {})[hub.activeFile] || '';
                  if (fileType === 'image')
                    return (
                      <ImageViewer path={hub.activeFile} content={content} />
                    );
                  if (fileType === 'audio')
                    return (
                      <AudioPlayer path={hub.activeFile} content={content} />
                    );
                  if (fileType === 'video')
                    return (
                      <VideoPlayer path={hub.activeFile} content={content} />
                    );
                  if (
                    fileType === 'binary' ||
                    fileType === 'document' ||
                    fileType === 'archive'
                  )
                    return (
                      <BinaryViewer path={hub.activeFile} content={content} />
                    );
                  return (
                    <MarkdownEditor
                      path={hub.activeFile}
                      content={content}
                      onChange={() => {}}
                      onSave={handleHubSave}
                      saving={saving}
                      files={hub.files || {}}
                    />
                  );
                })()) ||
                null}
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
        </div>
      )}

      {hubTab === 'overview' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 10,
          }}
        >
          <div style={S.card(true)}>
            <span style={S.label()}>Status</span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 6,
                marginBottom: 10,
              }}
            >
              {[
                { l: 'Phase', v: hub.phase },
                {
                  l: 'Status',
                  v: <BadgeStatus status={hub.status} />,
                },
                { l: 'Priority', v: `#${hub.priority}` },
                { l: 'Health', v: <HealthBar score={hub.health} /> },
                { l: 'Momentum', v: <Dots n={hub.momentum} /> },
                {
                  l: 'Income',
                  v: `${activeGoal?.currency === 'USD' ? '$' : activeGoal?.currency === 'EUR' ? '€' : '£'}${hub.incomeTarget || 0}/mo`,
                },
              ].map((r) => (
                <div
                  key={r.l}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5,
                    padding: '7px 10px',
                  }}
                >
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                      marginBottom: 3,
                    }}
                  >
                    {r.l}
                  </div>
                  <div style={{ fontSize: 11 }}>{r.v}</div>
                </div>
              ))}
            </div>
            <span style={S.label()}>Area</span>
            <div style={{ marginBottom: 10 }}>
              <select
                style={S.sel}
                value={hub.areaId || ''}
                onChange={(e) =>
                  updateProject(hubId, { areaId: e.target.value })
                }
              >
                <option value="">No Area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon} {a.name}
                  </option>
                ))}
              </select>
            </div>
            <span style={S.label(C.green)}>Next Action</span>
            <div
              style={{
                fontSize: 11,
                color: C.green,
                marginBottom: 8,
              }}
            >
              → {hub.nextAction}
            </div>
            {hub.blockers?.length > 0 && (
              <>
                {hub.blockers.map((b, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#92400e' }}>
                    ⚠ {b}
                  </div>
                ))}
              </>
            )}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
              }}
            >
              <button
                style={{ ...S.btn('success'), fontSize: 9 }}
                onClick={() => setBootstrapWiz(hubId)}
              >
                🚀 Bootstrap Wizard
              </button>
              <button
                style={S.btn('ghost')}
                onClick={() => exportProject(hubId)}
              >
                ⬇ Export
              </button>
            </div>
          </div>
          <div style={S.card(false)}>
            <span style={S.label()}>Project Overview</span>
            <div
              style={{ fontSize: 11, lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{
                __html: renderMd(
                  (hub.files || {})['PROJECT_OVERVIEW.md'] || ''
                ),
              }}
            />
          </div>
        </div>
      )}

      {hubTab === 'folders' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: C.blue,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              📁 All Folders
            </span>
            <button
              style={S.btn('ghost')}
              onClick={() => setModal('new-custom-folder')}
            >
              + Custom Folder
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : 'repeat(auto-fill,minmax(220px,1fr))',
              gap: 8,
            }}
          >
            {hubAllFolders.map((f) => {
              const files = hub.files || {};
              const count = Object.keys(files).filter(
                (k) => k.startsWith(f.id + '/') && !k.endsWith('.gitkeep')
              ).length;
              const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
              return (
                <div
                  key={f.id}
                  style={{
                    background: C.bg,
                    border: `1px solid ${isCustom ? C.purple : C.border}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>
                      {f.icon}{' '}
                      <span
                        style={{
                          fontSize: 11,
                          color: '#e2e8f0',
                          fontWeight: 600,
                        }}
                      >
                        {f.label}
                      </span>
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        alignItems: 'center',
                      }}
                    >
                      {isCustom && (
                        <span style={S.badge(C.purple)}>custom</span>
                      )}
                      <span
                        style={{
                          fontSize: 9,
                          color: count > 0 ? C.blue2 : C.dim,
                        }}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: C.muted }}>{f.desc}</div>
                  {count > 0 && (
                    <div style={{ marginTop: 6 }}>
                      {Object.keys(files)
                        .filter(
                          (k) =>
                            k.startsWith(f.id + '/') && !k.endsWith('.gitkeep')
                        )
                        .map((path) => (
                          <div
                            key={path}
                            onClick={() => {
                              setProjects((prev) =>
                                prev.map((p) =>
                                  p.id === hubId
                                    ? { ...p, activeFile: path }
                                    : p
                                )
                              );
                              setHubTab('editor');
                            }}
                            style={{
                              fontSize: 9,
                              color: C.blue,
                              cursor: 'pointer',
                              padding: '1px 0',
                            }}
                          >
                            {path.split('/').pop()}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hubTab === 'review' && (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => handleDrop(e, hubId)}
            style={{
              background: dragOver ? 'rgba(26,79,214,0.08)' : C.surface,
              border: `2px dashed ${dragOver ? C.blue : C.border}`,
              borderRadius: 8,
              padding: 16,
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 10, color: C.muted }}>
              🌀 Drag & drop files to stage them
            </div>
          </div>

          {/* Phase 2.3: Filter toggle for review items */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: C.blue,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              📋 Review Items
            </span>
            <select
              style={{ ...S.sel, fontSize: 9 }}
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="filed">Filed</option>
              <option value="all">All</option>
            </select>
          </div>

          {(() => {
            const filtered = staging
              .filter((s) => s.project === hubId)
              .filter((s) => {
                if (reviewFilter === 'pending') return !s.folder_path;
                if (reviewFilter === 'filed') return !!s.folder_path;
                return true;
              });

            return filtered.length === 0 ? (
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  textAlign: 'center',
                  padding: '24px 0',
                }}
              >
                No {reviewFilter !== 'all' ? reviewFilter + ' ' : ''}
                items for {hub.name}.
              </div>
            ) : (
              filtered.map((item) => {
                const sc = REVIEW_STATUSES[item.status];
                return (
                  <div
                    key={item.id}
                    style={{
                      background: C.bg,
                      border: `1px solid ${sc.color}25`,
                      borderLeft: `3px solid ${sc.color}`,
                      borderRadius: '0 6px 6px 0',
                      padding: '10px 14px',
                      marginBottom: 7,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                        flexWrap: 'wrap',
                        gap: 5,
                      }}
                    >
                      <span style={{ fontSize: 11 }}>{item.name}</span>
                      <span style={S.badge(sc.color)}>
                        {sc.icon} {sc.label}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        marginBottom: 6,
                      }}
                    >
                      {item.notes} · {item.added}
                    </div>

                    {/* Phase 2.3: Show filing status or move interface */}
                    {item.folder_path ? (
                      <div
                        style={{
                          fontSize: 9,
                          color: C.green,
                          padding: '4px 0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span>✓ Filed</span>
                        <span style={{ fontSize: 8, color: C.dim }}>
                          → {item.folder_path}
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          gap: 4,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        {item.status === 'approved' && (
                          <select
                            style={{
                              ...S.sel,
                              flex: 1,
                              fontSize: 9,
                              minWidth: '120px',
                              padding: '4px 6px',
                            }}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value)
                                moveToFolder(item.id, e.target.value);
                              e.target.value = '';
                            }}
                          >
                            <option value="">📁 Move to folder...</option>
                            {hubAllFolders
                              .filter((f) => f.id !== 'staging')
                              .map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.icon} {f.label}
                                </option>
                              ))}
                          </select>
                        )}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {['approved', 'rejected', 'deferred']
                            .filter((s) => s !== item.status)
                            .map((s) => (
                              <button
                                key={s}
                                style={{
                                  ...S.btn(
                                    s === 'approved'
                                      ? 'success'
                                      : s === 'rejected'
                                        ? 'danger'
                                        : 'ghost'
                                  ),
                                  padding: '2px 8px',
                                  fontSize: 8,
                                }}
                                onClick={() => updateStagingStatus(item.id, s)}
                              >
                                {REVIEW_STATUSES[s].icon} {s}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            );
          })()}
        </div>
      )}

      {hubTab === 'devlog' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <textarea
              style={{
                ...S.input,
                height: 60,
                resize: 'vertical',
                flex: 1,
              }}
              placeholder="What did you build/learn/decide?"
              value={sessionLog}
              onChange={(e) => setSessionLog(e.target.value)}
            />
            <button
              style={{ ...S.btn('success'), alignSelf: 'flex-end' }}
              onClick={async () => {
                if (!sessionLog.trim()) return;
                const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n\n${sessionLog}\n`;
                const current = (hub.files || {})['DEVLOG.md'] || '';
                await saveFile(hubId, 'DEVLOG.md', current + entry);
                setSessionLog('');
              }}
            >
              Log
            </button>
          </div>
          <div
            style={{
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: '14px 18px',
              maxHeight: 420,
              overflowY: 'auto',
              fontSize: 11,
              lineHeight: 1.8,
            }}
            dangerouslySetInnerHTML={{
              __html: renderMd(
                (hub.files || {})['DEVLOG.md'] || '*No entries yet.*'
              ),
            }}
          />
        </div>
      )}

      {hubTab === 'gantt' && (
        <div style={S.card(false)}>
          <span style={S.label()}>Timeline</span>
          <GanttChart tasks={parseTasks((hub.files || {})['TASKS.md'] || '')} />
          <div
            style={{
              marginTop: 14,
              maxHeight: 280,
              overflowY: 'auto',
            }}
            dangerouslySetInnerHTML={{
              __html: renderMd(
                (hub.files || {})['TASKS.md'] || '*No tasks yet.*'
              ),
            }}
          />
        </div>
      )}

      {hubTab === 'comments' && (
        <div>
          <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
            On: <span style={{ color: C.blue }}>{hub.activeFile}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input
              style={S.input}
              placeholder="Add comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newComment.trim()) {
                  const tmp = {
                    id: `tmp-${Date.now()}`,
                    text: newComment,
                    date: new Date().toISOString().slice(0, 10),
                    resolved: false,
                  };
                  setComments((prev) => ({
                    ...prev,
                    [commKey]: [...(prev[commKey] || []), tmp],
                  }));
                  setNewComment('');
                  try {
                    const r = await commentsApi.create(
                      hubId,
                      hub.activeFile,
                      newComment
                    );
                    setComments((prev) => ({
                      ...prev,
                      [commKey]: (prev[commKey] || []).map((c) =>
                        c.id === tmp.id ? { ...c, id: r.id } : c
                      ),
                    }));
                  } catch (e) { console.error('[catch]', e.message); }
                }
              }}
            />
            <button
              style={S.btn('primary')}
              onClick={async () => {
                if (!newComment.trim()) return;
                const tmp = {
                  id: `tmp-${Date.now()}`,
                  text: newComment,
                  date: new Date().toISOString().slice(0, 10),
                  resolved: false,
                };
                setComments((prev) => ({
                  ...prev,
                  [commKey]: [...(prev[commKey] || []), tmp],
                }));
                setNewComment('');
                try {
                  const r = await commentsApi.create(
                    hubId,
                    hub.activeFile,
                    newComment
                  );
                  setComments((prev) => ({
                    ...prev,
                    [commKey]: (prev[commKey] || []).map((c) =>
                      c.id === tmp.id ? { ...c, id: r.id } : c
                    ),
                  }));
                } catch (e) { console.error('[catch]', e.message); }
              }}
            >
              Add
            </button>
          </div>
          {commentsLoading ? (
            <div
              style={{
                fontSize: 10,
                color: C.dim,
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              Loading comments...
            </div>
          ) : fileComs.length === 0 ? (
            <div
              style={{
                fontSize: 10,
                color: C.dim,
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              No comments yet.
            </div>
          ) : (
            fileComs.map((c) => (
              <div
                key={c.id}
                style={{
                  background: C.bg,
                  border: `1px solid ${c.resolved ? C.border : C.blue + '40'}`,
                  borderRadius: 6,
                  padding: '10px 14px',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 9, color: C.muted }}>{c.date}</span>
                  <button
                    style={{
                      ...S.btn(c.resolved ? 'ghost' : 'success'),
                      padding: '1px 7px',
                      fontSize: 8,
                    }}
                    onClick={async () => {
                      setComments((prev) => ({
                        ...prev,
                        [commKey]: prev[commKey].map((cm) =>
                          cm.id === c.id
                            ? { ...cm, resolved: !cm.resolved }
                            : cm
                        ),
                      }));
                      await commentsApi
                        .resolve(c.id, !c.resolved)
                        .catch(e => console.error('[sync]', e.message));
                    }}
                  >
                    {c.resolved ? 'Reopen' : '✓ Resolve'}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: c.resolved ? C.muted : C.text,
                    textDecoration: c.resolved ? 'line-through' : 'none',
                  }}
                >
                  {c.text}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {hubTab === 'meta' && (
        <div>
          {/* Script Runner Section (Phase 3.6) */}
          <ScriptRunner projectId={hubId} projectFiles={hub?.files || {}} />

          {/* Health Check Section (Phase 3.5) */}
          <HealthCheck
            project={hub}
            projectFiles={hub?.files || {}}
            templates={templates}
            onFix={async (fixes) => {
              for (const fix of fixes) {
                if (fix.type === 'create_file') {
                  await handleHubSave(fix.path, fix.content);
                }
              }
              showToast(
                `✓ Fixed ${fixes.length} issue${fixes.length !== 1 ? 's' : ''}`
              );
            }}
          />

          {/* Desktop Sync Section */}
          <FolderSyncSetup
            projectId={hubId}
            syncState={syncState}
            onSyncStateChange={setSyncState}
            projectFiles={
              hub?.files
                ? Object.entries(hub.files).map(([path, content]) => ({
                    path,
                    content,
                  }))
                : []
            }
          />

          {/* File Summaries (Phase 5.2) */}
          <FileSummaryViewer
            projectId={hubId}
            projectFiles={hub?.files || {}}
          />

          {/* Manifest and Folder Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 10,
            }}
          >
            <div style={S.card(false)}>
              <span style={S.label()}>
                manifest.json{' '}
                <span style={S.badge(C.purple)}>portability contract</span>
              </span>
              <pre
                style={{
                  fontSize: 9,
                  color: C.muted,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 5,
                  padding: 12,
                  overflow: 'auto',
                  maxHeight: 300,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {(hub.files || {})['manifest.json'] || '{}'}
              </pre>
            </div>
            <div style={S.card(false)}>
              <span style={S.label()}>Folder Summary</span>
              {hubAllFolders.map((f) => {
                const count = Object.keys(hub.files || {}).filter(
                  (k) => k.startsWith(f.id + '/') && !k.endsWith('.gitkeep')
                ).length;
                const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
                return (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 9,
                      padding: '3px 0',
                      borderBottom: `1px solid ${C.border}`,
                      color: count > 0 ? C.text : C.dim,
                    }}
                  >
                    <span>
                      {f.icon} {f.label}{' '}
                      {isCustom && (
                        <span style={{ color: C.purple }}>·custom</span>
                      )}
                    </span>
                    <span style={{ color: count > 0 ? C.blue2 : C.dim }}>
                      {count}
                    </span>
                  </div>
                );
              })}
              <div style={{ marginTop: 16 }}>
                <button
                  style={S.btn('ghost')}
                  onClick={async () => {
                    const manifest = JSON.parse(
                      hub.files['manifest.json'] || '{}'
                    );
                    const template = {
                      name: `${hub.name} Template`,
                      description: `Extracted from project: ${hub.name}`,
                      icon: hub.emoji,
                      config: {
                        phases: BUIDL_PHASES.includes(hub.phase)
                          ? BUIDL_PHASES
                          : [hub.phase],
                        folders: Object.keys(hub.files)
                          .map((p) => p.split('/')[0])
                          .filter(
                            (f) =>
                              f &&
                              f !== '.gitkeep' &&
                              !f.endsWith('.md') &&
                              !f.endsWith('.json')
                          ),
                      },
                    };
                    try {
                      await templatesApi.create(template);
                      showToast('✓ Saved as template');
                      const data = await templatesApi.list();
                      setTemplates(data.templates || []);
                    } catch (e) {
                      showToast('Failed to save template');
                    }
                  }}
                >
                  Save as Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hubTab === 'links' && (
        <div>
          <div style={S.card(false)}>
            <span style={S.label()}>
              🔗 Link this project to another entity
            </span>
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
                marginTop: 8,
              }}
            >
              <div>
                <span style={S.label()}>Type</span>
                <select
                  style={S.sel}
                  value={newLinkForm.targetType}
                  onChange={(e) =>
                    setNewLinkForm((f) => ({
                      ...f,
                      targetType: e.target.value,
                      targetId: '',
                    }))
                  }
                >
                  <option value="project">Project</option>
                  <option value="idea">Idea</option>
                  <option value="staging">Staging Item</option>
                  <option value="goal">Goal</option>
                </select>
              </div>
              <div>
                <span style={S.label()}>Entity</span>
                <select
                  style={S.sel}
                  value={newLinkForm.targetId}
                  onChange={(e) =>
                    setNewLinkForm((f) => ({
                      ...f,
                      targetId: e.target.value,
                    }))
                  }
                >
                  <option value="">Select...</option>
                  {newLinkForm.targetType === 'project' &&
                    projects
                      .filter((p) => p.id !== hubId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                  {newLinkForm.targetType === 'idea' &&
                    ideas.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  {newLinkForm.targetType === 'staging' &&
                    staging.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  {newLinkForm.targetType === 'goal' &&
                    goals.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <span style={S.label()}>Relationship</span>
                <select
                  style={S.sel}
                  value={newLinkForm.relationship}
                  onChange={(e) =>
                    setNewLinkForm((f) => ({
                      ...f,
                      relationship: e.target.value,
                    }))
                  }
                >
                  <option value="related">Related</option>
                  <option value="parent">Parent of</option>
                  <option value="child">Child of</option>
                  <option value="supports">Supports</option>
                  <option value="blocks">Blocks</option>
                </select>
              </div>
              <button
                style={S.btn('primary')}
                onClick={async () => {
                  if (!newLinkForm.targetId) {
                    showToast('Select an entity first');
                    return;
                  }
                  try {
                    const res = await linksApi.create(
                      'project',
                      hubId,
                      newLinkForm.targetType,
                      newLinkForm.targetId,
                      newLinkForm.relationship
                    );
                    setHubLinks((prev) => [
                      ...prev,
                      {
                        id: res.id,
                        source_type: 'project',
                        source_id: hubId,
                        target_type: newLinkForm.targetType,
                        target_id: newLinkForm.targetId,
                        relationship: newLinkForm.relationship,
                        created_at: new Date().toISOString(),
                      },
                    ]);
                    setNewLinkForm((f) => ({ ...f, targetId: '' }));
                    showToast('✓ Link created');
                  } catch (e) {
                    showToast('Failed to create link');
                  }
                }}
              >
                Link
              </button>
            </div>
          </div>
          <div style={S.card(false)}>
            <span style={S.label()}>Existing Links ({hubLinks.length})</span>
            {hubLinks.length === 0 ? (
              <div
                style={{
                  fontSize: 10,
                  color: C.dim,
                  padding: '8px 0',
                }}
              >
                No links yet. Link this project to related ideas, goals, or
                other projects.
              </div>
            ) : (
              hubLinks.map((link) => {
                const isSource =
                  link.source_type === 'project' &&
                  String(link.source_id) === String(hubId);
                const otherType = isSource
                  ? link.target_type
                  : link.source_type;
                const otherId = isSource ? link.target_id : link.source_id;
                const rel = isSource
                  ? link.relationship
                  : `← ${link.relationship}`;
                let otherLabel = '';
                if (otherType === 'project') {
                  const p = projects.find(
                    (p) => String(p.id) === String(otherId)
                  );
                  otherLabel = p ? `${p.emoji} ${p.name}` : otherId;
                } else if (otherType === 'idea') {
                  const i = ideas.find((i) => String(i.id) === String(otherId));
                  otherLabel = i ? `💡 ${i.title}` : otherId;
                } else if (otherType === 'staging') {
                  const s = staging.find(
                    (s) => String(s.id) === String(otherId)
                  );
                  otherLabel = s ? `🌀 ${s.name}` : otherId;
                } else if (otherType === 'goal') {
                  const g = goals.find((g) => String(g.id) === String(otherId));
                  otherLabel = g ? `🎯 ${g.title}` : otherId;
                }
                return (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 10,
                      }}
                    >
                      <span
                        style={{
                          color: C.blue2,
                          textTransform: 'capitalize',
                        }}
                      >
                        {rel}
                      </span>
                      <span style={{ color: C.text }}>
                        {otherLabel || otherId}
                      </span>
                      <span style={S.badge(C.purple)}>{otherType}</span>
                    </div>
                    <button
                      style={{
                        ...S.btn('danger'),
                        padding: '2px 6px',
                        fontSize: 8,
                      }}
                      onClick={async () => {
                        await linksApi.delete(link.id);
                        setHubLinks((prev) =>
                          prev.filter((l) => l.id !== link.id)
                        );
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
