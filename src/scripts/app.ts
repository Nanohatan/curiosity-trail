// ページを開いたときにシートを読み、草・一覧・個別ページを描く。
import { loadSheet, statusLabel } from '../lib/sheet';
import { todayIso, type TrailInterest, type TrailLog } from '../lib/trail';
import { el, initTrail, interestHref } from './trail-client';

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
  } catch (e) {
    console.error(e);
    if (status) status.textContent = '記録を読み込めませんでした。時間をおいて開き直してください。';
  }
}

main();
