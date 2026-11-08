/**
 * The element library for the page designer: calendar, planner, bullet-journal, writing and basic elements.
 *
 * Each element is a box (x, y, w, h in inches, plus rotation) with a `type` and `props`. Its definition lists the
 * editable fields (the UI builds the properties panel from them) and renders the element to primitives in LOCAL
 * coordinates (origin at the element's top-left). The document renderer applies position and rotation.
 *
 * Every calendar slot and every shape offers Unlined / Lined / Dotted / Grid insides.
 */

import { addDays, DATE_FORMATS, formatDate, MONTHS, monthMatrix, parseDate, weekdayOrder, WEEKDAYS, weekStartOf, daysInMonth, type DateFormat, type SimpleDate, type WeekStart } from './dates';
import { linePath, type Box } from './geometry';
import { PT, patternPrims, rectPrim, shapePrims, textPrim, type FontRole, type Prim, type Stroke } from './prims';
import { FILL_PATTERNS, SHAPES, shapePath, type FillPattern, type ShapeId } from './shapes';

export type Value = string | number | boolean;
export type Props = Record<string, Value>;

export interface DesignElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  locked?: boolean;
  props: Props;
}

export interface Field {
  key: string;
  label: string;
  kind: 'number' | 'range' | 'select' | 'text' | 'textarea' | 'color' | 'bool' | 'month' | 'date' | 'image';
  min?: number;
  max?: number;
  step?: number;
  options?: readonly { id: string; label: string }[];
  /** Section heading in the properties panel. */
  group?: string;
  /** Only show this field when it returns true. */
  when?: (p: Props) => boolean;
  hint?: string;
}

export interface RenderCtx {
  /** The page's date, when the page is part of a dated sequence. */
  date?: SimpleDate;
  pageNumber: number;
}

export type Category = 'Basics' | 'Writing' | 'Calendar' | 'Planner' | 'Bullet journal';
export const CATEGORIES: readonly Category[] = ['Calendar', 'Planner', 'Bullet journal', 'Writing', 'Basics'];

export interface ElementDef {
  type: string;
  label: string;
  category: Category;
  /** Default size in inches. */
  w: number;
  h: number;
  fields: Field[];
  defaults: Props;
  render(el: DesignElement, ctx: RenderCtx): Prim[];
}

// --- shared field sets ---------------------------------------------------------------------

const FONTS = [
  { id: 'display', label: 'Rounded (Fredoka)' },
  { id: 'body', label: 'Clean (Dosis)' },
  { id: 'accent', label: 'Bold serif (Arima)' },
] as const;
const DASHES = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
] as const;
const ALIGN = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centre' },
  { id: 'right', label: 'Right' },
] as const;
const WEEK_STARTS = [
  { id: 'sun', label: 'Sunday' },
  { id: 'mon', label: 'Monday' },
] as const;
const DATE_SOURCES = [
  { id: 'page', label: 'From the page (dated planners)' },
  { id: 'fixed', label: 'A date I choose' },
  { id: 'undated', label: 'Undated (fill in by hand)' },
] as const;
const LABEL_POS = [
  { id: 'top-left', label: 'Top left' },
  { id: 'top-right', label: 'Top right' },
  { id: 'center', label: 'Centre' },
  { id: 'above', label: 'Above the shape' },
  { id: 'none', label: 'No label' },
] as const;

const outlineFields = (g = 'Outline'): Field[] => [
  { key: 'stroke', label: 'Line colour', kind: 'color', group: g },
  { key: 'strokeWidth', label: 'Line weight (pt)', kind: 'number', min: 0, max: 8, step: 0.25, group: g },
  { key: 'dash', label: 'Line style', kind: 'select', options: DASHES, group: g },
];
const shapeFields = (g = 'Shape'): Field[] => [
  { key: 'shape', label: 'Shape', kind: 'select', options: SHAPES, group: g },
  { key: 'corner', label: 'Corner roundness', kind: 'range', min: 0, max: 0.5, step: 0.01, group: g, when: (p) => p.shape === 'rounded' || p.shape === 'ticket' },
  { key: 'fill', label: 'Fill colour', kind: 'color', group: g },
  { key: 'noFill', label: 'No fill', kind: 'bool', group: g },
];
const insideFields = (g = 'Inside'): Field[] => [
  { key: 'pattern', label: 'Inside', kind: 'select', options: FILL_PATTERNS, group: g },
  { key: 'spacing', label: 'Spacing (in)', kind: 'number', min: 0.1, max: 1, step: 0.01, group: g, when: (p) => p.pattern !== 'none' },
  { key: 'patternColor', label: 'Pattern colour', kind: 'color', group: g, when: (p) => p.pattern !== 'none' },
];
const textFields = (g = 'Text'): Field[] => [
  { key: 'font', label: 'Font', kind: 'select', options: FONTS, group: g },
  { key: 'fontSize', label: 'Size (pt)', kind: 'number', min: 4, max: 96, step: 0.5, group: g },
  { key: 'textColor', label: 'Text colour', kind: 'color', group: g },
];
const dateFields = (unit: 'day' | 'week' | 'month', g = 'Date'): Field[] => [
  { key: 'dateSource', label: 'Dates', kind: 'select', options: DATE_SOURCES, group: g },
  {
    key: 'date',
    label: unit === 'month' ? 'Month' : 'Date',
    kind: unit === 'month' ? 'month' : 'date',
    group: g,
    when: (p) => p.dateSource === 'fixed',
  },
];

const OUTLINE: Props = { stroke: '#333333', strokeWidth: 0.75, dash: 'solid' };
const SHAPE: Props = { shape: 'rect', corner: 0.15, fill: '#ffffff', noFill: true };
const INSIDE: Props = { pattern: 'none', spacing: 0.25, patternColor: '#a0a0a0' };
const TEXT: Props = { font: 'body', fontSize: 10, textColor: '#222222' };

const str = (p: Props, k: string, d = '') => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Props, k: string, d = 0) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const bool = (p: Props, k: string) => p[k] === true;

function strokeOf(p: Props): Stroke | null {
  const width = num(p, 'strokeWidth', 0.75);
  if (width <= 0) return null;
  const d = str(p, 'dash', 'solid');
  const dash: [number, number] | undefined = d === 'dashed' ? [4 * PT * width, 3 * PT * width] : d === 'dotted' ? [0.001, 2.5 * PT * Math.max(1, width)] : undefined;
  return { color: str(p, 'stroke', '#333333'), width, dash };
}

function shapeOpts(p: Props) {
  return {
    corner: num(p, 'corner', 0.15),
    fill: bool(p, 'noFill') ? undefined : str(p, 'fill', '#ffffff'),
    stroke: strokeOf(p),
    pattern: str(p, 'pattern', 'none') as FillPattern,
    spacing: num(p, 'spacing', 0.25),
    patternColor: str(p, 'patternColor', '#a0a0a0'),
    patternWeight: 0.5,
  };
}

const font = (p: Props) => str(p, 'font', 'body') as FontRole;

