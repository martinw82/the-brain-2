import { C } from '../../utils/constants.js';
import { Modal } from '../UI/SmallComponents.jsx';

export const SHORTCUTS = {
  global: [
    { key: '⌘K / Ctrl+K', description: 'Search across projects' },
    { key: '⌘? / Ctrl+?', description: 'Show keyboard shortcuts' },
    { key: '⌘B / Ctrl+B', description: 'Toggle Brain/Hub view' },
    { key: 'Esc', description: 'Close modals / exit search' },
  ],
  editor: [
    { key: '⌘S / Ctrl+S', description: 'Save file immediately' },
    { key: '⌘Z / Ctrl+Z', description: 'Undo last edit' },
    { key: '⌘⇧Z / Ctrl+Y', description: 'Redo' },
    { key: '⌘P / Ctrl+P', description: 'Toggle Preview mode' },
    { key: '⌘⇧F / Ctrl+Shift+F', description: 'Search in file' },
  ],
  navigation: [
    { key: 'G then C', description: 'Go to Command Centre' },
    { key: 'G then P', description: 'Go to Projects' },
    { key: 'G then S', description: 'Go to Staging' },
    { key: 'G then I', description: 'Go to Ideas' },
  ],
  actions: [
    { key: 'N then P', description: 'New Project' },
    { key: 'N then F', description: 'New File' },
    { key: 'N then I', description: 'New Idea' },
    { key: 'Space', description: 'Start/Stop session timer' },
  ],
};

const KeyboardShortcutsModal = ({ onClose }) => (
  <Modal title="⌨️ Keyboard Shortcuts" onClose={onClose} width={500}>
    <div style={{ display: 'grid', gap: 20 }}>
      {Object.entries(SHORTCUTS).map(([category, shortcuts]) => (
        <div key={category}>
          <div
            style={{
              fontSize: 10,
              color: C.blue,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            {category}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {shortcuts.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: C.text }}>
                  {s.description}
                </span>
                <kbd
                  style={{
                    fontFamily: C.mono,
                    fontSize: 10,
                    padding: '2px 8px',
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    color: C.blue2,
                    minWidth: 80,
                    textAlign: 'center',
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
    <div
      style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
        fontSize: 9,
        color: C.muted,
      }}
    >
      Tip: Press ? anytime to open this cheat sheet
    </div>
  </Modal>
);

export default KeyboardShortcutsModal;
