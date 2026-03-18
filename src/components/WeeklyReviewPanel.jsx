/**
 * WeeklyReviewPanel — Phase 2.9
 * Week navigation, stats aggregation, reflection fields, AI generate, save
 */

import { useState, useEffect, useCallback } from 'react';

const C = {
  bg: '#0f172a',
  card: '#1a1f36',
  border: '#1e293b',
  text: '#e2e8f0',
  dim: '#94a3b8',
  blue: '#3b82f6',
  green: '#10b981',
  amber: '#f59e0b',
  purple: '#6366f1',
  red: '#ef4444',
};

const S = {
  wrap: { padding: '20px 0' },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  navBtn: {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.dim,
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 12,
    cursor: 'pointer',
  },
  weekLabel: { fontSize: 14, fontWeight: 600, color: C.text, flex: 1 },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: '12px 14px',
  },
  statLabel: {
    fontSize: 10,
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  statVal: { fontSize: 22, fontWeight: 700, color: C.text },
  statSub: { fontSize: 10, color: C.dim, marginTop: 2 },
  section: { marginBottom: 16 },
  label: {
    fontSize: 11,
    color: C.purple,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block',
  },
  textarea: {
    width: '100%',
    padding: 10,
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 12,
    fontFamily: "'JetBrains Mono', monospace",
    resize: 'vertical',
    minHeight: 70,
    boxSizing: 'border-box',
    outline: 'none',
  },
  aiBox: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: 14,
    fontSize: 12,
    color: C.text,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    minHeight: 60,
  },
  sessionList: {
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    maxHeight: 160,
    overflowY: 'auto',
  },
  sessionRow: {
    padding: '8px 12px',
    borderBottom: `1px solid ${C.border}`,
    fontSize: 11,
    color: C.dim,
    display: 'flex',
    gap: 8,
  },
  btnRow: { display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' },
  btn: (variant = 'primary') =>
    ({
      primary: {
        background: C.purple,
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '8px 16px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
      },
      ghost: {
        background: 'transparent',
        border: `1px solid ${C.border}`,
        color: C.dim,
        borderRadius: 4,
        padding: '8px 16px',
        fontSize: 11,
        cursor: 'pointer',
      },
      green: {
        background: C.green,
        color: '#fff',
        border: 'none',
        borderRadius: 4,
        padding: '8px 16px',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
      },
    })[variant],
  status: (ok) => ({
    fontSize: 11,
    color: ok ? C.green : C.red,
    marginLeft: 'auto',
    alignSelf: 'center',
  }),
};

function getMonday(dateStr) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function offsetWeek(weekStart, n) {
  const d = new Date(weekStart + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().split('T')[0];
}

function formatWeekLabel(weekStart) {
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const fmt = (dt) =>
    dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(d)} – ${fmt(end)} ${d.getFullYear()}`;
}

export default function WeeklyReviewPanel({ token, onAskAI }) {
  const [weekStart, setWeekStart] = useState(getMonday());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // "saved" | "error"
  const [aiLoading, setAiLoading] = useState(false);

  // Reflection fields
  const [shipped, setShipped] = useState('');
  const [blocked, setBlocked] = useState('');
  const [nextPri, setNextPri] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');

  const load = useCallback(
    async (ws) => {
      setLoading(true);
      setSaveStatus(null);
      try {
        const res = await fetch(`/api/data?resource=weekly-review&week=${ws}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        setData(json);
        // Populate saved fields if they exist
        if (json.review) {
          setShipped(json.review.what_shipped || '');
          setBlocked(json.review.what_blocked || '');
          setNextPri(json.review.next_priority || '');
          setAiAnalysis(json.review.ai_analysis || '');
        } else {
          setShipped('');
          setBlocked('');
          setNextPri('');
          setAiAnalysis('');
        }
      } catch (e) {
        console.error('[WeeklyReview] load error:', e);
      }
      setLoading(false);
    },
    [token]
  );

  useEffect(() => {
    load(weekStart);
  }, [weekStart, load]);

  const handlePrev = () => setWeekStart((w) => offsetWeek(w, -1));
  const handleNext = () => {
    const next = offsetWeek(weekStart, 1);
    if (next <= getMonday()) setWeekStart(next);
  };
  const handleThisWeek = () => setWeekStart(getMonday());

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`/api/data?resource=weekly-review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          week_start: weekStart,
          what_shipped: shipped,
          what_blocked: blocked,
          next_priority: nextPri,
          ai_analysis: aiAnalysis,
          data_json: data?.stats ? JSON.stringify(data.stats) : null,
        }),
      });
      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('[catch]', e.message);
      setSaveStatus('error');
    }
    setSaving(false);
  };

  const handleGenerateAI = async () => {
    if (!onAskAI || !data) return;
    setAiLoading(true);
    const stats = data.stats || {};
    const sessionList = (data.sessions || [])
      .slice(0, 8)
      .map(
        (s) =>
          `- ${s.project_name || 'unknown'}: ${Math.round((s.duration_s || 0) / 60)}min — ${(s.log || '').slice(0, 60)}`
      )
      .join('\n');

    const prompt = `Weekly review for ${formatWeekLabel(weekStart)}.

Stats:
- Sessions: ${stats.sessions || 0} (${stats.session_minutes || 0} min total)
- Training: ${stats.training_count || 0} sessions (${stats.training_minutes || 0} min)
- Outreach: ${stats.outreach_count || 0} actions
- Checkins: ${stats.checkin_days || 0}/7 days | Avg energy: ${stats.avg_energy ?? 'n/a'} | Avg sleep: ${stats.avg_sleep ?? 'n/a'}h
- Staging items completed: ${stats.staging_done || 0}

