import { describe, it, expect } from '@jest/globals';
import { buildClientOptions } from '../src/client';
import type { Config } from '../src/types';

const baseConfig: Config = {
  host: 'example.cybozu.com',
  apps: { expense: 123 },
  auth: { type: 'password' },
};

describe('buildClientOptions', () => {
  it('hostからbaseUrlを組み立てる', () => {
    const options = buildClientOptions(baseConfig, { username: 'u', password: 'p' });
    expect(options.baseUrl).toBe('https://example.cybozu.com');
  });

  it('username/passwordをauthに割り当てる', () => {
    const options = buildClientOptions(baseConfig, { username: 'u', password: 'p' });
    expect(options.auth).toEqual({ username: 'u', password: 'p' });
  });

  it('api-tokenをauthに割り当てる', () => {
    const options = buildClientOptions(baseConfig, { 'api-token': 't' });
    expect(options.auth).toEqual({ apiToken: 't' });
  });

  it('oauth-tokenをauthに割り当てる', () => {
    const options = buildClientOptions(baseConfig, { 'oauth-token': 'tok' });
    expect(options.auth).toEqual({ oAuthToken: 'tok' });
  });

  it('oauth-tokenがある場合はusername/passwordより優先する', () => {
    const options = buildClientOptions(baseConfig, { 'oauth-token': 'tok', username: 'u', password: 'p' });
    expect(options.auth).toEqual({ oAuthToken: 'tok' });
  });

  it('Basic認証の引数をbasicAuthに割り当てる', () => {
    const options = buildClientOptions(baseConfig, {
      username: 'u',
      password: 'p',
      'basic-auth-username': 'bu',
      'basic-auth-password': 'bp',
    });
    expect(options.basicAuth).toEqual({ username: 'bu', password: 'bp' });
  });

  it('Basic認証がない場合はbasicAuthを省く', () => {
    const options = buildClientOptions(baseConfig, { username: 'u', password: 'p' });
    expect(options.basicAuth).toBeUndefined();
  });

  it('proxy設定を引き継ぐ', () => {
    const config: Config = { ...baseConfig, proxy: { host: 'proxy.example.com', port: 8080 } };
    const options = buildClientOptions(config, { username: 'u', password: 'p' });
    expect(options.proxy).toEqual({ host: 'proxy.example.com', port: 8080 });
  });

  it('pfxをclientCertAuthに割り当てる', () => {
    const config: Config = { ...baseConfig, pfx: { filepath: '/tmp/cert.pfx', password: 'cp' } };
    const options = buildClientOptions(config, { username: 'u', password: 'p' });
    expect(options.clientCertAuth).toEqual({ pfxFilePath: '/tmp/cert.pfx', password: 'cp' });
  });

  it('guestSpaceIdを引き継ぐ', () => {
    const config: Config = { ...baseConfig, guestSpaceId: 5 };
    const options = buildClientOptions(config, { username: 'u', password: 'p' });
    expect(options.guestSpaceId).toBe(5);
  });

  it('認証情報が解決できない場合はエラーをスローする', () => {
    expect(() => buildClientOptions(baseConfig, {})).toThrow('Could not resolve credentials');
  });
});
