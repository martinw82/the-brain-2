/**
 * DailyCheckinModal Component - Phase 2.5
 * Quick check-in form for user state (energy, sleep, gut, training)
 * Appears once per day on first visit
 */

import { useState } from "react";

const C = {
  bg: "#0f172a",
  bgModal: "#1a1f36",
  border: "#1e293b",
  text: "#e2e8f0",
  dim: "#94a3b8",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

const S = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: C.bgModal,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: 24,
    maxWidth: 450,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  header: {
    fontSize: 16,
    fontWeight: 600,
    color: C.text,
    marginBottom: 20,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 11,
    color: C.blue,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
    display: "block",
  },
  sliderContainer: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 4,
    background: C.border,
    borderRadius: 2,
    outline: "none",
    cursor: "pointer",
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: 600,
    color: C.blue,
    minWidth: 40,
    textAlign: "right",
  },
  numberInput: {
    width: 80,
    padding: "6px 8px",
    background: C.border,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 10,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  checkboxInput: {
    width: 18,
    height: 18,
    cursor: "pointer",
  },
  checkboxLabel: {
    fontSize: 11,
    color: C.text,
    cursor: "pointer",
    userSelect: "none",
  },
  textarea: {
    width: "100%",
    padding: 8,
    background: C.border,
    border: `1px solid ${C.border}`,
    borderRadius: 4,
    color: C.text,
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    resize: "vertical",
    minHeight: 60,
  },
  footer: {
    display: "flex",
    gap: 8,
    marginTop: 20,
    justifyContent: "flex-end",
  },
  btn: (type = "primary") => ({
    primary: {
      background: C.blue,
      color: "white",
      border: "none",
      borderRadius: 4,
      padding: "8px 16px",
      fontSize: 10,
      fontWeight: 600,
      cursor: "pointer",
      transition: "opacity 0.2s",
    },
    ghost: {
      background: "transparent",
      border: `1px solid ${C.border}`,
      color: C.dim,
      borderRadius: 4,
      padding: "8px 16px",
      fontSize: 10,
      cursor: "pointer",
    },
  })[type],
  stateEmoji: (energy) => {
    if (energy <= 4) return "🌙";
    if (energy <= 7) return "🔄";
    return "⚡";
  },
  stateLabel: (energy) => {
    if (energy <= 4) return "Recovery day";
    if (energy <= 7) return "Steady work";
    return "Power day";
  },
};

export default function DailyCheckinModal({ onSave, onDismiss, lastCheckin }) {
  const [sleepHours, setSleepHours] = useState(
    lastCheckin?.sleep_hours || 7
  );
  const [energyLevel, setEnergyLevel] = useState(
    lastCheckin?.energy_level || 5
  );
  const [gutSymptoms, setGutSymptoms] = useState(
    lastCheckin?.gut_symptoms || 3
  );
  const [trainingDone, setTrainingDone] = useState(
    lastCheckin?.training_done || false
  );
  const [notes, setNotes] = useState(lastCheckin?.notes || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const checkin = {
        date: today,
        sleep_hours: sleepHours,
        energy_level: energyLevel,
        gut_symptoms: gutSymptoms,
        training_done: trainingDone ? 1 : 0,
        notes: notes.trim() || null,
      };
      await onSave(checkin);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onDismiss}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>How are you doing today?</div>

        {/* Sleep */}
        <div style={S.section}>
          <label style={S.label}>😴 Sleep last night</label>
          <div style={S.sliderContainer}>
            <input
              type="number"
              min="0"
              max="24"
              value={sleepHours}
              onChange={(e) => setSleepHours(Math.max(0, Math.min(24, parseInt(e.target.value) || 0)))}
              style={S.numberInput}
            />
            <span style={{ fontSize: 10, color: C.dim }}>hours</span>
          </div>
        </div>

        {/* Energy Level */}
        <div style={S.section}>
          <label style={S.label}>⚡ Energy level</label>
          <div style={S.sliderContainer}>
            <input
              type="range"
              min="0"
              max="10"
              value={energyLevel}
              onChange={(e) => setEnergyLevel(parseInt(e.target.value))}
              style={S.slider}
            />
            <span style={S.sliderValue}>{energyLevel}/10</span>
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
            {S.stateEmoji(energyLevel)} {S.stateLabel(energyLevel)}
          </div>
        </div>

        {/* Gut Symptoms */}
        <div style={S.section}>
          <label style={S.label}>🫀 Gut status</label>
          <div style={S.sliderContainer}>
            <input
              type="range"
              min="0"
              max="10"
              value={gutSymptoms}
              onChange={(e) => setGutSymptoms(parseInt(e.target.value))}
              style={S.slider}
            />
            <span style={S.sliderValue}>{gutSymptoms}/10</span>
          </div>
          <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
            {gutSymptoms <= 3
              ? "👍 Good"
              : gutSymptoms <= 6
                ? "🤷 Neutral"
                : "🤢 Struggling"}
          </div>
        </div>

        {/* Training */}
        <div style={S.section}>
          <label style={S.checkbox}>
            <input
              type="checkbox"
              checked={trainingDone}
              onChange={(e) => setTrainingDone(e.target.checked)}
              style={S.checkboxInput}
            />
            <span style={S.checkboxLabel}>Did I train today?</span>
          </label>
        </div>

        {/* Notes */}
        <div style={S.section}>
          <label style={S.label}>📝 Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Good sleep, had morning run, ready to ship"
            style={S.textarea}
          />
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btn("ghost")} onClick={onDismiss} disabled={isLoading}>
            Skip
          </button>
          <button
            style={S.btn("primary")}
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "✓ Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
