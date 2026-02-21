# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

@goqoo/trunks - `@kintone/dts-gen`のラッパーCLIツール。

### 背景・目的

`@kintone/dts-gen`は優れた型定義ファイルを生成するが、CLIとしての使い勝手に課題がある（特に複数アプリの一括生成ができない）。このツールは設定ファイルベースで複数アプリの型定義を一括生成する。

### 参考実装

[goqoo/src/generator/dts/index.ts](https://github.com/goqoo-on-kintone/goqoo/blob/main/src/generator/dts/index.ts) の機能を単独抽出したもの。

goqooでの処理フロー:
1. 設定ファイルから対象環境を特定
2. OAuth or ユーザー名/パスワード認証を設定
3. `appId`オブジェクトをループして各アプリに対し`npx kintone-dts-gen`を実行
4. 出力ファイル名はkebab-case、型名はPascalCaseで自動生成

### 設定ファイル構造

```typescript
type Config = {
  host: string                      // Kintone環境のホスト（例: "example.cybozu.com"）
  apps: Record<string, number>      // { appName: appId }
  auth:
    | { type: 'password' }                           // 環境変数 KINTONE_USERNAME, KINTONE_PASSWORD
    | { type: 'oauth'; scope?: string }              // OAuth認証
    | { type: 'api-token'; token: string }           // APIトークン
  proxy?: { host: string; port: number }             // プロキシ設定（任意）
  basicAuth?: { username: string; password: string } // Basic認証（任意）
}
```

## 開発コマンド

```bash
yarn install             # パッケージインストール
yarn build               # TypeScriptビルド
yarn dev                 # ウォッチモードでビルド
yarn prettier --write .  # コードフォーマット
```

## ソース構造

```
src/
├── cli.ts      # CLIエントリーポイント（Commander.js）
├── config.ts   # 設定ファイル読み込み（jiti使用）
├── generate.ts # dts-gen実行処理
├── index.ts    # エクスポート
└── types.ts    # 型定義・defineConfig
```

## 技術スタック

- **ランタイム:** Node.js >= 20
- **パッケージマネージャー:** Yarn
- **主要依存:** @kintone/dts-gen, Commander.js, jiti, change-case, chalk
- **フォーマッタ:** Prettier（シングルクォート、120文字/行）
