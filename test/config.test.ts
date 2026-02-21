import { describe, it, expect } from '@jest/globals';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('設定ファイルが見つからない場合はエラーをスローする', async () => {
    // 存在しないディレクトリを指定
    await expect(loadConfig('/non-existent-dir-12345')).rejects.toThrow('Config file not found');
  });

  it('エラーメッセージに設定ファイル名の候補を含む', async () => {
    await expect(loadConfig('/non-existent-dir-12345')).rejects.toThrow('trunks.config.ts');
  });
});
