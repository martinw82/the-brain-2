import { projects as projectsApi } from '../api.js';
import {
  makeManifest,
  calcHealth,
  makeProject,
} from '../utils/projectFactory.js';

/**
 * Hook for project lifecycle operations: open, create, update, rename, delete, import
 */
export default function useProjectLifecycle(deps) {
  const {
    projects,
    setProjects,
    staging,
    setStaging,
    templates,
    hubId,
    focusId,
    setFocusId,
    setView,
    setHubId,
    setHubTab,
    setModal,
    setLoadingFiles,
    setNewProjForm,
    setCFForm,
    setImportForm,
    setImportText,
    setImportConflict,
    setImportLoading,
    setImportError,
    setShowImportModal,
    showToast,
    importForm,
  } = deps;

  // ── OPEN HUB ──────────────────────────────────────────────
  const openHub = async (id, file) => {
    const proj = projects.find((p) => p.id === id);
    const targetFile = file || proj?.activeFile || 'PROJECT_OVERVIEW.md';

    setHubId(id);
    setView('hub');
    setHubTab('editor');

    if (!proj?.files) {
      setLoadingFiles(true);
      try {
        const res = await projectsApi.get(id);
        const loaded = res.project;
        setProjects((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  files: loaded.files || {},
                  customFolders: loaded.customFolders || p.customFolders || [],
                  activeFile: targetFile,
                }
              : p
          )
        );
      } catch (e) {
        showToast('⚠ Failed to load project files');
      } finally {
        setLoadingFiles(false);
      }
    } else {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, activeFile: targetFile } : p))
      );
      projectsApi
        .setActiveFile(id, targetFile)
        .catch((e) => console.error('[sync]', e.message));
    }
  };

  // ── CUSTOM FOLDERS ────────────────────────────────────────
  const addCustomFolder = async (projId, folder) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const cfs = [...(p.customFolders || []), folder];
        const files = { ...p.files, [`${folder.id}/.gitkeep`]: '' };
        const manifest = makeManifest({ ...p, customFolders: cfs });
        files['manifest.json'] = JSON.stringify(manifest, null, 2);
        return { ...p, customFolders: cfs, files };
      })
    );
    setModal(null);
    setCFForm({ id: '', label: '', icon: '📁', desc: '' });
    await projectsApi
      .addFolder(projId, folder)
      .catch((e) => console.error('[sync]', e.message));
    await projectsApi
      .saveFile(projId, `${folder.id}/.gitkeep`, '')
      .catch((e) => console.error('[sync]', e.message));
  };

  // ── CREATE PROJECT ─────────────────────────────────────────
  const createProject = async (form) => {
    const id =
      form.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now().toString(36);
    const template = templates.find((t) => t.id === form.templateId);
    const phase = template?.config?.phases?.[0] || form.phase || 'BOOTSTRAP';

    const proj = makeProject(
      id,
      form.name,
      form.emoji,
      phase,
      'active',
      projects.length + 1,
      false,
      form.desc,
      'Run Bootstrap Protocol → define scope with agents',
      [],
      ['new'],
      3,
      new Date().toISOString().slice(0, 7),
      form.incomeTarget || 0,
      ['dev', 'strategy'],
      [],
      template?.config
    );
    proj.areaId = form.areaId || null;
    setProjects((prev) => [...prev, proj]);
    setFocusId(id);
    setModal(null);
    setNewProjForm({ name: '', emoji: '📁', phase: 'BOOTSTRAP', desc: '' });
    try {
      await projectsApi.create(proj);
      for (const [path, content] of Object.entries(proj.files)) {
        await projectsApi.saveFile(id, path, content);
      }
      showToast('✓ Project created');
      return id;
    } catch (e) {
      showToast('⚠ Failed to save project to database');
      return null;
    }
  };

  // ── UPDATE PROJECT ─────────────────────────────────────────
  const updateProject = async (projId, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, ...updates, health: calcHealth({ ...p, ...updates }) }
          : p
      )
    );
    await projectsApi
      .update(projId, updates)
      .catch((e) => console.error('[sync] Project save failed:', e.message));
  };

  // ── RENAME PROJECT ─────────────────────────────────────────
  const renameProject = async (projId, newName) => {
    let updatedFiles = {};
    setProjects((prev) => {
      const newProjects = prev.map((p) => {
        if (p.id !== projId) return p;
        const files = { ...p.files };
        if (files['PROJECT_OVERVIEW.md'])
          files['PROJECT_OVERVIEW.md'] = files['PROJECT_OVERVIEW.md'].replace(
            /^# .+$/m,
            `# ${newName}`
          );
        const manifest = makeManifest({ ...p, name: newName });
        files['manifest.json'] = JSON.stringify(manifest, null, 2);
        updatedFiles = files;
        return { ...p, name: newName, files };
      });
      return newProjects;
    });
    setModal(null);
    await projectsApi
      .update(projId, { name: newName })
      .catch((e) => console.error('[sync]', e.message));
    if (updatedFiles['PROJECT_OVERVIEW.md']) {
      await projectsApi
        .saveFile(
          projId,
          'PROJECT_OVERVIEW.md',
          updatedFiles['PROJECT_OVERVIEW.md']
        )
        .catch((e) => console.error('[sync]', e.message));
    }
    if (updatedFiles['manifest.json']) {
      await projectsApi
        .saveFile(projId, 'manifest.json', updatedFiles['manifest.json'])
        .catch((e) => console.error('[sync]', e.message));
    }
  };

  // ── DELETE PROJECT ─────────────────────────────────────────
  const deleteProject = async (projId) => {
    setProjects((prev) => prev.filter((p) => p.id !== projId));
    setStaging((prev) => prev.filter((s) => s.project !== projId));
    if (hubId === projId) {
      setView('brain');
      setHubId(null);
    }
    if (focusId === projId) {
      const rem = projects.filter((p) => p.id !== projId);
      if (rem.length) setFocusId(rem[0].id);
    }
    setModal(null);
    await projectsApi
      .delete(projId)
      .catch((e) => console.error('[sync] Project save failed:', e.message));
  };

  // ── IMPORT PROJECT ─────────────────────────────────────────
  const importProject = async (
    method,
    projectId,
    name,
    data,
    overwrite = false
  ) => {
    if (!projectId.match(/^[a-z0-9-]+$/)) {
      setImportError(
        'Invalid project ID: use only lowercase letters, numbers, and hyphens'
      );
      return;
    }
    if (!name.trim()) {
      setImportError('Project name is required');
      return;
    }

    setImportLoading(true);
    setImportError('');

    try {
      const resp = await projectsApi.import(
        method,
        projectId,
        name,
        data,
        importForm.lifeAreaId,
        importForm.templateId,
        overwrite
      );

      const { projects: updated } = await projectsApi.list();
      setProjects(updated.map((p) => ({ ...p, health: calcHealth(p) })));

      showToast(`✓ Project imported: ${resp.filesCreated} files`);
      setShowImportModal(false);
      setImportForm({
        projectId: '',
        name: '',
        lifeAreaId: '',
        templateId: '',
      });
      setImportText('');
      setImportConflict(null);
      setFocusId(projectId);
      openHub(projectId);
    } catch (e) {
      const errMsg = e.message;
      if (errMsg.includes('409') || errMsg.includes('Project exists')) {
        setImportConflict({
          projectId,
          overwrite: () => importProject(method, projectId, name, data, true),
        });
      } else {
        setImportError(errMsg || 'Import failed');
      }
    } finally {
      setImportLoading(false);
    }
  };

  return {
    openHub,
    addCustomFolder,
    createProject,
    updateProject,
    renameProject,
    deleteProject,
    importProject,
  };
}
