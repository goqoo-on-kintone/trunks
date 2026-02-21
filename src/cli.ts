#!/usr/bin/env node
import { createRequire } from 'module';
import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { generate } from './generate.js';

// package.jsonからバージョンを取得
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

// .envファイルがあれば環境変数として読み込む
loadEnv({ quiet: true });

const program = new Command();

program
  .name('trunks')
  .description('Generate TypeScript type definitions for multiple Kintone apps')
  .version(version);

program
  .command('generate', { isDefault: true })
  .description('Generate type definitions for all configured apps')
  .option('-c, --config <path>', 'Path to config file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config ? undefined : process.cwd());
      await generate(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
