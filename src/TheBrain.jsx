import { useState, useRef, useEffect, useCallback } from 'react';
import {
  projects as projectsApi,
  staging as stagingApi,
  ideas as ideasApi,
  sessions as sessionsApi,
  comments as commentsApi,
  search as searchApi,
  ai as aiApi,
  areas as areasApi,
  goals as goalsApi,
  templates as templatesApi,
  tags as tagsApi,
  links as linksApi,
  settings as settingsApi,
  fileMetadata,
  token,
  drift as driftApi,
  aiMetadata as aiMetadataApi,
  scripts as scriptsApi,
  integrations as integrationsApi,
  notifications as notificationsApi,
  userAISettings,
  tasks as tasksApi,
  fileSummaries,
  agentExecution,
} from './api.js';
import { cache } from './cache.js';
import { sync } from './sync.js';
import { desktopSync } from './desktop-sync.js';
import {
  parseURI,
  extractURIs,
  uriToNavigation,
  resolveLabel,
  isValidURI,
  contentHash,
} from './uri.js';
import {
  checkSummaryStatus,
  storeSummaries,
  L0_PROMPT,
  L1_PROMPT,
} from './summaries.js';
import FolderSyncSetup from './components/FolderSyncSetup.jsx';
import SyncReviewModal from './components/SyncReviewModal.jsx';
import DailyCheckinModal from './components/DailyCheckinModal.jsx';
import TrainingLogModal from './components/TrainingLogModal.jsx';
import OutreachLogModal from './components/OutreachLogModal.jsx';
import WeeklyReviewPanel from './components/WeeklyReviewPanel.jsx';
import AgentManager from './components/AgentManager.jsx';
import FileSummaryViewer from './components/FileSummaryViewer.jsx';
import WorkflowRunner from './components/WorkflowRunner.jsx';
import { seedSystemWorkflows } from './workflows.js';
import { getMode, getBehavior, shouldShow, MODE_INFO } from './modeHelper.js';
import {
  C,
  S,
  BREAKPOINTS,
  BUIDL_VERSION,
  THAILAND_TARGET,
  BUIDL_PHASES,
  STANDARD_FOLDERS,
  STANDARD_FOLDER_IDS,
  ITEM_TAGS,
  REVIEW_STATUSES,
  STATUS_MAP,
} from './utils/constants.js';
import {
  makeManifest,
  calcHealth,
  makeDefaultFiles,
  makeProject,
} from './utils/projectFactory.js';
import {
  getFileType,
  formatFileSize,
  buildZipExport,
} from './utils/fileHandlers.js';

// ============================================================
// THE BRAIN v2.0 — Orchestrator Edition
// Full persistence via TiDB/MySQL + Netlify Functions
// ============================================================

// BREAKPOINTS, C, S moved to utils/constants.js

// ── Extracted hooks ──────────────────────────────────────────
import useUndoRedo from './hooks/useUndoRedo.js';
import useBreakpoint from './hooks/useBreakpoint.js';
import useProjectCrud from './hooks/useProjectCrud.js';
import useStagingOps from './hooks/useStagingOps.js';
import useSessionOps from './hooks/useSessionOps.js';
import useNotifications from './hooks/useNotifications.js';
import useTaskOps from './hooks/useTaskOps.js';
import useAI from './hooks/useAI.js';
import useTagOps from './hooks/useTagOps.jsx';

// ── Extracted UI components ──────────────────────────────────
import {
  AreaPill,
  TagPill,
  Dots,
  HealthBar,
  BadgeStatus,
  Modal,
  Toast,
} from './components/UI/SmallComponents.jsx';
import ProgressTrends from './components/ProgressTrends.jsx';

// ── Extracted modals ─────────────────────────────────────────
import KeyboardShortcutsModal, {
  SHORTCUTS,
} from './components/Modals/KeyboardShortcutsModal.jsx';
import AIProviderSettings from './components/Modals/AIProviderSettings.jsx';
import MetadataEditor from './components/Modals/MetadataEditor.jsx';
import SearchModal from './components/Modals/SearchModal.jsx';

// ── Extracted renderers & chart components ────────────────────
import MermaidRenderer from './components/MermaidRenderer.jsx';
import URILink, { renderAIResponse } from './components/URILink.jsx';
import { renderMd, parseTasks } from './utils/renderers.js';
import GanttChart from './components/GanttChart.jsx';
import FileTreeInline from './components/FileTreeInline.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';