/** Resolve an element's date: from the page, a fixed value, or `null` for undated. */
function resolveDate(p: Props, ctx: RenderCtx): SimpleDate | null {
  const src = str(p, 'dateSource', 'page');
  if (src === 'undated') return null;
  if (src === 'fixed') return parseDate(str(p, 'date')) ?? ctx.date ?? null;
  return ctx.date ?? parseDate(str(p, 'date')) ?? null;
}

/** One calendar slot: a shape with its inside pattern and a label. */
function slot(box: Box, p: Props, label: string, sizePt: number): Prim[] {
  const pos = str(p, 'labelPos', 'top-left');
  const out: Prim[] = [];
  let shapeBox = box;
  const lh = sizePt * PT * 1.5;
  if (pos === 'above' && label) shapeBox = { x: box.x, y: box.y + lh, w: box.w, h: Math.max(0.05, box.h - lh) };
  out.push(...shapePrims(str(p, 'shape', 'rect') as ShapeId, shapeBox, shapeOpts(p)));
  if (!label || pos === 'none') return out;
  const pad = Math.min(0.06, box.w * 0.08);
  const t = { font: font(p), fill: str(p, 'textColor', '#222222') };
  if (pos === 'above') out.push(textPrim({ x: box.x, y: box.y, w: box.w, h: lh }, label, sizePt, { ...t, align: 'center' }));
  else if (pos === 'center') out.push(textPrim(shapeBox, label, sizePt, { ...t, align: 'center', valign: 'middle' }));
  else
    out.push(
      textPrim({ x: box.x + pad, y: box.y + pad * 0.6, w: box.w - 2 * pad, h: lh }, label, sizePt, { ...t, align: pos === 'top-right' ? 'right' : 'left', valign: 'top' }),
    );
  return out;
}

const SLOT_FIELDS = (): Field[] => [
  ...shapeFields('Slots'),
  ...insideFields('Slot inside'),
  ...outlineFields('Slot outline'),
  { key: 'labelPos', label: 'Day label', kind: 'select', options: LABEL_POS, group: 'Labels' },
  ...textFields('Labels'),
];
const SLOT_DEFAULTS: Props = { ...SHAPE, ...INSIDE, ...OUTLINE, labelPos: 'top-left', ...TEXT, fontSize: 8 };

// --- the library -----------------------------------------------------------------------------

const defs: ElementDef[] = [];
const def = (d: ElementDef) => defs.push(d);

// Basics ---------------------------------------------------------------------------------------

def({
  type: 'text',
  label: 'Text',
  category: 'Basics',
  w: 3,
  h: 0.5,
  fields: [{ key: 'text', label: 'Text', kind: 'textarea', group: 'Text' }, ...textFields(), { key: 'align', label: 'Align', kind: 'select', options: ALIGN, group: 'Text' }],
  defaults: { text: 'Your text', ...TEXT, fontSize: 16, font: 'display', align: 'center' },
  render: (el) => [
    textPrim({ x: 0, y: 0, w: el.w, h: el.h }, str(el.props, 'text'), num(el.props, 'fontSize', 12), {
      font: font(el.props),
      fill: str(el.props, 'textColor', '#222222'),
      align: str(el.props, 'align', 'center') as 'left',
      valign: 'middle',
    }),
  ],
});

def({
  type: 'shape',
  label: 'Shape / frame',
  category: 'Basics',
  w: 2,
  h: 2,
  fields: [...shapeFields(), ...insideFields(), ...outlineFields(), { key: 'label', label: 'Label', kind: 'text', group: 'Label' }, { key: 'labelPos', label: 'Label position', kind: 'select', options: LABEL_POS, group: 'Label' }, ...textFields('Label')],
  defaults: { ...SHAPE, ...INSIDE, ...OUTLINE, label: '', labelPos: 'top-left', ...TEXT },
  render: (el) => slot({ x: 0, y: 0, w: el.w, h: el.h }, el.props, str(el.props, 'label'), num(el.props, 'fontSize', 10)),
});

def({
  type: 'line',
  label: 'Line',
  category: 'Basics',
  w: 3,
  h: 0.1,
  fields: outlineFields('Line'),
  defaults: { ...OUTLINE },
  render: (el) => {
    const s = strokeOf(el.props);
    if (!s) return [];
    const path = el.w >= el.h ? linePath(0, el.h / 2, el.w, el.h / 2) : linePath(el.w / 2, 0, el.w / 2, el.h);
    return [{ k: 'path', path, stroke: s.color, sw: s.width * PT, dash: s.dash, round: true }];
  },
});

def({
  type: 'divider',
  label: 'Divider',
  category: 'Basics',
  w: 4,
  h: 0.2,
  fields: [
    {
      key: 'style',
      label: 'Style',
      kind: 'select',
      options: [
        { id: 'double', label: 'Double line' },
        { id: 'dots', label: 'Dots' },
        { id: 'diamonds', label: 'Diamonds' },
        { id: 'wave', label: 'Wave' },
        { id: 'stars', label: 'Stars' },
      ],
      group: 'Divider',
    },
    { key: 'stroke', label: 'Colour', kind: 'color', group: 'Divider' },
  ],
  defaults: { style: 'dots', stroke: '#555555' },
  render: (el) => {
    const c = str(el.props, 'stroke', '#555555');
    const st = str(el.props, 'style', 'dots');
    const cy = el.h / 2;
    const out: Prim[] = [];
    if (st === 'double') {
      out.push({ k: 'path', path: linePath(0, cy - 0.03, el.w, cy - 0.03), stroke: c, sw: 0.75 * PT });
      out.push({ k: 'path', path: linePath(0, cy + 0.03, el.w, cy + 0.03), stroke: c, sw: 0.75 * PT });
    } else if (st === 'wave') {
      const n = Math.max(2, Math.round(el.w / 0.3));
      const step = el.w / n;
      const a = Math.min(0.06, el.h / 3);
      const path: import('./geometry').Path = [['M', 0, cy]];
      for (let i = 0; i < n; i++) path.push(['C', i * step + step / 3, cy - a, i * step + (2 * step) / 3, cy + a, (i + 1) * step, cy]);
      out.push({ k: 'path', path, stroke: c, sw: 0.75 * PT });
    } else {
      const shape: ShapeId = st === 'diamonds' ? 'diamond' : st === 'stars' ? 'star' : 'ellipse';
      const s = st === 'dots' ? Math.min(0.05, el.h * 0.4) : Math.min(0.12, el.h * 0.8);
      const n = Math.max(1, Math.floor(el.w / (s * 2.6)));
      const gap = el.w / n;
      for (let i = 0; i < n; i++) out.push(...shapePrims(shape, { x: i * gap + (gap - s) / 2, y: cy - s / 2, w: s, h: s }, { fill: c }));
    }
    return out;
  },
});

