// 日付と統計の計算。ブラウザでもビルド時でも使う純粋な関数だけを置く。

export type TrailLog = {
  date: string; // YYYY-MM-DD
  interest: string; // ハマりごとの名前（＝id）
  category: string;
  action: string;
  heat?: number; // 熱量 1〜5
  origin?: string; // きっかけ
};

export type TrailInterest = {
  id: string;
  name: string;
  category: string;
  started: string; // 最初の記録の日
  last: string; // 最後の記録の日
  status: 'active' | 'dormant';
  origin?: string;
  heat?: number; // 最新の熱量
  count: number;
};

export type Period = 'week' | 'month' | 'year';
export type Metric = 'actions' | 'categories';

const DAY = 86_400_000;

/** YYYY-MM-DD を「1970-01-01 からの日数」に。タイムゾーンに左右されない。 */
export function toDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

export function fromDay(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}

/** 閲覧者のローカル時刻での今日。 */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 0 = 月曜 … 6 = 日曜 */
export function weekday(day: number): number {
  return (new Date(day * DAY).getUTCDay() + 6) % 7;
}

export type Range = { start: number; end: number }; // 両端を含む

/** today を含む期間と、その 1 つ前の同じ長さの期間。 */
export function periodRange(period: Period, today: string): { current: Range; previous: Range } {
  const t = toDay(today);
  const [y, m] = today.split('-').map(Number);
  if (period === 'week') {
    const start = t - weekday(t);
    return {
      current: { start, end: start + 6 },
      previous: { start: start - 7, end: start - 1 },
    };
  }
  if (period === 'month') {
    const start = toDay(`${y}-${String(m).padStart(2, '0')}-01`);
    const nextStart = Math.round(Date.UTC(y, m, 1) / DAY);
    const prevStart = Math.round(Date.UTC(y, m - 2, 1) / DAY);
    return {
      current: { start, end: nextStart - 1 },
      previous: { start: prevStart, end: start - 1 },
    };
  }
  const start = toDay(`${y}-01-01`);
  return {
    current: { start, end: toDay(`${y}-12-31`) },
    previous: { start: toDay(`${y - 1}-01-01`), end: start - 1 },
  };
}

export type DayBucket = { actions: number; categories: Set<string>; logs: TrailLog[] };

export function bucketByDay(logs: TrailLog[]): Map<number, DayBucket> {
  const map = new Map<number, DayBucket>();
  for (const log of logs) {
    const day = toDay(log.date);
    let b = map.get(day);
    if (!b) {
      b = { actions: 0, categories: new Set(), logs: [] };
      map.set(day, b);
    }
    b.actions += 1;
    b.categories.add(log.category);
    b.logs.push(log);
  }
  return map;
}

export function metricValue(bucket: DayBucket | undefined, metric: Metric): number {
  if (!bucket) return 0;
  return metric === 'actions' ? bucket.actions : bucket.categories.size;
}

/** 色の濃さ 0〜4。アクション数とカテゴリ数で刻み方を変える。 */
export function level(value: number, metric: Metric): number {
  if (value <= 0) return 0;
  const steps = metric === 'actions' ? [1, 2, 4, 6] : [1, 2, 3, 4];
  let lv = 0;
  for (const s of steps) if (value >= s) lv += 1;
  return lv;
}

/** 連続して記録した日数。end から遡って数える。 */
export function streakEndingAt(days: Set<number>, end: number): number {
  let n = 0;
  while (days.has(end - n)) n += 1;
  return n;
}

export function longestStreak(days: Set<number>, range: Range): number {
  let best = 0;
  let run = 0;
  for (let d = range.start; d <= range.end; d++) {
    run = days.has(d) ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export type PeriodStats = {
  range: Range;
  elapsedDays: number;
  actions: number;
  activeDays: number;
  categories: Array<{ name: string; count: number }>;
  interests: Array<{ id: string; count: number }>;
  newInterests: string[];
  longestStreak: number;
  previousActions: number;
};

function countBy<T>(items: T[], key: (t: T) => string): Array<{ name: string; count: number }> {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
}

export function periodStats(
  logs: TrailLog[],
  interests: TrailInterest[],
  period: Period,
  today: string,
): PeriodStats {
  const { current, previous } = periodRange(period, today);
  const t = toDay(today);
  const inRange = (r: Range) => (l: TrailLog) => {
    const d = toDay(l.date);
    return d >= r.start && d <= r.end;
  };
  const cur = logs.filter(inRange(current));
  const days = new Set(cur.map((l) => toDay(l.date)));
  return {
    range: current,
    elapsedDays: Math.min(t, current.end) - current.start + 1,
    actions: cur.length,
    activeDays: days.size,
    categories: countBy(cur, (l) => l.category),
    interests: countBy(cur, (l) => l.interest).map(({ name, count }) => ({ id: name, count })),
    newInterests: interests
      .filter((i) => {
        const d = toDay(i.started);
        return d >= current.start && d <= current.end;
      })
      .map((i) => i.id),
    longestStreak: longestStreak(days, current),
    previousActions: logs.filter(inRange(previous)).length,
  };
}
