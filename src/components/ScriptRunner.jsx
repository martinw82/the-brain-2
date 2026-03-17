import React, { useState, useEffect } from 'react';
import { C, S } from '../utils/constants.js';
import { scripts as scriptsApi } from '../api.js';

// ── SCRIPT RUNNER (Phase 3.6) ───────────────────────────────
const ScriptRunner = ({ projectId, projectFiles }) => {
  const [scripts, setScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Find scripts in tools folder
  useEffect(() => {
    const foundScripts = [];
    for (const [path, content] of Object.entries(projectFiles || {})) {
      if (
        path.startsWith('tools/') &&
        (path.endsWith('.js') || path.endsWith('.py'))
      ) {
        const name = path
          .split('/')
          .pop()
          .replace(/\.[^.]+$/, '');
        // Try to extract metadata from script
        let meta = {
          name,
          description: '',
          language: path.endsWith('.py') ? 'python' : 'javascript',
        };
        const metaMatch = content.match(
          /export\s+const\s+meta\s*=\s*({[^}]+})/
        );
        if (metaMatch) {
          try {
            const parsed = JSON.parse(metaMatch[1].replace(/'/g, '"'));
            meta = { ...meta, ...parsed };
          } catch {}
        }
        foundScripts.push({ path, name, content, meta });
      }
    }
    setScripts(foundScripts);
  }, [projectFiles]);

  const runScript = async () => {
    if (!selectedScript) return;
    setRunning(true);
    setOutput('Running...\n');

    try {
      const res = await scriptsApi.run(
        selectedScript.content,
        selectedScript.meta.language || 'javascript',
        projectId,
        projectFiles
      );

      let out = '';
      if (res.output) out += res.output + '\n';
      if (res.result !== undefined && res.result !== null) {
        out += `\nResult: ${typeof res.result === 'object' ? JSON.stringify(res.result, null, 2) : res.result}`;
      }
      if (res.error) out += `\nError: ${res.error}`;

      setOutput(out || 'Script executed successfully (no output)');
    } catch (e) {
      setOutput(`Execution failed: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const runPredefined = (type) => {
    let script = '';
    let name = '';

    if (type === 'wordcount') {
      name = 'Word Count';
      script = `
const mdFiles = Object.entries(projectFiles).filter(([path]) =>
  path.endsWith('.md') || path.endsWith('.txt')
);

let totalWords = 0;
const fileStats = [];

for (const [path, content] of mdFiles) {
  const cleanContent = content
    .replace(/[#\\*\\[\\]()\\-\\|\\/\\>]/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();

  const words = cleanContent.split(/\\s+/).filter(w => w.length > 0).length;
  totalWords += words;
  fileStats.push({ path, words });
}

fileStats.sort((a, b) => b.words - a.words);

console.log('Total words:', totalWords);
console.log('Files:', mdFiles.length);
console.log('\\nTop 5 files by word count:');
fileStats.slice(0, 5).forEach(f => console.log(\`  \${f.path}: \${f.words} words\`));
`;
    } else if (type === 'todos') {
      name = 'List TODOs';
      script = `
const todos = [];

for (const [path, content] of Object.entries(projectFiles)) {
  const lines = content.split('\\n');

  lines.forEach((line, index) => {
    const match = line.match(/(TODO|FIXME|HACK|XXX)[\\\\s:]*/i);
    if (match) {
      todos.push({
        path,
        line: index + 1,
        type: match[1].toUpperCase(),
        text: line.trim()
      });
    }
  });
}

console.log(\`Found \${todos.length} items:\`);
todos.slice(0, 20).forEach(t => {
  console.log(\`[\${t.type}] \${t.path}:\${t.line}\`);
  console.log(\`  \${t.text}\`);
});
`;
    } else if (type === 'export') {
      name = 'Export Stats';
      script = `
const stats = {
  totalFiles: Object.keys(projectFiles).length,
  folders: [...new Set(Object.keys(projectFiles).map(p => p.split('/')[0]))],
  byExtension: {}
};

for (const path of Object.keys(projectFiles)) {
  const ext = path.split('.').pop() || 'no-ext';
  stats.byExtension[ext] = (stats.byExtension[ext] || 0) + 1;
}

console.log('Project Statistics');
console.log('==================');
console.log('Total files:', stats.totalFiles);
console.log('\\nFolders:', stats.folders.join(', '));
console.log('\\nFiles by type:');
Object.entries(stats.byExtension)
  .sort((a, b) => b[1] - a[1])
  .forEach(([ext, count]) => console.log(\`  .\${ext}: \${count}\`));
`;
    }

    setSelectedScript({
      content: script,
      meta: { name, language: 'javascript' },
    });
    setOutput('');
  };

  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          ⚡ Script Runner
        </span>
        <span style={{ fontSize: 12, color: C.dim }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Predefined Scripts */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
              Quick Scripts:
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => runPredefined('wordcount')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                📝 Word Count
              </button>
              <button
                onClick={() => runPredefined('todos')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                ✓ List TODOs
              </button>
              <button
                onClick={() => runPredefined('export')}
                style={{ ...S.btn('ghost'), fontSize: 9, padding: '4px 10px' }}
              >
                📊 Stats
              </button>
            </div>
          </div>

          {/* Custom Scripts from tools/ */}
          {scripts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 6 }}>
                Custom Scripts (from tools/):
              </div>
              <select
                value={selectedScript?.path || ''}
                onChange={(e) => {
                  const s = scripts.find((x) => x.path === e.target.value);
                  setSelectedScript(s || null);
                  setOutput('');
                }}
                style={{ ...S.sel, fontSize: 10, width: '100%' }}
              >
                <option value="">Select a script...</option>
                {scripts.map((s) => (
                  <option key={s.path} value={s.path}>
                    {s.meta.name || s.name} ({s.meta.language})
                  </option>
                ))}
              </select>
              {selectedScript && selectedScript.meta.description && (
                <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
                  {selectedScript.meta.description}
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={runScript}
            disabled={!selectedScript || running}
            style={{
              ...S.btn('primary'),
              fontSize: 9,
              padding: '4px 12px',
              opacity: !selectedScript || running ? 0.5 : 1,
            }}
          >
            {running ? '⟳ Running...' : '▶ Run Script'}
          </button>

          {/* Output */}
          {output && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 9, color: C.dim, marginBottom: 4 }}>
                Output:
              </div>
              <pre
                style={{
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: 10,
                  fontSize: 9,
                  color: C.text,
                  maxHeight: 200,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {output}
              </pre>
            </div>
          )}

          {scripts.length === 0 && (
            <div style={{ fontSize: 10, color: C.dim, padding: '10px 0' }}>
              No custom scripts found. Create .js files in the /tools/ folder.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScriptRunner;
