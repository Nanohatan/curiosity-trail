import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toDay, fromDay, weekday, periodRange, level, periodStats, streakEndingAt, bucketByDay,
  type TrailLog,
} from './trail.ts';

test('日付の往復', () => {
  assert.equal(fromDay(toDay('2026-10-17')), '2026-10-17');
  assert.equal(fromDay(toDay('2024-02-29')), '2024-02-29');
});

test('曜日は月曜始まり', () => {
  assert.equal(weekday(toDay('2026-10-12')), 0); // 月
  assert.equal(weekday(toDay('2026-10-17')), 5); // 土
  assert.equal(weekday(toDay('2026-10-18')), 6); // 日
});

test('期間の範囲', () => {
  const w = periodRange('week', '2026-10-17');
  assert.equal(fromDay(w.current.start), '2026-10-12');
  assert.equal(fromDay(w.current.end), '2026-10-18');
  assert.equal(fromDay(w.previous.start), '2026-10-05');
  const m = periodRange('month', '2026-03-15');
  assert.equal(fromDay(m.current.start), '2026-03-01');
  assert.equal(fromDay(m.current.end), '2026-03-31');
  assert.equal(fromDay(m.previous.start), '2026-02-01');
  assert.equal(fromDay(m.previous.end), '2026-02-28');
  const j = periodRange('month', '2026-01-10');
  assert.equal(fromDay(j.previous.start), '2025-12-01');
  const y = periodRange('year', '2026-10-17');
  assert.equal(fromDay(y.current.start), '2026-01-01');
  assert.equal(fromDay(y.previous.end), '2025-12-31');
});

test('色の段階', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map((v) => level(v, 'actions')), [0, 1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([0, 1, 2, 3, 4, 7].map((v) => level(v, 'categories')), [0, 1, 2, 3, 4, 4]);
});

const L = (date: string, interest: string, category: string): TrailLog => ({ date, interest, category, action: 'x' });

test('期間の統計', () => {
  const logs = [
    L('2026-10-12', 'a', '料理'), L('2026-10-13', 'a', '料理'), L('2026-10-13', 'b', '運動'),
    L('2026-10-14', 'b', '運動'), L('2026-10-17', 'c', '本'), L('2026-10-05', 'a', '料理'),
  ];
  const interests = [
    { id: 'a', name: 'A', category: '料理', started: '2026-01-01', last: '2026-10-13', status: 'active' as const, count: 3 },
    { id: 'c', name: 'C', category: '本', started: '2026-10-16', last: '2026-10-17', status: 'active' as const, count: 1 },
  ];
  const s = periodStats(logs, interests, 'week', '2026-10-17');
  assert.equal(s.actions, 5);
  assert.equal(s.activeDays, 4);
  assert.equal(s.elapsedDays, 6);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.previousActions, 1);
  assert.deepEqual(s.newInterests, ['c']);
  assert.deepEqual(s.categories.map((c) => c.name), ['運動', '料理', '本']);
  const days = new Set(bucketByDay(logs).keys());
  assert.equal(streakEndingAt(days, toDay('2026-10-14')), 3);
});
