import {
  mysqlTable,
  varchar,
  int,
  text,
  datetime,
  json,
  tinyint,
  unique,
  index,
  primaryKey,
  decimal,
} from "drizzle-orm/mysql-core";

// ────────────────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────────────────
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    email: varchar("email", { length: 255 }).notNull().unique(),
    password_hash: varchar("password_hash", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    goal: text("goal"),
    monthly_target: int("monthly_target").default(3000),
    currency: varchar("currency", { length: 8 }).default("GBP"),
    timezone: varchar("timezone", { length: 64 }).default("Europe/London"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    emailIdx: index("idx_email").on(table.email),
  })
);

// ────────────────────────────────────────────────────────────────
// PROJECTS
// ────────────────────────────────────────────────────────────────
export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    life_area_id: varchar("life_area_id", { length: 36 }),
    name: varchar("name", { length: 255 }).notNull(),
    emoji: varchar("emoji", { length: 8 }).default("📁"),
    phase: varchar("phase", { length: 32 }).default("BOOTSTRAP"),
    status: varchar("status", { length: 32 }).default("active"),
    priority: int("priority").default(99),
    revenue_ready: tinyint("revenue_ready").default(0),
    income_target: int("income_target").default(0),
    momentum: int("momentum").default(3),
    last_touched: varchar("last_touched", { length: 8 }),
    description: text("description"),
    next_action: text("next_action"),
    blockers: json("blockers"),
    tags: json("tags"),
    skills: json("skills"),
    integrations: json("integrations"),
    active_file: varchar("active_file", { length: 512 }).default("PROJECT_OVERVIEW.md"),
    health: int("health").default(100),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_projects").on(table.user_id, table.priority),
    areaIdx: index("idx_area_projects").on(table.life_area_id),
  })
);

// ────────────────────────────────────────────────────────────────
// PROJECT CUSTOM FOLDERS
// ────────────────────────────────────────────────────────────────
export const project_custom_folders = mysqlTable(
  "project_custom_folders",
  {
    id: int("id").primaryKey().autoincrement(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    folder_id: varchar("folder_id", { length: 128 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    icon: varchar("icon", { length: 8 }).default("📁"),
    description: text("description"),
    sort_order: int("sort_order").default(0),
  },
  (table) => ({
    projectIdx: index("idx_project_folders").on(table.project_id),
    uniqueFolder: unique("unique_folder").on(table.project_id, table.folder_id),
  })
);

// ────────────────────────────────────────────────────────────────
// PROJECT FILES (with updated_at for offline sync)
// ────────────────────────────────────────────────────────────────
export const project_files = mysqlTable(
  "project_files",
  {
    id: int("id").primaryKey().autoincrement(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    path: varchar("path", { length: 512 }).notNull(),
    content: text("content", { mode: "string" }),
    deleted_at: datetime("deleted_at"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    projectIdx: index("idx_project_files").on(table.project_id),
    uniqueFile: unique("unique_file").on(table.project_id, table.path),
  })
);

// ────────────────────────────────────────────────────────────────
// FILE METADATA (with updated_at for offline sync)
// ────────────────────────────────────────────────────────────────
export const file_metadata = mysqlTable(
  "file_metadata",
  {
    id: int("id").primaryKey().autoincrement(),
    file_id: int("file_id").notNull(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    file_path: varchar("file_path", { length: 512 }).notNull(),
    category: varchar("category", { length: 64 }),
    status: varchar("status", { length: 32 }).default("draft"),
    metadata_json: json("metadata_json"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    projectIdx: index("idx_project_metadata").on(
      table.project_id,
      table.category,
      table.status
    ),
    statusIdx: index("idx_file_status").on(table.project_id, table.status),
    uniqueMeta: unique("unique_file_metadata").on(
      table.project_id,
      table.file_path
    ),
  })
);

// ────────────────────────────────────────────────────────────────
// STAGING (with updated_at for offline sync)
// ────────────────────────────────────────────────────────────────
export const staging = mysqlTable(
  "staging",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    name: varchar("name", { length: 512 }).notNull(),
    tag: varchar("tag", { length: 32 }).default("IDEA_"),
    status: varchar("status", { length: 32 }).default("in-review"),
    notes: text("notes"),
    folder_path: varchar("folder_path", { length: 512 }),
    filed_at: datetime("filed_at"),
    added: varchar("added", { length: 8 }),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_staging").on(table.user_id, table.status),
    filingIdx: index("idx_filing").on(
      table.project_id,
      table.folder_path,
      table.status
    ),
  })
);

// ────────────────────────────────────────────────────────────────
// IDEAS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const ideas = mysqlTable(
  "ideas",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    title: text("title").notNull(),
    score: int("score").default(5),
    tags: json("tags"),
    added: varchar("added", { length: 8 }),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_ideas").on(table.user_id),
  })
);

