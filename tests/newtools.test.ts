import { describe, expect, it } from 'vitest';
import {
  barcodeScene,
  buildInteriorPdf,
  ean13Modules,
  ean5Modules,
  imagesUsed,
  isProjectFile,
  pageList,
  parseIsbn,
  planInterior,
  priceAddon,
  readInteriorPdf,
  runInteriorPreflight,
  uniqueName,
  type InteriorBook,
  type InteriorFacts,
} from '../src/core';
import { readFileSync } from 'node:fs';

describe('ISBN barcode', () => {
  it('validates ISBN-13 and converts ISBN-10', () => {
    expect(parseIsbn('978-0-306-40615-7')).toMatchObject({ ok: true, isbn13: '9780306406157' });
    expect(parseIsbn('0-306-40615-2').isbn13).toBe('9780306406157');
    expect(parseIsbn('978-0-306-40615-8').ok).toBe(false);
    expect(parseIsbn('123').ok).toBe(false);
    expect(parseIsbn('1234567890128').ok).toBe(false); // not 978/979
  });

  it('encodes EAN-13 with the standard code sets', () => {
    const m = ean13Modules('9780306406157');
    expect(m).toHaveLength(95);
    expect(m.slice(0, 3)).toBe('101');
    expect(m.slice(45, 50)).toBe('01010');
    // Leading 9 = parity LGGLGL; second digit 7 in L = 0111011; third digit 8 in G = 0001001.
    expect(m.slice(3, 10)).toBe('0111011');
    expect(m.slice(10, 17)).toBe('0001001');
    // Last digit 7 in R = 1000100.
    expect(m.slice(85, 92)).toBe('1000100');
  });

  it('encodes the price add-on', () => {
    expect(priceAddon('14.99')).toMatchObject({ ok: true, code: '51499' });
    expect(priceAddon('$9')).toMatchObject({ ok: true, code: '50900' });
    expect(priceAddon('90000').code).toBe('90000');
    expect(priceAddon('abc').ok).toBe(false);
    const a = ean5Modules('51499');
    expect(a.startsWith('1011')).toBe(true);
    expect(a).toHaveLength(4 + 5 * 7 + 4 * 2);
  });

  it('draws a barcode that fits KDP’s 2" x 1.2" box at the default 85%', () => {
    const s = barcodeScene({ isbn13: '9780306406157', addon: '51499' });
    expect(s.width).toBeLessThanOrEqual(2);
    expect(s.height).toBeLessThanOrEqual(1.2);
    expect(s.background).toBe('#FFFFFF');
    expect(s.items.filter((i) => i.kind === 'rect').length).toBeGreaterThan(30);
  });
});

const book: InteriorBook = { trimWidth: 6, trimHeight: 9, binding: 'paperback', limits: { min: 24, max: 828 }, coverPages: null };
const pages = (n: number, w = 6, h = 9, extra: Partial<InteriorFacts['pages'][number]> = {}) => Array.from({ length: n }, () => ({ wIn: w, hIn: h, ...extra }));
const facts = (p: InteriorFacts['pages'], fonts: InteriorFacts['fonts'] = [{ name: 'Body', embedded: true }]): InteriorFacts => ({ pages: p, fonts, encrypted: false });
const status = (r: ReturnType<typeof runInteriorPreflight>, id: string) => r.checks.find((c) => c.id === id)?.status;

