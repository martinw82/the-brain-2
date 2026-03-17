import React from 'react';
import { parseURI, extractURIs, resolveLabel } from '../uri.js';

// ── URI LINK RENDERER (Phase 5.1) ────────────────────────────
const URILink = ({ uri, label, onNavigate }) => {
  const parsed = parseURI(uri);
  if (!parsed) return <span>{uri}</span>;

  const handleClick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (onNavigate) onNavigate(uri);
    }
  };

  const displayLabel = label || resolveLabel(uri);

  return (
    <span
      style={{
        color: '#3b82f6',
        textDecoration: 'underline',
        cursor: 'pointer',
        fontSize: '10px',
        fontFamily: "'JetBrains Mono',monospace",
        padding: '1px 4px',
        borderRadius: '3px',
        background: '#1a4fd620',
      }}
      onClick={handleClick}
      title={`${uri} (Cmd/Ctrl+Click to navigate)`}
    >
      {displayLabel}
    </span>
  );
};

export const renderAIResponse = (text, projects = {}, onNavigate) => {
  if (!text) return <span>{text}</span>;

  const uris = extractURIs(text);
  if (uris.length === 0) return <span>{text}</span>;

  const parts = [];
  let lastIndex = 0;

  uris.forEach((uri) => {
    const index = text.indexOf(uri, lastIndex);
    if (index > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>{text.slice(lastIndex, index)}</span>
      );
    }
    parts.push(<URILink key={uri + index} uri={uri} onNavigate={onNavigate} />);
    lastIndex = index + uri.length;
  });

  if (lastIndex < text.length) {
    parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
  }

  return <span>{parts}</span>;
};

export default URILink;
