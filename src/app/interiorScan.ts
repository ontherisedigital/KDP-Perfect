/**
 * Measure what pdf-lib cannot see in an interior PDF: where ink lands on each page (rendered small with
 * pdf.js) and the effective resolution of each placed image (from the page's drawing operations).
 */

import type { InteriorPage } from '../core';
import { getPdfjs, newCanvas } from './artwork';

const PX_PER_IN = 40; // enough to place ink to 1/40"
const MAX_PAGES = 300;

type Mat = [number, number, number, number, number, number];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Bounding box of non-white pixels, in inches (y-down), or null for a blank page. */
function inkBox(c: HTMLCanvasElement): InteriorPage['ink'] {
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i]! < 240 || data[i + 1]! < 240 || data[i + 2]! < 240) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const k = 1 / PX_PER_IN;
  return { x: x0 * k, y: y0 * k, w: (x1 - x0 + 1) * k, h: (y1 - y0 + 1) * k };
}

export async function scanInterior(bytes: Uint8Array, base: InteriorPage[], onProgress: (done: number, total: number) => void): Promise<InteriorPage[]> {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  const OPS = pdfjs.OPS;
  const out = base.map((p) => ({ ...p }));
  const total = Math.min(doc.numPages, MAX_PAGES);
  try {
    for (let n = 1; n <= total; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: PX_PER_IN / 72 });
      const canvas = newCanvas(vp.width, vp.height);
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, viewport: vp, intent: 'print' }).promise; // 'print' does not wait on animation frames, which stop in a hidden window
      out[n - 1]!.ink = inkBox(canvas);

      // Images: track the transform matrix to find each image's printed size.
      const ops = await page.getOperatorList();
      let ctm: Mat = [1, 0, 0, 1, 0, 0];
      const stack: Mat[] = [];
      let minDpi: number | null = null;
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i] as unknown[];
        if (fn === OPS.save) stack.push(ctm);
        else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
        else if (fn === OPS.transform) ctm = mul(ctm, args as unknown as Mat);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
          const wPx = fn === OPS.paintImageXObject ? (args[1] as number) : (args[0] as { width: number }).width;
          const hPx = fn === OPS.paintImageXObject ? (args[2] as number) : (args[0] as { height: number }).height;
          const wIn = Math.hypot(ctm[0], ctm[1]) / 72;
          const hIn = Math.hypot(ctm[2], ctm[3]) / 72;
          if (wIn > 0.25 && hIn > 0.25 && wPx && hPx) {
            const dpi = Math.min(wPx / wIn, hPx / hIn);
            minDpi = minDpi === null ? dpi : Math.min(minDpi, dpi);
          }
        }
      }
      out[n - 1]!.minDpi = minDpi;
      page.cleanup();
      onProgress(n, total);
    }
  } finally {
    await task.destroy();
  }
  return out;
}
