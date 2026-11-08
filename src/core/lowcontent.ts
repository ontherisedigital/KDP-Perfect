/**
 * Low-content interiors: coloring/activity books built from page images, and journals, notebooks
 * and planners built from generated page styles.
 *
 * Pure maths and planning (no DOM). `render/interiorPdf.ts` turns a plan into a print-ready PDF.
 * Coordinates are inches, origin top-left of the PDF page (trim + bleed when bleed is on).
 */

import { interiorLayout, type InteriorLayout } from './interior';
import { BLEED } from './specs';
import { round } from './units';

/** `single`: content on right-hand pages only, every back left blank. `double`: content on both sides. */
export type Sided = 'single' | 'double';
export type LowContentKind = 'coloring' | 'journal';

export type PageStyle = 'lined-wide' | 'lined-college' | 'dot' | 'graph' | 'blank' | 'handwriting';

export const PAGE_STYLES: readonly { id: PageStyle; label: string; note: string }[] = [
  { id: 'lined-wide', label: 'Lined (wide rule)', note: '11/32" (8.7 mm) line spacing, notebooks and journals' },
  { id: 'lined-college', label: 'Lined (college rule)', note: '9/32" (7.1 mm) line spacing, composition books' },
  { id: 'dot', label: 'Dot grid', note: '1/4" (5 mm) dot spacing, bullet journals and planners' },
  { id: 'graph', label: 'Graph paper', note: '1/4" squares' },
  { id: 'handwriting', label: 'Handwriting practice', note: 'Solid top and base lines, dashed midline' },
  { id: 'blank', label: 'Blank', note: 'Sketchbooks and plain notebooks' },
];

export const LINE_SPACING: Record<'lined-wide' | 'lined-college', number> = { 'lined-wide': 11 / 32, 'lined-college': 9 / 32 };
export const GRID_SPACING = 0.25;
export const HANDWRITING_ROW = 0.75; // one practice row: top line to base line is 2/3 of this

/** KDP recommends 300 DPI for images; below this the preflight warns. */
export const MIN_IMAGE_DPI = 300;
/** Below this the print will look visibly soft. */
export const POOR_IMAGE_DPI = 200;
/** KDP rejects more than this many blank pages in a row inside the book (more are allowed at the end). */
export const MAX_BLANK_RUN = 2;
export const MAX_BLANK_RUN_AT_END = 10;

export interface FrontMatter {
  /** Title page text; omitted when empty. */
  title: string;
  subtitle: string;
  author: string;
  /** A "This book belongs to" page. */
  belongsTo: boolean;
  /** Copyright page text (on the back of the title page); omitted when empty. */
  copyright: string;
}

export interface ImageInfo {
  name: string;
  widthPx: number;
  heightPx: number;
}

export type ContentSpec =
  | { kind: 'coloring'; images: ImageInfo[] }
  | { kind: 'journal'; style: PageStyle; count: number; dateLine: boolean };

export interface InteriorInput {
  trimWidth: number;
  trimHeight: number;
  bleed: boolean;
  sided: Sided;
  front: FrontMatter;
  content: ContentSpec;
  pageNumbers: boolean;
  /** KDP's page-count window for the chosen binding, trim and paper. */
  limits: { min: number; max: number | null };
}

export type PlannedPage =
  | { n: number; kind: 'blank' }
  | { n: number; kind: 'belongs' | 'title' | 'copyright' }
  | { n: number; kind: 'image'; image: number }
  | { n: number; kind: 'ruled'; style: PageStyle; dateLine: boolean; number: number };

export interface Placement {
  /** Where the image is drawn (may extend past the page when it is cropped to fill). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Effective resolution at this size. */
  dpi: number;
  /** Share of the image cut off to fill the page (0 = none). */
  cropped: number;
}