// ────────────────────────────────────────────────────────────────
// SESSIONS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    project_id: varchar("project_id", { length: 64 }),
    duration_s: int("duration_s").default(0),
    log: text("log"),
    started_at: datetime("started_at"),
    ended_at: datetime("ended_at"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_sessions").on(table.user_id, table.created_at),
  })
);

// ────────────────────────────────────────────────────────────────
// COMMENTS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const comments = mysqlTable(
  "comments",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    file_path: varchar("file_path", { length: 512 }).notNull(),
    text: text("text").notNull(),
    resolved: tinyint("resolved").default(0),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    commentsIdx: index("idx_comments").on(table.project_id, table.file_path),
  })
);

// ────────────────────────────────────────────────────────────────
// REFRESH TOKENS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const refresh_tokens = mysqlTable(
  "refresh_tokens",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    token_hash: varchar("token_hash", { length: 255 }).notNull(),
    expires_at: datetime("expires_at").notNull(),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    tokenIdx: index("idx_token").on(table.token_hash),
  })
);

// ────────────────────────────────────────────────────────────────
// SCHEMA MIGRATIONS
// ────────────────────────────────────────────────────────────────
export const schema_migrations = mysqlTable("schema_migrations", {
  id: int("id").primaryKey().autoincrement(),
  version: int("version").notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  applied_at: datetime("applied_at").defaultNow(),
});

// ────────────────────────────────────────────────────────────────
// LIFE AREAS
// ────────────────────────────────────────────────────────────────
export const life_areas = mysqlTable(
  "life_areas",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    color: varchar("color", { length: 16 }).default("#3b82f6"),
    icon: varchar("icon", { length: 8 }).default("🌐"),
    description: text("description"),
    target_hours_weekly: int("target_hours_weekly"),
    health_score: int("health_score").default(100),
    sort_order: int("sort_order").default(0),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_areas").on(table.user_id, table.sort_order),
  })
);

// ────────────────────────────────────────────────────────────────
// GOALS
// ────────────────────────────────────────────────────────────────
export const goals = mysqlTable(
  "goals",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    target_amount: int("target_amount").notNull(),
    current_amount: int("current_amount").default(0),
    currency: varchar("currency", { length: 8 }).default("GBP"),
    timeframe: varchar("timeframe", { length: 32 }).default("monthly"),
    category: varchar("category", { length: 32 }).default("income"),
    status: varchar("status", { length: 32 }).default("active"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_goals").on(table.user_id, table.status),
  })
);

// ────────────────────────────────────────────────────────────────
// GOAL CONTRIBUTIONS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const goal_contributions = mysqlTable(
  "goal_contributions",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    goal_id: varchar("goal_id", { length: 36 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    project_id: varchar("project_id", { length: 64 }),
    source_label: varchar("source_label", { length: 255 }),
    amount: int("amount").notNull(),
    date: varchar("date", { length: 10 }),
    notes: text("notes"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    goalIdx: index("idx_goal_contributions").on(table.goal_id, table.date),
  })
);

// ────────────────────────────────────────────────────────────────
// TAGS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const tags = mysqlTable(
  "tags",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    color: varchar("color", { length: 16 }).default("#3b82f6"),
    category: varchar("category", { length: 32 }).default("custom"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_tags").on(table.user_id),
    uniqueTag: unique("unique_user_tag").on(table.user_id, table.name),
  })
);

// ────────────────────────────────────────────────────────────────
// ENTITY TAGS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const entity_tags = mysqlTable(
  "entity_tags",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    tag_id: varchar("tag_id", { length: 36 }).notNull(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    entity_type: varchar("entity_type", { length: 32 }).notNull(),
    entity_id: varchar("entity_id", { length: 64 }).notNull(),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    entityIdx: index("idx_entity_tags").on(
      table.user_id,
      table.entity_type,
      table.entity_id
    ),
    uniqueTag: unique("unique_entity_tag").on(
      table.tag_id,
      table.entity_type,
      table.entity_id
    ),
  })
);

// ────────────────────────────────────────────────────────────────
// ENTITY LINKS (adding updated_at for offline sync - Phase 2.4)
// ────────────────────────────────────────────────────────────────
export const entity_links = mysqlTable(
  "entity_links",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    source_type: varchar("source_type", { length: 32 }).notNull(),
    source_id: varchar("source_id", { length: 64 }).notNull(),
    target_type: varchar("target_type", { length: 32 }).notNull(),
    target_id: varchar("target_id", { length: 64 }).notNull(),
    relationship: varchar("relationship", { length: 32 }).default("related"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    sourceIdx: index("idx_entity_links_source").on(
      table.user_id,
      table.source_type,
      table.source_id
    ),
    targetIdx: index("idx_entity_links_target").on(
      table.user_id,
      table.target_type,
      table.target_id
    ),
    uniqueLink: unique("unique_link").on(
      table.user_id,
      table.source_type,
      table.source_id,
      table.target_type,
      table.target_id
    ),
  })
);

