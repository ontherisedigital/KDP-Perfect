/**
 * The shape library: every box, calendar slot and frame in the designer can take any of these shapes. Each shape is
 * generated to fill a w x h box (local coordinates, origin top-left) so it stretches with the element.
 */

import { ellipsePath, polygonPath, rectPath, type Path, type Seg } from './geometry';

export type ShapeId =
  | 'rect'
  | 'rounded'
  | 'ellipse'
  | 'hexagon'
  | 'octagon'
  | 'diamond'
  | 'heart'
  | 'star'
  | 'flower'
  | 'cloud'
  | 'arch'
  | 'ticket'
  | 'bubble'
  | 'leaf'
  | 'shield'
  | 'tag'
  | 'banner'
  | 'pill'
  | 'drop';

export const SHAPES: readonly { id: ShapeId; label: string; fun?: boolean }[] = [
  { id: 'rect', label: 'Rectangle / square' },
  { id: 'rounded', label: 'Rounded (corner slider)' },
  { id: 'pill', label: 'Pill' },
  { id: 'ellipse', label: 'Circle / oval' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'octagon', label: 'Octagon' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'arch', label: 'Arch' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'tag', label: 'Tag' },
  { id: 'banner', label: 'Banner' },
  { id: 'shield', label: 'Shield' },
  { id: 'bubble', label: 'Speech bubble', fun: true },
  { id: 'heart', label: 'Heart', fun: true },
  { id: 'star', label: 'Star', fun: true },
  { id: 'flower', label: 'Flower', fun: true },
  { id: 'cloud', label: 'Cloud', fun: true },
  { id: 'leaf', label: 'Leaf', fun: true },
  { id: 'drop', label: 'Water drop', fun: true },
];

/** `corner` is 0 (sharp) to 0.5 (fully round) of the shorter side, used by `rounded` and `ticket`. */
export function shapePath(id: ShapeId, w: number, h: number, corner = 0.15): Path {
  const m = Math.min(w, h);
  switch (id) {
    case 'rect':
      return rectPath(0, 0, w, h);
    case 'rounded':
      return rectPath(0, 0, w, h, Math.max(0, Math.min(0.5, corner)) * m);
    case 'pill':
      return rectPath(0, 0, w, h, m / 2);
    case 'ellipse':
      return ellipsePath(w / 2, h / 2, w / 2, h / 2);
    case 'hexagon': {
      const k = w * 0.25;
      return polygonPath([[k, 0], [w - k, 0], [w, h / 2], [w - k, h], [k, h], [0, h / 2]]);
    }
    case 'octagon': {
      const kx = w * 0.29;
      const ky = h * 0.29;
      return polygonPath([[kx, 0], [w - kx, 0], [w, ky], [w, h - ky], [w - kx, h], [kx, h], [0, h - ky], [0, ky]]);
    }
    case 'diamond':
      return polygonPath([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]);
    case 'arch': {
      const r = w / 2;
      const top = Math.min(r, h);
      const k = 0.5523;
      return [
        ['M', 0, h],
        ['L', 0, top],
        ['C', 0, top - k * top, r - k * r, 0, r, 0],
        ['C', r + k * r, 0, w, top - k * top, w, top],
        ['L', w, h],
        ['Z'],
      ];
    }
    case 'ticket': {
      const n = Math.max(0.04, Math.min(0.3, corner)) * m; // notch radius
      const k = 0.5523 * n;
      return [
        ['M', n, 0],
        ['L', w - n, 0],
        ['C', w - n, k, w - k, n, w, n],
        ['L', w, h - n],
        ['C', w - k, h - n, w - n, h - k, w - n, h],
        ['L', n, h],
        ['C', n, h - k, k, h - n, 0, h - n],
        ['L', 0, n],
        ['C', k, n, n, k, n, 0],
        ['Z'],
      ];
    }
    case 'tag': {
      const k = Math.min(h / 2, w * 0.25);
      return polygonPath([[0, 0], [w - k, 0], [w, h / 2], [w - k, h], [0, h]]);
    }
    case 'banner': {
      const k = Math.min(h / 2, w * 0.12);
      return polygonPath([[0, 0], [w, 0], [w - k, h / 2], [w, h], [0, h], [k, h / 2]]);
    }
    case 'shield':
      return [
        ['M', 0, 0],
        ['L', w, 0],
        ['L', w, h * 0.45],
        ['C', w, h * 0.75, w * 0.75, h * 0.9, w / 2, h],
        ['C', w * 0.25, h * 0.9, 0, h * 0.75, 0, h * 0.45],
        ['Z'],
      ];
    case 'bubble': {
      const bh = h * 0.82;
      const r = Math.min(w, bh) * 0.18;
      const tail: Seg[] = [
        ['M', r, 0],
        ['L', w - r, 0],
        ['C', w - r + 0.5523 * r, 0, w, r - 0.5523 * r, w, r],
        ['L', w, bh - r],
        ['C', w, bh - r + 0.5523 * r, w - r + 0.5523 * r, bh, w - r, bh],
        ['L', w * 0.42, bh],
        ['L', w * 0.24, h],
        ['L', w * 0.28, bh],
        ['L', r, bh],
        ['C', r - 0.5523 * r, bh, 0, bh - r + 0.5523 * r, 0, bh - r],
        ['L', 0, r],
        ['C', 0, r - 0.5523 * r, r - 0.5523 * r, 0, r, 0],
        ['Z'],
      ];
      return tail;
    }
    case 'heart':
      return [
        ['M', w / 2, h * 0.28],
        ['C', w * 0.5, h * 0.05, w * 0.12, -h * 0.04, w * 0.03, h * 0.22],
        ['C', -w * 0.06, h * 0.45, w * 0.2, h * 0.68, w / 2, h],
        ['C', w * 0.8, h * 0.68, w * 1.06, h * 0.45, w * 0.97, h * 0.22],
        ['C', w * 0.88, -h * 0.04, w * 0.5, h * 0.05, w / 2, h * 0.28],
        ['Z'],
      ];
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.42 : 1;
        pts.push([w / 2 + (Math.cos(a) * r * w) / 2, h * 0.53 + (Math.sin(a) * r * h) / 2 / 0.98]);
      }
      // Fit the star's actual extent to the box.
      const ys = pts.map((p) => p[1]);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      return polygonPath(pts.map(([x, y]) => [x, ((y - y0) / (y1 - y0)) * h]));
    }
    case 'flower':
      return scallop(w, h, 8, 0.14);
    case 'cloud':
      return cloud(w, h);
    case 'drop':
      return [
        ['M', w / 2, 0],
        ['C', w * 0.62, h * 0.22, w, h * 0.45, w, h * 0.66],
        ['C', w, h * 0.86, w * 0.78, h, w / 2, h],
        ['C', w * 0.22, h, 0, h * 0.86, 0, h * 0.66],
        ['C', 0, h * 0.45, w * 0.38, h * 0.22, w / 2, 0],
        ['Z'],
      ];
    case 'leaf':
      return [
        ['M', 0, h],
        ['C', 0, h * 0.35, w * 0.35, 0, w, 0],
        ['C', w, h * 0.65, w * 0.65, h, 0, h],
        ['Z'],
      ];
  }
}

