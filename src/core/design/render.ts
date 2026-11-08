/** Draw designer primitives as SVG (preview) or into a pdf-lib page (print). Both use the same text wrapping. */

import {
  appendBezierCurve,
  clip,
  closePath,
  degrees,
  endPath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setDashPattern,
  setFillingColor,
  setLineCap,
  setLineWidth,
  setStrokingColor,
  stroke,
  LineCapStyle,
  type PDFFont,
  type PDFImage,
  type PDFOperator,
  type PDFPage,
} from 'pdf-lib';
import { pathToSvg, transformPoint, type Box, type Path } from './geometry';
import type { FontRole, Prim } from './prims';

export type Measure = (text: string, sizePt: number, font: FontRole) => number; // width in points

/** Greedy word wrap. Returns lines and the line height (inches). */
export function wrapText(text: string, box: Box, sizePt: number, font: FontRole, measure: Measure): string[] {
  const maxPt = box.w * 72;
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, sizePt, font) > maxPt) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

const LEAD = 1.2;

interface LaidLine {
  text: string;
  /** Offset of the baseline-left point from the box centre, inches (unrotated). */
  dx: number;
  dy: number;
}

function layoutText(p: Extract<Prim, { k: 'text' }>, measure: Measure): LaidLine[] {
  const lines = wrapText(p.text, p.box, p.size, p.font, measure);
  const lh = (p.size * LEAD) / 72;
  const total = lines.length * lh;
  const top = p.valign === 'top' ? -p.box.h / 2 : p.valign === 'bottom' ? p.box.h / 2 - total : -total / 2;
  return lines.map((t, i) => {
    const w = measure(t, p.size, p.font) / 72;
    const dx = p.align === 'left' ? -p.box.w / 2 : p.align === 'right' ? p.box.w / 2 - w : -w / 2;
    // Baseline sits ~80% down the line box.
    return { text: t, dx, dy: top + i * lh + lh * 0.8 };
  });
}

// --- SVG -----------------------------------------------------------------------------------------

const FONT_FAMILY: Record<FontRole, string> = { display: 'Fredoka, sans-serif', body: 'Dosis, sans-serif', accent: 'Arima, serif' };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let clipSeq = 0;

/** `scale`: SVG units per inch. `imageUrl` maps an asset id to a URL. */
export function primsToSvg(prims: Prim[], scale: number, measure: Measure, imageUrl: (id: string) => string | undefined): string {
  const S = (n: number) => Math.round(n * scale * 100) / 100;
  const one = (p: Prim): string => {
    switch (p.k) {
      case 'path': {
        const attrs = [
          `d="${pathToSvg(p.path, scale)}"`,
          `fill="${p.fill ?? 'none'}"`,
          p.stroke ? `stroke="${p.stroke}" stroke-width="${Math.max(0.3, (p.sw ?? 0.01) * scale)}"` : '',
          p.dash ? `stroke-dasharray="${S(p.dash[0])} ${S(p.dash[1])}"` : '',
          p.round || (p.dash && p.dash[0] < 0.01) ? 'stroke-linecap="round"' : '',
        ];
        return `<path ${attrs.join(' ')}/>`;
      }
      case 'clip': {
        const id = `dc${clipSeq++}`;
        return `<clipPath id="${id}"><path d="${pathToSvg(p.path, scale)}"/></clipPath><g clip-path="url(#${id})">${p.children.map(one).join('')}</g>`;
      }
      case 'text': {
        const cx = p.box.x + p.box.w / 2;
        const cy = p.box.y + p.box.h / 2;
        const size = (p.size / 72) * scale;
        const lines = layoutText(p, measure)
          .map((l) => `<text x="${S(cx + l.dx)}" y="${S(cy + l.dy)}" font-size="${size.toFixed(2)}" font-family="${FONT_FAMILY[p.font]}" fill="${p.fill}" xml:space="preserve">${esc(l.text)}</text>`)
          .join('');
        return p.rotate ? `<g transform="rotate(${p.rotate} ${S(cx)} ${S(cy)})">${lines}</g>` : lines;
      }
      case 'image': {
        const url = imageUrl(p.src);
        if (!url) return '';
        const par = p.fit === 'stretch' ? 'none' : p.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
        const cx = p.box.x + p.box.w / 2;
        const cy = p.box.y + p.box.h / 2;
        const img = `<image href="${url}" x="${S(p.box.x)}" y="${S(p.box.y)}" width="${S(p.box.w)}" height="${S(p.box.h)}" preserveAspectRatio="${par}"/>`;
        return p.rotate ? `<g transform="rotate(${p.rotate} ${S(cx)} ${S(cy)})">${img}</g>` : img;
      }
    }
  };
  return prims.map(one).join('');
}

// --- PDF -----------------------------------------------------------------------------------------

