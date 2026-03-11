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
