/**
 * Trust Approval Panel (Phase 1)
 * Brain OS v2.2
 *
 * Unified approval inbox with project filters.
 * Shows pending trust gates, approve/reject/modify actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { TIER_LABELS } from '../config/trustLadder.js';

const C = {
  bg: '#070b14',
  surface: '#0a0f1e',
  border: '#0f1e3a',
  blue: '#1a4fd6',
  blue2: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#6366f1',
  text: '#cbd5e1',
  muted: '#475569',
  dim: '#334155',
};

const tierColors = {
  1: C.amber,
  2: C.blue2,
  3: C.green,
};

export default function TrustApprovalPanel({ token, projectFilter = null }) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [notes, setNotes] = useState('');

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const url = projectFilter
        ? `/api/data?resource=trust&project_id=${encodeURIComponent(projectFilter)}`
        : '/api/data?resource=trust';

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch pending gates');
      const data = await res.json();
      setPending(data.pending || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, projectFilter]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleDecision = async (item, decision) => {
    setDecidingId(item.instance_id);
    try {
      const res = await fetch('/api/data?resource=trust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          workflow_id: item.workflow_id,
          run_id: item.instance_id,
          gate_name: item.pending_gate,
          decision,
          notes: notes || null,
        }),
      });

      if (!res.ok) throw new Error('Decision failed');
      setNotes('');
      await fetchPending();
    } catch (e) {
      setError(e.message);
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, color: C.muted, fontFamily: 'monospace' }}>
        Loading pending approvals...
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'monospace' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, color: C.text, fontSize: 14 }}>
          Trust Approval Queue
        </h3>
        <span
          style={{
            background: pending.length > 0 ? C.amber : C.dim,
            color: pending.length > 0 ? '#000' : C.muted,
            padding: '2px 8px',
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {pending.length}
        </span>
        <button
          onClick={fetchPending}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: `1px solid ${C.border}`,
            color: C.muted,
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {pending.length === 0 && (
        <div
          style={{
            color: C.muted,
            fontSize: 12,
            textAlign: 'center',
            padding: 32,
          }}
        >
          No pending approvals. All clear.
        </div>
      )}

      {pending.map((item) => (
        <div
          key={item.instance_id}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                background: tierColors[item.current_tier] || C.muted,
                color: '#000',
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Tier {item.current_tier} —{' '}
              {TIER_LABELS[item.current_tier] || 'Unknown'}
            </span>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>
              {item.pending_gate}
            </span>
          </div>

          <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
            Workflow: {item.workflow_id}
            {item.project_id && ` | Project: ${item.project_id}`}
            {` | Runs: ${item.run_count} | Approvals: ${item.approval_count}`}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Notes (optional)"
              value={decidingId === item.instance_id ? notes : ''}
              onChange={(e) => {
                setDecidingId(item.instance_id);
                setNotes(e.target.value);
              }}
              style={{
                flex: 1,
                background: C.bg,
                border: `1px solid ${C.border}`,
                color: C.text,
                padding: '5px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={() => handleDecision(item, 'approved')}
              disabled={decidingId === item.instance_id}
              style={{
                background: C.green,
                color: '#000',
                border: 'none',
                padding: '5px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Approve
            </button>
            <button
              onClick={() => handleDecision(item, 'rejected')}
              disabled={decidingId === item.instance_id}
              style={{
                background: C.red,
                color: '#fff',
                border: 'none',
                padding: '5px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
