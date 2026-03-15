/**
 * FolderSyncSetup Component - Phase 2.4B
 * UI for managing desktop folder connections and sync status
 */

import { useState, useEffect } from 'react';
import { desktopSync } from '../desktop-sync.js';

const C = {
  bg: '#0f172a',
  border: '#1e293b',
  text: '#e2e8f0',
  dim: '#94a3b8',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

const S = {
  container: {
    borderTop: `1px solid ${C.border}`,
    paddingTop: 16,
    marginTop: 16,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    cursor: 'pointer',
  },
  label: {
    fontSize: 10,
    color: C.blue,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  btn: (type = 'primary') =>
    ({
      primary: {
        background: C.blue,
        color: 'white',
        border: 'none',
        borderRadius: 4,
        padding: '6px 12px',
        fontSize: 9,
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'opacity 0.2s',
      },
      danger: {
        background: C.red,
        color: 'white',
        border: 'none',
        borderRadius: 4,
        padding: '6px 12px',
        fontSize: 9,
        cursor: 'pointer',
        fontWeight: 500,
      },
      ghost: {
        background: 'transparent',
        border: `1px solid ${C.border}`,
        color: C.text,
        borderRadius: 4,
        padding: '6px 12px',
        fontSize: 9,
        cursor: 'pointer',
      },
    })[type],
  statusBadge: (status) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 8,
    fontWeight: 500,
    marginRight: 8,
    background:
      status === 'connected'
        ? `${C.green}20`
        : status === 'syncing'
          ? `${C.blue}20`
          : status === 'error'
            ? `${C.red}20`
            : `${C.dim}20`,
    color:
      status === 'connected'
        ? C.green
        : status === 'syncing'
          ? C.blue
          : status === 'error'
            ? C.red
            : C.dim,
  }),
  fileList: {
    background: C.border,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
    maxHeight: 200,
    overflowY: 'auto',
    fontSize: 8,
    color: C.dim,
  },
  fileItem: {
    padding: '4px 0',
    borderBottom: `1px solid ${C.border}`,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
};

export default function FolderSyncSetup({
  projectId,
  syncState,
  onSyncStateChange,
  projectFiles,
}) {
  const [expanded, setExpanded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [folderName, setFolderName] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [isSyncing, setIsSyncing] = useState(false);

  // Load sync state on mount
  useEffect(() => {
    if (syncState) {
      setFolderName(
        syncState.folder_handle_key ? '📁 Desktop Folder Connected' : null
      );
      setLastSyncTime(syncState.last_sync_at);
      setSyncStatus(syncState.sync_status || 'idle');
    }
  }, [syncState]);

  // Check if File System Access API is supported
  const isSupported = desktopSync.isSupported();

  const handleConnectFolder = async () => {
    setIsConnecting(true);
    try {
      const dirHandle = await desktopSync.selectFolder();
      if (!dirHandle) {
        setIsConnecting(false);
        return;
      }

      // Save folder handle for persistence
      const handleKey = await desktopSync.saveFolderHandle(
        projectId,
        dirHandle
      );

      // Update sync state in DB
      const response = await fetch('/api/data?resource=sync_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          folder_handle_key: handleKey,
          sync_status: 'idle',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFolderName('📁 Desktop Folder Connected');
        onSyncStateChange(data);
      }
    } catch (e) {
      console.error('Failed to connect folder:', e);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const response = await fetch(
        `/api/data?resource=sync_state&project_id=${projectId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setFolderName(null);
        setLastSyncTime(null);
        onSyncStateChange(null);
      }
    } catch (e) {
      console.error('Failed to disconnect folder:', e);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncStatus('syncing');

    try {
      const dirHandle = await desktopSync.getFolderHandle(projectId);
      if (!dirHandle) {
        console.error('No folder handle found');
        setSyncStatus('error');
        return;
      }

      // Perform sync
      const result = await desktopSync.syncFiles(
        dirHandle,
        projectId,
        projectFiles || []
      );

      setLastSyncTime(new Date().toISOString());
      setSyncStatus('idle');

      // Show result notification
      const message =
        result.synced > 0
          ? `✓ Synced ${result.synced} files`
          : 'No changes to sync';
    } catch (e) {
      console.error('Sync error:', e);
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isSupported) {
    return (
      <div style={S.container}>
        <div style={S.label}>🖥 Desktop Sync (Not Supported)</div>
        <div style={{ fontSize: 9, color: C.dim, marginTop: 8 }}>
          File System Access API is not available in your browser. Use Chrome,
          Edge, or Safari 16+.
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      <div style={S.header} onClick={() => setExpanded(!expanded)}>
        <span style={S.label}>🖥 Desktop Sync</span>
        <span style={{ fontSize: 12, color: C.dim }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {!folderName ? (
            <div>
              <p style={{ fontSize: 9, color: C.dim, marginBottom: 8 }}>
                Connect a desktop folder to sync files with this project.
              </p>
              <button
                style={S.btn('primary')}
                onClick={handleConnectFolder}
                disabled={isConnecting}
              >
                {isConnecting ? '⟳ Connecting...' : '🖥 Connect Folder'}
              </button>
            </div>
          ) : (
            <div>
              {/* Connection Status */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: 12,
                  padding: 8,
                  background: C.border,
                  borderRadius: 4,
                }}
              >
                <span style={S.statusBadge('connected')}>
                  {syncStatus === 'syncing' ? '⟳ Syncing' : '✓ Connected'}
                </span>
                <span style={{ fontSize: 9, color: C.text }}>{folderName}</span>
              </div>

              {/* Last Sync Time */}
              {lastSyncTime && (
                <div style={{ fontSize: 8, color: C.dim, marginBottom: 8 }}>
                  Last sync:{' '}
                  {new Date(lastSyncTime).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <button
                  style={S.btn('primary')}
                  onClick={handleSyncNow}
                  disabled={isSyncing}
                >
                  {isSyncing ? '⟳ Syncing...' : '🔄 Sync Now'}
                </button>
                <button
                  style={S.btn('ghost')}
                  onClick={handleDisconnect}
                  disabled={isSyncing}
                >
                  🔌 Disconnect
                </button>
              </div>

              {/* Status Message */}
              {syncStatus === 'error' && (
                <div
                  style={{
                    fontSize: 8,
                    color: C.red,
                    marginTop: 8,
                    padding: 6,
                    background: `${C.red}10`,
                    borderRadius: 3,
                  }}
                >
                  ⚠ Sync error — check browser console for details
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
