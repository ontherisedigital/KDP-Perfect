import {
  buildCoverScene,
  drawScene,
  formatSize,
  getPaper,
  getTrimSize,
  pageLimits,
  readInteriorPdf,
  runInteriorPreflight,
  runPreflight,
  type Check,
  type CoverLayout,
  type InteriorFacts,
  type InteriorResult,
  type PreflightResult,
} from '../../core';
import { scanInterior } from '../interiorScan';
import { loadArtwork, newCanvas, type Artwork } from '../artwork';
import type { Ctx, Screen } from '../context';
import { $, bindFileInput, esc, segment, times, toast } from '../dom';
import { copyText } from '../files';

type Overlay = 'on' | 'off';

const ICON: Record<Check['status'], { glyph: string; label: string }> = {
  pass: { glyph: '✓', label: 'Pass' },
  warn: { glyph: '!', label: 'Warning' },
  fail: { glyph: '✕', label: 'Fail' },
  info: { glyph: 'i', label: 'Note' },
};

const VERDICT = {
  pass: 'Looks good. This cover matches the book you described.',
  warn: 'Mostly fine, but check the warnings before you upload.',
  fail: 'Needs fixing before you upload.',
} as const;

export function initPreflightScreen(ctx: Ctx & { setPages(n: number): void }): Screen {
  let art: Artwork | null = null;
  let overlay: Overlay = 'on';
  let loadError = '';

  const el = {
    expected: $('pf-expected'),
    book: $('pf-book'),
    drop: $('pf-drop'),
    file: $<HTMLInputElement>('pf-file'),
    result: $('pf-result'),
    verdict: $('pf-verdict'),
    checks: $('pf-checks'),
    notChecked: $('pf-notchecked'),
    copy: $<HTMLButtonElement>('pf-copy'),
    fileName: $('pf-file-name'),
    overlayToggle: $('pf-overlay-toggle'),
    preview: $('pf-preview'),
    caption: $('pf-caption'),
    empty: $('pf-empty'),
  };

  const overlaySeg = segment<Overlay>(
    el.overlayToggle,
    [
      { value: 'on', label: 'Guides on' },
      { value: 'off', label: 'Guides off' },
    ],
    () => overlay,
    (v) => {
      overlay = v;
      refresh();
    },
  );

  bindFileInput(el.file, el.drop, async (file) => {
    el.drop.classList.add('busy');
    loadError = '';
    try {
      art = await loadArtwork(file);
    } catch (err) {
      art = null;
      loadError = err instanceof Error ? err.message : String(err);
      toast(loadError);
    } finally {
      el.drop.classList.remove('busy');
    }
    refresh();
  });

  let last: PreflightResult | null = null;

  function reportText(layout: CoverLayout, r: PreflightResult): string {
    const lines = [
      'KDP PREFLIGHT REPORT',
      `File: ${art?.name ?? ''}`,
      `Checked against: ${layout.binding}, ${formatSize(layout.input.trimWidth, layout.input.trimHeight, 'in')}, ${layout.input.pageCount} pages, ${getPaper(layout.input.paper).label.toLowerCase()}`,
      `Expected size: ${formatSize(layout.canvas.w, layout.canvas.h, 'in')}`,
      '',
      `Result: ${VERDICT[r.verdict]}`,
      '',
    ];
    for (const c of r.checks) lines.push(`[${ICON[c.status].label.toUpperCase()}] ${c.title}: ${c.detail}`);
    lines.push('', 'Not checked:');
    for (const n of r.notChecked) lines.push(`  - ${n}`);
    return lines.join('\n') + '\n';
  }

  function drawPreview(layout: CoverLayout): void {
    if (!art) return;
    const width = Math.min(1600, Math.max(600, Math.round(el.preview.clientWidth * (window.devicePixelRatio || 1)) || 1200));
    const height = Math.round((width * layout.canvas.h) / layout.canvas.w);
    const canvas = newCanvas(width, height);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.display = 'block';
    const ctx2 = canvas.getContext('2d')!;
    ctx2.fillStyle = '#ffffff';
    ctx2.fillRect(0, 0, width, height);
    ctx2.imageSmoothingQuality = 'high';
    ctx2.drawImage(art.canvas, 0, 0, width, height);
    if (overlay === 'on') drawScene(ctx2, buildCoverScene(layout, { mode: 'overlay', dpi: 300 }), width / layout.canvas.w);
    el.preview.replaceChildren(canvas);
  }

  function refresh(): void {
    const layout = ctx.layout();
    overlaySeg.sync();
    if (layout) {
      el.expected.textContent = times(formatSize(layout.canvas.w, layout.canvas.h, 'in'));
      el.book.textContent = `${layout.binding === 'hardcover' ? 'Hardcover' : 'Paperback'} · ${times(formatSize(layout.input.trimWidth, layout.input.trimHeight, 'in'))} · ${layout.input.pageCount} pages · ${getPaper(layout.input.paper).label.toLowerCase()}`;
    } else {
      el.expected.textContent = '–';
      el.book.textContent = '';
    }

    const show = !!layout && !!art;
    el.result.hidden = !show;
    el.drop.hidden = !layout;
    el.empty.hidden = !!layout;
    if (loadError && layout) {
      el.empty.hidden = false;
      el.empty.textContent = loadError;
    } else {
      el.empty.textContent = 'Enter your book details on the left, then choose your cover file.';
    }
    if (!show || !layout || !art) return;

    const r = runPreflight(layout, art.facts);
    last = r;
    el.verdict.className = `verdict ${r.verdict}`;
    el.verdict.textContent = VERDICT[r.verdict];
    el.checks.innerHTML = r.checks
      .map(
        (c) =>
          `<li class="check-row ${c.status}"><span class="ck" role="img" aria-label="${ICON[c.status].label}">${ICON[c.status].glyph}</span><div><strong>${esc(c.title)}</strong><span>${esc(times(c.detail))}</span></div></li>`,
      )
      .join('');
    el.notChecked.innerHTML = r.notChecked.map((n) => `<li>${esc(n)}</li>`).join('');
    el.fileName.textContent = art.name;
    el.caption.textContent =
      art.kind === 'pdf' && art.facts.pdf && Math.abs(art.facts.pdf.widthIn - layout.canvas.w) > 0.05
        ? 'Your artwork is stretched to the expected cover size here, so its guides may look off because the file is a different size.'
        : 'Your artwork with the KDP guides on top. Keep text and key art inside the green areas.';
    drawPreview(layout);
  }

  el.copy.addEventListener('click', async () => {
    const layout = ctx.layout();
    if (!layout || !last) return;
    toast((await copyText(reportText(layout, last))) ? 'Report copied' : 'Could not copy to the clipboard');
  });

  // ---- interior mode ----------------------------------------------------------------------

  let mode: 'cover' | 'interior' = 'cover';
  let interior: { name: string; facts: InteriorFacts; result: InteriorResult } | null = null;
  const ie = {
    cover: $('pf-cover-mode'),
    wrap: $('pf-interior-mode'),
    expected: $('pfi-expected'),
    book: $('pfi-book'),
    drop: $('pfi-drop'),
    file: $<HTMLInputElement>('pfi-file'),
    progress: $('pfi-progress'),
    result: $('pfi-result'),
    verdict: $('pfi-verdict'),
    checks: $('pfi-checks'),
    notChecked: $('pfi-notchecked'),
    usePages: $<HTMLButtonElement>('pfi-use-pages'),
    copy: $<HTMLButtonElement>('pfi-copy'),
    empty: $('pfi-empty'),
  };
  const INTERIOR_VERDICT = {
    pass: 'Looks good. This interior matches the book you described.',
    warn: 'Mostly fine, but check the warnings before you upload.',
    fail: 'Needs fixing before you upload.',
  } as const;

  const modeSeg = segment<'cover' | 'interior'>(
    $('pf-mode'),
    [
      { value: 'cover', label: 'Cover' },
      { value: 'interior', label: 'Interior' },
    ],
    () => mode,
    (v) => {
      mode = v;
      refreshAll();
    },
  );

  /** The book on the left, as the interior check needs it. Works before a page count is entered. */
  function interiorBook() {
    const st = ctx.state;
    const custom = st.trimId === 'custom' && st.binding === 'paperback';
    const preset = custom ? undefined : getTrimSize(st.trimId, st.binding);
    const w = preset ? preset.width : st.customWidth;
    const h = preset ? preset.height : st.customHeight;
    if (!(w > 0 && h > 0)) return null;
    const lim = pageLimits(st.binding, preset, getPaper(st.paper));
    return { trimWidth: w, trimHeight: h, binding: st.binding, limits: { min: lim.min, max: lim.max }, coverPages: st.pages };
  }

  bindFileInput(ie.file, ie.drop, async (file) => {
    const book = interiorBook();
    if (!book) return;
    ie.drop.classList.add('busy');
    ie.progress.hidden = false;
    ie.progress.textContent = 'Reading the PDF…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const facts = await readInteriorPdf(bytes);
      facts.pages = await scanInterior(bytes, facts.pages, (d, t) => (ie.progress.textContent = `Checking page ${d} of ${t}…`));
      interior = { name: file.name, facts, result: runInteriorPreflight(book, facts) };
    } catch (err) {
      interior = null;
      toast(err instanceof Error ? err.message : String(err));
    } finally {
      ie.drop.classList.remove('busy');
      ie.progress.hidden = true;
    }
    refreshInterior();
  });

  function refreshInterior(): void {
    const book = interiorBook();
    ie.empty.hidden = !!book;
    ie.drop.hidden = !book;
    if (book) {
      const L = ctx.state.binding === 'hardcover' ? 'Hardcover' : 'Paperback';
      ie.expected.textContent = times(`${formatSize(book.trimWidth, book.trimHeight, 'in')} pages`);
      ie.book.textContent = times(`${L} · or ${formatSize(book.trimWidth + 0.125, book.trimHeight + 0.25, 'in')} with bleed · ${book.limits.min} to ${book.limits.max ?? '–'} pages`);
    }
    ie.result.hidden = !interior;
    if (!interior) return;
    if (book) interior.result = runInteriorPreflight(book, interior.facts); // the book on the left may have changed
    const r = interior.result;
    ie.verdict.className = `verdict ${r.verdict}`;
    ie.verdict.textContent = `${interior.name}: ${INTERIOR_VERDICT[r.verdict]}`;
    ie.checks.innerHTML = r.checks
      .map(
        (c) =>
          `<li class="check-row ${c.status}"><span class="ck" role="img" aria-label="${ICON[c.status].label}">${ICON[c.status].glyph}</span><div><strong>${esc(c.title)}</strong><span>${esc(times(c.detail))}</span></div></li>`,
      )
      .join('');
    ie.notChecked.innerHTML = r.notChecked.map((n) => `<li>${esc(n)}</li>`).join('');
    const mismatch = ctx.state.pages !== r.pageCount;
    ie.usePages.hidden = !mismatch;
    ie.usePages.textContent = `Set the book to ${r.pageCount} pages`;
  }

  ie.usePages.addEventListener('click', () => {
    if (!interior) return;
    ctx.setPages(interior.result.pageCount);
    toast(`Book set to ${interior.result.pageCount} pages. The cover template now uses this page count.`);
  });
  ie.copy.addEventListener('click', async () => {
    if (!interior) return;
    const r = interior.result;
    const lines = ['KDP INTERIOR PREFLIGHT REPORT', `File: ${interior.name}`, '', `Result: ${INTERIOR_VERDICT[r.verdict]}`, ''];
    for (const c of r.checks) lines.push(`[${ICON[c.status].label.toUpperCase()}] ${c.title}: ${c.detail}`);
    lines.push('', 'Not checked:', ...r.notChecked.map((n) => `  - ${n}`));
    toast((await copyText(lines.join('\n') + '\n')) ? 'Report copied' : 'Could not copy to the clipboard');
  });

  function refreshAll(): void {
    modeSeg.sync();
    ie.cover.hidden = mode !== 'cover';
    ie.wrap.hidden = mode !== 'interior';
    if (mode === 'cover') refresh();
    else refreshInterior();
  }

  return { id: 'preflight', refresh: refreshAll, activate: () => (mode === 'interior' || art) && refreshAll() };
}
