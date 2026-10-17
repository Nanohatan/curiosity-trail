// ワードクラウドの配置。大きい語から順に、中心から渦巻き状に空いている場所を探す。

export type CloudWord = { text: string; size: number; width: number; height: number };
export type Placed<W extends CloudWord> = W & { x: number; y: number }; // x, y は語の中心

type Box = { l: number; t: number; r: number; b: number };

function box(x: number, y: number, w: CloudWord, pad: number): Box {
  return { l: x - w.width / 2 - pad, t: y - w.height / 2 - pad, r: x + w.width / 2 + pad, b: y + w.height / 2 + pad };
}

const overlaps = (a: Box, b: Box) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

/**
 * 横 width × 縦 height の楕円に収まるように並べる。置けなかった語は返さない。
 * 結果は入力の順に関係なく、大きい語から並ぶ。
 */
export function layoutCloud<W extends CloudWord>(words: W[], width: number, height: number, pad = 4): Placed<W>[] {
  const placed: Placed<W>[] = [];
  const boxes: Box[] = [];
  const aspect = width / height;
  const sorted = [...words].sort((a, b) => b.size - a.size || a.text.localeCompare(b.text, 'ja'));
  for (const w of sorted) {
    for (let t = 0; t < 2000; t++) {
      const angle = t * 0.35;
      const r = 2.2 * Math.sqrt(t) * 6;
      const x = Math.cos(angle) * r * aspect * 0.75;
      const y = Math.sin(angle) * r * 0.75;
      const bx = box(x, y, w, pad);
      if (Math.abs(bx.l) > width / 2 || Math.abs(bx.r) > width / 2 || Math.abs(bx.t) > height / 2 || Math.abs(bx.b) > height / 2) {
        continue;
      }
      if (boxes.some((o) => overlaps(o, bx))) continue;
      placed.push({ ...w, x, y });
      boxes.push(bx);
      break;
    }
  }
  return placed;
}

/** 値を [min, max] の文字サイズへ（平方根で、差がつきすぎないように）。 */
export function sizeScale(values: number[], min: number, max: number): (v: number) => number {
  const lo = Math.sqrt(Math.min(...values));
  const hi = Math.sqrt(Math.max(...values));
  return (v) => (hi === lo ? (min + max) / 2 : min + ((Math.sqrt(v) - lo) / (hi - lo)) * (max - min));
}