def({
  type: 'image',
  label: 'Image',
  category: 'Basics',
  w: 2.5,
  h: 2.5,
  fields: [
    { key: 'src', label: 'Image', kind: 'image', group: 'Image' },
    {
      key: 'fit',
      label: 'Fit',
      kind: 'select',
      options: [
        { id: 'contain', label: 'Show the whole image' },
        { id: 'cover', label: 'Fill the frame (crop)' },
        { id: 'stretch', label: 'Stretch' },
      ],
      group: 'Image',
    },
    { key: 'shape', label: 'Frame shape', kind: 'select', options: SHAPES, group: 'Frame' },
    { key: 'corner', label: 'Corner roundness', kind: 'range', min: 0, max: 0.5, step: 0.01, group: 'Frame', when: (p) => p.shape === 'rounded' || p.shape === 'ticket' },
    ...outlineFields('Frame'),
  ],
  defaults: { src: '', fit: 'contain', shape: 'rect', corner: 0.15, ...OUTLINE, strokeWidth: 0 },
  render: (el) => {
    const shape = str(el.props, 'shape', 'rect') as ShapeId;
    const path = shapePath(shape, el.w, el.h, num(el.props, 'corner', 0.15));
    const src = str(el.props, 'src');
    const out: Prim[] = [];
    if (src) {
      const img: Prim = { k: 'image', box: { x: 0, y: 0, w: el.w, h: el.h }, src, fit: str(el.props, 'fit', 'contain') as 'cover' };
      out.push(shape === 'rect' && el.props.fit !== 'cover' ? img : { k: 'clip', path, children: [img] });
    } else {
      out.push({ k: 'path', path, fill: '#f1f3f8' });
      out.push(textPrim({ x: 0, y: 0, w: el.w, h: el.h }, 'Drop an image here', 9, { align: 'center', fill: '#8a90a0' }));
    }
    const s = strokeOf(el.props);
    if (s) out.push({ k: 'path', path, stroke: s.color, sw: s.width * PT, dash: s.dash });
    return out;
  },
});

def({
  type: 'page-number',
  label: 'Page number',
  category: 'Basics',
  w: 0.8,
  h: 0.3,
  fields: [
    {
      key: 'format',
      label: 'Format',
      kind: 'select',
      options: [
        { id: 'n', label: '12' },
        { id: 'page', label: 'Page 12' },
        { id: 'dash', label: '– 12 –' },
      ],
      group: 'Text',
    },
    ...textFields(),
    { key: 'align', label: 'Align', kind: 'select', options: ALIGN, group: 'Text' },
  ],
  defaults: { format: 'n', ...TEXT, fontSize: 9, textColor: '#555555', align: 'center' },
  render: (el, ctx) => {
    const n = ctx.pageNumber;
    const f = str(el.props, 'format', 'n');
    const t = f === 'page' ? `Page ${n}` : f === 'dash' ? `– ${n} –` : String(n);
    return [textPrim({ x: 0, y: 0, w: el.w, h: el.h }, t, num(el.props, 'fontSize', 9), { font: font(el.props), fill: str(el.props, 'textColor'), align: str(el.props, 'align', 'center') as 'left' })];
  },
});

// Writing --------------------------------------------------------------------------------------

def({
  type: 'writing',
  label: 'Writing area',
  category: 'Writing',
  w: 5,
  h: 4,
  fields: [
    {
      key: 'style',
      label: 'Style',
      kind: 'select',
      options: [
        { id: 'lines', label: 'Lined' },
        { id: 'dots', label: 'Dot grid' },
        { id: 'grid', label: 'Graph' },
        { id: 'handwriting', label: 'Handwriting practice' },
        { id: 'none', label: 'Blank' },
      ],
      group: 'Writing',
    },
    { key: 'spacing', label: 'Spacing (in)', kind: 'number', min: 0.15, max: 1.2, step: 0.01, group: 'Writing' },
    { key: 'patternColor', label: 'Colour', kind: 'color', group: 'Writing' },
    { key: 'border', label: 'Border', kind: 'bool', group: 'Writing' },
  ],
  defaults: { style: 'lines', spacing: 0.34375, patternColor: '#8f8f8f', border: false },
  render: (el) => {
    const box = { x: 0, y: 0, w: el.w, h: el.h };
    const st = str(el.props, 'style', 'lines');
    const color = str(el.props, 'patternColor', '#8f8f8f');
    const sp = num(el.props, 'spacing', 0.34375);
    const out: Prim[] = [];
    if (st === 'handwriting') {
      const tall = sp * 0.67 * 2;
      for (let y = 0.1; y + tall <= el.h + 1e-6; y += sp * 2) {
        out.push({ k: 'path', path: linePath(0, y, el.w, y), stroke: color, sw: 0.6 * PT });
        out.push({ k: 'path', path: linePath(0, y + tall / 2, el.w, y + tall / 2), stroke: color, sw: 0.45 * PT, dash: [0.05, 0.04] });
        out.push({ k: 'path', path: linePath(0, y + tall, el.w, y + tall), stroke: color, sw: 0.8 * PT });
      }
    } else {
      out.push(...shapePrims('rect', box, { pattern: st as FillPattern, spacing: sp, patternColor: color, patternWeight: 0.5 }));
    }
    if (bool(el.props, 'border')) out.push(rectPrim(box, { stroke: { color, width: 0.75 } }));
    return out;
  },
});

def({
  type: 'notes',
  label: 'Notes box',
  category: 'Writing',
  w: 3,
  h: 2.5,
  fields: [{ key: 'title', label: 'Title', kind: 'text', group: 'Title' }, ...textFields('Title'), ...shapeFields(), ...insideFields(), ...outlineFields()],
  defaults: { title: 'Notes', ...TEXT, font: 'display', fontSize: 11, ...SHAPE, shape: 'rounded', ...INSIDE, pattern: 'lines', ...OUTLINE },
  render: (el) => {
    const title = str(el.props, 'title');
    const size = num(el.props, 'fontSize', 11);
    const th = title ? size * PT * 1.8 : 0;
    const out = shapePrims(str(el.props, 'shape', 'rounded') as ShapeId, { x: 0, y: 0, w: el.w, h: el.h }, shapeOpts(el.props));
    if (title) {
      // Clear the pattern behind the title so it reads cleanly.
      out.splice(out.length - 1, 0, rectPrim({ x: 0.08, y: 0.04, w: el.w - 0.16, h: th }, { fill: bool(el.props, 'noFill') ? '#ffffff' : str(el.props, 'fill', '#ffffff') }));
      out.push(textPrim({ x: 0.12, y: 0.04, w: el.w - 0.24, h: th }, title, size, { font: font(el.props), fill: str(el.props, 'textColor'), valign: 'middle' }));
    }
    return out;
  },
});

// Calendar -------------------------------------------------------------------------------------

