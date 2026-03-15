import { getBehavior } from '../modeHelper.js';

const AICoach = ({
  currentMode,
  aiIn,
  setAiIn,
  aiLoad,
  aiOut,
  aiRef,
  askAI,
  renderAIResponse,
  projectsById,
  uriToNavigation,
  openHub,
  openFile,
  projects,
  setShowGoalModal,
  S,
  C,
}) => {
  return (
    <div>
      <div style={S.card(false)}>
        <span style={S.label()}>💬 AI Coach</span>
        {getBehavior('ai_coach_tab', currentMode) === 'full' && (
          <div
            style={{
              display: 'flex',
              gap: 5,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            {[
              'What should I work on today?',
              'Where am I looping?',
              'Thailand income path?',
              'Triage staging',
              'Rank by revenue potential',
              'Which project is dying?',
            ].map((p) => (
              <button
                key={p}
                style={S.btn('ghost')}
                onClick={() => askAI(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            style={S.input}
            value={aiIn}
            placeholder="Ask anything..."
            onChange={(e) => setAiIn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && aiIn.trim()) {
                askAI(aiIn);
                setAiIn('');
              }
            }}
          />
          <button
            style={S.btn('primary')}
            onClick={() => {
              if (aiIn.trim()) {
                askAI(aiIn);
                setAiIn('');
              }
            }}
            disabled={aiLoad}
          >
            Ask
          </button>
        </div>
      </div>
      {(aiLoad || aiOut) && (
        <div ref={aiRef} style={{ ...S.card(true, C.green) }}>
          <span style={S.label(C.green)}>Response</span>
          {aiLoad ? (
            <div style={{ fontSize: 10, color: C.dim }}>Thinking...</div>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: C.text,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
              }}
            >
              {renderAIResponse(aiOut, projectsById, (uri) => {
                const nav = uriToNavigation(uri);
                if (!nav) return;
                if (nav.type === 'OPEN_PROJECT' || nav.type === 'OPEN_FILE') {
                  const proj = projects.find(
                    (p) => p.id === nav.params.projectId
                  );
                  if (proj) {
                    openHub(proj);
                    if (nav.params.filePath) {
                      setTimeout(() => openFile(nav.params.filePath), 100);
                    }
                  }
                } else if (nav.type === 'OPEN_GOAL') {
                  setShowGoalModal(true);
                }
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AICoach;