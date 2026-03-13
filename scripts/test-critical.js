#!/usr/bin/env node
/**
 * Critical Path Tests for The Brain
 * 
 * These tests verify the 3 paths where data loss would destroy trust:
 * 1. File save/load round-trip
 * 2. Comment persistence
 * 3. Session logging
 * 
 * Run with: npm run test:critical
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

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

const TEST_USER_EMAIL = `test-${Date.now()}@critical.test`;
const TEST_PROJECT_ID = `test-project-${Date.now()}`;
const TEST_FILE_PATH = 'test/CRITICAL_TEST.md';
const TEST_CONTENT = `# Critical Test File

Generated: ${new Date().toISOString()}
Content: ${Math.random().toString(36).substring(7)}

This file tests the save/load round-trip. If you can read this, file persistence works.
`;

// ── HELPERS ────────────────────────────────────────────────────
let connection;
let testUserId;
let testsPassed = 0;
let testsFailed = 0;

async function setup() {
  connection = await mysql.createConnection(config);
  console.log('✅ Connected to database\n');
}

async function teardown() {
  if (connection) {
    // Cleanup test data
    if (testUserId) {
      await connection.query('DELETE FROM sessions WHERE user_id = ?', [testUserId]);
      await connection.query('DELETE FROM comments WHERE user_id = ?', [testUserId]);
      await connection.query('DELETE FROM project_files WHERE project_id = ?', [TEST_PROJECT_ID]);
      await connection.query('DELETE FROM projects WHERE id = ?', [TEST_PROJECT_ID]);
      await connection.query('DELETE FROM users WHERE id = ?', [testUserId]);
    }
    await connection.end();
  }
  console.log('\n📊 Test Results:');
  console.log(`   Passed: ${testsPassed}`);
  console.log(`   Failed: ${testsFailed}`);
  console.log(`   Total:  ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n✅ ALL CRITICAL PATHS PASS — Data integrity is safe.');
    process.exit(0);
  } else {
    console.log('\n❌ SOME TESTS FAILED — Do not deploy until fixed.');
    process.exit(1);
  }
}

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`   ❌ ${message}`);
    testsFailed++;
  }
}

// ── TEST 1: File Save/Load Round-Trip ──────────────────────────
async function testFileRoundTrip() {
  console.log('📝 TEST 1: File Save/Load Round-Trip');
  console.log('─────────────────────────────────────');
  
  try {
    // Create test user
    await connection.query(
      'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (UUID(), ?, "test", "Critical Test", NOW())',
      [TEST_USER_EMAIL]
    );
    const [userRows] = await connection.query('SELECT id FROM users WHERE email = ?', [TEST_USER_EMAIL]);
    testUserId = userRows[0].id;
    console.log(`   Created test user: ${testUserId.substring(0, 8)}...`);
    
    // Create test project
    await connection.query(
      `INSERT INTO projects (id, user_id, name, phase, priority, health, created_at, updated_at) 
       VALUES (?, ?, "Critical Test Project", "active", 1, 100, NOW(), NOW())`,
      [TEST_PROJECT_ID, testUserId]
    );
    console.log(`   Created test project: ${TEST_PROJECT_ID.substring(0, 20)}...`);
    
    // Save file
    await connection.query(
      `INSERT INTO project_files (project_id, file_path, content, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()`,
      [TEST_PROJECT_ID, TEST_FILE_PATH, TEST_CONTENT]
    );
    console.log(`   Saved test file: ${TEST_FILE_PATH}`);
    
    // Simulate "reload" — query fresh from DB
    const [rows] = await connection.query(
      'SELECT content FROM project_files WHERE project_id = ? AND file_path = ? AND deleted_at IS NULL',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    
    assert(rows.length === 1, 'File exists in database after save');
    assert(rows[0].content === TEST_CONTENT, 'File content matches exactly after round-trip');
    assert(rows[0].content.includes('Critical Test File'), 'Content includes expected header');
    
    // Test soft delete
    await connection.query(
      'UPDATE project_files SET deleted_at = NOW() WHERE project_id = ? AND file_path = ?',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    const [deletedRows] = await connection.query(
      'SELECT content FROM project_files WHERE project_id = ? AND file_path = ? AND deleted_at IS NULL',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    assert(deletedRows.length === 0, 'Soft-deleted file is excluded from active queries');
    
    // Restore file (undo delete)
    await connection.query(
      'UPDATE project_files SET deleted_at = NULL WHERE project_id = ? AND file_path = ?',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    const [restoredRows] = await connection.query(
      'SELECT content FROM project_files WHERE project_id = ? AND file_path = ? AND deleted_at IS NULL',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    assert(restoredRows.length === 1, 'Restored file reappears in queries');
    assert(restoredRows[0].content === TEST_CONTENT, 'Restored file content intact');
    
    console.log('');
  } catch (e) {
    console.log(`   ❌ Test 1 failed with error: ${e.message}`);
    testsFailed += 5; // All assertions in this test
  }
}

// ── TEST 2: Comment Persistence ────────────────────────────────
async function testCommentPersistence() {
  console.log('💬 TEST 2: Comment Persistence');
  console.log('─────────────────────────────────────');
  
  try {
    const testComment = {
      id: `test-comment-${Date.now()}`,
      text: 'This is a test comment for persistence verification.',
      author: 'Test User',
      date: new Date().toISOString(),
      resolved: false
    };
    
    // Save comment
    await connection.query(
      `INSERT INTO comments (id, project_id, file_path, user_id, text, author, created_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [testComment.id, TEST_PROJECT_ID, TEST_FILE_PATH, testUserId, 
       testComment.text, testComment.author, testComment.resolved ? 1 : 0]
    );
    console.log(`   Saved test comment: ${testComment.id.substring(0, 20)}...`);
    
    // Query comments for file
    const [rows] = await connection.query(
      `SELECT id, text, author, created_at as date, resolved 
       FROM comments 
       WHERE project_id = ? AND file_path = ? 
       ORDER BY created_at DESC`,
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    
    assert(rows.length >= 1, 'Comment appears in query results');
    assert(rows[0].text === testComment.text, 'Comment text preserved exactly');
    assert(rows[0].author === testComment.author, 'Comment author preserved');
    assert(rows[0].resolved === 0, 'Comment resolved status is false (0)');
    
    // Test resolve comment
    await connection.query(
      'UPDATE comments SET resolved = 1 WHERE id = ?',
      [testComment.id]
    );
    const [resolvedRows] = await connection.query(
      'SELECT resolved FROM comments WHERE id = ?',
      [testComment.id]
    );
    assert(resolvedRows[0].resolved === 1, 'Comment can be resolved');
    
    // Test multiple comments
    const comment2 = {
      id: `test-comment-2-${Date.now()}`,
      text: 'Second test comment.',
      author: 'Another User',
      resolved: false
    };
    await connection.query(
      `INSERT INTO comments (id, project_id, file_path, user_id, text, author, created_at, resolved)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [comment2.id, TEST_PROJECT_ID, TEST_FILE_PATH, testUserId,
       comment2.text, comment2.author, 0]
    );
    
    const [multiRows] = await connection.query(
      'SELECT COUNT(*) as count FROM comments WHERE project_id = ? AND file_path = ?',
      [TEST_PROJECT_ID, TEST_FILE_PATH]
    );
    assert(multiRows[0].count >= 2, 'Multiple comments persist correctly');
    
    console.log('');
  } catch (e) {
    console.log(`   ❌ Test 2 failed with error: ${e.message}`);
    testsFailed += 6;
  }
}

// ── TEST 3: Session Logging ───────────────────────────────────
async function testSessionLogging() {
  console.log('⏱️  TEST 3: Session Logging');
  console.log('─────────────────────────────────────');
  
  try {
    const sessionStart = new Date();
    const sessionDuration = 1800; // 30 minutes
    const sessionLog = 'Test session log entry for critical path verification';
    const sessionId = `test-session-${Date.now()}`;
    
    // Log session
    await connection.query(
      `INSERT INTO sessions (id, user_id, project_id, started_at, ended_at, duration_s, log, created_at)
       VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? SECOND), ?, ?)`,
      [sessionId, testUserId, TEST_PROJECT_ID, sessionStart, sessionStart, sessionDuration, sessionLog, new Date()]
    );
    console.log(`   Logged test session: ${sessionId.substring(0, 20)}...`);
    
    // Verify session persisted
    const [rows] = await connection.query(
      `SELECT s.*, p.name as project_name 
       FROM sessions s 
       LEFT JOIN projects p ON p.id = s.project_id 
       WHERE s.id = ? AND s.user_id = ?`,
      [sessionId, testUserId]
    );
    
    assert(rows.length === 1, 'Session exists in database');
    assert(rows[0].project_id === TEST_PROJECT_ID, 'Session linked to correct project');
    assert(rows[0].duration_s === sessionDuration, 'Session duration preserved (30 min)');
    assert(rows[0].log === sessionLog, 'Session log text preserved exactly');
    assert(rows[0].project_name === 'Critical Test Project', 'Project name joined correctly');
    
    // Test session aggregation (for weekly reviews)
    const [aggRows] = await connection.query(
      `SELECT 
         COUNT(*) as session_count,
         SUM(duration_s) as total_seconds,
         AVG(duration_s) as avg_seconds
       FROM sessions 
       WHERE user_id = ? AND project_id = ?`,
      [testUserId, TEST_PROJECT_ID]
    );
    
    assert(aggRows[0].session_count >= 1, 'Session appears in aggregation');
    assert(aggRows[0].total_seconds >= sessionDuration, 'Duration sum correct');
    assert(aggRows[0].avg_seconds > 0, 'Average duration calculable');
    
    // Test that sessions appear in "recent sessions" query (used by AI)
    const [recentRows] = await connection.query(
      `SELECT s.project_id, p.name as project_name, s.duration_s, s.log, s.ended_at
       FROM sessions s 
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.user_id = ? 
       ORDER BY s.ended_at DESC 
       LIMIT 3`,
      [testUserId]
    );
    
    assert(recentRows.length >= 1, 'Session appears in recent sessions query');
    const foundSession = recentRows.find(r => r.project_id === TEST_PROJECT_ID);
    assert(foundSession !== undefined, 'Test session found in recent list');
    assert(foundSession.log === sessionLog, 'Session log in recent list matches');
    
    console.log('');
  } catch (e) {
    console.log(`   ❌ Test 3 failed with error: ${e.message}`);
    testsFailed += 8;
  }
}

// ── TEST 4: Data Integrity Validation ─────────────────────────
async function testDataIntegrity() {
  console.log('🔍 TEST 4: Data Integrity Validation');
  console.log('─────────────────────────────────────');
  
  try {
    // Check for orphaned records
    const [orphanFiles] = await connection.query(
      `SELECT COUNT(*) as count FROM project_files pf 
       LEFT JOIN projects p ON p.id = pf.project_id 
       WHERE p.id IS NULL`
    );
    assert(orphanFiles[0].count === 0, 'No orphaned file records (all files have valid projects)');
    
    const [orphanComments] = await connection.query(
      `SELECT COUNT(*) as count FROM comments c 
       LEFT JOIN projects p ON p.id = c.project_id 
       WHERE p.id IS NULL`
    );
    assert(orphanComments[0].count === 0, 'No orphaned comment records');
    
    const [orphanSessions] = await connection.query(
      `SELECT COUNT(*) as count FROM sessions s 
       LEFT JOIN projects p ON p.id = s.project_id 
       WHERE p.id IS NULL`
    );
    assert(orphanSessions[0].count === 0, 'No orphaned session records');
    
    // Check schema migrations are tracking
    const [migrationRows] = await connection.query('SELECT COUNT(*) as count FROM schema_migrations');
    assert(migrationRows[0].count >= 20, 'Schema migrations table has expected entries (20+)');
    
    // Verify critical tables exist
    const [tables] = await connection.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = ? 
       AND table_name IN ('users', 'projects', 'project_files', 'comments', 'sessions', 
                          'daily_checkins', 'training_logs', 'outreach_log', 'goals')`,
      [config.database]
    );
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    const criticalTables = ['users', 'projects', 'project_files', 'comments', 'sessions'];
    const allPresent = criticalTables.every(t => tableNames.includes(t));
    assert(allPresent, 'All critical tables exist in database');
    
    console.log('');
  } catch (e) {
    console.log(`   ❌ Test 4 failed with error: ${e.message}`);
    testsFailed += 5;
  }
}

// ── MAIN ───────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     THE BRAIN — Critical Path Tests                      ║');
  console.log('║     Data integrity verification for dry runs             ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  
  try {
    await setup();
    await testFileRoundTrip();
    await testCommentPersistence();
    await testSessionLogging();
    await testDataIntegrity();
  } catch (e) {
    console.error('\n❌ Fatal error:', e.message);
    testsFailed++;
  } finally {
    await teardown();
  }
}

main();
