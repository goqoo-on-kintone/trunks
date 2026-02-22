import * as fs from 'fs';
import * as readline from 'readline';
import chalk from 'chalk';

// 標準入力からテキストを取得
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Yes/No プロンプト
async function promptYesNo(question: string, defaultValue = true): Promise<boolean> {
  const hint = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}: `);
  if (answer === '') return defaultValue;
  return answer.toLowerCase().startsWith('y');
}

// 選択肢プロンプト
async function promptChoice(question: string, choices: string[]): Promise<string> {
  console.info(question);
  choices.forEach((choice, index) => {
    console.info(`  ${index + 1}. ${choice}`);
  });
  const answer = await prompt('Select [1]: ');
  const index = answer === '' ? 0 : parseInt(answer, 10) - 1;
  if (index < 0 || index >= choices.length) {
    return choices[0];
  }
  return choices[index];
}

type AppEntry = { name: string; id: number };

// アプリの入力
async function promptApps(): Promise<AppEntry[]> {
  const apps: AppEntry[] = [];

  console.info(chalk.cyan('\nAdd kintone apps:'));

  while (true) {
    const name = await prompt('  App name (e.g., customer): ');
    if (!name) {
      if (apps.length === 0) {
        console.info(chalk.yellow('  At least one app is required.'));
        continue;
      }
      break;
    }

    const idStr = await prompt('  App ID: ');
    const id = parseInt(idStr, 10);
    if (isNaN(id) || id <= 0) {
      console.info(chalk.yellow('  Invalid app ID. Please enter a positive number.'));
      continue;
    }

    apps.push({ name, id });
    console.info(chalk.green(`  Added: ${name} (ID: ${id})`));

    const addMore = await promptYesNo('\n  Add another app?', false);
    if (!addMore) break;
  }

  return apps;
}

// 設定ファイルの生成
function generateConfigContent(host: string, apps: AppEntry[], authType: string): string {
  const appsObj = apps.map((app) => `    ${app.name}: ${app.id},`).join('\n');

  let authConfig: string;
  switch (authType) {
    case 'api-token':
      authConfig = "{ type: 'api-token' }";
      break;
    case 'oauth':
      authConfig = "{ type: 'oauth' }";
      break;
    default:
      authConfig = "{ type: 'password' }";
  }

  return `import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  host: '${host}',
  apps: {
${appsObj}
  },
  auth: ${authConfig},
});
`;
}

// init コマンドの実行
export async function init(): Promise<void> {
  const configPath = 'trunks.config.ts';

  // 既存ファイルの確認
  if (fs.existsSync(configPath)) {
    const overwrite = await promptYesNo(`${configPath} already exists. Overwrite?`, false);
    if (!overwrite) {
      console.info(chalk.yellow('Aborted.'));
      return;
    }
  }

  console.info(chalk.cyan('Creating trunks.config.ts...\n'));

  // ホスト入力
  const host = await prompt('Kintone host (e.g., example.cybozu.com): ');
  if (!host) {
    console.info(chalk.red('Host is required.'));
    return;
  }

  // アプリ入力
  const apps = await promptApps();
  if (apps.length === 0) {
    console.info(chalk.red('At least one app is required.'));
    return;
  }

  // 認証方式選択
  const authType = await promptChoice('\nAuthentication method:', ['password', 'api-token', 'oauth']);

  // ファイル生成
  const content = generateConfigContent(host, apps, authType);
  fs.writeFileSync(configPath, content);

  console.info(chalk.green(`\n✓ Created ${configPath}`));
  console.info(chalk.gray('\nRun `trunks` to generate type definitions.'));
}
