/**
 * Interior preflight: compare a finished interior PDF with what KDP expects for the book on the left
 * (trim size, binding, paper) and report page size, bleed, page count, margins, fonts and image resolution.
 *
 * `readInteriorPdf` reads what pdf-lib can see (page sizes, fonts). The app adds what needs rendering
 * (ink positions, placed image resolution, via pdf.js). `runInteriorPreflight` is pure.
 */

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, type PDFObject } from 'pdf-lib';
import { gutterMargin, OUTSIDE_MARGIN } from './interior';
import { BLEED } from './specs';
import type { Check, PreflightResult } from './preflight';
import { formatSize, round } from './units';

export interface InteriorPage {
  /** Page (media box) size, inches. */
  wIn: number;
  hIn: number;
  /** Bounding box of everything printed on the page, inches, y-down. `null` = blank; `undefined` = not measured. */
  ink?: { x: number; y: number; w: number; h: number } | null;
  /** Lowest effective resolution of an image drawn on the page; `null` = no images; `undefined` = not measured. */
  minDpi?: number | null;
}

export interface InteriorFacts {
  pages: InteriorPage[];
  fonts: { name: string; embedded: boolean }[];
  encrypted: boolean;
}

export interface InteriorBook {
  trimWidth: number;
  trimHeight: number;
  binding: 'paperback' | 'hardcover';
  limits: { min: number; max: number | null };
  /** Page count set for the cover, if any. */
  coverPages: number | null;
}

export interface InteriorResult extends PreflightResult {
  pageCount: number;
  bleed: boolean | null;
}

const TOL = 0.01; // inches; app choice
const INK_TOL = 0.03; // inches; anti-aliasing and rounding in the ink measurement
const DPI = { warnBelow: 299, failBelow: 200 } as const;

const sizeLabel = (w: number, h: number) => formatSize(round(w, 3), round(h, 3), 'in');
const near = (a: number, b: number, t = TOL) => Math.abs(a - b) <= t;

/** Page numbers as a short list: "3, 5, 9-12 and 4 more". */
export function pageList(ns: number[], max = 8): string {
  const runs: string[] = [];
  for (let i = 0; i < ns.length; ) {
    let j = i;
    while (j + 1 < ns.length && ns[j + 1] === ns[j]! + 1) j++;
    runs.push(j > i ? `${ns[i]}-${ns[j]}` : `${ns[i]}`);
    i = j + 1;
  }
  return runs.length > max ? `${runs.slice(0, max).join(', ')} and ${runs.length - max} more` : runs.join(', ');
}

