import { getFileType } from './fileHandlers.js';

// ── MARKDOWN + GANTT ──────────────────────────────────────────
export const renderMd = (md = '', files = {}) => {
  if (!md) return '';
  let html = md;
  // Extract mermaid blocks before other processing
  const mermaidBlocks = [];
  html = html.replace(/```mermaid\n([\s\S]*?)```/g, (match, content) => {
    const id = `mermaid-block-${mermaidBlocks.length}`;
    mermaidBlocks.push({ id, content: content.trim() });
    return `<div class="mermaid-placeholder" data-id="${id}"></div>`;
  });
  // Store mermaid blocks globally for React component to pick up
  if (typeof window !== 'undefined') {
    window.__mermaidBlocks = window.__mermaidBlocks || {};
    mermaidBlocks.forEach((b) => {
      window.__mermaidBlocks[b.id] = b.content;
    });
  }
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imgPath) => {
    const fileContent = files[imgPath];
    if (fileContent && getFileType(imgPath) === 'image') {
      const src = fileContent.startsWith('data:')
        ? fileContent
        : `data:image/png;base64,${fileContent}`;
      return `<img src="${src}" alt="${alt}" style="max-width:100%; max-height:400px; border-radius:4px; margin:8px 0;" />`;
    }
    return `[image: ${alt}]`;
  });
  return html
    .replace(
      /^### (.+)$/gm,
      "<h3 style='color:#e2e8f0;font-size:13px;margin:12px 0 6px'>$1</h3>"
    )
    .replace(
      /^## (.+)$/gm,
      "<h2 style='color:#f1f5f9;font-size:15px;margin:16px 0 8px;border-bottom:1px solid #0f1e3a;padding-bottom:4px'>$1</h2>"
    )
    .replace(
      /^# (.+)$/gm,
      "<h1 style='color:#f1f5f9;font-size:18px;margin:0 0 16px;font-weight:700'>$1</h1>"
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong style='color:#e2e8f0'>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      "<code style='background:#0d1424;border:1px solid #1e293b;padding:1px 5px;border-radius:3px;font-size:11px;color:#10b981'>$1</code>"
    )
    .replace(
      /^- \[x\] (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#10b981'>✅</span><span>$1</span></div>"
    )
    .replace(
      /^- \[ \] (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#334155'>⬜</span><span style='color:#94a3b8'>$1</span></div>"
    )
    .replace(
      /^- (.+)$/gm,
      "<div style='display:flex;gap:6px;padding:2px 0'><span style='color:#1a4fd6'>·</span><span>$1</span></div>"
    )
    .replace(/^\| (.+) \|$/gm, (row) => {
      const cells = row.slice(2, -2).split(' | ');
      if (cells.every((c) => c.match(/^[-:]+$/))) return '';
      return `<div style='display:flex;border-bottom:1px solid #0f1e3a'>${cells.map((c) => `<div style='flex:1;padding:4px 8px;font-size:10px;color:#94a3b8'>${c}</div>`).join('')}</div>`;
    })
    .replace(
      /^> (.+)$/gm,
      "<blockquote style='border-left:3px solid #1a4fd6;margin:8px 0;padding:6px 12px;color:#94a3b8;font-style:italic'>$1</blockquote>"
    )
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
};

export const parseTasks = (md) => {
  const rows = [];
  md?.split('\n').forEach((line) => {
    const m = line.match(
      /[-*]\s+\[(.)\]\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s*(?:→|-|to)\s*(\d{4}-\d{2}-\d{2})/
    );
    if (m)
      rows.push({ done: m[1] === 'x', label: m[2], start: m[3], end: m[4] });
  });
  return rows;
};
