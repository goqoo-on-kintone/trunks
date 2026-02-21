import { spawn } from 'child_process';
import { mkdirSync } from 'fs';
import * as readline from 'readline';
import chalk from 'chalk';
import { kebabCase, pascalCase } from 'change-case';
import type { Config } from './types.js';

type DtsGenArgs = Record<string, string | undefined>;

// 標準入力からテキストを取得
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 標準入力からパスワードを取得（入力を隠す）
function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // TTYでない場合は通常の入力
      const rl = readline.createInterface({ input: stdin, output: process.stdout });
      rl.question('', (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    // TTYの場合はraw modeで入力を隠す
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        // Enter or Ctrl+D
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdin.pause();
        process.stdout.write('\n');
        resolve(password);
      } else if (char === '\u0003') {
        // Ctrl+C
        stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(1);
      } else if (char === '\u007F' || char === '\b') {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += char;
      }
    };

    stdin.on('data', onData);
  });
}

// 認証引数を構築
async function buildAuthArgs(config: Config): Promise<DtsGenArgs> {
  const args: DtsGenArgs = {};

  switch (config.auth.type) {
    case 'password': {
      let username = process.env.KINTONE_USERNAME;
      let password = process.env.KINTONE_PASSWORD;

      // 環境変数が未設定の場合は標準入力で取得
      if (!username) {
        username = await prompt('Kintone Username: ');
      }
      if (!password) {
        password = await promptPassword('Kintone Password: ');
      }

      if (!username || !password) {
        throw new Error('Username and password are required for password auth');
      }

      args['username'] = username;
      args['password'] = password;
      break;
    }
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

// kintoneのエラーレスポンスを抽出
function extractKintoneError(output: string): { code: string; id: string; message: string } | null {
  // 形式: code: 'GAIA_AP15' または "code": "GAIA_AP15"
  const codeMatch = output.match(/code:\s*'([^']+)'/) ?? output.match(/"code":\s*"([^"]+)"/);
  const idMatch = output.match(/id:\s*'([^']+)'/) ?? output.match(/"id":\s*"([^"]+)"/);
  const messageMatch = output.match(/message:\s*'([^']+)'/) ?? output.match(/"message":\s*"([^"]+)"/);

  const code = codeMatch?.[1];
  const id = idMatch?.[1];
  const message = messageMatch?.[1];

  if (code && message) {
    return { code, id: id ?? '', message };
  }
  return null;
}

// 単一アプリの型定義を生成
function generateForApp(
  appName: string,
  appId: number,
  config: Config,
  authArgs: DtsGenArgs,
  outDir: string
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    const outputPath = `${outDir}/${kebabCase(appName)}-fields.d.ts`;
    const args: DtsGenArgs = {
      'base-url': `https://${config.host}`,
      ...authArgs,
      'type-name': `${pascalCase(appName)}Fields`,
      'app-id': String(appId),
      'output': outputPath,
      'guest-space-id': config.guestSpaceId !== undefined ? String(config.guestSpaceId) : undefined,
      'namespace': config.namespace,
    };

    // undefined値をフィルタリングして引数配列を作成
    const cliArgs = Object.entries(args)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `--${key}=${value}`);

    // プレビュー環境の場合は--previewフラグを追加
    if (config.preview) {
      cliArgs.push('--preview');
    }

    const proc = spawn('npx', ['kintone-dts-gen', ...cliArgs], {
      cwd: process.cwd(),
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // stdoutとstderr両方からエラー情報を探す
        const output = stdout + stderr;
        const kintoneError = extractKintoneError(output);
        if (kintoneError) {
          console.error(chalk.red(`Error [${appName}]:`), kintoneError.message);
          console.error(chalk.gray(`  code: ${kintoneError.code}, id: ${kintoneError.id}`));
        } else {
          console.error(chalk.red(`Error [${appName}]:`), `kintone-dts-gen exited with code ${code}`);
        }
        resolve({ success: false, output: outputPath });
      } else {
        console.info(`${chalk.cyan('info')} ${chalk.magenta('Created')} ${chalk.green(outputPath)}`);
        resolve({ success: true, output: outputPath });
      }
    });

    proc.on('error', (err) => {
      console.error(chalk.red(`Error [${appName}]:`), err.message);
      resolve({ success: false, output: outputPath });
    });
  });
}

// 全アプリの型定義を生成
export async function generate(config: Config): Promise<void> {
  const outDir = config.outDir ?? 'dts';
  mkdirSync(outDir, { recursive: true });

  const authArgs = await buildAuthArgs(config);
  const apps = Object.entries(config.apps);

  console.info(chalk.cyan(`Generating type definitions for ${apps.length} app(s)...`));

  // 順次実行（並列だとコンソール出力が混在する）
  const results: { success: boolean; output: string }[] = [];
  for (const [appName, appId] of apps) {
    const result = await generateForApp(appName, appId, config, authArgs, outDir);
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  if (failCount > 0) {
    console.info(chalk.yellow(`\nCompleted with ${failCount} error(s). (${successCount}/${results.length} succeeded)`));
  } else {
    console.info(chalk.green('Done!'));
  }
}
