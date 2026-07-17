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
