import { useState, useRef, useEffect } from 'react';
import { sanitizeSvg } from '../utils/sanitize.js';

// ── MERMAID RENDERER (Phase 3.2) ────────────────────────────
const MermaidRenderer = ({ chart, id }) => {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!chart || !window.mermaid) return;

    const renderChart = async () => {
      try {
        // Generate unique ID if not provided
        const uniqueId =
          id || `mermaid-${Math.random().toString(36).slice(2, 11)}`;

        // Configure mermaid with dark theme
        window.mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#1a4fd620',
            primaryTextColor: '#e2e8f0',
            primaryBorderColor: '#1a4fd6',
            lineColor: '#3b82f6',
            secondaryColor: '#0f172a',
            tertiaryColor: '#1e293b',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '12px',
          },
          flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true },
        });

        const { svg: renderedSvg } = await window.mermaid.render(
          uniqueId,
          chart
        );
        setSvg(renderedSvg);
        setError(null);
      } catch (e) {
        console.error('Mermaid render error:', e);
        setError(e.message || 'Failed to render diagram');
        setSvg('');
      }
    };

    renderChart();
  }, [chart, id]);

  if (error) {
    return (
      <div
        style={{
          padding: '12px',
          background: '#1a0f0f',
          border: '1px solid #dc2626',
          borderRadius: 6,
          color: '#ef4444',
          fontSize: 11,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Diagram Error</div>
        <div style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        margin: '12px 0',
        overflow: 'auto',
        background: '#0a0f14',
        borderRadius: 6,
        padding: 12,
        border: '1px solid #1e293b',
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  );
};

export default MermaidRenderer;