// ── Extracted large components ────────────────────────────────
import OnboardingWizard from './components/OnboardingWizard.jsx';
import TourTooltip from './components/TourTooltip.jsx';
import GitHubIntegration from './components/GitHubIntegration.jsx';
import MarkdownEditor from './components/MarkdownEditor.jsx';
import ImageViewer from './components/viewers/ImageViewer.jsx';
import AudioPlayer from './components/viewers/AudioPlayer.jsx';
import VideoPlayer from './components/viewers/VideoPlayer.jsx';
import BinaryViewer from './components/viewers/BinaryViewer.jsx';
import HubEditorPanel from './components/panels/HubEditorPanel.jsx';
import BrainTabsPanel from './components/panels/BrainTabsPanel.jsx';
import ScriptRunner from './components/ScriptRunner.jsx';
import HealthCheck from './components/HealthCheck.jsx';
import {
  SKILLS,
  WORKFLOWS,
  BOOTSTRAP_STEPS,
} from './components/SkillsWorkflows.jsx';
import BootstrapWizard from './components/BootstrapWizard.jsx';

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT — accepts props from App.jsx (auth gate)
// ══════════════════════════════════════════════════════════════
export default function TheBrain({
  user,
  initialProjects = [],
  initialStaging = [],
  initialIdeas = [],
  initialAreas = [],
  initialGoals = [],
  initialTemplates = [],
  initialTags = [],
  initialEntityTags = [],
  onLogout,
}) {
  // ── STATE ──────────────────────────────────────────────────
  const [projects, setProjects] = useState(
    initialProjects.map((p) => ({ ...p, health: calcHealth(p) }))
  );
  const [staging, setStaging] = useState(initialStaging);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [areas, setAreas] = useState(initialAreas);
  const [goals, setGoals] = useState(initialGoals || []);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [userTags, setUserTags] = useState(initialTags || []);
  // entityTags: flat array of {id,tag_id,entity_type,entity_id,name,color,category}
  const [entityTags, setEntityTags] = useState(initialEntityTags || []);
  const [tagInput, setTagInput] = useState({}); // {[entityKey]: inputValue}
  const [selectedTagId, setSelectedTagId] = useState(null); // for Tags brain tab
  const [userSettings, setUserSettings] = useState({
    font: 'JetBrains Mono',
    fontSize: 11,
  });
  const [fileMetadata, setFileMetadata] = useState(null); // Roadmap 2.3: current file's metadata
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null); // Phase 3.1: AI metadata suggestions
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    font: 'JetBrains Mono',
    fontSize: 11,
    assistance_mode: 'coach',
  });

  // ── UNDO/REDO STATE ─────────────────────────────────────────
  const fileHistory = useUndoRedo(50); // Track last 50 file edits
  const [undoToast, setUndoToast] = useState(null);

  // ── KEYBOARD SHORTCUTS STATE ────────────────────────────────
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [keySequence, setKeySequence] = useState([]); // For multi-key shortcuts like 'g then c'

  // Hub links
  const [hubLinks, setHubLinks] = useState([]);
  const [newLinkForm, setNewLinkForm] = useState({
    targetType: 'project',
    targetId: '',
    relationship: 'related',
  });

  // UI navigation
  const [view, setView] = useState('brain');
  const [mainTab, setMainTab] = useState('command');
  const [hubId, setHubId] = useState(null);
  const [hubTab, setHubTab] = useState('editor');
  const [reviewFilter, setReviewFilter] = useState('pending'); // Phase 2.3: 'all'|'pending'|'filed'
  const [focusId, setFocusId] = useState(initialProjects[0]?.id || null);

  // Mobile responsive (Phase 4.1)
  const { isMobile, isTablet } = useBreakpoint();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileFileTreeOpen, setMobileFileTreeOpen] = useState(false);

  // Session timer
  const [sessionActive, setSessionOn] = useState(false);
  const [sessionSecs, setSessionSecs] = useState(0);
  const [sessionLog, setSessionLog] = useState('');
  const [templateId, setTemplateId] = useState('');
  const timerRef = useRef(null);
  const sessionStart = useRef(null);

  // AI coach
  const [aiOut, setAiOut] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  const [aiIn, setAiIn] = useState('');
  const aiRef = useRef(null);

  // UI misc
  const [copied, setCopied] = useState(false);
  const [activeSkill, setActiveSkill] = useState('dev');
  const [briefProj, setBriefProj] = useState(initialProjects[0]?.id || '');
  const [activeWF, setActiveWF] = useState(null);
  const [wfProj, setWfProj] = useState(initialProjects[0]?.id || '');
  const [newIdea, setNewIdea] = useState('');
  const [newStaging, setNewStaging] = useState({
    name: '',
    tag: 'IDEA_',
    project: initialProjects[0]?.id || '',
    notes: '',
  });
  const [newGoalForm, setNewGoalForm] = useState({
    title: '',
    target_amount: 3000,
    currency: 'GBP',
    timeframe: 'monthly',
    category: 'income',
  });
  const [activeGoalId, setActiveGoalId] = useState(
    initialGoals?.[0]?.id || null
  );
  const [showInt, setShowInt] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState('');

  // Modals
  const [modal, setModal] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false); // Phase 3.3
  const [searchFilters, setSearchFilters] = useState({
    project_id: '',
    folder: '',
    file_type: '',
    tag: '',
  });
  const [recentSearches, setRecentSearches] = useState([]); // Phase 3.3
  const [bootstrapWizardId, setBootstrapWiz] = useState(null);
  const [newProjForm, setNewProjForm] = useState({
    name: '',
    emoji: '📁',
    phase: 'BOOTSTRAP',
    desc: '',
    areaId: '',
    incomeTarget: 0,
    templateId: '',
  });
  const [newFileName, setNewFileName] = useState('');
  const [newFileFolder, setNewFileFolder] = useState('staging');
  const [customFolderForm, setCFForm] = useState({
    id: '',
    label: '',
    icon: '📁',
    desc: '',
  });
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMethod, setImportMethod] = useState('buidl'); // "buidl" | "json" | "folder"
  const [importLoading, setImportLoading] = useState(false);
  const [importForm, setImportForm] = useState({
    projectId: '',
    name: '',
    lifeAreaId: '',
    templateId: '',
  });
  const [importConflict, setImportConflict] = useState(null); // {projectId, overwrite callback}
  const [renameValue, setRenameValue] = useState('');

  // Onboarding state (Phase 4.2)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [onboardingCompleted, setOnboardingCompleted] = useState(
    user?.onboarding_completed || false
  );

  // Tour refs (Phase 4.2)
  const brainTabRef = useRef(null);
  const hubTabRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const aiCoachRef = useRef(null);
  // Notification ref (Phase 4.4)
  const notificationRef = useRef(null);

  // Persistence state
  const [saving, setSaving] = useState(false); // file save indicator
  const [toast, setToast] = useState(null); // {msg} or null
  const [loadingFiles, setLoadingFiles] = useState(false); // hub file loading
  const [commentsLoading, setCommentsLoading] = useState(false); // comments loading indicator

  // Offline mode state (Phase 2.4A)
  const [isOnline, setIsOnline] = useState(true);
  const [syncStatus, setSyncStatus] = useState('idle'); // "idle", "syncing", "synced", "error"
  const [queuedWrites, setQueuedWrites] = useState(0);

  // Notifications state (Phase 4.4)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Tasks state (Phase 5.4)
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    project_id: '',
    assignee_type: 'human',
    assignee_id: 'user',
  });
  const [taskAgents, setTaskAgents] = useState([]);
  const [taskLoadingAgents, setTaskLoadingAgents] = useState(false);

  // Desktop sync state (Phase 2.4B)
  const [syncState, setSyncState] = useState(null);
  const [syncChanges, setSyncChanges] = useState(null);
  const [showSyncReview, setShowSyncReview] = useState(false);

  // Daily checkin state (Phase 2.5)
  const [todayCheckin, setTodayCheckin] = useState(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinLastDate, setCheckinLastDate] = useState(
    localStorage.getItem('lastCheckinDate')
  );

  // Training log state (Phase 2.6)
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [weeklyTraining, setWeeklyTraining] = useState({
    count: 0,
    minutes: 0,
  });

  // Outreach log state (Phase 2.7)
  const [showOutreachModal, setShowOutreachModal] = useState(false);
  const [todayOutreach, setTodayOutreach] = useState([]); // today's entries
  const [weeklyOutreach, setWeeklyOutreach] = useState(0); // total this week

  // Drift detection state (Phase 2.10)
  const [driftFlags, setDriftFlags] = useState([]);
  const [driftExpanded, setDriftExpanded] = useState(false);
  const [driftDismissed, setDriftDismissed] = useState(() => {
    const saved = localStorage.getItem('driftDismissed');
    return saved ? JSON.parse(saved) : [];
  });

  const showToast = (msg) => setToast({ msg });

  // ── TAG OPS ──────────────────────────────────────────────
  const { getEntityTags, attachTag, detachTag, QuickTagRow } = useTagOps({
    entityTags,
    setEntityTags,
    userTags,
    setUserTags,
    tagInput,
    setTagInput,
    showToast,
  });

  // ── SEED DEFAULTS — called if areas, goals or templates are empty ─────────────
  useEffect(() => {
    if (areas.length === 0 && user) {
      const defaults = [
        {
          name: 'Business / Revenue',
          color: '#1a4fd6',
          icon: '💼',
          description: 'Revenue generating projects',
          sort_order: 1,
        },
        {
          name: 'Health / Body',
          color: '#10b981',
          icon: '🏋️',
          description: 'Physical health and training',
          sort_order: 2,
        },
        {
          name: 'Relationships',
          color: '#ec4899',
          icon: '❤️',
          description: 'Friends, family, and networking',
          sort_order: 3,
        },
        {
          name: 'Creative / Learning',
          color: '#8b5cf6',
          icon: '🎨',
          description: 'Skill building and side projects',
          sort_order: 4,
        },
        {
          name: 'Personal / Admin',
          color: '#64748b',
          icon: '🏠',
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
        title: 'Bootstrap → Thailand',
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
          icon: '🚀',
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
          icon: '🛠',
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
          icon: '✍️',
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
          icon: '💪',
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
          icon: '📄',
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

  // ── OFFLINE MODE (Phase 2.4) ────────────────────────────────
  // Sync state changes to cache
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

  // Check online status and listen to sync events
  useEffect(() => {
    const checkOnline = async () => {
      const online = await sync.isOnline();
      setIsOnline(online);
      setQueuedWrites(cache.getWriteQueue().length);
    };

    checkOnline();

    // Register sync event listeners
    sync.onStatusChange((status) => {
      setIsOnline(status === 'online');
      showToast(status === 'online' ? '✓ Back online' : '⚠ Offline mode');
    });

    sync.onSyncStart(() => {
      setSyncStatus('syncing');
      showToast('⟳ Syncing changes...');
    });

    sync.onSyncComplete((count) => {
      setSyncStatus(count > 0 ? 'synced' : 'idle');
      setQueuedWrites(0);
      if (count > 0) showToast(`✓ Synced ${count} changes`);
    });

    sync.onSyncError(() => {
      setSyncStatus('error');
      showToast('⚠ Sync failed, will retry');
    });

    // Periodic check every 5 seconds
    const checkInterval = setInterval(checkOnline, 5000);
    return () => clearInterval(checkInterval);
  }, []);

  // ── DERIVED ────────────────────────────────────────────────
  const hub = projects.find((p) => p.id === hubId);
  const focusP = projects.find((p) => p.id === focusId);
  const activeGoal = goals.find(
    (g) => g.id === (activeGoalId || (goals.length ? goals[0].id : null))
  );
  const totalIncome = activeGoal
    ? activeGoal.current_amount
    : projects.reduce((s, p) => s + (p.incomeTarget || 0), 0);
  const atRisk = projects.filter((p) => p.health < 50).length;
  const inReview = staging.filter((s) => s.status === 'in-review').length;
  const hubAllFolders = hub
    ? [...STANDARD_FOLDERS, ...(hub.customFolders || [])]
    : STANDARD_FOLDERS;

  // Phase 5.1: URI lookup map
  const projectsById = projects.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Area health logic
  const areaStats = areas.map((a) => {
    const areaProjects = projects.filter((p) => p.areaId === a.id);
    const health = areaProjects.length
      ? Math.round(
          areaProjects.reduce((s, p) => s + p.health, 0) / areaProjects.length
        )
      : 100;
    return { ...a, health, projectCount: areaProjects.length };
  });

  const [activeAreaFilter, setActiveAreaFilter] = useState(null);
  const filteredProjects = activeAreaFilter
    ? projects.filter((p) => p.areaId === activeAreaFilter)
    : projects;

  // ── SESSION TIMER ──────────────────────────────────────────
  useEffect(() => {
    if (sessionActive) {
      sessionStart.current = new Date();
      timerRef.current = setInterval(() => setSessionSecs((s) => s + 1), 1000);

      const handleBeforeUnload = (e) => {
        // We can't await endSession() here, but we can try to fire a beacon or sync request if we were using a different API pattern.
        // For now, we'll just log that we should save. In a real environment, we'd use navigator.sendBeacon.
        const dur = Math.floor((new Date() - sessionStart.current) / 1000);
        const data = JSON.stringify({
          project_id: focusId,
          duration_s: dur,
          log: '(Auto-saved on tab close)',
          started_at: sessionStart.current?.toISOString(),
          ended_at: new Date().toISOString(),
        });
        // Try beacon if API supported it without complex auth headers,
        // but our API needs Bearer token which beacon doesn't support well.
        // So we just add the standard listener to prompt user.
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        clearInterval(timerRef.current);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    } else {
      clearInterval(timerRef.current);
    }
  }, [sessionActive, focusId]);
  const fmtTime = (s) =>
    `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── SEARCH MODAL SHORTCUT (Phase 3.3) ─────────────────────
  useEffect(() => {
    // Load recent searches from localStorage
    try {
      const saved = localStorage.getItem('brain_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}

    // Cmd+K / Ctrl+K keyboard shortcut
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
      }
      // ESC to close
      if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close notification dropdown (Phase 4.4)
  useEffect(() => {
    if (!showNotifications) return;
    const handleClickOutside = (e) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

  // Save recent searches to localStorage
  const addRecentSearch = (query) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      5
    );
    setRecentSearches(updated);
    try {
      localStorage.setItem('brain_recent_searches', JSON.stringify(updated));
    } catch {}
  };

  // ── COMMENTS LOADER — fetch from DB when hub or active file changes ──
  useEffect(() => {
    if (!hubId || !hub?.activeFile) return;
    const filePath = hub.activeFile;
    const commKey = `${hubId}:${filePath}`;
    setCommentsLoading(true);
    commentsApi
      .list(hubId, filePath)
      .then(({ comments: rows }) => {
        const mapped = (rows || []).map((r) => ({
          id: r.id,
          text: r.text,
          date: r.created_at ? r.created_at.toString().slice(0, 10) : '',
          resolved: !!r.resolved,
        }));
        setComments((prev) => ({ ...prev, [commKey]: mapped }));
      })
      .catch(() => {
        /* silently ignore — existing UI still works */
      })
      .finally(() => setCommentsLoading(false));
  }, [hubId, hub?.activeFile]);

  // ── HUB LINKS — reload when hub changes ─────────────────────
  useEffect(() => {
    if (!hubId) return;
    linksApi
      .query('project', hubId)
      .then((d) => setHubLinks(d.links || []))
      .catch(() => {});
  }, [hubId]);

  // ── USER SETTINGS — load once on login ──────────────────────
  useEffect(() => {
    if (!user) return;
    settingsApi
      .get()
      .then((d) => {
        if (d.settings && Object.keys(d.settings).length) {
          setUserSettings((s) => ({ ...s, ...d.settings }));
          setSettingsForm((s) => ({ ...s, ...d.settings }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // ── DAILY CHECKIN — prompt on first visit of day (Phase 2.5) ──
  const currentMode = getMode(userSettings);
  useEffect(() => {
    if (!user) return;
    const checkinBehavior = getBehavior('daily_checkin', currentMode);
    if (checkinBehavior === 'off') return; // silent mode — skip entirely

    const today = new Date().toISOString().split('T')[0];
    const lastSavedDate = checkinLastDate;

    if (today !== lastSavedDate) {
      // First visit of day — load today's checkin or show modal
      const dailyCheckinsApi = async () => {
        try {
          const res = await fetch(
            `/api/data?resource=daily-checkins&date=${today}`,
            {
              headers: { Authorization: `Bearer ${token.get()}` },
            }
          );
          if (!res.ok) throw new Error('Failed to load checkin');
          const data = await res.json();

          if (data.checkin) {
            // Already checked in today
            setTodayCheckin(data.checkin);
            setCheckinLastDate(today);
            localStorage.setItem('lastCheckinDate', today);
          } else if (checkinBehavior === 'mandatory') {
            // Coach mode — show modal automatically
            setShowCheckinModal(true);
          }
          // Assistant mode ('available') — don't auto-show, user clicks to open
        } catch (e) {
          console.error('Checkin load error:', e);
          if (checkinBehavior === 'mandatory') setShowCheckinModal(true);
        }
      };
      dailyCheckinsApi();
    }
    // Load weekly training count + today's outreach + drift check + tasks + seed workflows
    if (user) {
      loadWeeklyTraining();
      if (getBehavior('outreach_enforcement', getMode(userSettings)) !== 'off')
        loadTodayOutreach();
      if (getBehavior('drift_alerts', getMode(userSettings)) !== 'off')
        loadDriftCheck();
      loadTasks();
      // Phase 5.5: Seed system workflows on first run
      seedSystemWorkflows().catch(() => {});
    }
  }, [user?.id]);

  // ── NOTIFICATIONS — load on mount and check triggers periodically (Phase 4.4) ──
  useEffect(() => {
    if (!user) return;
    const notifBehavior = getBehavior('notifications', getMode(userSettings));
    if (notifBehavior === 'none') return; // silent mode — no notifications

    // Initial load
    loadNotifications();

    // Check triggers on mount
    if (notifBehavior === 'all') checkNotificationTriggers();

    // Set up periodic checks (every 5 minutes)
    const interval = setInterval(
      () => {
        loadNotifications();
        if (notifBehavior === 'all') checkNotificationTriggers();
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, [user?.id]);

  // ── STAGING OPS ─────────────────────────────────────────
  const { addStaging, updateStagingStatus, moveToFolder } = useStagingOps({
    staging,
    setStaging,
    hubId,
    hub,
    setProjects,
    showToast,
  });

  // ── PROJECT CRUD, FILE OPS, ONBOARDING, BOOTSTRAP ────────
  const {
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
  } = useProjectCrud({
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
  });

  // ── METADATA OPS (Roadmap 2.3) ──────────────────────────
  const fetchMetadata = async (projId, filePath) => {
    setLoadingMetadata(true);
    try {
      const res = await fileMetadata.get(projId, filePath);
      setFileMetadata(res.metadata || null);
    } catch (e) {
      console.error('Failed to fetch metadata:', e);
      setFileMetadata(null);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const saveMetadata = async (projId, filePath, data) => {
    try {
      if (fileMetadata?.id) {
        await fileMetadata.update(fileMetadata.id, data);
      } else {
        await fileMetadata.create({
          project_id: projId,
          file_path: filePath,
          ...data,
        });
      }
      // Fetch fresh to sync state
      await fetchMetadata(projId, filePath);
      showToast('✓ Metadata saved');
    } catch (e) {
      console.error('Failed to save metadata:', e);
      showToast('⚠ Metadata save failed');
    }
  };

  // ── AI METADATA SUGGESTIONS (Phase 3.1) ─────────────────
  const requestAiSuggestions = useCallback(async () => {
    if (!hubId || !hub?.activeFile) return;
    const content = hub.files?.[hub.activeFile];
    if (!content) return;

    setLoadingAiSuggestions(true);
    try {
      const project = projects.find((p) => p.id === hubId);
      const res = await aiMetadataApi.suggest(
        hubId,
        hub.activeFile,
        content,
        project?.name,
        project?.phase
      );
      setAiSuggestions(res);
    } catch (e) {
      console.error('AI suggestions failed:', e);
      setAiSuggestions({ error: 'Failed to get suggestions' });
    } finally {
      setLoadingAiSuggestions(false);
    }
  }, [hubId, hub?.activeFile, hub?.files, projects]);

  const acceptAiSuggestion = useCallback(
    (type, value) => {
      showToast(`✓ Applied ${type}: ${value}`);
      // Auto-save after accepting suggestion
      if (type === 'tag') {
        // Tag will be attached via the existing tag system
        const fileEntityId = `${hubId}/${hub.activeFile}`;
        tagsApi
          .attachByName(value, 'file', fileEntityId)
          .then(() => {
            loadEntityTags();
          })
          .catch(() => {});
      }
    },
    [hubId, hub?.activeFile]
  );

  // Auto-request suggestions when file changes (if enabled)
  useEffect(() => {
    if (hubId && hub?.activeFile && userSettings?.aiMetadataAutoSuggest) {
      const timer = setTimeout(() => requestAiSuggestions(), 500);
      return () => clearTimeout(timer);
    }
  }, [
    hubId,
    hub?.activeFile,
    requestAiSuggestions,
    userSettings?.aiMetadataAutoSuggest,
  ]);

  // ── ONBOARDING CHECK (Phase 4.2) ─────────────────────────────
  useEffect(() => {
    // Check if onboarding should be shown
    if (
      user &&
      !onboardingCompleted &&
      projects.length === 0 &&
      templates.length > 0
    ) {
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [user, onboardingCompleted, projects.length, templates.length]);

  // ── IDEAS OPS — persisted ──────────────────────────────────

  // ── IDEAS + SESSION + CHECKIN + TRAINING + OUTREACH ─────
  const {
    addIdea,
    endSession,
    saveCheckin,
    loadWeeklyTraining,
    saveTraining,
    loadTodayOutreach,
    saveOutreach,
  } = useSessionOps({
    setIdeas,
    setNewIdea,
    projects,
    focusId,
    sessionSecs,
    sessionLog,
    sessionStart,
    setSessionOn,
    setSessionSecs,
    setSessionLog,
    setTodayCheckin,
    setCheckinLastDate,
    setShowCheckinModal,
    setWeeklyTraining,
    setShowTrainingModal,
    todayCheckin,
    setTodayOutreach,
    setWeeklyOutreach,
    setShowOutreachModal,
    saveFile,
    fmtTime,
    showToast,
  });

  // ── DRIFT DETECTION ──────────────────────────────────────
  const loadDriftCheck = async () => {
    try {
      const data = await driftApi.check();
      if (data && data.flags) {
        const activeFlags = data.flags.filter(
          (f) => !driftDismissed.includes(f.type)
        );
        setDriftFlags(activeFlags);
      }
    } catch (e) {
      console.error('Drift check error:', e);
    }
  };

  const dismissDriftFlag = (type) => {
    const updated = [...driftDismissed, type];
    setDriftDismissed(updated);
    localStorage.setItem('driftDismissed', JSON.stringify(updated));
    setDriftFlags((prev) => prev.filter((f) => f.type !== type));
  };

  // ── NOTIFICATIONS ────────────────────────────────────────
  const {
    loadNotifications,
    checkNotificationTriggers,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
  } = useNotifications({
    notifications,
    setNotifications,
    setUnreadCount,
    setNotificationsLoading,
  });

  // ── TASKS ────────────────────────────────────────────────
  const { loadTasks, createTask, completeTask, deleteTask } = useTaskOps({
    tasks,
    setTasks,
    setTasksLoading,
    setShowTaskModal,
    setTaskForm,
    setTaskAgents,
    showToast,
  });

  // ── SEARCH + CONTEXT + AI ────────────────────────────────
  const { runSearch, buildCtx, buildBrief, copy, askAI } = useAI({
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
  });

  // ── INTEGRATIONS (UI only for now) ─────────────────────────
  const [integrations, setIntegrations] = useState([
    {
      id: 'github',
      icon: '🐙',
      label: 'GitHub',
      desc: 'Repo status, last commit',
      connected: false,
      fields: ['repoUrl', 'accessToken'],
      docsUrl: 'https://docs.github.com/en/rest',
    },
    {
      id: 'netlify',
      icon: '🟢',
      label: 'Netlify',
      desc: 'Deploy status, build logs',
      connected: false,
      fields: ['siteId', 'apiToken'],
      docsUrl: 'https://docs.netlify.com/api/get-started/',
    },
    {
      id: 'tidb',
      icon: '🐬',
      label: 'TiDB',
      desc: 'DB connected',
      connected: true,
      fields: [],
      docsUrl: 'https://tidbcloud.com',
    },
    {
      id: 'farcaster',
      icon: '🟣',
      label: 'Farcaster',
      desc: 'Publish build-in-public',
      connected: false,
      fields: ['fid', 'signerUuid'],
      docsUrl: 'https://docs.farcaster.xyz/',
    },
    {
      id: 'twitter',
      icon: '🐦',
      label: 'Twitter/X',
      desc: 'Post launch threads',
      connected: false,
      fields: ['apiKey', 'apiSecret'],
      docsUrl: 'https://developer.twitter.com/en/docs',
    },
    {
      id: 'base',
      icon: '🔵',
      label: 'Base Chain',
      desc: 'Deploy contracts, mint',
      connected: false,
      fields: ['rpcUrl', 'walletAddress'],
      docsUrl: 'https://docs.base.org/',
    },
  ]);

  // ── TAB DEFINITIONS ────────────────────────────────────────
  const BRAIN_TABS_ALL = [
    { id: 'command', label: '⚡ Command' },
    { id: 'projects', label: '🗂 Projects' },
    { id: 'bootstrap', label: '🚀 Bootstrap' },
    {
      id: 'staging',
      label: `🌀 Staging${inReview > 0 ? ` (${inReview})` : ''}`,
    },
    { id: 'skills', label: '🤖 Skills' },
    { id: 'workflows', label: '⚙️ Workflows' },
    { id: 'integrations', label: '🔌 Connect' },
    { id: 'ideas', label: '💡 Ideas' },
    {
      id: 'tags',
      label: `🏷 Tags${userTags.length > 0 ? ` (${userTags.length})` : ''}`,
    },
    { id: 'ai', label: '💬 AI Coach' },
    { id: 'review', label: '📋 Review' },
    { id: 'export', label: '📤 Export' },
  ];
  const BRAIN_TABS =
    getBehavior('ai_coach_tab', currentMode) === 'hidden'
      ? BRAIN_TABS_ALL.filter((t) => t.id !== 'ai')
      : BRAIN_TABS_ALL;
  const HUB_TABS = [
    { id: 'editor', label: '📝 Editor' },
    { id: 'overview', label: '📊 Overview' },
    { id: 'folders', label: '📁 Folders' },
    {
      id: 'review',
      label: `🔄 Review${hub ? (staging.filter((s) => s.project === hubId && s.status === 'in-review').length > 0 ? ` (${staging.filter((s) => s.project === hubId && s.status === 'in-review').length})` : '') : ''}`,
    },
    { id: 'devlog', label: '📓 Dev Log' },
    { id: 'gantt', label: '📅 Timeline' },
    { id: 'comments', label: '💬 Comments' },
    {
      id: 'links',
      label: `🔗 Links${hubLinks.length > 0 ? ` (${hubLinks.length})` : ''}`,
    },
    { id: 'meta', label: '🔧 Meta' },
  ];

  // ── KEYBOARD SHORTCUTS LISTENER ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Show shortcuts modal: ? or Cmd+?
      if (e.key === '?' || (cmdOrCtrl && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // Search: Cmd+K
      if (cmdOrCtrl && e.key === 'k') {
        e.preventDefault();
        setShowSearchModal(true);
        return;
      }

      // Toggle Brain/Hub: Cmd+B
      if (cmdOrCtrl && e.key === 'b') {
        e.preventDefault();
        if (view === 'hub') setView('brain');
        else if (hubId) setView('hub');
        return;
      }

      // Undo: Cmd+Z
      if (cmdOrCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        const undone = fileHistory.undo();
        if (undone && undone.state) {
          // Restore the file content
          const { projectId, filePath, content } = undone.state;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? { ...p, files: { ...p.files, [filePath]: content } }
                : p
            )
          );
          // Save to API (silent)
          projectsApi.saveFile(projectId, filePath, content).catch(() => {});
          setUndoToast({ action: 'undone', message: `Undid ${undone.action}` });
          setTimeout(() => setUndoToast(null), 2000);
        }
        return;
      }

      // Redo: Cmd+Shift+Z or Cmd+Y
      if (
        (cmdOrCtrl && e.shiftKey && e.key === 'z') ||
        (cmdOrCtrl && e.key === 'y')
      ) {
        e.preventDefault();
        const redone = fileHistory.redo();
        if (redone && redone.state) {
          const { projectId, filePath, content } = redone.state;
          setProjects((prev) =>
            prev.map((p) =>
              p.id === projectId
                ? { ...p, files: { ...p.files, [filePath]: content } }
                : p
            )
          );
          projectsApi.saveFile(projectId, filePath, content).catch(() => {});
          setUndoToast({ action: 'redone', message: `Redid ${redone.action}` });
          setTimeout(() => setUndoToast(null), 2000);
        }
        return;
      }

      // Navigation shortcuts with 'g' prefix
      if (keySequence[0] === 'g') {
        if (e.key === 'c') {
          setTab('brain');
          setBrainTab('command');
        }
        if (e.key === 'p') {
          setTab('brain');
          setBrainTab('projects');
        }
        if (e.key === 's') {
          setTab('brain');
          setBrainTab('staging');
        }
        if (e.key === 'i') {
          setTab('brain');
          setBrainTab('ideas');
        }
        setKeySequence([]);
        return;
      }

      // Start 'g' sequence
      if (e.key === 'g' && !cmdOrCtrl) {
        setKeySequence(['g']);
        setTimeout(() => setKeySequence([]), 1000); // Reset after 1s
        return;
      }

      // New shortcuts with 'n' prefix
      if (keySequence[0] === 'n') {
        if (e.key === 'p') setModal('newProject');
        if (e.key === 'f') setModal('newFile');
        if (e.key === 'i') setNewIdea(''); // Focus idea input
        setKeySequence([]);
        return;
      }

      if (e.key === 'n' && !cmdOrCtrl) {
        setKeySequence(['n']);
        setTimeout(() => setKeySequence([]), 1000);
        return;
      }

      // Session timer: Space (when not in input)
      if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        sessionActive ? endSession() : startSession();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, hubId, keySequence, fileHistory, sessionActive]);

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div
      style={{
        ...S.root,
        fontFamily: `'${userSettings.font}','JetBrains Mono','Fira Code',monospace`,
        fontSize: userSettings.fontSize,
      }}
    >
      {toast && <Toast msg={toast.msg} onDone={() => setToast(null)} />}

      {/* Undo/Redo Toast */}
      {undoToast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            background: C.surface,
            border: `1px solid ${C.blue}40`,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 11,
            color: C.blue2,
            zIndex: 9999,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{undoToast.action === 'undone' ? '↩️' : '↪️'}</span>
          <span>{undoToast.message}</span>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}

      {/* ── TOP BAR ── */}
      <div
        style={{
          background: 'linear-gradient(180deg,#0a0f1e,#070b14)',
          borderBottom: `1px solid ${C.border}`,
          padding: isMobile ? '10px 12px 0' : '12px 20px 0',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Mobile Header */}
          {isMobile ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              {/* Hamburger Menu */}
              <button
                style={{
                  ...S.btn('ghost'),
                  padding: '8px 10px',
                  fontSize: 18,
                  minWidth: 44,
                  minHeight: 44,
                }}
                onClick={() => setMobileNavOpen(true)}
                aria-label="Open menu"
              >
                ☰
              </button>

              {/* App Title */}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: '#f1f5f9',
                    lineHeight: 1.1,
                  }}
                >
                  {view === 'hub' && hub
                    ? `${hub.emoji} ${hub.name}`
                    : 'THE BRAIN 🧠'}
                </div>
              </div>

              {/* Notification Bell Mobile */}
              <button
                style={{
                  ...S.btn('ghost'),
                  padding: '8px',
                  fontSize: 16,
                  minWidth: 44,
                  minHeight: 44,
                  position: 'relative',
                }}
                onClick={() => setShowNotifications(true)}
                aria-label={`${unreadCount} notifications`}
              >
                🔔
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: C.red,
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid ' + C.bg,
                    }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Session Timer (condensed) */}
              <div
                onClick={() => {
                  if (!sessionActive) setSessionOn(true);
                  else endSession();
                }}
                style={{
                  background: sessionActive
                    ? 'rgba(16,185,129,0.08)'
                    : C.surface,
                  border: `1px solid ${sessionActive ? '#10b98140' : C.border}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  minWidth: 44,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: sessionActive ? C.green : '#475569',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {sessionActive ? fmtTime(sessionSecs) : '▶'}
                </div>
              </div>
            </div>
          ) : (
            /* Desktop Header */
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      color: C.blue,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Project OS · v6 · {user?.name || user?.email || 'Builder'}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      lineHeight: 1.1,
                    }}
                  >
                    {view === 'hub' && hub
                      ? `${hub.emoji} ${hub.name}`
                      : 'THE BRAIN 🧠'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  <button
                    ref={brainTabRef}
                    style={S.btn(view === 'brain' ? 'primary' : 'ghost')}
                    onClick={() => setView('brain')}
                  >
                    🧠 Brain
                  </button>
                  {hub && (
                    <button
                      ref={hubTabRef}
                      style={S.btn(view === 'hub' ? 'primary' : 'ghost')}
                      onClick={() => setView('hub')}
                    >
                      🗂 Hub
                    </button>
                  )}
                  <button
                    style={{ ...S.btn('ghost'), fontSize: 9 }}
                    onClick={() => setModal('new-project')}
                  >
                    + Project
                  </button>
                </div>
                {/* Search - Phase 3.3: New Search Modal with Cmd+K */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    fontSize: 10,
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  onClick={() => setShowSearchModal(true)}
                >
                  <span>🔍</span>
                  <span>Search</span>
                  <span
                    style={{
                      fontSize: 9,
                      color: C.dim,
                      background: C.bg,
                      padding: '2px 5px',
                      borderRadius: 3,
                    }}
                  >
                    ⌘K
                  </span>
                </button>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {/* Keyboard shortcuts */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '5px 8px',
                    fontSize: 14,
                  }}
                  title="Keyboard Shortcuts (?):"
                  onClick={() => setShowShortcutsModal(true)}
                >
                  ⌨️
                </button>
                {/* Settings gear */}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '5px 8px',
                    fontSize: 14,
                  }}
                  title="Settings"
                  onClick={() => {
                    setSettingsForm({ ...userSettings });
                    setModal('settings');
                  }}
                >
                  🔧
                </button>
                {/* Session timer */}
                <div
                  ref={sessionTimerRef}
                  onClick={() => {
                    if (!sessionActive) setSessionOn(true);
                    else endSession();
                  }}
                  style={{
                    background: sessionActive
                      ? 'rgba(16,185,129,0.08)'
                      : C.surface,
                    border: `1px solid ${sessionActive ? '#10b98140' : C.border}`,
                    borderRadius: 6,
                    padding: '5px 11px',
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: sessionActive ? C.green : '#475569',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {sessionActive ? fmtTime(sessionSecs) : '▶ START'}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {sessionActive ? 'End & Log' : 'Session'}
                  </div>
                </div>
                {/* Offline Mode Status (Phase 2.4) */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isOnline ? C.green : C.amber,
                    }}
                  >
                    {isOnline ? '✓' : '⚠'}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                    {queuedWrites > 0 && ` (${queuedWrites})`}
                  </div>
                </div>
                {/* Energy Level Status (Phase 2.5) */}
                {todayCheckin && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          todayCheckin.energy_level <= 4
                            ? C.amber
                            : todayCheckin.energy_level <= 7
                              ? C.amber
                              : C.green,
                      }}
                    >
                      {todayCheckin.energy_level <= 4
                        ? '🌙'
                        : todayCheckin.energy_level <= 7
                          ? '🔄'
                          : '⚡'}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      {todayCheckin.energy_level}/10
                    </div>
                  </div>
                )}
                {/* Assistant mode: Check In button when no checkin yet */}
                {!todayCheckin &&
                  getBehavior('daily_checkin', currentMode) === 'available' && (
                    <div
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => setShowCheckinModal(true)}
                      title="Daily check-in"
                    >
                      <div style={{ fontSize: 14 }}>📋</div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.blue,
                          textTransform: 'uppercase',
                        }}
                      >
                        Check In
                      </div>
                    </div>
                  )}
                {/* Training count (Phase 2.6) */}
                <div
                  style={{ textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setShowTrainingModal(true)}
                  title="Log training"
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color:
                        weeklyTraining.count >= 3
                          ? C.green
                          : weeklyTraining.count >= 1
                            ? C.amber
                            : C.dim,
                    }}
                  >
                    🥋
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    {weeklyTraining.count}/3
                  </div>
                </div>
                {/* Outreach indicator (Phase 2.7) — mode-aware */}
                {shouldShow('outreach_enforcement', currentMode) && (
                  <div
                    style={{ textAlign: 'center', cursor: 'pointer' }}
                    onClick={() => setShowOutreachModal(true)}
                    title="Log outreach"
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: todayOutreach.length > 0 ? C.purple : C.dim,
                      }}
                    >
                      📣
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      {todayOutreach.length > 0
                        ? `${todayOutreach.length} today`
                        : 'none'}
                    </div>
                  </div>
                )}
                {/* Notification Bell (Phase 4.4) — mode-aware */}
                {shouldShow('notifications', currentMode) && (
                  <div ref={notificationRef} style={{ position: 'relative' }}>
                    <div
                      style={{ textAlign: 'center', cursor: 'pointer' }}
                      onClick={() => setShowNotifications((v) => !v)}
                      title={`${unreadCount} unread notifications`}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: unreadCount > 0 ? C.red : C.dim,
                          position: 'relative',
                        }}
                      >
                        🔔
                        {unreadCount > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -4,
                              right: -4,
                              background: C.red,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              minWidth: 14,
                              height: 14,
                              borderRadius: 7,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '2px solid ' + C.bg,
                            }}
                          >
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          textTransform: 'uppercase',
                        }}
                      >
                        {unreadCount > 0 ? `${unreadCount} new` : 'Alerts'}
                      </div>
                    </div>

                    {/* Notification Dropdown (Desktop only) */}
                    {!isMobile && showNotifications && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          width: 360,
                          maxHeight: 480,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          zIndex: 400,
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: `1px solid ${C.border}`,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600 }}>
                            🔔 Notifications
                          </div>
                          {unreadCount > 0 && (
                            <button
                              style={{
                                ...S.btn('ghost'),
                                fontSize: 9,
                                padding: '4px 8px',
                              }}
                              onClick={markAllNotificationsRead}
                            >
                              Mark all read
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <div style={{ overflowY: 'auto', maxHeight: 360 }}>
                          {notificationsLoading ? (
                            <div
                              style={{
                                padding: 24,
                                textAlign: 'center',
                                color: C.muted,
                                fontSize: 11,
                              }}
                            >
                              Loading...
                            </div>
                          ) : notifications.length === 0 ? (
                            <div
                              style={{
                                padding: 24,
                                textAlign: 'center',
                                color: C.muted,
                                fontSize: 11,
                              }}
                            >
                              No notifications yet
                            </div>
                          ) : (
                            notifications.map((n) => {
                              const typeIcon =
                                {
                                  daily_checkin: '🌅',
                                  training_weekly: '🥋',
                                  project_health: '⚠️',
                                  staging_pending: '📋',
                                  drift_alert: '🚨',
                                }[n.type] || '📢';
                              return (
                                <div
                                  key={n.id}
                                  style={{
                                    padding: '12px 16px',
                                    borderBottom: `1px solid ${C.border}`,
                                    background: n.read
                                      ? 'transparent'
                                      : 'rgba(26,79,214,0.05)',
                                    cursor: n.action_url
                                      ? 'pointer'
                                      : 'default',
                                    opacity: n.read ? 0.7 : 1,
                                  }}
                                  onClick={() => {
                                    if (!n.read) markNotificationRead(n.id);
                                    if (n.action_url) {
                                      // Parse action_url to navigate
                                      if (n.action_url.includes('hub=')) {
                                        const hubId =
                                          n.action_url.match(
                                            /hub=([^&]+)/
                                          )?.[1];
                                        if (hubId) openHub(hubId);
                                      } else if (
                                        n.action_url.includes('action=checkin')
                                      ) {
                                        setShowCheckinModal(true);
                                      } else if (
                                        n.action_url.includes('action=training')
                                      ) {
                                        setShowTrainingModal(true);
                                      }
                                      setShowNotifications(false);
                                    }
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      gap: 8,
                                      alignItems: 'flex-start',
                                    }}
                                  >
                                    <span
                                      style={{ fontSize: 14, flexShrink: 0 }}
                                    >
                                      {typeIcon}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 11,
                                          lineHeight: 1.4,
                                          color: C.text,
                                        }}
                                      >
                                        {n.message}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: 9,
                                          color: C.dim,
                                          marginTop: 4,
                                        }}
                                      >
                                        {new Date(n.created_at).toLocaleString(
                                          undefined,
                                          {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </div>
                                    </div>
                                    {!n.read && (
                                      <div
                                        style={{
                                          width: 8,
                                          height: 8,
                                          borderRadius: 4,
                                          background: C.blue,
                                          flexShrink: 0,
                                          marginTop: 4,
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Footer */}
                        <div
                          style={{
                            padding: '10px 16px',
                            borderTop: `1px solid ${C.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span style={{ fontSize: 9, color: C.dim }}>
                            {notifications.length} total
                          </span>
                          <button
                            style={{
                              ...S.btn('ghost'),
                              fontSize: 9,
                              padding: '4px 8px',
                            }}
                            onClick={() => {
                              setShowNotifications(false);
                              checkNotificationTriggers();
                            }}
                          >
                            🔄 Check now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {[
                  { v: projects.length, l: 'Projects' },
                  {
                    v: `${activeGoal?.currency === 'USD' ? '$' : activeGoal?.currency === 'EUR' ? '€' : '£'}${totalIncome}`,
                    l: activeGoal?.title || 'Goal',
                  },
                  {
                    v: `${Math.round((totalIncome / (activeGoal?.target_amount || 3000)) * 100)}%`,
                    l: 'Status',
                  },
                  atRisk > 0 ? { v: atRisk, l: '⚠ At Risk', c: C.amber } : null,
                ]
                  .filter(Boolean)
                  .map((s) => (
                    <div key={s.l} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: s.c || C.blue2,
                        }}
                      >
                        {s.v}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.dim,
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.l}
                      </div>
                    </div>
                  ))}
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={onLogout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {sessionActive && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input
                style={{ ...S.input, fontSize: 11 }}
                placeholder="What are you working on?"
                value={sessionLog}
                onChange={(e) => setSessionLog(e.target.value)}
              />
              <button
                style={{ ...S.btn('danger'), fontSize: 9 }}
                onClick={endSession}
              >
                End & Log
              </button>
            </div>
          )}

          {/* Tabs - scrollable on mobile */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              overflowX: isMobile ? 'auto' : 'visible',
              flexWrap: isMobile ? 'nowrap' : 'wrap',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {view === 'brain'
              ? BRAIN_TABS.map((t) => (
                  <button
                    key={t.id}
                    ref={t.id === 'ai' ? aiCoachRef : null}
                    style={{
                      ...S.tab(mainTab === t.id),
                      flexShrink: isMobile ? 0 : 'auto',
                      padding: isMobile ? '10px 16px' : '7px 13px',
                    }}
                    onClick={() => {
                      setMainTab(t.id);
                      if (t.id !== 'command') setActiveAreaFilter(null);
                    }}
                  >
                    {t.label}
                  </button>
                ))
              : HUB_TABS.map((t) => (
                  <button
                    key={t.id}
                    style={{
                      ...S.tab(hubTab === t.id, '#10b981'),
                      flexShrink: isMobile ? 0 : 'auto',
                      padding: isMobile ? '10px 16px' : '7px 13px',
                    }}
                    onClick={() => setHubTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
            {view === 'hub' && hub && !isMobile && (
              <div
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  gap: 4,
                  paddingBottom: 4,
                }}
              >
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => setModal('new-custom-folder')}
                >
                  + Folder
                </button>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => {
                    setRenameValue(hub.name);
                    setModal('rename-project');
                  }}
                >
                  ✏ Rename
                </button>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 9 }}
                  onClick={() => exportProject(hubId)}
                >
                  ⬇ Export
                </button>
                <button
                  style={{ ...S.btn('danger'), fontSize: 9 }}
                  onClick={() => setModal('delete-project')}
                >
                  🗑
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MOBILE NAVIGATION DRAWER ── */}
      {mobileNavOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              background: C.surface,
              borderRight: `1px solid ${C.border}`,
              padding: 16,
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700 }}>
                🧠 The Brain
              </span>
              <button
                style={{ ...S.btn('ghost'), padding: '6px 10px', fontSize: 16 }}
                onClick={() => setMobileNavOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Main Navigation */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.dim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                Navigation
              </div>
              <button
                style={{
                  ...S.btn(view === 'brain' ? 'primary' : 'ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setView('brain');
                  setMobileNavOpen(false);
                }}
              >
                🧠 Brain
              </button>
              {hub && (
                <button
                  style={{
                    ...S.btn(view === 'hub' ? 'primary' : 'ghost'),
                    width: '100%',
                    marginBottom: 8,
                    justifyContent: 'flex-start',
                    minHeight: 44,
                  }}
                  onClick={() => {
                    setView('hub');
                    setMobileNavOpen(false);
                  }}
                >
                  🗂 Hub ({hub.name})
                </button>
              )}
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setModal('new-project');
                  setMobileNavOpen(false);
                }}
              >
                + New Project
              </button>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginBottom: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setShowSearchModal(true);
                  setMobileNavOpen(false);
                }}
              >
                🔍 Search
              </button>
            </div>

            {/* Quick Stats */}
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 9,
                  color: C.dim,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                Status
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: C.blue2 }}
                  >
                    {projects.length}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    Projects
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: C.green }}
                  >
                    {Math.round(
                      (totalIncome / (activeGoal?.target_amount || 3000)) * 100
                    )}
                    %
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      textTransform: 'uppercase',
                    }}
                  >
                    Goal
                  </div>
                </div>
                {atRisk > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{ fontSize: 16, fontWeight: 700, color: C.amber }}
                    >
                      {atRisk}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: C.dim,
                        textTransform: 'uppercase',
                      }}
                    >
                      At Risk
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settings */}
            <div>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={() => {
                  setSettingsForm({ ...userSettings });
                  setModal('settings');
                  setMobileNavOpen(false);
                }}
              >
                🔧 Settings
              </button>
              <button
                style={{
                  ...S.btn('ghost'),
                  width: '100%',
                  marginTop: 8,
                  justifyContent: 'flex-start',
                  minHeight: 44,
                }}
                onClick={onLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE NOTIFICATIONS DRAWER (Phase 4.4) ── */}
      {isMobile && showNotifications && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          onClick={() => setShowNotifications(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.7)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '85%',
              maxWidth: 360,
              background: C.surface,
              borderLeft: `1px solid ${C.border}`,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                🔔 Notifications
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {unreadCount > 0 && (
                  <button
                    style={{
                      ...S.btn('ghost'),
                      fontSize: 9,
                      padding: '6px 10px',
                    }}
                    onClick={markAllNotificationsRead}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  style={{
                    ...S.btn('ghost'),
                    padding: '6px 10px',
                    fontSize: 16,
                  }}
                  onClick={() => setShowNotifications(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {notificationsLoading ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 12,
                  }}
                >
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 12,
                  }}
                >
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const typeIcon =
                    {
                      daily_checkin: '🌅',
                      training_weekly: '🥋',
                      project_health: '⚠️',
                      staging_pending: '📋',
                      drift_alert: '🚨',
                    }[n.type] || '📢';
                  return (
                    <div
                      key={n.id}
                      style={{
                        padding: '16px',
                        borderBottom: `1px solid ${C.border}`,
                        background: n.read
                          ? 'transparent'
                          : 'rgba(26,79,214,0.05)',
                        cursor: n.action_url ? 'pointer' : 'default',
                        opacity: n.read ? 0.7 : 1,
                      }}
                      onClick={() => {
                        if (!n.read) markNotificationRead(n.id);
                        if (n.action_url) {
                          if (n.action_url.includes('hub=')) {
                            const hubId =
                              n.action_url.match(/hub=([^&]+)/)?.[1];
                            if (hubId) openHub(hubId);
                          } else if (n.action_url.includes('action=checkin')) {
                            setShowCheckinModal(true);
                          } else if (n.action_url.includes('action=training')) {
                            setShowTrainingModal(true);
                          }
                          setShowNotifications(false);
                        }
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                          {typeIcon}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: C.text,
                            }}
                          >
                            {n.message}
                          </div>
                          <div
                            style={{ fontSize: 10, color: C.dim, marginTop: 6 }}
                          >
                            {new Date(n.created_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        {!n.read && (
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 5,
                              background: C.blue,
                              flexShrink: 0,
                              marginTop: 4,
                            }}
                          />
                        )}
                      </div>
                      <button
                        style={{
                          ...S.btn('ghost'),
                          fontSize: 9,
                          padding: '4px 8px',
                          marginTop: 10,
                          opacity: 0.6,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px',
                borderTop: `1px solid ${C.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 10, color: C.dim }}>
                {notifications.length} total
              </span>
              <button
                style={{ ...S.btn('ghost'), fontSize: 10, padding: '8px 12px' }}
                onClick={() => {
                  checkNotificationTriggers();
                }}
              >
                🔄 Check now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {modal === 'new-project' && (
        <Modal title="New Project" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...S.input, width: 60 }}
              placeholder="🚀"
              value={newProjForm.emoji}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, emoji: e.target.value }))
              }
            />
            <input
              style={S.input}
              placeholder="Project name..."
              value={newProjForm.name}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, name: e.target.value }))
              }
              autoFocus
            />
          </div>
          <select
            style={{ ...S.sel, marginBottom: 8 }}
            value={newProjForm.templateId}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, templateId: e.target.value }))
            }
          >
            <option value="">Select Template...</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
          {(!newProjForm.templateId ||
            templates.find((t) => t.id === newProjForm.templateId)?.config
              ?.phases?.length > 0) && (
            <select
              style={{ ...S.sel, marginBottom: 8 }}
              value={newProjForm.phase}
              onChange={(e) =>
                setNewProjForm((f) => ({ ...f, phase: e.target.value }))
              }
            >
              {newProjForm.templateId
                ? templates
                    .find((t) => t.id === newProjForm.templateId)
                    .config.phases.map((p) => <option key={p}>{p}</option>)
                : BUIDL_PHASES.map((p) => <option key={p}>{p}</option>)}
            </select>
          )}
          <textarea
            style={{
              ...S.input,
              height: 60,
              resize: 'vertical',
              marginBottom: 8,
            }}
            placeholder="One sentence description..."
            value={newProjForm.desc}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, desc: e.target.value }))
            }
          />
          <select
            style={{ ...S.sel, marginBottom: 12 }}
            value={newProjForm.areaId}
            onChange={(e) =>
              setNewProjForm((f) => ({ ...f, areaId: e.target.value }))
            }
          >
            <option value="">Assign to Area (Optional)</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                newProjForm.name.trim() && createProject(newProjForm)
              }
            >
              Create + Save to DB
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>

          {/* Onboarding suggestion for new users (Phase 4.2) */}
          {projects.length === 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 9, color: C.muted }}>
                💡 <strong>New here?</strong> Try the{' '}
                <button
                  style={{
                    ...S.btn('ghost'),
                    fontSize: 9,
                    padding: '2px 6px',
                    marginLeft: 4,
                  }}
                  onClick={() => {
                    setModal(null);
                    setShowOnboarding(true);
                  }}
                >
                  onboarding wizard
                </button>{' '}
                for a guided setup.
              </div>
            </div>
          )}
        </Modal>
      )}

      {modal === 'new-file' && hub && (
        <Modal title={`New File — ${hub.name}`} onClose={() => setModal(null)}>
          <select
            style={{ ...S.sel, marginBottom: 8 }}
            value={newFileFolder}
            onChange={(e) => setNewFileFolder(e.target.value)}
          >
            <option value="">Root</option>
            {hubAllFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.icon || '📁'} {f.label}
              </option>
            ))}
          </select>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="filename.md"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && createFile(hubId, newFileFolder, newFileName)
            }
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() => createFile(hubId, newFileFolder, newFileName)}
            >
              Create
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'new-custom-folder' && hub && (
        <Modal title="Add Custom Folder" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              style={{ ...S.input, width: 60 }}
              placeholder="📁"
              value={customFolderForm.icon}
              onChange={(e) =>
                setCFForm((f) => ({ ...f, icon: e.target.value }))
              }
            />
            <input
              style={S.input}
              placeholder="folder-id (no spaces)"
              value={customFolderForm.id}
              onChange={(e) =>
                setCFForm((f) => ({
                  ...f,
                  id: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                }))
              }
              autoFocus
            />
          </div>
          <input
            style={{ ...S.input, marginBottom: 8 }}
            placeholder="Display label"
            value={customFolderForm.label}
            onChange={(e) =>
              setCFForm((f) => ({ ...f, label: e.target.value }))
            }
          />
          <input
            style={{ ...S.input, marginBottom: 12 }}
            placeholder="Description..."
            value={customFolderForm.desc}
            onChange={(e) => setCFForm((f) => ({ ...f, desc: e.target.value }))}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                customFolderForm.id.trim() &&
                customFolderForm.label.trim() &&
                addCustomFolder(hubId, customFolderForm)
              }
            >
              Add Folder
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'rename-project' && hub && (
        <Modal title={`Rename: ${hub.name}`} onClose={() => setModal(null)}>
          <input
            style={{ ...S.input, marginBottom: 12 }}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) =>
              e.key === 'Enter' && renameProject(hubId, renameValue)
            }
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={S.btn('primary')}
              onClick={() =>
                renameValue.trim() && renameProject(hubId, renameValue)
              }
            >
              Rename
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {modal === 'delete-project' && hub && (
        <Modal title="Delete Project?" onClose={() => setModal(null)}>
          <div
            style={{
              fontSize: 11,
              color: C.text,
              marginBottom: 16,
              lineHeight: 1.7,
            }}
          >
            Delete <strong>{hub.name}</strong> from the database? This cannot be
            undone. Export first if you want a backup.
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              style={{ ...S.btn('primary'), background: C.red }}
              onClick={() => deleteProject(hubId)}
            >
              Delete from DB
            </button>
            <button
              style={S.btn('ghost')}
              onClick={() => {
                exportProject(hubId);
                setModal(null);
              }}
            >
              Export first
            </button>
            <button style={S.btn('ghost')} onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {bootstrapWizardId && (
        <BootstrapWizard
          project={projects.find((p) => p.id === bootstrapWizardId)}
          onComplete={(brief) => completeBootstrap(bootstrapWizardId, brief)}
          onClose={() => {
            setBootstrapWiz(null);
            openHub(bootstrapWizardId);
          }}
        />
      )}

      {/* ── ONBOARDING WIZARD (Phase 4.2) ─────────────────────── */}
      {showOnboarding && (
        <OnboardingWizard
          user={user}
          templates={templates}
          areas={areas}
          isMobile={isMobile}
          onCreateGoal={handleOnboardingCreateGoal}
          onCreateProject={handleOnboardingCreateProject}
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      {/* ── TOUR TOOLTIP (Phase 4.2) ──────────────────────────── */}
      {tourStep > 0 && tourStep <= 4 && (
        <TourTooltip
          step={tourStep}
          totalSteps={4}
          title={
            tourStep === 1
              ? '🧠 Brain — Your Command Centre'
              : tourStep === 2
                ? '🗂 Hub — Project Workspace'
                : tourStep === 3
                  ? '⚡ Session Timer — Track Focus'
                  : '🤖 AI Coach — Get Help'
          }
          content={
            tourStep === 1
              ? "The Brain tab shows your command centre — today's focus, area health, training stats, and goal progress. Switch between different views here."
              : tourStep === 2
                ? 'Each project has a Hub with files, editor, overview, and review pipeline. Create folders, write markdown, and organize your work.'
                : tourStep === 3
                  ? "Click the timer to start a focused work session. When you're done, log what you accomplished — it gets saved to your DEVLOG.md automatically."
                  : 'The AI Coach can help brainstorm, review code, or suggest next steps. It has full context of your project and can generate briefings for your agents.'
          }
          targetRef={
            tourStep === 1
              ? brainTabRef
              : tourStep === 2
                ? hubTabRef
                : tourStep === 3
                  ? sessionTimerRef
                  : aiCoachRef
          }
          onNext={() => {
            if (tourStep === 1) setView('hub');
            if (tourStep === 2 && sessionActive) setTourStep(4);
            else if (tourStep < 4) setTourStep(tourStep + 1);
            else setTourStep(0);
          }}
          onPrev={() => setTourStep(Math.max(1, tourStep - 1))}
          onSkip={() => setTourStep(0)}
          isMobile={isMobile}
        />
      )}

      {modal === 'manage-goals' && (
        <Modal title="Manage Goals" onClose={() => setModal(null)} width={500}>
          <div style={{ marginBottom: 16 }}>
            <span style={S.label()}>Active Goal</span>
            <select
              style={S.sel}
              value={activeGoalId || ''}
              onChange={(e) => setActiveGoalId(e.target.value)}
            >
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} ({g.currency})
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              borderTop: `1px solid ${C.border}`,
              paddingTop: 16,
              marginBottom: 16,
            }}
          >
            <span style={S.label()}>Create New Goal</span>
            <input
              style={{ ...S.input, marginBottom: 8 }}
              placeholder="Goal Title (e.g. Save for House)"
              value={newGoalForm.title}
              onChange={(e) =>
                setNewGoalForm({ ...newGoalForm, title: e.target.value })
              }
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                style={S.input}
                type="number"
                placeholder="Target Amount"
                value={newGoalForm.target_amount}
                onChange={(e) =>
                  setNewGoalForm({
                    ...newGoalForm,
                    target_amount: parseInt(e.target.value),
                  })
                }
              />
              <select
                style={S.sel}
                value={newGoalForm.currency}
                onChange={(e) =>
                  setNewGoalForm({ ...newGoalForm, currency: e.target.value })
                }
              >
                <option value="GBP">GBP (£)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
            <button
              style={S.btn('primary')}
              onClick={async () => {
                if (!newGoalForm.title) return;
                try {
                  const res = await goalsApi.create(newGoalForm);
                  const updated = await goalsApi.list();
                  setGoals(updated.goals || []);
                  if (res.id) setActiveGoalId(res.id);
                  setNewGoalForm({
                    title: '',
                    target_amount: 3000,
                    currency: 'GBP',
                    timeframe: 'monthly',
                    category: 'income',
                  });
                } catch (e) {
                  showToast('Failed to create goal');
                }
              }}
            >
              Create Goal
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
            <span style={S.label()}>Existing Goals</span>
            {goals.map((g) => (
              <div
                key={g.id}
                style={{
                  padding: '8px 0',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                  }}
                >
                  <div style={{ fontSize: 11 }}>
                    {g.title} ({g.currency}
                    {g.current_amount}/{g.target_amount})
                  </div>
                  <button
                    style={{
                      ...S.btn('danger'),
                      padding: '2px 6px',
                      fontSize: 8,
                    }}
                    onClick={async () => {
                      if (!confirm('Delete this goal?')) return;
                      await goalsApi.delete(g.id);
                      const updated = await goalsApi.list();
                      setGoals(updated.goals || []);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <QuickTagRow entityType="goal" entityId={g.id} />
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="⚙ Settings" onClose={() => setModal(null)} width={420}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <span style={S.label()}>Font Family</span>
              <select
                style={S.sel}
                value={settingsForm.font}
                onChange={(e) =>
                  setSettingsForm((f) => ({ ...f, font: e.target.value }))
                }
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Courier New">Courier New</option>
                <option value="monospace">System Monospace</option>
              </select>
            </div>
            <div>
              <span style={S.label()}>Font Size</span>
              <select
                style={S.sel}
                value={settingsForm.fontSize}
                onChange={(e) =>
                  setSettingsForm((f) => ({
                    ...f,
                    fontSize: Number(e.target.value),
                  }))
                }
              >
                {[11, 12, 13, 14].map((n) => (
                  <option key={n} value={n}>
                    {n}px
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                padding: '10px 12px',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                fontFamily: `'${settingsForm.font}',monospace`,
                fontSize: settingsForm.fontSize,
                color: C.muted,
              }}
            >
              Preview: THE BRAIN v6 · Wired Edition · Bootstrap → Thailand
            </div>

            {/* Assistance Mode */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>
                Assistance Mode
              </label>
              <select
                value={settingsForm.assistance_mode || 'coach'}
                onChange={(e) =>
                  setSettingsForm((s) => ({
                    ...s,
                    assistance_mode: e.target.value,
                  }))
                }
                style={{
                  background: C.bg,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  fontSize: 11,
                }}
              >
                {Object.entries(MODE_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 9, color: C.muted, padding: '4px 0' }}>
                {MODE_INFO[settingsForm.assistance_mode || 'coach'].description}
              </div>
            </div>

            {/* AI Provider Settings */}
            <AIProviderSettings />

            {/* Onboarding re-trigger (Phase 4.2) */}
            <div
              style={{
                padding: '12px',
                background: `${C.blue}08`,
                border: `1px solid ${C.blue}30`,
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                🎓 Getting Started
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
                New to The Brain? Run the onboarding wizard again.
              </div>
              <button
                style={{
                  ...S.btn('ghost'),
                  fontSize: 9,
                  borderColor: C.blue,
                  color: C.blue,
                }}
                onClick={() => {
                  setModal(null);
                  setShowOnboarding(true);
                }}
              >
                Restart Onboarding
              </button>
            </div>

            {/* Danger Zone: Wipe User Data */}
            <div
              style={{
                padding: '12px',
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#ef4444',
                  marginBottom: 4,
                }}
              >
                ⚠ Danger Zone
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}>
                Permanently delete all your data (projects, tasks, memories,
                settings). Your account will remain but all content will be
                erased. This cannot be undone.
              </div>
              <button
                style={{
                  ...S.btn('ghost'),
                  fontSize: 9,
                  borderColor: '#ef4444',
                  color: '#ef4444',
                }}
                onClick={async () => {
                  if (
                    !window.confirm(
                      'Are you sure you want to delete ALL your data? This cannot be undone.'
                    )
                  )
                    return;
                  if (
                    !window.confirm(
                      'This is your LAST chance. Type OK to confirm you want to erase everything.'
                    )
                  )
                    return;
                  try {
                    await settingsApi.wipeUserData();
                    showToast('All user data deleted');
                    setModal(null);
                    window.location.reload();
                  } catch (e) {
                    showToast('Failed to wipe data: ' + e.message);
                  }
                }}
              >
                Erase All My Data
              </button>
            </div>

            <button
              style={S.btn('primary')}
              onClick={async () => {
                try {
                  await settingsApi.put(settingsForm);
                  setUserSettings({ ...settingsForm });
                  setModal(null);
                  showToast('✓ Settings saved');
                } catch (e) {
                  showToast('Failed to save settings');
                }
              }}
            >
              Save Settings
            </button>
          </div>
        </Modal>
      )}

      {showSyncReview && (
        <SyncReviewModal
          changes={syncChanges}
          conflicts={[]}
          onApprove={(resolutions) => {
            setShowSyncReview(false);
            // Sync would be executed here with approved resolutions
            showToast('✓ Sync approved');
          }}
          onCancel={() => setShowSyncReview(false)}
        />
      )}

      {showCheckinModal && (
        <DailyCheckinModal
          onSave={saveCheckin}
          onDismiss={() => setShowCheckinModal(false)}
          lastCheckin={todayCheckin}
        />
      )}

      {showTrainingModal && (
        <TrainingLogModal
          onSave={saveTraining}
          onDismiss={() => setShowTrainingModal(false)}
        />
      )}

      {showOutreachModal && (
        <OutreachLogModal
          onSave={saveOutreach}
          onDismiss={() => setShowOutreachModal(false)}
          projects={projects}
        />
      )}

      {/* Task Creation Modal (Phase 5.4 + 5.3) */}
      {showTaskModal && (
        <Modal
          title="✓ New Task"
          onClose={() => {
            setShowTaskModal(false);
            setTaskAgents([]);
          }}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 9,
                  color: C.dim,
                  marginBottom: 4,
                  display: 'block',
                }}
              >
                Title *
              </label>
              <input
                style={S.input}
                value={taskForm.title}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 9,
                  color: C.dim,
                  marginBottom: 4,
                  display: 'block',
                }}
              >
                Description
              </label>
              <textarea
                style={{ ...S.input, height: 60, resize: 'vertical' }}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Add details, context, or notes..."
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Project
                </label>
                <select
                  style={S.input}
                  value={taskForm.project_id}
                  onChange={async (e) => {
                    const newProjectId = e.target.value;
                    setTaskForm((f) => ({ ...f, project_id: newProjectId }));
                    // Load agents for capability-based routing
                    if (newProjectId) {
                      setTaskLoadingAgents(true);
                      try {
                        const { getAgents } = await import('./agents.js');
                        const agents = await getAgents(newProjectId);
                        setTaskAgents(agents);
                      } catch (err) {
                        console.error('Failed to load agents:', err);
                      } finally {
                        setTaskLoadingAgents(false);
                      }
                    }
                  }}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    marginBottom: 4,
                    display: 'block',
                  }}
                >
                  Priority
                </label>
                <select
                  style={S.input}
                  value={taskForm.priority}
                  onChange={(e) =>
                    setTaskForm((f) => ({ ...f, priority: e.target.value }))
                  }
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>

            {/* Assignee Selection (Phase 5.3) */}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <label
                style={{
                  fontSize: 9,
                  color: C.blue2,
                  marginBottom: 8,
                  display: 'block',
                }}
              >
                ASSIGNEE
              </label>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  style={{
                    ...S.btn(
                      taskForm.assignee_type === 'human' ? 'primary' : 'ghost'
                    ),
                    flex: 1,
                  }}
                  onClick={() =>
                    setTaskForm((f) => ({
                      ...f,
                      assignee_type: 'human',
                      assignee_id: 'user',
                    }))
                  }
                >
                  👤 Me (Human)
                </button>
                <button
                  style={{
                    ...S.btn(
                      taskForm.assignee_type === 'agent' ? 'primary' : 'ghost'
                    ),
                    flex: 1,
                  }}
                  onClick={() =>
                    setTaskForm((f) => ({
                      ...f,
                      assignee_type: 'agent',
                      assignee_id: '',
                    }))
                  }
                  disabled={!taskForm.project_id}
                  title={
                    !taskForm.project_id
                      ? 'Select a project first'
                      : 'Assign to AI agent'
                  }
                >
                  🤖 Agent
                </button>
              </div>

              {taskForm.assignee_type === 'agent' && (
                <div>
                  {taskLoadingAgents ? (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      Loading agents...
                    </div>
                  ) : taskAgents.length === 0 ? (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      No agents available. Create agents in Skills tab.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        maxHeight: 150,
                        overflow: 'auto',
                      }}
                    >
                      {taskAgents.map((agent) => {
                        const selected = taskForm.assignee_id === agent.id;
                        return (
                          <div
                            key={agent.id}
                            onClick={() =>
                              setTaskForm((f) => ({
                                ...f,
                                assignee_id: agent.id,
                              }))
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              borderRadius: 5,
                              cursor: 'pointer',
                              background: selected
                                ? C.blue + '20'
                                : 'transparent',
                              border: `1px solid ${selected ? C.blue : C.border}`,
                            }}
                          >
                            <span style={{ fontSize: 16 }}>{agent.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.text,
                                  fontWeight: selected ? 600 : 400,
                                }}
                              >
                                {agent.name}
                                {agent.is_system !== false && (
                                  <span
                                    style={{
                                      ...S.badge(C.purple),
                                      marginLeft: 6,
                                      fontSize: 8,
                                    }}
                                  >
                                    SYSTEM
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  fontSize: 8,
                                  color: C.dim,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {agent.capabilities?.slice(0, 3).join(', ')}
                                {agent.capabilities?.length > 3 &&
                                  ` +${agent.capabilities.length - 3} more`}
                              </div>
                            </div>
                            {selected && (
                              <span style={{ color: C.green }}>✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <button
                style={S.btn('ghost')}
                onClick={() => {
                  setShowTaskModal(false);
                  setTaskAgents([]);
                }}
              >
                Cancel
              </button>
              <button
                style={S.btn('primary')}
                disabled={
                  !taskForm.title.trim() ||
                  (taskForm.assignee_type === 'agent' && !taskForm.assignee_id)
                }
                onClick={() => createTask(taskForm)}
              >
                Create Task
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showImportModal && (
        <Modal
          title="📥 Import Project"
          onClose={() => {
            setShowImportModal(false);
            setImportError('');
            setImportConflict(null);
          }}
          width={500}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {importConflict && (
              <div
                style={{
                  background: '#7c2d1280',
                  border: `1px solid ${C.red}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11, color: C.red, marginBottom: 6 }}>
                  ⚠ Project "{importConflict.projectId}" already exists
                </div>
                <button
                  style={{ ...S.btn('danger'), fontSize: 9 }}
                  onClick={importConflict.overwrite}
                >
                  Overwrite & Merge Files
                </button>
              </div>
            )}
            {importError && (
              <div
                style={{
                  background: '#7c2d1280',
                  border: `1px solid ${C.red}`,
                  borderRadius: 6,
                  padding: 10,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 10, color: C.red }}>{importError}</div>
              </div>
            )}

            {/* Method Tabs */}
            <div
              style={{
                display: 'flex',
                gap: 4,
                borderBottom: `1px solid ${C.border}`,
                marginBottom: 12,
              }}
            >
              <button
                style={{
                  ...S.tab(importMethod === 'buidl', C.green),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('buidl')}
              >
                Paste BUIDL
              </button>
              <button
                style={{
                  ...S.tab(importMethod === 'json', C.blue),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('json')}
              >
                JSON Upload
              </button>
              <button
                style={{
                  ...S.tab(importMethod === 'folder', C.blue2),
                  fontSize: 9,
                }}
                onClick={() => setImportMethod('folder')}
              >
                Folder
              </button>
            </div>

            {/* BUIDL Method */}
            {importMethod === 'buidl' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <textarea
                  style={{
                    ...S.input,
                    height: 120,
                    resize: 'vertical',
                    fontFamily: C.mono,
                    fontSize: 10,
                  }}
                  placeholder="Paste BUIDL export here (MANIFEST_START...MANIFEST_END, FILES_START...FILES_END)"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
              </div>
            )}

            {/* JSON Method */}
            {importMethod === 'json' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ fontSize: 10, color: C.muted }}>
                  Upload a JSON file with:{' '}
                  {'{projectId, name, files: [{path, content}, ...]}'}
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const text = await f.text();
                      try {
                        const json = JSON.parse(text);
                        setImportText(JSON.stringify(json));
                      } catch (err) {
                        setImportError('Invalid JSON file');
                      }
                    }
                  }}
                  style={{ ...S.input, cursor: 'pointer' }}
                />
              </div>
            )}

            {/* Folder Method */}
            {importMethod === 'folder' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ fontSize: 10, color: C.muted }}>
                  Select a local folder to import all files
                </div>
                <button
                  style={{ ...S.btn('ghost'), fontSize: 10 }}
                  onClick={async () => {
                    if (!window.showDirectoryPicker) {
                      setImportError(
                        'Folder import not supported in your browser (Chrome/Chromium only)'
                      );
                      return;
                    }
                    try {
                      const handle = await window.showDirectoryPicker();
                      const skipPatterns = [
                        '.git',
                        'node_modules',
                        '.DS_Store',
                        '__pycache__',
                        '.env',
                      ];
                      const binaryExtensions = [
                        '.png',
                        '.jpg',
                        '.jpeg',
                        '.gif',
                        '.svg',
                        '.pdf',
                        '.bin',
                        '.exe',
                        '.zip',
                      ];
                      const files = [];

                      async function readDir(dirHandle, basePath = '') {
                        const entries = await dirHandle.entries();
                        for await (const [name, entry] of entries) {
                          if (skipPatterns.some((p) => name.includes(p)))
                            continue;
                          const path = basePath ? `${basePath}/${name}` : name;
                          if (entry.kind === 'directory') {
                            await readDir(entry, path);
                          } else if (entry.kind === 'file') {
                            const ext = name
                              .substring(name.lastIndexOf('.'))
                              .toLowerCase();
                            if (binaryExtensions.includes(ext)) continue;
                            try {
                              const file = await entry.getFile();
                              if (file.size > 1024 * 1024) continue;
                              const content = await file.text();
                              files.push({ path, content });
                            } catch (e) {}
                          }
                        }
                      }

                      await readDir(handle);
                      setImportText(JSON.stringify({ files }));
                      setImportForm((f) => ({
                        ...f,
                        projectId: handle.name,
                        name: handle.name,
                      }));
                    } catch (e) {
                      setImportError('Failed to read folder: ' + e.message);
                    }
                  }}
                >
                  📂 Select Folder
                </button>
              </div>
            )}

            {/* Common Fields */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingTop: 12,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <div>
                <span style={S.label()}>Project ID</span>
                <input
                  style={S.input}
                  placeholder="unique-project-slug"
                  value={importForm.projectId}
                  onChange={(e) =>
                    setImportForm((f) => ({
                      ...f,
                      projectId: e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, '-'),
                    }))
                  }
                />
                <div style={{ fontSize: 8, color: C.dim, marginTop: 3 }}>
                  Lowercase, numbers, and hyphens only
                </div>
              </div>
              <div>
                <span style={S.label()}>Project Name</span>
                <input
                  style={S.input}
                  placeholder="My Project"
                  value={importForm.name}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <span style={S.label()}>Life Area (optional)</span>
                <select
                  style={S.sel}
                  value={importForm.lifeAreaId}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, lifeAreaId: e.target.value }))
                  }
                >
                  <option value="">—None—</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span style={S.label()}>Template (optional)</span>
                <select
                  style={S.sel}
                  value={importForm.templateId}
                  onChange={(e) =>
                    setImportForm((f) => ({ ...f, templateId: e.target.value }))
                  }
                >
                  <option value="">—Use Imported Config—</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon} {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                paddingTop: 12,
                borderTop: `1px solid ${C.border}`,
              }}
            >
              <button
                style={S.btn('ghost')}
                onClick={() => {
                  setShowImportModal(false);
                  setImportError('');
                  setImportConflict(null);
                  setImportText('');
                }}
                disabled={importLoading}
              >
                Cancel
              </button>
              <button
                style={{
                  ...S.btn('primary'),
                  opacity:
                    !importForm.projectId ||
                    !importForm.name ||
                    !importText ||
                    importLoading
                      ? 0.6
                      : 1,
                }}
                onClick={async () => {
                  let data = importText;
                  if (importMethod === 'json' || importMethod === 'folder') {
                    try {
                      data = JSON.parse(importText);
                    } catch (e) {
                      setImportError('Invalid data format');
                      return;
                    }
                  }
                  importProject(
                    importMethod,
                    importForm.projectId,
                    importForm.name,
                    data
                  );
                }}
                disabled={
                  importLoading ||
                  !importForm.projectId ||
                  !importForm.name ||
                  !importText
                }
              >
                {importLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── SEARCH MODAL (Phase 3.3) ── */}
      <SearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        projects={projects}
        searchRes={searchRes}
        runSearch={runSearch}
        searchFilters={searchFilters}
        setSearchFilters={setSearchFilters}
        recentSearches={recentSearches}
        openHub={openHub}
      />

      {/* ── BODY ── */}
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: isMobile ? '12px' : '16px 20px',
        }}
      >
        {/* Mobile: Floating Session Timer */}
        {isMobile && sessionActive && (
          <div
            style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 200 }}
          >
            <div
              onClick={() => endSession()}
              style={{
                background: 'rgba(16,185,129,0.95)',
                border: '1px solid #10b981',
                borderRadius: 50,
                padding: '12px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {fmtTime(sessionSecs)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.8)',
                  textTransform: 'uppercase',
                }}
              >
                ⏹ End
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════
            HUB VIEW
        ═══════════════════════════════════════════ */}
        {view === 'hub' &&
          hub &&
          (() => {
            // ── LOADING STATE — files not yet fetched ──
            if (!hub.files || loadingFiles) {
              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 'calc(100vh - 200px)',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 32 }}>📂</div>
                  <div
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Loading project files...
                  </div>
                </div>
              );
            }

            return (
              <HubEditorPanel
                ctx={{
                  hub,
                  hubId,
                  hubTab,
                  hubAllFolders,
                  projects,
                  staging,
                  areas,
                  goals,
                  templates,
                  tasks,
                  comments,
                  newComment,
                  setNewComment,
                  setComments,
                  hubLinks,
                  setHubLinks,
                  newLinkForm,
                  setNewLinkForm,
                  reviewFilter,
                  setReviewFilter,
                  dragOver,
                  setDragOver,
                  mobileFileTreeOpen,
                  setMobileFileTreeOpen,
                  modal,
                  setModal,
                  setProjects,
                  setBootstrapWiz,
                  setTemplates,
                  sessionLog,
                  setSessionLog,
                  fileMetadataState: fileMetadata,
                  setFileMetadata,
                  loadingMetadata,
                  setLoadingMetadata,
                  aiSuggestions,
                  setAiSuggestions,
                  loadingAiSuggestions,
                  setLoadingAiSuggestions,
                  userSettings,
                  syncState,
                  setSyncState,
                  isMobile,
                  isTablet,
                  hubTabRef,
                  activeGoal,
                  areaStats,
                  saveFile,
                  handleHubSave,
                  deleteFile,
                  handleDrop,
                  updateProject,
                  exportProject,
                  updateStagingStatus,
                  moveToFolder,
                  QuickTagRow,
                  fetchMetadata,
                  saveMetadata,
                  requestAiSuggestions,
                  acceptAiSuggestion,
                  showToast,
                  fmtTime,
                }}
              />
            );
          })()}

        {/* ═══════════════════════════════════════════
            BRAIN TABS
        ═══════════════════════════════════════════ */}
        {view === 'brain' && (
          <>
            <BrainTabsPanel
              ctx={{
                mainTab,
                projects,
                staging,
                ideas,
                areas,
                goals,
                templates,
                tasks,
                userTags,
                entityTags,
                integrations,
                isMobile,
                areaStats,
                activeAreaFilter,
                setActiveAreaFilter,
                driftFlags,
                driftExpanded,
                setDriftExpanded,
                focusId,
                setFocusId,
                focusP,
                totalIncome,
                activeGoal,
                weeklyTraining,
                modal,
                setModal,
                setMainTab,
                setView,
                setBootstrapWiz,
                setShowImportModal,
                setShowGoalModal,
                setShowTrainingModal,
                setShowOutreachModal,
                setShowTaskModal,
                setSessionOn,
                sessionActive,
                hubId,
                newStaging,
                setNewStaging,
                newIdea,
                setNewIdea,
                aiIn,
                setAiIn,
                aiOut,
                aiLoad,
                selectedTagId,
                setSelectedTagId,
                projectsById,
                openHub,
                saveFile,
                exportProject,
                addStaging,
                addIdea,
                askAI,
                completeTask,
                deleteTask,
                dismissDriftFlag,
                QuickTagRow,
                buildCtx,
                buildBrief,
                copy,
                showToast,
              }}
            />
          </>
        )}

        <div
          style={{
            marginTop: 24,
            fontSize: 8,
            color: '#1e293b',
            textAlign: 'center',
          }}
        >
          THE BRAIN v6 · WIRED EDITION · {user?.email || ''} · BOOTSTRAP →
          THAILAND 🇹🇭
        </div>
      </div>
    </div>
  );
}
