// ページを開いたときにシートを読み、草・一覧・個別ページを描く。
import { layoutCloud, sizeScale } from '../lib/cloud';
import { loadSheet, statusLabel } from '../lib/sheet';
import { todayIso, type TrailInterest, type TrailLog } from '../lib/trail';
import { el, initTrail, interestHref, jpDate } from './trail-client';

const base = document.documentElement.dataset.base ?? '/';
const fmt = (iso?: string) => (iso ? iso.replaceAll('-', '.') : '—');

function renderNow(target: HTMLElement, interests: TrailInterest[]) {
  const active = interests.filter((i) => i.status === 'active');
  const sub = document.querySelector<HTMLElement>('[data-now-sub]');
  if (sub) {
    const cats = new Set(interests.map((i) => i.category)).size;
    sub.textContent = `これまでに ${interests.length} 個、${cats} カテゴリ`;
  }
  if (active.length === 0) {
    target.replaceWith(el('p', { className: 'empty', textContent: 'いまハマっているものはありません。' }));
    return;
  }
  target.replaceChildren(
    ...active.map((i) =>
      el('li', {},
        el('a', { href: interestHref(base, i.id), textContent: i.name }),
        el('span', { className: 'cat', textContent: i.category }),
        el('span', { className: 'since num', textContent: `${fmt(i.started)} から` }),
        el('span', { className: 'count num', textContent: `${i.count} 件` }),
      ),
    ),
  );
}

