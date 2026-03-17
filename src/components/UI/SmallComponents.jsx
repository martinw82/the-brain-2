import React, { useState, useEffect } from 'react';
import { C, S, STATUS_MAP } from '../../utils/constants.js';

export const AreaPill = ({ area, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...S.btn(active ? 'primary' : 'ghost'),
      background: active ? area.color : C.surface,
      border: active ? `1px solid ${area.color}` : `1px solid ${C.border}`,
      color: active ? '#fff' : C.text,
      fontSize: 9,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}
  >
    <span style={{ fontSize: 12 }}>{area.icon}</span> {area.name}
  </button>
);

export const TagPill = ({ tag, onRemove }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 9,
      padding: '2px 6px',
      borderRadius: 10,
      background: `${tag.color}22`,
      color: tag.color,
      border: `1px solid ${tag.color}55`,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}
  >
    {tag.name}
    {onRemove && (
      <span
        onClick={(e) => {
          e.stopPropagation();
          onRemove(tag);
        }}
        style={{
          cursor: 'pointer',
          marginLeft: 1,
          opacity: 0.7,
          fontWeight: 700,
        }}
      >
        ×
      </span>
    )}
  </span>
);

export const Dots = ({ n = 0, max = 5, size = 5 }) => (
  <div style={{ display: 'flex', gap: 3 }}>
    {Array.from({ length: max }).map((_, i) => (
      <div
        key={i}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: i < n ? C.blue2 : C.border,
        }}
      />
    ))}
  </div>
);

export const HealthBar = ({ score }) => {
  const col = score > 70 ? C.green : score > 40 ? C.amber : C.red;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 60,
          height: 4,
          background: C.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: col,
            borderRadius: 2,
          }}
        />
      </div>
      <span style={{ fontSize: 9, color: col, fontWeight: 700 }}>{score}</span>
    </div>
  );
};

export const BadgeStatus = ({ status }) => {
  const m = STATUS_MAP[status] || STATUS_MAP.idea;
  return <span style={S.badge(m.c)}>{m.l}</span>;
};

export const Modal = ({ title, onClose, children, width = 400 }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 24,
        width,
        maxWidth: '95vw',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9' }}>
          {title}
        </span>
        <button
          style={{ ...S.btn('ghost'), padding: '2px 8px' }}
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);

// Inline toast — replaces alert() for save confirmations
export const Toast = ({ msg, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: C.surface,
        border: `1px solid ${C.green}40`,
        borderRadius: 8,
        padding: '10px 18px',
        fontSize: 11,
        color: C.green,
        zIndex: 9999,
        boxShadow: `0 4px 24px rgba(0,0,0,0.4)`,
      }}
    >
      {msg}
    </div>
  );
};
