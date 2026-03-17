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

  // ── TAG HELPERS ───────────────────────────────────────────
  const getEntityTags = (type, id) =>
    entityTags.filter(
      (et) => et.entity_type === type && String(et.entity_id) === String(id)
    );

  const attachTag = async (
    entityType,
    entityId,
    tagName,
    color = '#3b82f6'
  ) => {
    try {
      const res = await tagsApi.attachByName(
        tagName.trim(),
        entityType,
        entityId,
        color
      );
      setEntityTags((prev) => [
        ...prev.filter(
          (et) =>
            !(
              et.tag_id === res.tag_id &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        ),
        res,
      ]);
      setUserTags((prev) =>
        prev.find((t) => t.id === res.tag_id)
          ? prev
          : [...prev, { id: res.tag_id, name: res.name, color: res.color }]
      );
    } catch (e) {
      showToast('Failed to attach tag');
    }
  };

  const detachTag = async (entityType, entityId, tagId) => {
    try {
      await tagsApi.detach(tagId, entityType, entityId);
      setEntityTags((prev) =>
        prev.filter(
          (et) =>
            !(
              et.tag_id === tagId &&
              et.entity_type === entityType &&
              String(et.entity_id) === String(entityId)
            )
        )
      );
    } catch (e) {
      showToast('Failed to remove tag');
    }
  };

  const QuickTagRow = ({ entityType, entityId }) => {
    const key = `${entityType}:${entityId}`;
    const tags = getEntityTags(entityType, entityId);
    const inputVal = tagInput[key] || '';
    const suggestions =
      inputVal.length >= 1
        ? userTags.filter(
            (t) =>
              t.name.toLowerCase().includes(inputVal.toLowerCase()) &&
              !tags.find((et) => et.tag_id === t.id)
          )
        : [];
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 3,
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        {tags.map((t) => (
          <TagPill
            key={t.id}
            tag={t}
            onRemove={() => detachTag(entityType, entityId, t.tag_id)}
          />
        ))}
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <input
            style={{
              ...S.input,
              width: 90,
              padding: '1px 5px',
              fontSize: 9,
              height: 18,
            }}
            placeholder="+ tag"
            value={inputVal}
            onChange={(e) =>
              setTagInput((prev) => ({ ...prev, [key]: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputVal.trim()) {
                attachTag(entityType, entityId, inputVal.trim());
                setTagInput((prev) => ({ ...prev, [key]: '' }));
                e.preventDefault();
              }
            }}
          />
          {suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                zIndex: 50,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                minWidth: 120,
              }}
            >
              {suggestions.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '3px 8px',
                    fontSize: 9,
                    cursor: 'pointer',
                    color: t.color,
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    attachTag(entityType, entityId, t.name, t.color);
                    setTagInput((prev) => ({ ...prev, [key]: '' }));
                  }}
                >
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

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

  // ── NAVIGATION — lazy-loads files on first hub open ────────
  const openHub = async (id, file) => {
    const proj = projects.find((p) => p.id === id);
    const targetFile = file || proj?.activeFile || 'PROJECT_OVERVIEW.md';

    setHubId(id);
    setView('hub');
    setHubTab('editor');

    // If files haven't been loaded yet, fetch from API
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
      // Files already loaded — just switch active file
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, activeFile: targetFile } : p))
      );
      projectsApi.setActiveFile(id, targetFile).catch(() => {});
    }
  };

  // ── FILE OPS — optimistic + persisted ─────────────────────
  const saveFile = useCallback(
    async (projId, path, content) => {
      // Get previous content for undo history
      const prevContent = projects.find((p) => p.id === projId)?.files?.[path];

      // Push to undo history if content changed
      if (prevContent !== undefined && prevContent !== content) {
        fileHistory.push(
          { projectId: projId, filePath: path, content: prevContent },
          'edit'
        );
      }

      // Optimistic update
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projId ? { ...p, files: { ...p.files, [path]: content } } : p
        )
      );
      setSaving(true);
      try {
        await projectsApi.saveFile(projId, path, content);
        showToast('✓ Saved');

        // Phase 5.2: Trigger summary generation in background (fire and forget)
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

  // Phase 5.2: Async summary generation (background)
  const generateSummaryAsync = async (projId, path, content) => {
    try {
      // Check if summary needed
      const { needsUpdate } = await checkSummaryStatus(projId, path, content);
      if (!needsUpdate) return;

      // Only summarize markdown and code files
      const ext = path.split('.').pop();
      if (!['md', 'txt', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(ext))
        return;

      // Generate L0 (abstract) and L1 (overview) in parallel
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

      // Store summaries
      await storeSummaries(projId, path, content, {
        l0_abstract: l0Response?.response || '',
        l1_overview: l1Response?.response || '',
      });

      console.log(`[Summary] Generated for ${path}`);
    } catch (e) {
      // Silent fail - summaries are optional
      console.log(`[Summary] Failed for ${path}:`, e.message);
    }
  };

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
    // Optimistic
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, files: { ...p.files, [path]: def }, activeFile: path }
          : p
      )
    );
    setModal(null);
    setNewFileName('');
    // Persist
    await projectsApi.saveFile(projId, path, def).catch(() => {});
    await projectsApi.setActiveFile(projId, path).catch(() => {});
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
    await projectsApi.deleteFile(projId, path).catch(() => {});
  };

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
    // Persist folder + gitkeep + manifest
    await projectsApi.addFolder(projId, folder).catch(() => {});
    await projectsApi
      .saveFile(projId, `${folder.id}/.gitkeep`, '')
      .catch(() => {});
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
    // Optimistic
    setProjects((prev) => [...prev, proj]);
    setFocusId(id);
    setModal(null);
    setNewProjForm({ name: '', emoji: '📁', phase: 'BOOTSTRAP', desc: '' });
    // Persist — create project then all default files
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

    // Mark onboarding as completed in DB
    try {
      await settingsApi.update({ onboarding_completed: true });
    } catch (e) {
      console.error('Failed to save onboarding completion:', e);
    }

    // Start tour if project was created
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

  const updateProject = async (projId, updates) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId
          ? { ...p, ...updates, health: calcHealth({ ...p, ...updates }) }
          : p
      )
    );
    await projectsApi.update(projId, updates).catch(() => {});
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
        updatedFiles = files; // capture for re-save
        return { ...p, name: newName, files };
      });
      return newProjects;
    });
    setModal(null);
    await projectsApi.update(projId, { name: newName }).catch(() => {});
    // Re-save overview + manifest
    if (updatedFiles['PROJECT_OVERVIEW.md']) {
      await projectsApi
        .saveFile(
          projId,
          'PROJECT_OVERVIEW.md',
          updatedFiles['PROJECT_OVERVIEW.md']
        )
        .catch(() => {});
    }
    if (updatedFiles['manifest.json']) {
      await projectsApi
        .saveFile(projId, 'manifest.json', updatedFiles['manifest.json'])
        .catch(() => {});
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
    await projectsApi.delete(projId).catch(() => {});
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

      // Success: fetch updated projects list and navigate to new project
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
      // Check for 409 conflict
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

    // Build the bootstrap files
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

    // Optimistic update
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

    // Persist everything
    try {
      const proj = projects.find((p) => p.id === projId);
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
      // Add staging reminder
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

  // ── STAGING OPS — persisted ────────────────────────────────
  const addStaging = async (item) => {
    const tmp = {
      ...item,
      id: `tmp-${Date.now()}`,
      status: 'in-review',
      added: new Date().toISOString().slice(0, 7),
    };
    setStaging((prev) => [...prev, tmp]);
    try {
      const res = await stagingApi.create({
        ...item,
        project_id: item.project,
      });
      setStaging((prev) =>
        prev.map((s) => (s.id === tmp.id ? { ...s, id: res.id } : s))
      );
    } catch {
      showToast('⚠ Staging save failed');
    }
  };

  const updateStagingStatus = async (id, status) => {
    setStaging((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    await stagingApi.update(id, { status }).catch(() => {});
  };

  // ── PHASE 2.3: Move staging items to folders ───────────────
  const moveToFolder = async (stagingId, folderId) => {
    const item = staging.find((s) => s.id === stagingId);
    if (!item || !hub) return;

    // Optimistic update
    setStaging((prev) =>
      prev.map((s) =>
        s.id === stagingId
          ? {
              ...s,
              folder_path: `${folderId}/${item.name}`,
              filed_at: new Date().toISOString(),
            }
          : s
      )
    );

    try {
      const res = await stagingApi.moveToFolder(stagingId, folderId, item.name);

      // Update files in project — move from staging/ to folder/
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== hubId) return p;
          const files = { ...(p.files || {}) };
          const oldPath = `staging/${item.name}`;
          const newPath = res.folder_path;

          if (files[oldPath]) {
            files[newPath] = files[oldPath];
            delete files[oldPath];
          }
          return { ...p, files };
        })
      );

      showToast(`✓ Filed as ${res.folder_path}`);
    } catch (e) {
      // Revert optimistic update
      setStaging((prev) =>
        prev.map((s) =>
          s.id === stagingId ? { ...s, folder_path: null, filed_at: null } : s
        )
      );
      showToast('⚠ Failed to file item');
    }
  };

  // ── IDEAS OPS — persisted ──────────────────────────────────
  const addIdea = async (title) => {
    if (!title.trim()) return;
    const tmp = {
      id: `tmp-${Date.now()}`,
      title: title.trim(),
      score: 5,
      tags: ['new'],
      added: new Date().toISOString().slice(0, 7),
    };
    setIdeas((prev) => [...prev, tmp]);
    setNewIdea('');
    try {
      const res = await ideasApi.create({
        title: title.trim(),
        score: 5,
        tags: ['new'],
      });
      setIdeas((prev) =>
        prev.map((i) => (i.id === tmp.id ? { ...i, id: res.id } : i))
      );
    } catch {
      showToast('⚠ Idea save failed');
    }
  };

  // ── SESSION END — persisted ────────────────────────────────
  const endSession = async () => {
    const dur = sessionSecs,
      log = sessionLog;
    if (log.trim()) {
      // Save to devlog file
      const entry = `\n## ${new Date().toISOString().slice(0, 10)} — ${fmtTime(dur)}\n\n${log}\n`;
      const proj = projects.find((p) => p.id === focusId);
      if (proj) {
        const current = (proj.files || {})['DEVLOG.md'] || '';
        await saveFile(focusId, 'DEVLOG.md', current + entry);
      }
    }
    // Log session to DB
    await sessionsApi
      .create({
        project_id: focusId,
        duration_s: dur,
        log,
        started_at: sessionStart.current?.toISOString(),
        ended_at: new Date().toISOString(),
      })
      .catch(() => {});
    setSessionOn(false);
    setSessionSecs(0);
    setSessionLog('');
  };

  // ── DAILY CHECKIN (Phase 2.5) ────────────────────────────────
  const saveCheckin = async (checkin) => {
    try {
      const res = await fetch(`/api/data?resource=daily-checkins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(checkin),
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setTodayCheckin(checkin);
      const today = new Date().toISOString().split('T')[0];
      setCheckinLastDate(today);
      localStorage.setItem('lastCheckinDate', today);
      setShowCheckinModal(false);
      showToast('✓ Check-in saved');
    } catch (e) {
      console.error('Checkin save error:', e);
      showToast('⚠ Failed to save check-in');
    }
  };

  // ── TRAINING LOG (Phase 2.6) ─────────────────────────────────
  const loadWeeklyTraining = async () => {
    try {
      const res = await fetch(`/api/data?resource=training-logs&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const logs = data.logs || [];
      setWeeklyTraining({
        count: logs.length,
        minutes: logs.reduce((s, l) => s + (l.duration_minutes || 0), 0),
      });
    } catch (e) {
      console.error('Training load error:', e);
    }
  };

  const saveTraining = async (log) => {
    try {
      const res = await fetch(`/api/data?resource=training-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(log),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowTrainingModal(false);
      showToast('🥋 Training logged');
      loadWeeklyTraining();
      // Also update today's checkin training_done if we have a checkin
      if (todayCheckin && !todayCheckin.training_done) {
        const updated = { ...todayCheckin, training_done: 1 };
        fetch(`/api/data?resource=daily-checkins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.get()}`,
          },
          body: JSON.stringify({
            ...updated,
            date: new Date().toISOString().split('T')[0],
          }),
        }).catch(() => {});
        setTodayCheckin(updated);
      }
    } catch (e) {
      console.error('Training save error:', e);
      showToast('⚠ Failed to log training');
    }
  };

  // ── OUTREACH LOG (Phase 2.7) ─────────────────────────────────
  const loadTodayOutreach = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/data?resource=outreach-log&date=${today}`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setTodayOutreach(data.logs || []);
      // Also load this week's count
      const wRes = await fetch(`/api/data?resource=outreach-log&days=7`, {
        headers: { Authorization: `Bearer ${token.get()}` },
      });
      if (wRes.ok) {
        const wData = await wRes.json();
        setWeeklyOutreach((wData.logs || []).length);
      }
    } catch (e) {
      console.error('Outreach load error:', e);
    }
  };

  const saveOutreach = async (entry) => {
    try {
      const res = await fetch(`/api/data?resource=outreach-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.get()}`,
        },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error('Save failed');
      setShowOutreachModal(false);
      showToast('📣 Outreach logged');
      loadTodayOutreach();
    } catch (e) {
      console.error('Outreach save error:', e);
      showToast('⚠ Failed to log outreach');
    }
  };

  // ── DRIFT DETECTION (Phase 2.10) ──────────────────────────────
  const loadDriftCheck = async () => {
    try {
      const data = await driftApi.check();
      if (data && data.flags) {
        // Filter out dismissed flags (by type)
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

  // ── NOTIFICATIONS (Phase 4.4) ─────────────────────────────────
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const data = await notificationsApi.list();
      if (data && data.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (e) {
      console.error('Notifications load error:', e);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const checkNotificationTriggers = async () => {
    try {
      await notificationsApi.checkTriggers();
      // Reload to get any new notifications
      await loadNotifications();
    } catch (e) {
      console.error('Notification trigger check error:', e);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Mark read error:', e);
    }
  };

  // ── TASKS (Phase 5.4) ───────────────────────────────────────
  const loadTasks = async () => {
    try {
      setTasksLoading(true);
      const data = await tasksApi.myTasks();
      if (data && data.tasks) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error('Tasks load error:', e);
    } finally {
      setTasksLoading(false);
    }
  };

  // Phase 5.6: Poll executing agent tasks
  useEffect(() => {
    const executingTasks = tasks.filter(
      (t) => t.assignee_type === 'agent' && t.status === 'in_progress'
    );
    if (executingTasks.length === 0) return;
    const interval = setInterval(async () => {
      for (const t of executingTasks) {
        try {
          const result = await agentExecution.status(t.id);
          if (result.status === 'complete' || result.status === 'blocked') {
            setTasks((prev) =>
              prev.map((p) =>
                p.id === t.id
                  ? {
                      ...p,
                      status: result.status,
                      result_summary: result.result_summary,
                    }
                  : p
              )
            );
          }
        } catch {
          /* ignore polling errors */
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [tasks]);

  const createTask = async (taskData) => {
    try {
      const result = await tasksApi.create(taskData);
      if (result.success) {
        showToast(
          `Task created${taskData.assignee_type === 'agent' ? ` → assigned to ${taskData.assignee_id}` : ''}`
        );
        loadTasks();
        setShowTaskModal(false);
        setTaskForm({
          title: '',
          description: '',
          priority: 'medium',
          project_id: '',
          assignee_type: 'human',
          assignee_id: 'user',
        });
        setTaskAgents([]);
      }
    } catch (e) {
      console.error('Create task error:', e);
      showToast('Failed to create task');
    }
  };

  const completeTask = async (id) => {
    try {
      await tasksApi.complete(id, 'Completed manually');
      showToast('Task completed');
      loadTasks();
    } catch (e) {
      console.error('Complete task error:', e);
      showToast('Failed to complete task');
    }
  };

  const deleteTask = async (id) => {
    try {
      await tasksApi.delete(id);
      showToast('Task deleted');
      loadTasks();
    } catch (e) {
      console.error('Delete task error:', e);
      showToast('Failed to delete task');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('Mark all read error:', e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await notificationsApi.delete(id);
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Delete notification error:', e);
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
        await projectsApi.saveFile(projId, path, content).catch(() => {});
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

  // ── SEARCH — uses DB full-text search (Phase 3.3 Enhanced) ──
  const runSearch = async (q) => {
    if (!q.trim()) {
      setSearchRes([]);
      return;
    }
    try {
      const { results, grouped } = await searchApi.query(q, searchFilters);
      setSearchRes(results || []);
      addRecentSearch(q);
    } catch {
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

  // ── CONTEXT + BRIEFINGS + AI ───────────────────────────────
  const buildCtx = (projId = null) =>
    JSON.stringify(
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

  // Phase 2.8: system prompt is now built server-side from DB (agent-config.json + real data)
  // Pass system=null for standard questions; skill briefings still pass their own system override
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

            const commKey = `${hubId}:${hub.activeFile}`;
            const fileComs = comments[commKey] || [];
            return (
              <div>
                {hubTab === 'editor' && (
                  <div
                    style={{
                      display: 'flex',
                      gap: isMobile ? 0 : 10,
                      height: isMobile
                        ? 'calc(100vh - 140px)'
                        : 'calc(100vh-160px)',
                      minHeight: 500,
                      flexDirection: isMobile ? 'column' : 'row',
                      position: 'relative',
                    }}
                  >
                    {/* Mobile: File tree toggle button */}
                    {isMobile && (
                      <button
                        style={{
                          ...S.btn('ghost'),
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          zIndex: 10,
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          padding: '8px 12px',
                          minHeight: 44,
                        }}
                        onClick={() => setMobileFileTreeOpen(true)}
                      >
                        📁 Files
                      </button>
                    )}

                    {/* Desktop: Persistent sidebar / Mobile: Slide-out drawer */}
                    {(!isMobile || mobileFileTreeOpen) && (
                      <>
                        {isMobile && mobileFileTreeOpen && (
                          <div
                            style={{ position: 'fixed', inset: 0, zIndex: 350 }}
                            onClick={() => setMobileFileTreeOpen(false)}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(0,0,0,0.7)',
                              }}
                            />
                          </div>
                        )}
                        <div
                          style={{
                            width: isMobile ? 280 : 210,
                            flexShrink: 0,
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            borderRadius: isMobile ? 0 : 8,
                            overflow: 'hidden',
                            position: isMobile ? 'fixed' : 'relative',
                            top: isMobile ? 0 : 'auto',
                            left: isMobile ? 0 : 'auto',
                            bottom: isMobile ? 0 : 'auto',
                            zIndex: isMobile ? 360 : 'auto',
                          }}
                        >
                          {isMobile && (
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px 16px',
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              <span style={{ fontSize: 12, fontWeight: 700 }}>
                                📁 Files
                              </span>
                              <button
                                style={{
                                  ...S.btn('ghost'),
                                  padding: '6px 10px',
                                  fontSize: 16,
                                }}
                                onClick={() => setMobileFileTreeOpen(false)}
                              >
                                ✕
                              </button>
                            </div>
                          )}
                          <div
                            style={{
                              height: isMobile ? 'calc(100% - 50px)' : '100%',
                              overflow: 'auto',
                            }}
                          >
                            <FileTreeInline
                              files={hub.files || {}}
                              activeFile={hub.activeFile}
                              customFolders={hub.customFolders || []}
                              onSelect={(path) => {
                                setProjects((prev) =>
                                  prev.map((p) =>
                                    p.id === hubId
                                      ? { ...p, activeFile: path }
                                      : p
                                  )
                                );
                                projectsApi
                                  .setActiveFile(hubId, path)
                                  .catch(() => {});
                                fetchMetadata(hubId, path);
                                if (isMobile) setMobileFileTreeOpen(false);
                              }}
                              onNewFile={() => setModal('new-file')}
                              onDelete={(path) => deleteFile(hubId, path)}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Roadmap 2.3: Editor pane now in flex layout with metadata panel */}
                    <div
                      style={{
                        flex: 1,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: isMobile ? 0 : 8,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: isMobile ? 'column' : 'row',
                        position: 'relative',
                        marginLeft: isMobile ? 0 : 'auto',
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => handleDrop(e, hubId)}
                    >
                      <div
                        style={{
                          flex: 1,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                        }}
                      >
                        {dragOver && (
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(26,79,214,0.12)',
                              border: `2px dashed ${C.blue}`,
                              borderRadius: isMobile ? 0 : 8,
                              zIndex: 50,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'none',
                            }}
                          >
                            <span style={{ fontSize: 14, color: C.blue }}>
                              Drop to stage →
                            </span>
                          </div>
                        )}
                        {hub.activeFile && (
                          <div
                            style={{
                              padding: '4px 10px',
                              borderBottom: `1px solid ${C.border}`,
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              background: C.bg,
                              marginTop: isMobile ? 50 : 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 8,
                                color: C.dim,
                                textTransform: 'uppercase',
                                letterSpacing: '0.1em',
                                flexShrink: 0,
                              }}
                            >
                              tags
                            </span>
                            <QuickTagRow
                              entityType="file"
                              entityId={`${hubId}/${hub.activeFile}`}
                            />
                          </div>
                        )}
                        {(hub.activeFile &&
                          (() => {
                            const fileType = getFileType(hub.activeFile);
                            const content =
                              (hub.files || {})[hub.activeFile] || '';
                            if (fileType === 'image')
                              return (
                                <ImageViewer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (fileType === 'audio')
                              return (
                                <AudioPlayer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (fileType === 'video')
                              return (
                                <VideoPlayer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            if (
                              fileType === 'binary' ||
                              fileType === 'document' ||
                              fileType === 'archive'
                            )
                              return (
                                <BinaryViewer
                                  path={hub.activeFile}
                                  content={content}
                                />
                              );
                            return (
                              <MarkdownEditor
                                path={hub.activeFile}
                                content={content}
                                onChange={() => {}}
                                onSave={handleHubSave}
                                saving={saving}
                                files={hub.files || {}}
                              />
                            );
                          })()) ||
                          null}
                      </div>

                      {/* Metadata panel (right side) - hidden on mobile */}
                      {hub.activeFile && !isMobile && (
                        <MetadataEditor
                          file={hub.activeFile}
                          projectId={hubId}
                          metadata={fileMetadata}
                          onSave={(data) =>
                            saveMetadata(hubId, hub.activeFile, data)
                          }
                          allTags={userTags}
                          aiSuggestions={aiSuggestions}
                          onRequestSuggestions={requestAiSuggestions}
                          loadingSuggestions={loadingAiSuggestions}
                          onAcceptSuggestion={acceptAiSuggestion}
                        />
                      )}
                    </div>
                  </div>
                )}

                {hubTab === 'overview' && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 10,
                    }}
                  >
                    <div style={S.card(true)}>
                      <span style={S.label()}>Status</span>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                          gap: 6,
                          marginBottom: 10,
                        }}
                      >
                        {[
                          { l: 'Phase', v: hub.phase },
                          {
                            l: 'Status',
                            v: <BadgeStatus status={hub.status} />,
                          },
                          { l: 'Priority', v: `#${hub.priority}` },
                          { l: 'Health', v: <HealthBar score={hub.health} /> },
                          { l: 'Momentum', v: <Dots n={hub.momentum} /> },
                          {
                            l: 'Income',
                            v: `${activeGoal?.currency === 'USD' ? '$' : activeGoal?.currency === 'EUR' ? '€' : '£'}${hub.incomeTarget || 0}/mo`,
                          },
                        ].map((r) => (
                          <div
                            key={r.l}
                            style={{
                              background: C.bg,
                              border: `1px solid ${C.border}`,
                              borderRadius: 5,
                              padding: '7px 10px',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 8,
                                color: C.dim,
                                textTransform: 'uppercase',
                                marginBottom: 3,
                              }}
                            >
                              {r.l}
                            </div>
                            <div style={{ fontSize: 11 }}>{r.v}</div>
                          </div>
                        ))}
                      </div>
                      <span style={S.label()}>Area</span>
                      <div style={{ marginBottom: 10 }}>
                        <select
                          style={S.sel}
                          value={hub.areaId || ''}
                          onChange={(e) =>
                            updateProject(hubId, { areaId: e.target.value })
                          }
                        >
                          <option value="">No Area</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.icon} {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span style={S.label(C.green)}>Next Action</span>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.green,
                          marginBottom: 8,
                        }}
                      >
                        → {hub.nextAction}
                      </div>
                      {hub.blockers?.length > 0 && (
                        <>
                          {hub.blockers.map((b, i) => (
                            <div
                              key={i}
                              style={{ fontSize: 10, color: '#92400e' }}
                            >
                              ⚠ {b}
                            </div>
                          ))}
                        </>
                      )}
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          gap: 4,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          style={{ ...S.btn('success'), fontSize: 9 }}
                          onClick={() => setBootstrapWiz(hubId)}
                        >
                          🚀 Bootstrap Wizard
                        </button>
                        <button
                          style={S.btn('ghost')}
                          onClick={() => exportProject(hubId)}
                        >
                          ⬇ Export
                        </button>
                      </div>
                    </div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>Project Overview</span>
                      <div
                        style={{ fontSize: 11, lineHeight: 1.8 }}
                        dangerouslySetInnerHTML={{
                          __html: renderMd(
                            (hub.files || {})['PROJECT_OVERVIEW.md'] || ''
                          ),
                        }}
                      />
                    </div>
                  </div>
                )}

                {hubTab === 'folders' && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.blue,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        📁 All Folders
                      </span>
                      <button
                        style={S.btn('ghost')}
                        onClick={() => setModal('new-custom-folder')}
                      >
                        + Custom Folder
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile
                          ? '1fr'
                          : 'repeat(auto-fill,minmax(220px,1fr))',
                        gap: 8,
                      }}
                    >
                      {hubAllFolders.map((f) => {
                        const files = hub.files || {};
                        const count = Object.keys(files).filter(
                          (k) =>
                            k.startsWith(f.id + '/') && !k.endsWith('.gitkeep')
                        ).length;
                        const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
                        return (
                          <div
                            key={f.id}
                            style={{
                              background: C.bg,
                              border: `1px solid ${isCustom ? C.purple : C.border}`,
                              borderRadius: 6,
                              padding: '10px 12px',
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
                              <span style={{ fontSize: 12 }}>
                                {f.icon}{' '}
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#e2e8f0',
                                    fontWeight: 600,
                                  }}
                                >
                                  {f.label}
                                </span>
                              </span>
                              <div
                                style={{
                                  display: 'flex',
                                  gap: 4,
                                  alignItems: 'center',
                                }}
                              >
                                {isCustom && (
                                  <span style={S.badge(C.purple)}>custom</span>
                                )}
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: count > 0 ? C.blue2 : C.dim,
                                  }}
                                >
                                  {count}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: 9, color: C.muted }}>
                              {f.desc}
                            </div>
                            {count > 0 && (
                              <div style={{ marginTop: 6 }}>
                                {Object.keys(files)
                                  .filter(
                                    (k) =>
                                      k.startsWith(f.id + '/') &&
                                      !k.endsWith('.gitkeep')
                                  )
                                  .map((path) => (
                                    <div
                                      key={path}
                                      onClick={() => {
                                        setProjects((prev) =>
                                          prev.map((p) =>
                                            p.id === hubId
                                              ? { ...p, activeFile: path }
                                              : p
                                          )
                                        );
                                        setHubTab('editor');
                                      }}
                                      style={{
                                        fontSize: 9,
                                        color: C.blue,
                                        cursor: 'pointer',
                                        padding: '1px 0',
                                      }}
                                    >
                                      {path.split('/').pop()}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hubTab === 'review' && (
                  <div>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => handleDrop(e, hubId)}
                      style={{
                        background: dragOver
                          ? 'rgba(26,79,214,0.08)'
                          : C.surface,
                        border: `2px dashed ${dragOver ? C.blue : C.border}`,
                        borderRadius: 8,
                        padding: 16,
                        textAlign: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, color: C.muted }}>
                        🌀 Drag & drop files to stage them
                      </div>
                    </div>

                    {/* Phase 2.3: Filter toggle for review items */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.blue,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        📋 Review Items
                      </span>
                      <select
                        style={{ ...S.sel, fontSize: 9 }}
                        value={reviewFilter}
                        onChange={(e) => setReviewFilter(e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="filed">Filed</option>
                        <option value="all">All</option>
                      </select>
                    </div>

                    {(() => {
                      const filtered = staging
                        .filter((s) => s.project === hubId)
                        .filter((s) => {
                          if (reviewFilter === 'pending') return !s.folder_path;
                          if (reviewFilter === 'filed') return !!s.folder_path;
                          return true;
                        });

                      return filtered.length === 0 ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.dim,
                            textAlign: 'center',
                            padding: '24px 0',
                          }}
                        >
                          No {reviewFilter !== 'all' ? reviewFilter + ' ' : ''}
                          items for {hub.name}.
                        </div>
                      ) : (
                        filtered.map((item) => {
                          const sc = REVIEW_STATUSES[item.status];
                          return (
                            <div
                              key={item.id}
                              style={{
                                background: C.bg,
                                border: `1px solid ${sc.color}25`,
                                borderLeft: `3px solid ${sc.color}`,
                                borderRadius: '0 6px 6px 0',
                                padding: '10px 14px',
                                marginBottom: 7,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  marginBottom: 4,
                                  flexWrap: 'wrap',
                                  gap: 5,
                                }}
                              >
                                <span style={{ fontSize: 11 }}>
                                  {item.name}
                                </span>
                                <span style={S.badge(sc.color)}>
                                  {sc.icon} {sc.label}
                                </span>
                              </div>
                              <div
                                style={{
                                  fontSize: 9,
                                  color: C.muted,
                                  marginBottom: 6,
                                }}
                              >
                                {item.notes} · {item.added}
                              </div>

                              {/* Phase 2.3: Show filing status or move interface */}
                              {item.folder_path ? (
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: C.green,
                                    padding: '4px 0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span>✓ Filed</span>
                                  <span style={{ fontSize: 8, color: C.dim }}>
                                    → {item.folder_path}
                                  </span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 4,
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                  }}
                                >
                                  {item.status === 'approved' && (
                                    <select
                                      style={{
                                        ...S.sel,
                                        flex: 1,
                                        fontSize: 9,
                                        minWidth: '120px',
                                        padding: '4px 6px',
                                      }}
                                      defaultValue=""
                                      onChange={(e) => {
                                        if (e.target.value)
                                          moveToFolder(item.id, e.target.value);
                                        e.target.value = '';
                                      }}
                                    >
                                      <option value="">
                                        📁 Move to folder...
                                      </option>
                                      {hubAllFolders
                                        .filter((f) => f.id !== 'staging')
                                        .map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.icon} {f.label}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    {['approved', 'rejected', 'deferred']
                                      .filter((s) => s !== item.status)
                                      .map((s) => (
                                        <button
                                          key={s}
                                          style={{
                                            ...S.btn(
                                              s === 'approved'
                                                ? 'success'
                                                : s === 'rejected'
                                                  ? 'danger'
                                                  : 'ghost'
                                            ),
                                            padding: '2px 8px',
                                            fontSize: 8,
                                          }}
                                          onClick={() =>
                                            updateStagingStatus(item.id, s)
                                          }
                                        >
                                          {REVIEW_STATUSES[s].icon} {s}
                                        </button>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      );
                    })()}
                  </div>
                )}

                {hubTab === 'devlog' && (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <textarea
                        style={{
                          ...S.input,
                          height: 60,
                          resize: 'vertical',
                          flex: 1,
                        }}
                        placeholder="What did you build/learn/decide?"
                        value={sessionLog}
                        onChange={(e) => setSessionLog(e.target.value)}
                      />
                      <button
                        style={{ ...S.btn('success'), alignSelf: 'flex-end' }}
                        onClick={async () => {
                          if (!sessionLog.trim()) return;
                          const entry = `\n## ${new Date().toISOString().slice(0, 10)}\n\n${sessionLog}\n`;
                          const current = (hub.files || {})['DEVLOG.md'] || '';
                          await saveFile(hubId, 'DEVLOG.md', current + entry);
                          setSessionLog('');
                        }}
                      >
                        Log
                      </button>
                    </div>
                    <div
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        padding: '14px 18px',
                        maxHeight: 420,
                        overflowY: 'auto',
                        fontSize: 11,
                        lineHeight: 1.8,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMd(
                          (hub.files || {})['DEVLOG.md'] || '*No entries yet.*'
                        ),
                      }}
                    />
                  </div>
                )}

                {hubTab === 'gantt' && (
                  <div style={S.card(false)}>
                    <span style={S.label()}>Timeline</span>
                    <GanttChart
                      tasks={parseTasks((hub.files || {})['TASKS.md'] || '')}
                    />
                    <div
                      style={{
                        marginTop: 14,
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: renderMd(
                          (hub.files || {})['TASKS.md'] || '*No tasks yet.*'
                        ),
                      }}
                    />
                  </div>
                )}

                {hubTab === 'comments' && (
                  <div>
                    <div
                      style={{ fontSize: 9, color: C.muted, marginBottom: 8 }}
                    >
                      On:{' '}
                      <span style={{ color: C.blue }}>{hub.activeFile}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                      <input
                        style={S.input}
                        placeholder="Add comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && newComment.trim()) {
                            const tmp = {
                              id: `tmp-${Date.now()}`,
                              text: newComment,
                              date: new Date().toISOString().slice(0, 10),
                              resolved: false,
                            };
                            setComments((prev) => ({
                              ...prev,
                              [commKey]: [...(prev[commKey] || []), tmp],
                            }));
                            setNewComment('');
                            try {
                              const r = await commentsApi.create(
                                hubId,
                                hub.activeFile,
                                newComment
                              );
                              setComments((prev) => ({
                                ...prev,
                                [commKey]: (prev[commKey] || []).map((c) =>
                                  c.id === tmp.id ? { ...c, id: r.id } : c
                                ),
                              }));
                            } catch {}
                          }
                        }}
                      />
                      <button
                        style={S.btn('primary')}
                        onClick={async () => {
                          if (!newComment.trim()) return;
                          const tmp = {
                            id: `tmp-${Date.now()}`,
                            text: newComment,
                            date: new Date().toISOString().slice(0, 10),
                            resolved: false,
                          };
                          setComments((prev) => ({
                            ...prev,
                            [commKey]: [...(prev[commKey] || []), tmp],
                          }));
                          setNewComment('');
                          try {
                            const r = await commentsApi.create(
                              hubId,
                              hub.activeFile,
                              newComment
                            );
                            setComments((prev) => ({
                              ...prev,
                              [commKey]: (prev[commKey] || []).map((c) =>
                                c.id === tmp.id ? { ...c, id: r.id } : c
                              ),
                            }));
                          } catch {}
                        }}
                      >
                        Add
                      </button>
                    </div>
                    {commentsLoading ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dim,
                          textAlign: 'center',
                          padding: '20px 0',
                        }}
                      >
                        Loading comments...
                      </div>
                    ) : fileComs.length === 0 ? (
                      <div
                        style={{
                          fontSize: 10,
                          color: C.dim,
                          textAlign: 'center',
                          padding: '20px 0',
                        }}
                      >
                        No comments yet.
                      </div>
                    ) : (
                      fileComs.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            background: C.bg,
                            border: `1px solid ${c.resolved ? C.border : C.blue + '40'}`,
                            borderRadius: 6,
                            padding: '10px 14px',
                            marginBottom: 6,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ fontSize: 9, color: C.muted }}>
                              {c.date}
                            </span>
                            <button
                              style={{
                                ...S.btn(c.resolved ? 'ghost' : 'success'),
                                padding: '1px 7px',
                                fontSize: 8,
                              }}
                              onClick={async () => {
                                setComments((prev) => ({
                                  ...prev,
                                  [commKey]: prev[commKey].map((cm) =>
                                    cm.id === c.id
                                      ? { ...cm, resolved: !cm.resolved }
                                      : cm
                                  ),
                                }));
                                await commentsApi
                                  .resolve(c.id, !c.resolved)
                                  .catch(() => {});
                              }}
                            >
                              {c.resolved ? 'Reopen' : '✓ Resolve'}
                            </button>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: c.resolved ? C.muted : C.text,
                              textDecoration: c.resolved
                                ? 'line-through'
                                : 'none',
                            }}
                          >
                            {c.text}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {hubTab === 'meta' && (
                  <div>
                    {/* Script Runner Section (Phase 3.6) */}
                    <ScriptRunner
                      projectId={hubId}
                      projectFiles={hub?.files || {}}
                    />

                    {/* Health Check Section (Phase 3.5) */}
                    <HealthCheck
                      project={hub}
                      projectFiles={hub?.files || {}}
                      templates={templates}
                      onFix={async (fixes) => {
                        for (const fix of fixes) {
                          if (fix.type === 'create_file') {
                            await handleHubSave(fix.path, fix.content);
                          }
                        }
                        showToast(
                          `✓ Fixed ${fixes.length} issue${fixes.length !== 1 ? 's' : ''}`
                        );
                      }}
                    />

                    {/* Desktop Sync Section */}
                    <FolderSyncSetup
                      projectId={hubId}
                      syncState={syncState}
                      onSyncStateChange={setSyncState}
                      projectFiles={
                        hub?.files
                          ? Object.entries(hub.files).map(
                              ([path, content]) => ({ path, content })
                            )
                          : []
                      }
                    />

                    {/* File Summaries (Phase 5.2) */}
                    <FileSummaryViewer
                      projectId={hubId}
                      projectFiles={hub?.files || {}}
                    />

                    {/* Manifest and Folder Summary */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 10,
                      }}
                    >
                      <div style={S.card(false)}>
                        <span style={S.label()}>
                          manifest.json{' '}
                          <span style={S.badge(C.purple)}>
                            portability contract
                          </span>
                        </span>
                        <pre
                          style={{
                            fontSize: 9,
                            color: C.muted,
                            background: C.bg,
                            border: `1px solid ${C.border}`,
                            borderRadius: 5,
                            padding: 12,
                            overflow: 'auto',
                            maxHeight: 300,
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {(hub.files || {})['manifest.json'] || '{}'}
                        </pre>
                      </div>
                      <div style={S.card(false)}>
                        <span style={S.label()}>Folder Summary</span>
                        {hubAllFolders.map((f) => {
                          const count = Object.keys(hub.files || {}).filter(
                            (k) =>
                              k.startsWith(f.id + '/') &&
                              !k.endsWith('.gitkeep')
                          ).length;
                          const isCustom = !STANDARD_FOLDER_IDS.has(f.id);
                          return (
                            <div
                              key={f.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: 9,
                                padding: '3px 0',
                                borderBottom: `1px solid ${C.border}`,
                                color: count > 0 ? C.text : C.dim,
                              }}
                            >
                              <span>
                                {f.icon} {f.label}{' '}
                                {isCustom && (
                                  <span style={{ color: C.purple }}>
                                    ·custom
                                  </span>
                                )}
                              </span>
                              <span
                                style={{ color: count > 0 ? C.blue2 : C.dim }}
                              >
                                {count}
                              </span>
                            </div>
                          );
                        })}
                        <div style={{ marginTop: 16 }}>
                          <button
                            style={S.btn('ghost')}
                            onClick={async () => {
                              const manifest = JSON.parse(
                                hub.files['manifest.json'] || '{}'
                              );
                              const template = {
                                name: `${hub.name} Template`,
                                description: `Extracted from project: ${hub.name}`,
                                icon: hub.emoji,
                                config: {
                                  phases: BUIDL_PHASES.includes(hub.phase)
                                    ? BUIDL_PHASES
                                    : [hub.phase],
                                  folders: Object.keys(hub.files)
                                    .map((p) => p.split('/')[0])
                                    .filter(
                                      (f) =>
                                        f &&
                                        f !== '.gitkeep' &&
                                        !f.endsWith('.md') &&
                                        !f.endsWith('.json')
                                    ),
                                },
                              };
                              try {
                                await templatesApi.create(template);
                                showToast('✓ Saved as template');
                                const data = await templatesApi.list();
                                setTemplates(data.templates || []);
                              } catch (e) {
                                showToast('Failed to save template');
                              }
                            }}
                          >
                            Save as Template
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {hubTab === 'links' && (
                  <div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>
                        🔗 Link this project to another entity
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          alignItems: 'flex-end',
                          marginTop: 8,
                        }}
                      >
                        <div>
                          <span style={S.label()}>Type</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.targetType}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                targetType: e.target.value,
                                targetId: '',
                              }))
                            }
                          >
                            <option value="project">Project</option>
                            <option value="idea">Idea</option>
                            <option value="staging">Staging Item</option>
                            <option value="goal">Goal</option>
                          </select>
                        </div>
                        <div>
                          <span style={S.label()}>Entity</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.targetId}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                targetId: e.target.value,
                              }))
                            }
                          >
                            <option value="">Select...</option>
                            {newLinkForm.targetType === 'project' &&
                              projects
                                .filter((p) => p.id !== hubId)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.emoji} {p.name}
                                  </option>
                                ))}
                            {newLinkForm.targetType === 'idea' &&
                              ideas.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.title}
                                </option>
                              ))}
                            {newLinkForm.targetType === 'staging' &&
                              staging.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            {newLinkForm.targetType === 'goal' &&
                              goals.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.title}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <span style={S.label()}>Relationship</span>
                          <select
                            style={S.sel}
                            value={newLinkForm.relationship}
                            onChange={(e) =>
                              setNewLinkForm((f) => ({
                                ...f,
                                relationship: e.target.value,
                              }))
                            }
                          >
                            <option value="related">Related</option>
                            <option value="parent">Parent of</option>
                            <option value="child">Child of</option>
                            <option value="supports">Supports</option>
                            <option value="blocks">Blocks</option>
                          </select>
                        </div>
                        <button
                          style={S.btn('primary')}
                          onClick={async () => {
                            if (!newLinkForm.targetId) {
                              showToast('Select an entity first');
                              return;
                            }
                            try {
                              const res = await linksApi.create(
                                'project',
                                hubId,
                                newLinkForm.targetType,
                                newLinkForm.targetId,
                                newLinkForm.relationship
                              );
                              setHubLinks((prev) => [
                                ...prev,
                                {
                                  id: res.id,
                                  source_type: 'project',
                                  source_id: hubId,
                                  target_type: newLinkForm.targetType,
                                  target_id: newLinkForm.targetId,
                                  relationship: newLinkForm.relationship,
                                  created_at: new Date().toISOString(),
                                },
                              ]);
                              setNewLinkForm((f) => ({ ...f, targetId: '' }));
                              showToast('✓ Link created');
                            } catch (e) {
                              showToast('Failed to create link');
                            }
                          }}
                        >
                          Link
                        </button>
                      </div>
                    </div>
                    <div style={S.card(false)}>
                      <span style={S.label()}>
                        Existing Links ({hubLinks.length})
                      </span>
                      {hubLinks.length === 0 ? (
                        <div
                          style={{
                            fontSize: 10,
                            color: C.dim,
                            padding: '8px 0',
                          }}
                        >
                          No links yet. Link this project to related ideas,
                          goals, or other projects.
                        </div>
                      ) : (
                        hubLinks.map((link) => {
                          const isSource =
                            link.source_type === 'project' &&
                            String(link.source_id) === String(hubId);
                          const otherType = isSource
                            ? link.target_type
                            : link.source_type;
                          const otherId = isSource
                            ? link.target_id
                            : link.source_id;
                          const rel = isSource
                            ? link.relationship
                            : `← ${link.relationship}`;
                          let otherLabel = '';
                          if (otherType === 'project') {
                            const p = projects.find(
                              (p) => String(p.id) === String(otherId)
                            );
                            otherLabel = p ? `${p.emoji} ${p.name}` : otherId;
                          } else if (otherType === 'idea') {
                            const i = ideas.find(
                              (i) => String(i.id) === String(otherId)
                            );
                            otherLabel = i ? `💡 ${i.title}` : otherId;
                          } else if (otherType === 'staging') {
                            const s = staging.find(
                              (s) => String(s.id) === String(otherId)
                            );
                            otherLabel = s ? `🌀 ${s.name}` : otherId;
                          } else if (otherType === 'goal') {
                            const g = goals.find(
                              (g) => String(g.id) === String(otherId)
                            );
                            otherLabel = g ? `🎯 ${g.title}` : otherId;
                          }
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 0',
                                borderBottom: `1px solid ${C.border}`,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  fontSize: 10,
                                }}
                              >
                                <span
                                  style={{
                                    color: C.blue2,
                                    textTransform: 'capitalize',
                                  }}
                                >
                                  {rel}
                                </span>
                                <span style={{ color: C.text }}>
                                  {otherLabel || otherId}
                                </span>
                                <span style={S.badge(C.purple)}>
                                  {otherType}
                                </span>
                              </div>
                              <button
                                style={{
                                  ...S.btn('danger'),
                                  padding: '2px 6px',
                                  fontSize: 8,
                                }}
                                onClick={async () => {
                                  await linksApi.delete(link.id);
                                  setHubLinks((prev) =>
                                    prev.filter((l) => l.id !== link.id)
                                  );
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

        {/* ═══════════════════════════════════════════
            BRAIN TABS
        ═══════════════════════════════════════════ */}
        {view === 'brain' && (
          <>
            {mainTab === 'command' && (
              <div>
                {/* Area summary cards - stack on mobile */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? '1fr'
                      : 'repeat(auto-fill,minmax(220px,1fr))',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  {areaStats.map((a) => (
                    <div
                      key={a.id}
                      style={S.card(activeAreaFilter === a.id, a.color)}
                      onClick={() =>
                        setActiveAreaFilter(
                          activeAreaFilter === a.id ? null : a.id
                        )
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 14 }}>
                          {a.icon}{' '}
                          <span style={{ fontSize: 12, fontWeight: 700 }}>
                            {a.name}
                          </span>
                        </span>
                        <span style={{ fontSize: 10, color: C.muted }}>
                          {a.projectCount} projects
                        </span>
                      </div>
                      <HealthBar score={a.health} />
                    </div>
                  ))}
                </div>

                {projects.filter((p) => p.health < 50).length > 0 && (
                  <div
                    style={{
                      background: 'rgba(239,68,68,0.05)',
                      border: '1px solid #ef444330',
                      borderRadius: 6,
                      padding: '10px 14px',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        color: C.red,
                        letterSpacing: '0.12em',
                        marginBottom: 6,
                      }}
                    >
                      🚨 HEALTH ALERTS
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {projects
                        .filter((p) => p.health < 50)
                        .map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              gap: 6,
                              alignItems: 'center',
                            }}
                          >
                            <span>{p.emoji}</span>
                            <span style={{ fontSize: 10 }}>{p.name}</span>
                            <HealthBar score={p.health} />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Drift Alerts (Phase 2.10) — mode-aware */}
                {driftFlags.length > 0 &&
                  getBehavior('drift_alerts', currentMode) === 'alert' && (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.05)',
                        border: '1px solid #f59e0b30',
                        borderRadius: 6,
                        padding: '10px 14px',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: C.amber,
                          letterSpacing: '0.12em',
                          marginBottom: 6,
                        }}
                      >
                        ⚠️ DRIFT DETECTED
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        {driftFlags.map((flag, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                flex: 1,
                              }}
                            >
                              <span style={{ fontSize: 10 }}>
                                {flag.type === 'training_deficit'
                                  ? '🥋'
                                  : flag.type === 'outreach_gap'
                                    ? '📣'
                                    : flag.type === 'energy_decline'
                                      ? '🌙'
                                      : flag.type === 'session_gap'
                                        ? '⏱️'
                                        : '📉'}
                              </span>
                              <span style={{ fontSize: 10, color: C.text }}>
                                {flag.message}
                              </span>
                              {flag.severity === 'high' && (
                                <span
                                  style={{ ...S.badge(C.red), fontSize: 8 }}
                                >
                                  HIGH
                                </span>
                              )}
                            </div>
                            <button
                              style={{
                                ...S.btn('ghost'),
                                padding: '2px 6px',
                                fontSize: 8,
                              }}
                              onClick={() => dismissDriftFlag(flag.type)}
                            >
                              Dismiss
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                {/* Assistant mode: compact drift badge */}
                {driftFlags.length > 0 &&
                  getBehavior('drift_alerts', currentMode) === 'badge' && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid #f59e0b20',
                        borderRadius: 12,
                        padding: '4px 10px',
                        marginBottom: 10,
                        cursor: 'pointer',
                      }}
                      onClick={() => setDriftExpanded((prev) => !prev)}
                    >
                      <span style={{ fontSize: 10, color: C.amber }}>
                        ⚠️ {driftFlags.length} drift alert
                        {driftFlags.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                {driftFlags.length > 0 &&
                  getBehavior('drift_alerts', currentMode) === 'badge' &&
                  driftExpanded && (
                    <div
                      style={{
                        background: 'rgba(245,158,11,0.03)',
                        border: '1px solid #f59e0b15',
                        borderRadius: 6,
                        padding: '8px 12px',
                        marginBottom: 10,
                      }}
                    >
                      {driftFlags.map((flag, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 9,
                            color: C.muted,
                            padding: '2px 0',
                          }}
                        >
                          {flag.message}
                        </div>
                      ))}
                    </div>
                  )}
                {/* Training Log card (Phase 2.6) */}
                <div style={S.card(weeklyTraining.count >= 3, C.green)}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: C.green,
                        letterSpacing: '0.11em',
                        textTransform: 'uppercase',
                      }}
                    >
                      🥋 Training This Week
                    </span>
                    <button
                      style={{ ...S.btn('success'), fontSize: 9 }}
                      onClick={() => setShowTrainingModal(true)}
                    >
                      + Log Training
                    </button>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: isMobile ? 8 : 16,
                      alignItems: isMobile ? 'flex-start' : 'center',
                      flexDirection: isMobile ? 'column' : 'row',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color:
                              weeklyTraining.count >= 3
                                ? C.green
                                : weeklyTraining.count >= 1
                                  ? C.amber
                                  : C.dim,
                          }}
                        >
                          {weeklyTraining.count}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: C.dim,
                            textTransform: 'uppercase',
                          }}
                        >
                          Sessions
                        </div>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: C.blue,
                          }}
                        >
                          {weeklyTraining.minutes}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: C.dim,
                            textTransform: 'uppercase',
                          }}
                        >
                          Minutes
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}>
                      <div
                        style={{
                          height: 6,
                          background: C.border,
                          borderRadius: 3,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, Math.round((weeklyTraining.count / 3) * 100))}%`,
                            height: '100%',
                            background:
                              weeklyTraining.count >= 3 ? C.green : C.amber,
                            borderRadius: 3,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                        {weeklyTraining.count >= 3
                          ? '✓ Target met'
                          : 'Target: 3 sessions/week'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Outreach card (Phase 2.7) — mode-aware */}
                {shouldShow('outreach_enforcement', currentMode) && (
                  <div style={S.card(todayOutreach.length > 0, C.purple)}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.purple,
                          letterSpacing: '0.11em',
                          textTransform: 'uppercase',
                        }}
                      >
                        📣 Outreach
                      </span>
                      <button
                        style={{
                          ...S.btn('ghost'),
                          fontSize: 9,
                          borderColor: C.purple + '50',
                          color: C.purple,
                        }}
                        onClick={() => setShowOutreachModal(true)}
                      >
                        + Log
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: isMobile ? 8 : 16,
                        alignItems: isMobile ? 'flex-start' : 'center',
                        flexDirection: isMobile ? 'column' : 'row',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                              color:
                                todayOutreach.length > 0 ? C.purple : C.dim,
                            }}
                          >
                            {todayOutreach.length}
                          </div>
                          <div
                            style={{
                              fontSize: 8,
                              color: C.dim,
                              textTransform: 'uppercase',
                            }}
                          >
                            Today
                          </div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                              color: C.blue,
                            }}
                          >
                            {weeklyOutreach}
                          </div>
                          <div
                            style={{
                              fontSize: 8,
                              color: C.dim,
                              textTransform: 'uppercase',
                            }}
                          >
                            This week
                          </div>
                        </div>
                      </div>
                      <div
                        style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}
                      >
                        {todayOutreach.length > 0 ? (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                            }}
                          >
                            {todayOutreach.slice(-3).map((o, i) => (
                              <div
                                key={i}
                                style={{
                                  fontSize: 9,
                                  color: C.dim,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {o.type === 'message'
                                  ? '💬'
                                  : o.type === 'post'
                                    ? '📣'
                                    : o.type === 'call'
                                      ? '📞'
                                      : o.type === 'email'
                                        ? '📧'
                                        : '🤝'}{' '}
                                {o.target || o.notes || o.type}
                              </div>
                            ))}
                          </div>
                        ) : getBehavior('outreach_enforcement', currentMode) ===
                          'modal' ? (
                          <div style={{ fontSize: 9, color: C.red }}>
                            ⚠ No outreach yet today
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: C.dim }}>
                            No outreach logged today
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Tasks card (Phase 5.4) */}
                <div
                  style={S.card(
                    tasks.filter((t) => t.status !== 'complete').length > 0,
                    C.amber
                  )}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: C.amber,
                        letterSpacing: '0.11em',
                        textTransform: 'uppercase',
                      }}
                    >
                      ✓ My Tasks
                    </span>
                    <button
                      style={{
                        ...S.btn('ghost'),
                        fontSize: 9,
                        borderColor: C.amber + '50',
                        color: C.amber,
                      }}
                      onClick={() => setShowTaskModal(true)}
                    >
                      + Add
                    </button>
                  </div>
                  {tasksLoading ? (
                    <div style={{ fontSize: 10, color: C.dim }}>
                      Loading tasks...
                    </div>
                  ) : tasks.filter((t) => t.status !== 'complete').length ===
                    0 ? (
                    <div style={{ fontSize: 9, color: C.dim }}>
                      No pending tasks. Create one to get started.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {tasks
                        .filter((t) => t.status !== 'complete')
                        .slice(0, 5)
                        .map((task) => {
                          const project = projects.find(
                            (p) => p.id === task.project_id
                          );
                          const priorityColor =
                            task.priority === 'critical'
                              ? C.red
                              : task.priority === 'high'
                                ? C.amber
                                : task.priority === 'medium'
                                  ? C.blue
                                  : C.dim;
                          return (
                            <div
                              key={task.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '6px 8px',
                                background: '#0a0f14',
                                borderRadius: 4,
                              }}
                            >
                              <button
                                style={{
                                  width: 16,
                                  height: 16,
                                  border: `1px solid ${C.border}`,
                                  borderRadius: 3,
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                                onClick={() => completeTask(task.id)}
                                title="Complete task"
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: C.text,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {task.title}
                                </div>
                                <div
                                  style={{
                                    fontSize: 8,
                                    color: C.dim,
                                    display: 'flex',
                                    gap: 6,
                                  }}
                                >
                                  {project && (
                                    <span>
                                      {project.emoji} {project.name}
                                    </span>
                                  )}
                                  <span style={{ color: priorityColor }}>
                                    {task.priority}
                                  </span>
                                  {task.assignee_type === 'agent' && (
                                    <span>🤖 {task.assignee_id}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                style={{
                                  ...S.btn('ghost'),
                                  padding: '2px 6px',
                                  fontSize: 8,
                                  color: C.red,
                                }}
                                onClick={() => deleteTask(task.id)}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      {tasks.filter((t) => t.status !== 'complete').length >
                        5 && (
                        <div
                          style={{
                            fontSize: 9,
                            color: C.dim,
                            textAlign: 'center',
                          }}
                        >
                          +
                          {tasks.filter((t) => t.status !== 'complete').length -
                            5}{' '}
                          more tasks
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={S.card(true)}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: C.blue,
                        letterSpacing: '0.11em',
                        textTransform: 'uppercase',
                      }}
                    >
                      ⚡ Today's Focus
                    </span>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          style={{
                            ...S.btn(focusId === p.id ? 'primary' : 'ghost'),
                            fontSize: 9,
                          }}
                          onClick={() => setFocusId(p.id)}
                        >
                          {p.emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                  {focusP && (
                    <div
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.blue}`,
                        borderRadius: 6,
                        padding: '12px 16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#f1f5f9',
                          }}
                        >
                          {focusP.emoji} {focusP.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            alignItems: 'center',
                          }}
                        >
                          <BadgeStatus status={focusP.status} />
                          <HealthBar score={focusP.health} />
                          <Dots n={focusP.momentum} />
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          lineHeight: 1.6,
                          marginBottom: 8,
                        }}
                      >
                        {focusP.desc}
                      </div>
                      <span style={S.label()}>Next Action</span>
                      <div
                        style={{
                          fontSize: 12,
                          color: C.green,
                          marginBottom: 8,
                        }}
                      >
                        → {focusP.nextAction}
                      </div>
                      {focusP.blockers?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {focusP.blockers.map((b, i) => (
                            <div
                              key={i}
                              style={{ fontSize: 10, color: '#78350f' }}
                            >
                              ⚠ {b}
                            </div>
                          ))}
                        </div>
                      )}
                      <div
                        style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}
                      >
                        <button
                          style={S.btn('success')}
                          onClick={() => openHub(focusP.id)}
                        >
                          🗂 Open Hub
                        </button>
                        {!sessionActive && (
                          <button
                            style={S.btn('primary')}
                            onClick={() => setSessionOn(true)}
                          >
                            ▶ Start Session
                          </button>
                        )}
                        <button
                          style={S.btn('ghost')}
                          onClick={() => {
                            setMainTab('ai');
                            askAI(
                              `Sharp 2-hour plan for ${focusP.name}. What exactly do I do right now?`
                            );
                          }}
                        >
                          💬 Ask AI
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div style={S.card(false)}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: C.blue,
                        letterSpacing: '0.11em',
                        textTransform: 'uppercase',
                      }}
                    >
                      📋 Priority Stack {activeAreaFilter && '(Filtered)'}
                    </div>
                    {activeAreaFilter && (
                      <button
                        style={{ ...S.btn('ghost'), fontSize: 8 }}
                        onClick={() => setActiveAreaFilter(null)}
                      >
                        Show All
                      </button>
                    )}
                  </div>
                  {[...filteredProjects]
                    .sort((a, b) => a.priority - b.priority)
                    .map((p, i) => (
                      <div
                        key={p.id}
                        onClick={() => openHub(p.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 0',
                          borderBottom:
                            i < projects.length - 1
                              ? `1px solid ${C.border}`
                              : 'none',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = '#ffffff05')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = 'transparent')
                        }
                      >
                        <div
                          style={{
                            width: 18,
                            fontSize: 10,
                            color: C.dim,
                            fontWeight: 700,
                          }}
                        >
                          {p.priority}
                        </div>
                        <span style={{ fontSize: 14 }}>{p.emoji}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              color: p.id === focusId ? C.blue2 : '#e2e8f0',
                              fontWeight: p.id === focusId ? 700 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 8, color: C.dim }}>
                            {p.phase} · {p.lastTouched}
                          </div>
                        </div>
                        <HealthBar score={p.health} />
                        <Dots n={p.momentum} />
                        <BadgeStatus status={p.status} />
                        {p.revenueReady && (
                          <span style={S.badge(C.green)}>
                            {activeGoal?.currency === 'GBP'
                              ? '£'
                              : activeGoal?.currency === 'USD'
                                ? '$'
                                : activeGoal?.currency === 'EUR'
                                  ? '€'
                                  : activeGoal?.currency || '£'}
                          </span>
                        )}
                        {staging.filter(
                          (s) => s.project === p.id && s.status === 'in-review'
                        ).length > 0 && (
                          <span style={S.badge(C.amber)}>
                            {
                              staging.filter(
                                (s) =>
                                  s.project === p.id && s.status === 'in-review'
                              ).length
                            }
                            ⏳
                          </span>
                        )}
                      </div>
                    ))}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                    cursor: 'pointer',
                  }}
                  onClick={() => setModal('manage-goals')}
                >
                  <div style={{ fontSize: 9, color: C.dim }}>
                    {activeGoal?.title || 'Goal'}:{' '}
                    {activeGoal?.currency === 'USD'
                      ? '$'
                      : activeGoal?.currency === 'EUR'
                        ? '€'
                        : activeGoal?.currency === 'GBP'
                          ? '£'
                          : activeGoal?.currency || '£'}
                    {totalIncome} /{' '}
                    {activeGoal?.currency === 'USD'
                      ? '$'
                      : activeGoal?.currency === 'EUR'
                        ? '€'
                        : activeGoal?.currency === 'GBP'
                          ? '£'
                          : activeGoal?.currency || '£'}
                    {activeGoal?.target_amount || 3000} (
                    {Math.round(
                      (totalIncome / (activeGoal?.target_amount || 3000)) * 100
                    )}
                    %)
                  </div>
                  <div style={{ fontSize: 9, color: C.blue }}>⚙️ Manage</div>
                </div>
                <div
                  style={{
                    height: 6,
                    background: C.border,
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginBottom: 4,
                  }}
                  onClick={() => setModal('manage-goals')}
                >
                  <div
                    style={{
                      width: `${Math.min(100, Math.round((totalIncome / (activeGoal?.target_amount || 3000)) * 100))}%`,
                      height: '100%',
                      background: `linear-gradient(90deg,${C.blue},${C.green})`,
                      borderRadius: 3,
                    }}
                  />
                </div>

                {/* Progress Trends (simplified) */}
                {weeklyTraining.count > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <ProgressTrends
                      title="Training Trend (Last 7 Days)"
                      data={[
                        {
                          label: 'Mon',
                          value: Math.max(0, weeklyTraining.count - 2),
                        },
                        {
                          label: 'Tue',
                          value: Math.max(0, weeklyTraining.count - 1),
                        },
                        { label: 'Wed', value: weeklyTraining.count },
                        { label: 'Thu', value: weeklyTraining.count },
                        { label: 'Fri', value: weeklyTraining.count },
                        { label: 'Sat', value: weeklyTraining.count },
                        { label: 'Sun', value: weeklyTraining.count },
                      ]}
                      color={C.green}
                    />
                  </div>
                )}
              </div>
            )}

            {mainTab === 'projects' && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    marginBottom: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <button
                    style={S.btn('primary')}
                    onClick={() => setModal('new-project')}
                  >
                    + New Project
                  </button>
                  <button
                    style={S.btn('ghost')}
                    onClick={() => setShowImportModal(true)}
                  >
                    ⬆ Import
                  </button>
                </div>
                {projects.map((p) => (
                  <div key={p.id} style={S.card(false)}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: 18 }}>{p.emoji}</span>
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#f1f5f9',
                            }}
                          >
                            {p.name}
                          </div>
                          <div style={{ fontSize: 8, color: C.muted }}>
                            {p.phase} · #{p.priority} · {p.lastTouched}
                          </div>
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 5,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <HealthBar score={p.health} />
                        <Dots n={p.momentum} />
                        <BadgeStatus status={p.status} />
                        <button
                          style={{ ...S.btn('success'), fontSize: 9 }}
                          onClick={() => openHub(p.id)}
                        >
                          🗂 Hub
                        </button>
                        <button
                          style={{ ...S.btn('ghost'), fontSize: 9 }}
                          onClick={() => exportProject(p.id)}
                        >
                          ⬇
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: C.muted,
                        lineHeight: 1.5,
                        marginBottom: 4,
                      }}
                    >
                      {p.desc}
                    </div>
                    <div style={{ fontSize: 10, color: C.green }}>
                      → {p.nextAction}
                    </div>
                    <QuickTagRow entityType="project" entityId={p.id} />
                  </div>
                ))}
                {projects.length === 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: C.dim,
                      textAlign: 'center',
                      padding: '40px 0',
                    }}
                  >
                    No projects yet. Create your first one above.
                  </div>
                )}
              </div>
            )}

            {mainTab === 'bootstrap' && (
              <div>
                <div style={{ ...S.card(true, C.green), marginBottom: 10 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div>
                      <span style={S.label(C.green)}>
                        🚀 Agent Bootstrap Protocol
                      </span>
                      <div
                        style={{
                          fontSize: 11,
                          color: C.text,
                          lineHeight: 1.8,
                          maxWidth: 560,
                        }}
                      >
                        Spin up a new project with agent control baked in from
                        day one. Generates a Bootstrap Brief + ready-to-paste
                        agent prompts, all saved to your database.
                      </div>
                    </div>
                    <button
                      style={{
                        ...S.btn('success'),
                        fontSize: 11,
                        padding: '8px 16px',
                      }}
                      onClick={() => setModal('new-project')}
                    >
                      + New Project → Bootstrap
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile
                      ? '1fr'
                      : 'repeat(auto-fill,minmax(180px,1fr))',
                    gap: 8,
                    marginBottom: 14,
                  }}
                >
                  {BOOTSTRAP_STEPS.map((s, i) => (
                    <div
                      key={s.id}
                      style={{
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 16, marginBottom: 4 }}>
                        {s.icon}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{ fontSize: 9, color: C.dim, fontWeight: 700 }}
                        >
                          STEP {i + 1}
                        </span>
                        {s.agent ? (
                          <span style={S.badge(C.blue2)}>{s.agent}</span>
                        ) : (
                          <span style={S.badge(C.amber)}>YOU</span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#e2e8f0',
                          fontWeight: 600,
                          marginBottom: 4,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{ fontSize: 9, color: C.muted, lineHeight: 1.6 }}
                      >
                        {s.desc}
                      </div>
                    </div>
                  ))}
                </div>
                {projects.map((p) => {
                  const bf = p.files || {};
                  const briefExists =
                    !!bf['project-artifacts/BOOTSTRAP_BRIEF.md'];
                  const stratDone =
                    !!bf['project-artifacts/STRATEGY_OUTPUT.md'];
                  const devDone = !!bf['code-modules/DEV_BRIEF.md'];
                  const steps = [
                    { label: 'Brief', done: briefExists },
                    { label: 'Strategy', done: stratDone },
                    { label: 'Dev', done: devDone },
                    { label: 'Design', done: !!bf['design-assets/UI_SPEC.md'] },
                    {
                      label: 'Content',
                      done: !!bf['content-assets/LAUNCH_COPY.md'],
                    },
                    {
                      label: 'Review',
                      done:
                        p.status === 'active' &&
                        briefExists &&
                        stratDone &&
                        devDone,
                    },
                  ];
                  const pct = Math.round(
                    (steps.filter((s) => s.done).length / steps.length) * 100
                  );
                  return (
                    <div
                      key={p.id}
                      style={{
                        ...S.card(false),
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                      onClick={() => setBootstrapWiz(p.id)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0 }}>
                        {p.emoji}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 5,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: '#e2e8f0',
                              fontWeight: 600,
                            }}
                          >
                            {p.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              color:
                                pct === 100
                                  ? C.green
                                  : pct > 0
                                    ? C.amber
                                    : C.dim,
                            }}
                          >
                            {pct}% bootstrapped
                          </span>
                        </div>
                        <div
                          style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
                        >
                          {steps.map((s) => (
                            <span
                              key={s.label}
                              style={{
                                fontSize: 8,
                                padding: '2px 6px',
                                borderRadius: 3,
                                background: s.done
                                  ? 'rgba(16,185,129,0.12)'
                                  : 'rgba(255,255,255,0.04)',
                                color: s.done ? C.green : C.dim,
                                border: `1px solid ${s.done ? '#10b98130' : C.border}`,
                              }}
                            >
                              {s.done ? '✓' : ''} {s.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                        {briefExists ? (
                          <button
                            style={{ ...S.btn('ghost'), fontSize: 9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openHub(
                                p.id,
                                'project-artifacts/BOOTSTRAP_BRIEF.md'
                              );
                            }}
                          >
                            📋 Brief
                          </button>
                        ) : (
                          <span style={S.badge(C.amber)}>No Brief</span>
                        )}
                        {briefExists && !stratDone && (
                          <button
                            style={{ ...S.btn('primary'), fontSize: 9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openHub(
                                p.id,
                                'project-artifacts/STRATEGY_PROMPT.md'
                              );
                            }}
                          >
                            🎯 Strategy →
                          </button>
                        )}
                        {stratDone && !devDone && (
                          <button
                            style={{ ...S.btn('primary'), fontSize: 9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openHub(p.id, 'project-artifacts/DEV_PROMPT.md');
                            }}
                          >
                            🛠 Dev →
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {mainTab === 'staging' && (
              <div>
                <div style={S.card(false)}>
                  <span style={S.label()}>🌀 Stage Something</span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <select
                      style={S.sel}
                      value={newStaging.tag}
                      onChange={(e) =>
                        setNewStaging((s) => ({ ...s, tag: e.target.value }))
                      }
                    >
                      {ITEM_TAGS.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <select
                      style={S.sel}
                      value={newStaging.project}
                      onChange={(e) =>
                        setNewStaging((s) => ({
                          ...s,
                          project: e.target.value,
                        }))
                      }
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.emoji} {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    style={{ ...S.input, marginBottom: 6 }}
                    placeholder="Name or description..."
                    value={newStaging.name}
                    onChange={(e) =>
                      setNewStaging((s) => ({ ...s, name: e.target.value }))
                    }
                  />
                  <input
                    style={{ ...S.input, marginBottom: 6 }}
                    placeholder="Notes..."
                    value={newStaging.notes}
                    onChange={(e) =>
                      setNewStaging((s) => ({ ...s, notes: e.target.value }))
                    }
                  />
                  <button
                    style={S.btn('primary')}
                    onClick={() => {
                      if (newStaging.name.trim()) {
                        addStaging(newStaging);
                        setNewStaging({
                          name: '',
                          tag: 'IDEA_',
                          project: projects[0]?.id || '',
                          notes: '',
                        });
                      }
                    }}
                  >
                    → Stage It
                  </button>
                </div>
                {['in-review', 'approved', 'deferred', 'rejected'].map((sk) => {
                  const items = staging.filter((s) => s.status === sk);
                  if (!items.length && sk !== 'in-review') return null;
                  const sc = REVIEW_STATUSES[sk];
                  return (
                    <div key={sk} style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: sc.color,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          marginBottom: 6,
                        }}
                      >
                        {sc.icon} {sc.label} ({items.length})
                      </div>
                      {!items.length && (
                        <div style={{ fontSize: 9, color: C.dim }}>
                          Nothing here.
                        </div>
                      )}
                      {items.map((item) => {
                        const proj = projects.find(
                          (p) => p.id === item.project
                        );
                        const isc = REVIEW_STATUSES[item.status];
                        return (
                          <div
                            key={item.id}
                            style={{
                              background: C.surface,
                              border: `1px solid ${isc.color}22`,
                              borderLeft: `3px solid ${isc.color}`,
                              borderRadius: '0 5px 5px 0',
                              padding: '8px 13px',
                              marginBottom: 5,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 5,
                                marginBottom: 3,
                              }}
                            >
                              <div>
                                <span
                                  style={{
                                    fontSize: 9,
                                    background: C.border,
                                    padding: '1px 5px',
                                    borderRadius: 3,
                                    marginRight: 6,
                                  }}
                                >
                                  {item.tag}
                                </span>
                                <span style={{ fontSize: 11 }}>
                                  {item.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 8, color: C.muted }}>
                                {proj?.emoji} {proj?.name} · {item.added}
                              </span>
                            </div>
                            {item.notes && (
                              <div
                                style={{
                                  fontSize: 9,
                                  color: C.muted,
                                  marginBottom: 5,
                                }}
                              >
                                {item.notes}
                              </div>
                            )}
                            <QuickTagRow
                              entityType="staging"
                              entityId={item.id}
                            />
                            <div
                              style={{ display: 'flex', gap: 4, marginTop: 4 }}
                            >
                              {['approved', 'rejected', 'deferred']
                                .filter((s) => s !== sk)
                                .map((s) => (
                                  <button
                                    key={s}
                                    style={{
                                      ...S.btn(
                                        s === 'approved'
                                          ? 'success'
                                          : s === 'rejected'
                                            ? 'danger'
                                            : 'ghost'
                                      ),
                                      padding: '2px 7px',
                                      fontSize: 8,
                                    }}
                                    onClick={() =>
                                      updateStagingStatus(item.id, s)
                                    }
                                  >
                                    {REVIEW_STATUSES[s].icon} {s}
                                  </button>
                                ))}
                              <button
                                style={{
                                  ...S.btn('ghost'),
                                  padding: '2px 7px',
                                  fontSize: 8,
                                }}
                                onClick={() => openHub(item.project)}
                              >
                                🗂 Hub
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {mainTab === 'skills' && (
              <div style={{ height: 'calc(100vh - 200px)' }}>
                <AgentManager
                  projectId={hubId}
                  projectFiles={hub?.files}
                  onSaveAgent={async (agentId, content) => {
                    // Save custom agent to project files
                    if (hubId) {
                      await saveFile(hubId, `agents/${agentId}.md`, content);
                      showToast(`✓ Agent ${agentId} created`);
                    }
                  }}
                />
              </div>
            )}

            {mainTab === 'workflows' && (
              <div style={{ height: 'calc(100vh - 200px)' }}>
                <WorkflowRunner
                  projectId={focusId}
                  project={projects.find((p) => p.id === focusId)}
                  agents={[]}
                />
              </div>
            )}

            {mainTab === 'integrations' && (
              <GitHubIntegration projects={projects} isMobile={isMobile} />
            )}

            {mainTab === 'ideas' && (
              <div>
                <div style={S.card(false)}>
                  <span style={S.label()}>💡 Bank an Idea</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={S.input}
                      value={newIdea}
                      onChange={(e) => setNewIdea(e.target.value)}
                      placeholder="Describe it..."
                      onKeyDown={(e) => e.key === 'Enter' && addIdea(newIdea)}
                    />
                    <button
                      style={S.btn('primary')}
                      onClick={() => addIdea(newIdea)}
                    >
                      Bank It
                    </button>
                  </div>
                  <div style={{ fontSize: 8, color: C.dim, marginTop: 4 }}>
                    Ideas ≠ projects. Bank now. Promote only when P1–P3 have
                    revenue.
                  </div>
                </div>
                {ideas.map((idea) => (
                  <div
                    key={idea.id}
                    style={{
                      ...S.card(false),
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: C.text }}>
                        {idea.title}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 3,
                          marginTop: 3,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <QuickTagRow entityType="idea" entityId={idea.id} />
                        <span
                          style={{
                            fontSize: 8,
                            padding: '1px 5px',
                            borderRadius: 8,
                            background: C.border,
                            color: C.muted,
                          }}
                        >
                          {idea.added}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color:
                          idea.score >= 7
                            ? C.green
                            : idea.score >= 5
                              ? C.amber
                              : C.red,
                      }}
                    >
                      {idea.score}/10
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mainTab === 'ai' && (
              <div>
                <div style={S.card(false)}>
                  <span style={S.label()}>💬 AI Coach</span>
                  {getBehavior('ai_coach_tab', currentMode) === 'full' && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 5,
                        flexWrap: 'wrap',
                        marginBottom: 10,
                      }}
                    >
                      {[
                        'What should I work on today?',
                        'Where am I looping?',
                        'Thailand income path?',
                        'Triage staging',
                        'Rank by revenue potential',
                        'Which project is dying?',
                      ].map((p) => (
                        <button
                          key={p}
                          style={S.btn('ghost')}
                          onClick={() => askAI(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={S.input}
                      value={aiIn}
                      placeholder="Ask anything..."
                      onChange={(e) => setAiIn(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && aiIn.trim()) {
                          askAI(aiIn);
                          setAiIn('');
                        }
                      }}
                    />
                    <button
                      style={S.btn('primary')}
                      onClick={() => {
                        if (aiIn.trim()) {
                          askAI(aiIn);
                          setAiIn('');
                        }
                      }}
                      disabled={aiLoad}
                    >
                      Ask
                    </button>
                  </div>
                </div>
                {(aiLoad || aiOut) && (
                  <div ref={aiRef} style={{ ...S.card(true, C.green) }}>
                    <span style={S.label(C.green)}>Response</span>
                    {aiLoad ? (
                      <div style={{ fontSize: 10, color: C.dim }}>
                        Thinking...
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 11,
                          color: C.text,
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {renderAIResponse(aiOut, projectsById, (uri) => {
                          const nav = uriToNavigation(uri);
                          if (!nav) return;
                          if (
                            nav.type === 'OPEN_PROJECT' ||
                            nav.type === 'OPEN_FILE'
                          ) {
                            const proj = projects.find(
                              (p) => p.id === nav.params.projectId
                            );
                            if (proj) {
                              openHub(proj);
                              if (nav.params.filePath) {
                                setTimeout(
                                  () => openFile(nav.params.filePath),
                                  100
                                );
                              }
                            }
                          } else if (nav.type === 'OPEN_GOAL') {
                            setShowGoalModal(true);
                          }
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {mainTab === 'review' && (
              <WeeklyReviewPanel
                token={token.get()}
                onAskAI={async (prompt) => {
                  const d = await aiApi.ask(prompt);
                  return d.content?.map((b) => b.text || '').join('') || '';
                }}
              />
            )}

            {mainTab === 'export' && (
              <div>
                <div style={S.card(true)}>
                  <span style={S.label()}>📤 Agent Context + Exports</span>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginBottom: 12,
                    }}
                  >
                    <button
                      style={S.btn('primary')}
                      onClick={() => copy(buildCtx())}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy Full Context'}
                    </button>
                    {projects[0] && (
                      <>
                        <button
                          style={S.btn('ghost')}
                          onClick={() => copy(buildBrief('dev', briefProj))}
                        >
                          📋 Dev Brief
                        </button>
                        <button
                          style={S.btn('ghost')}
                          onClick={() =>
                            copy(buildBrief('strategy', briefProj))
                          }
                        >
                          📋 Strategy Brief
                        </button>
                      </>
                    )}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <span style={S.label()}>
                      Export Projects (local download)
                    </span>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {projects.map((p) => (
                        <button
                          key={p.id}
                          style={S.btn('ghost')}
                          onClick={() => exportProject(p.id)}
                        >
                          {p.emoji} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre
                    style={{
                      fontSize: 8,
                      color: C.dim,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 5,
                      padding: 12,
                      overflow: 'auto',
                      maxHeight: 280,
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {buildCtx()}
                  </pre>
                </div>
              </div>
            )}

            {mainTab === 'tags' && (
              <div>
                <div style={S.card(false)}>
                  <span style={S.label()}>🏷 Tag Cloud</span>
                  {userTags.length === 0 ? (
                    <div
                      style={{ fontSize: 10, color: C.dim, padding: '8px 0' }}
                    >
                      No tags yet. Tag a project, idea, staging item, goal, or
                      file to get started.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 6,
                      }}
                    >
                      {userTags.map((t) => {
                        const count = entityTags.filter(
                          (et) => et.tag_id === t.id
                        ).length;
                        const isSel = selectedTagId === t.id;
                        return (
                          <span
                            key={t.id}
                            onClick={() =>
                              setSelectedTagId(isSel ? null : t.id)
                            }
                            style={{
                              padding: '3px 10px',
                              borderRadius: 12,
                              border: `1px solid ${isSel ? t.color || C.blue : C.border}`,
                              background: isSel
                                ? (t.color || C.blue) + '22'
                                : 'transparent',
                              color: t.color || C.blue,
                              fontSize: 10,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                          >
                            {t.name}{' '}
                            <span style={{ fontSize: 8, color: C.muted }}>
                              {count}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                {selectedTagId &&
                  (() => {
                    const tag = userTags.find((t) => t.id === selectedTagId);
                    if (!tag) return null;
                    const matches = entityTags.filter(
                      (et) => et.tag_id === selectedTagId
                    );
                    const byType = {};
                    matches.forEach((et) => {
                      if (!byType[et.entity_type]) byType[et.entity_type] = [];
                      byType[et.entity_type].push(et);
                    });
                    const TYPE_LABELS = {
                      project: 'Projects',
                      idea: 'Ideas',
                      staging: 'Staging',
                      goal: 'Goals',
                      file: 'Files',
                    };
                    const renderEntity = (type, et) => {
                      if (type === 'project') {
                        const p = projects.find(
                          (p) => String(p.id) === String(et.entity_id)
                        );
                        if (!p) return null;
                        return (
                          <div
                            key={et.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: `1px solid ${C.border}`,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              openHub(p.id);
                              setView('hub');
                            }}
                          >
                            <span>{p.emoji}</span>
                            <span style={{ fontSize: 10 }}>{p.name}</span>
                            <BadgeStatus status={p.status} />
                          </div>
                        );
                      }
                      if (type === 'idea') {
                        const i = ideas.find(
                          (i) => String(i.id) === String(et.entity_id)
                        );
                        if (!i) return null;
                        return (
                          <div
                            key={et.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            <span style={{ fontSize: 10 }}>💡 {i.title}</span>
                            <span style={{ fontSize: 9, color: C.dim }}>
                              {i.score}/10
                            </span>
                          </div>
                        );
                      }
                      if (type === 'staging') {
                        const s = staging.find(
                          (s) => String(s.id) === String(et.entity_id)
                        );
                        if (!s) return null;
                        const proj = projects.find((p) => p.id === s.project);
                        return (
                          <div
                            key={et.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            <span style={{ fontSize: 10 }}>🌀 {s.name}</span>
                            <span style={{ fontSize: 8, color: C.muted }}>
                              {proj?.emoji} {proj?.name}
                            </span>
                          </div>
                        );
                      }
                      if (type === 'goal') {
                        const g = goals.find(
                          (g) => String(g.id) === String(et.entity_id)
                        );
                        if (!g) return null;
                        return (
                          <div
                            key={et.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: `1px solid ${C.border}`,
                            }}
                          >
                            <span style={{ fontSize: 10 }}>🎯 {g.title}</span>
                            <span style={{ fontSize: 8, color: C.muted }}>
                              {g.currency}
                              {g.current_amount}/{g.target_amount}
                            </span>
                          </div>
                        );
                      }
                      if (type === 'file') {
                        const [projectId, ...rest] = et.entity_id.split('/');
                        const filePath = rest.join('/');
                        const p = projects.find(
                          (p) => String(p.id) === String(projectId)
                        );
                        return (
                          <div
                            key={et.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 0',
                              borderBottom: `1px solid ${C.border}`,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              openHub(projectId, filePath);
                              setView('hub');
                            }}
                          >
                            <span style={{ fontSize: 10 }}>📝 {filePath}</span>
                            <span style={{ fontSize: 8, color: C.muted }}>
                              {p?.emoji} {p?.name}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    };
                    return (
                      <div style={S.card(false)}>
                        <span style={S.label()}>
                          All entities tagged{' '}
                          <span style={{ color: tag.color || C.blue }}>
                            {tag.name}
                          </span>{' '}
                          ({matches.length})
                        </span>
                        {matches.length === 0 && (
                          <div style={{ fontSize: 10, color: C.dim }}>
                            No entities tagged with this yet.
                          </div>
                        )}
                        {['project', 'idea', 'staging', 'goal', 'file']
                          .filter((type) => byType[type])
                          .map((type) => (
                            <div key={type} style={{ marginBottom: 12 }}>
                              <div
                                style={{
                                  fontSize: 8,
                                  color: C.dim,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.1em',
                                  marginBottom: 4,
                                }}
                              >
                                {TYPE_LABELS[type]} ({byType[type].length})
                              </div>
                              {byType[type].map((et) => renderEntity(type, et))}
                            </div>
                          ))}
                      </div>
                    );
                  })()}
              </div>
            )}
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
