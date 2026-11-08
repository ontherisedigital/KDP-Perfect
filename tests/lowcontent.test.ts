import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  artFit,
  artRegions,
  buildCoverArtPdf,
  buildInteriorPdf,
  computeCoverLayout,
  contentBox,
  placeImage,
  planInterior,
  styleMarks,
  type InteriorInput,
} from '../src/core';

const fonts = { display: readFileSync('src/app/fonts/fredoka-latin.woff2'), body: readFileSync('src/app/fonts/dosis-latin.woff2') };
const noFront = { title: '', subtitle: '', author: '', belongsTo: false, copyright: '' };
const img = (w = 2550, h = 3300) => ({ name: 'p.png', widthPx: w, heightPx: h });

function input(over: Partial<InteriorInput> = {}): InteriorInput {
  return {
    trimWidth: 8.5,
    trimHeight: 11,
    bleed: false,
    sided: 'single',
    front: noFront,
    content: { kind: 'coloring', images: Array.from({ length: 12 }, () => img()) },
    pageNumbers: false,
    limits: { min: 24, max: 590 },
    ...over,
  };
}

/** A tiny valid PNG (1x1 white). */
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='),
  (c) => c.charCodeAt(0),
);

describe('planInterior', () => {
  it('front only: every image on a right-hand page with a blank back', () => {
    const p = planInterior(input());
    expect(p.pageCount).toBe(24);
    for (const page of p.pages) {
      if (page.kind === 'image') expect(page.n % 2).toBe(1);
      else expect(page.kind).toBe('blank');
    }
    expect(p.valid).toBe(true);
  });

  it('front and back: images on consecutive pages', () => {
    const p = planInterior(input({ sided: 'double', content: { kind: 'coloring', images: Array.from({ length: 24 }, () => img()) } }));
    expect(p.pageCount).toBe(24);
    expect(p.pages.every((x) => x.kind === 'image')).toBe(true);
  });

  it('pads odd page counts with a final blank page', () => {
    const p = planInterior(input({ sided: 'double', content: { kind: 'coloring', images: Array.from({ length: 25 }, () => img()) } }));
    expect(p.pageCount).toBe(26);
    expect(p.pages.at(-1)!.kind).toBe('blank');
  });

  it('rejects books under the minimum and says how many to add', () => {
    const p = planInterior(input({ content: { kind: 'coloring', images: Array.from({ length: 10 }, () => img()) } }));
    expect(p.valid).toBe(false);
    expect(p.warnings.find((w) => w.code === 'too-few-pages')!.message).toContain('add 2 more images');
  });

  it('uses the hardcover minimum', () => {
    const p = planInterior(input({ limits: { min: 76, max: 550 } }));
    expect(p.warnings.some((w) => w.code === 'too-few-pages')).toBe(true);
  });

  it('places front matter: belongs-to, title on a right-hand page, copyright on its back', () => {
    const p = planInterior(input({ front: { title: 'My Book', subtitle: '', author: 'A', belongsTo: true, copyright: '(c) 2026' } }));
    expect(p.pages.slice(0, 5).map((x) => x.kind)).toEqual(['belongs', 'blank', 'title', 'copyright', 'image']);
  });

  it('journal pages carry page numbers in order', () => {
    const p = planInterior(input({ sided: 'double', content: { kind: 'journal', style: 'lined-wide', count: 100, dateLine: false } }));
    expect(p.pageCount).toBe(100);
    expect(p.pages[99]).toMatchObject({ kind: 'ruled', number: 100 });
  });
});

