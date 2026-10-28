// ページを開いたときにシートを読み、草・一覧・個別ページを描く。
import { bookLink, coverUrl, loadBooks, type Book } from '../lib/books';
import { layoutCloud, sizeScale } from '../lib/cloud';
import { loadSheet, statusLabel } from '../lib/sheet';
import { fromDay, toDay, todayIso, type TrailInterest, type TrailLog } from '../lib/trail';
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
  );
}

/** 熱量の折れ線グラフ。横軸は日付。熱量が 1 件もなければ出さない。 */
function heatChart(logs: TrailLog[]): HTMLElement | null {
  const rows = logs.filter((l) => l.heat !== undefined);
  if (rows.length === 0) return null;
  const MAX = 5;
  const H = 160; // 描画領域の高さ（px）
  const PAD = { top: 10, right: 10, bottom: 24, left: 24 };

  const wrap = el('div', { className: 'heat-wrap' });
  const tip = el('div', { className: 'heat-tip' });
  tip.hidden = true;
  const sec = el('section', { className: 'heat', ariaLabel: '熱量の変化' },
    el('h3', { textContent: '熱量の変化' }),
    wrap,
  );

  const days = rows.map((l) => toDay(l.date));
  const d0 = days[0];
  const d1 = days.at(-1)!;

  function draw() {
    const W = Math.max(240, wrap.clientWidth);
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const xOf = (d: number) => PAD.left + (d1 === d0 ? iw / 2 : ((d - d0) / (d1 - d0)) * iw);
    const yOf = (v: number) => PAD.top + ih - (v / MAX) * ih;
    const pts = rows.map((l, i) => ({ l, x: xOf(days[i]), y: yOf(l.heat!) }));

    const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `熱量の変化：${rows.map((l) => `${jpDate(l.date, false)} ${l.heat}`).join('、')}` });
    // 目盛り線と数字（1〜5）
    for (let v = 1; v <= MAX; v++) {
      root.append(svg('line', { class: 'heat-grid', x1: PAD.left, x2: W - PAD.right, y1: yOf(v), y2: yOf(v) }));
      const t = svg('text', { class: 'heat-label', x: PAD.left - 8, y: yOf(v), 'text-anchor': 'end', 'dominant-baseline': 'central' });
      t.textContent = String(v);
      root.append(t);
    }
    root.append(svg('line', { class: 'heat-base', x1: PAD.left, x2: W - PAD.right, y1: yOf(0), y2: yOf(0) }));
    // 最初と最後の日付
    const dateLabel = (d: number, anchor: string) => {
      const t = svg('text', { class: 'heat-label', x: xOf(d), y: H - 6, 'text-anchor': anchor });
      t.textContent = jpDate(fromDay(d), false);
      root.append(t);
    };
    dateLabel(d0, d1 === d0 ? 'middle' : 'start');
    if (d1 !== d0) dateLabel(d1, 'end');

    const cross = svg('line', { class: 'heat-cross', y1: PAD.top, y2: PAD.top + ih, x1: 0, x2: 0, visibility: 'hidden' });
    root.append(cross);
    if (pts.length > 1) {
      root.append(svg('polyline', { class: 'heat-line', points: pts.map((p) => `${p.x},${p.y}`).join(' ') }));
    }
    const dots = pts.map((p) => {
      const c = svg('circle', { class: 'heat-dot', cx: p.x, cy: p.y, r: 4 });
      root.append(c);
      return c;
    });

    // いちばん近い点を拾って吹き出しを出す
    let active = -1;
    const focus = (i: number) => {
      if (i === active) return;
      if (active >= 0) dots[active].setAttribute('r', '4');
      active = i;
      if (i < 0) {
        tip.hidden = true;
        cross.setAttribute('visibility', 'hidden');
        return;
      }
      const p = pts[i];
      dots[i].setAttribute('r', '6');
      cross.setAttribute('x1', String(p.x));
      cross.setAttribute('x2', String(p.x));
      cross.setAttribute('visibility', 'visible');
      tip.textContent = `${jpDate(p.l.date)} 熱量 ${p.l.heat}${p.l.action ? `｜${p.l.action}` : ''}`;
      tip.hidden = false;
      const half = tip.offsetWidth / 2;
      tip.style.left = `${Math.min(Math.max(p.x, half), Math.max(half, W - half))}px`;
    };
    const nearest = (clientX: number) => {
      const x = clientX - root.getBoundingClientRect().left;
      let best = 0;
      for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].x - x) < Math.abs(pts[best].x - x)) best = i;
      return best;
    };
    root.addEventListener('pointermove', (e) => focus(nearest(e.clientX)));
    root.addEventListener('pointerleave', () => focus(-1));
    root.tabIndex = 0;
    root.addEventListener('focus', () => focus(pts.length - 1));
    root.addEventListener('blur', () => focus(-1));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') focus(Math.max(0, active - 1));
      else if (e.key === 'ArrowRight') focus(Math.min(pts.length - 1, active + 1));
      else return;
      e.preventDefault();
    });
    wrap.replaceChildren(root, tip);
  }

  // 幅が決まってから描き、画面幅が変わったら描き直す
  let lastW = 0;
  new ResizeObserver(() => {
    if (wrap.clientWidth !== lastW) {
      lastW = wrap.clientWidth;
      draw();
    }
  }).observe(wrap);
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

function renderBooks(target: HTMLElement, books: Book[]) {
  const lede = document.querySelector<HTMLElement>('[data-books-lede]');
  if (lede) lede.textContent = `${books.length} 冊`;
  if (books.length === 0) {
    target.replaceWith(el('p', { className: 'empty', textContent: 'まだ本がありません。' }));
    return;
  }
  target.replaceChildren(
    ...books.map((b, idx) => {
      const plain = el('span', { className: 'book-plain', textContent: b.title, ariaHidden: 'true' });
      const cover = el('span', { className: 'book-cover' }, plain);
      cover.style.setProperty('--c', `var(--wc-${(idx % 8) + 1})`);
      if (/^\d{13}$/.test(b.isbn)) {
        // 書影が読めたときだけ、色の表紙の上に重ねる
        const img = el('img', { src: coverUrl(b.isbn), alt: '', loading: 'lazy', decoding: 'async' });
        // display:none だと遅延読み込みが始まらないので、透明にして待つ
        img.style.opacity = '0';
        img.addEventListener('load', () => {
          if (img.naturalWidth > 1) img.style.opacity = '1';
          else img.remove();
        });
        img.addEventListener('error', () => img.remove());
        cover.append(img);
      }
      const meta = [b.authors.join('／'), [b.publisher, b.published].filter(Boolean).join('・')].filter(Boolean);
      return el('li', { className: 'book' },
        el('a', { href: bookLink(b), target: '_blank', rel: 'noopener' },
          cover,
          el('p', { className: 'book-title', textContent: b.title }),
          ...meta.map((m) => el('p', { className: 'book-meta', textContent: m })),
        ),
      );
    }),
  );
}

async function main() {
  const status = document.querySelector<HTMLElement>('[data-load-status]');
  const shelf = document.querySelector<HTMLElement>('[data-books]');
  if (shelf) {
    try {
      renderBooks(shelf, await loadBooks());
      status?.remove();
    } catch (e) {
      console.error(e);
      if (status) status.textContent = '本の一覧を読み込めませんでした。時間をおいて開き直してください。';
    }
    return;
  }
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
      // 個別ページでは、熱量のグラフを「最近の記録」の上に置く
      if (detail) {
        const chart = heatChart(scoped);
        const recent = root.querySelector('[data-detail]');
        if (chart && recent) recent.before(chart);
      }
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
