import { useCallback } from 'react';
import {
  projects as projectsApi,
  staging as stagingApi,
  goals as goalsApi,
  settings as settingsApi,
} from '../api.js';
import {
  checkSummaryStatus,
  storeSummaries,
  L0_PROMPT,
  L1_PROMPT,
} from '../summaries.js';
import { ai as aiApi } from '../api.js';
import {
  makeManifest,
  calcHealth,
  makeProject,
} from '../utils/projectFactory.js';
import { buildZipExport } from '../utils/fileHandlers.js';

/**
 * Hook for all project CRUD, file operations, onboarding, and bootstrap logic.
 * Accepts a deps object with required state/setters and returns operations.
 */
export default function useProjectCrud(deps) {
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
    setSaving,
    setBootstrapWiz,
    setNewFileName,
    setNewProjForm,
    setCFForm,
    setImportForm,
    setImportText,
    setImportConflict,
    setImportLoading,
    setImportError,
    setShowImportModal,
    setShowOnboarding,
    setOnboardingCompleted,
    setTourStep,
    setGoals,
    setActiveGoalId,
    setDragOver,
    setToast,
    fileHistory,
    showToast,
    addStaging,
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

  // ── FILE OPS — optimistic + persisted ─────────────────────
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

  // ── PROJECT CRUD — persisted ───────────────────────────────
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
      setBootstrapWiz(id);
    } catch (e) {
      showToast('⚠ Failed to save project to database');
    }
  };

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

  // ── BOOTSTRAP ─────────────────────────────────────────────
  const completeBootstrap = async (projId, brief) => {
    const proj = projects.find((p) => p.id === projId);
    if (!proj) {
      showToast('⚠ Error: Project not found. Refresh and try again.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const newCustomFolders = (brief.customFolders || [])
      .filter(Boolean)
      .map((f) => ({
        id: f.toLowerCase().replace(/\s+/g, '-'),
        label: f,
        icon: '📁',
        desc: 'Custom folder from Bootstrap Brief',
      }));

    const bootstrapFiles = {
      'project-artifacts/BOOTSTRAP_BRIEF.md': `# Bootstrap Brief — ${brief.name || ''}\nGenerated: ${today}\n\n## Problem\n${brief.problem || ''}\n\n## Solution\n${brief.solution || ''}\n\n## Target User\n${brief.targetUser || ''}\n\n## Revenue Model\n${brief.revenueModel || ''}\n\n## MVP Features\n${
        (brief.mvpFeatures || [])
          .filter(Boolean)
          .map((f, i) => `${i + 1}. ${f}`)
          .join('\n') || '- TBD'
      }\n\n## Tech Stack\n${brief.techStack || 'Open'}\n\n## Design Style\n${brief.designStyle || 'Open'}\n\n## Agent Rules\n${brief.agentRules || 'None'}\n`,
      'project-artifacts/STRATEGY_PROMPT.md': `# Strategy Agent — Project Brief\nDate: ${today}\n\nRead project-artifacts/BOOTSTRAP_BRIEF.md then produce:\n1. Scope Validation\n2. Prioritised Feature List\n3. Revenue Rationale\n4. Risk Register\n\nSave output to: project-artifacts/STRATEGY_OUTPUT.md\nUpdate: DEVLOG.md\n`,
      'project-artifacts/DEV_PROMPT.md': `# Dev Agent — Technical Brief\nDate: ${today}\n\nRead BOOTSTRAP_BRIEF.md and STRATEGY_OUTPUT.md then produce:\n1. Tech Stack Decision\n2. Component Architecture\n3. Bolt One-Shot Prompt\n4. Deployment Plan\n\nSave to: code-modules/DEV_BRIEF.md\nUpdate: DEVLOG.md\n`,
      'system/SKILL.md': `# SKILL.md — Project Overrides\nGenerated: ${today}\n\n## Dev\n${brief.techStack ? `- Stack: ${brief.techStack}` : ''}\n\n## Design\n${brief.designStyle ? `- Style: ${brief.designStyle}` : ''}\n\n## Content\n- Tone: ${brief.contentTone || 'Builder-first'}\n\n## Rules\n${brief.agentRules || 'None'}\n`,
      'system/AGENT_ONBOARDING.md': `# Agent Onboarding\nGenerated: ${today}\n\n1. Read manifest.json\n2. Read project-artifacts/BOOTSTRAP_BRIEF.md\n3. Read system/SKILL.md\n4. Read DEVLOG.md\n5. Do your work → save to correct folder → update DEVLOG\n\n## Agent Team\n${(brief.selectedAgents || []).join(', ')}\n`,
    };

    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const allCustom = [...(p.customFolders || []), ...newCustomFolders];
        const folderKeeps = {};
        newCustomFolders.forEach((f) => {
          folderKeeps[`${f.id}/.gitkeep`] = '';
        });
        const allFiles = {
          ...(p.files || {}),
          ...bootstrapFiles,
          ...folderKeeps,
        };
        const updated = {
          ...p,
          customFolders: allCustom,
          skills: brief.selectedAgents,
          nextAction:
            'Step 1: Copy STRATEGY_PROMPT.md → paste into Claude → run strategy agent',
          files: allFiles,
        };
        updated.files['manifest.json'] = JSON.stringify(
          makeManifest(updated),
          null,
          2
        );
        updated.files['PROJECT_OVERVIEW.md'] =
          `# ${p.name}\n\n## One-Liner\n${brief.solution || ''}\n\n## Problem\n${brief.problem || ''}\n\n## Agent Team\n${(brief.selectedAgents || []).join(', ')}\n\n## Bootstrap Status\n- [x] Brief written\n- [ ] Strategy Agent run\n- [ ] Dev Agent run\n`;
        return updated;
      })
    );
    setBootstrapWiz(null);
    openHub(projId, 'project-artifacts/BOOTSTRAP_BRIEF.md');

    try {
      await projectsApi.update(projId, {
        skills: brief.selectedAgents,
        nextAction: 'Run Strategy Agent',
      });
      for (const [path, content] of Object.entries(bootstrapFiles)) {
        await projectsApi.saveFile(projId, path, content);
      }
      for (const f of newCustomFolders) {
        await projectsApi.addFolder(projId, f);
        await projectsApi.saveFile(projId, `${f.id}/.gitkeep`, '');
      }
      const s = {
        id: `bs-${Date.now()}`,
        project_id: projId,
        name: 'Bootstrap complete — run Strategy Agent next',
        tag: 'DRAFT_',
        status: 'in-review',
        notes:
          'Copy STRATEGY_PROMPT.md → paste into Claude → save output as STRATEGY_OUTPUT.md',
        added: new Date().toISOString().slice(0, 7),
      };
      const res = await stagingApi.create(s);
      setStaging((prev) => [
        ...prev,
        { ...s, id: res.id || s.id, project: projId },
      ]);
      showToast('✓ Bootstrap files saved');
    } catch (e) {
      showToast('⚠ Bootstrap saved locally — DB sync failed');
    }
  };

  // ── ONBOARDING HANDLERS (Phase 4.2) ─────────────────────────
  const handleOnboardingCreateGoal = async (goalData) => {
    try {
      const res = await goalsApi.create(goalData);
      const updated = await goalsApi.list();
      setGoals(updated.goals || []);
      if (res.id) setActiveGoalId(res.id);
      return res;
    } catch (e) {
      console.error('Failed to create goal during onboarding:', e);
      return null;
    }
  };

  const handleOnboardingCreateProject = async ({
    name,
    templateId,
    goalId,
  }) => {
    const id =
      name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '') +
      '-' +
      Date.now().toString(36);
    const template = templates.find((t) => t.id === templateId);
    const phase = template?.config?.phases?.[0] || 'BOOTSTRAP';

    const proj = makeProject(
      id,
      name,
      template?.icon || '📁',
      phase,
      'active',
      1,
      false,
      '',
      'Run Bootstrap Protocol → define scope with agents',
      [],
      ['new'],
      3,
      new Date().toISOString().slice(0, 7),
      0,
      [],
      [],
      template?.config
    );
    proj.areaId = null;

    setProjects((prev) => [...prev, proj]);
    setFocusId(id);

    try {
      await projectsApi.create(proj);
      for (const [path, content] of Object.entries(proj.files)) {
        await projectsApi.saveFile(id, path, content);
      }
      showToast('✓ Project created');
      return proj;
    } catch (e) {
      showToast('⚠ Failed to create project');
      return null;
    }
  };

  const completeOnboarding = async (createdProject) => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);

    try {
      await settingsApi.update({ onboarding_completed: true });
    } catch (e) {
      console.error('Failed to save onboarding completion:', e);
    }

    if (createdProject) {
      setTourStep(1);
      openHub(createdProject.id);
    }
  };

  const skipOnboarding = async () => {
    setShowOnboarding(false);
    setOnboardingCompleted(true);
    try {
      await settingsApi.update({ onboarding_completed: true });
    } catch (e) {
      console.error('Failed to save onboarding skip:', e);
    }
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

  // ── EXPORT (local download — no API change needed) ─────────
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
    openHub,
    saveFile,
    handleHubSave,
    createFile,
    deleteFile,
    addCustomFolder,
    createProject,
    updateProject,
    renameProject,
    deleteProject,
    importProject,
    completeBootstrap,
    handleOnboardingCreateGoal,
    handleOnboardingCreateProject,
    completeOnboarding,
    skipOnboarding,
    handleDrop,
    exportProject,
  };
}
