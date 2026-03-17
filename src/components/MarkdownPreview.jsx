import { useState, useEffect } from 'react';
import C from '../utils/constants.js';
import { renderMd } from '../utils/renderers.js';
import MermaidRenderer from './MermaidRenderer.jsx';

// ── MARKDOWN PREVIEW WITH MERMAID (Phase 3.2) ───────────────
const MarkdownPreview = ({ content, files }) => {
  const [parts, setParts] = useState([]);

  useEffect(() => {
    if (!content) {
      setParts([]);
      return;
    }

    // Split content by mermaid blocks
    const segments = [];
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let blockIndex = 0;

    while ((match = mermaidRegex.exec(content)) !== null) {
      // Add text before this mermaid block
      if (match.index > lastIndex) {
        segments.push({
          type: 'html',
          content: content.slice(lastIndex, match.index),
        });
      }
      // Add mermaid block
      segments.push({
        type: 'mermaid',
        content: match[1].trim(),
        id: `mmd-${blockIndex++}`,
      });
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      segments.push({ type: 'html', content: content.slice(lastIndex) });
    }

    // Render markdown for HTML segments
    const renderedParts = segments.map((seg) => ({
      ...seg,
      html: seg.type === 'html' ? renderMd(seg.content, files) : null,
    }));

    setParts(renderedParts);
  }, [content, files]);

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '14px 20px',
        background: '#050810',
        fontSize: 12,
        lineHeight: 1.8,
        color: C.text,
      }}
    >
      {parts.map((part, idx) =>
        part.type === 'html' ? (
          <div key={idx} dangerouslySetInnerHTML={{ __html: part.html }} />
        ) : (
          <MermaidRenderer key={idx} chart={part.content} id={part.id} />
        )
      )}
    </div>
  );
};

export default MarkdownPreview;
