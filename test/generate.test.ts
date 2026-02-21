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

  it('パスワード認証で環境変数が設定されていない場合はエラー', async () => {
    delete process.env.KINTONE_USERNAME;
    delete process.env.KINTONE_PASSWORD;

    const config: Config = {
      host: 'example.cybozu.com',
      apps: { customer: 1 },
      auth: { type: 'password' },
    };

    await expect(generate(config)).rejects.toThrow(
      'KINTONE_USERNAME and KINTONE_PASSWORD environment variables are required'
    );
  });

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
