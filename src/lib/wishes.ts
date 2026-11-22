// 「やりたいこと」タブ（タイトル・メモ）を読む。

import { SHEET_ID, parseCsv } from './sheet.ts';

/** 「やりたいこと」タブの gid（URL の #gid=… の数字） */
export const WISHES_GID = '250335246';

export type Wish = {
  title: string;
  note?: string; // 具体的にどうするか（統計検定を受ける、など）
};

export function wishesCsvUrl(id = SHEET_ID, gid = WISHES_GID): string {
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

export function rowsToWishes(rows: string[][]): Wish[] {
  const [header = [], ...body] = rows;
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const title = Math.max(find('タイトル', 'やりたい'), 0);
  // メモの見出しが空なら、タイトルの右隣の列を使う
  const found = find('メモ', '具体', '内容', '詳細', '方法');
  const note = found >= 0 ? found : title + 1;
  const get = (r: string[], i: number) => (r[i] ?? '').trim();

  const wishes: Wish[] = [];
  for (const r of body) {
    const t = get(r, title);
    if (!t) continue;
    wishes.push({ title: t, note: get(r, note) || undefined });
  }
  return wishes;
}

export async function loadWishes(): Promise<Wish[]> {
  const res = await fetch(wishesCsvUrl(), { cache: 'no-store' });
  if (!res.ok) throw new Error(`シートを読めませんでした (${res.status})`);
  return rowsToWishes(parseCsv(await res.text()));
}
