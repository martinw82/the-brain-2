import { C } from '../utils/constants.js';

const GanttChart = ({ tasks }) => {
  const rows = tasks.filter((t) => t.start && t.end);
  if (!rows.length)
    return (
      <div style={{ color: C.muted, fontSize: 10, padding: '12px 0' }}>
        Format:{' '}
        <code style={{ color: C.green }}>
          - [ ] Task 2025-01-01 → 2025-01-14
        </code>
      </div>
    );
  const allD = rows.flatMap((r) => [new Date(r.start), new Date(r.end)]);
  const minD = new Date(Math.min(...allD));
  const maxD = new Date(Math.max(...allD));
  const range = maxD - minD || 1;
  return (
    <div style={{ overflowX: 'auto' }}>
      {rows.map((r, i) => {
        const left = ((new Date(r.start) - minD) / range) * 100;
        const width = ((new Date(r.end) - new Date(r.start)) / range) * 100;
        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <div
              style={{
                width: 140,
                fontSize: 10,
                color: C.text,
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {r.label}
            </div>
            <div
              style={{
                flex: 1,
                height: 16,
                background: C.border,
                borderRadius: 3,
                position: 'relative',
                minWidth: 200,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  width: `${Math.max(width, 2)}%`,
                  height: '100%',
                  background: r.done ? C.green : C.blue,
                  borderRadius: 3,
                  opacity: 0.85,
                }}
              />
            </div>
          </div>
        );
      })}{' '}
    </div>
  );
};

export default GanttChart;
