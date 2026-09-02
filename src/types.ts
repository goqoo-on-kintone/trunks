// 認証設定
export type PasswordAuth = {
  type: 'password';
  // 設定ファイルに直書き、環境変数、または標準入力から取得
  username?: string;
  password?: string;
};

export type OAuthAuth = {
  type: 'oauth';
  scope?: string;
};

export type ApiTokenAuth = {
  type: 'api-token';
  // 環境変数 KINTONE_API_TOKEN から取得、または標準入力
  token?: string;
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
  apps: Record<string, AppConfig>; // { appName: appId } または { appName: { id, extended } }
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
  // 生成後にPrettierでフォーマットするか（デフォルト: false）
  format?: boolean;
  // デバッグモード：エラー発生時に詳細情報を表示（デフォルト: false）
  debug?: boolean;
};

// アプリごとの設定。数値の短縮形も受け付ける。
export type AppConfig = number | { id: number; extended?: boolean };

// 正規化後のアプリ設定
export type NormalizedApp = {
  name: string;
  id: number;
  extended: boolean;
};

// dts-genに渡すCLI引数（client.tsでも認証情報の受け渡しに使う）
export type DtsGenArgs = Record<string, string | undefined>;

// appsの短縮形を正規化する。extendedのデフォルトはtrue。
export function normalizeApps(apps: Record<string, AppConfig>): NormalizedApp[] {
  return Object.entries(apps).map(([name, value]) => {
    if (typeof value === 'number') {
      return { name, id: value, extended: true };
    }
    return { name, id: value.id, extended: value.extended ?? true };
  });
}

// 設定ファイルの型（defineConfigのため）
export const defineConfig = (config: Config): Config => config;