def({
  type: 'day-slot',
  label: 'Day slot',
  category: 'Calendar',
  w: 1.2,
  h: 1.2,
  fields: [...dateFields('day'), { key: 'labelFormat', label: 'Label', kind: 'select', options: [{ id: 'day', label: 'Day number (14)' }, { id: 'weekday-day', label: 'Weekday and day' }, { id: 'weekday', label: 'Weekday' }, { id: 'custom', label: 'My own text' }], group: 'Labels' }, { key: 'customLabel', label: 'Label text', kind: 'text', group: 'Labels', when: (p) => p.labelFormat === 'custom' }, ...SLOT_FIELDS()],
  defaults: { dateSource: 'page', date: '', labelFormat: 'day', customLabel: '', ...SLOT_DEFAULTS, fontSize: 10 },
  render: (el, ctx) => {
    const d = resolveDate(el.props, ctx);
    const f = str(el.props, 'labelFormat', 'day');
    const label = f === 'custom' ? str(el.props, 'customLabel') : !d ? '' : f === 'weekday' ? WEEKDAYS[new Date(d.y, d.m, d.d).getDay()]! : f === 'weekday-day' ? formatDate(d, 'weekday-day') : String(d.d);
    return slot({ x: 0, y: 0, w: el.w, h: el.h }, el.props, label, num(el.props, 'fontSize', 10));
  },
});

def({
  type: 'week',
  label: 'Week',
  category: 'Calendar',
  w: 6,
  h: 3,
  fields: [
    ...dateFields('week'),
    { key: 'weekStart', label: 'Week starts on', kind: 'select', options: WEEK_STARTS, group: 'Date' },
    {
      key: 'layout',
      label: 'Layout',
      kind: 'select',
      options: [
        { id: 'row', label: 'Side by side (7 columns)' },
        { id: 'column', label: 'Stacked (7 rows)' },
        { id: 'grid', label: '2 columns + notes slot' },
      ],
      group: 'Layout',
    },
    { key: 'gap', label: 'Gap (in)', kind: 'number', min: 0, max: 0.5, step: 0.01, group: 'Layout' },
    ...SLOT_FIELDS(),
  ],
  defaults: { dateSource: 'page', date: '', weekStart: 'mon', layout: 'grid', gap: 0.08, ...SLOT_DEFAULTS, pattern: 'lines', labelPos: 'top-left', fontSize: 9 },
  render: (el, ctx) => {
    const p = el.props;
    const d = resolveDate(p, ctx);
    const ws = str(p, 'weekStart', 'mon') as WeekStart;
    const order = weekdayOrder(ws);
    const start = d ? weekStartOf(d, ws) : null;
    const gap = num(p, 'gap', 0.08);
    const layout = str(p, 'layout', 'grid');
    const boxes: Box[] = [];
    if (layout === 'row') {
      const w = (el.w - gap * 6) / 7;
      for (let i = 0; i < 7; i++) boxes.push({ x: i * (w + gap), y: 0, w, h: el.h });
    } else if (layout === 'column') {
      const h = (el.h - gap * 6) / 7;
      for (let i = 0; i < 7; i++) boxes.push({ x: 0, y: i * (h + gap), w: el.w, h });
    } else {
      const w = (el.w - gap) / 2;
      const h = (el.h - gap * 3) / 4;
      for (let i = 0; i < 8; i++) boxes.push({ x: (i % 2) * (w + gap), y: Math.floor(i / 2) * (h + gap), w, h });
    }
    const out: Prim[] = [];
    boxes.forEach((b, i) => {
      if (i === 7) return out.push(...slot(b, p, 'Notes', num(p, 'fontSize', 9)));
      const wd = WEEKDAYS[order[i]!]!;
      const day = start ? addDays(start, i) : null;
      out.push(...slot(b, p, day ? `${wd.slice(0, 3)} ${day.d}` : wd, num(p, 'fontSize', 9)));
    });
    return out;
  },
});

def({
  type: 'month',
  label: 'Month grid',
  category: 'Calendar',
  w: 6.5,
  h: 5.5,
  fields: [
    ...dateFields('month'),
    { key: 'weekStart', label: 'Week starts on', kind: 'select', options: WEEK_STARTS, group: 'Date' },
    { key: 'title', label: 'Show month title', kind: 'bool', group: 'Layout' },
    { key: 'headers', label: 'Weekday names', kind: 'select', options: [{ id: 'full', label: 'Full (Monday)' }, { id: 'short', label: 'Short (Mon)' }, { id: 'letter', label: 'Letter (M)' }, { id: 'none', label: 'None' }], group: 'Layout' },
    { key: 'rows', label: 'Rows', kind: 'select', options: [{ id: 'auto', label: 'As the month needs' }, { id: '5', label: 'Always 5' }, { id: '6', label: 'Always 6' }], group: 'Layout' },
    { key: 'outside', label: 'Days outside the month', kind: 'select', options: [{ id: 'empty', label: 'Empty slots' }, { id: 'hidden', label: 'No slot' }], group: 'Layout' },
    { key: 'gap', label: 'Gap (in)', kind: 'number', min: 0, max: 0.4, step: 0.01, group: 'Layout' },
    ...SLOT_FIELDS(),
  ],
  defaults: { dateSource: 'page', date: '', weekStart: 'sun', title: true, headers: 'short', rows: 'auto', outside: 'empty', gap: 0, ...SLOT_DEFAULTS, fontSize: 8 },
  render: (el, ctx) => {
    const p = el.props;
    const d = resolveDate(p, ctx);
    const ws = str(p, 'weekStart', 'sun') as WeekStart;
    const order = weekdayOrder(ws);
    const out: Prim[] = [];
    let y = 0;
    const tSize = num(p, 'fontSize', 8) * 2;
    if (bool(p, 'title')) {
      const th = tSize * PT * 1.6;
      out.push(textPrim({ x: 0, y: 0, w: el.w, h: th }, d ? formatDate(d, 'month-year') : 'Month: ____________', tSize, { font: 'display', fill: str(p, 'textColor'), align: 'center' }));
      y += th + 0.04;
    }
    const hdr = str(p, 'headers', 'short');
    const gap = num(p, 'gap', 0);
    const cw = (el.w - gap * 6) / 7;
    if (hdr !== 'none') {
      const hh = num(p, 'fontSize', 8) * PT * 2;
      order.forEach((wd, i) => {
        const name = WEEKDAYS[wd]!;
        const t = hdr === 'full' ? name : hdr === 'letter' ? name[0]! : name.slice(0, 3);
        out.push(textPrim({ x: i * (cw + gap), y, w: cw, h: hh }, t, num(p, 'fontSize', 8), { font: font(p), fill: str(p, 'textColor'), align: 'center' }));
      });
      y += hh;
    }
    let rows: (number | null)[][] = d ? monthMatrix(d.y, d.m, ws) : Array.from({ length: 5 }, () => Array(7).fill(null));
    const want = str(p, 'rows', 'auto');
    if (want !== 'auto') {
      const n = Number(want);
      while (rows.length < n) rows.push(Array(7).fill(null));
      if (rows.length > n) {
        // Fold overflow days into the last row's slots ("23/30" style) by keeping both numbers.
        rows = rows.slice(0, n);
      }
    }
    const rh = (el.h - y - gap * (rows.length - 1)) / rows.length;
    const hide = str(p, 'outside', 'empty') === 'hidden' && !!d;
    rows.forEach((r, ri) =>
      r.forEach((day, ci) => {
        if (hide && day === null) return;
        out.push(...slot({ x: ci * (cw + gap), y: y + ri * (rh + gap), w: cw, h: rh }, p, day ? String(day) : '', num(p, 'fontSize', 8)));
      }),
    );
    return out;
  },
});

