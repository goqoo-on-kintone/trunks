#!/usr/bin/env node
import { createRequire } from 'module';
import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './config.js';
import { generate } from './generate.js';
import { init } from './init.js';
import type { Config, Auth } from './types.js';

// package.jsonからバージョンを取得
const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

// .envファイルがあれば環境変数として読み込む
loadEnv({ quiet: true });

// --app オプションをパース（name:id 形式）
function parseAppOption(value: string, previous: Record<string, number>): Record<string, number> {
  const [name, idStr] = value.split(':');
  const id = parseInt(idStr, 10);
  if (!name || isNaN(id)) {
    throw new Error(`Invalid app format: "${value}". Expected "name:id" (e.g., "customer:123")`);
  }
  return { ...previous, [name]: id };
}

// --proxy オプションをパース（host:port 形式）
function parseProxyOption(value: string): { host: string; port: number } {
  const [host, portStr] = value.split(':');
  const port = parseInt(portStr, 10);
  if (!host || isNaN(port)) {
    throw new Error(`Invalid proxy format: "${value}". Expected "host:port" (e.g., "proxy.example.com:8080")`);
  }
  return { host, port };
}

// CLIオプションからConfigを構築
function buildConfigFromOptions(options: {
  host: string;
  app: Record<string, number>;
  authType: string;
  username?: string;
  password?: string;
  apiToken?: string;
  oauthScope?: string;
  outDir?: string;
  preview?: boolean;
  guestSpaceId?: string;
  namespace?: string;
  format?: boolean;
  proxy?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
}): Config {
  // 認証設定の構築
  let auth: Auth;
  switch (options.authType) {
    case 'api-token':
      auth = { type: 'api-token', token: options.apiToken };
      break;
    case 'oauth':
      auth = { type: 'oauth', scope: options.oauthScope };
      break;
    default:
      auth = { type: 'password', username: options.username, password: options.password };
  }

  const config: Config = {
    host: options.host,
    apps: options.app,
    auth,
  };

  // オプション設定
  if (options.outDir) config.outDir = options.outDir;
  if (options.preview) config.preview = true;
  if (options.guestSpaceId) config.guestSpaceId = parseInt(options.guestSpaceId, 10);
  if (options.namespace) config.namespace = options.namespace;
  if (options.format) config.format = true;

  // プロキシ設定
  if (options.proxy) {
    config.proxy = parseProxyOption(options.proxy);
  }

  // Basic認証設定
  if (options.basicAuthUsername && options.basicAuthPassword) {
    config.basicAuth = {
      username: options.basicAuthUsername,
      password: options.basicAuthPassword,
    };
  }

  return config;
}

// 型定義生成のアクション
async function generateAction(options: {
  config?: string;
  host?: string;
  app: Record<string, number>;
  authType: string;
  username?: string;
  password?: string;
  apiToken?: string;
  oauthScope?: string;
  outDir?: string;
  preview?: boolean;
  guestSpaceId?: string;
  namespace?: string;
  format?: boolean;
  proxy?: string;
  basicAuthUsername?: string;
  basicAuthPassword?: string;
}): Promise<void> {
  try {
    let config: Config;

    // --hostと--appが指定されている場合はCLIオプションから設定を構築
    if (options.host && Object.keys(options.app).length > 0) {
      config = buildConfigFromOptions(options as Parameters<typeof buildConfigFromOptions>[0]);
    } else if (options.host || Object.keys(options.app).length > 0) {
      // 片方だけ指定されている場合はエラー
      throw new Error('Both --host and --app are required for CLI-only mode');
    } else {
      // 設定ファイルから読み込み
      config = await loadConfig(options.config ? undefined : process.cwd());
    }

    await generate(config);
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const program = new Command();

program
  .name('trunks')
  .description('Generate TypeScript type definitions for multiple Kintone apps')
  .version(version)
  // 設定ファイル
  .option('-c, --config <path>', 'Path to config file')
  // ワンライナー実行用オプション
  .option('-H, --host <host>', 'Kintone host (e.g., example.cybozu.com)')
  .option('-a, --app <name:id>', 'App to generate (can be repeated)', parseAppOption, {})
  .option('-A, --auth-type <type>', 'Authentication type: password, api-token, oauth', 'password')
  .option('-u, --username <username>', 'Kintone username (for password auth)')
  .option('-p, --password <password>', 'Kintone password (for password auth)')
  .option('-t, --api-token <token>', 'Kintone API token (for api-token auth)')
  .option('--oauth-scope <scope>', 'OAuth scope (for oauth auth)')
  .option('-o, --out-dir <dir>', 'Output directory')
  .option('--preview', 'Use preview environment')
  .option('-g, --guest-space-id <id>', 'Guest space ID')
  .option('-n, --namespace <namespace>', 'TypeScript namespace')
  .option('-f, --format', 'Format output with Prettier')
  .option('--proxy <host:port>', 'Proxy server')
  .option('--basic-auth-username <username>', 'Basic auth username')
  .option('--basic-auth-password <password>', 'Basic auth password')
  .action(generateAction);

// init コマンド
program
  .command('init')
  .description('Create a new trunks.config.ts interactively')
  .action(async () => {
    try {
      await init();
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
