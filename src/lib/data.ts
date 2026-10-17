import { getCollection } from 'astro:content';
import type { TrailInterest, TrailLog } from './trail';

/** ビルド時にコレクションを読み、ブラウザに渡せる形に揃える。 */
export async function loadTrail() {
  const interestEntries = await getCollection('interests');
  const interests: TrailInterest[] = interestEntries
    .map((e) => ({
      id: e.id,
      name: e.data.name,
      category: e.data.category,
      started: e.data.started,
      status: e.data.status,
    }))
    .sort((a, b) => b.started.localeCompare(a.started));
  const byId = new Map(interests.map((i) => [i.id, i]));

  const logs: TrailLog[] = (await getCollection('logs'))
    .map((e) => {
      const interest = byId.get(e.data.interest.id);
      return {
        date: e.data.date,
        interest: e.data.interest.id,
        category: interest?.category ?? '未分類',
        action: e.data.action,
        kind: e.data.kind,
        note: e.data.note,
        url: e.data.url,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return { interests, interestEntries, logs };
}

export const statusLabel = { active: 'ハマり中', paused: '休憩中', done: '卒業' } as const;

/** <script type="application/json"> に安全に埋め込むための JSON。 */
export function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