export interface InteriorWarning {
  level: 'error' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface InteriorPlan {
  input: InteriorInput;
  pages: PlannedPage[];
  pageCount: number;
  /** Margins and page size. `null` when there are no pages. */
  layout: InteriorLayout | null;
  /** Image placement per input image (coloring books). */
  placements: Placement[];
  warnings: InteriorWarning[];
  valid: boolean;
}

/** 1-based page `n` is a right-hand (recto) page when odd. */
export const isRecto = (n: number) => n % 2 === 1;

/** Lay out every page of the book. */
export function planInterior(input: InteriorInput): InteriorPlan {
  const pages: PlannedPage[] = [];
  const add = (p: Omit<PlannedPage, 'n'>) => pages.push({ ...p, n: pages.length + 1 } as PlannedPage);
  /** Make the next page a right-hand page. */
  const toRecto = () => {
    if (pages.length % 2 === 1) add({ kind: 'blank' });
  };

  const f = input.front;
  if (f.belongsTo) {
    add({ kind: 'belongs' });
    add({ kind: 'blank' });
  }
  if (f.title.trim()) {
    toRecto();
    add({ kind: 'title' });
    add(f.copyright.trim() ? { kind: 'copyright' } : { kind: 'blank' });
  } else if (f.copyright.trim()) {
    toRecto();
    add({ kind: 'copyright' });
  }

  const c = input.content;
  const items: Omit<PlannedPage, 'n'>[] =
    c.kind === 'coloring'
      ? c.images.map((_, i) => ({ kind: 'image' as const, image: i }))
      : Array.from({ length: Math.max(0, Math.floor(c.count)) }, (_, i) => ({ kind: 'ruled' as const, style: c.style, dateLine: c.dateLine, number: i + 1 }));

  if (items.length) toRecto();
  for (const item of items) {
    if (input.sided === 'single') {
      toRecto();
      add(item);
      add({ kind: 'blank' });
    } else {
      add(item);
    }
  }
  // KDP prints in sheets: an odd count gets a blank last page anyway, so add it explicitly.
  if (pages.length % 2 === 1) add({ kind: 'blank' });

  const warnings: InteriorWarning[] = [];
  const pageCount = pages.length;
  const { min, max } = input.limits;
  if (!items.length) {
    warnings.push({ level: 'error', code: 'no-content', message: c.kind === 'coloring' ? 'Add your page images.' : 'Choose how many journal pages you want.' });
  }
  if (max === null) {
    warnings.push({ level: 'error', code: 'unavailable', message: 'This ink and paper combination is not available at this trim size.' });
  } else if (items.length && pageCount < min) {
    const short = min - pageCount;
    const per = input.sided === 'single' ? 2 : 1;
    const more = Math.ceil(short / per);
    warnings.push({
      level: 'error',
      code: 'too-few-pages',
      message: `KDP needs at least ${min} pages for this binding. This book has ${pageCount}: add ${more} more ${c.kind === 'coloring' ? (more === 1 ? 'image' : 'images') : 'pages'}.`,
    });
  } else if (pageCount > max) {
    warnings.push({ level: 'error', code: 'too-many-pages', message: `KDP allows at most ${max} pages for this trim size and paper. This book has ${pageCount}.` });
  }

  const run = longestBlankRun(pages);
  if (run.inside > MAX_BLANK_RUN) {
    warnings.push({ level: 'warning', code: 'blank-run', message: `${run.inside} blank pages in a row. KDP may reject more than ${MAX_BLANK_RUN} in a row inside the book.` });
  }
  if (run.end > MAX_BLANK_RUN_AT_END) {
    warnings.push({ level: 'warning', code: 'blank-run-end', message: `${run.end} blank pages at the end. KDP may reject more than ${MAX_BLANK_RUN_AT_END}.` });
  }

  // Margins depend on page count; outside KDP's range use the nearest valid count so the preview still works.
  const layout = pageCount > 0 ? interiorLayout(input.trimWidth, input.trimHeight, Math.min(828, Math.max(24, pageCount)), input.bleed) : null;

  const placements: Placement[] = [];
  if (layout && c.kind === 'coloring') {
    c.images.forEach((img) => {
      const n = pages.find((p) => p.kind === 'image' && p.image === placements.length)?.n ?? 1;
      const p = placeImage(img, layout, n);
      placements.push(p);
    });
    const low = placements.filter((p) => p.dpi < MIN_IMAGE_DPI).length;
    const poor = placements.filter((p) => p.dpi < POOR_IMAGE_DPI).length;
    if (poor) {
      warnings.push({
        level: 'warning',
        code: 'image-dpi-poor',
        message: `${poor} ${poor === 1 ? 'image prints' : 'images print'} below ${POOR_IMAGE_DPI} DPI and will look blurry or jagged. Use larger images (see the list below).`,
      });
    } else if (low) {
      warnings.push({ level: 'info', code: 'image-dpi-low', message: `${low} ${low === 1 ? 'image is' : 'images are'} under KDP's recommended ${MIN_IMAGE_DPI} DPI.` });
    }
    const crop = placements.filter((p) => p.cropped > 0.05).length;
    if (crop) {
      warnings.push({
        level: 'info',
        code: 'image-cropped',
        message: `${crop} ${crop === 1 ? 'image is' : 'images are'} a different shape from the page, so the edges are cut off to fill it. Check the preview.`,
      });
    }
  }

  return { input, pages, pageCount, layout, placements, warnings, valid: !warnings.some((w) => w.level === 'error') && !!layout };
}

function longestBlankRun(pages: PlannedPage[]): { inside: number; end: number } {
  let inside = 0;
  let cur = 0;
  for (const p of pages) {
    if (p.kind === 'blank') cur++;
    else {
      inside = Math.max(inside, cur);
      cur = 0;
    }
  }
  return { inside, end: cur };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The whole PDF page (trim + bleed). */
export const pageBox = (l: InteriorLayout): Box => ({ x: 0, y: 0, w: l.pageWidth, h: l.pageHeight });

/**
 * The area inside the margins for page `n`. The gutter (inside margin) is on the left of right-hand pages
 * and on the right of left-hand pages. With bleed, the bleed sits on the outside edge and top/bottom.
 */
export function contentBox(l: InteriorLayout, n: number): Box {
  const { inside, outside, top, bottom } = l.margins;
  const left = isRecto(n) ? inside : outside;
  const right = isRecto(n) ? outside : inside;
  // With bleed, the page is wider on the outside only, so on left-hand pages the whole page shifts.
  return { x: round(left), y: round(top), w: round(l.pageWidth - left - right), h: round(l.pageHeight - top - bottom) };
}

/**
 * The trimmed page inside the bleed for page `n`. Bleed is added on the outside edge (right of a right-hand page,
 * left of a left-hand page) and on top and bottom.
 */
export function trimBox(l: InteriorLayout, n: number): Box {
  if (!l.bleed) return pageBox(l);
  return { x: isRecto(n) ? 0 : BLEED, y: BLEED, w: round(l.pageWidth - BLEED), h: round(l.pageHeight - 2 * BLEED) };
}

/**
 * Where a page image goes. With bleed the art fills the whole page to the edge (cropped to fit if needed). Without
 * bleed it is scaled to fit inside the margins and centered, so nothing gets trimmed.
 */
export function placeImage(img: ImageInfo, l: InteriorLayout, n: number): Placement {
  const target = l.bleed ? pageBox(l) : contentBox(l, n);
  const ar = img.widthPx / img.heightPx;
  const tar = target.w / target.h;
  let w: number;
  let h: number;
  if (l.bleed ? ar > tar : ar < tar) {
    h = target.h;
    w = h * ar;
  } else {
    w = target.w;
    h = w / ar;
  }
  const visible = l.bleed ? (target.w * target.h) / (w * h) : 1;
  return {
    x: round(target.x + (target.w - w) / 2),
    y: round(target.y + (target.h - h) / 2),
    w: round(w),
    h: round(h),
    dpi: Math.round(img.widthPx / w),
    cropped: round(1 - visible),
  };
}

// --- Generated page styles -----------------------------------------------------------------

export interface Mark {
  kind: 'line' | 'dot';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Line weight (inches); dot diameter for dots. */
  weight: number;
  /** Grey level 0 (black) to 1 (white). */
  grey: number;
  dash?: [number, number];
}

/** Space reserved at the top of a ruled page for a "Date" line. */
export const DATE_LINE_SPACE = 0.45;

/** Lines and dots for one generated page, inside `box`. */
export function styleMarks(style: PageStyle, box: Box, dateLine: boolean): Mark[] {
  const marks: Mark[] = [];
  let top = box.y;
  if (dateLine && style !== 'blank') {
    const y = round(box.y + 0.3);
    marks.push({ kind: 'line', x1: round(box.x + box.w - 2), y1: y, x2: round(box.x + box.w), y2: y, weight: 0.008, grey: 0.45 });
    top = box.y + DATE_LINE_SPACE;
  }
  const bottom = box.y + box.h;
  const left = box.x;
  const right = box.x + box.w;

  switch (style) {
    case 'lined-wide':
    case 'lined-college': {
      const s = LINE_SPACING[style];
      for (let y = top + s; y <= bottom + 1e-9; y += s) marks.push({ kind: 'line', x1: left, y1: round(y), x2: right, y2: round(y), weight: 0.006, grey: 0.6 });
      break;
    }
    case 'dot': {
      const s = GRID_SPACING;
      const cols = Math.floor(box.w / s);
      const rows = Math.floor((bottom - top) / s);
      const x0 = left + (box.w - cols * s) / 2;
      const y0 = top + (bottom - top - rows * s) / 2;
      for (let r = 0; r <= rows; r++)
        for (let k = 0; k <= cols; k++) {
          const x = round(x0 + k * s);
          const y = round(y0 + r * s);
          marks.push({ kind: 'dot', x1: x, y1: y, x2: x, y2: y, weight: 0.018, grey: 0.55 });
        }
      break;
    }
    case 'graph': {
      const s = GRID_SPACING;
      const cols = Math.floor(box.w / s);
      const rows = Math.floor((bottom - top) / s);
      const x0 = left + (box.w - cols * s) / 2;
      const y0 = top + (bottom - top - rows * s) / 2;
      const x1 = round(x0 + cols * s);
      const y1 = round(y0 + rows * s);
      for (let k = 0; k <= cols; k++) marks.push({ kind: 'line', x1: round(x0 + k * s), y1: round(y0), x2: round(x0 + k * s), y2: y1, weight: 0.004, grey: 0.7 });
      for (let r = 0; r <= rows; r++) marks.push({ kind: 'line', x1: round(x0), y1: round(y0 + r * s), x2: x1, y2: round(y0 + r * s), weight: 0.004, grey: 0.7 });
      break;
    }
    case 'handwriting': {
      const row = HANDWRITING_ROW;
      const tall = (row * 2) / 3;
      for (let y = top + 0.15; y + tall <= bottom + 1e-9; y += row) {
        const t = round(y);
        const mid = round(y + tall / 2);
        const base = round(y + tall);
        marks.push({ kind: 'line', x1: left, y1: t, x2: right, y2: t, weight: 0.008, grey: 0.45 });
        marks.push({ kind: 'line', x1: left, y1: mid, x2: right, y2: mid, weight: 0.006, grey: 0.6, dash: [0.06, 0.05] });
        marks.push({ kind: 'line', x1: left, y1: base, x2: right, y2: base, weight: 0.01, grey: 0.35 });
      }
      break;
    }
    case 'blank':
      break;
  }
  return marks;
}

/** What to tell the user about bleed (also shown in the UI). */
export const BLEED_ADVICE =
  'Choose "Bleed" only if your artwork runs off the edge of the page. If everything sits inside a white border, choose "No bleed": it is simpler and nothing important can be trimmed off.';

export function interiorFileName(plan: InteriorPlan): string {
  const t = plan.input;
  const kind = t.content.kind === 'coloring' ? 'coloring-book' : t.content.style;
  return `kdp-interior_${kind}_${t.trimWidth}x${t.trimHeight}in_${plan.pageCount}pp_${t.bleed ? 'bleed' : 'no-bleed'}.pdf`;
}
