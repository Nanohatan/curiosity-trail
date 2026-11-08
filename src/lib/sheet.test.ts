import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, normalizeDate, parseCsv, rowsToClosures, rowsToTrail, statusOf } from './sheet.ts';

test('CSV の読み取り', () => {
  const rows = parseCsv('"a","b,c","d""e"\n"1","",""\r\n"x","改\n行","z"');
  assert.deepEqual(rows, [['a', 'b,c', 'd"e'], ['1', '', ''], ['x', '改\n行', 'z']]);
});

test('日付の正規化', () => {
  assert.equal(normalizeDate('2026/10/6'), '2026-10-06');
  assert.equal(normalizeDate('2026/10/17 19:44:58'), '2026-10-17');
  assert.equal(normalizeDate(''), null);
});

test('1 か月後（月末の丸め）', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
});

test('休眠の判定', () => {
  assert.equal(statusOf('2026-09-17', '2026-10-17'), 'active');
  assert.equal(statusOf('2026-09-16', '2026-10-17'), 'dormant');
});

test('シートの行からハマりごとを組み立てる', () => {
  const rows = [
    ['タイムスタンプ', '名前', 'カテゴリ', '何をした？', '日付', '熱量', 'きっかけ、何から派生したか？'],
    ['2026/10/17 19:44:58', '実務翻訳', '言語', '説明会参加', '2026/10/16', '4', '翻訳してみたい！'],
    ['2026/08/01 10:00:00', '囲碁', '遊び', '対局', '', '3', ''],
    ['2026/10/17 20:00:00', '実務翻訳', '言語', '本を買った', '2026/10/17', '5', ''],
    ['', '', '', '', '', '', ''],
  ];
  const { logs, interests } = rowsToTrail(rows, '2026-10-17');
  assert.equal(logs.length, 3);
  assert.equal(logs[0].date, '2026-08-01'); // 日付が空ならタイムスタンプ
  const t = interests.find((i) => i.id === '実務翻訳')!;
  assert.equal(t.count, 2);
  assert.equal(t.started, '2026-10-16');
  assert.equal(t.heat, 5);
  assert.equal(t.origin, '翻訳してみたい！');
  assert.equal(t.status, 'active');
  assert.equal(interests.find((i) => i.id === '囲碁')!.status, 'dormant');
});

test('クローズタブ', () => {
  const closures = rowsToClosures([
    ['日付', '名前', '理由'],
    ['2026/10/10', '囲碁', '相手がいない'],
    ['2026/10/05', '料理', ''],
    ['2026/9/1', '囲碁', '古い理由'],
    ['', '', ''],
  ]);
  assert.deepEqual([...closures], [
    ['囲碁', { date: '2026-10-10', reason: '相手がいない' }],
    ['料理', { date: '2026-10-05', reason: undefined }],
  ]);

  const rows = [
    ['タイムスタンプ', '名前', 'カテゴリ', '何をした？', '日付', '熱量', 'きっかけ'],
    ['', '囲碁', '遊び', '対局', '2026/10/01', '3', ''],
    ['', '料理', '生活', 'また作った', '2026/10/20', '4', ''],
    ['', '写真', '趣味', '撮った', '2026/10/12', '', ''],
  ];
  const { interests } = rowsToTrail(rows, '2026-10-21', closures);
  const go = interests.find((i) => i.id === '囲碁')!;
  assert.equal(go.status, 'closed');
  assert.equal(go.closed, '2026-10-10');
  assert.equal(go.closedReason, '相手がいない');
  const cook = interests.find((i) => i.id === '料理')!;
  assert.equal(cook.status, 'active'); // クローズ後に記録したので戻る
  assert.equal(cook.closed, undefined);
  assert.equal(interests.find((i) => i.id === '写真')!.status, 'active');
});
