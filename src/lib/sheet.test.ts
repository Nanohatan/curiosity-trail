import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseSpans, logEnd } from './trail.ts';
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

test('公開用_ログの列（終了日・テーマID・種類が増えても読める）', () => {
  const rows = [
    ['タイムスタンプ', '名前', 'カテゴリ', '何をした？', '日付', '熱量', 'きっかけ、何から派生したか？', '種類（やった・見た・読んだ・買った・行った ', '終了日', 'テーマID'],
    ['2026/11/17', '新しいゲームの作成', '創作', 'UI修正', '2026/11/17', '3', '', '', '', 'T07'],
    ['2026/11/07', '新しいゲームの作成', '創作', '執筆', '2026/11/07', '4', 'ゲームを作りたい', '', '', 'T07'],
  ];
  const { logs, interests } = rowsToTrail(rows, '2026-11-22');
  assert.equal(logs.length, 2);
  assert.equal(logs[1].date, '2026-11-17');
  const g = interests.find((i) => i.id === 'T07')!;
  assert.equal(g.started, '2026-11-07');
  assert.equal(g.name, '新しいゲームの作成');
  assert.equal(g.category, '創作');
  assert.equal(g.origin, 'ゲームを作りたい');
});

test('終了日のある行は期間中の毎日の記録になる', () => {
  const rows = [
    ['タイムスタンプ', '名前', 'カテゴリ', '何をした？', '日付', '熱量', 'きっかけ', '終了日', 'テーマID'],
    ['2026/11/17', '新しいゲームの作成', '創作', 'ちょこちょこ開発', '2026/11/17', '4', '作りたい', '2026/11/22', 'T07'],
    ['2026/11/20', '翻訳の勉強', '言語', '本', '2026/11/20', '3', '', '2026/11/19', 'T01'], // 終了日が前なら 1 日だけ
  ];
  const { logs, interests } = rowsToTrail(rows, '2026-11-22');
  const game = logs.filter((l) => l.interest === 'T07');
  assert.deepEqual(game.map((l) => l.date), ['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  assert.ok(game.every((l) => l.heat === 4 && l.action === 'ちょこちょこ開発'));
  assert.equal(game[0].origin, '作りたい');
  assert.equal(game[1].origin, undefined);
  const g = interests.find((i) => i.id === 'T07')!;
  assert.equal(g.started, '2026-11-17');
  assert.equal(g.last, '2026-11-22');
  assert.equal(g.count, 1); // 表示上は 1 件
  assert.deepEqual(game[3].span, { start: '2026-11-17', end: '2026-11-22' });

  // 表示用には 1 件にまとまり、日付は開始日、終わりは終了日
  const shown = collapseSpans(logs);
  assert.equal(shown.length, 2);
  const one = shown.find((l) => l.interest === 'T07')!;
  assert.equal(one.date, '2026-11-17');
  assert.equal(logEnd(one), '2026-11-22');
  assert.equal(one.origin, '作りたい');
  assert.equal(logs.filter((l) => l.interest === 'T01').length, 1);
});

test('表示タイトル名は最新のものを使い、変えたことを記録する', () => {
  const rows = [
    ['名前', '日付', '何をした？', '熱量', 'テーマID', '表示タイトル名'],
    ['新しいゲームの作成', '2026/11/07', '執筆', '4', 'T07', '新しいゲームの作成'],
    ['新しいゲームの作成', '2026/11/10', 'モック', '5', 'T07', ''],
    ['新しいゲームの作成', '2026/11/20', '名前決め', '4', 'T07', 'ロゴスの釣り人'],
    ['新しいゲームの作成', '2026/11/21', '実装', '3', 'T07', ''],
    ['新しいゲームの作成', '2026/11/22', '同じ名前を再度', '3', 'T07', 'ロゴスの釣り人'],
    ['翻訳の勉強', '2026/11/02', '本', '4', 'T01', ''], // 表示タイトル名がなければ名前列
  ];
  const { logs, interests } = rowsToTrail(rows, '2026-11-22');
  const g = interests.find((i) => i.id === 'T07')!;
  assert.equal(g.name, 'ロゴスの釣り人');
  assert.equal(g.count, 5); // 名前を変えても同じハマりごと
  assert.deepEqual(g.renames, [{ date: '2026-11-20', from: '新しいゲームの作成', to: 'ロゴスの釣り人' }]);
  const renamed = logs.filter((l) => l.rename);
  assert.equal(renamed.length, 1);
  assert.equal(renamed[0].action, '名前決め');
  assert.equal(interests.find((i) => i.id === 'T01')!.name, '翻訳の勉強');
});

test('クローズはテーマIDで結びつく（名前を変えていても）', () => {
  const closures = rowsToClosures([
    ['日付', '名前', '理由', 'テーマID'],
    ['2026/11/22', '新しいゲームの作成', '完成', 'T07'],
  ]);
  const rows = [
    ['名前', '日付', '何をした？', 'テーマID', '表示タイトル名'],
    ['新しいゲームの作成', '2026/11/07', '執筆', 'T07', '新しいゲームの作成'],
    ['新しいゲームの作成', '2026/11/20', '名前決め', 'T07', 'ロゴスの釣り人'],
  ];
  const g = rowsToTrail(rows, '2026-11-22', closures).interests[0];
  assert.equal(g.status, 'closed');
  assert.equal(g.closedReason, '完成');
});