function miniMonth(x: number, y: number, w: number, h: number, d: SimpleDate | null, p: Props): Prim[] {
  const out: Prim[] = [];
  const ws = str(p, 'weekStart', 'sun') as WeekStart;
  const size = num(p, 'fontSize', 7);
  const color = str(p, 'textColor', '#222222');
  const th = size * PT * 2;
  out.push(textPrim({ x, y, w, h: th }, d ? MONTHS[d.m]! + (bool(p, 'showYear') ? ` ${d.y}` : '') : '__________', size * 1.25, { font: 'display', fill: color, align: 'center' }));
  const cw = w / 7;
  const rows = d ? monthMatrix(d.y, d.m, ws) : [];
  const rh = (h - th * 2) / 6;
  weekdayOrder(ws).forEach((wd, i) => out.push(textPrim({ x: x + i * cw, y: y + th, w: cw, h: th }, WEEKDAYS[wd]![0]!, size, { font: font(p), fill: color, align: 'center' })));
  rows.forEach((r, ri) =>
    r.forEach((day, ci) => {
      if (day) out.push(textPrim({ x: x + ci * cw, y: y + th * 2 + ri * rh, w: cw, h: rh }, String(day), size, { font: font(p), fill: color, align: 'center' }));
    }),
  );
  return out;
}

def({
  type: 'mini-month',
  label: 'Mini month',
  category: 'Calendar',
  w: 2,
  h: 1.8,
  fields: [...dateFields('month'), { key: 'weekStart', label: 'Week starts on', kind: 'select', options: WEEK_STARTS, group: 'Date' }, { key: 'showYear', label: 'Show the year', kind: 'bool', group: 'Date' }, ...textFields()],
  defaults: { dateSource: 'page', date: '', weekStart: 'sun', showYear: false, ...TEXT, fontSize: 7 },
  render: (el, ctx) => miniMonth(0, 0, el.w, el.h, resolveDate(el.props, ctx), el.props),
});

def({
  type: 'year',
  label: 'Year at a glance',
  category: 'Calendar',
  w: 6.5,
  h: 8,
  fields: [
    { key: 'year', label: 'Year', kind: 'number', min: 1900, max: 2200, step: 1, group: 'Date' },
    { key: 'cols', label: 'Columns', kind: 'select', options: [{ id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }], group: 'Layout' },
    { key: 'weekStart', label: 'Week starts on', kind: 'select', options: WEEK_STARTS, group: 'Date' },
    ...textFields(),
  ],
  defaults: { year: new Date().getFullYear() + 1, cols: '3', weekStart: 'sun', ...TEXT, fontSize: 7 },
  render: (el, ctx) => {
    const year = ctx.date && el.props.year === undefined ? ctx.date.y : num(el.props, 'year', new Date().getFullYear() + 1);
    const cols = Number(str(el.props, 'cols', '3'));
    const rows = Math.ceil(12 / cols);
    const gx = 0.15;
    const gy = 0.12;
    const w = (el.w - gx * (cols - 1)) / cols;
    const h = (el.h - gy * (rows - 1)) / rows;
    const out: Prim[] = [];
    for (let m = 0; m < 12; m++) out.push(...miniMonth((m % cols) * (w + gx), Math.floor(m / cols) * (h + gy), w, h, { y: year, m, d: 1 }, el.props));
    return out;
  },
});

def({
  type: 'date-heading',
  label: 'Date heading',
  category: 'Calendar',
  w: 4,
  h: 0.5,
  fields: [...dateFields('day'), { key: 'format', label: 'Format', kind: 'select', options: DATE_FORMATS, group: 'Date' }, { key: 'blank', label: 'Undated text', kind: 'text', group: 'Date', when: (p) => p.dateSource === 'undated' }, ...textFields(), { key: 'align', label: 'Align', kind: 'select', options: ALIGN, group: 'Text' }],
  defaults: { dateSource: 'page', date: '', format: 'long', blank: 'Date: ____________', ...TEXT, font: 'display', fontSize: 16, align: 'left' },
  render: (el, ctx) => {
    const d = resolveDate(el.props, ctx);
    const t = d ? formatDate(d, str(el.props, 'format', 'long') as DateFormat) : str(el.props, 'blank', 'Date: ____________');
    return [textPrim({ x: 0, y: 0, w: el.w, h: el.h }, t, num(el.props, 'fontSize', 16), { font: font(el.props), fill: str(el.props, 'textColor'), align: str(el.props, 'align', 'left') as 'left' })];
  },
});

// Planner --------------------------------------------------------------------------------------

/** Rows of [marker][writing line]. */
function rowsList(el: DesignElement, marker: (i: number, b: Box) => Prim[]): Prim[] {
  const p = el.props;
  const n = Math.max(1, Math.round(num(p, 'rows', 8)));
  const rh = el.h / n;
  const ms = Math.min(rh * 0.6, 0.22);
  const color = str(p, 'stroke', '#333333');
  const lineColor = str(p, 'patternColor', '#a0a0a0');
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const y = i * rh;
    out.push(...marker(i, { x: 0, y: y + (rh - ms) / 2, w: ms, h: ms }));
    if (bool(p, 'lines')) out.push({ k: 'path', path: linePath(ms + 0.1, y + rh * 0.85, el.w, y + rh * 0.85), stroke: lineColor, sw: 0.5 * PT });
  }
  void color;
  return out;
}

def({
  type: 'checklist',
  label: 'Checklist / to-do',
  category: 'Planner',
  w: 3,
  h: 2.5,
  fields: [
    { key: 'title', label: 'Title', kind: 'text', group: 'List' },
    { key: 'rows', label: 'Rows', kind: 'number', min: 1, max: 60, step: 1, group: 'List' },
    { key: 'lines', label: 'Writing lines', kind: 'bool', group: 'List' },
    { key: 'shape', label: 'Box shape', kind: 'select', options: SHAPES, group: 'Boxes' },
    { key: 'corner', label: 'Corner roundness', kind: 'range', min: 0, max: 0.5, step: 0.01, group: 'Boxes', when: (p) => p.shape === 'rounded' },
    ...outlineFields('Boxes'),
    { key: 'patternColor', label: 'Line colour', kind: 'color', group: 'List' },
    ...textFields('Title'),
  ],
  defaults: { title: 'To do', rows: 8, lines: true, shape: 'rounded', corner: 0.2, ...OUTLINE, patternColor: '#a0a0a0', ...TEXT, font: 'display', fontSize: 11 },
  render: (el) => {
    const p = el.props;
    const title = str(p, 'title');
    const th = title ? num(p, 'fontSize', 11) * PT * 1.8 : 0;
    const out: Prim[] = [];
    if (title) out.push(textPrim({ x: 0, y: 0, w: el.w, h: th }, title, num(p, 'fontSize', 11), { font: font(p), fill: str(p, 'textColor'), valign: 'middle' }));
    const inner = { ...el, h: el.h - th };
    const shape = str(p, 'shape', 'rounded') as ShapeId;
    for (const prim of rowsList(inner, (_, b) => shapePrims(shape, b, { corner: num(p, 'corner', 0.2), stroke: strokeOf(p) }))) out.push(shift(prim, 0, th));
    return out;
  },
});

