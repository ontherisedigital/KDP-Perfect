/**
 * Vector geometry for the page designer: paths built only from absolute M/L/C/Z commands, so they can be transformed
 * point by point and drawn the same way in SVG (preview) and PDF (print). Units are inches, y grows down.
 */

export type Seg = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];
export type Path = Seg[];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rotation (degrees, clockwise) around a box centre, then translation. */
export interface Transform {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
}

export function transformPoint(t: Transform, px: number, py: number): [number, number] {
  if (!t.rotate) return [t.x + px, t.y + py];
  const a = (t.rotate * Math.PI) / 180;
  const cx = t.w / 2;
  const cy = t.h / 2;
  const dx = px - cx;
  const dy = py - cy;
  return [t.x + cx + dx * Math.cos(a) - dy * Math.sin(a), t.y + cy + dx * Math.sin(a) + dy * Math.cos(a)];
}

export function transformPath(t: Transform, p: Path): Path {
  return p.map((s): Seg => {
    switch (s[0]) {
      case 'M':
      case 'L': {
        const [x, y] = transformPoint(t, s[1], s[2]);
        return [s[0], x, y];
      }
      case 'C': {
        const [a, b] = transformPoint(t, s[1], s[2]);
        const [c, d] = transformPoint(t, s[3], s[4]);
        const [e, f] = transformPoint(t, s[5], s[6]);
        return ['C', a, b, c, d, e, f];
      }
      default:
        return s;
    }
  });
}

const f = (n: number) => (Math.round(n * 10000) / 10000).toString();

/** SVG `d` string, scaled (e.g. inches to preview pixels). */
export function pathToSvg(p: Path, scale = 1): string {
  return p
    .map((s) => (s[0] === 'Z' ? 'Z' : s[0] + s.slice(1).map((n) => f((n as number) * scale)).join(' ')))
    .join('');
}

export function rectPath(x: number, y: number, w: number, h: number, r = 0): Path {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r <= 0) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const k = 0.5523 * r;
  return [
    ['M', x + r, y],
    ['L', x + w - r, y],
    ['C', x + w - r + k, y, x + w, y + r - k, x + w, y + r],
    ['L', x + w, y + h - r],
    ['C', x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
    ['L', x + r, y + h],
    ['C', x + r - k, y + h, x, y + h - r + k, x, y + h - r],
    ['L', x, y + r],
    ['C', x, y + r - k, x + r - k, y, x + r, y],
    ['Z'],
  ];
}

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): Path {
  const kx = 0.5523 * rx;
  const ky = 0.5523 * ry;
  return [
    ['M', cx + rx, cy],
    ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
    ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
    ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
    ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy],
    ['Z'],
  ];
}

export function polygonPath(pts: [number, number][]): Path {
  const p: Path = pts.map(([x, y], i): Seg => [i ? 'L' : 'M', x, y]);
  p.push(['Z']);
  return p;
}

export function linePath(x1: number, y1: number, x2: number, y2: number): Path {
  return [
    ['M', x1, y1],
    ['L', x2, y2],
  ];
}

/** Approximate bounding box of a path (control points included: fine for layout). */
export function pathBounds(p: Path): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const s of p) {
    for (let i = 1; i < s.length; i += 2) {
      const x = s[i] as number;
      const y = s[i + 1] as number;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
