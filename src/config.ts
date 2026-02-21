import { existsSync } from 'fs';
import { resolve } from 'path';
import { createJiti } from 'jiti';
import type { Config } from './types.js';

const CONFIG_FILES = ['trunks.config.ts', 'trunks.config.js', 'trunks.config.mjs'];

// 設定ファイルを検索して読み込む
export async function loadConfig(cwd: string = process.cwd()): Promise<Config> {
  const jiti = createJiti(cwd, { interopDefault: true });

  for (const filename of CONFIG_FILES) {
    const configPath = resolve(cwd, filename);
    if (existsSync(configPath)) {
      const config = await jiti.import(configPath);
      return config as Config;
    }
  }

  throw new Error(
    `Config file not found. Create one of: ${CONFIG_FILES.join(', ')}`
  );
}