// ────────────────────────────────────────────────────────────────
// TEMPLATES
// ────────────────────────────────────────────────────────────────
export const templates = mysqlTable(
  "templates",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 8 }).default("📄"),
    category: varchar("category", { length: 32 }).default("custom"),
    config: json("config").notNull(),
    is_system: tinyint("is_system").default(0),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userIdx: index("idx_user_templates").on(table.user_id, table.category),
  })
);

// ────────────────────────────────────────────────────────────────
// SYNC STATE (Phase 2.4B - Desktop File Sync)
// Track which projects have desktop folders connected
// ────────────────────────────────────────────────────────────────
export const sync_state = mysqlTable(
  "sync_state",
  {
    id: int("id").primaryKey().autoincrement(),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    project_id: varchar("project_id", { length: 64 }).notNull(),
    folder_handle_key: varchar("folder_handle_key", { length: 255 }),
    last_sync_at: datetime("last_sync_at"),
    sync_status: varchar("sync_status", { length: 32 }).default("idle"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userProjectIdx: unique("unique_user_project_sync").on(
      table.user_id,
      table.project_id
    ),
    syncStatusIdx: index("idx_sync_status").on(table.user_id, table.sync_status),
  })
);

// ────────────────────────────────────────────────────────────────
// SYNC FILE STATE (Phase 2.4B - Desktop File Sync)
// Track file-level sync state: hashes, timestamps, conflict status
// ────────────────────────────────────────────────────────────────
export const sync_file_state = mysqlTable(
  "sync_file_state",
  {
    id: int("id").primaryKey().autoincrement(),
    sync_state_id: int("sync_state_id").notNull(),
    file_path: varchar("file_path", { length: 512 }).notNull(),
    desktop_content_hash: varchar("desktop_content_hash", { length: 64 }),
    cloud_content_hash: varchar("cloud_content_hash", { length: 64 }),
    last_desktop_modified: datetime("last_desktop_modified"),
    last_cloud_modified: datetime("last_cloud_modified"),
    sync_status: varchar("sync_status", { length: 32 }).default("synced"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    syncStateIdx: index("idx_sync_file_status").on(
      table.sync_state_id,
      table.sync_status
    ),
  })
);

// ────────────────────────────────────────────────────────────────
// DAILY CHECKINS (Phase 2.5 - Daily Check-in System)
// Track daily user state for AI task routing
// ────────────────────────────────────────────────────────────────
export const daily_checkins = mysqlTable(
  "daily_checkins",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    sleep_hours: int("sleep_hours"),
    energy_level: int("energy_level"),
    gut_symptoms: int("gut_symptoms"),
    training_done: tinyint("training_done").default(0),
    notes: text("notes"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    uniqueCheckin: unique("unique_user_date").on(table.user_id, table.date),
    userDateIdx: index("idx_user_date").on(table.user_id, table.date),
  })
);

// ────────────────────────────────────────────────────────────────
// TRAINING LOG (Phase 2.6 - Training Session Tracking)
// Log individual training sessions with type, duration, notes
// ────────────────────────────────────────────────────────────────
export const training_logs = mysqlTable(
  "training_logs",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    duration_minutes: int("duration_minutes").notNull(),
    type: varchar("type", { length: 32 }).notNull().default("solo"),
    notes: text("notes"),
    energy_after: int("energy_after"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    userDateIdx: index("idx_training_user_date").on(table.user_id, table.date),
  })
);

