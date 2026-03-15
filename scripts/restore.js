#!/usr/bin/env node
// scripts/restore.js — Restore data from backup JSON file
// Usage: node scripts/restore.js <backup-file.json> [--dry-run] [--target-user-id=<id>]
// Environment: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse command line arguments
const args = process.argv.slice(2);
const backupFile = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const targetUserIdArg = args.find(arg => arg.startsWith('--target-user-id='));
const targetUserId = targetUserIdArg ? targetUserIdArg.split('=')[1] : null;
const skipConfirm = args.includes('--yes');

function getDb() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'the_brain',
    ssl: { rejectUnauthorized: true },
  };
  return mysql.createConnection(config);
}

// Tables in order for restoration (parents before children, respecting FK constraints)
const RESTORE_ORDER = [
  'users',
  'life_areas',
  'projects',
  'project_custom_folders',
  'project_files',
  'file_metadata',
  'staging',
  'ideas',
  'sessions',
  'comments',
  'goals',
  'goal_contributions',
  'tags',
  'entity_tags',
  'entity_links',
  'templates',
  'daily_checkins',
  'training_logs',
  'outreach_log',
  'weekly_reviews',
  'sync_state',
  'sync_file_state',
  'project_integrations',
  'notifications',
  'ai_usage',
];

// Tables that can use INSERT ... ON DUPLICATE KEY UPDATE (have unique keys on id)
const UPSERTABLE_TABLES = [
  'users', 'life_areas', 'projects', 'project_custom_folders', 'project_files',
  'file_metadata', 'staging', 'ideas', 'sessions', 'comments', 'goals',
  'goal_contributions', 'tags', 'entity_tags', 'entity_links', 'templates',
  'daily_checkins', 'training_logs', 'outreach_log', 'weekly_reviews',
  'sync_state', 'sync_file_state', 'project_integrations', 'notifications',
  'ai_usage', 'refresh_tokens', 'schema_migrations'
];

function validateBackupStructure(backup) {
  const errors = [];
  
  if (!backup) {
    return ['Backup file is empty or invalid JSON'];
  }
  
  if (!backup.version) {
    errors.push('Missing backup version');
  }
  
  if (!backup.exported_at) {
    errors.push('Missing exported_at timestamp');
  }
  
  if (!backup.data && !backup.all_users) {
    errors.push('Missing data object');
  }
  
  if (!backup.all_users && !backup.user) {
    errors.push('Missing user object (use --all-users backup for multi-user restore)');
  }
  
  return errors;
}

async function tableExists(db, tableName) {
  const [rows] = await db.execute(
    `SELECT 1 FROM information_schema.tables 
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function getTableColumns(db, tableName) {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
     FROM information_schema.columns 
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return rows;
}

function buildUpsertQuery(tableName, columns, row) {
  // Filter columns that exist in the row
  const validColumns = columns.filter(col => row.hasOwnProperty(col.COLUMN_NAME));
  const colNames = validColumns.map(col => `\`${col.COLUMN_NAME}\``);
  const placeholders = validColumns.map(() => '?');
  
  // Build UPDATE part (exclude id and auto-increment columns)
  const updateCols = validColumns
    .filter(col => col.COLUMN_NAME !== 'id' && !col.EXTRA.includes('auto_increment'))
    .map(col => `\`${col.COLUMN_NAME}\` = VALUES(\`${col.COLUMN_NAME}\`)`);
  
  if (updateCols.length === 0) {
    // No updatable columns, use simple INSERT IGNORE
    return {
      sql: `INSERT IGNORE INTO \`${tableName}\` (${colNames.join(', ')}) VALUES (${placeholders.join(', ')})`,
      values: validColumns.map(col => row[col.COLUMN_NAME])
    };
  }
  
  return {
    sql: `INSERT INTO \`${tableName}\` (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) 
          ON DUPLICATE KEY UPDATE ${updateCols.join(', ')}`,
    values: validColumns.map(col => row[col.COLUMN_NAME])
  };
}

async function restoreTable(db, tableName, rows, dryRun = false) {
  if (!rows || rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0 };
  }
  
  const exists = await tableExists(db, tableName);
  if (!exists) {
    console.log(`    ⚠️  Table '${tableName}' does not exist, skipping ${rows.length} records`);
    return { inserted: 0, updated: 0, skipped: rows.length };
  }
  
  const columns = await getTableColumns(db, tableName);
  const columnNames = new Set(columns.map(c => c.COLUMN_NAME));
  
  let inserted = 0;
  let updated = 0;
  let errors = 0;
  
  for (const row of rows) {
    try {
      // Filter row to only include columns that exist in the table
      const filteredRow = {};
      for (const [key, value] of Object.entries(row)) {
        if (columnNames.has(key)) {
          filteredRow[key] = value;
        }
      }
      
      if (dryRun) {
        inserted++;
        continue;
      }
      
      const { sql, values } = buildUpsertQuery(tableName, columns, filteredRow);
      
      const [result] = await db.execute(sql, values);
      
      if (result.affectedRows === 1 && result.insertId) {
        inserted++;
      } else if (result.affectedRows === 2) {
        // MySQL: 1 for insert attempt, 1 for update = 2 means updated
        updated++;
      } else if (result.affectedRows === 1) {
        // Could be insert or update depending on MySQL version
        updated++;
      } else if (result.affectedRows === 0) {
        // Row already exists with same values
        updated++;
      }
    } catch (error) {
      errors++;
      if (errors <= 3) {
        console.error(`    ❌ Error restoring ${tableName} record:`, error.message);
      }
      if (errors === 4) {
        console.error(`    ... (suppressing further errors for this table)`);
      }
    }
  }
  
  return { inserted, updated, skipped: 0, errors };
}

