import {
  bucketByDay, fromDay, level, metricValue, periodStats, streakEndingAt, toDay, todayIso, weekday,
  type Metric, type Period, type TrailInterest, type TrailLog, type DayBucket,
} from '../lib/trail';

type Payload = { logs: TrailLog[]; interests: TrailInterest[]; base: string };

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
const METRIC_TEXT: Record<Metric, { unit: string; caption: string }> = {
  actions: { unit: '件', caption: '1日に記録したアクションの数' },
  categories: { unit: 'カテゴリ', caption: '1日に触れたカテゴリの数' },
};
const PERIOD_TEXT: Record<Period, { prev: string }> = {
  week: { prev: '先週' },
  month: { prev: '先月' },
  year: { prev: '去年' },
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function jpDate(iso: string, withWeekday = true): string {
  const [, m, d] = iso.split('-').map(Number);
  const wd = withWeekday ? `（${WEEKDAYS[weekday(toDay(iso))]}）` : '';
  return `${m}月${d}日${wd}`;
}

function store(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* 保存できない環境では何もしない */
  }
  return null;
}

function init(root: HTMLElement) {
  const json = root.querySelector<HTMLScriptElement>('[data-trail-json]');
  if (!json) return;
  const { logs, interests, base } = JSON.parse(json.textContent || '{}') as Payload;
  const interestById = new Map(interests.map((i) => [i.id, i]));
  const buckets = bucketByDay(logs);
  const today = todayIso();
  const todayDay = toDay(today);

  const grid = root.querySelector<HTMLElement>('[data-grid]')!;
  const months = root.querySelector<HTMLElement>('[data-months]')!;
  const scroller = root.querySelector<HTMLElement>('[data-scroll]')!;
  const rangeSelect = root.querySelector<HTMLSelectElement>('[data-range]')!;
  const caption = root.querySelector<HTMLElement>('[data-caption]')!;
  const total = root.querySelector<HTMLElement>('[data-total]')!;
  const detail = root.querySelector<HTMLElement>('[data-detail]')!;
  const statsEl0 = root.querySelector<HTMLElement>('[data-stats]');
  // 連続記録の表示は統計付きの草（トップページ）だけが担当する
  const streakEl = statsEl0 ? document.querySelector<HTMLElement>('[data-streak]') : null;
  const statsEl = statsEl0;

  let metric: Metric = store('trail-metric') === 'categories' ? 'categories' : 'actions';
  let selected: number | null = null;
  let focusDay = todayDay;

  // 表示できる年の候補
  const years = new Set<number>([Number(today.slice(0, 4))]);
  for (const l of logs) years.add(Number(l.date.slice(0, 4)));
  for (const y of [...years].sort((a, b) => b - a)) {
    rangeSelect.append(el('option', { value: String(y), textContent: `${y}年` }));
  }

  function interestHref(id: string) {
    return `${base}interests/${id}/`;
  }

  function currentRange(): { start: number; end: number } {
    if (rangeSelect.value === 'recent') {
      const end = todayDay + (6 - weekday(todayDay));
      return { start: end - 52 * 7 - 6, end };
    }
    const y = Number(rangeSelect.value);
    const first = toDay(`${y}-01-01`);
    const last = toDay(`${y}-12-31`);
    return { start: first - weekday(first), end: last + (6 - weekday(last)) };
  }

  function visibleBounds(): { from: number; to: number } {
    if (rangeSelect.value === 'recent') {
      const r = currentRange();
      return { from: r.start, to: todayDay };
    }
    const y = Number(rangeSelect.value);
    return { from: toDay(`${y}-01-01`), to: toDay(`${y}-12-31`) };
  }

  function renderGrid() {
    const { start, end } = currentRange();
    const { from, to } = visibleBounds();
    grid.replaceChildren();
    months.replaceChildren();
    grid.dataset.metric = metric;
    root.dataset.metric = metric;

    if (focusDay < from || focusDay > Math.min(to, todayDay)) {
      focusDay = Math.min(to, todayDay) >= from ? Math.min(to, todayDay) : from;
    }

    let sum = 0;
    let lastMonth = -1;
    let lastLabelCol = -10;
    for (let d = start; d <= end; d++) {
      const iso = fromDay(d);
      const col = Math.floor((d - start) / 7);
      if (weekday(d) === 0) {
        const firstOfWeekInRange = Math.max(d, from);
        const m = Number(fromDay(firstOfWeekInRange).slice(5, 7));
        if (m !== lastMonth && firstOfWeekInRange <= to && firstOfWeekInRange <= d + 6) {
          // 端の月が 1〜2 週しかないときは、ラベルが重ならないよう前のを外す
          if (col - lastLabelCol < 3) months.lastElementChild?.remove();
          const label = el('span', { textContent: `${m}月` });
          label.style.gridColumnStart = String(col + 1);
          months.append(label);
          lastMonth = m;
          lastLabelCol = col;
        }
      }
      if (d < from || d > to) {
        grid.append(el('span', { className: 'cell cell-empty', ariaHidden: 'true' }));
        continue;
      }
      const bucket = buckets.get(d);
      const value = metricValue(bucket, metric);
      if (d <= todayDay) sum += value;
      const lv = level(value, metric);
      const future = d > todayDay;
      const btn = el('button', {
        type: 'button',
        className: `cell lv-${lv}${future ? ' cell-future' : ''}`,
        tabIndex: d === focusDay ? 0 : -1,
        disabled: future,
      });
      btn.dataset.day = String(d);
      const label = `${jpDate(iso)} ${value === 0 ? '記録なし' : `${value}${METRIC_TEXT[metric].unit}`}`;
      btn.setAttribute('aria-label', label);
      btn.title = label;
      if (d === selected) btn.setAttribute('aria-pressed', 'true');
      grid.append(btn);
    }
    const days = end - start + 1;
    grid.style.setProperty('--cols', String(Math.ceil(days / 7)));
    months.style.setProperty('--cols', String(Math.ceil(days / 7)));
    caption.textContent = METRIC_TEXT[metric].caption;
    const unit = metric === 'actions' ? '件のアクション' : 'カテゴリ・日';
    total.textContent = `${sum.toLocaleString('ja-JP')} ${unit}`;
  }

  function logItem(log: TrailLog, showDate: boolean) {
    const interest = interestById.get(log.interest);
    const what = log.url
      ? el('a', { href: log.url, textContent: log.action, rel: 'noopener' })
      : log.action;
    return el(
      'li',
      { className: 'log' },
      showDate ? el('time', { className: 'log-date num', dateTime: log.date, textContent: jpDate(log.date, false) }) : null,
      el(
        'div',
        { className: 'log-body' },
        el('p', { className: 'log-action' }, what),
        el(
          'p',
          { className: 'log-meta' },
          el('a', { href: interestHref(log.interest), textContent: interest?.name ?? log.interest }),
          el('span', { className: 'log-cat', textContent: log.category }),
          log.kind ? el('span', { className: 'log-kind', textContent: log.kind }) : null,
        ),
        log.note ? el('p', { className: 'log-note', textContent: log.note }) : null,
      ),
    );
  }

  function renderDetail() {
    detail.replaceChildren();
    if (selected === null) {
      const recent = logs.slice(-5).reverse();
      detail.append(el('h3', { textContent: '最近の記録' }));
      if (recent.length === 0) {
        detail.append(el('p', { className: 'empty', textContent: 'まだ記録がありません。src/data/logs.yaml に書き足すと、ここに並びます。' }));
        return;
      }
      detail.append(el('ul', { className: 'logs' }, ...recent.map((l) => logItem(l, true))));
      return;
    }
    const iso = fromDay(selected);
    const bucket: DayBucket | undefined = buckets.get(selected);
    const head = el(
      'div',
      { className: 'detail-head' },
      el('h3', { textContent: jpDate(iso) }),
      el('button', { type: 'button', className: 'link-button', textContent: '最近の記録に戻る', onclick: () => select(null) }),
    );
    detail.append(head);
    if (!bucket) {
      detail.append(el('p', { className: 'empty', textContent: 'この日の記録はありません。' }));
      return;
    }
    detail.append(
      el('p', { className: 'detail-sum num', textContent: `${bucket.actions}件のアクション、${bucket.categories.size}カテゴリ` }),
      el('ul', { className: 'logs' }, ...bucket.logs.map((l) => logItem(l, false))),
    );
  }

  function select(day: number | null) {
    selected = day === selected ? null : day;
    if (day !== null) focusDay = day;
    renderGrid();
    renderDetail();
  }

  grid.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button.cell');
    if (!btn) return;
    select(Number(btn.dataset.day));
    grid.querySelector<HTMLButtonElement>(`[data-day="${btn.dataset.day}"]`)?.focus();
  });

  // 矢印キーで日付を移動（ローヴィング tabindex）
  grid.addEventListener('keydown', (e) => {
    const moves: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };
    if (!(e.key in moves)) return;
    const target = focusDay + moves[e.key];
    const next = grid.querySelector<HTMLButtonElement>(`button[data-day="${target}"]:not(:disabled)`);
    if (!next) return;
    e.preventDefault();
    grid.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.setAttribute('tabindex', '-1');
    next.tabIndex = 0;
    next.focus();
    focusDay = target;
  });

  root.querySelectorAll<HTMLInputElement>('input[data-metric]').forEach((input) => {
    input.checked = input.value === metric;
    input.addEventListener('change', () => {
      metric = input.value as Metric;
      store('trail-metric', metric);
      renderGrid();
    });
  });

  rangeSelect.addEventListener('change', () => {
    renderGrid();
    scrollToRecent();
  });

  function scrollToRecent() {
    const cell = grid.querySelector<HTMLElement>(`[data-day="${focusDay}"]`);
    if (cell) scroller.scrollLeft = Math.max(0, cell.offsetLeft - scroller.clientWidth + 48);
  }

  // 連続記録
  if (streakEl) {
    const days = new Set(buckets.keys());
    const n = streakEndingAt(days, todayDay) || streakEndingAt(days, todayDay - 1);
    streakEl.textContent = n > 1 ? `${n}日連続で記録中` : '';
    streakEl.hidden = n <= 1;
  }

  // 期間の統計
  if (statsEl) {
    const tabs = [...statsEl.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const panel = statsEl.querySelector<HTMLElement>('[role="tabpanel"]')!;
    let period = (store('trail-period') as Period | null) ?? 'month';
    if (!['week', 'month', 'year'].includes(period)) period = 'month';

    const renderStats = () => {
      tabs.forEach((t) => {
        const on = t.dataset.period === period;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (on) panel.setAttribute('aria-labelledby', t.id);
      });
      const s = periodStats(logs, interests, period, today);
      const diff = s.actions - s.previousActions;
      const diffText = diff === 0 ? `${PERIOD_TEXT[period].prev}と同じ` : `${PERIOD_TEXT[period].prev}より ${diff > 0 ? '+' : '−'}${Math.abs(diff)}`;

      const figure = (value: string, label: string, sub?: string) =>
        el('div', { className: 'figure' },
          el('dt', { textContent: label }),
          el('dd', {}, el('span', { className: 'figure-value num', textContent: value }), sub ? el('span', { className: 'figure-sub', textContent: sub }) : null),
        );

      const bars = (title: string, rows: Array<{ label: string; count: number; href?: string }>) => {
        const max = Math.max(1, ...rows.map((r) => r.count));
        return el('div', { className: 'bars' },
          el('h3', { textContent: title }),
          rows.length === 0
            ? el('p', { className: 'empty', textContent: 'この期間の記録はまだありません。' })
            : el('ol', {}, ...rows.slice(0, 6).map((r) => {
                const li = el('li', {},
                  el('span', { className: 'bar-label' }, r.href ? el('a', { href: r.href, textContent: r.label }) : r.label),
                  el('span', { className: 'bar-track', ariaHidden: 'true' }, el('span', { className: 'bar-fill' })),
                  el('span', { className: 'bar-count num', textContent: String(r.count) }),
                );
                (li.querySelector('.bar-fill') as HTMLElement).style.width = `${(r.count / max) * 100}%`;
                return li;
              })),
        );
      };

      panel.replaceChildren(
        el('p', { className: 'stats-range num', textContent: `${jpDate(fromDay(s.range.start), false)}〜${jpDate(fromDay(s.range.end), false)}` }),
        el('dl', { className: 'figures' },
          figure(String(s.actions), 'アクション', diffText),
          figure(`${s.activeDays}`, '活動した日', `${s.elapsedDays}日のうち`),
          figure(String(s.categories.length), '触れたカテゴリ'),
          figure(String(s.newInterests.length), '新しくハマったもの',
            s.newInterests.map((id) => interestById.get(id)?.name ?? id).join('、') || undefined),
          figure(`${s.longestStreak}日`, '最長の連続記録'),
        ),
        el('div', { className: 'breakdown' },
          bars('カテゴリ別', s.categories.map((c) => ({ label: c.name, count: c.count }))),
          bars('よく動いたハマりごと', s.interests.map((i) => ({
            label: interestById.get(i.id)?.name ?? i.id, count: i.count, href: interestHref(i.id),
          }))),
        ),
      );
    };

    tabs.forEach((t, idx) => {
      t.addEventListener('click', () => {
        period = t.dataset.period as Period;
        store('trail-period', period);
        renderStats();
      });
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        next.focus();
        next.click();
      });
    });
    renderStats();
  }

  renderGrid();
  renderDetail();
  scrollToRecent();
}

document.querySelectorAll<HTMLElement>('[data-trail]').forEach(init);