describe('geometry', () => {
  const l = planInterior(input()).layout!;

  it('mirrors the gutter: inside margin on the left of right-hand pages', () => {
    expect(contentBox(l, 1).x).toBe(l.margins.inside);
    expect(contentBox(l, 2).x).toBe(l.margins.outside);
  });

  it('no bleed: images fit inside the margins without cropping', () => {
    const pl = placeImage(img(), l, 1);
    const box = contentBox(l, 1);
    expect(pl.w).toBeLessThanOrEqual(box.w + 1e-6);
    expect(pl.h).toBeLessThanOrEqual(box.h + 1e-6);
    expect(pl.cropped).toBe(0);
  });

  it('bleed: images fill the page (trim + 0.125" wide, + 0.25" tall)', () => {
    const lb = planInterior(input({ bleed: true })).layout!;
    expect(lb.pageWidth).toBe(8.625);
    expect(lb.pageHeight).toBe(11.25);
    const pl = placeImage(img(2588, 3375), lb, 1);
    expect(pl.w).toBeGreaterThanOrEqual(8.625 - 1e-6);
    expect(pl.h).toBeGreaterThanOrEqual(11.25 - 1e-6);
    expect(pl.dpi).toBe(300);
  });

  it('flags low-resolution images', () => {
    const p = planInterior(input({ content: { kind: 'coloring', images: Array.from({ length: 12 }, () => img(800, 1000)) } }));
    expect(p.warnings.some((w) => w.code === 'image-dpi-poor')).toBe(true);
  });

  it('page styles stay inside the box', () => {
    const box = contentBox(l, 1);
    for (const style of ['lined-wide', 'lined-college', 'dot', 'graph', 'handwriting'] as const) {
      const marks = styleMarks(style, box, true);
      expect(marks.length).toBeGreaterThan(5);
      for (const m of marks) {
        for (const x of [m.x1, m.x2]) expect(x).toBeGreaterThanOrEqual(box.x - 1e-6), expect(x).toBeLessThanOrEqual(box.x + box.w + 1e-6);
        for (const y of [m.y1, m.y2]) expect(y).toBeGreaterThanOrEqual(box.y - 1e-6), expect(y).toBeLessThanOrEqual(box.y + box.h + 1e-6);
      }
    }
  });
});

describe('PDF output', () => {
  it('builds an interior with the exact page size and embedded fonts', async () => {
    const plan = planInterior(
      input({
        bleed: true,
        front: { title: 'Ocean Animals', subtitle: 'A coloring book', author: 'Me', belongsTo: true, copyright: 'Copyright 2026. All rights reserved.' },
      }),
    );
    const bytes = await buildInteriorPdf(plan, plan.input.content.kind === 'coloring' ? plan.input.content.images.map(() => ({ bytes: PNG, type: 'png' as const })) : [], fonts);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(plan.pageCount);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(8.625 * 72, 2);
    expect(height).toBeCloseTo(11.25 * 72, 2);
    const raw = Buffer.from(await doc.save({ useObjectStreams: false })).toString('latin1');
    expect(raw).toContain('/FontFile2');
    expect(raw).not.toMatch(/\/BaseFont\s*\/Helvetica/);
  });

  it('builds a journal interior', async () => {
    const plan = planInterior(input({ sided: 'double', pageNumbers: true, content: { kind: 'journal', style: 'dot', count: 120, dateLine: true } }));
    const doc = await PDFDocument.load(await buildInteriorPdf(plan, [], fonts));
    expect(doc.getPageCount()).toBe(120);
    expect(doc.getPage(0).getSize().width).toBeCloseTo(8.5 * 72, 2);
  });

  it('assembles a cover at the full-wrap size from front and back art', async () => {
    const l = computeCoverLayout({ trimWidth: 8.5, trimHeight: 11, pageCount: 100, paper: 'bw-white', readingDirection: 'ltr' });
    const r = artRegions(l);
    expect(r.front.x).toBeCloseTo(l.spine.x + l.spine.w, 6);
    expect(r.front.w).toBeCloseTo(8.5 + 0.125, 6);
    expect(r.back.w).toBeCloseTo(8.5 + 0.125, 6);
    const art = { bytes: PNG, type: 'png' as const, widthPx: 2588, heightPx: 3375 };
    expect(artFit(art, r.front).dpi).toBe(300);
    const bytes = await buildCoverArtPdf(l, { front: art, back: art, spineColor: '#224466', backColor: '#ffffff', spineText: 'My Book', spineTextColor: '#ffffff', title: 'x' }, fonts);
    const doc = await PDFDocument.load(bytes);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(l.canvas.w * 72, 1);
    expect(height).toBeCloseTo(l.canvas.h * 72, 1);
  });

  it('puts the front art on the left for right-to-left books', () => {
    const l = computeCoverLayout({ trimWidth: 6, trimHeight: 9, pageCount: 200, paper: 'bw-white', readingDirection: 'rtl' });
    expect(artRegions(l).front.x).toBe(0);
  });
});
