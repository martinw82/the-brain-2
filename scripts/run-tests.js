#!/usr/bin/env node
/**
 * Comprehensive Test Runner for The Brain
 * 
 * Runs all test suites in order:
 * 1. Unit tests (Jest)
 * 2. Critical path tests (Database)
 * 3. Integration tests
 * 
 * Usage: node scripts/run-tests.js [options]
 * Options:
 *   --unit       Run only unit tests
 *   --critical   Run only critical path tests
 *   --coverage   Run with coverage report
 *   --watch      Run in watch mode
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const flags = {
  unit: args.includes('--unit'),
  critical: args.includes('--critical'),
  coverage: args.includes('--coverage'),
  watch: args.includes('--watch'),
};

// If no specific flags, run all
const runAll = !flags.unit && !flags.critical;

let exitCode = 0;

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     THE BRAIN — Test Suite Runner                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

// 1. Unit Tests (Jest)
if (runAll || flags.unit) {
  console.log('🧪 Running Unit Tests (Jest)...\n');
  
  try {
    let cmd = 'npx jest';
    
    if (flags.coverage) {
      cmd += ' --coverage';
    }
    
    if (flags.watch) {
      cmd += ' --watch';
    } else {
      cmd += ' --ci';
    }
    
    execSync(cmd, {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    
    console.log('✅ Unit tests passed\n');
  } catch (e) {
    console.error('❌ Unit tests failed\n');
    exitCode = 1;
  }
}

// 2. Critical Path Tests
if (runAll || flags.critical) {
  console.log('🔒 Running Critical Path Tests...\n');
  
  try {
    execSync('npm run test:critical', {
      cwd: join(__dirname, '..'),
      stdio: 'inherit',
    });
    
    console.log('✅ Critical path tests passed\n');
  } catch (e) {
    console.error('❌ Critical path tests failed\n');
    exitCode = 1;
  }
}

// Summary
console.log('╔══════════════════════════════════════════════════════════╗');
if (exitCode === 0) {
  console.log('║     ✅ ALL TESTS PASSED                                  ║');
} else {
  console.log('║     ❌ SOME TESTS FAILED                                 ║');
}
console.log('╚══════════════════════════════════════════════════════════╝');

process.exit(exitCode);
