// 「読みたい本メモ」タブ（ISBN・タイトル・作者・出版社・出版年月）を読む。

import { SHEET_ID, parseCsv } from './sheet.ts';

/** 「読みたい本メモ」タブの gid（URL の #gid=… の数字） */
export const BOOKS_GID = '593709678';

export type Book = {
  isbn: string; // ISBN-13（読めなければ元の文字列）
  title: string;
  authors: string[];
  publisher?: string;
  published?: string; // 「2015年4月」など
};

export function booksCsvUrl(id = SHEET_ID, gid = BOOKS_GID): string {
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/** ISBN-10 / ISBN-13（ハイフンあり・なし）を ISBN-13 の数字だけに。読めなければ null。 */
export function toIsbn13(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) return s;
  if (!/^\d{9}[\dX]$/.test(s)) return null;
  const body = `978${s.slice(0, 9)}`;
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

/** "1985-09" / "200410" / "2015.4" などを「1985年9月」に。年だけなら「1985年」。 */
export function formatPublished(raw: string): string | undefined {
  const m = raw.trim().match(/^(\d{4})[-./年]?(\d{1,2})?/);
  if (!m) return raw.trim() || undefined;
  return m[2] ? `${m[1]}年${Number(m[2])}月` : `${m[1]}年`;
}

/**
 * 図書館データ風の作者表記（"Egan,Greg,1961- 山岸,真,1962-"）を人ごとに整える。
 * 生没年を落とし、英字は「名 姓」、日本語は「姓名」に。
 */
export function parseAuthors(raw: string): string[] {
  return raw
    .replace(/,\s*\d{4}-(\d{4})?/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const [family, given] = p.split(',');
      if (!given) return p;
      return /^[\p{Script=Latin}\s.'-]+$/u.test(family + given) ? `${given} ${family}` : `${family}${given}`;
    });
}

export function rowsToBooks(rows: string[][]): Book[] {
  const [header = [], ...body] = rows;
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const col = {
    isbn: find('ISBN', 'ISDN'),
    title: find('タイトル', '書名'),
    author: find('作者', '著者'),
    publisher: find('出版社'),
    published: find('出版年', '発行'),
  };
  // 出版社・出版年月の見出しが空なら、作者の右隣の列から順に使う
  if (col.publisher < 0 && col.author >= 0) col.publisher = col.author + 1;
  if (col.published < 0 && col.publisher >= 0) col.published = col.publisher + 1;
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  const books: Book[] = [];
  for (const r of body) {
    const title = get(r, col.title);
    if (!title) continue;
    const rawIsbn = get(r, col.isbn);
    books.push({
      isbn: toIsbn13(rawIsbn) ?? rawIsbn,
      title,
      authors: parseAuthors(get(r, col.author)),
      publisher: get(r, col.publisher) || undefined,
      published: formatPublished(get(r, col.published)),
    });
  }
  return books;
}

export async function loadBooks(): Promise<Book[]> {
  const res = await fetch(booksCsvUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`シートを読めませんでした (${res.status})`);
  return rowsToBooks(parseCsv(await res.text()));
}

/** 国立国会図書館サーチの書影。無い本もある。 */
export const coverUrl = (isbn13: string) => `https://ndlsearch.ndl.go.jp/thumbnail/${isbn13}.jpg`;
export const bookLink = (b: Book) =>
  `https://ndlsearch.ndl.go.jp/search?cs=bib&keyword=${encodeURIComponent(/^\d{13}$/.test(b.isbn) ? b.isbn : b.title)}`;
