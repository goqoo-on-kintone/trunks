# 拡張型生成（Extended Types）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `@kintone/dts-gen` が出力しないプロセス管理のステータス・アクション、ルックアップの `lookup` プロパティ、イベント型を補完する TypeScript ファイルを、dts-gen の出力の隣に生成する。

**Architecture:** dts-gen の出力はブラックボックスとして一切改変しない。`extended` が有効なアプリごとに `@kintone/rest-api-client` で `form/fields.json` と `app/status.json` を追加取得し、正規化した `AppMeta` を純関数のレンダラに渡してソース文字列を組み立てる。静的な型（`LookupText`、`DetailEvent` など）は生成せず、`@goqoo/trunks/types` サブパスから提供して生成ファイルに `import type` させる。

**Tech Stack:** TypeScript 5.7 / Node.js >= 20 / `@kintone/rest-api-client` ^6.2.1 / Jest + ts-jest（ESM）/ Commander.js

**設計ドキュメント:** [docs/superpowers/specs/2026-07-16-extended-types-design.md](../specs/2026-07-16-extended-types-design.md)

## Global Constraints

- 対象バージョンは **v2.0.0**（破壊的変更を含む）。`package.json` の `version` を `2.0.0` にする。
- コードコメントは日本語で書く。既存コードの慣習に従う。
- Prettier 設定はシングルクォート・120 文字/行（`.prettierrc.cjs`）。
- 全 import は ESM の拡張子付き（`./types.js` のように `.js` を付ける）。
- dts-gen の出力ファイルは**絶対に読まない・書き換えない**。
- `extended` のデフォルトは `true`。
- 生成ファイルが参照する dts-gen の型は `${config.namespace ?? 'kintone.types'}.Saved${pascalCase(appName)}Fields`。`kintone.types` を決め打ちしない。
- 非ゴール（実装しない）: サブテーブル内のルックアップ（警告のみ）、`CATEGORY` フィールド、`SINGLE_LINE_TEXT` / `NUMBER` 以外を基底とするルックアップ（警告のみ）。
- テストは `yarn test`（`NODE_OPTIONS='--experimental-vm-modules' jest`）で実行する。Task 1 で `jest.config.js` に `tsconfig: { isolatedModules: false }` を入れて以降、ts-jest が型チェックを行うため、型レベルの誤りはテスト失敗として現れる（それ以前は transpile のみで型は一切検証されない）。

## File Structure

| ファイル | 責務 |
| --- | --- |
| `src/kintone-types.ts` | **新規** 利用者向けの静的型。`@goqoo/trunks/types` として公開。HTTP もファイル I/O も持たない |
| `src/types.ts` | **変更** `AppConfig` / `DtsGenArgs` の追加と正規化ヘルパ |
| `src/client.ts` | **新規** `Config` + 解決済み認証引数 → rest-api-client のオプション / クライアント |
| `src/app-meta.ts` | **新規** API レスポンス → 正規化した `AppMeta`。レスポンス形式の吸収をここに閉じ込める |
| `src/render.ts` | **新規** `AppMeta` → ソース文字列。純関数 |
| `src/generate.ts` | **変更** dts-gen 実行後に extended フローを呼ぶ |
| `src/cli.ts` | **変更** `--no-extended` フラグ |
| `src/index.ts` | **変更** 新しい型のエクスポート |
| `package.json` | **変更** `exports` / `typesVersions` / 依存 / version 2.0.0 |

---

### Task 1: 静的型の提供と `@goqoo/trunks/types` サブパス

生成ファイルが `import type` する静的型を用意し、サブパスから公開する。この型は生成されず、trunks のバージョン更新で利用者へ伝播する。

**Files:**
- Create: `src/kintone-types.ts`
- Create: `test/kintone-types.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`（`kintone` グローバルの解決）
- Modify: `jest.config.js`（ts-jest の型検査を有効化）

**Interfaces:**
- Produces: `LookupText`, `LookupNumber`, `KintoneEvent`, `IndexEvent<T>`, `DetailEvent<T>`, `ProcessProceedEvent<T, U, V>` — すべて型のみ。Task 5 のレンダラがこれらの名前を文字列として出力する。

- [ ] **Step 1: 失敗するテストを書く**

`test/kintone-types.test.ts` を作成する。ts-jest が型チェックするので、これは実質的にコンパイル時テストとして機能する。`lookup` を省いたリテラルが通ることが「任意である」ことの検証になる。

