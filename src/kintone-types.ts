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