def({
  type: 'list',
  label: 'Numbered / bullet list',
  category: 'Planner',
  w: 3,
  h: 2,
  fields: [
    { key: 'title', label: 'Title', kind: 'text', group: 'List' },
    { key: 'marker', label: 'Marker', kind: 'select', options: [{ id: 'number', label: '1. 2. 3.' }, { id: 'bullet', label: '• Bullet' }, { id: 'star', label: '★ Star' }, { id: 'heart', label: '♥ Heart' }, { id: 'dash', label: '– Dash' }], group: 'List' },
    { key: 'rows', label: 'Rows', kind: 'number', min: 1, max: 60, step: 1, group: 'List' },
    { key: 'lines', label: 'Writing lines', kind: 'bool', group: 'List' },
    { key: 'patternColor', label: 'Line colour', kind: 'color', group: 'List' },
    ...textFields(),
  ],
  defaults: { title: 'Top priorities', marker: 'number', rows: 3, lines: true, patternColor: '#a0a0a0', ...TEXT, font: 'display', fontSize: 11 },
  render: (el) => {
    const p = el.props;
    const title = str(p, 'title');
    const size = num(p, 'fontSize', 11);
    const th = title ? size * PT * 1.8 : 0;
    const out: Prim[] = [];
    if (title) out.push(textPrim({ x: 0, y: 0, w: el.w, h: th }, title, size, { font: font(p), fill: str(p, 'textColor') }));
    const m = str(p, 'marker', 'number');
    const color = str(p, 'textColor', '#222222');
    for (const prim of rowsList({ ...el, h: el.h - th }, (i, b) => {
      if (m === 'number') return [textPrim({ ...b, w: b.w + 0.1 }, `${i + 1}.`, size * 0.9, { font: 'body', fill: color })];
      if (m === 'dash') return [{ k: 'path', path: linePath(b.x, b.y + b.h / 2, b.x + b.w * 0.8, b.y + b.h / 2), stroke: color, sw: PT }];
      const shape: ShapeId = m === 'star' ? 'star' : m === 'heart' ? 'heart' : 'ellipse';
      const s = m === 'bullet' ? b.w * 0.35 : b.w * 0.7;
      return shapePrims(shape, { x: b.x + (b.w - s) / 2, y: b.y + (b.h - s) / 2, w: s, h: s }, { fill: color });
    }))
      out.push(shift(prim, 0, th));
    return out;
  },
});

def({
  type: 'schedule',
  label: 'Hourly schedule',
  category: 'Planner',
  w: 3,
  h: 6,
  fields: [
    { key: 'from', label: 'From (hour, 0-23)', kind: 'number', min: 0, max: 23, step: 1, group: 'Schedule' },
    { key: 'to', label: 'To (hour, 1-24)', kind: 'number', min: 1, max: 24, step: 1, group: 'Schedule' },
    { key: 'half', label: 'Half-hour lines', kind: 'bool', group: 'Schedule' },
    { key: 'clock', label: 'Clock', kind: 'select', options: [{ id: '12', label: '12-hour (9 AM)' }, { id: '24', label: '24-hour (09:00)' }], group: 'Schedule' },
    { key: 'patternColor', label: 'Line colour', kind: 'color', group: 'Schedule' },
    ...textFields(),
  ],
  defaults: { from: 6, to: 22, half: true, clock: '12', patternColor: '#9a9a9a', ...TEXT, fontSize: 8 },
  render: (el) => {
    const p = el.props;
    const from = Math.round(num(p, 'from', 6));
    const to = Math.max(from + 1, Math.round(num(p, 'to', 22)));
    const n = to - from;
    const rh = el.h / n;
    const lw = 0.55;
    const c = str(p, 'patternColor', '#9a9a9a');
    const out: Prim[] = [];
    for (let i = 0; i <= n; i++) {
      const y = i * rh;
      out.push({ k: 'path', path: linePath(0, y, el.w, y), stroke: c, sw: 0.6 * PT });
      if (i < n) {
        const h = from + i;
        const label = str(p, 'clock', '12') === '24' ? `${String(h).padStart(2, '0')}:00` : `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`;
        out.push(textPrim({ x: 0, y: y + 0.02, w: lw - 0.06, h: Math.min(rh, 0.2) }, label, num(p, 'fontSize', 8), { font: font(p), fill: str(p, 'textColor'), align: 'right', valign: 'top' }));
        if (bool(p, 'half')) out.push({ k: 'path', path: linePath(lw, y + rh / 2, el.w, y + rh / 2), stroke: c, sw: 0.4 * PT, dash: [0.03, 0.03] });
      }
    }
    out.push({ k: 'path', path: linePath(lw, 0, lw, el.h), stroke: c, sw: 0.6 * PT });
    return out;
  },
});

def({
  type: 'habit-tracker',
  label: 'Habit tracker',
  category: 'Planner',
  w: 6.5,
  h: 3,
  fields: [
    { key: 'habits', label: 'Habits (one per line, or leave blank lines)', kind: 'textarea', group: 'Tracker' },
    { key: 'rows', label: 'Rows', kind: 'number', min: 1, max: 40, step: 1, group: 'Tracker' },
    { key: 'days', label: 'Days', kind: 'select', options: [{ id: '7', label: 'A week (7)' }, { id: '31', label: 'A month (31)' }, { id: 'month', label: 'The page’s month' }], group: 'Tracker' },
    { key: 'nameWidth', label: 'Name column (in)', kind: 'number', min: 0.5, max: 4, step: 0.05, group: 'Tracker' },
    ...SLOT_FIELDS().filter((f) => !['labelPos'].includes(f.key)),
  ],
  defaults: { habits: 'Water\nExercise\nRead\nSleep 8h\n\n', rows: 6, days: '31', nameWidth: 1.2, ...SLOT_DEFAULTS, shape: 'ellipse', fontSize: 7 },
  render: (el, ctx) => {
    const p = el.props;
    const names = str(p, 'habits').split('\n');
    const rows = Math.max(1, Math.round(num(p, 'rows', 6)));
    const dsel = str(p, 'days', '31');
    const days = dsel === '7' ? 7 : dsel === 'month' && ctx.date ? daysInMonth(ctx.date.y, ctx.date.m) : 31;
    const nw = num(p, 'nameWidth', 1.2);
    const size = num(p, 'fontSize', 7);
    const hh = size * PT * 2;
    const cw = (el.w - nw) / days;
    const rh = (el.h - hh) / rows;
    const s = Math.min(cw, rh) * 0.78;
    const out: Prim[] = [];
    const fill = str(p, 'textColor');
    const wkLetters = dsel === '7' ? weekdayOrder('mon').map((d) => WEEKDAYS[d]![0]!) : null;
    for (let d = 0; d < days; d++) out.push(textPrim({ x: nw + d * cw, y: 0, w: cw, h: hh }, wkLetters ? wkLetters[d]! : String(d + 1), size, { font: font(p), fill, align: 'center' }));
    for (let r = 0; r < rows; r++) {
      const y = hh + r * rh;
      const name = names[r] ?? '';
      if (name) out.push(textPrim({ x: 0, y, w: nw - 0.06, h: rh }, name, size * 1.2, { font: font(p), fill }));
      else out.push({ k: 'path', path: linePath(0, y + rh * 0.8, nw - 0.1, y + rh * 0.8), stroke: '#a0a0a0', sw: 0.5 * PT });
      for (let d = 0; d < days; d++) out.push(...shapePrims(str(p, 'shape', 'ellipse') as ShapeId, { x: nw + d * cw + (cw - s) / 2, y: y + (rh - s) / 2, w: s, h: s }, shapeOpts(p)));
    }
    return out;
  },
});

