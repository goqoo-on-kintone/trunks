import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { generate } from '../src/generate';
import type { Config } from '../src/types';

describe('generate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // NOTE: パスワード認証で環境変数が未設定の場合は標準入力を求めるため、
  // 自動テストでは検証が困難。手動テストで確認する。

  it('OAuth認証はまだ未実装エラーを投げる', async () => {
    const config: Config = {
      host: 'example.cybozu.com',
      apps: { customer: 1 },
      auth: { type: 'oauth' },
    };

    await expect(generate(config)).rejects.toThrow('OAuth authentication is not yet implemented');
  });

  it('appsが空の場合でもエラーにならない', async () => {
    const config: Config = {
      host: 'example.cybozu.com',
      apps: {},
      auth: { type: 'api-token', token: 'test' },
    };

    // appsが空なのでspawnは呼ばれず、正常終了するはず
    await expect(generate(config)).resolves.toBeUndefined();
  });
});
