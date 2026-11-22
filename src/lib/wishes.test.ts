import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsToWishes } from './wishes.ts';

test('やりたいことタブ（メモ列の見出しが空でも読む）', () => {
  const rows = [
    ['タイトル', ''],
    ['統計について学ぶ', '統計検定を受ける'],
    ['デジタルイラストの書き方を学ぶ', ''],
    ['', 'タイトルのない行は飛ばす'],
  ];
  assert.deepEqual(rowsToWishes(rows), [
    { title: '統計について学ぶ', note: '統計検定を受ける' },
    { title: 'デジタルイラストの書き方を学ぶ', note: undefined },
  ]);
});

test('メモ列に見出しがあればそれを使う', () => {
  const rows = [
    ['メモ', 'タイトル'],
    ['ラダーシリーズ', '英語の多読'],
  ];
  assert.deepEqual(rowsToWishes(rows), [{ title: '英語の多読', note: 'ラダーシリーズ' }]);
});