// ────────────────────────────────────────────────────────────────
// OUTREACH LOG (Phase 2.7 - Daily Outreach Tracking)
// Log outreach actions for AI coach enforcement + daily indicator
// ────────────────────────────────────────────────────────────────
export const outreach_log = mysqlTable(
  "outreach_log",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    user_id: varchar("user_id", { length: 36 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(),
    type: varchar("type", { length: 32 }).notNull().default("message"),
    target: varchar("target", { length: 255 }),
    project_id: varchar("project_id", { length: 36 }),
    notes: text("notes"),
    created_at: datetime("created_at").defaultNow(),
  },
  (table) => ({
    userDateIdx: index("idx_outreach_user_date").on(table.user_id, table.date),
  })
);

export const weekly_reviews = mysqlTable("weekly_reviews", {
  id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
  user_id: varchar("user_id", { length: 36 }).notNull(),
  week_start: varchar("week_start", { length: 10 }).notNull(),
  data_json: text("data_json"),
  what_shipped: text("what_shipped"),
  what_blocked: text("what_blocked"),
  next_priority: text("next_priority"),
  ai_analysis: text("ai_analysis"),
  created_at: datetime("created_at").defaultNow(),
  updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
},
(table) => ({
  userWeekIdx: index("idx_weekly_reviews_user_week").on(table.user_id, table.week_start),
}));

// ────────────────────────────────────────────────────────────────
// REL FOUNDATION (Phase 0 - v2.2)
// Relational Entity Graph tables
// ────────────────────────────────────────────────────────────────

export const rel_entities = mysqlTable(
  "rel_entities",
  {
    uri: varchar("uri", { length: 512 }).primaryKey(),
    type: varchar("type", { length: 50 }).notNull(), // file, task, asset, workflow, agent, worker, email, competition
    status: varchar("status", { length: 20 }).default("pending"), // pending, active, complete, failed, orphaned
    checksum: varchar("checksum", { length: 64 }),
    metadata: json("metadata"),
    scope: varchar("scope", { length: 20 }).default("project"), // global, project, user, session
    memory_type: varchar("memory_type", { length: 20 }), // policy, preference, fact, episodic, trace
    project_id: varchar("project_id", { length: 64 }),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    typeIdx: index("idx_rel_entity_type").on(table.type, table.status),
    scopeIdx: index("idx_rel_entity_scope").on(table.scope, table.type),
    projectIdx: index("idx_rel_entity_project").on(table.project_id),
  })
);

export const worker_capabilities = mysqlTable(
  "worker_capabilities",
  {
    worker_id: varchar("worker_id", { length: 36 }).primaryKey(),
    type: varchar("type", { length: 20 }).notNull(), // cli_subprocess, websocket, mcp
    capabilities: json("capabilities").notNull(),
    status: varchar("status", { length: 20 }).default("offline"), // online, offline, degraded
    last_seen: datetime("last_seen"),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  }
);

export const execution_log = mysqlTable(
  "execution_log",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    run_id: varchar("run_id", { length: 36 }).unique(),
    parent_run_id: varchar("parent_run_id", { length: 36 }),
    workflow_id: varchar("workflow_id", { length: 255 }),
    worker_id: varchar("worker_id", { length: 36 }),
    provider: varchar("provider", { length: 100 }),
    cost_usd: decimal("cost_usd", { precision: 10, scale: 6 }),
    tokens_used: int("tokens_used"),
    duration_ms: int("duration_ms"),
    quality_score: decimal("quality_score", { precision: 3, scale: 2 }),
    status: varchar("status", { length: 20 }),
    created_at: datetime("created_at").defaultNow(),
  },
  (table) => ({
    runIdx: index("idx_execution_run").on(table.run_id),
    workflowIdx: index("idx_execution_workflow").on(table.workflow_id),
  })
);

export const workflow_trust = mysqlTable(
  "workflow_trust",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    workflow_id: varchar("workflow_id", { length: 255 }).unique(),
    project_id: varchar("project_id", { length: 64 }),
    current_tier: int("current_tier").default(1),
    run_count: int("run_count").default(0),
    approval_count: int("approval_count").default(0),
    consecutive_approvals: int("consecutive_approvals").default(0),
    last_regression_at: datetime("last_regression_at"),
    promoted_to_tier2_at: datetime("promoted_to_tier2_at"),
    promoted_to_tier3_at: datetime("promoted_to_tier3_at"),
    tier_locked: tinyint("tier_locked").default(0),
    created_at: datetime("created_at").defaultNow(),
    updated_at: datetime("updated_at").defaultNow().onUpdateNow(),
  },
  (table) => ({
    workflowIdx: index("idx_workflow_trust_workflow").on(table.workflow_id),
    projectIdx: index("idx_workflow_trust_project").on(table.project_id),
  })
);

export const trust_events = mysqlTable(
  "trust_events",
  {
    id: varchar("id", { length: 36 }).primaryKey().default("(UUID())"),
    workflow_id: varchar("workflow_id", { length: 255 }),
    run_id: varchar("run_id", { length: 36 }),
    gate_name: varchar("gate_name", { length: 255 }),
    decision: varchar("decision", { length: 20 }), // approved, rejected, modified
    notes: text("notes"),
    decided_by: varchar("decided_by", { length: 255 }),
    decided_at: datetime("decided_at").defaultNow(),
  },
  (table) => ({
    workflowIdx: index("idx_trust_events_workflow").on(table.workflow_id),
    runIdx: index("idx_trust_events_run").on(table.run_id),
  })
);