def({
  type: 'pixels',
  label: 'Year in pixels',
  category: 'Bullet journal',
  w: 6,
  h: 8,
  fields: [{ key: 'title', label: 'Title', kind: 'text', group: 'Tracker' }, ...SLOT_FIELDS().filter((f) => f.key !== 'labelPos')],
  defaults: { title: 'Year in pixels', ...SLOT_DEFAULTS, shape: 'rounded', corner: 0.25, fontSize: 7 },
  render: (el) => {
    const p = el.props;
    const size = num(p, 'fontSize', 7);
    const fill = str(p, 'textColor');
    const title = str(p, 'title');
    const th = title ? size * PT * 3.2 : 0;
    const out: Prim[] = [];
    if (title) out.push(textPrim({ x: 0, y: 0, w: el.w, h: th }, title, size * 2, { font: 'display', fill, align: 'center' }));
    const lw = 0.25;
    const hh = size * PT * 2;
    const cw = (el.w - lw) / 12;
    const rh = (el.h - th - hh) / 31;
    const s = Math.min(cw * 0.86, rh * 0.86);
    MONTHS.forEach((m, i) => out.push(textPrim({ x: lw + i * cw, y: th, w: cw, h: hh }, m[0]!, size, { font: font(p), fill, align: 'center' })));
    for (let d = 0; d < 31; d++) {
      const y = th + hh + d * rh;
      out.push(textPrim({ x: 0, y, w: lw - 0.04, h: rh }, String(d + 1), size, { font: font(p), fill, align: 'right' }));
      for (let m = 0; m < 12; m++) {
        if (d + 1 > daysInMonth(2028, m)) continue; // leap-year safe: Feb gets 29 slots
        out.push(...shapePrims(str(p, 'shape', 'rounded') as ShapeId, { x: lw + m * cw + (cw - s) / 2, y: y + (rh - s) / 2, w: s, h: s }, shapeOpts(p)));
      }
    }
    return out;
  },
});

def({
  type: 'tracker',
  label: 'Counter / water tracker',
  category: 'Planner',
  w: 3,
  h: 0.5,
  fields: [
    { key: 'label', label: 'Label', kind: 'text', group: 'Tracker' },
    { key: 'count', label: 'How many', kind: 'number', min: 1, max: 40, step: 1, group: 'Tracker' },
    { key: 'numbers', label: 'Number them', kind: 'bool', group: 'Tracker' },
    ...SLOT_FIELDS().filter((f) => f.key !== 'labelPos'),
  ],
  defaults: { label: 'Water', count: 8, numbers: false, ...SLOT_DEFAULTS, shape: 'drop', fontSize: 9 },
  render: (el) => {
    const p = el.props;
    const label = str(p, 'label');
    const size = num(p, 'fontSize', 9);
    const lw = label ? Math.min(el.w * 0.35, label.length * size * PT * 0.6 + 0.1) : 0;
    const n = Math.max(1, Math.round(num(p, 'count', 8)));
    const cw = (el.w - lw) / n;
    const s = Math.min(cw * 0.8, el.h * 0.9);
    const out: Prim[] = [];
    if (label) out.push(textPrim({ x: 0, y: 0, w: lw, h: el.h }, label, size, { font: font(p), fill: str(p, 'textColor') }));
    for (let i = 0; i < n; i++) {
      const b = { x: lw + i * cw + (cw - s) / 2, y: (el.h - s) / 2, w: s, h: s };
      out.push(...shapePrims(str(p, 'shape', 'drop') as ShapeId, b, shapeOpts(p)));
      if (bool(p, 'numbers')) out.push(textPrim(b, String(i + 1), size * 0.8, { font: font(p), fill: str(p, 'textColor'), align: 'center' }));
    }
    return out;
  },
});

def({
  type: 'table',
  label: 'Table',
  category: 'Planner',
  w: 6,
  h: 3,
  fields: [
    { key: 'cols', label: 'Columns', kind: 'number', min: 1, max: 12, step: 1, group: 'Table' },
    { key: 'rows', label: 'Rows (below the header)', kind: 'number', min: 1, max: 50, step: 1, group: 'Table' },
    { key: 'header', label: 'Header labels (comma separated)', kind: 'text', group: 'Table' },
    { key: 'firstCol', label: 'Row labels (comma separated)', kind: 'text', group: 'Table' },
    { key: 'headerFill', label: 'Header shading', kind: 'color', group: 'Table' },
    ...outlineFields('Lines'),
    ...textFields(),
  ],
  defaults: { cols: 4, rows: 6, header: 'Breakfast, Lunch, Dinner, Snacks', firstCol: '', headerFill: '#eeeeee', ...OUTLINE, strokeWidth: 0.6, ...TEXT, fontSize: 9 },
  render: (el) => {
    const p = el.props;
    const cols = Math.max(1, Math.round(num(p, 'cols', 4)));
    const rows = Math.max(1, Math.round(num(p, 'rows', 6)));
    const headers = str(p, 'header').split(',').map((s) => s.trim());
    const rowLabels = str(p, 'firstCol').split(',').map((s) => s.trim()).filter(Boolean);
    const hasHeader = headers.some(Boolean);
    const total = rows + (hasHeader ? 1 : 0);
    const rh = el.h / total;
    const cw = el.w / cols;
    const s = strokeOf(p) ?? { color: '#333333', width: 0.6 };
    const out: Prim[] = [];
    if (hasHeader) out.push(rectPrim({ x: 0, y: 0, w: el.w, h: rh }, { fill: str(p, 'headerFill', '#eeeeee') }));
    for (let r = 0; r <= total; r++) out.push({ k: 'path', path: linePath(0, r * rh, el.w, r * rh), stroke: s.color, sw: s.width * PT, dash: s.dash });
    for (let c = 0; c <= cols; c++) out.push({ k: 'path', path: linePath(c * cw, 0, c * cw, el.h), stroke: s.color, sw: s.width * PT, dash: s.dash });
    const t = { font: font(p), fill: str(p, 'textColor'), align: 'center' as const };
    if (hasHeader) headers.slice(0, cols).forEach((h, c) => out.push(textPrim({ x: c * cw + 0.04, y: 0, w: cw - 0.08, h: rh }, h, num(p, 'fontSize', 9), { ...t, font: 'display' })));
    rowLabels.slice(0, rows).forEach((l, r) => out.push(textPrim({ x: 0.04, y: (r + (hasHeader ? 1 : 0)) * rh, w: cw - 0.08, h: rh }, l, num(p, 'fontSize', 9), t)));
    return out;
  },
});

