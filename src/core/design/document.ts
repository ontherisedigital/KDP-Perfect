/**
 * A designer document: page layouts the user builds from elements, and a page sequence that repeats them (optionally
 * dated: one page per day, week or month) to make a whole planner or journal.
 *
 * Element positions are relative to the TRIM page's top-left (bleed is added around it when the book has bleed).
 */

import { addDays, addMonths, parseDate, weekStartOf, type SimpleDate, type WeekStart } from './dates';
import { getElementDef, type DesignElement, type RenderCtx } from './elements';
import { transformPath, transformPoint, type Box, type Transform } from './geometry';
import type { Prim } from './prims';

export interface PageDesign {
  id: string;
  name: string;
  elements: DesignElement[];
  /** On left-hand pages, mirror the layout so the gutter side stays clear. */
  mirror: boolean;
}

export type Repeat = 'none' | 'day' | 'week' | 'month';

export interface SequenceItem {
  id: string;
  pageId: string;
  count: number;
  /** How the date advances from one copy to the next. */
  repeat: Repeat;
}

export interface DesignDoc {
  version: 1;
  pages: PageDesign[];
  sequence: SequenceItem[];
  /** First date of a dated planner, `YYYY-MM-DD`. Each dated sequence item continues from where the last one ended. */
  startDate: string;
  weekStart: WeekStart;
}

export interface ExpandedPage {
  pageId: string;
  date?: SimpleDate;
}

export function newDoc(): DesignDoc {
  const y = new Date().getFullYear() + 1;
  return { version: 1, pages: [{ id: 'p1', name: 'Page 1', elements: [], mirror: false }], sequence: [{ id: 's1', pageId: 'p1', count: 1, repeat: 'none' }], startDate: `${y}-01-01`, weekStart: 'mon' };
}

/**
 * Turn the sequence into the list of pages to print. Dated items share one running date per unit, so "12 monthly
 * pages, then 52 weekly pages" both start at the planner's start date, while "monthly page, then 4 weekly pages"
 * repeated keeps the weeks inside the month they follow.
 */
export function expandSequence(doc: DesignDoc): ExpandedPage[] {
  const start = parseDate(doc.startDate) ?? { y: new Date().getFullYear() + 1, m: 0, d: 1 };
  const cursor: Record<Exclude<Repeat, 'none'>, SimpleDate> = {
    day: start,
    week: firstWeekOnOrAfter(start, doc.weekStart),
    month: { y: start.y, m: start.m, d: 1 },
  };
  const out: ExpandedPage[] = [];
  for (const item of doc.sequence) {
    if (!doc.pages.some((p) => p.id === item.pageId)) continue;
    const n = Math.max(0, Math.min(1000, Math.floor(item.count)));
    for (let i = 0; i < n; i++) {
      if (item.repeat === 'none') {
        out.push({ pageId: item.pageId });
        continue;
      }
      const d = cursor[item.repeat];
      out.push({ pageId: item.pageId, date: d });
      // Pages after a month page belong to that month: don't let weeks or days run behind it.
      if (item.repeat === 'month') {
        const w = firstWeekOnOrAfter(d, doc.weekStart);
        if (compare(cursor.week, w) < 0) cursor.week = w;
        if (compare(cursor.day, d) < 0) cursor.day = d;
      }
      cursor[item.repeat] = item.repeat === 'day' ? addDays(d, 1) : item.repeat === 'week' ? addDays(d, 7) : addMonths(d, 1);
    }
  }
  return out;
}

const compare = (a: SimpleDate, b: SimpleDate) => a.y - b.y || a.m - b.m || a.d - b.d;

/** The first week start on or after `d`. */
export function firstWeekOnOrAfter(d: SimpleDate, ws: WeekStart): SimpleDate {
  const w = weekStartOf(d, ws);
  return compare(w, d) < 0 ? addDays(w, 7) : w;
}

/** Apply an element's position and rotation to one of its primitives. */
export function placePrim(t: Transform, p: Prim): Prim {
  switch (p.k) {
    case 'path':
      return { ...p, path: transformPath(t, p.path) };
    case 'clip':
      return { ...p, path: transformPath(t, p.path), children: p.children.map((c) => placePrim(t, c)) };
    case 'text':
    case 'image': {
      const [cx, cy] = transformPoint(t, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2);
      return { ...p, box: { x: cx - p.box.w / 2, y: cy - p.box.h / 2, w: p.box.w, h: p.box.h }, rotate: (p.rotate ?? 0) + t.rotate };
    }
  }
}

/**
 * Everything on one page, in page coordinates. `origin` is where the trim page's top-left sits in the output page
 * (0,0 without bleed). `mirrorWidth` mirrors element positions across the trim width (left-hand pages).
 */
export function renderPage(page: PageDesign, ctx: RenderCtx, origin = { x: 0, y: 0 }, mirrorWidth?: number): Prim[] {
  const out: Prim[] = [];
  for (const el of page.elements) {
    const def = getElementDef(el.type);
    if (!def) continue;
    const x = mirrorWidth !== undefined ? mirrorWidth - el.x - el.w : el.x;
    const t: Transform = { x: origin.x + x, y: origin.y + el.y, w: el.w, h: el.h, rotate: el.rotate };
    for (const p of def.render(el, ctx)) out.push(placePrim(t, p));
  }
  return out;
}

/** Elements that reach into the margins (or past the page) on a page of this size. */
export function outsideSafe(page: PageDesign, safe: Box): DesignElement[] {
  return page.elements.filter((e) => {
    const corners = [
      [0, 0],
      [e.w, 0],
      [0, e.h],
      [e.w, e.h],
    ].map(([px, py]) => transformPoint({ x: e.x, y: e.y, w: e.w, h: e.h, rotate: e.rotate }, px!, py!));
    return corners.some(([x, y]) => x < safe.x - 1e-3 || y < safe.y - 1e-3 || x > safe.x + safe.w + 1e-3 || y > safe.y + safe.h + 1e-3);
  });
}

/** Image asset ids used anywhere in the document. */
export function usedImages(doc: DesignDoc): string[] {
  const ids = new Set<string>();
  for (const p of doc.pages) for (const e of p.elements) if (e.type === 'image' && typeof e.props.src === 'string' && e.props.src) ids.add(e.props.src);
  return [...ids];
}

/** Light validation for documents loaded from storage or a file. */
export function isDesignDoc(v: unknown): v is DesignDoc {
  const d = v as DesignDoc;
  return !!d && d.version === 1 && Array.isArray(d.pages) && Array.isArray(d.sequence) && d.pages.every((p) => typeof p.id === 'string' && Array.isArray(p.elements));
}
