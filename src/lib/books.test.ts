import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPublished, parseAuthors, parseDone, rowsToBooks, toIsbn13 } from './books.ts';

test('ISBN-10 を ISBN-13 に', () => {
  assert.equal(toIsbn13('4-488-71102-2'), '9784488711023');
  assert.equal(toIsbn13('9784150120009'), '9784150120009');
  assert.equal(toIsbn13('なし'), null);
});

test('出版年月', () => {
  assert.equal(formatPublished('1985-09'), '1985年9月');
  assert.equal(formatPublished('200410'), '2004年10月');
  assert.equal(formatPublished('2015'), '2015年');
  assert.equal(formatPublished(''), undefined);
});

test('作者の表記', () => {
  assert.deepEqual(parseAuthors('Egan,Greg,1961- 山岸,真,1962-'), ['Greg Egan', '山岸真']);
  assert.deepEqual(parseAuthors('Lem,Stanisław,1921-2006 沼野,充義,1954-'), ['Stanisław Lem', '沼野充義']);
  assert.deepEqual(parseAuthors('ジェイムズ・P・ホーガン 小隅,黎'), ['ジェイムズ・P・ホーガン', '小隅黎']);
});

test('シートの行から本の一覧', () => {
  const books = rowsToBooks([
    ['ISDN', 'タイトル', '作者', '', ''],
    ['4-488-71102-2', '万物理論', 'Egan,Greg,1961- 山岸,真,1962-', '東京創元社', '200410'],
    ['', '', '', '', ''],
  ]);
  assert.equal(books.length, 1);
  assert.deepEqual(books[0], {
    isbn: '9784488711023', title: '万物理論', authors: ['Greg Egan', '山岸真'], publisher: '東京創元社', published: '2004年10月', done: false,
  });
});

test('読み終わり列', () => {
  assert.deepEqual(parseDone(''), { done: false });
  assert.deepEqual(parseDone('FALSE'), { done: false });
  assert.deepEqual(parseDone('TRUE'), { done: true });
  assert.deepEqual(parseDone('済'), { done: true });
  assert.deepEqual(parseDone('2026/11/1'), { done: true, doneDate: '2026-11-01' });
  assert.deepEqual(parseDone('11/1/2026'), { done: true, doneDate: '2026-11-01' });
});

test('読み終わり列があっても出版社・出版年月の位置がずれない', () => {
  const books = rowsToBooks([
    ['ISDN', 'タイトル', '作者', '', '', '読み終わり'],
    ['9784150120009', 'ソラリス', 'Lem,Stanisław,1921-2006', '早川書房', '201504', '2026/10/30'],
  ]);
  assert.equal(books[0].publisher, '早川書房');
  assert.equal(books[0].published, '2015年4月');
  assert.equal(books[0].doneDate, '2026-10-30');
  const mid = rowsToBooks([
    ['ISDN', 'タイトル', '作者', '読み終わり', '', ''],
    ['9784150120009', 'ソラリス', 'Lem,Stanisław', 'TRUE', '早川書房', '201504'],
  ]);
  assert.equal(mid[0].publisher, '早川書房');
  assert.equal(mid[0].done, true);
});
