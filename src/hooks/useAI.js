import { search as searchApi, ai as aiApi } from '../api.js';
import { THAILAND_TARGET } from '../utils/constants.js';
import { SKILLS } from '../components/SkillsWorkflows.jsx';

/**
 * Hook for search, context building, AI coach operations.
 */
export default function useAI(deps) {
  const {
    projects,
    staging,
    ideas,
    focusId,
    user,
    searchFilters,
    setSearchRes,
    addRecentSearch,
    setCopied,
    setAiOut,
    setAiLoad,
    aiRef,
  } = deps;

  const runSearch = async (q) => {
    if (!q.trim()) {
      setSearchRes([]);
      return;
    }
    try {
      const { results } = await searchApi.query(q, searchFilters);
      setSearchRes(results || []);
      addRecentSearch(q);
    } catch (e) {
      console.error('[catch]', e.message);
      // Fallback to in-memory search
      const res = [];
      projects.forEach((p) =>
        Object.entries(p.files || {}).forEach(([path, content]) => {
          if (
            typeof content === 'string' &&
            content.toLowerCase().includes(q.toLowerCase())
          ) {
            const idx = content.toLowerCase().indexOf(q.toLowerCase());
            const excerptStart = Math.max(0, idx - 60);
            const excerptEnd = Math.min(content.length, idx + q.length + 60);
            let excerpt = content.slice(excerptStart, excerptEnd);
            if (excerptStart > 0) excerpt = '...' + excerpt;
            if (excerptEnd < content.length) excerpt = excerpt + '...';
            res.push({
              project_id: p.id,
              project_name: p.name,
              emoji: p.emoji,
              path,
              excerpt,
              query: q,
            });
          }
        })
      );
      setSearchRes(res.slice(0, 15));
    }
  };

  const buildCtx = (projId = null) => {
    try {
      return JSON.stringify(
        {
          agent_context: 'THE BRAIN v2.0 — Orchestrator Edition',
          generated: new Date().toISOString(),
          operator: {
            name: user?.name || 'Builder',
            email: user?.email,
            goal: user?.goal || 'Bootstrap → Thailand',
            monthly_target: user?.monthly_target || THAILAND_TARGET,
          },
          today_focus: focusId,
          projects: (projId
            ? projects.filter((p) => p.id === projId)
            : projects
          ).map((p) => ({
            id: p.id,
            name: p.name,
            phase: p.phase,
            status: p.status,
            priority: p.priority,
            revenue_ready: p.revenueReady,
            health: p.health,
            momentum: p.momentum,
            next_action: p.nextAction,
            blockers: p.blockers,
            tags: p.tags,
            income_target: p.incomeTarget,
            skills: p.skills,
            staging_pending: staging.filter(
              (s) => s.project === p.id && s.status === 'in-review'
            ).length,
          })),
          global_staging: staging,
          ideas: ideas.map((i) => ({ title: i.title, score: i.score })),
        },
        null,
        2
      );
    } catch (e) {
      console.error('[catch]', e.message);
      return '{}';
    }
  };

  const buildBrief = (skillId, projId) => {
    const sk = SKILLS[skillId];
    const proj = projects.find((p) => p.id === projId);
    if (!sk || !proj) return '';
    return `# ${sk.icon} ${sk.label} Briefing — ${proj.emoji} ${proj.name}\n\n## Role\n${sk.description}\n\n## Project\n- **${proj.name}** (${proj.phase}, Priority #${proj.priority})\n- Status: ${proj.status} | Health: ${proj.health}/100\n- Next: ${proj.nextAction}\n- Blockers: ${proj.blockers?.join(', ') || 'None'}\n\n## Prompt Prefix\n> ${sk.prompt_prefix}\n\n## SOP\n${sk.sop.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n## Permissions\n✅ ${sk.permissions.join(', ')}\n🚫 ${sk.ignore.join(', ')}\n\n## Context\n\`\`\`json\n${buildCtx(projId)}\n\`\`\``;
  };

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const askAI = async (prompt, systemOverride = null) => {
    setAiLoad(true);
    setAiOut('');
    try {
      const d = await aiApi.ask(prompt, systemOverride);
      setAiOut(d.content?.map((b) => b.text || '').join('') || 'No response.');
    } catch (e) {
      setAiOut(e.message || 'Connection error.');
    }
    setAiLoad(false);
    setTimeout(
      () => aiRef.current?.scrollIntoView({ behavior: 'smooth' }),
      100
    );
  };

  return { runSearch, buildCtx, buildBrief, copy, askAI };
}
