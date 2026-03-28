import { projects as projectsApi, staging as stagingApi, goals as goalsApi, settings as settingsApi } from '../api.js';
import { makeManifest, makeProject } from '../utils/projectFactory.js';

/**
 * Hook for bootstrap and onboarding operations
 */
export default function useProjectBootstrap(deps) {
  const {
    projects,
    setProjects,
    setStaging,
    templates,
    setFocusId,
    setBootstrapWiz,
    setShowOnboarding,
    setOnboardingCompleted,
    setTourStep,
    setGoals,
    setActiveGoalId,
    showToast,
    openHub,
  } = deps;

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

  // ── ONBOARDING HANDLERS ───────────────────────────────────
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

  return {
    completeBootstrap,
    handleOnboardingCreateGoal,
    handleOnboardingCreateProject,
    completeOnboarding,
    skipOnboarding,
  };
}
