// Shared UI Components Library
// This file contains reusable UI components and styles
// that can be used across the application

import { C } from '../TheBrain.jsx';

// Button Styles (reusable across components)
export const ButtonStyles = {
  primary: (c = C.blue) => ({
    background: c,
    border: 'none',
    color: '#e2e8f0',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  ghost: (c = C.border) => ({
    background: 'transparent',
    border: `1px solid ${c}`,
    color: '#e2e8f0',
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  success: () => ({
    background: 'rgba(16,185,129,0.15)',
    border: '1px solid #10b98140',
    color: C.green,
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  danger: () => ({
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid #ef444440',
    color: C.red,
    borderRadius: 5,
    padding: '5px 12px',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    minHeight: 44,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
};

// Card Component Style
export const CardStyle = (hi, col) => ({
  background: C.surface,
  border: `1px solid ${hi ? col || C.blue : C.border}`,
  borderRadius: 8,
  padding: '14px 18px',
  marginBottom: 10,
  boxShadow: hi ? `0 0 18px ${col || C.blue}18` : 'none',
});

// Input Field Style
export const InputStyle = {
  background: '#0d1424',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: '#e2e8f0',
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '7px 11px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

// Select Field Style
export const SelectStyle = {
  background: '#0d1424',
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  color: '#e2e8f0',
  fontFamily: 'inherit',
  fontSize: 12,
  padding: '7px 11px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

// Tab Style
export const TabStyle = (a, c = C.blue2) => ({
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  padding: '7px 13px',
  color: a ? c : C.dim,
  borderBottom: a ? `2px solid ${c}` : '2px solid transparent',
  minHeight: 44,
});

// Badge Style
export const BadgeStyle = (c = C.blue2) => ({
  fontSize: 9,
  padding: '2px 6px',
  borderRadius: 3,
  background: `${c}18`,
  color: c,
  border: `1px solid ${c}35`,
  letterSpacing: '0.09em',
  fontWeight: 700,
  whiteSpace: 'nowrap',
});

// Label Style
export const LabelStyle = (c = C.blue) => ({
  fontSize: 9,
  color: c,
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  marginBottom: 8,
  display: 'block',
});

// Modal Component (basic structure)
export const ModalStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.8)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Toast Component Style
export const ToastStyle = {
  position: 'fixed',
  top: 20,
  right: 20,
  zIndex: 1000,
  padding: '12px 20px',
  borderRadius: 8,
  background: C.surface,
  border: `1px solid ${C.border}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  maxWidth: 400,
  animation: 'fadeIn 0.3s ease-out',
};