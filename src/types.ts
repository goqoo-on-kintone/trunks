// 認証設定
export type PasswordAuth = {
  type: 'password';
  // 環境変数 KINTONE_USERNAME, KINTONE_PASSWORD から取得
};

export type OAuthAuth = {
  type: 'oauth';
  scope?: string;
};

export type ApiTokenAuth = {
  type: 'api-token';
  token: string;
};

export type Auth = PasswordAuth | OAuthAuth | ApiTokenAuth;

// プロキシ設定
export type ProxyConfig = {
  host: string;
  port: number;
};

// Basic認証設定
export type BasicAuthConfig = {
  username: string;
  password: string;
};

// クライアント証明書設定（PFX/PKCS#12形式）
export type PfxConfig = {
  filepath: string;
  password: string;
};

// Gyuma用のエージェントオプション
export type AgentOptions = {
  proxy?: string;
  pfx?: PfxConfig;
};

// メイン設定
export type Config = {
  host: string; // Kintone環境のホスト（例: "example.cybozu.com"）
  apps: Record<string, number>; // { appName: appId }
  auth: Auth;
  proxy?: ProxyConfig;
  basicAuth?: BasicAuthConfig;
  // クライアント証明書（OAuth使用時にGyumaへ渡す）
  pfx?: PfxConfig;
  // 出力ディレクトリ（デフォルト: "dts"）
  outDir?: string;
  // プレビュー環境を参照する場合はtrue（デフォルト: false）
  preview?: boolean;
  // ゲストスペースID（ゲストスペース内のアプリの場合に指定）
  guestSpaceId?: number;
  // 生成する型のnamespace（デフォルト: "kintone.types"）
  namespace?: string;
};

// 設定ファイルの型（defineConfigのため）
export const defineConfig = (config: Config): Config => config;
