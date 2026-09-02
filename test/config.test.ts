import { describe, it, expect } from '@jest/globals';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { loadConfig } from '../src/config';
import { normalizeApps } from '../src/types';

describe('loadConfig', () => {
  it('設定ファイルが見つからない場合はエラーをスローする', async () => {
    // 存在しないディレクトリを指定
    await expect(loadConfig('/non-existent-dir-12345')).rejects.toThrow('Config file not found');
  });

  it('エラーメッセージに設定ファイル名の候補を含む', async () => {
    await expect(loadConfig('/non-existent-dir-12345')).rejects.toThrow('trunks.config.ts');
  });
});

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
