/**
 * Print-ready PDFs for low-content books: the interior (from an `InteriorPlan`) and a full-wrap cover
 * assembled from the user's front and back artwork.
 *
 * KDP requires every font in a print PDF to be embedded, so the caller passes font bytes (TTF/OTF/WOFF2) and they
 * are embedded in full. Images are embedded as given (PNG or JPEG bytes).
 */

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, clip as clipOp, degrees, endPath, grayscale, LineCapStyle, popGraphicsState, pushGraphicsState, rectangle, rgb, type PDFEmbeddedPage, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { CoverLayout, Rect } from '../cover';
import { contentBox, styleMarks, trimBox, type InteriorPlan } from '../lowcontent';
import { PT_PER_INCH } from '../units';
import { drawPrimsPdf } from '../design/render';
import type { Prim } from '../design/prims';

export interface PdfImage {
  bytes: Uint8Array;
  type: 'png' | 'jpg';
}

export interface PdfFonts {
  /** Titles. */
  display: Uint8Array;
  /** Body text (copyright, page numbers). */
  body: Uint8Array;
  /** Bold serif accents (page designer). Falls back to `display`. */
  accent?: Uint8Array;
}

/** Draws `custom` pages: returns primitives in page coordinates for page `n` (1-based), item `index`. */
export interface CustomPages {
  render(index: number, page: { n: number; origin: { x: number; y: number }; recto: boolean; trimWidth: number }): Prim[];
  /** Images the primitives reference, by id. */
  images?: Map<string, PdfImage & { widthPx: number; heightPx: number }>;
}

const P = (inches: number) => inches * PT_PER_INCH;

function safeText(font: PDFFont, text: string): string {
  const ok = new Set(font.getCharacterSet());
  return [...text].map((ch) => (ok.has(ch.codePointAt(0)!) || ch === '\n' ? ch : '?')).join('');
}

async function newDoc(title: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);
  doc.setProducer('KDP Perfect');
  doc.setCreator('KDP Perfect');
  return doc;
}

const embed = (doc: PDFDocument, img: PdfImage) => (img.type === 'png' ? doc.embedPng(img.bytes) : doc.embedJpg(img.bytes));