// Bullet journal ---------------------------------------------------------------------------------

def({
  type: 'key',
  label: 'Key / legend',
  category: 'Bullet journal',
  w: 2.2,
  h: 2,
  fields: [{ key: 'title', label: 'Title', kind: 'text', group: 'Key' }, { key: 'entries', label: 'Entries (symbol, space, meaning; one per line)', kind: 'textarea', group: 'Key' }, ...textFields(), ...outlineFields('Border')],
  defaults: { title: 'Key', entries: '• Task\n× Done\n> Migrated\n< Scheduled\no Event\n– Note\n* Priority', ...TEXT, fontSize: 9, ...OUTLINE, strokeWidth: 0.6, dash: 'dashed' },
  render: (el) => {
    const p = el.props;
    const lines = str(p, 'entries').split('\n').filter((l) => l.trim());
    const title = str(p, 'title');
    const size = num(p, 'fontSize', 9);
    const out: Prim[] = [];
    const s = strokeOf(p);
    if (s) out.push(rectPrim({ x: 0, y: 0, w: el.w, h: el.h }, { stroke: s, r: 0.08 }));
    const th = title ? size * PT * 2.2 : 0;
    if (title) out.push(textPrim({ x: 0.1, y: 0.05, w: el.w - 0.2, h: th }, title, size * 1.3, { font: 'display', fill: str(p, 'textColor') }));
    const rh = Math.min(size * PT * 1.9, (el.h - th - 0.1) / Math.max(1, lines.length));
    lines.forEach((l, i) => {
      const [sym, ...rest] = l.trim().split(/\s+/);
      const y = th + 0.06 + i * rh;
      out.push(textPrim({ x: 0.12, y, w: 0.25, h: rh }, sym ?? '', size, { font: 'body', fill: str(p, 'textColor'), align: 'center' }));
      out.push(textPrim({ x: 0.42, y, w: el.w - 0.5, h: rh }, rest.join(' '), size, { font: font(p), fill: str(p, 'textColor') }));
    });
    return out;
  },
});

def({
  type: 'bullets',
  label: 'Daily log (bullets)',
  category: 'Bullet journal',
  w: 4,
  h: 4,
  fields: [{ key: 'spacing', label: 'Row spacing (in)', kind: 'number', min: 0.15, max: 0.6, step: 0.01, group: 'Log' }, { key: 'patternColor', label: 'Dot colour', kind: 'color', group: 'Log' }, { key: 'lines', label: 'Writing lines', kind: 'bool', group: 'Log' }],
  defaults: { spacing: 0.25, patternColor: '#777777', lines: false },
  render: (el) => {
    const sp = num(el.props, 'spacing', 0.25);
    const c = str(el.props, 'patternColor', '#777777');
    const out: Prim[] = [];
    for (let y = sp / 2; y < el.h; y += sp) {
      out.push(...shapePrims('ellipse', { x: 0.04, y: y - 0.025, w: 0.05, h: 0.05 }, { fill: c }));
      if (bool(el.props, 'lines')) out.push({ k: 'path', path: linePath(0.18, y + sp * 0.35, el.w, y + sp * 0.35), stroke: '#b0b0b0', sw: 0.5 * PT });
    }
    return out;
  },
});

def({
  type: 'banner',
  label: 'Title banner',
  category: 'Bullet journal',
  w: 4,
  h: 0.7,
  fields: [{ key: 'text', label: 'Text', kind: 'text', group: 'Text' }, ...textFields(), ...shapeFields(), ...outlineFields()],
  defaults: { text: 'Collection', ...TEXT, font: 'display', fontSize: 18, ...SHAPE, shape: 'banner', noFill: false, fill: '#f2f2f2', ...OUTLINE },
  render: (el) => [
    ...shapePrims(str(el.props, 'shape', 'banner') as ShapeId, { x: 0, y: 0, w: el.w, h: el.h }, shapeOpts(el.props)),
    textPrim({ x: el.w * 0.1, y: 0, w: el.w * 0.8, h: el.h }, str(el.props, 'text'), num(el.props, 'fontSize', 18), { font: font(el.props), fill: str(el.props, 'textColor'), align: 'center' }),
  ],
});

def({
  type: 'mood',
  label: 'Mood / rating scale',
  category: 'Bullet journal',
  w: 3,
  h: 0.5,
  fields: [{ key: 'label', label: 'Label', kind: 'text', group: 'Scale' }, { key: 'count', label: 'Steps', kind: 'number', min: 2, max: 10, step: 1, group: 'Scale' }, ...SLOT_FIELDS().filter((f) => f.key !== 'labelPos')],
  defaults: { label: 'Mood', count: 5, ...SLOT_DEFAULTS, shape: 'star', fontSize: 9 },
  render: (el) => {
    const def2 = defs.find((d) => d.type === 'tracker')!;
    return def2.render({ ...el, props: { ...el.props, numbers: false } }, { pageNumber: 1 });
  },
});

function shift(p: Prim, dx: number, dy: number): Prim {
  const mv = (path: import('./geometry').Path) => path.map((s) => (s[0] === 'Z' ? s : (s.map((v, i) => (i === 0 ? v : i % 2 ? (v as number) + dx : (v as number) + dy)) as typeof s)));
  switch (p.k) {
    case 'path':
      return { ...p, path: mv(p.path) };
    case 'clip':
      return { ...p, path: mv(p.path), children: p.children.map((c) => shift(c, dx, dy)) };
    default:
      return { ...p, box: { ...p.box, x: p.box.x + dx, y: p.box.y + dy } };
  }
}

export const ELEMENTS: readonly ElementDef[] = defs;
export const getElementDef = (type: string) => defs.find((d) => d.type === type);

let seq = 0;
export function newElement(type: string, at: { x: number; y: number }, size?: { w: number; h: number }): DesignElement {
  const d = getElementDef(type);
  if (!d) throw new Error(`Unknown element ${type}`);
  return { id: `e${Date.now().toString(36)}${(seq++).toString(36)}`, type, x: at.x, y: at.y, w: size?.w ?? d.w, h: size?.h ?? d.h, rotate: 0, props: { ...d.defaults } };
}

export { patternPrims };
