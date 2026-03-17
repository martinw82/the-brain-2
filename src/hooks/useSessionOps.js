import { ideas as ideasApi, sessions as sessionsApi, token } from '../api.js';

/**
 * Hook for ideas, session end, daily checkin, training log, outreach log.
 */
export default function useSessionOps(deps) {
  const {
    setIdeas,
    setNewIdea,
    projects,
    focusId,
    sessionSecs,
    sessionLog,
    sessionStart,
    setSessionOn,
    setSessionSecs,
    setSessionLog,
    setTodayCheckin,
    setCheckinLastDate,
    setShowCheckinModal,
    setWeeklyTraining,
    setShowTrainingModal,
    todayCheckin,
    setTodayOutreach,
    setWeeklyOutreach,
    setShowOutreachModal,
    saveFile,
    fmtTime,
    showToast,
  } = deps;

  const addIdea = async (title) => {
    if (!title.trim()) return;
    const tmp = {
      id: `tmp-${Date.now()}`,
      title: title.trim(),
      score: 5,
      tags: ['new'],
      added: new Date().toISOString().slice(0, 7),
    };
    setIdeas((prev) => [...prev, tmp]);
    setNewIdea('');
    try {
      const res = await ideasApi.create({
        title: title.trim(),
        score: 5,
        tags: ['new'],
      });
      setIdeas((prev) =>
        prev.map((i) => (i.id === tmp.id ? { ...i, id: res.id } : i))
      );
    } catch {
      showToast('⚠ Idea save failed');
    }
  };

  const endSession = async () => {
    const dur = sessionSecs,
      log = sessionLog;
    if (log.trim()) {
      const entry = `\n## ${new Date().toISOString().slice(0, 10)} — ${fmtTime(dur)}\n\n${log}\n`;
      const proj = projects.find((p) => p.id === focusId);
      if (proj) {
        const current = (proj.files || {})['DEVLOG.md'] || '';
        await saveFile(focusId, 'DEVLOG.md', current + entry);
      }
    }
    // Only log session if there was actual time recorded and a project in focus
    if (dur > 0 && focusId) {
      await sessionsApi
        .create({
          project_id: focusId,
          duration_s: dur,
          log,
          started_at: sessionStart.current?.toISOString(),
          ended_at: new Date().toISOString(),
        })
        .catch(() => {});
    }
    setSessionOn(false);
    setSessionSecs(0);
    setSessionLog('');
  };

  const saveCheckin = async (checkin) => {
    try {
      const res = await fetch(`/api/data?resource=daily-checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(checkin),
      });
      if (!res.ok) throw new Error('Save failed');
      setTodayCheckin(checkin);
      const today = new Date().toISOString().split('T')[0];
      setCheckinLastDate(today);
      localStorage.setItem('lastCheckinDate', today);
      setShowCheckinModal(false);
      showToast('✓ Check-in saved');
    } catch (e) {
      console.error('Checkin save error:', e);
      showToast('⚠ Failed to save check-in');
    }
  };

  const loadWeeklyTraining = async () => {
    try {
      const res = await fetch(`/api/data?resource=training-logs&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      setWeeklyTraining({
        count: logs.length,
        minutes: logs.reduce((s, l) => s + (l.duration_minutes || 0), 0),
      });
    } catch (e) {
      console.error('Training load error:', e);
    }
  };

  const saveTraining = async (log) => {
    try {
      const res = await fetch(`/api/data?resource=training-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowTrainingModal(false);
      showToast('🥋 Training logged');
      loadWeeklyTraining();
      if (todayCheckin && !todayCheckin.training_done) {
        const updated = { ...todayCheckin, training_done: 1 };
        try {
          await fetch(`/api/data?resource=daily-checkins`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token.get()}`,
            },
            body: JSON.stringify({
              ...updated,
              date: new Date().toISOString().split('T')[0],
            }),
          });
          setTodayCheckin(updated);
        } catch {
          // Non-critical: checkin training_done update failed, ignore
        }
      }
    } catch (e) {
      console.error('Training save error:', e);
      showToast('⚠ Failed to log training');
    }
  };

  const loadTodayOutreach = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/data?resource=outreach-log&date=${today}`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTodayOutreach(data.logs || []);
      const wRes = await fetch(`/api/data?resource=outreach-log&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (wRes.ok) {
        const wData = await wRes.json();
        setWeeklyOutreach((wData.logs || []).length);
      }
    } catch (e) {
      console.error('Outreach load error:', e);
    }
  };

  const saveOutreach = async (entry) => {
    try {
      const res = await fetch(`/api/data?resource=outreach-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowOutreachModal(false);
      showToast('📣 Outreach logged');
      loadTodayOutreach();
    } catch (e) {
      console.error('Outreach save error:', e);
      showToast('⚠ Failed to log outreach');
    }
  };

  return {
    addIdea,
    endSession,
    saveCheckin,
    loadWeeklyTraining,
    saveTraining,
    loadTodayOutreach,
    saveOutreach,
  };
}
