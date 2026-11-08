/** Drawing primitives every designer element renders to. Both the SVG preview and the PDF output draw these. */

import { ellipsePath, linePath, pathBounds, rectPath, type Box, type Path } from './geometry';
import { shapePath, type FillPattern, type ShapeId } from './shapes';

export type FontRole = 'display' | 'body' | 'accent';

export type Prim =
  | { k: 'path'; path: Path; fill?: string; stroke?: string; sw?: number; dash?: [number, number]; round?: boolean }
  | {
      k: 'text';
      box: Box;
      text: string;
      /** Points. */
      size: number;
      font: FontRole;
      fill: string;
      align: 'left' | 'center' | 'right';
      valign: 'top' | 'middle' | 'bottom';
      /** Degrees clockwise around the box centre. */
      rotate?: number;
    }
  | { k: 'image'; box: Box; src: string; fit: 'cover' | 'contain' | 'stretch'; rotate?: number }
  | { k: 'clip'; path: Path; children: Prim[] };

export interface Stroke {
  color: string;
  /** Points. */
  width: number;
  dash?: [number, number];
}

export const PT = 1 / 72;

/** Inside lines/dots/grid for any shape, clipped to it. */
export function patternPrims(path: Path, pattern: FillPattern, spacing: number, color: string, weightPt: number, inset = 0): Prim[] {
  if (pattern === 'none' || spacing <= 0.02) return [];
  const b = pathBounds(path);
  const kids: Prim[] = [];
  const x0 = b.x + inset;
  const x1 = b.x + b.w - inset;
  const y0 = b.y + inset;
  const y1 = b.y + b.h - inset;
  if (pattern === 'lines' || pattern === 'grid') {
    for (let y = y0 + spacing; y < y1 - 1e-6; y += spacing) kids.push({ k: 'path', path: linePath(x0, y, x1, y), stroke: color, sw: weightPt * PT });
  }
  if (pattern === 'grid') {
    for (let x = x0 + spacing; x < x1 - 1e-6; x += spacing) kids.push({ k: 'path', path: linePath(x, y0, x, y1), stroke: color, sw: weightPt * PT });
  }
  if (pattern === 'dots') {
    const r = Math.max(0.006, weightPt * PT * 1.6);
    for (let y = y0 + spacing; y < y1 - 1e-6; y += spacing)
      for (let x = x0 + spacing; x < x1 - 1e-6; x += spacing) kids.push({ k: 'path', path: ellipsePath(x, y, r, r), fill: color });
  }
  return kids.length ? [{ k: 'clip', path, children: kids }] : [];
}

/** A shape with optional fill, outline and inside pattern, placed at `box`. */
export function shapePrims(
  shape: ShapeId,
  box: Box,
  o: { corner?: number; fill?: string; stroke?: Stroke | null; pattern?: FillPattern; spacing?: number; patternColor?: string; patternWeight?: number },
): Prim[] {
  const local = shapePath(shape, box.w, box.h, o.corner);
  const path = local.map((s) => (s[0] === 'Z' ? s : (s.map((v, i) => (i === 0 ? v : i % 2 ? (v as number) + box.x : (v as number) + box.y)) as typeof s)));
  const out: Prim[] = [];
  if (o.fill && o.fill !== 'none') out.push({ k: 'path', path, fill: o.fill });
  out.push(...patternPrims(path, o.pattern ?? 'none', o.spacing ?? 0.25, o.patternColor ?? '#9a9a9a', o.patternWeight ?? 0.5));
  if (o.stroke && o.stroke.width > 0) out.push({ k: 'path', path, stroke: o.stroke.color, sw: o.stroke.width * PT, dash: o.stroke.dash });
  return out;
}

export function rectPrim(box: Box, o: { fill?: string; stroke?: Stroke; r?: number }): Prim {
  return { k: 'path', path: rectPath(box.x, box.y, box.w, box.h, o.r ?? 0), fill: o.fill, stroke: o.stroke?.color, sw: o.stroke ? o.stroke.width * PT : undefined, dash: o.stroke?.dash };
}

export function textPrim(box: Box, text: string, size: number, o: Partial<Omit<Extract<Prim, { k: 'text' }>, 'k' | 'box' | 'text' | 'size'>> = {}): Prim {
  return { k: 'text', box, text, size, font: o.font ?? 'body', fill: o.fill ?? '#222222', align: o.align ?? 'left', valign: o.valign ?? 'middle', rotate: o.rotate };
}
