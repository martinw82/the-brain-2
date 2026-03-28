/**
 * Worker Status Panel
 * 
 * Shows connected desktop workers and their status.
 * Displays in project sidebar or workflow view.
 */

import { useState, useEffect } from 'react';
import { worker } from '../api.js';
import { C, S } from '../utils/constants.js';

export default function WorkerStatusPanel({ projectId }) {
  const [workers, setWorkers] = useState([]);
  const [pendingJobs, setPendingJobs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWorkerStatus();
    
    // Poll every 10 seconds
    const interval = setInterval(loadWorkerStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadWorkerStatus = async () => {
    try {
      const data = await worker.status();
      setWorkers(data.workers || []);
      setPendingJobs(data.pending_jobs || 0);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSeen = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return '🟢';
      case 'busy': return '🔵';
      case 'offline': return '🔴';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 12, color: C.dim, fontSize: 11 }}>
        Loading worker status...
      </div>
    );
  }

  const onlineWorkers = workers.filter(w => w.status === 'online' || w.status === 'busy');

  return (
    <div style={S.card(false)}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 12
      }}>
        <span style={S.label()}>💻 Desktop Workers</span>
        {pendingJobs > 0 && (
          <span style={{ 
            fontSize: 10, 
            color: C.amber,
            background: 'rgba(245,158,11,0.1)',
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {pendingJobs} pending
          </span>
        )}
      </div>

      {error ? (
        <div style={{ color: C.red, fontSize: 11 }}>
          Error loading workers: {error}
        </div>
      ) : onlineWorkers.length === 0 ? (
        <div style={{ 
          padding: 16, 
          textAlign: 'center',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 6,
          border: `1px dashed ${C.border}`
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>💤</div>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
            No workers connected
          </div>
          <div style={{ fontSize: 10, color: C.muted }}>
            Run <code style={{ background: C.surface, padding: '2px 4px', borderRadius: 3 }}>
              spine-worker start
            </code>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onlineWorkers.map((w) => (
            <div 
              key={w.worker_id}
              style={{
                padding: '10px 12px',
                background: C.surface,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}
            >
              <span style={{ fontSize: 16 }}>{getStatusIcon(w.status)}</span>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {w.worker_id}
                </div>
                <div style={{ fontSize: 9, color: C.dim }}>
                  {w.status === 'busy' && w.current_job ? (
                    <span style={{ color: C.blue }}>
                      Working on {w.current_job.job_type}
                    </span>
                  ) : (
                    `Idle • ${formatLastSeen(w.last_seen)}`
                  )}
                </div>
              </div>

              {/* Capability badges */}
              <div style={{ display: 'flex', gap: 4 }}>
                {w.capabilities?.['video.render']?.available && (
                  <span 
                    title="Video rendering"
                    style={{ fontSize: 12 }}
                  >
                    🎬
                  </span>
                )}
                {w.capabilities?.shell && (
                  <span 
                    title="Shell execution"
                    style={{ fontSize: 12 }}
                  >
                    🐚
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {pendingJobs > 0 && onlineWorkers.length === 0 && (
        <div style={{ 
          marginTop: 12,
          padding: 10,
          background: 'rgba(245,158,11,0.1)',
          border: `1px solid ${C.amber}30`,
          borderRadius: 6,
          fontSize: 10,
          color: C.amber
        }}>
          <strong>⏳ Waiting for worker</strong>
          <div style={{ marginTop: 4, color: C.dim }}>
            {pendingJobs} job{pendingJobs > 1 ? 's' : ''} queued
          </div>
        </div>
      )}
    </div>
  );
}
