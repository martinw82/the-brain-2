/**
 * TrainingLogModal Component - Phase 2.6
 * Quick-log training session: type, duration, notes, energy after
 */

import { useState } from 'react';

const C = {
  bg: '#0f172a',
  bgModal: '#1a1f36',
  border: '#1e293b',
  text: '#e2e8f0',
  dim: '#94a3b8',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

const TYPES = [
  { id: 'solo', label: 'Solo drill', emoji: '🥋' },
  { id: 'class', label: 'Class', emoji: '👥' },
  { id: 'sparring', label: 'Sparring', emoji: '🥊' },
  { id: 'conditioning', label: 'Conditioning', emoji: '🏋️' },
  { id: 'other', label: 'Other', emoji: '🏃' },
];

const S = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: C.bgModal,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 24,
    maxWidth: 450,
    width: '90%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  header: { fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 },
  section: { marginBottom: 18 },
  label: {
    fontSize: 11,
    color: C.blue,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  },
  typeGrid: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  typeBtn: (active) => ({
    padding: '6px 12px',
    borderRadius: 4,
    border: `1px solid ${active ? C.blue : C.border}`,
    background: active ? C.blue + '20' : 'transparent',
    color: active ? C.blue : C.dim,
    fontSize: 10,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
  }),
  numberInput: {
    width: 80,
    padding: '6px 8px',
    background: C.border,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 10,
  },
  sliderContainer: { display: 'flex', alignItems: 'center', gap: 12 },
  slider: {
    flex: 1,
    height: 4,
    background: C.border,
    borderRadius: 2,
    outline: 'none',
    cursor: 'pointer',
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: 600,
    color: C.blue,
    minWidth: 40,
    textAlign: 'right',
  },
  textarea: {
    width: '100%',
    padding: 8,
    background: C.border,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    resize: 'vertical',
    minHeight: 50,
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    gap: 8,
    marginTop: 20,
    justifyContent: 'flex-end',
  },
  btn: (type = 'primary') =>
    ({
      primary: {
        background: C.green,
        color: 'white',
        border: 'none',
        borderRadius: 4,
        padding: '8px 16px',
        fontSize: 10,
        fontWeight: 600,
        cursor: 'pointer',
      },
      ghost: {
        background: 'transparent',
        border: `1px solid ${C.border}`,
        color: C.dim,
        borderRadius: 4,
        padding: '8px 16px',
        fontSize: 10,
        cursor: 'pointer',
      },
    })[type],
};

export default function TrainingLogModal({ onSave, onDismiss }) {
  const [type, setType] = useState('solo');
  const [duration, setDuration] = useState(45);
  const [energyAfter, setEnergyAfter] = useState(6);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (duration < 1) return;
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await onSave({
        date: today,
        duration_minutes: duration,
        type,
        energy_after: energyAfter,
        notes: notes.trim() || null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onDismiss}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>🥋 Log Training</div>

        {/* Type */}
        <div style={S.section}>
          <label style={S.label}>Type</label>
          <div style={S.typeGrid}>
            {TYPES.map((t) => (
              <button
                key={t.id}
                style={S.typeBtn(type === t.id)}
                onClick={() => setType(t.id)}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div style={S.section}>
          <label style={S.label}>⏱ Duration</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min="1"
              max="300"
              value={duration}
              onChange={(e) =>
                setDuration(
                  Math.max(1, Math.min(300, parseInt(e.target.value) || 1))
                )
              }
              style={S.numberInput}
            />
            <span style={{ fontSize: 10, color: C.dim }}>minutes</span>
            <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
              {[30, 45, 60, 90].map((m) => (
                <button
                  key={m}
                  style={{
                    ...S.typeBtn(duration === m),
                    padding: '4px 8px',
                    fontSize: 9,
                  }}
                  onClick={() => setDuration(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Energy After */}
        <div style={S.section}>
          <label style={S.label}>⚡ Energy after training</label>
          <div style={S.sliderContainer}>
            <input
              type="range"
              min="0"
              max="10"
              value={energyAfter}
              onChange={(e) => setEnergyAfter(parseInt(e.target.value))}
              style={S.slider}
            />
            <span style={S.sliderValue}>{energyAfter}/10</span>
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
            {energyAfter <= 3
              ? '😴 Wiped out'
              : energyAfter <= 6
                ? '💪 Good effort'
                : '🔥 Energised'}
          </div>
        </div>

        {/* Notes */}
        <div style={S.section}>
          <label style={S.label}>📝 Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Worked guard sweeps, 3x5min rounds"
            style={S.textarea}
          />
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button
            style={S.btn('ghost')}
            onClick={onDismiss}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            style={S.btn('primary')}
            onClick={handleSave}
            disabled={isLoading || duration < 1}
          >
            {isLoading ? 'Saving...' : '🥋 Log Training'}
          </button>
        </div>
      </div>
    </div>
  );
}