function renderTable(target: HTMLElement, interests: TrailInterest[]) {
  const lede = document.querySelector<HTMLElement>('[data-list-lede]');
  if (lede) lede.textContent = `${interests.length} 個`;
  const groups = (['active', 'dormant'] as const)
    .map((status) => ({ status, items: interests.filter((i) => i.status === status) }))
    .filter((g) => g.items.length > 0);
  target.replaceChildren(
    ...groups.map((g) =>
      el('section', {},
        el('h2', {}, `${statusLabel[g.status]} `, el('span', { className: 'n num', textContent: String(g.items.length) })),
        el('table', {},
          el('thead', {},
            el('tr', {},
              ...['名前', 'カテゴリ', '始めた日', '最後の記録'].map((t) => el('th', { scope: 'col', textContent: t })),
              el('th', { scope: 'col', className: 'r', textContent: '記録' }),
            ),
          ),
          el('tbody', {},
            ...g.items.map((i) =>
              el('tr', {},
                el('th', { scope: 'row' }, el('a', { href: interestHref(base, i.id), textContent: i.name })),
                el('td', { textContent: i.category }),
                el('td', { className: 'num', textContent: fmt(i.started) }),
                el('td', { className: 'num', textContent: fmt(i.last) }),
                el('td', { className: 'num r', textContent: String(i.count) }),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

function renderDetail(target: HTMLElement, interest: TrailInterest | undefined, logs: TrailLog[]) {
  if (!interest) {
    target.replaceChildren(el('h1', { textContent: '見つかりません' }));
    return;
  }
  document.title = `${interest.name} | curiosity trail`;
  const days = new Set(logs.map((l) => l.date)).size;
  const fact = (k: string, v: string) => el('div', {}, el('dt', { textContent: k }), el('dd', { textContent: v }));
  target.replaceChildren(
    el('header', { className: 'head' },
      el('h1', { textContent: interest.name }),
      el('p', { className: 'meta' },
        el('span', { textContent: interest.category }),
        el('span', { className: `status status-${interest.status}`, textContent: statusLabel[interest.status] }),
        el('span', { className: 'num', textContent: `${fmt(interest.started)} から` }),
      ),
      interest.origin ? el('p', { className: 'summary', textContent: `きっかけ：${interest.origin}` }) : null,
    ),
    el('dl', { className: 'facts num' },
      fact('記録', `${logs.length} 件`),
      fact('動いた日', `${days} 日`),
      fact('最後の記録', fmt(interest.last)),
      fact('熱量', interest.heat ? `${interest.heat} / 5` : '—'),
    ),
    heatChart(logs) ?? '',
  );
}

/** 記録ごとの熱量を古い順に並べた棒グラフ。熱量が 1 件もなければ出さない。 */
function heatChart(logs: TrailLog[]): HTMLElement | null {
  const rows = logs.filter((l) => l.heat !== undefined);
  if (rows.length === 0) return null;
  const MAX = 5;
  const tip = el('div', { className: 'heat-tip', role: 'status' });
  tip.hidden = true;
  const plot = el('div', { className: 'heat-plot' });
  const wrap = el('div', { className: 'heat-wrap' });

  const show = (bar: HTMLElement, text: string) => {
    tip.textContent = text;
    tip.hidden = false;
    // 吹き出しが枠からはみ出さないよう、端では内側に寄せる
    const wr = wrap.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const x = br.left - wr.left + br.width / 2;
    tip.style.left = `${Math.min(Math.max(x, half), Math.max(half, wr.width - half))}px`;
  };
  const hide = () => (tip.hidden = true);

  const bars = el('ol', { className: 'heat-bars' },
    ...rows.map((l) => {
      const label = `${jpDate(l.date)} 熱量 ${l.heat}${l.action ? `｜${l.action}` : ''}`;
      const bar = el('li', { className: 'heat-bar', tabIndex: 0, ariaLabel: label });
      bar.style.setProperty('--h', `${(Math.min(l.heat!, MAX) / MAX) * 100}%`);
      bar.addEventListener('mouseenter', () => show(bar, label));
      bar.addEventListener('focus', () => show(bar, label));
      bar.addEventListener('mouseleave', hide);
      bar.addEventListener('blur', hide);
      return bar;
    }),
  );
  plot.append(bars);
  wrap.append(plot, tip);

  const axis = el('div', { className: 'heat-axis num', ariaHidden: 'true' },
    ...[5, 4, 3, 2, 1].map((n) => {
      const t = el('span', { textContent: String(n) });
      t.style.setProperty('--y', `${(n / MAX) * 100}%`);
      return t;
    }),
  );
  const first = rows[0].date;
  const last = rows.at(-1)!.date;
  const sec = el('section', { className: 'heat', ariaLabel: '熱量の変化' },
    el('h2', { textContent: '熱量の変化' }),
    el('div', { className: 'heat-chart' }, axis, wrap),
    el('p', { className: 'heat-dates num' },
      el('span', { textContent: jpDate(first, false) }),
      first !== last ? el('span', { textContent: jpDate(last, false) }) : null,
    ),
  );
  // 棒は 1 本 30px まで。記録が少ないときはグラフ自体を詰めて、日付を棒の両端に合わせる
  sec.style.setProperty('--n', String(rows.length));
  return sec;
}

const SVG = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

type CatSummary = { name: string; logs: number; items: TrailInterest[]; color: string };

function summarizeCategories(interests: TrailInterest[]): CatSummary[] {
  const map = new Map<string, CatSummary>();
  for (const i of interests) {
    const c = map.get(i.category) ?? { name: i.category, logs: 0, items: [], color: '' };
    c.items.push(i);
    c.logs += i.count;
    map.set(i.category, c);
  }
  const cats = [...map.values()].sort((a, b) => b.logs - a.logs || a.name.localeCompare(b.name, 'ja'));
  cats.forEach((c, idx) => (c.color = `var(--wc-${(idx % 8) + 1})`));
  return cats;
}

const catAnchor = (name: string) => `cat-${encodeURIComponent(name).replace(/%/g, '')}`;

async function renderCloud(target: HTMLElement, cats: CatSummary[]) {
  const font = getComputedStyle(document.body).fontFamily;
  try {
    await document.fonts.load(`32px ${font}`, 'あア亜A');
  } catch {
    /* フォントが読めなくても代わりの字で描く */
  }
  const ctx = document.createElement('canvas').getContext('2d');
  const measure = (text: string, size: number) => {
    if (!ctx) return size * text.length;
    ctx.font = `${size}px ${font}`;
    return ctx.measureText(text).width;
  };

  // 画面幅に合わせて文字の大きさと配置する枠を決める（スマホで小さい語が潰れないように）
  const boxW = Math.max(320, target.clientWidth || 1000);
  const k = Math.min(1, Math.max(0.55, boxW / 1000));
  const boxH = boxW < 640 ? boxW * 1.1 : Math.min(460, boxW * 0.45);
  type W = { text: string; size: number; width: number; height: number; href: string; color: string; strong: boolean };
  const words: W[] = [];
  if (cats.length > 0) {
    const catSize = sizeScale(cats.map((c) => c.logs), 44 * k, 96 * k);
    const all = cats.flatMap((c) => c.items);
    const itemSize = sizeScale(all.map((i) => i.count), 15, 34 * k);
    for (const c of cats) {
      const size = catSize(c.logs);
      words.push({ text: c.name, size, width: measure(c.name, size), height: size, href: `#${catAnchor(c.name)}`, color: c.color, strong: true });
      for (const i of c.items) {
        const s = itemSize(i.count);
        words.push({ text: i.name, size: s, width: measure(i.name, s), height: s, href: interestHref(base, i.id), color: c.color, strong: false });
      }
    }
  }
  const placed = layoutCloud(words, boxW, boxH, 6 * k);
  if (placed.length === 0) {
    target.replaceChildren(el('p', { className: 'empty', textContent: 'まだ記録がありません。' }));
    return;
  }
  // 実際に使った範囲に合わせて viewBox を切り、横幅いっぱいに広げる
  const pad = 8;
  const l = Math.min(...placed.map((p) => p.x - p.width / 2)) - pad;
  const r = Math.max(...placed.map((p) => p.x + p.width / 2)) + pad;
  const t = Math.min(...placed.map((p) => p.y - p.height / 2)) - pad;
  const b = Math.max(...placed.map((p) => p.y + p.height / 2)) + pad;
  const root = svg('svg', { viewBox: `${l} ${t} ${r - l} ${b - t}`, 'aria-hidden': 'true' });
  placed.forEach((p, idx) => {
    const a = svg('a', { href: p.href });
    const text = svg('text', {
      x: p.x,
      y: p.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'font-size': p.size.toFixed(1),
      fill: p.color,
    });
    if (!p.strong) text.setAttribute('fill-opacity', '0.8');
    text.style.animationDelay = `${Math.min(idx * 35, 900)}ms`;
    text.textContent = p.text;
    a.append(text);
    root.append(a);
  });
  target.replaceChildren(root);
}

function renderCategories(target: HTMLElement, cats: CatSummary[]) {
  const lede = document.querySelector<HTMLElement>('[data-category-lede]');
  if (lede) lede.textContent = `${cats.length} カテゴリ`;
  target.replaceChildren(
    ...cats.map((c) => {
      const sec = el('section', { className: 'cat-section', id: catAnchor(c.name) },
        el('h2', {}, c.name, el('span', { className: 'n num', textContent: `${c.items.length} 個・${c.logs} 件` })),
        el('ul', { className: 'cat-items' },
          ...c.items.map((i) =>
            el('li', { className: i.status },
              el('a', { href: interestHref(base, i.id), textContent: i.name }),
              el('span', { textContent: statusLabel[i.status] }),
              el('span', { className: 'num', textContent: `${i.count} 件` }),
              el('span', { className: 'num', textContent: `最後 ${fmt(i.last)}` }),
            ),
          ),
        ),
      );
      sec.style.setProperty('--c', c.color);
      return sec;
    }),
  );
}

async function main() {
  const status = document.querySelector<HTMLElement>('[data-load-status]');
  try {
    const { logs, interests } = await loadSheet(todayIso());
    status?.remove();

    const detail = document.querySelector<HTMLElement>('[data-interest-detail]');
    const name = new URLSearchParams(location.search).get('name') ?? '';
    const scoped = detail ? logs.filter((l) => l.interest === name) : logs;
    const scopedInterests = detail ? interests.filter((i) => i.id === name) : interests;
    if (detail) renderDetail(detail, scopedInterests[0], scoped);

    document.querySelectorAll<HTMLElement>('[data-trail]').forEach((root) => {
      root.hidden = detail ? scopedInterests.length === 0 : false;
      initTrail(root, scoped, scopedInterests, base);
    });

    const now = document.querySelector<HTMLElement>('[data-now-list]');
    if (now) renderNow(now, interests);
    const table = document.querySelector<HTMLElement>('[data-interest-table]');
    if (table) renderTable(table, interests);
    const cloud = document.querySelector<HTMLElement>('[data-cloud]');
    const catList = document.querySelector<HTMLElement>('[data-category-list]');
    if (cloud || catList) {
      const cats = summarizeCategories(interests);
      if (catList) renderCategories(catList, cats);
      if (cloud) await renderCloud(cloud, cats);
    }
  } catch (e) {
    console.error(e);
    if (status) status.textContent = '記録を読み込めませんでした。時間をおいて開き直してください。';
  }
}

main();
