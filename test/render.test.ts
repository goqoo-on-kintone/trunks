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

  it('statesがありactionsが空配列の場合はStatus型のみ出力しAction・ProceedEventは出力しない', () => {
    // ステータスは定義されているが遷移アクションが0件のプロセス管理は
    // kintoneの仕様上ありうる。toUnion([])は''になるため空配列のまま出力すると
    // `export type ExpenseAction = ;` という構文エラーになってしまう
    const meta: AppMeta = { ...fullMeta, actions: [] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain("export type ExpenseStatus = '未申請' | '申請中' | '承認済み' | '却下';");
    expect(source).not.toContain('ExpenseAction');
    expect(source).not.toContain('ExpenseProceedEvent');
    expect(source).not.toContain('ProcessProceedEvent');
    expect(source).not.toMatch(/=\s*;/);
  });

  it('actionsがありstatesが空配列の場合はAction型のみ出力しStatus・ProceedEvent・ステータス欄は出力しない', () => {
    const meta: AppMeta = { ...fullMeta, states: [] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).toContain("export type ExpenseAction = '申請する' | '承認する' | '却下する' | '取り下げる';");
    expect(source).not.toContain('ExpenseStatus');
    expect(source).not.toContain('ExpenseProceedEvent');
    expect(source).not.toContain("type: 'STATUS';");
    expect(source).not.toMatch(/=\s*;/);
  });

  it('statesとactionsが両方空配列の場合はプロセス管理が無効な場合と同様に振る舞う', () => {
    const meta: AppMeta = { ...fullMeta, states: [], actions: [] };
    const source = renderExtendedTypes('expense', meta, 'kintone.types');
    expect(source).not.toContain('ExpenseStatus');
    expect(source).not.toContain('ExpenseAction');
    expect(source).not.toContain('ProcessProceedEvent');
    expect(source).toContain('export type ExpenseRecord = kintone.types.SavedExpenseFields & {');
    expect(source).toContain('export type ExpenseDetailEvent = DetailEvent<ExpenseRecord>;');
    expect(source).not.toMatch(/=\s*;/);
  });
});