function hexColor(c: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c);
  return m ? rgb(parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255) : rgb(0, 0, 0);
}

export interface PdfDrawCtx {
  page: PDFPage;
  /** Page height in points (to flip y). */
  H: number;
  fonts: Record<FontRole, PDFFont>;
  images: Map<string, { img: PDFImage; w: number; h: number }>;
}

function pathOps(path: Path, H: number): PDFOperator[] {
  const X = (x: number) => x * 72;
  const Y = (y: number) => H - y * 72;
  const ops: PDFOperator[] = [];
  for (const s of path) {
    if (s[0] === 'M') ops.push(moveTo(X(s[1]), Y(s[2])));
    else if (s[0] === 'L') ops.push(lineTo(X(s[1]), Y(s[2])));
    else if (s[0] === 'C') ops.push(appendBezierCurve(X(s[1]), Y(s[2]), X(s[3]), Y(s[4]), X(s[5]), Y(s[6])));
    else ops.push(closePath());
  }
  return ops;
}

const safeChars = (font: PDFFont, t: string) => {
  const ok = new Set(font.getCharacterSet());
  return [...t].map((ch) => (ok.has(ch.codePointAt(0)!) ? ch : '?')).join('');
};

export function drawPrimsPdf(ctx: PdfDrawCtx, prims: Prim[]): void {
  const { page, H } = ctx;
  const measure: Measure = (t, size, f) => ctx.fonts[f].widthOfTextAtSize(safeChars(ctx.fonts[f], t), size);
  for (const p of prims) {
    switch (p.k) {
      case 'path': {
        const ops: PDFOperator[] = [pushGraphicsState()];
        if (p.fill) ops.push(setFillingColor(hexColor(p.fill)), ...pathOps(p.path, H), fill());
        if (p.stroke) {
          ops.push(setStrokingColor(hexColor(p.stroke)), setLineWidth((p.sw ?? 0.01) * 72));
          if (p.round || (p.dash && p.dash[0] < 0.01)) ops.push(setLineCap(LineCapStyle.Round));
          if (p.dash) ops.push(setDashPattern([p.dash[0] * 72, p.dash[1] * 72], 0));
          ops.push(...pathOps(p.path, H), stroke());
        }
        ops.push(popGraphicsState());
        page.pushOperators(...ops);
        break;
      }
      case 'clip':
        page.pushOperators(pushGraphicsState(), ...pathOps(p.path, H), clip(), endPath());
        drawPrimsPdf(ctx, p.children);
        page.pushOperators(popGraphicsState());
        break;
      case 'text': {
        const font = ctx.fonts[p.font];
        const cx = p.box.x + p.box.w / 2;
        const cy = p.box.y + p.box.h / 2;
        const r = p.rotate ?? 0;
        for (const l of layoutText(p, measure)) {
          const [x, y] = transformPoint({ x: cx, y: cy, w: 0, h: 0, rotate: r }, l.dx, l.dy);
          page.drawText(safeChars(font, l.text), { x: x * 72, y: H - y * 72, size: p.size, font, color: hexColor(p.fill), ...(r ? { rotate: degrees(-r) } : {}) });
        }
        break;
      }
      case 'image': {
        const e = ctx.images.get(p.src);
        if (!e) break;
        const b = p.box;
        let w = b.w;
        let h = b.h;
        if (p.fit !== 'stretch') {
          const ar = e.w / e.h;
          const contain = p.fit === 'contain';
          if (contain ? b.w / b.h > ar : b.w / b.h < ar) {
            h = b.h;
            w = h * ar;
          } else {
            w = b.w;
            h = w / ar;
          }
        }
        const r = p.rotate ?? 0;
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const t = { x: cx, y: cy, w: 0, h: 0, rotate: r };
        const needClip = p.fit === 'cover';
        if (needClip) {
          const corners = [
            [-b.w / 2, -b.h / 2],
            [b.w / 2, -b.h / 2],
            [b.w / 2, b.h / 2],
            [-b.w / 2, b.h / 2],
          ].map(([dx, dy]) => transformPoint(t, dx!, dy!));
          const path: Path = corners.map(([x, y], i) => [i ? 'L' : 'M', x, y] as ['L', number, number]);
          path.push(['Z']);
          page.pushOperators(pushGraphicsState(), ...pathOps(path, H), clip(), endPath());
        }
        // pdf-lib rotates around the image's bottom-left corner; place that corner where the rotation puts it.
        const [bx, by] = transformPoint(t, -w / 2, h / 2);
        page.drawImage(e.img, { x: bx * 72, y: H - by * 72, width: w * 72, height: h * 72, ...(r ? { rotate: degrees(-r) } : {}) });
        if (needClip) page.pushOperators(popGraphicsState());
        break;
      }
    }
  }
}
