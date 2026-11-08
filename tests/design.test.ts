import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  ELEMENTS,
  FILL_PATTERNS,
  SHAPES,
  TEMPLATES,
  buildInteriorPdf,
  expandSequence,
  monthMatrix,
  newDoc,
  newElement,
  outsideSafe,
  pathBounds,
  planInterior,
  renderPage,
  shapePath,
  weeksStartingIn,
  yearPlanSequence,
  type Prim,
} from '../src/core';

const fonts = {
  display: readFileSync('src/app/fonts/fredoka-latin.woff2'),
  body: readFileSync('src/app/fonts/dosis-latin.woff2'),
  accent: readFileSync('src/app/fonts/arima-bold-latin.woff2'),
};
const safe = { x: 0.5, y: 0.5, w: 5, h: 8 };

function finite(p: Prim): boolean {
  if (p.k === 'path') return p.path.every((s) => s.slice(1).every((n) => Number.isFinite(n as number)));
  if (p.k === 'clip') return finite({ k: 'path', path: p.path }) && p.children.every(finite);
  return [p.box.x, p.box.y, p.box.w, p.box.h].every(Number.isFinite);
}

describe('shapes', () => {
  it('every shape fits its box', () => {
    for (const s of SHAPES) {
      const b = pathBounds(shapePath(s.id, 2, 1, 0.2));
      expect(b.x, s.id).toBeGreaterThanOrEqual(-0.15);
      expect(b.x + b.w, s.id).toBeLessThanOrEqual(2.15);
      expect(b.y + b.h, s.id).toBeLessThanOrEqual(1.05);
    }
  });
});

describe('elements', () => {
  it('every element renders finite primitives with defaults', () => {
    for (const d of ELEMENTS) {
      const prims = d.render(newElement(d.type, { x: 0, y: 0 }), { pageNumber: 3, date: { y: 2027, m: 2, d: 1 } });
      expect(prims.every(finite), d.type).toBe(true);
    }
  });

  it('every calendar element and shape offers lined and unlined insides', () => {
    const ids = FILL_PATTERNS.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['none', 'lines']));
    for (const d of ELEMENTS.filter((e) => e.category === 'Calendar' && !['mini-month', 'year', 'date-heading'].includes(e.type)).concat(ELEMENTS.filter((e) => e.type === 'shape'))) {
      expect(d.fields.some((f) => f.key === 'pattern'), d.type).toBe(true);
    }
  });

  it('lined slots draw lines clipped to the shape', () => {
    const e = newElement('day-slot', { x: 0, y: 0 });
    e.props.pattern = 'lines';
    e.props.shape = 'heart';
    const prims = ELEMENTS.find((d) => d.type === 'day-slot')!.render(e, { pageNumber: 1 });
    expect(prims.some((p) => p.k === 'clip' && p.children.length > 1)).toBe(true);
  });
});

describe('dates', () => {
  it('builds month grids', () => {
    // March 2027 starts on a Monday.
    expect(monthMatrix(2027, 2, 'mon')[0]![0]).toBe(1);
    expect(monthMatrix(2027, 2, 'sun')[0]![1]).toBe(1);
    expect(monthMatrix(2026, 1, 'sun').flat().filter(Boolean)).toHaveLength(28);
  });

  it('dated sequences advance; weeks follow the latest month page', () => {
    const doc = newDoc();
    doc.startDate = '2027-01-01';
    doc.pages.push({ id: 'p2', name: 'w', elements: [], mirror: false });
    doc.sequence = [
      { id: 'a', pageId: 'p1', count: 2, repeat: 'month' },
      { id: 'b', pageId: 'p2', count: 2, repeat: 'week' },
    ];
    const pages = expandSequence(doc);
    expect(pages.map((p) => p.date)).toEqual([
      { y: 2027, m: 0, d: 1 },
      { y: 2027, m: 1, d: 1 },
      { y: 2027, m: 1, d: 1 },
      { y: 2027, m: 1, d: 8 },
    ]);
  });

  it('year planner: weeks follow their month', () => {
    const doc = newDoc();
    doc.startDate = '2027-01-01';
    doc.pages.push({ id: 'p2', name: 'w', elements: [], mirror: false });
    doc.sequence = yearPlanSequence(doc, 'p1', 'p2', 12);
    const pages = expandSequence(doc);
    const weeks = pages.filter((p) => p.pageId === 'p2');
    expect(weeks).toHaveLength(52);
    // The week pages after February's month page all start in February.
    const febIdx = pages.findIndex((p) => p.pageId === 'p1' && p.date?.m === 1);
    expect(pages[febIdx + 1]!.date).toEqual({ y: 2027, m: 1, d: 1 });
    expect(weeksStartingIn(2027, 1, 'mon')).toBe(4);
  });
});

describe('templates and output', () => {
  it('templates stay inside the safe area', () => {
    for (const t of TEMPLATES) {
      const page = { id: 'x', name: t.label, elements: t.build(safe), mirror: false };
      expect(outsideSafe(page, safe).map((e) => e.type), t.id).toEqual([]);
    }
  });

  it('builds a dated planner PDF from designed pages', async () => {
    const doc = newDoc();
    doc.pages = TEMPLATES.filter((t) => t.id !== 'blank').map((t, i) => ({ id: `p${i}`, name: t.label, elements: t.build(safe), mirror: false }));
    doc.sequence = doc.pages.map((p, i) => ({ id: `s${i}`, pageId: p.id, count: 3, repeat: TEMPLATES[i + 1]!.repeat }));
    const expanded = expandSequence(doc);
    const plan = planInterior({
      trimWidth: 6,
      trimHeight: 9,
      bleed: false,
      sided: 'double',
      front: { title: '', subtitle: '', author: '', belongsTo: false, copyright: '' },
      content: { kind: 'custom', count: expanded.length, noun: 'pages' },
      pageNumbers: false,
      limits: { min: 24, max: 828 },
    });
    expect(plan.valid).toBe(true);
    const bytes = await buildInteriorPdf(plan, [], fonts, {
      render: (i, pg) => {
        const e = expanded[i]!;
        return renderPage(doc.pages.find((p) => p.id === e.pageId)!, { date: e.date, pageNumber: pg.n }, pg.origin);
      },
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(plan.pageCount);
    expect(Buffer.from(await pdf.save({ useObjectStreams: false })).toString('latin1')).not.toMatch(/\/BaseFont\s*\/Helvetica/);
  });
});
