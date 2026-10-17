import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse } from 'yaml';

// "2026-10-17" 形式の日付。YAML が Date に変換しても文字列に戻す。
const isoDate = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付は YYYY-MM-DD 形式で書いてください'),
);

// ハマったもの。src/content/interests/<id>.md に 1 つずつ書く。
const interests = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/interests' }),
  schema: z.object({
    name: z.string(),
    category: z.string(),
    started: isoDate,
    status: z.enum(['active', 'paused', 'done']).default('active'),
    summary: z.string().optional(),
  }),
});

// 行動の記録。src/data/logs.yaml にリストで追記していく。id は自動で振る。
const logs = defineCollection({
  loader: file('src/data/logs.yaml', {
    parser: (text) => {
      const items = (parse(text) ?? []) as Array<Record<string, unknown>>;
      return items.map((item, i) => ({ id: `log-${i + 1}`, ...item }));
    },
  }),
  schema: z.object({
    date: isoDate,
    interest: reference('interests'),
    action: z.string(),
    kind: z.string().optional(),
    note: z.string().optional(),
    url: z.url().optional(),
  }),
});

export const collections = { interests, logs };