export function runInteriorPreflight(book: InteriorBook, f: InteriorFacts): InteriorResult {
  const checks: Check[] = [];
  const add = (id: string, status: Check['status'], title: string, detail: string) => checks.push({ id, status, title, detail });
  const n = f.pages.length;
  const { trimWidth: tw, trimHeight: th } = book;

  if (f.encrypted) add('encrypted', 'fail', 'Password protection', 'This PDF is protected. KDP cannot print protected files; save an unprotected copy.');

  // --- page size and bleed ---
  let bleed: boolean | null = null;
  const p0 = f.pages[0];
  if (p0) {
    if (near(p0.wIn, tw) && near(p0.hIn, th)) bleed = false;
    else if (near(p0.wIn, tw + BLEED) && near(p0.hIn, th + 2 * BLEED)) bleed = true;
    const swapped = near(p0.wIn, th) && near(p0.hIn, tw);
    if (bleed === null) {
      add(
        'size',
        'fail',
        'Page size',
        `Pages are ${sizeLabel(p0.wIn, p0.hIn)}. For a ${sizeLabel(tw, th)} book they should be ${sizeLabel(tw, th)} without bleed, or ${sizeLabel(tw + BLEED, th + 2 * BLEED)} with bleed.` +
          (swapped ? ' The page looks rotated: width and height are swapped.' : ''),
      );
    } else {
      add('size', 'pass', 'Page size', `${sizeLabel(p0.wIn, p0.hIn)}: ${bleed ? 'trim size plus bleed' : 'the trim size, no bleed'}.`);
      add(
        'bleed',
        'info',
        'Bleed',
        bleed
          ? 'Set up with bleed. Choose "Bleed" when you upload the interior to KDP.'
          : 'Set up without bleed. Choose "No bleed" when you upload; nothing may print to the edge of the page.',
      );
    }
    const odd = f.pages.map((p, i) => (near(p.wIn, p0.wIn) && near(p.hIn, p0.hIn) ? 0 : i + 1)).filter(Boolean);
    if (odd.length) add('same-size', 'fail', 'Mixed page sizes', `Page${odd.length > 1 ? 's' : ''} ${pageList(odd)} ${odd.length > 1 ? 'are' : 'is'} a different size from page 1. Every page must be the same size.`);
  }

  // --- page count ---
  const { min, max } = book.limits;
  if (n < min) add('pages', 'fail', 'Page count', `${n} pages. KDP needs at least ${min} for this ${book.binding}; add ${min - n} more.`);
  else if (max !== null && n > max) add('pages', 'fail', 'Page count', `${n} pages. The most for this trim size and paper is ${max}.`);
  else add('pages', 'pass', 'Page count', `${n} pages, within ${min} to ${max ?? 'the maximum'}.`);
  if (n % 2) add('odd', 'info', 'Odd page count', 'KDP adds a blank page at the end so the count is even. Add one yourself if the last page matters.');
  if (book.coverPages !== null && book.coverPages !== n)
    add('cover-pages', 'warn', 'Cover page count', `Your cover is set up for ${book.coverPages} pages but this interior has ${n}. The spine width depends on it, so rebuild the cover for ${n} pages.`);

  // --- margins (needs rendered ink) ---
  const measured = f.pages.filter((p) => p.ink !== undefined).length;
  if (bleed !== null && measured && n >= 1) {
    const gutter = gutterMargin(Math.min(Math.max(n, 24), 828));
    const outside = bleed ? OUTSIDE_MARGIN.bleed : OUTSIDE_MARGIN.noBleed;
    const tight: number[] = [];
    const notToEdge: number[] = [];
    f.pages.forEach((p, i) => {
      if (!p.ink) return;
      const right = (i + 1) % 2 === 1; // page 1 is a right-hand page: gutter on its left
      const m = { left: right ? gutter : outside, right: right ? outside : gutter, top: outside, bottom: outside };
      const ink = p.ink;
      const into = {
        left: ink.x < m.left - INK_TOL,
        right: ink.x + ink.w > p.wIn - m.right + INK_TOL,
        top: ink.y < m.top - INK_TOL,
        bottom: ink.y + ink.h > p.hIn - m.bottom + INK_TOL,
      };
      const edge = {
        left: ink.x <= INK_TOL,
        right: ink.x + ink.w >= p.wIn - INK_TOL,
        top: ink.y <= INK_TOL,
        bottom: ink.y + ink.h >= p.hIn - INK_TOL,
      };
      const sides = (Object.keys(into) as (keyof typeof into)[]).filter((k) => into[k]);
      if (!sides.length) return;
      if (!bleed) tight.push(i + 1);
      else if (sides.some((s) => !edge[s])) notToEdge.push(i + 1); // in the margin but not printed to the edge: likely text
    });
    if (!bleed && tight.length)
      add('margins', 'fail', 'Margins', `Something is printed inside the margins on page${tight.length > 1 ? 's' : ''} ${pageList(tight)}. Without bleed keep everything ${outside}" from the outside, top and bottom edges and ${gutter}" from the spine (the gutter for ${n} pages).`);
    else if (bleed && notToEdge.length)
      add('margins', 'warn', 'Margins', `Page${notToEdge.length > 1 ? 's' : ''} ${pageList(notToEdge)} ${notToEdge.length > 1 ? 'have' : 'has'} something inside the margins that does not run off the edge. Keep text ${outside}" from the edges and ${gutter}" from the spine; only backgrounds should reach the bleed.`);
    else add('margins', 'pass', 'Margins', `Nothing sits in the margins (${outside}" outside, top and bottom; ${gutter}" gutter for ${n} pages).`);
    const blank = f.pages.map((p, i) => (p.ink === null ? i + 1 : 0)).filter(Boolean);
    if (blank.length > Math.max(4, n * 0.25)) add('blank', 'warn', 'Blank pages', `${blank.length} blank pages (${pageList(blank)}). KDP may query books with long runs of blank pages.`);
    if (measured < n) add('sampled', 'info', 'Pages measured', `Margins and images were measured on the first ${measured} of ${n} pages.`);
  }

  // --- fonts ---
  const missing = [...new Set(f.fonts.filter((x) => !x.embedded).map((x) => x.name))];
  if (missing.length) add('fonts', 'fail', 'Fonts', `Not embedded: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` and ${missing.length - 6} more` : ''}. Export the PDF with all fonts embedded (in Word: PDF/A or "Embed fonts").`);
  else if (f.fonts.length) add('fonts', 'pass', 'Fonts', `All ${new Set(f.fonts.map((x) => x.name)).size} fonts are embedded.`);
  else add('fonts', 'info', 'Fonts', 'No text fonts in this file (image-only pages).');

  // --- images ---
  const dpis = f.pages.map((p, i) => ({ n: i + 1, d: p.minDpi })).filter((x): x is { n: number; d: number } => typeof x.d === 'number');
  if (dpis.length) {
    const low = dpis.filter((x) => x.d < DPI.failBelow);
    const soft = dpis.filter((x) => x.d >= DPI.failBelow && x.d < DPI.warnBelow);
    const worst = Math.round(Math.min(...dpis.map((x) => x.d)));
    if (low.length) add('images', 'fail', 'Image resolution', `Images on page${low.length > 1 ? 's' : ''} ${pageList(low.map((x) => x.n))} print below ${DPI.failBelow} DPI (lowest ${worst}). Use 300 DPI images.`);
    else if (soft.length) add('images', 'warn', 'Image resolution', `Images on page${soft.length > 1 ? 's' : ''} ${pageList(soft.map((x) => x.n))} are under 300 DPI (lowest ${worst}). They may print a little soft.`);
    else add('images', 'pass', 'Image resolution', `Every image is at least 300 DPI (lowest ${worst}).`);
  }

  const verdict = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return {
    checks,
    verdict,
    pageCount: n,
    bleed,
    notChecked: ['Spelling, page order and content', 'Colour mode (KDP prints colour books from RGB or CMYK)', 'Thin lines under 0.5 pt and very light greys', 'Transparency and overprint settings'],
  };
}

