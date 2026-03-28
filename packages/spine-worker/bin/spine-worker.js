#!/usr/bin/env node

/**
 * Spine Worker CLI
 * 
 * Commands:
 *   init    - Configure worker connection
 *   start   - Start worker and connect to Spine
 *   status  - Show worker status
 *   stop    - Stop worker (if running as daemon)
 */

import { program } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';
import { SpineWorker } from '../src/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.spine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'worker.json');

program
  .name('spine-worker')
  .description('Spine Desktop Worker - Execute jobs locally')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize worker configuration')
  .option('-u, --url <url>', 'Spine URL')
  .option('-t, --token <token>', 'Spine API token')
  .option('-n, --name <name>', 'Worker name')
  .action(async (options) => {
    console.log(chalk.blue('🚀 Spine Worker Initialization\n'));

    // Ensure config directory exists
    await fs.ensureDir(CONFIG_DIR);

    // Interactive prompts for missing options
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Spine URL:',
        default: options.url || 'https://the-brain-2.vercel.app',
        when: !options.url
      },
      {
        type: 'password',
        name: 'token',
        message: 'Spine API Token:',
        when: !options.token
      },
      {
        type: 'input',
        name: 'name',
        message: 'Worker name:',
        default: options.name || `${os.userInfo().username}-${os.hostname()}`,
        when: !options.name
      }
    ]);

    const config = {
      spine_url: options.url || answers.url,
      auth_token: options.token || answers.token,
      worker_id: options.name || answers.name,
      capabilities: {},
      connection: {
        protocol: 'sse',
        heartbeat_interval: 30,
        reconnect_interval: 5
      }
    };

    // Save config
    await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });

    console.log(chalk.green('\n✅ Configuration saved to'), CONFIG_FILE);
    console.log(chalk.gray('\nNext steps:'));
    console.log(chalk.gray('  1. Start the worker:'), chalk.cyan('spine-worker start'));
    console.log(chalk.gray('  2. Or check status:'), chalk.cyan('spine-worker status'));
  });

// Start command
program
  .command('start')
  .description('Start the worker and connect to Spine')
  .option('-c, --config <path>', 'Config file path', CONFIG_FILE)
  .option('--capabilities <list>', 'Comma-separated capabilities', 'video.render,shell')
  .action(async (options) => {
    // Load config
    if (!await fs.pathExists(options.config)) {
      console.error(chalk.red('❌ Config not found. Run:'), chalk.cyan('spine-worker init'));
      process.exit(1);
    }

    const config = await fs.readJson(options.config);
    
    // Override capabilities if specified
    if (options.capabilities) {
      const caps = options.capabilities.split(',').map(c => c.trim());
      config.capabilities = {};
      for (const cap of caps) {
        config.capabilities[cap] = true;
      }
    }

    console.log(chalk.blue('🎯 Spine Worker Starting...\n'));
    console.log(chalk.gray('URL:'), config.spine_url);
    console.log(chalk.gray('Worker:'), config.worker_id);
    console.log(chalk.gray('Capabilities:'), Object.keys(config.capabilities).join(', ') || 'auto-detect');
    console.log();

    // Create and start worker
    const worker = new SpineWorker(config);
    
    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n👋 Shutting down...'));
      await worker.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await worker.stop();
      process.exit(0);
    });

    try {
      await worker.start();
    } catch (e) {
      console.error(chalk.red('❌ Failed to start worker:'), e.message);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show worker status')
  .option('-c, --config <path>', 'Config file path', CONFIG_FILE)
  .action(async (options) => {
    if (!await fs.pathExists(options.config)) {
      console.error(chalk.red('❌ Config not found. Run:'), chalk.cyan('spine-worker init'));
      process.exit(1);
    }

    const config = await fs.readJson(options.config);
    
    console.log(chalk.blue('📊 Spine Worker Status\n'));
    console.log(chalk.gray('Config file:'), options.config);
    console.log(chalk.gray('Spine URL:'), config.spine_url);
    console.log(chalk.gray('Worker ID:'), config.worker_id);
    console.log(chalk.gray('Protocol:'), config.connection?.protocol || 'sse');
    console.log();
    console.log(chalk.gray('Capabilities:'));
    
    const caps = config.capabilities || {};
    if (Object.keys(caps).length === 0) {
      console.log(chalk.gray('  (auto-detect on start)'));
    } else {
      for (const [key, value] of Object.entries(caps)) {
        console.log(chalk.gray(`  • ${key}:`), value);
      }
    }
    
    console.log();
    console.log(chalk.gray('To start:'), chalk.cyan('spine-worker start'));
  });

// Detect capabilities command
program
  .command('detect')
  .description('Detect and display system capabilities')
  .action(async () => {
    console.log(chalk.blue('🔍 Detecting System Capabilities\n'));
    
    const { detectCapabilities } = await import('../src/capabilities/detector.js');
    const caps = await detectCapabilities();
    
    console.log(chalk.green('Detected capabilities:'));
    console.log(JSON.stringify(caps, null, 2));
  });

program.parse();