async function confirmRestore(backup) {
  if (skipConfirm) return true;
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    const targetInfo = backup.all_users 
      ? `ALL ${backup.users?.length || 'unknown'} users` 
      : `user: ${backup.user?.email || backup.user?.id}`;
    
    rl.question(`\n⚠️  Are you sure you want to restore ${targetInfo}? (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function remapUserIds(rows, oldUserId, newUserId) {
  if (!newUserId || !rows || rows.length === 0) return rows;
  
  return rows.map(row => {
    if (row.user_id === oldUserId) {
      return { ...row, user_id: newUserId };
    }
    return row;
  });
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧠 The Brain — Database Restore Tool');
  console.log('═══════════════════════════════════════════════════════');

  // Validate arguments
  if (!backupFile) {
    console.error('❌ Error: Backup file path required');
    console.error('   Usage: node scripts/restore.js <backup-file.json>');
    console.error('   Options:');
    console.error('     --dry-run              Preview changes without applying');
    console.error('     --target-user-id=<id>  Restore to a different user ID');
    console.error('     --yes                  Skip confirmation prompt');
    process.exit(1);
  }

  // Validate environment
  if (!process.env.DB_HOST || !process.env.DB_USER) {
    console.error('❌ Error: DB_HOST and DB_USER environment variables required');
    process.exit(1);
  }

  // Load backup file
  const backupPath = path.resolve(backupFile);
  if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`📁 Loading backup: ${backupPath}`);
  
  let backup;
  try {
    const content = fs.readFileSync(backupPath, 'utf-8');
    backup = JSON.parse(content);
  } catch (error) {
    console.error('❌ Error parsing backup file:', error.message);
    process.exit(1);
  }

  // Validate structure
  const validationErrors = validateBackupStructure(backup);
  if (validationErrors.length > 0) {
    console.error('❌ Invalid backup file:');
    validationErrors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }

  console.log('✅ Backup file validated');
  console.log(`   Version: ${backup.version}`);
  console.log(`   Exported: ${backup.exported_at}`);
  
  if (backup.all_users) {
    console.log(`   Type: Multi-user backup (${backup.users?.length || '?'} users)`);
  } else {
    console.log(`   User: ${backup.user?.email || backup.user?.id}`);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN MODE — No changes will be made');
  }
  
  if (targetUserId) {
    console.log(`   Target user ID override: ${targetUserId}`);
  }

  // Confirm restore
  if (!await confirmRestore(backup)) {
    console.log('\n❌ Restore cancelled');
    process.exit(0);
  }

  let db;
  try {
    db = await getDb();
    console.log('\n✅ Connected to database');

    // Begin transaction
    if (!dryRun) {
      await db.beginTransaction();
    }

    const stats = {
      tables: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // Determine source user ID for remapping
    const sourceUserId = backup.user?.id;

    // Restore tables in order
    for (const tableName of RESTORE_ORDER) {
      let rows = backup.data?.[tableName] || [];
      
      if (rows.length === 0) continue;
      
      // Remap user IDs if target specified
      if (targetUserId && sourceUserId && tableName !== 'users') {
        rows = await remapUserIds(rows, sourceUserId, targetUserId);
      }
      
      process.stdout.write(`  📋 ${tableName}... `);
      
      const result = await restoreTable(db, tableName, rows, dryRun);
      
      stats.tables++;
      stats.inserted += result.inserted;
      stats.updated += result.updated;
      stats.skipped += result.skipped;
      stats.errors += result.errors || 0;
      
      const parts = [];
      if (result.inserted) parts.push(`${result.inserted} inserted`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.skipped) parts.push(`${result.skipped} skipped`);
      if (result.errors) parts.push(`${result.errors} errors`);
      
      console.log(parts.join(', ') || '0 records');
    }

    // Commit transaction
    if (!dryRun) {
      await db.commit();
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log(dryRun ? '🔍 Dry run complete!' : '✅ Restore complete!');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📊 Summary:`);
    console.log(`   Tables processed: ${stats.tables}`);
    console.log(`   Records inserted: ${stats.inserted}`);
    console.log(`   Records updated: ${stats.updated}`);
    if (stats.skipped) console.log(`   Records skipped: ${stats.skipped}`);
    if (stats.errors) console.log(`   Errors: ${stats.errors}`);
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ Restore failed:', error.message);
    if (db && !dryRun) {
      try {
        await db.rollback();
        console.log('🔄 Transaction rolled back');
      } catch (rollbackError) {
        console.error('❌ Rollback failed:', rollbackError.message);
      }
    }
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
}

main();