describe('interior preflight', () => {
  it('passes a clean no-bleed interior', () => {
    const r = runInteriorPreflight(book, facts(pages(100, 6, 9, { ink: { x: 1, y: 1, w: 4, h: 7 }, minDpi: 300 })));
    expect(r.verdict).toBe('pass');
    expect(r.bleed).toBe(false);
  });

  it('detects bleed from the page size', () => {
    const r = runInteriorPreflight(book, facts(pages(100, 6.125, 9.25)));
    expect(r.bleed).toBe(true);
    expect(status(r, 'size')).toBe('pass');
  });

  it('fails a wrong page size, mixed sizes and too few pages', () => {
    const p = pages(20, 8.5, 11);
    p[3] = { wIn: 6, hIn: 9 };
    const r = runInteriorPreflight(book, facts(p));
    expect(status(r, 'size')).toBe('fail');
    expect(status(r, 'same-size')).toBe('fail');
    expect(status(r, 'pages')).toBe('fail');
  });

  it('flags ink in the margins, using the gutter on the spine side', () => {
    // Page 1 (right-hand): gutter on the left. 100 pages: gutter 0.375". Ink at 0.3" from the left is too close.
    const p = pages(100, 6, 9, { ink: { x: 1, y: 1, w: 4, h: 7 } });
    p[0] = { wIn: 6, hIn: 9, ink: { x: 0.3, y: 1, w: 4, h: 7 } };
    // Page 2 (left-hand): gutter on the right; 0.3" from the left is the outside margin (0.25"), fine.
    p[1] = { wIn: 6, hIn: 9, ink: { x: 0.3, y: 1, w: 4, h: 7 } };
    const r = runInteriorPreflight(book, facts(p));
    expect(status(r, 'margins')).toBe('fail');
    expect(r.checks.find((c) => c.id === 'margins')!.detail).toMatch(/page 1\b/);
  });

  it('with bleed, art running off the edge is fine but text in the margin is not', () => {
    const full = { x: 0, y: 0, w: 6.125, h: 9.25 };
    const ok = runInteriorPreflight(book, facts(pages(100, 6.125, 9.25, { ink: full })));
    expect(status(ok, 'margins')).toBe('pass');
    const p = pages(100, 6.125, 9.25, { ink: full });
    p[5] = { wIn: 6.125, hIn: 9.25, ink: { x: 0.2, y: 1, w: 5, h: 7 } };
    expect(status(runInteriorPreflight(book, facts(p)), 'margins')).toBe('warn');
  });

  it('flags missing fonts, low DPI and a cover page-count mismatch', () => {
    const r = runInteriorPreflight({ ...book, coverPages: 120 }, facts(pages(100, 6, 9, { minDpi: 150 }), [{ name: 'Arial', embedded: false }]));
    expect(status(r, 'fonts')).toBe('fail');
    expect(status(r, 'images')).toBe('fail');
    expect(status(r, 'cover-pages')).toBe('warn');
  });

  it('reads page sizes and embedded fonts from a real PDF', async () => {
    const fonts = { display: readFileSync('src/app/fonts/fredoka-latin.woff2'), body: readFileSync('src/app/fonts/dosis-latin.woff2') };
    const plan = planInterior({
      trimWidth: 6,
      trimHeight: 9,
      bleed: false,
      sided: 'double',
      front: { title: 'T', subtitle: '', author: '', belongsTo: false, copyright: '' },
      content: { kind: 'journal', style: 'lined-wide', count: 30, dateLine: false },
      pageNumbers: true,
      limits: { min: 24, max: 828 },
    });
    const f = await readInteriorPdf(await buildInteriorPdf(plan, [], fonts));
    expect(f.pages.length).toBe(plan.pageCount);
    expect(f.pages[0]).toEqual({ wIn: 6, hIn: 9 });
    expect(f.fonts.length).toBeGreaterThan(0);
    expect(f.fonts.every((x) => x.embedded)).toBe(true);
  });

  it('lists page numbers compactly', () => {
    expect(pageList([1, 2, 3, 7, 9, 10])).toBe('1-3, 7, 9-10');
  });
});

describe('projects', () => {
  it('makes unique names', () => {
    expect(uniqueName('Book', ['Book', 'Book (2)'])).toBe('Book (3)');
    expect(uniqueName('  ', [])).toBe('Untitled book');
  });
  it('finds the images a design uses and validates project files', () => {
    const p = { state: {}, design: { pages: [{ elements: [{ props: { src: 'img1' } }] }] }, puzzles: {} };
    expect(imagesUsed(p, ['img1', 'img2'])).toEqual(['img1']);
    const file = { format: 'selfpublisher-studio-project', version: 1, project: { id: 'p', name: 'n', savedAt: 'x', ...p }, images: [] };
    expect(isProjectFile(file)).toBe(true);
    expect(isProjectFile({ ...file, version: 2 })).toBe(false);
  });
});
