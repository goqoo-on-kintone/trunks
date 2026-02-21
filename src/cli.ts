#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { generate } from './generate.js';

const program = new Command();

program
  .name('trunks')
  .description('Generate TypeScript type definitions for multiple Kintone apps')
  .version('0.1.0');

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
