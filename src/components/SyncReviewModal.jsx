/**
 * SyncReviewModal Component - Phase 2.4B
 * Modal for reviewing sync changes and resolving conflicts before applying
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
    background: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    background: C.bgModal,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: 20,
    maxWidth: 600,
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
  },
  header: {
    fontSize: 14,
    fontWeight: 600,
    color: C.text,
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  summary: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr",
    gap: 12,
    marginBottom: 16,
    padding: 12,
    background: `${C.border}`,
    borderRadius: 4,
  },
  summaryItem: {
    textAlign: "center",
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: 600,
    color: C.blue,
  },
  summaryLabel: {
    fontSize: 8,
    color: C.dim,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 9,
    color: C.blue,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: `1px solid ${C.border}`,
  },
  fileItem: {
    padding: 8,
    marginBottom: 6,
    background: C.border,
    borderRadius: 3,
    fontSize: 9,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 12,
    minWidth: 16,
  },
  filePath: {
    flex: 1,
    color: C.text,
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  conflictItem: {
    padding: 8,
    marginBottom: 8,
    background: `${C.red}10`,
    border: `1px solid ${C.red}40`,
    borderRadius: 3,
  },
  conflictHeader: {
    fontSize: 9,
    fontWeight: 600,
    color: C.red,
    marginBottom: 6,
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  conflictChoice: {
    display: "flex",
    gap: 4,
    marginTop: 6,
  },
  btn: (type = "primary") => ({
    primary: {
      background: C.blue,
      color: "white",
      border: "none",
      borderRadius: 4,
      padding: "6px 12px",
      fontSize: 9,
      cursor: "pointer",
      fontWeight: 500,
    },
    danger: {
      background: C.red,
      color: "white",
      border: "none",
      borderRadius: 4,
      padding: "6px 12px",
      fontSize: 9,
      cursor: "pointer",
      fontWeight: 500,
    },
    ghost: {
      background: "transparent",
      border: `1px solid ${C.border}`,
      color: C.text,
      borderRadius: 4,
      padding: "6px 12px",
      fontSize: 9,
      cursor: "pointer",
    },
    small: {
      background: "transparent",
      border: `1px solid ${C.border}`,
      color: C.dim,
      borderRadius: 3,
      padding: "3px 6px",
      fontSize: 8,
      cursor: "pointer",
    },
  })[type],
  footer: {
    display: "flex",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTop: `1px solid ${C.border}`,
    justifyContent: "flex-end",
  },
};

export default function SyncReviewModal({
  changes,
  conflicts,
  onApprove,
  onCancel,
}) {
  const [conflictResolutions, setConflictResolutions] = useState({});

  if (!changes) return null;

  const { added = [], modified = [], deleted = [], details = {} } = changes;
  const totalFiles = (added?.length || 0) + (modified?.length || 0);

  const handleResolveConflict = (filePath, resolution) => {
    setConflictResolutions((prev) => ({
      ...prev,
      [filePath]: resolution,
    }));
  };

  const canApprove = !conflicts || conflicts.length === 0 ||
    Object.keys(conflictResolutions).length === conflicts.length;

  const handleApprove = () => {
    onApprove(conflictResolutions);
  };

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <span>🔄 Review Sync Changes</span>
          <span
            style={{ cursor: "pointer", marginLeft: "auto", fontSize: 16 }}
            onClick={onCancel}
          >
            ×
          </span>
        </div>

        {/* Summary */}
        <div style={S.summary}>
          <div style={S.summaryItem}>
            <div style={S.summaryCount}>{added?.length || 0}</div>
            <div style={S.summaryLabel}>New</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryCount}>{modified?.length || 0}</div>
            <div style={S.summaryLabel}>Modified</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryCount}>{deleted?.length || 0}</div>
            <div style={S.summaryLabel}>Deleted</div>
          </div>
          <div style={S.summaryItem}>
            <div style={S.summaryCount}>{conflicts?.length || 0}</div>
            <div style={S.summaryLabel}>Conflicts</div>
          </div>
        </div>

        {/* Added Files */}
        {added && added.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionHeader}>➕ New Files</div>
            {added.map((file) => (
              <div key={file.path} style={S.fileItem}>
                <span style={S.icon}>➕</span>
                <span style={S.filePath}>{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {/* Modified Files */}
        {modified && modified.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionHeader}>✏️ Modified Files</div>
            {modified.map((file) => (
              <div key={file.path} style={S.fileItem}>
                <span style={S.icon}>✏️</span>
                <span style={S.filePath}>{file.path}</span>
              </div>
            ))}
          </div>
        )}

        {/* Deleted Files */}
        {deleted && deleted.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionHeader}>❌ Deleted Files</div>
            {deleted.map((path) => (
              <div key={path} style={S.fileItem}>
                <span style={S.icon}>❌</span>
                <span style={S.filePath}>{path}</span>
              </div>
            ))}
          </div>
        )}

        {/* Conflicts */}
        {conflicts && conflicts.length > 0 && (
          <div style={S.section}>
            <div style={S.sectionHeader}>⚠️ Conflicts ({conflicts.length})</div>
            {conflicts.map((conflict) => (
              <div key={conflict.path} style={S.conflictItem}>
                <div style={S.conflictHeader}>
                  <span>⚠️ {conflict.path}</span>
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: C.dim,
                    marginBottom: 6,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: C.blue,
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      Desktop:
                    </div>
                    <div>Modified {new Date(conflict.desktopModified).toLocaleString()}</div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: C.green,
                        fontWeight: 600,
                        marginBottom: 2,
                      }}
                    >
                      Cloud:
                    </div>
                    <div>Modified {new Date(conflict.cloudModified).toLocaleString()}</div>
                  </div>
                </div>
                <div style={S.conflictChoice}>
                  <button
                    style={{
                      ...S.btn("small"),
                      borderColor: C.blue,
                      color: conflictResolutions[conflict.path] === "desktop" ? C.blue : C.dim,
                    }}
                    onClick={() =>
                      handleResolveConflict(conflict.path, "desktop")
                    }
                  >
                    💻 Use Desktop
                  </button>
                  <button
                    style={{
                      ...S.btn("small"),
                      borderColor: C.green,
                      color: conflictResolutions[conflict.path] === "cloud" ? C.green : C.dim,
                    }}
                    onClick={() =>
                      handleResolveConflict(conflict.path, "cloud")
                    }
                  >
                    ☁️ Use Cloud
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btn("ghost")} onClick={onCancel}>
            Cancel
          </button>
          <button
            style={{
              ...S.btn("primary"),
              opacity: canApprove ? 1 : 0.5,
              cursor: canApprove ? "pointer" : "not-allowed",
            }}
            onClick={handleApprove}
            disabled={!canApprove}
          >
            ✓ Approve Sync
          </button>
        </div>
      </div>
    </div>
  );
}
