import { C } from '../utils/constants.js';

const ProgressTrends = ({ title, data, color = C.blue, unit = '' }) => {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;

  return (
    <div
      style={{
        padding: 12,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.blue,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: 60,
          paddingBottom: 4,
        }}
      >
        {data.map((d, i) => {
          const height = ((d.value - min) / range) * 100;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(4, height)}%`,
                  background: color,
                  borderRadius: 2,
                  opacity: 0.7 + (i / data.length) * 0.3,
                  minHeight: 4,
                }}
                title={`${d.label}: ${d.value}${unit}`}
              />
              <div
                style={{
                  fontSize: 8,
                  color: C.muted,
                  transform: 'rotate(-45deg)',
                  transformOrigin: 'top left',
                }}
              >
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProgressTrends;
