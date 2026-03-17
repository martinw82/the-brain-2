import { useEffect } from 'react';
import {
  areas as areasApi,
  goals as goalsApi,
  templates as templatesApi,
} from '../api.js';
import { cache } from '../cache.js';
import { sync } from '../sync.js';
import { STANDARD_FOLDERS } from '../utils/constants.js';

/**
 * Hook for seeding default data, cache sync, and online-status monitoring.
 */
export default function useDataSync(deps) {
  const {
    user,
    areas,
    setAreas,
    goals,
    setGoals,
    setActiveGoalId,
    templates,
    setTemplates,
    projects,
    staging,
    ideas,
    userTags,
    entityTags,
    setIsOnline,
    setQueuedWrites,
    setSyncStatus,
    showToast,
  } = deps;

  // ── SEED DEFAULTS — called if areas, goals or templates are empty ──
  useEffect(() => {
    if (areas.length === 0 && user) {
      const defaults = [
        {
          name: 'Business / Revenue',
          color: '#1a4fd6',
          icon: '\u{1F4BC}',
          description: 'Revenue generating projects',
          sort_order: 1,
        },
        {
          name: 'Health / Body',
          color: '#10b981',
          icon: '\u{1F3CB}\u{FE0F}',
          description: 'Physical health and training',
          sort_order: 2,
        },
        {
          name: 'Relationships',
          color: '#ec4899',
          icon: '\u{2764}\u{FE0F}',
          description: 'Friends, family, and networking',
          sort_order: 3,
        },
        {
          name: 'Creative / Learning',
          color: '#8b5cf6',
          icon: '\u{1F3A8}',
          description: 'Skill building and side projects',
          sort_order: 4,
        },
        {
          name: 'Personal / Admin',
          color: '#64748b',
          icon: '\u{1F3E0}',
          description: 'Life maintenance and logistics',
          sort_order: 5,
        },
      ];
      Promise.all(defaults.map((d) => areasApi.create(d))).then(() => {
        areasApi.list().then((data) => setAreas(data.areas || []));
      });
    }
    if (goals.length === 0 && user) {
      const defaultGoal = {
        title: 'Bootstrap \u2192 Thailand',
        target_amount: 3000,
        currency: 'GBP',
        category: 'income',
      };
      goalsApi.create(defaultGoal).then(() => {
        goalsApi.list().then((data) => {
          setGoals(data.goals || []);
          if (data.goals?.length) setActiveGoalId(data.goals[0].id);
        });
      });
    }
    if (templates.length === 0 && user) {
      const defaults = [
        {
          name: 'BUIDL Framework',
          icon: '\u{1F680}',
          category: 'software',
          description:
            'The core BUIDL framework with all phases and standard folders.',
          config: {
            phases: [
              'BOOTSTRAP',
              'UNLEASH',
              'INNOVATE',
              'DECENTRALIZE',
              'LEARN',
              'SHIP',
            ],
            folders: STANDARD_FOLDERS.map((f) => f.id),
          },
          is_system: true,
        },
        {
          name: 'Software Project',
          icon: '\u{1F6E0}',
          category: 'software',
          description:
            'Code-focused project with planning, dev, and testing phases.',
          config: {
            phases: ['PLANNING', 'DEVELOPMENT', 'TESTING', 'DEPLOYED'],
            folders: [
              'code-modules',
              'project-artifacts',
              'qa',
              'infrastructure',
              'system',
            ],
          },
          is_system: true,
        },
        {
          name: 'Content Project',
          icon: '\u{270D}\u{FE0F}',
          category: 'creative',
          description: 'Content creation workflow from research to publishing.',
          config: {
            phases: ['RESEARCH', 'DRAFTING', 'REVIEW', 'PUBLISHED'],
            folders: ['content-assets', 'design-assets', 'marketing', 'system'],
          },
          is_system: true,
        },
        {
          name: 'Health & Fitness',
          icon: '\u{1F4AA}',
          category: 'health',
          description:
            'Track training, nutrition, goals, and wellness metrics.',
          config: {
            phases: ['ASSESS', 'BUILD', 'MAINTAIN', 'OPTIMIZE'],
            folders: [
              'analytics',
              'project-artifacts',
              'content-assets',
              'system',
            ],
          },
          is_system: true,
        },
        {
          name: 'Blank',
          icon: '\u{1F4C4}',
          category: 'custom',
          description: 'A minimal starting point with only core files.',
          config: { phases: [], folders: ['system'] },
          is_system: true,
        },
      ];
      Promise.all(defaults.map((d) => templatesApi.create(d))).then(() => {
        templatesApi.list().then((data) => setTemplates(data.templates || []));
      });
    }
  }, [areas.length, goals.length, templates.length, user]);

  // ── OFFLINE MODE (Phase 2.4) — Sync state changes to cache ──
  useEffect(() => {
    cache.setCollection('projects', projects);
    cache.setCollection('staging', staging);
    cache.setCollection('ideas', ideas);
    cache.setCollection('areas', areas);
    cache.setCollection('goals', goals);
    cache.setCollection('templates', templates);
    cache.setCollection('tags', userTags);
    cache.setCollection('entityTags', entityTags);
  }, [projects, staging, ideas, areas, goals, templates, userTags, entityTags]);

  // ── Check online status and listen to sync events ──
  useEffect(() => {
    const checkOnline = async () => {
      const online = await sync.isOnline();
      setIsOnline(online);
      setQueuedWrites(cache.getWriteQueue().length);
    };

    checkOnline();

    sync.onStatusChange((status) => {
      setIsOnline(status === 'online');
      showToast(
        status === 'online' ? '\u2713 Back online' : '\u26A0 Offline mode'
      );
    });

    sync.onSyncStart(() => {
      setSyncStatus('syncing');
      showToast('\u27F3 Syncing changes...');
    });

    sync.onSyncComplete((count) => {
      setSyncStatus(count > 0 ? 'synced' : 'idle');
      setQueuedWrites(0);
      if (count > 0) showToast(`\u2713 Synced ${count} changes`);
    });

    sync.onSyncError(() => {
      setSyncStatus('error');
      showToast('\u26A0 Sync failed, will retry');
    });

    const checkInterval = setInterval(checkOnline, 5000);
    return () => clearInterval(checkInterval);
  }, []);
}