/** A circle with `n` round bumps (flower / scalloped label). */
function scallop(w: number, h: number, n: number, depth: number): Path {
  const p: Path = [];
  const rx = w / 2;
  const ry = h / 2;
  const pt = (a: number, k: number): [number, number] => [rx + Math.cos(a) * rx * k, ry + Math.sin(a) * ry * k];
  const inner = 1 - depth * 2;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const s = pt(a0, inner);
    const e = pt(a1, inner);
    const c1 = pt(a0 + (am - a0) * 0.3, 1.08);
    const c2 = pt(a1 - (a1 - am) * 0.3, 1.08);
    if (i === 0) p.push(['M', s[0], s[1]]);
    p.push(['C', c1[0], c1[1], c2[0], c2[1], e[0], e[1]]);
  }
  p.push(['Z']);
  return p;
}

function cloud(w: number, h: number): Path {
  // Flat-bottomed cloud from overlapping arcs.
  return [
    ['M', w * 0.12, h],
    ['C', -w * 0.02, h, -w * 0.02, h * 0.55, w * 0.16, h * 0.55],
    ['C', w * 0.12, h * 0.25, w * 0.38, h * 0.08, w * 0.5, h * 0.28],
    ['C', w * 0.58, -h * 0.05, w * 0.92, h * 0.05, w * 0.84, h * 0.45],
    ['C', w * 1.03, h * 0.45, w * 1.03, h, w * 0.88, h],
    ['Z'],
  ];
}

/** What can be drawn inside a shape. Every shape and calendar slot offers these. */
export type FillPattern = 'none' | 'lines' | 'dots' | 'grid';

export const FILL_PATTERNS: readonly { id: FillPattern; label: string }[] = [
  { id: 'none', label: 'Unlined' },
  { id: 'lines', label: 'Lined' },
  { id: 'dots', label: 'Dotted' },
  { id: 'grid', label: 'Grid' },
];
