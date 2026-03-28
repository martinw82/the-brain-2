import { useCallback } from 'react';
import { projects as projectsApi } from '../api.js';
import {
  checkSummaryStatus,
  storeSummaries,
  L0_PROMPT,
  L1_PROMPT,
} from '../summaries.js';
import { ai as aiApi } from '../api.js';
import { buildZipExport } from '../utils/fileHandlers.js';
import { makeManifest } from '../utils/projectFactory.js';

/**
 * Hook for file operations: save, create, delete, handleDrop, export
 */
export default function useFileCrud(deps) {
  const {
    projects,
    setProjects,
    hubId,
    setModal,
    setSaving,
    setNewFileName,
    setDragOver,
    setToast,
    fileHistory,
    showToast,
    addStaging,
  } = deps;

  // ── SUMMARY GENERATION ─────────────────────────────────────
  const generateSummaryAsync = async (projId, path, content) => {
    try {
      const { needsUpdate } = await checkSummaryStatus(projId, path, content);
      if (!needsUpdate) return;

      const ext = path.split('.').pop();
      if (!['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(ext))
        return;

      const [l0Response, l1Response] = await Promise.all([
        aiApi.ask(
          'claude-sonnet-4-6',
          `${L0_PROMPT}\n\n--- FILE CONTENT ---\n${content.slice(0, 3000)}...\n(end of preview)`
        ),
        content.length > 500
          ? aiApi.ask(
              'claude-sonnet-4-6',
              `${L1_PROMPT}\n\n--- FILE CONTENT ---\n${content.slice(0, 8000)}...\n(end of preview)`
            )
          : Promise.resolve(null),
      ]);

      await storeSummaries(projId, path, content, {
        l0_abstract: l0Response?.response || '',
        l1_overview: l1Response?.response || '',
      });

      console.log(`[Summary] Generated for ${path}`);
    } catch (e) {
      console.log(`[Summary] Failed for ${path}:`, e.message);
    }
  };

  // ── SAVE FILE ──────────────────────────────────────────────
  const saveFile = useCallback(
    async (projId, path, content) => {
      const prevContent = projects.find((p) => p.id === projId)?.files?.[path];

      if (prevContent !== undefined && prevContent !== content) {
        fileHistory.push(
          { projectId: projId, filePath: path, content: prevContent },
          'edit'
        );
      }

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projId ? { ...p, files: { ...p.files, [path]: content } } : p
        )
      );
      setSaving(true);
      try {
        await projectsApi.saveFile(projId, path, content);
        showToast('✓ Saved');

        if (content.length > 100) {
          generateSummaryAsync(projId, path, content);
        }
      } catch (e) {
        showToast('⚠ Save failed — check connection');
      } finally {
        setSaving(false);
      }
    },
    [projects, fileHistory]
  );

  const handleHubSave = useCallback(
    (path, content) => {
      if (hubId) saveFile(hubId, path, content);
    },
    [hubId, saveFile]
  );

  // ── CREATE FILE ────────────────────────────────────────────
  const createFile = async (projId, folder, name) => {
    if (!name.trim()) return;
    const path = folder ? `${folder}/${name}` : name;
    const ext = name.split('.').pop();
    const def =
      ext === 'md'
        ? `# ${name.replace('.md', '')}\n\n`
        : ext === 'json'
          ? '{}\n'
          : '';
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, files: { ...p.files, [path]: def }, activeFile: path }
          : p
      )
    );
    setModal(null);
    setNewFileName('');
    await projectsApi
      .saveFile(projId, path, def)
      .catch((e) => console.error('[sync]', e.message));
    await projectsApi
      .setActiveFile(projId, path)
      .catch((e) => console.error('[sync]', e.message));
  };

  // ── DELETE FILE ────────────────────────────────────────────
  const deleteFile = async (projId, path) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const f = { ...p.files };
        delete f[path];
        return {
          ...p,
          files: f,
          activeFile:
            p.activeFile === path ? 'PROJECT_OVERVIEW.md' : p.activeFile,
        };
      })
    );
    await projectsApi
      .deleteFile(projId, path)
      .catch((e) => console.error('[sync]', e.message));
  };

  // ── DRAG & DROP ────────────────────────────────────────────
  const handleDrop = useCallback((e, projId) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files).forEach((file) => {
      const SIZE_LIMIT = 5 * 1024 * 1024;
      if (file.size > SIZE_LIMIT) {
        setToast(
          `⚠ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 5MB — may load slowly`
        );
      }
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const content = ev.target.result;
        const path = `staging/${file.name}`;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === projId
              ? { ...p, files: { ...(p.files || {}), [path]: content } }
              : p
          )
        );
        const s = {
          name: file.name,
          tag: 'DRAFT_',
          project: projId,
          notes: `Uploaded ${new Date().toISOString().slice(0, 10)}`,
        };
        await addStaging(s);
        await projectsApi
          .saveFile(projId, path, content)
          .catch((e) => console.error('[sync]', e.message));
      };
      if (
        file.type.startsWith('text') ||
        ['md', 'json', 'js', 'ts', 'py', 'sol', 'txt', 'css', 'html'].some(
          (e) => file.name.endsWith('.' + e)
        )
      )
        reader.readAsText(file);
      else reader.readAsDataURL(file);
    });
  }, []);

  // ── EXPORT (local download) ────────────────────────────────
  const exportProject = (projId) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) return;
    const content = buildZipExport({
      ...proj,
      files: {
        ...(proj.files || {}),
        'manifest.json': JSON.stringify(makeManifest(proj), null, 2),
      },
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${proj.id}-buidl-export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    saveFile,
    handleHubSave,
    createFile,
    deleteFile,
    handleDrop,
    exportProject,
  };
}
