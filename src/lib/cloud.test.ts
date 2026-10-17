import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutCloud, sizeScale } from './cloud.ts';

test('語が重ならず、枠に収まる', () => {
  const words = Array.from({ length: 30 }, (_, i) => {
    const size = 14 + (i % 7) * 8;
    return { text: `語${i}`, size, width: size * 3, height: size };
  });
  const placed = layoutCloud(words, 800, 400);
  assert.ok(placed.length >= 20);
  assert.equal(placed[0].size, Math.max(...words.map((w) => w.size)));
  for (const p of placed) {
    assert.ok(Math.abs(p.x) + p.width / 2 <= 400 && Math.abs(p.y) + p.height / 2 <= 200);
  }
  for (let i = 0; i < placed.length; i++)
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i], b = placed[j];
      const sepX = Math.abs(a.x - b.x) >= (a.width + b.width) / 2;
      const sepY = Math.abs(a.y - b.y) >= (a.height + b.height) / 2;
      assert.ok(sepX || sepY, `${a.text} と ${b.text} が重なっている`);
    }
});

test('文字サイズの尺度', () => {
  const s = sizeScale([1, 4, 16], 10, 40);
  assert.equal(s(1), 10);
  assert.equal(s(16), 40);
  assert.equal(sizeScale([3, 3], 10, 40)(3), 25);
});
