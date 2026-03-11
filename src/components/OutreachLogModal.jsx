/**
 * OutreachLogModal Component - Phase 2.7
 * Quick-log an outreach action: type, target, project link, notes
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
  purple: "#6366f1",
};

const TYPES = [
  { id: "message", label: "Message / DM", emoji: "💬" },
  { id: "post", label: "Post / Thread", emoji: "📣" },
  { id: "call", label: "Call / Meeting", emoji: "📞" },
  { id: "email", label: "Email", emoji: "📧" },
  { id: "other", label: "Other", emoji: "🤝" },
];

const S = {
  overlay: {
    position: "fixed",
    top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0, 0, 0, 0.7)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: C.bgModal,
    border: `1px solid ${C.border}`,
    borderRadius: 8, padding: 24, maxWidth: 450, width: "90%",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  header: { fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 20 },
  section: { marginBottom: 16 },
  label: {
    fontSize: 11, color: C.purple, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em",
    marginBottom: 6, display: "block",
  },
  typeGrid: { display: "flex", gap: 6, flexWrap: "wrap" },
  typeBtn: (active) => ({
    padding: "6px 12px", borderRadius: 4,
    border: `1px solid ${active ? C.purple : C.border}`,
    background: active ? C.purple + "20" : "transparent",
    color: active ? C.purple : C.dim,
    fontSize: 10, fontWeight: active ? 600 : 400, cursor: "pointer",
  }),
  input: {
    width: "100%", padding: "7px 10px",
    background: "#0d1424", border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace", outline: "none",
    boxSizing: "border-box",
  },
  sel: {
    width: "100%", padding: "7px 10px",
    background: "#0d1424", border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace", outline: "none",
  },
  textarea: {
    width: "100%", padding: 8,
    background: C.border, border: `1px solid ${C.border}`,
    borderRadius: 4, color: C.text, fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    resize: "vertical", minHeight: 50, boxSizing: "border-box",
  },
  footer: { display: "flex", gap: 8, marginTop: 20, justifyContent: "flex-end" },
  btn: (type = "primary") => ({
    primary: {
      background: C.purple, color: "white", border: "none",
      borderRadius: 4, padding: "8px 16px", fontSize: 10,
      fontWeight: 600, cursor: "pointer",
    },
    ghost: {
      background: "transparent", border: `1px solid ${C.border}`,
      color: C.dim, borderRadius: 4, padding: "8px 16px",
      fontSize: 10, cursor: "pointer",
    },
  })[type],
};

export default function OutreachLogModal({ onSave, onDismiss, projects = [] }) {
  const [type, setType] = useState("message");
  const [target, setTarget] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await onSave({
        date: today,
        type,
        target: target.trim() || null,
        project_id: projectId || null,
        notes: notes.trim() || null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={S.overlay} onClick={onDismiss}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.header}>📣 Log Outreach</div>

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

        {/* Target */}
        <div style={S.section}>
          <label style={S.label}>📍 Who / Where (optional)</label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="@handle, platform, person's name..."
            style={S.input}
          />
        </div>

        {/* Project link */}
        {projects.length > 0 && (
          <div style={S.section}>
            <label style={S.label}>🗂 Related project (optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={S.sel}
            >
              <option value="">— none —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div style={S.section}>
          <label style={S.label}>📝 Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Context, response, follow-up needed..."
            style={S.textarea}
          />
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btn("ghost")} onClick={onDismiss} disabled={isLoading}>
            Cancel
          </button>
          <button style={S.btn("primary")} onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "📣 Log Outreach"}
          </button>
        </div>
      </div>
    </div>
  );
}