```ts
import { describe, it, expect } from '@jest/globals';
import type { LookupText, LookupNumber, DetailEvent, IndexEvent, ProcessProceedEvent } from '../src/kintone-types';

type SampleStatus = '未申請' | '申請中';
type SampleAction = '申請する' | '取り下げる';
type SampleRecord = { 従業員コード: LookupText };

describe('kintone-types', () => {
  it('LookupTextはlookupを省略できる', () => {
    const field: LookupText = { type: 'SINGLE_LINE_TEXT', value: 'E-001' };
    expect(field.lookup).toBeUndefined();
  });

  it('LookupTextはlookupへの代入を許す', () => {
    const field: LookupText = { type: 'SINGLE_LINE_TEXT', value: 'E-001' };
    field.lookup = 'UPDATE';
    expect(field.lookup).toBe('UPDATE');
  });

  it('LookupNumberはNumberを基底に持つ', () => {
    const field: LookupNumber = { type: 'NUMBER', value: '1000', lookup: 'CLEAR' };
    expect(field.value).toBe('1000');
  });

  it('DetailEventはレコードを型引数で受ける', () => {
    const event: DetailEvent<SampleRecord> = {
      appId: 1,
      type: 'app.record.detail.show',
      recordId: 10,
      record: { 従業員コード: { type: 'SINGLE_LINE_TEXT', value: 'E-001' } },
    };
    expect(event.record.従業員コード.value).toBe('E-001');
  });

  it('IndexEventはレコード配列とビュー情報を持つ', () => {
    const event: IndexEvent<SampleRecord> = {
      appId: 1,
      type: 'app.record.index.show',
      records: [],
      viewType: 'list',
      viewId: 20,
      viewName: '一覧',
      offset: 0,
      size: 20,
      date: null,
    };
    expect(event.records).toHaveLength(0);
  });

  it('ProcessProceedEventはステータスとアクションをUnionで受ける', () => {
    const event: ProcessProceedEvent<SampleRecord, SampleStatus, SampleAction> = {
      appId: 1,
      type: 'app.record.detail.process.proceed',
      recordId: 10,
      record: { 従業員コード: { type: 'SINGLE_LINE_TEXT', value: 'E-001' } },
      action: { value: '申請する' },
      status: { value: '未申請' },
      nextStatus: { value: '申請中' },
    };
    expect(event.nextStatus.value).toBe('申請中');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `yarn test test/kintone-types.test.ts`
Expected: FAIL — `Cannot find module '../src/kintone-types'`

- [ ] **Step 3: 静的型を実装する**

`src/kintone-types.ts` を作成する。triple-slash directive は**書かない**。dts-gen が生成するファイル自身が `kintone.fieldTypes.*` を参照しつつ reference directive を持たないため、利用者は元々 `kintone.d.ts` を自分の tsconfig で読み込んでいる。同じ規約に従う（`kintone` グローバルの解決は Step 4 で trunks 自身のビルド向けに設定する）。

```ts
// ルックアップフィールド。dts-genはlookupプロパティを出力しないため、trunksが補完する。
// lookupは書き込み専用でAPIから取得したレコードには存在しないため任意とする。
export type LookupText = kintone.fieldTypes.SingleLineText & {
  lookup?: 'UPDATE' | 'CLEAR';
};

export type LookupNumber = kintone.fieldTypes.Number & {
  lookup?: 'UPDATE' | 'CLEAR';
};

// kintoneのイベントオブジェクト共通部分
export type KintoneEvent = {
  appId: number;
  type: string;
  error?: string;
};

// 一覧画面のイベント
export type IndexEvent<T> = KintoneEvent & {
  records: T[];
  viewType: 'list' | 'calendar' | 'custom';
  viewId: number;
  viewName: string;
  offset: number | null;
  size: number | null;
  date: string | null;
};

// 詳細画面のイベント
export type DetailEvent<T> = KintoneEvent & {
  record: T;
  recordId: number;
  reuse?: boolean;
};

// プロセス実行のイベント
export type ProcessProceedEvent<T, U, V> = DetailEvent<T> & {
  action: { value: V };
  status: { value: U };
  nextStatus: { value: U };
};
```

- [ ] **Step 4: `tsconfig.json` で `kintone` グローバルを解決させる**

この時点では `yarn build` が `TS2503: Cannot find namespace 'kintone'` で失敗する。trunks 自身のビルドに `kintone.d.ts` をプログラムへ含める必要がある。

`tsconfig.json` の `include` に `kintone.d.ts` を足し、`exclude` から `node_modules` を外す。`exclude` は `include` を後からフィルタするため、`node_modules` を除外したままだと `include` に書いても読み込まれない。

```json
  "include": ["src/**/*", "node_modules/@kintone/dts-gen/kintone.d.ts"],
  "exclude": ["dist"]
```

`rootDir: "src"` はそのままで良い。`.d.ts` は出力されないため `TS6059`（rootDir 外）にはならず、`dist/kintone-types.d.ts` は `dist` 直下に出力される。

Run: `yarn build`
Expected: エラーなく完了する

- [ ] **Step 5: ts-jest の型検査を有効にする**

この時点では `test/kintone-types.test.ts` は「通る」が、実は型を一切検証していない。`tsconfig.json` の `isolatedModules: true` を ts-jest が読み取り、transpile のみのモード（型診断なし）で動作するため。Step 1 のテストは型レベルの検証が目的なので、このままでは無意味なテストになる。

`jest.config.js` の transform オプションに tsconfig の上書きを足す。

```js
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        // tsconfigのisolatedModulesが有効だとts-jestは型検査を行わない。
        // テストで型の誤りを検出するため、テスト実行時のみ無効化する。
        tsconfig: { isolatedModules: false },
      },
    ],
```

型検査が実際に効くことを確認する。`test/__probe.test.ts` に `const x: number = 'string';` を含む使い捨てのテストを作り、`yarn test test/__probe.test.ts` が `error TS2322` で FAIL することを確かめてから削除する。**確認後、probe ファイルは必ず削除すること。**

- [ ] **Step 6: テストが通ることを確認する**

Run: `yarn test`
Expected: 全 PASS。`test/kintone-types.test.ts` は 6 テスト。既存テスト（`config` / `generate` / `types`）も型検査が有効になった状態で通ること。

既存テストが型エラーで落ちる場合は、そのエラー内容を報告すること（既存コードの型の問題を暴いた可能性があり、勝手に握り潰さない）。

- [ ] **Step 7: `package.json` にサブパスを追加する**

`exports` に `./types` を追加し、`typesVersions` を併記する。`typesVersions` は subpath exports が `moduleResolution: node16 / nodenext / bundler` でしか解決されないため必要で、旧 `"moduleResolution": "node"` のプロジェクト向けのフォールバックになる。

`package.json` の `exports` フィールドを以下に置き換える。

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./types": {
      "types": "./dist/kintone-types.d.ts",
      "import": "./dist/kintone-types.js"
    }
  },
  "typesVersions": {
    "*": {
      "types": [
        "dist/kintone-types.d.ts"
      ]
    }
  },
```

- [ ] **Step 8: 出力される型定義を確認する**

Run: `yarn build && head -8 dist/kintone-types.d.ts`
Expected: `export type LookupText = kintone.fieldTypes.SingleLineText & {` で始まり、reference directive は**含まれない**。これは dts-gen 自身の出力（`declare namespace kintone.types` で始まり directive を持たない）と同じ規約で、利用者側の `kintone.d.ts` 読み込みに委ねる形。