/** Greedy word wrap to a width in points. */
function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export async function buildInteriorPdf(plan: InteriorPlan, images: PdfImage[], fonts: PdfFonts, custom?: CustomPages): Promise<Uint8Array> {
  const l = plan.layout;
  if (!plan.valid || !l) throw new Error('The interior has problems to fix first.');
  const input = plan.input;
  const doc = await newDoc(input.front.title || 'Interior');
  const display = await doc.embedFont(fonts.display);
  const body = await doc.embedFont(fonts.body);
  const accent = fonts.accent ? await doc.embedFont(fonts.accent) : display;
  const customImages = new Map<string, { img: PDFImage; w: number; h: number }>();
  for (const [id, im] of custom?.images ?? []) customImages.set(id, { img: await embed(doc, im), w: im.widthPx, h: im.heightPx });
  const W = P(l.pageWidth);
  const H = P(l.pageHeight);
  /** Scene y (down, inches) to PDF y (up, points). */
  const Y = (y: number) => H - P(y);
  const ink = grayscale(0);

  const embedded = new Map<number, PDFImage>();
  const templates = new Map<string, PDFEmbeddedPage>();
  const imageFor = async (i: number) => {
    let e = embedded.get(i);
    if (!e) {
      const src = images[i];
      if (!src) throw new Error(`Missing image ${i + 1}.`);
      e = await embed(doc, src);
      embedded.set(i, e);
    }
    return e;
  };

  const centered = (page: PDFPage, text: string, font: PDFFont, size: number, cx: number, y: number) => {
    const t = safeText(font, text);
    page.drawText(t, { x: P(cx) - font.widthOfTextAtSize(t, size) / 2, y: Y(y), size, font, color: ink });
  };

  for (const pp of plan.pages) {
    const page = doc.addPage([W, H]);
    const box = contentBox(l, pp.n);
    const trim = trimBox(l, pp.n);
    const cx = trim.x + trim.w / 2;
    switch (pp.kind) {
      case 'blank':
        break;
      case 'image': {
        const pl = plan.placements[pp.image];
        if (!pl) break;
        const img = await imageFor(pp.image);
        // Clip to the page so art cropped to fill doesn't spill outside the media box.
        page.pushOperators(...clip(0, 0, W, H));
        page.drawImage(img, { x: P(pl.x), y: Y(pl.y + pl.h), width: P(pl.w), height: P(pl.h) });
        page.pushOperators(...restore());
        break;
      }
      case 'ruled': {
        // Every ruled page of one style and side is identical, so draw it once and reuse it (smaller, faster PDF).
        const key = `${pp.style}|${pp.n % 2}|${pp.dateLine}`;
        let tpl = templates.get(key);
        if (!tpl) {
          const src = await PDFDocument.create();
          const tp = src.addPage([W, H]);
          for (const m of styleMarks(pp.style, box, pp.dateLine)) {
            tp.drawLine({
              start: { x: P(m.x1), y: Y(m.y1) },
              end: { x: P(m.x2), y: Y(m.y2) },
              thickness: P(m.weight),
              color: grayscale(m.grey),
              ...(m.kind === 'dot' ? { lineCap: LineCapStyle.Round } : {}),
              ...(m.dash ? { dashArray: [P(m.dash[0]), P(m.dash[1])] } : {}),
            });
          }
          tpl = await doc.embedPage(tp);
          templates.set(key, tpl);
        }
        page.drawPage(tpl, { x: 0, y: 0, width: W, height: H });
        if (pp.dateLine) {
          const size = 9;
          const t = 'Date';
          page.drawText(t, { x: P(box.x + box.w - 2) - body.widthOfTextAtSize(t, size) - 6, y: Y(box.y + 0.3) + 2, size, font: body, color: grayscale(0.4) });
        }
        break;
      }
      case 'custom': {
        if (!custom) break;
        const prims = custom.render(pp.index, { n: pp.n, origin: { x: trim.x, y: trim.y }, recto: pp.n % 2 === 1, trimWidth: trim.w });
        drawPrimsPdf({ page, H, fonts: { display, body, accent }, images: customImages }, prims);
        break;
      }
      case 'belongs': {
        centered(page, 'This book belongs to', display, 22, cx, trim.y + trim.h * 0.42);
        const y = trim.y + trim.h * 0.52;
        page.drawLine({ start: { x: P(cx - 1.75), y: Y(y) }, end: { x: P(cx + 1.75), y: Y(y) }, thickness: 0.8, color: grayscale(0.3) });
        break;
      }
      case 'title': {
        const f = input.front;
        const maxW = P(box.w);
        let y = trim.y + trim.h * 0.36;
        for (const line of wrap(display, safeText(display, f.title), 30, maxW)) {
          centered(page, line, display, 30, cx, y);
          y += 0.55;
        }
        if (f.subtitle.trim()) {
          y += 0.1;
          for (const line of wrap(body, safeText(body, f.subtitle), 15, maxW)) {
            centered(page, line, body, 15, cx, y);
            y += 0.3;
          }
        }
        if (f.author.trim()) centered(page, f.author, body, 14, cx, trim.y + trim.h * 0.8);
        break;
      }
      case 'copyright': {
        const size = 8.5;
        const lines = wrap(body, safeText(body, input.front.copyright), size, P(box.w));
        const lead = size * 1.45;
        let y = P(box.y + box.h) - lines.length * lead; // bottom of the safe area, measured in points from the top
        for (const line of lines) {
          y += lead;
          page.drawText(line, { x: P(box.x), y: H - y, size, font: body, color: ink });
        }
        break;
      }
    }
    if (input.pageNumbers && pp.kind === 'ruled') {
      const t = String(pp.n);
      const size = 8;
      const w = body.widthOfTextAtSize(t, size);
      const y = box.y + box.h + Math.min(0.18, l.margins.bottom / 2);
      // Outside corner: right on right-hand pages, left on left-hand pages.
      const x = pp.n % 2 === 1 ? P(box.x + box.w) - w : P(box.x);
      page.drawText(t, { x, y: Y(y), size, font: body, color: grayscale(0.35) });
    }
  }
  return doc.save();
}

// --- Cover from front and back art ---------------------------------------------------------

