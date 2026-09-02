# Trunks

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](/README.md) | 日本語

[@kintone/dts-gen](https://github.com/kintone/js-sdk/tree/main/packages/dts-gen) のラッパー CLI ツール。設定ファイル1つで複数の kintone アプリの TypeScript 型定義を一括生成します。

## 特徴

- 1コマンドで複数アプリの型定義を生成
- アプリごとの拡張型生成：ステータス・アクションの Union 型、ルックアップ対応の Record 型、イベント型エイリアス（デフォルトで有効）
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
   - `dts/customer-fields.d.ts`, `dts/customer.ts`
   - `dts/order-fields.d.ts`, `dts/order.ts`
   - `dts/product-fields.d.ts`, `dts/product.ts`

   `.ts` ファイルはアプリごとにデフォルトで生成される拡張型です。詳細は後述の [拡張型生成](#拡張型生成) を参照してください。

## 設定

### 基本設定

```typescript
import { defineConfig } from '@goqoo/trunks';

export default defineConfig({
  // 必須
  host: 'your-subdomain.cybozu.com',
  apps: {
    customer: 123,                        // { id: 123 } の短縮形
    order: { id: 456, extended: false },  // このアプリだけ拡張型生成を無効化
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

`apps` の型は `Record<string, number | { id: number; extended?: boolean }>` です。数値のみの短縮形は `{ id, extended: true }` と同じ意味になります。`extended` のデフォルトは `true` です。何が生成されるかは後述の [拡張型生成](#拡張型生成) を参照してください。

### 認証方式

環境変数はプロジェクトルートの `.env` ファイルに設定できます：

```bash
# .env
KINTONE_USERNAME=your-username
KINTONE_PASSWORD=your-password
KINTONE_API_TOKEN=your-api-token
```

`~/.netrc` に認証情報を保存することもできます：

```
machine example.cybozu.com
  login your-username
  password your-password
  account basic-user:basic-password
```

> **注意**: 設定ファイルに認証情報を直書きする場合は、設定ファイルを `.gitignore` に追加して、バージョン管理に機密情報がコミットされないようにしてください。環境変数（`.env` ファイル）、`~/.netrc`、または標準入力の使用を推奨します。

#### パスワード

認証情報は設定ファイル、`~/.netrc`、環境変数 `KINTONE_USERNAME` と `KINTONE_PASSWORD`、または標準入力から取得します（この優先順位）。

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
  --no-extended                     拡張型生成をスキップ（ステータス・アクション・ルックアップ・イベント型）
  -d, --debug                       エラー時に詳細情報を表示
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

## 拡張型生成

アプリごとのデフォルト設定（`extended: true`）では、dts-gen の出力に加えて `dts/<app>.ts` も生成されます。これは `@kintone/dts-gen` が出力しない情報を補うものです：プロセス管理のステータス・アクション、ルックアップの `lookup` 書き込みプロパティ、イベントオブジェクトの型。共通の補助型は `@goqoo/trunks/types` からインポートされます。

### 生成される型

接頭辞は `PascalCase(appName)`（例: `expense` → `Expense`）です。

- `<Prefix>Status` — ステータス名の Union 型。アプリが `STATUS` フィールドを持ち、かつプロセス管理が有効でステータスが1件以上ある場合のみ生成
- `<Prefix>Action` — アクション名の Union 型。プロセス管理が有効でアクションが1件以上ある場合のみ生成
- `<Prefix>Record` — 常に生成。`<namespace>.Saved<Prefix>Fields`（dts-gen の出力）にルックアップフィールドとプロセス管理フィールド（`STATUS` / `STATUS_ASSIGNEE`）を交差させた型
- `<Prefix>DetailEvent` — 常に生成。詳細画面のイベント型
- `<Prefix>IndexEvent` — 常に生成。一覧画面のイベント型
- `<Prefix>ProceedEvent` — `<Prefix>Status` と `<Prefix>Action` の両方が生成される場合のみ生成。プロセス実行のイベント型

プロセス管理が無効なアプリでは `<Prefix>Record` / `<Prefix>DetailEvent` / `<Prefix>IndexEvent` のみが生成され、`Status` / `Action` / `ProceedEvent` は生成されません。

### 利用例

架空の経費申請アプリ（`apps: { expense: 123 }`）に、ルックアップフィールドとプロセス管理があるとします。

```ts
// dts/expense.ts（生成されたファイル）
import type { LookupNumber, DetailEvent, IndexEvent, ProcessProceedEvent } from '@goqoo/trunks/types';

export type ExpenseStatus = '未申請' | '申請中' | '承認済み' | '却下';

export type ExpenseAction = '申請する' | '承認する' | '却下する' | '取り下げる';

export type ExpenseRecord = kintone.types.SavedExpenseFields & {
  金額: LookupNumber;
  ステータス: { type: 'STATUS'; value: ExpenseStatus };
  作業者: { type: 'STATUS_ASSIGNEE'; value: { code: string; name: string }[] };
};

export type ExpenseDetailEvent = DetailEvent<ExpenseRecord>;
export type ExpenseIndexEvent = IndexEvent<ExpenseRecord>;
export type ExpenseProceedEvent = ProcessProceedEvent<ExpenseRecord, ExpenseStatus, ExpenseAction>;
```

カスタマイズ側での利用：

```ts
import type { ExpenseDetailEvent, ExpenseProceedEvent } from './dts/expense';

kintone.events.on('app.record.detail.process.proceed', (event: ExpenseProceedEvent) => {
  if (event.nextStatus.value === '承認済み') {
    event.record.金額.lookup = 'UPDATE';
  }
  return event;
});
```

`event.nextStatus.value` は `ExpenseStatus` に絞り込まれ、`.lookup = 'UPDATE'` はルックアップフィールドに対してのみ型チェックを通過します。

### 制約

- **サブテーブル内のルックアップは非対応です。** 検出すると警告を出してスキップし、そのフィールドは dts-gen 出力そのままの型になります。
- **ルックアップの基底型は `SINGLE_LINE_TEXT` / `NUMBER` のみ対応です。** それ以外の基底型（`LINK`、`DATE` など）は警告を出してスキップします。
- プロセス管理設定の取得（`GET /k/v1/app/status.json`）にはアプリ管理権限が必要です。API トークンにこの権限がない場合、そのアプリの拡張型生成だけが失敗します（他のアプリの処理は継続されます）。回避するにはそのアプリに `extended: false` を指定してください。
- `dts/<app>.ts` は実行のたびに全体が上書きされます。手で追加したい型は別ファイルに置き、交差型で合成してください。生成ファイル自体は編集しないでください。

```ts
// dts/expense-extra.ts（手書き、上書きされない）
import type { ExpenseRecord } from './expense';

export type MyExpenseRecord = ExpenseRecord & {
  // 独自の追加分
};
```

### v1 からの移行

拡張型生成は v2.0.0 の新機能で、全アプリでデフォルト有効です。v1.x の挙動（dts-gen の出力のみ、`dts/<app>.ts` は生成しない）を維持したい場合は、アプリごとに `extended: false` を指定してください。

```typescript
apps: {
  customer: { id: 123, extended: false },
  order: { id: 456, extended: false },
},
```

CLI のワンライナー実行（`--host` / `--app`）では `--no-extended` フラグで同様に無効化できます。

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
- [Gotenks](https://github.com/goqoo-on-kintone/gotenks) - kintone TypeScript 型を Go 型に変換

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