- [ ] **Step 9: コミット**

```bash
git add src/kintone-types.ts test/kintone-types.test.ts package.json tsconfig.json jest.config.js
git commit -m "feat: add static kintone types exposed via @goqoo/trunks/types"
```

---

### Task 2: `AppConfig` と正規化ヘルパ

`apps` の値をアプリごとの設定オブジェクトも取れるようにする。数値の短縮形は維持する。

**Files:**
- Modify: `src/types.ts:47-67`
- Modify: `test/config.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `export type AppConfig = number | { id: number; extended?: boolean }`
  - `export type NormalizedApp = { name: string; id: number; extended: boolean }`
  - `export function normalizeApps(apps: Record<string, AppConfig>): NormalizedApp[]`
  - `export type DtsGenArgs = Record<string, string | undefined>`（`src/generate.ts` のローカル定義から移設）

- [ ] **Step 1: 失敗するテストを書く**

`test/config.test.ts` の末尾に追記する。既存の `loadConfig` の describe はそのまま残す。

```ts
import { normalizeApps } from '../src/types';

describe('normalizeApps', () => {
  it('数値の短縮形をidに展開しextendedをtrueにする', () => {
    expect(normalizeApps({ expense: 123 })).toEqual([{ name: 'expense', id: 123, extended: true }]);
  });

  it('オブジェクト形式でextended未指定の場合はtrueにする', () => {
    expect(normalizeApps({ expense: { id: 123 } })).toEqual([{ name: 'expense', id: 123, extended: true }]);
  });

  it('extended: falseを尊重する', () => {
    expect(normalizeApps({ expense: { id: 123, extended: false } })).toEqual([
      { name: 'expense', id: 123, extended: false },
    ]);
  });

  it('短縮形とオブジェクト形式を混在できる', () => {
    expect(normalizeApps({ expense: 123, customer: { id: 456, extended: false } })).toEqual([
      { name: 'expense', id: 123, extended: true },
      { name: 'customer', id: 456, extended: false },
    ]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `yarn test test/config.test.ts`
Expected: FAIL — `normalizeApps` が `src/types` に存在しない

- [ ] **Step 3: `src/types.ts` を変更する**

`Config` 型の `apps` の行を差し替え、ファイル末尾（`defineConfig` の前）に追記する。

`apps: Record<string, number>; // { appName: appId }` を以下に置き換える。

```ts
  apps: Record<string, AppConfig>; // { appName: appId } または { appName: { id, extended } }
```

そして以下を追加する。

```ts
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
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `yarn test test/config.test.ts`
Expected: PASS（既存 2 + 新規 4 = 6 テスト）

- [ ] **Step 5: `src/generate.ts` のローカル `DtsGenArgs` を移設する**

`src/generate.ts:51` の `type DtsGenArgs = Record<string, string | undefined>;` を削除し、先頭の import に型を追加する。

`import type { AgentOptions, Config } from './types.js';` を以下に置き換える。

```ts
import type { AgentOptions, Config, DtsGenArgs } from './types.js';
```

- [ ] **Step 6: ビルドとテスト全体が通ることを確認する**

Run: `yarn build && yarn test`
Expected: ビルド成功、全テスト PASS

- [ ] **Step 7: コミット**

```bash
git add src/types.ts src/generate.ts test/config.test.ts
git commit -m "feat: support per-app config with extended flag"
```

---

### Task 3: rest-api-client のオプション構築

`buildAuthArgs` が解決済みの認証情報（OAuth トークン取得や対話入力を経た結果）を返すので、それを再利用してクライアントを組む。認証を二度解決しないことがこの設計の要点。

**Files:**
- Create: `src/client.ts`
- Create: `test/client.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `Config`, `DtsGenArgs`（Task 2）
- Produces:
  - `export type ClientOptions = { baseUrl: string; auth: {...}; basicAuth?: {...}; proxy?: {...}; guestSpaceId?: number; clientCertAuth?: {...} }`
  - `export function buildClientOptions(config: Config, authArgs: DtsGenArgs): ClientOptions`
  - `export function createClient(config: Config, authArgs: DtsGenArgs): KintoneRestAPIClient`

- [ ] **Step 1: 依存を追加する**

Run: `yarn add @kintone/rest-api-client`
Expected: `package.json` の `dependencies` に `"@kintone/rest-api-client": "^6.2.1"` が入る

- [ ] **Step 2: 失敗するテストを書く**

`test/client.test.ts` を作成する。`buildClientOptions` を純関数として切り出しているので、HTTP なしで検証できる。

```ts
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
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `yarn test test/client.test.ts`
Expected: FAIL — `Cannot find module '../src/client'`

- [ ] **Step 4: `src/client.ts` を実装する**

```ts
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
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `yarn test test/client.test.ts`
Expected: PASS（11 テスト）

- [ ] **Step 6: コミット**

```bash
git add src/client.ts test/client.test.ts package.json yarn.lock
git commit -m "feat: build kintone rest-api-client from resolved auth args"
```

---

### Task 4: アプリメタ情報の取得と正規化

API レスポンスの形式吸収をこのモジュールに閉じ込める。純関数 `toAppMeta` と薄い取得関数 `fetchAppMeta` に分け、前者だけをテストする。

**Files:**
- Create: `src/app-meta.ts`
- Create: `test/app-meta.test.ts`

**Interfaces:**
- Consumes: `createClient`（Task 3）
- Produces:
  - `export type LookupKind = 'LookupText' | 'LookupNumber'`
  - `export type LookupField = { code: string; kind: LookupKind }`
  - `export type AppMeta = { lookups: LookupField[]; statusFieldCode?: string; assigneeFieldCode?: string; states?: string[]; actions?: string[] }`
  - `export type RawField = { type: string; code: string; lookup?: unknown; fields?: Record<string, RawField> }`
  - `export type RawProcess = { enable: boolean; states?: Record<string, { name: string; index: string }> | null; actions?: Array<{ name: string }> | null }`
  - `export function toAppMeta(properties: Record<string, RawField>, process: RawProcess, appName: string): AppMeta`
  - `export function fetchAppMeta(client: KintoneRestAPIClient, appId: number, preview: boolean, appName: string): Promise<AppMeta>`

- [ ] **Step 1: 失敗するテストを書く**

`test/app-meta.test.ts` を作成する。フィクスチャは架空の経費申請アプリ。`却下する` が 2 つの遷移元から定義されているのは、アクション名の重複除去を検証するため。

```ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { toAppMeta } from '../src/app-meta';
import type { RawField, RawProcess } from '../src/app-meta';

const properties: Record<string, RawField> = {
  従業員コード: { type: 'SINGLE_LINE_TEXT', code: '従業員コード', lookup: { relatedApp: { app: '9' } } },
  金額: { type: 'NUMBER', code: '金額', lookup: { relatedApp: { app: '9' } } },
  備考: { type: 'SINGLE_LINE_TEXT', code: '備考' },
  ステータス: { type: 'STATUS', code: 'ステータス' },
  作業者: { type: 'STATUS_ASSIGNEE', code: '作業者' },
};

const process: RawProcess = {
  enable: true,
  states: {
    未申請: { name: '未申請', index: '0' },
    申請中: { name: '申請中', index: '1' },
    承認済み: { name: '承認済み', index: '2' },
    却下: { name: '却下', index: '3' },
  },
  actions: [
    { name: '申請する' },
    { name: '承認する' },
    { name: '却下する' },
    { name: '取り下げる' },
    { name: '却下する' },
  ],
};

describe('toAppMeta', () => {
  let warn: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('SINGLE_LINE_TEXTのルックアップをLookupTextとして検出する', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.lookups).toContainEqual({ code: '従業員コード', kind: 'LookupText' });
  });

  it('NUMBERのルックアップをLookupNumberとして検出する', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.lookups).toContainEqual({ code: '金額', kind: 'LookupNumber' });
  });

  it('ルックアップでないフィールドを検出しない', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.lookups.map((l) => l.code)).not.toContain('備考');
  });

  it('フィールド定義の並び順を保つ', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.lookups.map((l) => l.code)).toEqual(['従業員コード', '金額']);
  });

  it('STATUSフィールドのコードを拾う', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.statusFieldCode).toBe('ステータス');
  });

  it('STATUS_ASSIGNEEフィールドのコードを拾う', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.assigneeFieldCode).toBe('作業者');
  });

  it('英語ロケールのフィールドコードを拾う', () => {
    const englishProperties: Record<string, RawField> = {
      Status: { type: 'STATUS', code: 'Status' },
      Assignee: { type: 'STATUS_ASSIGNEE', code: 'Assignee' },
    };
    const meta = toAppMeta(englishProperties, process, 'expense');
    expect(meta.statusFieldCode).toBe('Status');
    expect(meta.assigneeFieldCode).toBe('Assignee');
  });

  it('ステータスをindexの昇順で返す', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.states).toEqual(['未申請', '申請中', '承認済み', '却下']);
  });

  it('indexを数値として比較する', () => {
    const manyStates: RawProcess = {
      enable: true,
      states: {
        s0: { name: 's0', index: '0' },
        s2: { name: 's2', index: '2' },
        s10: { name: 's10', index: '10' },
      },
      actions: [],
    };
    const meta = toAppMeta(properties, manyStates, 'expense');
    expect(meta.states).toEqual(['s0', 's2', 's10']);
  });

  it('アクション名を出現順を保って重複除去する', () => {
    const meta = toAppMeta(properties, process, 'expense');
    expect(meta.actions).toEqual(['申請する', '承認する', '却下する', '取り下げる']);
  });

  it('プロセス管理が無効な場合はstatesとactionsを持たない', () => {
    const disabled: RawProcess = { enable: false, states: null, actions: null };
    const meta = toAppMeta(properties, disabled, 'expense');
    expect(meta.states).toBeUndefined();
    expect(meta.actions).toBeUndefined();
  });

  it('プロセス管理が無効でもルックアップは検出する', () => {
    const disabled: RawProcess = { enable: false, states: null, actions: null };
    const meta = toAppMeta(properties, disabled, 'expense');
    expect(meta.lookups).toHaveLength(2);
  });

  it('非対応の基底型のルックアップは警告して無視する', () => {
    const linkLookup: Record<string, RawField> = {
      サイト: { type: 'LINK', code: 'サイト', lookup: { relatedApp: { app: '9' } } },
    };
    const meta = toAppMeta(linkLookup, process, 'expense');
    expect(meta.lookups).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('サイト'));
  });

  it('サブテーブル内のルックアップは警告して無視する', () => {
    const withSubtable: Record<string, RawField> = {
      明細: {
        type: 'SUBTABLE',
        code: '明細',
        fields: {
          商品コード: { type: 'SINGLE_LINE_TEXT', code: '商品コード', lookup: { relatedApp: { app: '9' } } },
        },
      },
    };
    const meta = toAppMeta(withSubtable, process, 'expense');
    expect(meta.lookups).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('明細'));
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `yarn test test/app-meta.test.ts`
Expected: FAIL — `Cannot find module '../src/app-meta'`

- [ ] **Step 3: `src/app-meta.ts` を実装する**

rest-api-client の型をそのまま使わず、自前の最小構造型 `RawField` / `RawProcess` を境界に置いてキャストする。API レスポンスの形式に依存する部分をこのモジュールだけに閉じ込めるため。

```ts
import chalk from 'chalk';
import type { KintoneRestAPIClient } from '@kintone/rest-api-client';

export type LookupKind = 'LookupText' | 'LookupNumber';

export type LookupField = {
  code: string;
  kind: LookupKind;
};

export type AppMeta = {
  lookups: LookupField[];
  statusFieldCode?: string;
  assigneeFieldCode?: string;
  states?: string[];
  actions?: string[];
};

// APIレスポンスの最小構造型。rest-api-clientの型に依存しないよう境界で受ける。
export type RawField = {
  type: string;
  code: string;
  lookup?: unknown;
  fields?: Record<string, RawField>;
};

export type RawProcess = {
  enable: boolean;
  states?: Record<string, { name: string; index: string }> | null;
  actions?: Array<{ name: string }> | null;
};

// ルックアップの基底型と生成する型名の対応。これ以外の基底型は非対応。
const LOOKUP_KIND_BY_TYPE: Record<string, LookupKind> = {
  SINGLE_LINE_TEXT: 'LookupText',
  NUMBER: 'LookupNumber',
};

// フィールド定義とプロセス管理設定を正規化する
export function toAppMeta(properties: Record<string, RawField>, process: RawProcess, appName: string): AppMeta {
  const meta: AppMeta = { lookups: collectLookups(properties, appName) };

  for (const field of Object.values(properties)) {
    if (field.type === 'STATUS') meta.statusFieldCode = field.code;
    if (field.type === 'STATUS_ASSIGNEE') meta.assigneeFieldCode = field.code;
  }

  if (process.enable && process.states) {
    meta.states = Object.values(process.states)
      .sort((a, b) => Number(a.index) - Number(b.index))
      .map((state) => state.name);
    // 異なる遷移元から同名のアクションが定義されうるため、出現順を保って重複を除去する
    meta.actions = [...new Set((process.actions ?? []).map((action) => action.name))];
  }

  return meta;
}

function collectLookups(properties: Record<string, RawField>, appName: string): LookupField[] {
  const lookups: LookupField[] = [];

  for (const field of Object.values(properties)) {
    if (field.type === 'SUBTABLE') {
      warnSubtableLookups(field, appName);
      continue;
    }

    if (field.lookup === undefined) continue;

    const kind = LOOKUP_KIND_BY_TYPE[field.type];
    if (!kind) {
      console.warn(
        chalk.yellow(
          `Warning [${appName}]: lookup field "${field.code}" has unsupported base type ${field.type}. Skipped.`
        )
      );
      continue;
    }

    lookups.push({ code: field.code, kind });
  }

  // 並べ替えずフィールド定義の順序を保つ。APIはフォームの配置順で返すため、
  // 生成結果がアプリの見た目と対応し、再実行時の差分も安定する。
  return lookups;
}

// サブテーブル内のルックアップは交差型で差し替えられないため対象外
function warnSubtableLookups(subtable: RawField, appName: string): void {
  const hasLookup = Object.values(subtable.fields ?? {}).some((field) => field.lookup !== undefined);
  if (hasLookup) {
    console.warn(
      chalk.yellow(
        `Warning [${appName}]: lookup fields inside subtable "${subtable.code}" are not supported. Skipped.`
      )
    );
  }
}

// フィールド定義とプロセス管理設定を取得して正規化する
export async function fetchAppMeta(
  client: KintoneRestAPIClient,
  appId: number,
  preview: boolean,
  appName: string
): Promise<AppMeta> {
  const [form, process] = await Promise.all([
    client.app.getFormFields({ app: appId, preview }),
    client.app.getProcessManagement({ app: appId, preview }),
  ]);

  return toAppMeta(
    form.properties as unknown as Record<string, RawField>,
    process as unknown as RawProcess,
    appName
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `yarn test test/app-meta.test.ts`
Expected: PASS（14 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/app-meta.ts test/app-meta.test.ts
git commit -m "feat: fetch and normalize lookup and process management metadata"
```

---

### Task 5: ソース文字列の生成

`AppMeta` からファイルの中身を組み立てる純関数。HTTP もファイル I/O も持たないので、生成結果を直接検証できる。

**Files:**
- Create: `src/render.ts`
- Create: `test/render.test.ts`

**Interfaces:**
- Consumes: `AppMeta`, `LookupField`（Task 4）
- Produces: `export function renderExtendedTypes(appName: string, meta: AppMeta, namespace: string): string`

- [ ] **Step 1: 失敗するテストを書く**

`test/render.test.ts` を作成する。

```ts
import { describe, it, expect } from '@jest/globals';
import { renderExtendedTypes } from '../src/render';
import type { AppMeta } from '../src/app-meta';

const fullMeta: AppMeta = {
  lookups: [{ code: '従業員コード', kind: 'LookupText' }],
  statusFieldCode: 'ステータス',
  assigneeFieldCode: '作業者',
  states: ['未申請', '申請中', '承認済み', '却下'],
  actions: ['申請する', '承認する', '却下する', '取り下げる'],
};

describe('renderExtendedTypes', () => {
  it('ステータスのUnion型を出力する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain(
      "export type ExpenseStatus = '未申請' | '申請中' | '承認済み' | '却下';"
    );
  });

  it('アクションのUnion型を出力する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain(
      "export type ExpenseAction = '申請する' | '承認する' | '却下する' | '取り下げる';"
    );
  });

  it('dts-genのSaved型を交差型の基底にする', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain('export type ExpenseRecord = kintone.types.SavedExpenseFields & {');
  });

  it('namespace設定を反映する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'my.ns');
    expect(source).toContain('my.ns.SavedExpenseFields');
    expect(source).not.toContain('kintone.types.SavedExpenseFields');
  });

  it('ケバブケースのアプリ名をパスカルケースの型名にする', () => {
    const source = renderExtendedTypes('expense-report', fullMeta, 'kintone.types');
    expect(source).toContain('export type ExpenseReportStatus =');
    expect(source).toContain('kintone.types.SavedExpenseReportFields');
  });

  it('ルックアップフィールドに型を当てる', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain('従業員コード: LookupText;');
  });

  it('ステータスと作業者のフィールドを追加する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain("ステータス: { type: 'STATUS'; value: ExpenseStatus };");
    expect(source).toContain(
      "作業者: { type: 'STATUS_ASSIGNEE'; value: { code: string; name: string }[] };"
    );
  });

  it('イベント型のエイリアスを出力する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain('export type ExpenseDetailEvent = DetailEvent<ExpenseRecord>;');
    expect(source).toContain('export type ExpenseIndexEvent = IndexEvent<ExpenseRecord>;');
    expect(source).toContain(
      'export type ExpenseProceedEvent = ProcessProceedEvent<ExpenseRecord, ExpenseStatus, ExpenseAction>;'
    );
  });

  it('使う型だけをimportする', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source).toContain(
      "import type { LookupText, DetailEvent, IndexEvent, ProcessProceedEvent } from '@goqoo/trunks/types';"
    );
    expect(source).not.toContain('LookupNumber');
  });

  it('LookupNumberを使う場合はimportに含める', () => {
    const meta: AppMeta = { ...fullMeta, lookups: [{ code: '金額', kind: 'LookupNumber' }] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain('LookupNumber');
    expect(source).not.toContain('LookupText,');
  });

  it('プロセス管理が無効な場合はStatus・Action・ProceedEventを出力しない', () => {
    const meta: AppMeta = { lookups: [{ code: '従業員コード', kind: 'LookupText' }] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).not.toContain('ExpenseStatus');
    expect(source).not.toContain('ExpenseAction');
    expect(source).not.toContain('ProcessProceedEvent');
    expect(source).toContain('export type ExpenseRecord = kintone.types.SavedExpenseFields & {');
    expect(source).toContain('export type ExpenseDetailEvent = DetailEvent<ExpenseRecord>;');
  });

  it('自動生成であることを先頭に明記する', () => {
    const source = renderExtendedTypes('expense', fullMeta, 'kintone.types');
    expect(source.startsWith('// このファイルは @goqoo/trunks により自動生成されました。')).toBe(true);
  });

  it('数字始まりのフィールドコードを引用符で囲む', () => {
    // kintoneはフィールドコードの先頭に数字を許すが、TSの識別子としては不正
    const meta: AppMeta = { lookups: [{ code: '2026年度予算', kind: 'LookupNumber' }] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain("'2026年度予算': LookupNumber;");
  });

  it('日本語や中黒を含むフィールドコードは引用符で囲まない', () => {
    // 日本語も「・」もID_Start/ID_Continueに含まれるため識別子として書ける
    const meta: AppMeta = { lookups: [{ code: '商品・コード', kind: 'LookupText' }] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain('商品・コード: LookupText;');
    expect(source).not.toContain("'商品・コード'");
  });

  it('シングルクォートを含むステータス名をエスケープする', () => {
    const meta: AppMeta = { ...fullMeta, states: ["it's done"], actions: ['finish'] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain("export type ExpenseStatus = 'it\\'s done';");
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `yarn test test/render.test.ts`
Expected: FAIL — `Cannot find module '../src/render'`

- [ ] **Step 3: `src/render.ts` を実装する**

```ts
import { pascalCase } from 'change-case';
import type { AppMeta } from './app-meta.js';

const HEADER = '// このファイルは @goqoo/trunks により自動生成されました。直接編集しないでください。';

// TSの識別子として使える文字列か判定する。
// kintoneのフィールドコードは日本語も「・」も許し、これらはID_Start/ID_Continueに
// 含まれるためそのまま書ける。一方フィールドコードは数字始まりを許すため
// （例: 2026年度予算）、その場合は引用符で囲む必要がある。
const IDENTIFIER_PATTERN = /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;

function propKey(code: string): string {
  return IDENTIFIER_PATTERN.test(code) ? code : `'${escapeSingleQuotes(code)}'`;
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toUnion(values: string[]): string {
  return values.map((value) => `'${escapeSingleQuotes(value)}'`).join(' | ');
}

// AppMetaから拡張型定義のソースを組み立てる
export function renderExtendedTypes(appName: string, meta: AppMeta, namespace: string): string {
  const prefix = pascalCase(appName);
  const hasProcess = meta.states !== undefined && meta.actions !== undefined && meta.statusFieldCode !== undefined;

  const imports = buildImports(meta, hasProcess);
  const blocks: string[] = [HEADER, '', `import type { ${imports.join(', ')} } from '@goqoo/trunks/types';`, ''];

  if (hasProcess) {
    blocks.push(`export type ${prefix}Status = ${toUnion(meta.states!)};`, '');
    blocks.push(`export type ${prefix}Action = ${toUnion(meta.actions!)};`, '');
  }

  blocks.push(...buildRecord(prefix, meta, namespace, hasProcess));

  blocks.push(`export type ${prefix}DetailEvent = DetailEvent<${prefix}Record>;`);
  blocks.push(`export type ${prefix}IndexEvent = IndexEvent<${prefix}Record>;`);
  if (hasProcess) {
    blocks.push(
      `export type ${prefix}ProceedEvent = ProcessProceedEvent<${prefix}Record, ${prefix}Status, ${prefix}Action>;`
    );
  }

  return `${blocks.join('\n')}\n`;
}

function buildImports(meta: AppMeta, hasProcess: boolean): string[] {
  const imports: string[] = [];
  if (meta.lookups.some((lookup) => lookup.kind === 'LookupText')) imports.push('LookupText');
  if (meta.lookups.some((lookup) => lookup.kind === 'LookupNumber')) imports.push('LookupNumber');
  imports.push('DetailEvent', 'IndexEvent');
  if (hasProcess) imports.push('ProcessProceedEvent');
  return imports;
}

function buildRecord(prefix: string, meta: AppMeta, namespace: string, hasProcess: boolean): string[] {
  const lines = [`export type ${prefix}Record = ${namespace}.Saved${prefix}Fields & {`];

  for (const lookup of meta.lookups) {
    lines.push(`  ${propKey(lookup.code)}: ${lookup.kind};`);
  }

  if (hasProcess) {
    lines.push(`  ${propKey(meta.statusFieldCode!)}: { type: 'STATUS'; value: ${prefix}Status };`);
  }

  if (meta.assigneeFieldCode) {
    lines.push(
      `  ${propKey(meta.assigneeFieldCode)}: { type: 'STATUS_ASSIGNEE'; value: { code: string; name: string }[] };`
    );
  }

  lines.push('};', '');
  return lines;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `yarn test test/render.test.ts`
Expected: PASS（15 テスト）

- [ ] **Step 5: コミット**

```bash
git add src/render.ts test/render.test.ts
git commit -m "feat: render extended type definitions from app metadata"
```

---

### Task 6: `generate` への組み込み

dts-gen の実行ループを `normalizeApps` ベースに置き換え、`extended` なアプリで追加ファイルを書き出す。

**Files:**
- Modify: `src/generate.ts:222-345`

**Interfaces:**
- Consumes: `normalizeApps`（Task 2）、`createClient`（Task 3）、`fetchAppMeta`（Task 4）、`renderExtendedTypes`（Task 5）
- Produces: なし（`generate` のシグネチャは `(config: Config) => Promise<void>` のまま変わらない）

- [ ] **Step 1: import を追加する**

`src/generate.ts` の import 群に以下を足す。

```ts
import { writeFileSync } from 'fs';
import type { KintoneRestAPIClient } from '@kintone/rest-api-client';
import { normalizeApps } from './types.js';
import { createClient } from './client.js';
import { fetchAppMeta } from './app-meta.js';
import { renderExtendedTypes } from './render.js';
```

既存の `import { mkdirSync } from 'fs';` は `import { mkdirSync, writeFileSync } from 'fs';` にまとめる。

- [ ] **Step 2: 拡張型を生成する関数を追加する**

`generateForApp` の直後に追加する。エラーは投げずに `false` を返し、既存の失敗集計に合流させる。

クライアントは引数で受け取る。`clientCertAuth` を指定すると rest-api-client が構築時に pfx ファイルを読むため、アプリごとに生成するとアプリ数だけファイル I/O が走る。生成は Step 3 でループの外に一度だけ置く。

```ts
// 単一アプリの拡張型定義を生成
async function generateExtendedForApp(
  client: KintoneRestAPIClient,
  app: { name: string; id: number },
  config: Config,
  outDir: string,
  debug: boolean
): Promise<boolean> {
  const outputPath = `${outDir}/${kebabCase(app.name)}.ts`;

  try {
    const meta = await fetchAppMeta(client, app.id, config.preview === true, app.name);
    const source = renderExtendedTypes(app.name, meta, config.namespace ?? 'kintone.types');
    writeFileSync(outputPath, source, 'utf-8');
    console.info(`${chalk.cyan('info')} ${chalk.magenta('Created')} ${chalk.green(outputPath)}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const kintoneError = extractKintoneError(message);
    if (kintoneError) {
      console.error(chalk.red(`Error [${app.name}]:`), kintoneError.message);
      console.error(chalk.gray(`  code: ${kintoneError.code}, id: ${kintoneError.id}`));
    } else {
      console.error(chalk.red(`Error [${app.name}]:`), message);
    }
    console.error(chalk.gray(`  Hint: set "extended: false" for this app to skip extended type generation.`));

    if (debug && error instanceof Error) {
      console.error(chalk.gray('Stack:'), error.stack);
    }
    return false;
  }
}
```

- [ ] **Step 3: `generate` のループを差し替える**

`generate` 関数の中の `const apps = Object.entries(config.apps);` を以下に置き換える。

```ts
  const apps = normalizeApps(config.apps);

  // 拡張型を生成するアプリがある場合のみ、クライアントを一度だけ作る。
  // 生成に失敗しても dts-gen の実行は続け、拡張型だけを諦める。
  let client: KintoneRestAPIClient | undefined;
  if (apps.some((app) => app.extended)) {
    try {
      client = createClient(config, authArgs);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      console.error(chalk.gray('  Skipping extended type generation for all apps.'));
    }
  }
```

そして `for (const [appName, appId] of apps) { ... }` のループ全体を以下に置き換える。

```ts
  for (const app of apps) {
    const result = await generateForApp(app.name, app.id, config, authArgs, outDir, debug);
    results.push(result);

    // 成功したファイルをPrettierでフォーマット
    if (result.success && usePrettier) {
      await formatWithPrettier(result.output);
    }

    // dts-genが失敗したアプリでは拡張型も生成しない（基底のSaved*Fields型が存在しないため）
    if (!result.success || !app.extended) continue;

    const extendedPath = `${outDir}/${kebabCase(app.name)}.ts`;
    if (!client) {
      results.push({ success: false, output: extendedPath });
      continue;
    }

    const extendedOk = await generateExtendedForApp(client, app, config, outDir, debug);
    results.push({ success: extendedOk, output: extendedPath });

    if (extendedOk && usePrettier) {
      await formatWithPrettier(extendedPath);
    }
  }
```

`generateForApp` の第 1・第 2 引数は既存のまま `appName: string, appId: number` なので、`app.name` / `app.id` を渡す。

- [ ] **Step 4: ビルドとテスト全体が通ることを確認する**

Run: `yarn build && yarn test`
Expected: ビルド成功、全テスト PASS

- [ ] **Step 5: コミット**

```bash
git add src/generate.ts
git commit -m "feat: generate extended types alongside dts-gen output"
```

---

### Task 7: CLI の `--no-extended` と公開エクスポート

CLI ワンライナーモード（`--host` + `--app`）には設定ファイルがないため、拡張型を切る手段がない。全アプリ一括の `--no-extended` を足す。

**Files:**
- Modify: `src/cli.ts:39-98`、`src/cli.ts:144-169`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `AppConfig`, `NormalizedApp`, `normalizeApps`（Task 2）
- Produces: なし

- [ ] **Step 1: `src/index.ts` に新しい型を足す**

`export type { ... } from './types.js';` のリストに `AppConfig` と `NormalizedApp` を追加し、`normalizeApps` を値としてエクスポートする。

```ts
export { defineConfig, normalizeApps } from './types.js';
export type {
  Config,
  AppConfig,
  NormalizedApp,
  Auth,
  PasswordAuth,
  OAuthAuth,
  ApiTokenAuth,
  ProxyConfig,
  BasicAuthConfig,
  PfxConfig,
  AgentOptions,
} from './types.js';
export { loadConfig } from './config.js';
export { generate } from './generate.js';
```

`src/kintone-types.ts` の型はここから再エクスポートしない。ルートは Node CLI 向けの型グラフで、`@goqoo/trunks/types` はブラウザで動くカスタマイズ向けという分離を保つため。

- [ ] **Step 2: `buildConfigFromOptions` に `extended` を通す**

`buildConfigFromOptions` の引数の型に `extended?: boolean;` を追加し（`format?: boolean;` の下）、`config` の組み立て後に以下を足す。

```ts
  // --no-extended が指定された場合は全アプリで拡張型生成を無効にする
  if (options.extended === false) {
    config.apps = Object.fromEntries(
      Object.entries(options.app).map(([name, id]) => [name, { id, extended: false }])
    );
  }
```

`generateAction` の引数の型にも `extended?: boolean;` を追加する。

- [ ] **Step 3: Commander にフラグを足す**

`.option('-f, --format', 'Format output with Prettier')` の下に追加する。Commander は `--no-x` 形式のフラグを `options.x` のデフォルト `true` として扱う。

```ts
  .option('--no-extended', 'Skip extended type generation (status, action, lookup, event types)')
```

- [ ] **Step 4: ビルドしてヘルプに出ることを確認する**

Run: `yarn build && node dist/cli.js --help`
Expected: 出力に `--no-extended  Skip extended type generation (status, action, lookup, event types)` が含まれる

- [ ] **Step 5: テスト全体が通ることを確認する**

Run: `yarn test`
Expected: 全テスト PASS

- [ ] **Step 6: コミット**

```bash
git add src/cli.ts src/index.ts
git commit -m "feat: add --no-extended flag and export app config types"
```

---

### Task 8: ドキュメントと v2.0.0

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.ja.md`

**Interfaces:**
- Consumes: すべて
- Produces: なし

- [ ] **Step 1: バージョンを上げる**

`package.json` の `"version": "1.2.0"` を `"version": "2.0.0"` にする。

- [ ] **Step 2: `README.ja.md` に節を追加する**

設定リファレンスの `apps` の説明を更新し、拡張型生成の節を追加する。既存の文体と見出しレベルに合わせること。以下を含める。

- `apps` が `Record<string, number | { id: number; extended?: boolean }>` になったこと
- `extended` のデフォルトが `true` であること
- 生成される型の一覧（`XxxStatus` / `XxxAction` / `XxxRecord` / `XxxDetailEvent` / `XxxIndexEvent` / `XxxProceedEvent`）
- 利用例:

```ts
import type { ExpenseDetailEvent, ExpenseProceedEvent } from './dts/expense';

kintone.events.on('app.record.detail.process.proceed', (event: ExpenseProceedEvent) => {
  if (event.nextStatus.value === '承認済み') {
    event.record.金額.lookup = 'UPDATE';
  }
  return event;
});
```

- v1 からの移行: 挙動を変えたくない場合は各アプリに `extended: false` を指定する
- 制約: サブテーブル内のルックアップ、`SINGLE_LINE_TEXT` / `NUMBER` 以外を基底とするルックアップは非対応
- `/k/v1/app/status.json` はアプリ管理権限を要求するため、API トークンの権限が足りない場合は `extended: false` で回避できること
- 生成されたファイルは実行のたびに上書きされるため、手で足したい型は別ファイルに置いて交差型で合成すること

- [ ] **Step 3: `README.md` に同じ内容を英語で追加する**

`README.ja.md` と同じ構成で英語版を更新する。

- [ ] **Step 4: ビルドとテスト全体が通ることを確認する**

Run: `yarn build && yarn test`
Expected: ビルド成功、全テスト PASS

- [ ] **Step 5: Prettier をかける**

**`yarn prettier --write .` を素で実行してはいけない。** `.prettierrc.cjs` は `singleQuote: false` を宣言しているが、コードベース全体がシングルクォートで書かれており、既存ファイルは未変更のまま `prettier --check` に落ちる。素で実行するとこのブランチと無関係なファイルまで全部ダブルクォートに書き換わる。

このブランチが触ったファイルだけを対象にする。

Run: `npx prettier --write $(git diff --name-only $(git merge-base main HEAD) HEAD -- '*.ts' '*.js' '*.json' | tr '\n' ' ')`
Expected: このブランチのファイルのみ整形される

`.prettierrc.cjs` 自体の扱いは別途判断する（このタスクの担当外）。

- [ ] **Step 6: コミット**

```bash
git add package.json README.md README.ja.md
git commit -m "docs: document extended types and bump to v2.0.0"
```

---

## 実装後の検証項目

設計ドキュメントのリスク節に対応する。Task 8 完了後、以下を人手で確認する（自動テストでは担保できない）。

1. **type reference directive の伝播** — Task 1 Step 6 で確認済み。改めて `dist/kintone-types.d.ts` の 1 行目を見る。
2. **実環境での生成** — 実際の kintone 環境に対して `yarn build && node dist/cli.js` を実行し、生成された `dts/*.ts` が `tsc --noEmit` で型エラーなく通ることを確認する。プロセス管理が有効なアプリと無効なアプリの両方で試す。
3. **`typesVersions` による旧 moduleResolution での解決** — `"moduleResolution": "node"` の tsconfig を持つ小さなプロジェクトを作り、`@goqoo/trunks/types` から `import type { DetailEvent }` が解決することを確認する。
4. **`status.json` の権限不足** — アプリ管理権限のない API トークンで実行し、エラーメッセージと `extended: false` の案内が出ることを確認する。
