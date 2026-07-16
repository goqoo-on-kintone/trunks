# 拡張型生成（Extended Types）設計

- 日付: 2026-07-16
- 対象バージョン: `@goqoo/trunks` v2.0.0（破壊的変更を含む）

## 背景

`@kintone/dts-gen` は `/k/v1/app/form/fields.json` を読んでフィールドの型定義を生成するが、以下の情報を出力しない。

1. **プロセス管理のステータス・アクション** — `STATUS` / `STATUS_ASSIGNEE` はどの型リストにも含まれず（`dist/converters/fileldtype-converter.js` の `SIMPLE_VALUE_TYPES` 他を参照）、生成される `Fields` 型から黙って脱落する。
2. **ルックアップの `lookup` 書き込みプロパティ** — 同ファイルの `excludeLookupOrRelatedRecord` は `relatedApp` を**トップレベル**で探すが、`fields.json` のルックアップは `lookup: { relatedApp: ... }` と入れ子なのでフィルタが素通りする。結果ルックアップは素の `SingleLineText` / `Number` として出力され、`lookup` プロパティは付かない。
3. **イベントオブジェクトの型** — dts-gen の守備範囲外。

いずれも利用者がアプリのコード側で手書きして補っているのが現状。trunks は設定ファイルに host・認証・appId を既に持っており、追加の API を叩く材料が揃っているため、この穴を埋めるのに最も自然な位置にいる。

## ゴール

`extended` を有効にしたアプリについて、dts-gen の出力に加えて以下を含む TypeScript ファイルを生成する。

- ステータス名の Union 型 / アクション名の Union 型
- dts-gen の `Saved*Fields` にルックアップとプロセス管理フィールドをマージした Record 型
- 詳細画面・一覧画面・プロセス実行の各イベント型エイリアス

## 非ゴール

- **サブテーブル内のルックアップ** — `fields.json` の `SUBTABLE` は `fields` を入れ子に持ち、dts-gen はサブテーブル型をインラインで出力する。交差型で内側のフィールドだけ差し替えることができないため、v2.0.0 では対象外とする。検出した場合は警告のみ。
- **`CATEGORY`（カテゴリー）フィールド** — dts-gen から同様に脱落するが、実需が確認できていないため見送る。
- **`SINGLE_LINE_TEXT` / `NUMBER` 以外を基底とするルックアップ** — kintone のルックアップは `LINK` や `DATE` を基底に取りうる。v2.0.0 では 2 種のみ対応し、それ以外は警告を出して dts-gen の型のまま残す。
- **dts-gen 出力ファイルの改変** — dts-gen の出力はブラックボックスとして扱い、一切パース・書き換えしない。

## 設定インターフェース

```ts
export type AppConfig = number | { id: number; extended?: boolean };

export type Config = {
  host: string;
  apps: Record<string, AppConfig>;
  // 既存項目（auth, proxy, basicAuth, pfx, outDir, preview, guestSpaceId, namespace, format, debug）は変更なし
};
```

- `extended` のデフォルトは `true`。
- 数値の短縮形（`apps: { expense: 123 }`）は維持する。破壊的なのは「既存の設定ファイルのまま挙動が変わる」点であり、短縮形を捨てる理由はない。
- 除外したいアプリは `{ id: 456, extended: false }` と書く。

## 提供する静的型（`@goqoo/trunks/types`）

アプリのメタデータから導出されない静的な型は、生成せず trunks がパッケージとして提供する。生成ファイルは `import type` するだけなので TypeScript のコンパイル時に完全に消え、trunks は devDependency のままで済む。この分離により、trunks 側で型定義を修正した際にバージョン更新だけで利用者へ伝播する（再生成が不要になる）。

```ts
/// <reference types="@kintone/dts-gen/kintone" />

export type LookupText = kintone.fieldTypes.SingleLineText & {
  lookup?: 'UPDATE' | 'CLEAR';
};

export type LookupNumber = kintone.fieldTypes.Number & {
  lookup?: 'UPDATE' | 'CLEAR';
};

export type KintoneEvent = {
  appId: number;
  type: string;
  error?: string;
};

export type IndexEvent<T> = KintoneEvent & {
  records: T[];
  viewType: 'list' | 'calendar' | 'custom';
  viewId: number;
  viewName: string;
  offset: number | null;
  size: number | null;
  date: string | null;
};

export type DetailEvent<T> = KintoneEvent & {
  record: T;
  recordId: number;
  reuse?: boolean;
};

export type ProcessProceedEvent<T, U, V> = DetailEvent<T> & {
  action: { value: V };
  status: { value: U };
  nextStatus: { value: U };
};
```

