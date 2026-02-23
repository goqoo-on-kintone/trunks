# trunks

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](/README.md) | 日本語

[@kintone/dts-gen](https://github.com/kintone/js-sdk/tree/main/packages/dts-gen) のラッパー CLI ツール。設定ファイル1つで複数の kintone アプリの TypeScript 型定義を一括生成します。

## 特徴

- 1コマンドで複数アプリの型定義を生成
- TypeScript 設定ファイルで型安全な設定（`trunks.config.ts`）
- 複数の認証方式に対応（パスワード、API トークン、OAuth）
- Prettier による自動フォーマット（オプション）
- プレビュー環境・ゲストスペースに対応

## クイックスタート

### init コマンドを使う

```bash
npx @goqoo/trunks init
```

対話形式で `trunks.config.ts` ファイルを作成できます。

### 手動セットアップ

1. プロジェクトルートに設定ファイル `trunks.config.ts` を作成：

```typescript
import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  host: 'your-subdomain.cybozu.com',
  apps: {
    customer: 123,
    order: 456,
    product: 789,
  },
  auth: { type: 'oauth' },
});
```

2. コマンドを実行：

グローバルインストールあり：

```bash
npm install -g @goqoo/trunks
trunks
```

グローバルインストールなし：

```bash
npx @goqoo/trunks
```

3. `dts/` ディレクトリに型定義ファイルが生成されます：
   - `dts/customer-fields.d.ts`
   - `dts/order-fields.d.ts`
   - `dts/product-fields.d.ts`

## 設定

### 基本設定

```typescript
import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  // 必須
  host: 'your-subdomain.cybozu.com',
  apps: {
    customer: 123,  // { アプリ名: アプリID }
    order: 456,
  },
  auth: { type: 'oauth' },

  // オプション
  outDir: 'dts',           // 出力ディレクトリ（デフォルト: "dts"）
  preview: false,          // プレビュー環境を使用（デフォルト: false）
  guestSpaceId: 5,         // ゲストスペース ID（該当する場合）
  namespace: 'kintone.types', // TypeScript の namespace（デフォルト: "kintone.types"）
  format: true,            // Prettier でフォーマット（デフォルト: false）
});
```

### 認証方式

環境変数はプロジェクトルートの `.env` ファイルに設定できます：

```bash
# .env
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
KINTONE_API_TOKEN=your-api-token
```

> **注意**: 設定ファイルに認証情報を直書きする場合は、設定ファイルを `.gitignore` に追加して、バージョン管理に機密情報がコミットされないようにしてください。環境変数（`.env` ファイル）または標準入力の使用を推奨します。

#### パスワード

認証情報は設定ファイル、環境変数 `KINTONE_USERNAME` と `KINTONE_PASSWORD`、または標準入力から取得します（この優先順位）。

```typescript
auth: { type: 'password' },
// または直書き（非推奨）
auth: { type: 'password', username: 'user', password: 'pass' },
```

#### API トークン

トークンは設定ファイル、環境変数 `KINTONE_API_TOKEN`、または標準入力から取得します（この優先順位）。

```typescript
auth: { type: 'api-token' },
// または直書き（非推奨）
auth: { type: 'api-token', token: 'your-token' },
```

複数アプリの場合は `.env` でカンマ区切りで指定：

```bash
KINTONE_API_TOKEN=token1,token2,token3
```

#### OAuth

[Gyuma](https://github.com/nicecai/gyuma) を使用した OAuth 認証。ブラウザが開いて認証を行います。

```typescript
auth: {
  type: 'oauth',
  scope: 'k:app_settings:read',  // オプション: カスタムスコープ
},
```

### その他のオプション

#### Basic 認証

Basic 認証が必要な環境の場合：

```typescript
basicAuth: {
  username: 'basic-user',
  password: 'basic-password',
},
```

#### プロキシ

```typescript
proxy: {
  host: 'proxy.example.com',
  port: 8080,
},
```

#### クライアント証明書（OAuth 用）

```typescript
pfx: {
  filepath: '/path/to/cert.pfx',
  password: 'certificate-password',
},
```

## CLI

### オプション

```bash
trunks [options]

Options:
  -c, --config <path>               設定ファイルのパス
  -H, --host <host>                 kintone ホスト（例: example.cybozu.com）
  -a, --app <name:id>               生成するアプリ（複数指定可）
  -A, --auth-type <type>            認証方式: password, api-token, oauth
  -u, --username <username>         kintone ユーザー名（password 認証用）
  -p, --password <password>         kintone パスワード（password 認証用）
  -t, --api-token <token>           kintone API トークン（api-token 認証用）
  --oauth-scope <scope>             OAuth スコープ（oauth 認証用）
  -o, --out-dir <dir>               出力ディレクトリ
  --preview                         プレビュー環境を使用
  -g, --guest-space-id <id>         ゲストスペース ID
  -n, --namespace <namespace>       TypeScript namespace
  -f, --format                      Prettier でフォーマット
  --proxy <host:port>               プロキシサーバー
  --basic-auth-username <username>  Basic 認証ユーザー名
  --basic-auth-password <password>  Basic 認証パスワード
  -h, --help                        ヘルプを表示
  -V, --version                     バージョンを表示
```

### ワンライナー実行

設定ファイルなしで、CLI オプションだけで実行できます：

```bash
npx @goqoo/trunks \
  -H example.cybozu.com \
  -a customer:123 \
  -a order:456 \
  -A api-token \
  -t "$KINTONE_API_TOKEN"
```

## 生成される出力

アプリ名 `customer`（ID: 123）の場合、以下のファイルが生成されます：

```typescript
// dts/customer-fields.d.ts
declare namespace kintone.types {
  interface CustomerFields {
    companyName: kintone.fieldTypes.SingleLineText;
    email: kintone.fieldTypes.Link;
    // ...
  }
  interface SavedCustomerFields extends CustomerFields {
    $id: kintone.fieldTypes.Id;
    $revision: kintone.fieldTypes.Revision;
    // ...
  }
}
```

## 開発

```bash
# ビルド
yarn build

# テスト
yarn test

# ウォッチモード
yarn dev
```

## 関連プロジェクト

- [@kintone/dts-gen](https://github.com/kintone/js-sdk/tree/main/packages/dts-gen) - 型定義生成の本体
- [Gyuma](https://github.com/nicecai/gyuma) - kintone の OAuth 認証
- [gotenks](https://github.com/goqoo-on-kintone/gotenks) - kintone TypeScript 型を Go 型に変換

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
