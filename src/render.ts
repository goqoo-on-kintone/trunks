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

// 空配列は toUnion() で '' になり `= ;` という構文エラーを生むため、
// 要素が1件以上ある場合のみ値を返す。プロセス管理が有効でも遷移アクションが
// 0件のkintoneアプリはありうる（逆に、状態はあってもアクションがない場合もある）ため、
// states/actionsそれぞれ独立に「空でないか」を判定できるようにする。
function nonEmpty(values: string[] | undefined): string[] | undefined {
  return values !== undefined && values.length > 0 ? values : undefined;
}

// AppMetaから拡張型定義のソースを組み立てる
export function renderExtendedTypes(appName: string, meta: AppMeta, namespace: string): string {
  const prefix = pascalCase(appName);
  const states = nonEmpty(meta.states);
  const actions = nonEmpty(meta.actions);
  // Status Union・Recordのステータスフィールドはステータスフィールドコードとstatesが揃った場合のみ出力する
  const hasStatus = meta.statusFieldCode !== undefined && states !== undefined;
  // ProceedEventはStatus・Action両方の型引数を必要とするため、両方揃った場合のみ出力する
  const hasProceedEvent = hasStatus && actions !== undefined;

  const imports = buildImports(meta, hasProceedEvent);
  const blocks: string[] = [HEADER, '', `import type { ${imports.join(', ')} } from '@goqoo/trunks/types';`, ''];

  if (meta.statusFieldCode !== undefined && states !== undefined) {
    blocks.push(`export type ${prefix}Status = ${toUnion(states)};`, '');
  }
  if (actions !== undefined) {
    blocks.push(`export type ${prefix}Action = ${toUnion(actions)};`, '');
  }

  blocks.push(...buildRecord(prefix, meta, namespace, states));

  blocks.push(`export type ${prefix}DetailEvent = DetailEvent<${prefix}Record>;`);
  blocks.push(`export type ${prefix}IndexEvent = IndexEvent<${prefix}Record>;`);
  if (hasProceedEvent) {
    blocks.push(
      `export type ${prefix}ProceedEvent = ProcessProceedEvent<${prefix}Record, ${prefix}Status, ${prefix}Action>;`
    );
  }

  return `${blocks.join('\n')}\n`;
}

function buildImports(meta: AppMeta, hasProceedEvent: boolean): string[] {
  const imports: string[] = [];
  if (meta.lookups.some((lookup) => lookup.kind === 'LookupText')) imports.push('LookupText');
  if (meta.lookups.some((lookup) => lookup.kind === 'LookupNumber')) imports.push('LookupNumber');
  imports.push('DetailEvent', 'IndexEvent');
  if (hasProceedEvent) imports.push('ProcessProceedEvent');
  return imports;
}

function buildRecord(prefix: string, meta: AppMeta, namespace: string, states: string[] | undefined): string[] {
  const lines = [`export type ${prefix}Record = ${namespace}.Saved${prefix}Fields & {`];

  for (const lookup of meta.lookups) {
    lines.push(`  ${propKey(lookup.code)}: ${lookup.kind};`);
  }

  if (meta.statusFieldCode !== undefined && states !== undefined) {
    lines.push(`  ${propKey(meta.statusFieldCode)}: { type: 'STATUS'; value: ${prefix}Status };`);
  }

  if (meta.assigneeFieldCode) {
    lines.push(
      `  ${propKey(meta.assigneeFieldCode)}: { type: 'STATUS_ASSIGNEE'; value: { code: string; name: string }[] };`
    );
  }

  lines.push('};', '');
  return lines;
}