// --- reading the PDF ---------------------------------------------------------------------------

function deref(doc: PDFDocument, o: PDFObject | undefined): PDFObject | undefined {
  return o instanceof PDFRef ? doc.context.lookup(o) : o;
}

/** Is a font dictionary's program embedded? Type3 fonts are drawn from the PDF itself, so they count. */
function fontEmbedded(doc: PDFDocument, font: PDFDict): boolean {
  const sub = font.get(PDFName.of('Subtype'));
  if (sub === PDFName.of('Type3')) return true;
  if (sub === PDFName.of('Type0')) {
    const ds = deref(doc, font.get(PDFName.of('DescendantFonts')));
    const d = ds instanceof PDFArray ? deref(doc, ds.get(0)) : undefined;
    return d instanceof PDFDict ? fontEmbedded(doc, d) : false;
  }
  const fd = deref(doc, font.get(PDFName.of('FontDescriptor')));
  if (!(fd instanceof PDFDict)) return false;
  return ['FontFile', 'FontFile2', 'FontFile3'].some((k) => fd.has(PDFName.of(k)));
}

/** Page sizes and fonts. Throws a readable Error if the file is not a PDF. */
export async function readInteriorPdf(bytes: Uint8Array): Promise<InteriorFacts> {
  let encrypted = false;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (err) {
    if (err instanceof Error && /encrypt/i.test(err.message)) {
      encrypted = true;
      doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    } else throw new Error('That PDF could not be read. It may be damaged.');
  }
  const pages = doc.getPages().map((p) => {
    const b = p.getMediaBox();
    return { wIn: round(b.width / 72, 4), hIn: round(b.height / 72, 4) };
  });
  const fonts: InteriorFacts['fonts'] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const sub = obj.get(PDFName.of('Subtype'));
    if (sub === PDFName.of('CIDFontType0') || sub === PDFName.of('CIDFontType2')) continue; // checked through their Type0 parent
    const base = obj.get(PDFName.of('BaseFont'));
    const name = base instanceof PDFName ? base.decodeText().replace(/^[A-Z]{6}\+/, '') : 'Unnamed font';
    fonts.push({ name, embedded: fontEmbedded(doc, obj) });
  }
  return { pages, fonts, encrypted };
}
