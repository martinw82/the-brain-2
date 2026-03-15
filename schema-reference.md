# THE BRAIN — Schema Reference

**Purpose:** Pre-designed schema for Phase 1 and Phase 2 features. This is reference material, not an action plan.

**Note:** Some designs were modified during implementation (e.g., `parts` became `life_areas`, many-to-many was simplified to FK). See `scripts/migrate.js` for actual applied schema.

**Companion to:** BRAIN_ROADMAP.md (build order), BRAIN_STATUS.md (project context), AGENT_BRIEF.md (operating rules)

---

## Phase 1.0 — Life Areas ("Parts")

### Design Decision: Many-to-Many
Projects belong to multiple Parts (e.g., "The Brain" is both Business and Creative). Use a junction table, not a simple FK.

### Tables

```sql
-- Core Parts table (Life Areas)
CREATE TABLE parts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    slug VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6',
    icon VARCHAR(50),
    description TEXT,
    target_hours_weekly INT DEFAULT 10,
    health_score INT DEFAULT 100,
    health_decay_rate DECIMAL(3,2) DEFAULT 0.05,
    agent_config JSON,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_part (user_id, slug)
);

-- Junction: Projects <-> Parts
CREATE TABLE project_parts (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id VARCHAR(64) NOT NULL,
    part_id VARCHAR(36) NOT NULL,
    contribution_weight INT DEFAULT 100,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
    UNIQUE KEY unique_project_part (project_id, part_id)
);
```

### Default Parts (seeded on user creation)

| Slug | Name | Color | Icon |
|------|------|-------|------|
| business | Business / Revenue | #3b82f6 | 💼 |
| health | Health / Body | #10b981 | 🏋️ |
| relationships | Relationships | #ec4899 | ❤️ |
| creative | Creative / Learning | #8b5cf6 | 🎨 |
| personal | Personal / Admin | #f59e0b | 🏠 |

### Migration for existing data
```sql
-- Create a "General" part for the existing user
INSERT INTO parts (user_id, slug, name, color, icon, sort_order)
SELECT id, 'general', 'General', '#64748b', '📁', 0 FROM users;

-- Link all existing projects to "General"
INSERT INTO project_parts (project_id, part_id, is_primary)
SELECT p.id, pa.id, TRUE
FROM projects p
JOIN parts pa ON p.user_id = pa.user_id AND pa.slug = 'general';
```

### Agent config per Part
```json
{
  "business": {"revenue_first": true, "complexity_cap": null, "minimum_outreach": 2},
  "health": {"revenue_first": false, "consistency_rule": true, "minimum_sessions": 3},
  "creative": {"revenue_first": false, "exploration_allowed": true},
  "relationships": {"complexity_cap": 3, "boundary_check_weekly": true},
  "personal": {"admin_only": true, "defer_to_other_parts": true}
}
```

### AI prompt injection
```
PART HEALTH SNAPSHOT:
- Business: 85/100 (5 projects, revenue_first: true)
- Health: 40/100 (2 projects, CRITICAL: declining 3 days)
- Relationships: 90/100 (1 project)

RULE: When any Part health < 50, suggest stabilizing tasks before new initiatives.
```

---

## Phase 1.1 — Goals

_Schema already defined in BRAIN_ROADMAP.md. No additional reference needed._

---

## Phase 1.2 — Templates

_Schema already defined in BRAIN_ROADMAP.md. Validate template config JSON with Zod before save._

---

## Phase 1.3 — Tags & Links

_Schema already defined in BRAIN_ROADMAP.md. No additional reference needed._

---

## Phase 2.5 — Daily Check-ins

### Extension for Part-level energy tracking
```sql
ALTER TABLE daily_checkins ADD COLUMN part_energy JSON;
-- Example value: {"business": 8, "health": 4, "creative": 6}
-- Optional: only used when user wants granular per-area tracking
```

---

## Phase 2.8 — AI Context Compression

### Tables

```sql
-- Rolling AI summaries per project
CREATE TABLE project_summaries (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    project_id VARCHAR(64) NOT NULL,
    summary_text TEXT NOT NULL,
    key_decisions JSON,
    next_actions_suggested JSON,
    token_count INT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project_latest (project_id, generated_at)
);

-- AI conversation history (short-term memory)
CREATE TABLE ai_conversations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(50),
    role ENUM('user', 'assistant', 'system') NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    context_snapshot JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_session (user_id, session_id, created_at)
);

-- Token usage tracking (cost control)
CREATE TABLE ai_usage (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    date DATE NOT NULL,
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    estimated_cost_usd DECIMAL(6,4),
    model VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_date (user_id, date)
);
```

### Context Builder Algorithm

Priority-ranked retrieval with token budgeting:

```
Token budget: 8,000 max (leaves room for response)

1. User profile + active goal + enforcement rules  (~500 tokens)  [ALWAYS]
2. Today's check-in + state routing                 (~300 tokens)  [ALWAYS]
3. Part health snapshot                             (~500 tokens)  [ALWAYS]
4. Current project summary (if in a project)        (~800 tokens)  [IF RELEVANT]
5. Recent devlog entries (last 5 for current proj)  (~600 tokens)  [IF RELEVANT]
6. Current active file content                      (~1000 tokens) [IF RELEVANT]
7. Other project summaries (brief, 1 line each)     (~500 tokens)  [IF ROOM]
8. Recent session logs                              (~300 tokens)  [IF ROOM]

Stop adding context when approaching 80% of budget.
```

### Context types
- **Brief** (command centre "what should I do?"): items 1-3 + all project summaries (1 line each)
- **Focused** (inside a project hub): items 1-6 for current project only
- **Full** (weekly review): items 1-8, all projects

### Summary generation trigger
Regenerate project summary when:
- Any file in the project is saved (debounced — max once per hour)
- Project health score changes by > 10 points
- Manually triggered from Meta tab
- Nightly cron for all active projects

---

## Phase 3 — File Embeddings (Future)

### Table
```sql
CREATE TABLE file_embeddings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    file_id INT NOT NULL,
    embedding_json JSON NOT NULL,
    content_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES project_files(id) ON DELETE CASCADE,
    UNIQUE KEY unique_file_embedding (file_id)
);
```

### Notes
- Use all-MiniLM-L6-v2 (384 dimensions) — small, fast, good enough
- Can run in Vercel function via transformers.js or call OpenAI embeddings API
- Cosine similarity calculated in application code (TiDB has no native vector support)
- Only implement when full-text search proves insufficient for finding relevant context
- Alternative: skip embeddings entirely and use the AI itself to rank file relevance from titles/paths

---

## Schema Migration Tracking

```sql
CREATE TABLE schema_migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Every schema change gets a migration file in `/scripts/migrations/` named like:
```
001_add_soft_deletes.sql
002_create_parts_table.sql
003_create_goals_table.sql
...
```

Run with: `npm run db:migrate` (checks which haven't been executed yet, runs them in order).

---

*THE BRAIN · Schema Reference · v1*
