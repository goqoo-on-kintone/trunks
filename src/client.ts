import { KintoneRestAPIClient } from '@kintone/rest-api-client';
import type { Config, DtsGenArgs } from './types.js';

type Auth = { username: string; password: string } | { apiToken: string } | { oAuthToken: string };

export type ClientOptions = {
  baseUrl: string;
  auth: Auth;
  basicAuth?: { username: string; password: string };
  proxy?: { host: string; port: number };
  guestSpaceId?: number;
  clientCertAuth?: { pfxFilePath: string; password: string };
};

// buildAuthArgsが解決済みの認証情報をrest-api-clientのオプションに写す。
// 認証の解決（OAuthのトークン取得や対話入力）を二度走らせないため、
// dts-gen用に組み立てた引数をそのまま再利用する。
export function buildClientOptions(config: Config, authArgs: DtsGenArgs): ClientOptions {
  const auth = resolveAuth(authArgs);

  const options: ClientOptions = {
    baseUrl: `https://${config.host}`,
    auth,
  };

  const basicUser = authArgs['basic-auth-username'];
  const basicPass = authArgs['basic-auth-password'];
  if (basicUser && basicPass) {
    options.basicAuth = { username: basicUser, password: basicPass };
  }

  if (config.proxy) {
    options.proxy = { host: config.proxy.host, port: config.proxy.port };
  }

  if (config.guestSpaceId !== undefined) {
    options.guestSpaceId = config.guestSpaceId;
  }

  if (config.pfx) {
    options.clientCertAuth = { pfxFilePath: config.pfx.filepath, password: config.pfx.password };
  }

  return options;
}

function resolveAuth(authArgs: DtsGenArgs): Auth {
  const oAuthToken = authArgs['oauth-token'];
  if (oAuthToken) {
    return { oAuthToken };
  }

  const apiToken = authArgs['api-token'];
  if (apiToken) {
    return { apiToken };
  }

  const username = authArgs['username'];
  const password = authArgs['password'];
  if (username && password) {
    return { username, password };
  }

  throw new Error('Could not resolve credentials for the Kintone API client');
}

export function createClient(config: Config, authArgs: DtsGenArgs): KintoneRestAPIClient {
  return new KintoneRestAPIClient(buildClientOptions(config, authArgs));
}