`lookup` は**任意**（`?`）とする。これは書き込み専用のプロパティで API から取得したレコードには存在しないため、必須にすると読み取り時の型が実態と食い違い、レコードのオブジェクトリテラルを組み立てる際に不要な型エラーを生む。任意にしても代入（`record.x.lookup = 'UPDATE'`）は従来どおり通る。

### パッケージのエクスポート構成

ルート（`@goqoo/trunks`）は `generate` / `loadConfig` を export しており、その型グラフは `child_process`・`chalk`・`netrc-parser` を引き摺る Node CLI の型定義である。一方 `DetailEvent` を import するのはブラウザで動く kintone カスタマイズのコードで、tsconfig の `lib` も `types` も異なる。読者が別物なのでサブパスに分離する。

```json
{
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./types": { "types": "./dist/kintone-types.d.ts", "import": "./dist/kintone-types.js" }
  },
  "typesVersions": { "*": { "types": ["dist/kintone-types.d.ts"] } }
}
```

`typesVersions` を併記するのは、subpath exports が `moduleResolution: node16 / nodenext / bundler` でしか解決されないため。kintone カスタマイズには旧 `"moduleResolution": "node"` のプロジェクトが残っており、その場合 `exports` が無視されて `@goqoo/trunks/types` を引けない。

`@kintone/dts-gen` の package.json には `exports` フィールドがなく `kintone.d.ts` は `files` に含まれて publish される。したがって `/// <reference types="@kintone/dts-gen/kintone" />` は trunks 自身のビルドでも利用者のコンパイルでも解決する。

## データ取得

`extended` なアプリごとに、dts-gen の実行に加えて 2 本の API を叩く。`config.preview` が `true` の場合は両方 `/k/v1/preview/...` を参照する。

| API | 用途 |
| --- | --- |
| `/k/v1/app/form/fields.json` | ルックアップ判定、`STATUS` / `STATUS_ASSIGNEE` のフィールドコード取得 |
| `/k/v1/app/status.json` | `states`（ステータス名）、`actions`（アクション名） |

HTTP クライアントには `@kintone/rest-api-client` を使う。trunks の設定項目が rest-api-client のオプションにほぼ 1:1 で対応する（`auth` の 3 種、`basicAuth`、`proxy`、`pfx` → `clientCertAuth`）ため、自前の `fetch` でプロキシとクライアント証明書の agent を再実装する必要がない。OAuth トークンの取得は従来どおり gyuma（`src/oauth.ts`）が担い、得たトークンを rest-api-client に渡す。

### 判定ロジック

**ルックアップ:** `fields.json` の各プロパティが `lookup` キーを持ち、かつ `type` が `SINGLE_LINE_TEXT` なら `LookupText`、`NUMBER` なら `LookupNumber` を当てる。それ以外の型は警告して無視する。

**プロセス管理フィールド:** `fields.json` から `type` が `STATUS` / `STATUS_ASSIGNEE` のフィールドを探し、その `code` を使う。`作業者` 決め打ちにしないのは、英語ロケールのアプリでは `Status` / `Assignee` になるため。

**ステータス・アクション:** `status.json` の `enable` が `false` のアプリ（プロセス管理無効）では Status / Action / ProceedEvent 型を出力せず、ルックアップだけ反映した Record 型と Detail / Index イベント型を生成する。`states` は名前をキーとするオブジェクトなので一意。`index`（文字列の数値）で昇順に並べる。`actions` は配列で、異なる遷移元から同名のアクションが定義されうるため、出現順を保ったまま重複を除去する。

## 生成物

`dts/expense-fields.d.ts`（dts-gen、無改変）の隣に `dts/expense.ts` を生成する。ファイル名は `kebabCase(appName)`、型名の接頭辞は `pascalCase(appName)`。既存の命名規則に従う。

以下は架空の経費申請アプリ（`apps: { expense: 123 }`）での出力例。

