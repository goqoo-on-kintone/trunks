import { describe, it, expect } from '@jest/globals';
import { defineConfig } from '../src/types';
import type { Config } from '../src/types';

describe('defineConfig', () => {
  it('パスワード認証の設定を返す', () => {
    const config = defineConfig({
      host: 'example.cybozu.com',
      apps: { customer: 1, order: 2 },
      auth: { type: 'password' },
    });

    expect(config.host).toBe('example.cybozu.com');
    expect(config.apps).toEqual({ customer: 1, order: 2 });
    expect(config.auth.type).toBe('password');
  });

  it('APIトークン認証の設定を返す', () => {
    const config = defineConfig({
      host: 'example.cybozu.com',
      apps: { customer: 1 },
      auth: { type: 'api-token', token: 'test-token' },
    });

    expect(config.auth.type).toBe('api-token');
    if (config.auth.type === 'api-token') {
      expect(config.auth.token).toBe('test-token');
    }
  });

  it('OAuth認証の設定を返す', () => {
    const config = defineConfig({
      host: 'example.cybozu.com',
      apps: { customer: 1 },
      auth: { type: 'oauth', scope: 'k:app_record:read' },
    });

    expect(config.auth.type).toBe('oauth');
    if (config.auth.type === 'oauth') {
      expect(config.auth.scope).toBe('k:app_record:read');
    }
  });

  it('オプション設定を含む設定を返す', () => {
    const config = defineConfig({
      host: 'example.cybozu.com',
      apps: { customer: 1 },
      auth: { type: 'password' },
      proxy: { host: 'proxy.example.com', port: 8080 },
      basicAuth: { username: 'user', password: 'pass' },
      outDir: 'types',
    });

    expect(config.proxy).toEqual({ host: 'proxy.example.com', port: 8080 });
    expect(config.basicAuth).toEqual({ username: 'user', password: 'pass' });
    expect(config.outDir).toBe('types');
  });

  it('型チェックが正しく機能する', () => {
    // 型レベルでのテスト（コンパイルが通ればOK）
    const passwordConfig: Config = {
      host: 'example.cybozu.com',
      apps: { app1: 1 },
      auth: { type: 'password' },
    };

    const apiTokenConfig: Config = {
      host: 'example.cybozu.com',
      apps: { app1: 1 },
      auth: { type: 'api-token', token: 'xxx' },
    };

    const oauthConfig: Config = {
      host: 'example.cybozu.com',
      apps: { app1: 1 },
      auth: { type: 'oauth' },
    };

    expect(passwordConfig).toBeDefined();
    expect(apiTokenConfig).toBeDefined();
    expect(oauthConfig).toBeDefined();
  });
});
