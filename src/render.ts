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