```ts
import type { LookupText, DetailEvent, IndexEvent, ProcessProceedEvent } from '@goqoo/trunks/types';

export type ExpenseStatus = '未申請' | '申請中' | '承認済み' | '却下';

export type ExpenseAction = '申請する' | '承認する' | '却下する' | '取り下げる';

export type ExpenseRecord = kintone.types.SavedExpenseFields & {
  従業員コード: LookupText;
  ステータス: { type: 'STATUS'; value: ExpenseStatus };
  作業者: { type: 'STATUS_ASSIGNEE'; value: { code: string; name: string }[] };
};

export type ExpenseDetailEvent = DetailEvent<ExpenseRecord>;
export type ExpenseIndexEvent = IndexEvent<ExpenseRecord>;
export type ExpenseProceedEvent = ProcessProceedEvent<ExpenseRecord, ExpenseStatus, ExpenseAction>;
```

参照する dts-gen の型は `${config.namespace ?? 'kintone.types'}.Saved${pascalCase(appName)}Fields`。`namespace` 設定を無視して `kintone.types` を決め打ちしないこと。

`config.format` が `true` の場合、生成後に既存の Prettier 処理を通す。

このファイルは実行のたびに全体を上書きする。利用者が手で足したい型（アプリ固有のヘルパなど）は別ファイルに置いて交差型で合成する運用とし、その旨を README とファイル先頭の自動生成コメントに明記する。

## モジュール構成

| ファイル | 責務 |
| --- | --- |
| `src/kintone-types.ts` | 利用者向けの静的型。`@goqoo/trunks/types` として公開 |
| `src/client.ts` | `Config` → `KintoneRestAPIClient` の生成。認証・プロキシ・証明書の対応付けを閉じ込める |
| `src/app-meta.ts` | client + appId → 正規化した `AppMeta`（lookups, statusField, assigneeField, states, actions）。API レスポンスの形式をここで吸収する |
| `src/render.ts` | `AppMeta` + appName + namespace → ソース文字列。純関数。ファイル I/O も HTTP も持たない。import 文には実際に使う型だけを並べる（`LookupNumber` を使わないアプリで import しない） |
| `src/generate.ts` | 既存の dts-gen 実行に加え、extended フローを呼び出す |
| `src/types.ts` | `AppConfig` の追加と、短縮形を正規化するヘルパ |

`render.ts` を純関数として切り出すのは、生成結果の検証を HTTP なしで行うため。

## エラー処理

extended の API 取得に失敗したアプリは、既存の失敗集計に合流させて末尾に件数を報告し、他のアプリの処理は継続する。dts-gen が既に出力したファイルはそのまま残す（型定義そのものは有効なため）。`config.debug` が `true` の場合はレスポンスの詳細を表示する。既存の `extractKintoneError` と同様に、kintone のエラーコードとメッセージを抽出して表示する。

## テスト

- `test/app-meta.test.ts` — `fields.json` / `status.json` のフィクスチャから `AppMeta` への変換。ルックアップ判定、非対応基底型の警告、プロセス管理無効、英語ロケールのフィールドコード、アクション名の重複除去
- `test/render.test.ts` — `AppMeta` → ソース文字列。namespace 設定の反映、プロセス管理無効時に Status / Action / ProceedEvent を出さないこと
- `test/config.test.ts` — `AppConfig` の正規化（数値の短縮形、`extended` のデフォルト `true`）

## 破壊的変更とバージョニング

v2.0.0 とする。既存の設定ファイルは変更なしで読めるが、`extended` がデフォルト `true` のため挙動が変わる。

- 生成されるファイルが増える（`dts/expense.ts`）
- アプリごとに API リクエストが 2 本増える
- `/k/v1/app/form/fields.json` は dts-gen が既に叩いているため新たな権限は要らないが、`/k/v1/app/status.json` はアプリ管理権限を要求する。API トークン認証で権限が不足している環境では、このリクエストだけが失敗しうる

README.md / README.ja.md に `AppConfig`、`extended`、`@goqoo/trunks/types` からの import 例、v1 からの移行手順（挙動を変えたくない場合は `extended: false` を指定する）を追記する。

## リスクと検証項目

1. **`/// <reference types="..." />` の d.ts への伝播** — TypeScript が `dist/kintone-types.d.ts` に type reference directive を保持することを、ビルド後の出力で実際に確認する。落ちる場合は利用者側で `kintone.fieldTypes` が解決できず型エラーになる。
2. **`status.json` の権限** — API トークン認証でアプリ管理権限がない場合の挙動を確認し、エラーメッセージで「`extended: false` で回避できる」ことを案内する。
3. **`typesVersions` による旧 moduleResolution での解決** — `"moduleResolution": "node"` の tsconfig を持つプロジェクトで `@goqoo/trunks/types` が引けることを確認する。
