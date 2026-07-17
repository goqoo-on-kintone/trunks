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
