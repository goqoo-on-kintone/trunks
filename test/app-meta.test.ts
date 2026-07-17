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
