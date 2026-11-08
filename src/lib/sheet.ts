// Google スプレッドシート（フォームの回答）を読み、草や一覧で使う形に揃える。
// ブラウザで実行するので、シートに書き足せば再ビルドなしで反映される。

import { toDay, type TrailInterest, type TrailLog } from './trail.ts';

export const SHEET_ID = '1V2DwC3UR-5L5FeZ9c6Vrco47osiYCNVMPPqySt25o1g';

/** 最後の記録からこの月数が過ぎたら「休眠中」 */
export const DORMANT_AFTER_MONTHS = 1;

/** 「クローズ」タブの gid（日付・名前・理由。飽きたものを書く） */
export const CLOSE_GID = '1726596149';

export function sheetCsvUrl(id = SHEET_ID, gid?: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
}

/** RFC 4180 の CSV を 2 次元配列に。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "2026/10/16" や "2026/10/17 19:44:58" を "2026-10-16" に。読めなければ null。 */
export function normalizeDate(value: string): string | null {
  const m = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** 見出しの文字で列を探す（列の並べ替えや言い回しの変更に強くする）。 */
function column(header: string[], ...keys: string[]): number {
  return header.findIndex((h) => keys.some((k) => h.includes(k)));
}

/** last の日付から months か月後の日（月末は丸める）。 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** 自分でクローズしていなければ、最後の記録からの経過で「ハマり中」か「休眠中」。 */
export function statusOf(lastDate: string, today: string, closed?: string): TrailInterest['status'] {
  if (closed) return 'closed';
  return toDay(today) > toDay(addMonths(lastDate, DORMANT_AFTER_MONTHS)) ? 'dormant' : 'active';
}

export type Closure = { date: string; reason?: string };

/** 「クローズ」タブの行を、名前 → クローズした日と理由（同じ名前が何度あれば最新の行）に。 */
export function rowsToClosures(rows: string[][]): Map<string, Closure> {
  const [header = [], ...body] = rows;
  const name = column(header, '名前');
  const date = column(header, '日付');
  const reason = column(header, '理由');
  const map = new Map<string, Closure>();
  for (const r of body) {
    const n = (r[name] ?? '').trim();
    const d = normalizeDate(r[date] ?? '');
    if (!n || !d) continue;
    const why = reason >= 0 ? (r[reason] ?? '').trim() : '';
    if (!map.has(n) || d >= map.get(n)!.date) map.set(n, { date: d, reason: why || undefined });
  }
  return map;
}

export function rowsToTrail(
  rows: string[][],
  today: string,
  closures: Map<string, Closure> = new Map(),
): { logs: TrailLog[]; interests: TrailInterest[] } {
  const [header = [], ...body] = rows;
  const col = {
    stamp: column(header, 'タイムスタンプ'),
    name: column(header, '名前'),
    category: column(header, 'カテゴリ'),
    action: column(header, '何をした'),
    date: column(header, '日付'),
    heat: column(header, '熱量'),
    origin: column(header, 'きっかけ'),
  };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '');

  const logs: TrailLog[] = [];
  for (const r of body) {
    const name = get(r, col.name);
    const date = normalizeDate(get(r, col.date)) ?? normalizeDate(get(r, col.stamp));
    if (!name || !date) continue;
    const heat = Number(get(r, col.heat));
    logs.push({
      date,
      interest: name,
      category: get(r, col.category) || '未分類',
      action: get(r, col.action),
      heat: Number.isFinite(heat) && heat > 0 ? heat : undefined,
      origin: get(r, col.origin) || undefined,
    });
  }
  logs.sort((a, b) => a.date.localeCompare(b.date));

  const map = new Map<string, TrailInterest>();
  for (const l of logs) {
    const cur = map.get(l.interest);
    if (!cur) {
      map.set(l.interest, {
        id: l.interest,
        name: l.interest,
        category: l.category,
        started: l.date,
        last: l.date,
        status: 'active',
        origin: l.origin,
        heat: l.heat,
        count: 1,
      });
    } else {
      // カテゴリと熱量は新しい記録のものを使う。きっかけは最初に書かれたもの。
      cur.category = l.category;
      cur.last = l.date;
      cur.count += 1;
      if (l.heat !== undefined) cur.heat = l.heat;
      cur.origin ??= l.origin;
    }
  }
  // クローズタブに書いた日が最後の記録と同じかそれより後ならクローズ。
  // クローズのあとに記録を書けば、また「ハマり中」に戻る。
  for (const [name, c] of closures) {
    const i = map.get(name);
    if (i && c.date >= i.last) {
      i.closed = c.date;
      i.closedReason = c.reason;
    }
  }
  const interests = [...map.values()]
    .map((i) => ({ ...i, status: statusOf(i.last, today, i.closed) }))
    .sort((a, b) => b.last.localeCompare(a.last));
  // ログのカテゴリはハマりごとの最新カテゴリに揃える
  for (const l of logs) l.category = map.get(l.interest)!.category;
  return { logs, interests };
}

let cache: Promise<{ logs: TrailLog[]; interests: TrailInterest[] }> | null = null;

async function fetchCsv(gid?: string): Promise<string[][]> {
  const res = await fetch(sheetCsvUrl(SHEET_ID, gid), { cache: 'no-store' });
  if (!res.ok) throw new Error(`シートを読めませんでした (${res.status})`);
  return parseCsv(await res.text());
}

/** 記録とクローズのタブを 1 回だけ読む（同じページ内で使い回す）。クローズが読めなくても記録は出す。 */
export function loadSheet(today: string): Promise<{ logs: TrailLog[]; interests: TrailInterest[] }> {
  cache ??= Promise.all([
    fetchCsv(),
    fetchCsv(CLOSE_GID).catch((e) => {
      console.warn(e);
      return [] as string[][];
    }),
  ]).then(([rows, closeRows]) => rowsToTrail(rows, today, rowsToClosures(closeRows)));
  return cache;
}

export const statusLabel = { active: 'ハマり中', dormant: '休眠中', closed: 'クローズ' } as const;