export interface CoverArtOptions {
  front: PdfImage & { widthPx: number; heightPx: number };
  back: (PdfImage & { widthPx: number; heightPx: number }) | null;
  /** Spine and (when no back image) back-cover colour, `#rrggbb`. */
  spineColor: string;
  backColor: string;
  spineText: string;
  spineTextColor: string;
  title: string;
}

/** The part of the canvas each artwork must cover: its panel plus the bleed/wrap on its outer sides. */
export function artRegions(l: CoverLayout): { front: Rect; back: Rect; spine: Rect } {
  const s = l.spine;
  const left: Rect = { x: 0, y: 0, w: s.x, h: l.canvas.h };
  const right: Rect = { x: s.x + s.w, y: 0, w: l.canvas.w - s.x - s.w, h: l.canvas.h };
  const frontOnRight = l.front.x > s.x;
  return { front: frontOnRight ? right : left, back: frontOnRight ? left : right, spine: { x: s.x, y: 0, w: s.w, h: l.canvas.h } };
}

function hex(c: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  if (!m) return rgb(1, 1, 1);
  return rgb(parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255);
}

/** Scale to fill `r` (cropping the overflow), centered. */
function fill(img: { widthPx: number; heightPx: number }, r: Rect): Rect {
  const ar = img.widthPx / img.heightPx;
  let w = r.w;
  let h = w / ar;
  if (h < r.h) {
    h = r.h;
    w = h * ar;
  }
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}

/** Effective DPI and crop when `img` fills `r`. */
export function artFit(img: { widthPx: number; heightPx: number }, r: Rect): { dpi: number; cropped: number } {
  const f = fill(img, r);
  return { dpi: Math.round(img.widthPx / f.w), cropped: Math.round((1 - (r.w * r.h) / (f.w * f.h)) * 100) / 100 };
}

export async function buildCoverArtPdf(l: CoverLayout, o: CoverArtOptions, fonts: PdfFonts): Promise<Uint8Array> {
  if (!l.valid) throw new Error('The cover has problems to fix first.');
  const doc = await newDoc(o.title || 'Cover');
  const W = P(l.canvas.w);
  const H = P(l.canvas.h);
  const page = doc.addPage([W, H]);
  const Y = (y: number) => H - P(y);
  const reg = artRegions(l);

  const draw = async (img: CoverArtOptions['front'], r: Rect) => {
    const e = await embed(doc, img);
    const f = fill(img, r);
    // Clip each artwork to its region so overflow doesn't cover the spine or the other panel.
    page.pushOperators(...clip(P(r.x), Y(r.y + r.h), P(r.w), P(r.h)));
    page.drawImage(e, { x: P(f.x), y: Y(f.y + f.h), width: P(f.w), height: P(f.h) });
    page.pushOperators(...restore());
  };

  page.drawRectangle({ x: P(reg.back.x), y: Y(reg.back.y + reg.back.h), width: P(reg.back.w), height: P(reg.back.h), color: hex(o.backColor) });
  page.drawRectangle({ x: P(reg.spine.x), y: 0, width: P(reg.spine.w), height: H, color: hex(o.spineColor) });
  await draw(o.front, reg.front);
  if (o.back) await draw(o.back, reg.back);

  const zone = l.safe.spineText;
  if (o.spineText.trim() && zone && l.spineTextAllowed) {
    const font = await doc.embedFont(fonts.display);
    const text = safeText(font, o.spineText.trim());
    let size = Math.min(P(zone.w) * 0.7, 24);
    const maxLen = P(zone.h);
    while (size > 4 && font.widthOfTextAtSize(text, size) > maxLen) size -= 0.5;
    const tw = font.widthOfTextAtSize(text, size);
    const cx = P(zone.x + zone.w / 2);
    const cy = Y(zone.y + zone.h / 2);
    // Top-to-bottom spine text (US convention): rotate -90 degrees around the zone centre.
    const asc = font.heightAtSize(size, { descender: false });
    page.drawText(text, { x: cx + asc / 2 - size * 0.12, y: cy + tw / 2, size, font, color: hex(o.spineTextColor), rotate: degrees(-90) });
  }
  return doc.save();
}

function clip(x: number, y: number, w: number, h: number) {
  return [pushGraphicsState(), rectangle(x, y, w, h), clipOp(), endPath()];
}
function restore() {
  return [popGraphicsState()];
}
