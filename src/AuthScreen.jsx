// src/AuthScreen.jsx
// Login / Register UI — shown when no token exists

import { useState } from 'react';
import { auth, token } from './api.js';

const C = {
  bg: '#070b14',
  surface: '#0a0f1e',
  border: '#0f1e3a',
  blue: '#1a4fd6',
  blue2: '#3b82f6',
  green: '#10b981',
  red: '#ef4444',
  text: '#cbd5e1',
  muted: '#475569',
  dim: '#334155',
  mono: "'JetBrains Mono','Fira Code','Courier New',monospace",
};

export default function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login'); // "login" | "register"
  const [email, setEmail] = useState('');
  const [password, setPass] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Email and password required');
      return;
    }
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await auth.login(email.trim(), password)
          : await auth.register(
              email.trim(),
              password,
              name.trim() || undefined
            );

      token.set(res.token);
      onAuth(res.user);
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    background: '#0d1424',
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    color: '#e2e8f0',
    fontFamily: C.mono,
    fontSize: 13,
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 10,
  };

  const btn = (variant = 'primary') => ({
    background: variant === 'primary' ? C.blue : 'transparent',
    border: variant === 'ghost' ? `1px solid ${C.border}` : 'none',
    color: '#e2e8f0',
    borderRadius: 6,
    padding: '10px 0',
    fontSize: 12,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    fontFamily: C.mono,
    width: '100%',
    marginBottom: 8,
  });

  return (
    <div
      style={{
        fontFamily: C.mono,
        background: C.bg,
        color: C.text,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 380, maxWidth: '95vw' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🧠</div>
          <div
            style={{
              fontSize: 9,
              color: C.blue,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
            }}
          >
            Project OS · v6
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#f1f5f9',
              marginTop: 4,
            }}
          >
            THE BRAIN
          </div>
          <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
            Bootstrap → Build → Thailand 🇹🇭
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: 28,
            boxShadow: `0 0 40px ${C.blue}12`,
          }}
        >
          {/* Mode toggle */}
          <div
            style={{
              display: 'flex',
              marginBottom: 24,
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError('');
                }}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: C.mono,
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '8px 0',
                  color: mode === m ? C.blue2 : C.dim,
                  borderBottom:
                    mode === m
                      ? `2px solid ${C.blue2}`
                      : '2px solid transparent',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {mode === 'register' && (
            <input
              style={inp}
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}

          <input
            style={inp}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          <input
            style={inp}
            type="password"
            placeholder={
              mode === 'register' ? 'Password (min 8 chars)' : 'Password'
            }
            value={password}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />

          {error && (
            <div
              style={{
                fontSize: 10,
                color: C.red,
                marginBottom: 10,
                padding: '8px 10px',
                background: 'rgba(239,68,68,0.08)',
                border: `1px solid ${C.red}30`,
                borderRadius: 5,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <button style={btn('primary')} onClick={submit} disabled={loading}>
            {loading
              ? '...'
              : mode === 'login'
                ? 'Sign In →'
                : 'Create Account →'}
          </button>

          {mode === 'login' && (
            <div
              style={{
                fontSize: 9,
                color: C.dim,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              No account?{' '}
              <span
                style={{ color: C.blue2, cursor: 'pointer' }}
                onClick={() => setMode('register')}
              >
                Create one free
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 8,
            color: '#1e293b',
            textAlign: 'center',
            marginTop: 20,
          }}
        >
          THE BRAIN · ALL DATA YOURS · PORTABLE BY DESIGN
        </div>
      </div>
    </div>
  );
}
