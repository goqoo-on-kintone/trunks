import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import chalk from 'chalk';
import { kebabCase, pascalCase } from 'change-case';
import type { Config } from './types.js';

type DtsGenArgs = Record<string, string | undefined>;

// 認証引数を構築
function buildAuthArgs(config: Config): DtsGenArgs {
  const args: DtsGenArgs = {};

  switch (config.auth.type) {
    case 'password':
      args['username'] = process.env.KINTONE_USERNAME;
      args['password'] = process.env.KINTONE_PASSWORD;
      if (!args['username'] || !args['password']) {
        throw new Error('KINTONE_USERNAME and KINTONE_PASSWORD environment variables are required for password auth');
      }
      break;
    case 'oauth':
      // OAuth認証はトークン取得処理が必要（将来的に対応）
      throw new Error('OAuth authentication is not yet implemented');
    case 'api-token':
      args['api-token'] = config.auth.token;
      break;
  }

  // Basic認証
  if (config.basicAuth) {
    args['basic-auth-username'] = config.basicAuth.username;
    args['basic-auth-password'] = config.basicAuth.password;
  }

  // プロキシ
  if (config.proxy) {
    args['proxy'] = `http://${config.proxy.host}:${config.proxy.port}`;
  }

  return args;
}

// 単一アプリの型定義を生成
function generateForApp(
  appName: string,
  appId: number,
  config: Config,
  authArgs: DtsGenArgs,
  outDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: DtsGenArgs = {
      'base-url': `https://${config.host}`,
      ...authArgs,
      'type-name': `${pascalCase(appName)}Fields`,
      'app-id': String(appId),
      'output': `${outDir}/${kebabCase(appName)}-fields.d.ts`,
    };

    // undefined値をフィルタリングして引数配列を作成
    const cliArgs = Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `--${key}=${value}`);

    const proc = spawn('npx', ['kintone-dts-gen', ...cliArgs], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // dts-genはエラー時も0を返すことがあるので警告のみ
        console.error(chalk.yellow(`Warning: kintone-dts-gen exited with code ${code} for ${appName}`));
      }
      console.info(`${chalk.cyan('info')} ${chalk.magenta('Created')} ${chalk.green(args['output'])}`);
      resolve();
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// 全アプリの型定義を生成
export async function generate(config: Config): Promise<void> {
  const outDir = config.outDir ?? 'dts';
  mkdirSync(outDir, { recursive: true });

  const authArgs = buildAuthArgs(config);
  const apps = Object.entries(config.apps);

  console.info(chalk.cyan(`Generating type definitions for ${apps.length} app(s)...`));

  // 順次実行（並列だとコンソール出力が混在する）
  for (const [appName, appId] of apps) {
    await generateForApp(appName, appId, config, authArgs, outDir);
  }

  console.info(chalk.green('Done!'));
}