Sessions this week:
${sessionList || 'None recorded.'}

What shipped: ${shipped || '(not filled yet)'}
What was blocked: ${blocked || '(not filled yet)'}
Next priority: ${nextPri || '(not filled yet)'}

Give a direct weekly review: what the numbers show, patterns you see, and the single most important thing to focus on next week. Max 200 words.`;

    try {
      const result = await onAskAI(prompt);
      if (result) setAiAnalysis(result);
    } catch (e) {
      console.error('[WeeklyReview] AI error:', e);
    }
    setAiLoading(false);
  };

  const stats = data?.stats || {};
  const isCurrentWeek = weekStart === getMonday();

  return (
    <div style={S.wrap}>
      {/* Week navigation */}
      <div style={S.nav}>
        <button style={S.navBtn} onClick={handlePrev}>
          ← Prev
        </button>
        <span style={S.weekLabel}>📋 {formatWeekLabel(weekStart)}</span>
        {!isCurrentWeek && (
          <button style={S.navBtn} onClick={handleThisWeek}>
            This week
          </button>
        )}
        <button
          style={{ ...S.navBtn, opacity: isCurrentWeek ? 0.3 : 1 }}
          onClick={handleNext}
          disabled={isCurrentWeek}
        >
          Next →
        </button>
      </div>

      {loading ? (
        <div style={{ color: C.dim, fontSize: 12 }}>Loading week data...</div>
      ) : (
        <>
          {/* Stats row */}
          <div style={S.statsGrid}>
            <div style={S.statCard}>
              <div style={S.statLabel}>Sessions</div>
              <div style={S.statVal}>{stats.sessions ?? '—'}</div>
              <div style={S.statSub}>
                {stats.session_minutes ?? 0} min total
              </div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Training</div>
              <div
                style={{
                  ...S.statVal,
                  color: (stats.training_count ?? 0) >= 3 ? C.green : C.amber,
                }}
              >
                {stats.training_count ?? '—'}
              </div>
              <div style={S.statSub}>{stats.training_minutes ?? 0} min</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Outreach</div>
              <div
                style={{
                  ...S.statVal,
                  color: (stats.outreach_count ?? 0) >= 5 ? C.green : C.amber,
                }}
              >
                {stats.outreach_count ?? '—'}
              </div>
              <div style={S.statSub}>actions</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Check-ins</div>
              <div style={S.statVal}>
                {stats.checkin_days ?? '—'}
                <span style={{ fontSize: 12, color: C.dim }}>/7</span>
              </div>
              <div style={S.statSub}>days logged</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Avg Energy</div>
              <div style={S.statVal}>{stats.avg_energy ?? '—'}</div>
              <div style={S.statSub}>out of 10</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Avg Sleep</div>
              <div style={S.statVal}>{stats.avg_sleep ?? '—'}</div>
              <div style={S.statSub}>hours/night</div>
            </div>
            <div style={S.statCard}>
              <div style={S.statLabel}>Shipped</div>
              <div style={S.statVal}>{stats.staging_done ?? '—'}</div>
              <div style={S.statSub}>staging items</div>
            </div>
          </div>

          {/* Sessions list */}
          {data?.sessions?.length > 0 && (
            <div style={S.section}>
              <label style={S.label}>Sessions this week</label>
              <div style={S.sessionList}>
                {data.sessions.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      ...S.sessionRow,
                      borderBottom:
                        i < data.sessions.length - 1
                          ? `1px solid ${C.border}`
                          : 'none',
                    }}
                  >
                    <span style={{ color: C.blue, minWidth: 80 }}>
                      {s.project_name || 'unknown'}
                    </span>
                    <span>{Math.round((s.duration_s || 0) / 60)}min</span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {(s.log || '').slice(0, 80)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reflection fields */}
          <div style={S.section}>
            <label style={S.label}>✅ What shipped / was completed</label>
            <textarea
              value={shipped}
              onChange={(e) => setShipped(e.target.value)}
              placeholder="List what actually shipped, was deployed, or completed..."
              style={S.textarea}
            />
          </div>

          <div style={S.section}>
            <label style={S.label}>🚧 What was blocked / didn't move</label>
            <textarea
              value={blocked}
              onChange={(e) => setBlocked(e.target.value)}
              placeholder="What stalled? What kept coming up? What needs a decision?"
              style={S.textarea}
            />
          </div>

          <div style={S.section}>
            <label style={S.label}>🎯 #1 priority next week</label>
            <textarea
              value={nextPri}
              onChange={(e) => setNextPri(e.target.value)}
              placeholder="What is the single most important thing to move next week?"
              style={{ ...S.textarea, minHeight: 50 }}
            />
          </div>

          {/* AI Analysis */}
          <div style={S.section}>
            <label style={S.label}>🤖 AI analysis</label>
            {aiAnalysis ? (
              <div style={S.aiBox}>{aiAnalysis}</div>
            ) : (
              <div style={{ ...S.aiBox, color: C.dim, fontSize: 11 }}>
                No analysis yet. Fill in the reflection fields and click
                Generate.
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={S.btnRow}>
            <button
              style={S.btn('ghost')}
              onClick={handleGenerateAI}
              disabled={aiLoading || !onAskAI}
            >
              {aiLoading ? 'Generating...' : '🤖 Generate AI Review'}
            </button>
            <button
              style={S.btn('primary')}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save Review'}
            </button>
            {saveStatus && (
              <span style={S.status(saveStatus === 'saved')}>
                {saveStatus === 'saved' ? '✓ Saved' : '✗ Save failed'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
