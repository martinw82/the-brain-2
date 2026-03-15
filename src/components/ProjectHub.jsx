import { useState } from 'react';
import { C, S } from '../TheBrain.jsx';
import QuickTagRow from './QuickTagRow.jsx';
import HealthBar from './HealthBar.jsx';
import BadgeStatus from './BadgeStatus.jsx';
import Dots from './Dots.jsx';

const ProjectHub = ({
  projects,
  openHub,
  exportProject,
  setModal,
  setShowImportModal,
  S,
  C
}) => {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          style={S.btn('primary')}
          onClick={() => setModal('new-project')}
        >
          + New Project
        </button>
        <button
          style={S.btn('ghost')}
          onClick={() => setShowImportModal(true)}
        >
          ⬆ Import
        </button>
      </div>
      {projects.map((p) => (
        <div key={p.id} style={S.card(false)}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 18 }}>{p.emoji}</span>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#f1f5f9',
                  }}
                >
                  {p.name}
                </div>
                <div style={{ fontSize: 8, color: C.muted }}>
                  {p.phase} · #{p.priority} · {p.lastTouched}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 5,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <HealthBar score={p.health} />
              <Dots n={p.momentum} />
              <BadgeStatus status={p.status} />
              <button
                style={{ ...S.btn('success'), fontSize: 9 }}
                onClick={() => openHub(p.id)}
              >
                🗂 Hub
              </button>
              <button
                style={{ ...S.btn('ghost'), fontSize: 9 }}
                onClick={() => exportProject(p.id)}
              >
                ⬇
              </button>
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              color: C.muted,
              lineHeight: 1.5,
              marginBottom: 4,
            }}
          >
            {p.desc}
          </div>
          <div style={{ fontSize: 10, color: C.green }}>
            → {p.nextAction}
          </div>
          <QuickTagRow entityType="project" entityId={p.id} />
        </div>
      ))}
      {projects.length === 0 && (
        <div
          style={{
            fontSize: 11,
            color: C.dim,
            textAlign: 'center',
            padding: '40px 0',
          }}
        >
          No projects yet. Create your first one above.
        </div>
      )}
    </div>
  );
};

export default ProjectHub;