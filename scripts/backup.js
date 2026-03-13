#!/usr/bin/env node
/**
 * Backup Script for The Brain
 * 
 * Exports all user data to local JSON files.
 * Run manually or schedule via cron.
 * 
 * Usage:
 *   npm run backup              # Backup all users
 *   npm run backup -- --user=USER_ID  # Backup specific user
 *   npm run backup -- --output=./my-backups  # Custom output directory
 * 
 * Output: ./backups/YYYY-MM-DD/brain-backup-TIMESTAMP.json
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// ── CONFIG ─────────────────────────────────────────────────────
const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'the_brain',
  ssl: { rejectUnauthorized: true },
};

// ── CLI ARGS ───────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--user=')) acc.userId = arg.split('=')[1];
  if (arg.startsWith('--output=')) acc.outputDir = arg.split('=')[1];
  if (arg === '--compress') acc.compress = true;
  return acc;
}, { outputDir: join(__dirname, '..', 'backups') });

// ── BACKUP FUNCTION ────────────────────────────────────────────
async function backup(connection, userId = null) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dateDir = new Date().toISOString().split('T')[0];
  const outputDir = join(args.outputDir, dateDir);
  
  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  
  console.log(`📦 Starting backup at ${new Date().toISOString()}`);
  console.log(`   Output: ${outputDir}`);
  
  const backupData = {
    metadata: {
      version: '1.0',
      exported_at: new Date().toISOString(),
      database: config.database,
      host: config.host,
    },
    users: [],
    summary: {
      total_users: 0,
      total_projects: 0,
      total_files: 0,
      total_sessions: 0,
    }
  };
  
  // Get users to backup
  let userQuery = 'SELECT id, email, name, monthly_target, currency, goal, timezone, settings, created_at FROM users';
  const queryParams = [];
  if (userId) {
    userQuery += ' WHERE id = ?';
    queryParams.push(userId);
  }
  
  const [users] = await connection.query(userQuery, queryParams);
  console.log(`   Found ${users.length} user(s) to backup`);
  
  for (const user of users) {
    console.log(`\n   👤 Backing up user: ${user.email}`);
    
    const userData = {
      ...user,
      projects: [],
      life_areas: [],
      goals: [],
      daily_checkins: [],
      training_logs: [],
      outreach_log: [],
      weekly_reviews: [],
      tags: [],
      entity_tags: [],
      entity_links: [],
      notifications: [],
      templates: [],
    };
    
    // Life Areas
    const [lifeAreas] = await connection.query(
      'SELECT * FROM life_areas WHERE user_id = ?',
      [user.id]
    );
    userData.life_areas = lifeAreas;
    console.log(`      📁 Life Areas: ${lifeAreas.length}`);
    
    // Goals
    const [goals] = await connection.query(
      'SELECT * FROM goals WHERE user_id = ?',
      [user.id]
    );
    userData.goals = goals;
    
    // Goal contributions
    for (const goal of goals) {
      const [contributions] = await connection.query(
        'SELECT * FROM goal_contributions WHERE goal_id = ?',
        [goal.id]
      );
      goal.contributions = contributions;
    }
    console.log(`      🎯 Goals: ${goals.length}`);
    
    // Projects
    const [projects] = await connection.query(
      'SELECT * FROM projects WHERE user_id = ?',
      [user.id]
    );
    console.log(`      📂 Projects: ${projects.length}`);
    
    for (const project of projects) {
      const projectData = { ...project };
      
      // Project files
      const [files] = await connection.query(
        'SELECT * FROM project_files WHERE project_id = ? AND deleted_at IS NULL',
        [project.id]
      );
      projectData.files = files;
      
      // Custom folders
      const [folders] = await connection.query(
        'SELECT * FROM project_custom_folders WHERE project_id = ?',
        [project.id]
      );
      projectData.custom_folders = folders;
      
      // Comments
      const [comments] = await connection.query(
        'SELECT * FROM comments WHERE project_id = ?',
        [project.id]
      );
      projectData.comments = comments;
      
      // File metadata
      const [metadata] = await connection.query(
        'SELECT * FROM file_metadata WHERE project_id = ?',
        [project.id]
      );
      projectData.file_metadata = metadata;
      
      // Integrations
      const [integrations] = await connection.query(
        'SELECT * FROM project_integrations WHERE project_id = ?',
        [project.id]
      );
      projectData.integrations = integrations;
      
      // Sync state
      const [syncState] = await connection.query(
        'SELECT * FROM sync_state WHERE project_id = ?',
        [project.id]
      );
      projectData.sync_state = syncState;
      
      const [syncFileState] = await connection.query(
        'SELECT * FROM sync_file_state WHERE project_id = ?',
        [project.id]
      );
      projectData.sync_file_state = syncFileState;
      
      // Staging items
      const [staging] = await connection.query(
        'SELECT * FROM staging WHERE project_id = ?',
        [project.id]
      );
      projectData.staging = staging;
      
      // Sessions for this project
      const [sessions] = await connection.query(
        'SELECT * FROM sessions WHERE project_id = ?',
        [project.id]
      );
      projectData.sessions = sessions;
      
      userData.projects.push(projectData);
    }
    
    // Global sessions (those without project_id)
    const [globalSessions] = await connection.query(
      'SELECT * FROM sessions WHERE user_id = ? AND project_id IS NULL',
      [user.id]
    );
    userData.global_sessions = globalSessions;
    console.log(`      ⏱️  Sessions: ${userData.projects.reduce((acc, p) => acc + p.sessions.length, 0) + globalSessions.length}`);
    
    // Ideas
    const [ideas] = await connection.query(
      'SELECT * FROM ideas WHERE user_id = ?',
      [user.id]
    );
    userData.ideas = ideas;
    console.log(`      💡 Ideas: ${ideas.length}`);
    
    // Daily check-ins
    const [checkins] = await connection.query(
      'SELECT * FROM daily_checkins WHERE user_id = ?',
      [user.id]
    );
    userData.daily_checkins = checkins;
    console.log(`      🌅 Check-ins: ${checkins.length}`);
    
    // Training logs
    const [training] = await connection.query(
      'SELECT * FROM training_logs WHERE user_id = ?',
      [user.id]
    );
    userData.training_logs = training;
    console.log(`      🥋 Training logs: ${training.length}`);
    
    // Outreach log
    const [outreach] = await connection.query(
      'SELECT * FROM outreach_log WHERE user_id = ?',
      [user.id]
    );
    userData.outreach_log = outreach;
    console.log(`      📣 Outreach: ${outreach.length}`);
    
    // Weekly reviews
    const [reviews] = await connection.query(
      'SELECT * FROM weekly_reviews WHERE user_id = ?',
      [user.id]
    );
    userData.weekly_reviews = reviews;
    console.log(`      📊 Weekly reviews: ${reviews.length}`);
    
    // Tags
    const [tags] = await connection.query(
      'SELECT * FROM tags WHERE user_id = ?',
      [user.id]
    );
    userData.tags = tags;
    
    // Entity tags
    const [entityTags] = await connection.query(
      'SELECT * FROM entity_tags WHERE user_id = ?',
      [user.id]
    );
    userData.entity_tags = entityTags;
    console.log(`      🏷️  Tags: ${tags.length} (on ${entityTags.length} entities)`);
    
    // Entity links
    const [links] = await connection.query(
      'SELECT * FROM entity_links WHERE user_id = ?',
      [user.id]
    );
    userData.entity_links = links;
    console.log(`      🔗 Links: ${links.length}`);
    
    // Notifications
    const [notifications] = await connection.query(
      'SELECT * FROM notifications WHERE user_id = ?',
      [user.id]
    );
    userData.notifications = notifications;
    
    // User templates
    const [templates] = await connection.query(
      'SELECT * FROM templates WHERE user_id = ? OR is_system = 1',
      [user.id]
    );
    userData.templates = templates;
    
    // AI usage stats
    const [aiUsage] = await connection.query(
      'SELECT * FROM ai_usage WHERE user_id = ? ORDER BY date DESC LIMIT 30',
      [user.id]
    );
    userData.ai_usage = aiUsage;
    
    backupData.users.push(userData);
    backupData.summary.total_users++;
    backupData.summary.total_projects += userData.projects.length;
    backupData.summary.total_files += userData.projects.reduce((acc, p) => acc + p.files.length, 0);
    backupData.summary.total_sessions += userData.projects.reduce((acc, p) => acc + p.sessions.length, 0) + globalSessions.length;
  }
  
  // Write backup file
  const filename = userId 
    ? `brain-backup-user-${userId.substring(0, 8)}-${timestamp}.json`
    : `brain-backup-full-${timestamp}.json`;
  const filepath = join(outputDir, filename);
  
  const jsonData = JSON.stringify(backupData, null, args.compress ? undefined : 2);
  await fs.writeFile(filepath, jsonData);
  
  // Write summary file
  const summaryPath = join(outputDir, `backup-summary-${timestamp}.txt`);
  const summaryText = `
THE BRAIN BACKUP SUMMARY
========================
Timestamp: ${new Date().toISOString()}
File: ${filename}
Size: ${(jsonData.length / 1024 / 1024).toFixed(2)} MB

SUMMARY
-------
Total Users: ${backupData.summary.total_users}
Total Projects: ${backupData.summary.total_projects}
Total Files: ${backupData.summary.total_files}
Total Sessions: ${backupData.summary.total_sessions}

TABLES BACKED UP
----------------
- users, life_areas, goals, goal_contributions
- projects, project_files, project_custom_folders, comments, file_metadata
- project_integrations, sync_state, sync_file_state
- sessions, ideas, staging
- daily_checkins, training_logs, outreach_log, weekly_reviews
- tags, entity_tags, entity_links, notifications, templates
- ai_usage

RESTORE INSTRUCTIONS
--------------------
To restore a user from this backup:
1. Ensure database schema is at correct version (run migrations)
2. Import user record first (check for existing email conflict)
3. Import related records in dependency order:
   - life_areas → goals → goal_contributions
   - projects → files/folders/comments/metadata/integrations/sync
   - global tables: ideas, tags, checkins, training, outreach, reviews

Or use: npm run restore -- --file=${filename} --user=USER_ID
`;
  await fs.writeFile(summaryPath, summaryText);
  
  console.log(`\n✅ Backup complete!`);
  console.log(`   File: ${filepath}`);
  console.log(`   Size: ${(jsonData.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Summary: ${summaryPath}`);
  
  return { filepath, size: jsonData.length };
}

// ── MAIN ───────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     THE BRAIN — Backup Tool                              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  let connection;
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');
    
    const result = await backup(connection, args.userId);
    
    console.log('\n💡 Tip: Schedule this with cron for daily backups:');
    console.log('   0 2 * * * cd /path/to/the-brain && npm run backup >> logs/backup.log 2>&1');
    
    process.exit(0);
  } catch (e) {
    console.error('\n❌ Backup failed:', e.message);
    console.error(e.stack);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
