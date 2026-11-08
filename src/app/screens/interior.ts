import {
  BLEED_ADVICE,
  COVER_SAFE_MARGIN,
  CUSTOM_TRIM_ID,
  MIN_IMAGE_DPI,
  PAGE_STYLES,
  POOR_IMAGE_DPI,
  artFit,
  artRegions,
  buildCoverArtPdf,
  buildInteriorPdf,
  computeCoverLayout,
  contentBox,
  formatSize,
  getPaper,
  getTrimSize,
  interiorFileName,
  pageLimits,
  planInterior,
  styleMarks,
  toPixels,
  trimBox,
  type CoverLayout,
  type InteriorPlan,
  type LowContentKind,
  type PageStyle,
  type PdfFonts,
  type PdfImage,
  type PlannedPage,
  type Rect,
  type Sided,
} from '../../core';
import type { Ctx, Screen } from '../context';
import { $, bindFileInput, esc, segment, times, toast } from '../dom';
import { saveFile } from '../files';
import { design } from '../designStore';
import { puzzles } from '../puzzleStore';
import { expandSequence, primsToSvg, renderPage, type ExpandedPage } from '../../core';
import { measureText } from '../media';
import { loadFonts, readImage, type PageImage } from '../media';

const pxAt300 = (w: number, h: number) => times(`${toPixels(w, 300)} x ${toPixels(h, 300)} px`);
const n2 = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function initInteriorScreen(ctx: Ctx & { setPages(n: number): void; show(id: 'designer' | 'puzzles'): void }): Screen {
  const s = ctx.state.interior;
  let images: PageImage[] = [];
  let spread = 0;
  let front: PageImage | null = null;
  let back: PageImage | null = null;
  let busy = false;

  const el = {
    primary: $('in-primary'),
    alt: $('in-alt'),
    kindHint: $('in-kind-hint'),
    sidedHint: $('in-sided-hint'),
    bleedHint: $('in-bleed-hint'),
    coloring: $('in-coloring'),
    journal: $('in-journal'),
    files: $<HTMLInputElement>('in-files'),
    drop: $('in-drop'),
    sizeHint: $('in-size-hint'),
    list: $('in-list'),
    listActions: $('in-list-actions'),
    sort: $<HTMLButtonElement>('in-sort'),
    clear: $<HTMLButtonElement>('in-clear'),
    style: $<HTMLSelectElement>('in-style'),
    styleHint: $('in-style-hint'),
    count: $<HTMLInputElement>('in-count'),
    date: $<HTMLInputElement>('in-date'),
    numbers: $<HTMLInputElement>('in-numbers'),
    belongs: $<HTMLInputElement>('in-belongs'),
    title: $<HTMLInputElement>('in-title'),
    subtitle: $<HTMLInputElement>('in-subtitle'),
    author: $<HTMLInputElement>('in-author'),
    copyright: $<HTMLTextAreaElement>('in-copyright'),
    copyrightFill: $<HTMLButtonElement>('in-copyright-fill'),
    messages: $('in-messages'),
    previewWrap: $('in-preview-wrap'),
    preview: $('in-preview'),
    prev: $<HTMLButtonElement>('in-prev'),
    next: $<HTMLButtonElement>('in-next'),
    spreadLabel: $('in-spread-label'),
    download: $<HTMLButtonElement>('in-download'),
    downloadHint: $('in-download-hint'),
    usePages: $<HTMLButtonElement>('in-use-pages'),
    coverLead: $('in-cover-lead'),
    coverSizes: $('in-cover-sizes').querySelector('tbody')!,
    frontFile: $<HTMLInputElement>('in-front-file'),
    backFile: $<HTMLInputElement>('in-back-file'),
    artStatus: $('in-art-status'),
    spineColor: $<HTMLInputElement>('in-spine-color'),
    spineTextColor: $<HTMLInputElement>('in-spine-text-color'),
    backColor: $<HTMLInputElement>('in-back-color'),
    backColorField: $('in-back-color-field'),
    spineText: $<HTMLInputElement>('in-spine-text'),
    spineHint: $('in-spine-hint'),
    coverMessages: $('in-cover-messages'),
    coverPreview: $('in-cover-preview'),
    coverDownload: $<HTMLButtonElement>('in-cover-download'),
    designedCard: $('in-designed'),
    designedCount: $('in-designed-count'),
    openDesigner: $<HTMLButtonElement>('in-open-designer'),
  };
  el.openDesigner.addEventListener('click', () => ctx.show(s.kind === 'puzzles' ? 'puzzles' : 'designer'));
  design.onChange(() => refresh());
  puzzles.onChange(() => refresh());

  const change = () => {
    ctx.save();
    refresh();
  };

  const kindSeg = segment<LowContentKind | 'designed' | 'puzzles'>(
    $('in-kind'),
    [
      { value: 'coloring', label: 'Coloring / activity book' },
      { value: 'journal', label: 'Simple journal / notebook' },
      { value: 'designed', label: 'My designed pages' },
      { value: 'puzzles', label: 'Puzzle book' },
    ],
    () => s.kind,
    (v) => {
      s.kind = v;
      spread = 0;
      change();
    },
  );
  const sidedSeg = segment<Sided>(
    $('in-sided'),
    [
      { value: 'single', label: 'Front only' },
      { value: 'double', label: 'Front and back' },
    ],
    () => s.sided,
    (v) => {
      s.sided = v;
      change();
    },
  );
  const bleedSeg = segment<'no' | 'yes'>(
    $('in-bleed'),
    [
      { value: 'no', label: 'No bleed' },
      { value: 'yes', label: 'Bleed' },
    ],
    () => (s.bleed ? 'yes' : 'no'),
    (v) => {
      s.bleed = v === 'yes';
      change();
    },
  );

  el.style.innerHTML = PAGE_STYLES.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join('');
  el.style.value = s.style;
  el.count.value = String(s.count);
  el.date.checked = s.dateLine;
  el.numbers.checked = s.pageNumbers;
  el.belongs.checked = s.belongsTo;
  el.title.value = s.title;
  el.subtitle.value = s.subtitle;
  el.author.value = s.author;
  el.copyright.value = s.copyright;
  el.spineText.value = s.spineText;
  el.spineColor.value = s.spineColor;
  el.spineTextColor.value = s.spineTextColor;
  el.backColor.value = s.backColor;

  el.style.addEventListener('change', () => {
    s.style = el.style.value as PageStyle;
    change();
  });
  el.count.addEventListener('input', () => {
    const v = el.count.valueAsNumber;
    s.count = Number.isFinite(v) ? Math.max(0, Math.min(828, Math.round(v))) : 0;
    change();
  });
  const bindCheck = (input: HTMLInputElement, key: 'dateLine' | 'pageNumbers' | 'belongsTo') =>
    input.addEventListener('change', () => {
      s[key] = input.checked;
      change();
    });
  bindCheck(el.date, 'dateLine');
  bindCheck(el.numbers, 'pageNumbers');
  bindCheck(el.belongs, 'belongsTo');
  const bindText = (input: HTMLInputElement | HTMLTextAreaElement, key: 'title' | 'subtitle' | 'author' | 'copyright' | 'spineText') =>
    input.addEventListener('input', () => {
      s[key] = input.value;
      change();
    });
  bindText(el.title, 'title');
  bindText(el.subtitle, 'subtitle');
  bindText(el.author, 'author');
  bindText(el.copyright, 'copyright');
  bindText(el.spineText, 'spineText');
  const bindColor = (input: HTMLInputElement, key: 'spineColor' | 'spineTextColor' | 'backColor') =>
    input.addEventListener('input', () => {
      s[key] = input.value;
      change();
    });
  bindColor(el.spineColor, 'spineColor');
  bindColor(el.spineTextColor, 'spineTextColor');
  bindColor(el.backColor, 'backColor');

  el.copyrightFill.addEventListener('click', () => {
    const who = s.author.trim() || '[Your name]';
    s.copyright = `Copyright © ${new Date().getFullYear()} ${who}. All rights reserved.\n\nNo part of this book may be reproduced, stored or shared in any form without written permission from the publisher, except for personal use of the pages for coloring or writing.`;
    el.copyright.value = s.copyright;
    change();
  });

  // --- Page images -------------------------------------------------------------------------
  const addFiles = async (files: File[]) => {
    const list = files.filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name));
    if (!list.length) return;
    el.drop.classList.add('busy');
    let failed = 0;
    const added: PageImage[] = [];
    for (const f of list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      try {
        added.push(await readImage(f));
      } catch {
        failed++;
      }
    }
    images = images.concat(added);
    el.drop.classList.remove('busy');
    if (failed) toast(`${failed} ${failed === 1 ? 'file' : 'files'} could not be read as an image.`);
    refresh();
  };
  el.files.addEventListener('change', () => {
    void addFiles(Array.from(el.files.files ?? []));
    el.files.value = '';
  });
  for (const t of ['dragenter', 'dragover']) el.drop.addEventListener(t, (e) => (e.preventDefault(), el.drop.classList.add('over')));
  el.drop.addEventListener('dragleave', () => el.drop.classList.remove('over'));
  el.drop.addEventListener('drop', (e) => {
    e.preventDefault();
    el.drop.classList.remove('over');
    void addFiles(Array.from((e as DragEvent).dataTransfer?.files ?? []));
  });
  el.list.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-act]');
    if (!b) return;
    const i = images.findIndex((x) => x.id === Number(b.dataset.id));
    if (i < 0) return;
    const act = b.dataset.act;
    if (act === 'remove') {
      URL.revokeObjectURL(images[i]!.url);
      images.splice(i, 1);
    } else {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= images.length) return;
      [images[i], images[j]] = [images[j]!, images[i]!];
    }
    refresh();
  });
  el.sort.addEventListener('click', () => {
    images.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    refresh();
  });
  el.clear.addEventListener('click', () => {
    for (const i of images) URL.revokeObjectURL(i.url);
    images = [];
    spread = 0;
    refresh();
  });

  // --- Cover art ---------------------------------------------------------------------------
  const pickArt = (input: HTMLInputElement, set: (img: PageImage) => void) =>
    bindFileInput(input, null, async (f) => {
      try {
        set(await readImage(f));
        refresh();
      } catch {
        toast('That file could not be read as an image.');
      }
    });
  pickArt(el.frontFile, (img) => {
    if (front) URL.revokeObjectURL(front.url);
    front = img;
  });
  pickArt(el.backFile, (img) => {
    if (back) URL.revokeObjectURL(back.url);
    back = img;
  });
  el.artStatus.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-clear]');
    if (!b) return;
    if (b.dataset.clear === 'front' && front) (URL.revokeObjectURL(front.url), (front = null));
    if (b.dataset.clear === 'back' && back) (URL.revokeObjectURL(back.url), (back = null));
    refresh();
  });

  // --- Model -------------------------------------------------------------------------------
  function trim() {
    const st = ctx.state;
    const custom = st.binding === 'paperback' && st.trimId === CUSTOM_TRIM_ID;
    const preset = custom ? undefined : getTrimSize(st.trimId, st.binding);
    return { w: preset ? preset.width : st.customWidth, h: preset ? preset.height : st.customHeight, preset };
  }

  function plan(): InteriorPlan {
    const st = ctx.state;
    const t = trim();
    return planInterior({
      trimWidth: t.w,
      trimHeight: t.h,
      bleed: s.bleed,
      sided: s.sided,
      front: { title: s.title, subtitle: s.subtitle, author: s.author, belongsTo: s.belongsTo, copyright: s.copyright },
      content:
        s.kind === 'coloring'
          ? { kind: 'coloring', images }
          : s.kind === 'designed'
            ? { kind: 'custom', count: designed().length, noun: 'designed pages' }
            : s.kind === 'puzzles'
              ? { kind: 'custom', count: puzzles.pageCount(), noun: 'puzzles' }
            : { kind: 'journal', style: s.style, count: s.count, dateLine: s.dateLine },
      pageNumbers: s.pageNumbers,
      limits: pageLimits(st.binding, t.preset, getPaper(st.paper)),
    });
  }

  /** The Page designer's pages, in book order. */
  function designed(): ExpandedPage[] {
    return expandSequence(design.doc);
  }

  /** Primitives for designed (or puzzle) page `index`, placed on output page `n`. */
  function designedPrims(index: number, n: number, origin: { x: number; y: number }, trimW: number) {
    if (s.kind === 'puzzles') {
      const l = plan().layout;
      if (!l) return [];
      return puzzles.pagePrims(index, contentBox(l, n));
    }
    const e = designed()[index];
    const pd = e && design.doc.pages.find((p) => p.id === e.pageId);
    if (!e || !pd) return [];
    return renderPage(pd, { date: e.date, pageNumber: n }, origin, pd.mirror && n % 2 === 0 ? trimW : undefined);
  }

  function cover(p: InteriorPlan): CoverLayout | null {
    if (p.pageCount < 1) return null;
    const st = ctx.state;
    const t = trim();
    return computeCoverLayout({
      binding: st.binding,
      trimWidth: t.w,
      trimHeight: t.h,
      pageCount: p.pageCount,
      paper: st.paper,
      readingDirection: st.direction,
      safeMargin: COVER_SAFE_MARGIN,
      trimId: t.preset?.id,
    });
  }

  // --- Rendering ---------------------------------------------------------------------------
  const PX = 60; // preview pixels per inch (SVG user units)

  function pageSvg(p: InteriorPlan, page: PlannedPage | undefined, dx: number, grey: boolean): string {
    const l = p.layout!;
    const W = l.pageWidth * PX;
    const H = l.pageHeight * PX;
    if (!page) return '';
    const box = contentBox(l, page.n);
    const tb = trimBox(l, page.n);
    const r = (b: Rect) => `x="${b.x * PX}" y="${b.y * PX}" width="${b.w * PX}" height="${b.h * PX}"`;
    const cx = (tb.x + tb.w / 2) * PX;
    const txt = (t: string, y: number, size: number, extra = '') =>
      `<text x="${cx}" y="${y * PX}" font-size="${size}" text-anchor="middle" font-family="Fredoka, sans-serif" fill="#111" ${extra}>${esc(t)}</text>`;
    let body = '';
    switch (page.kind) {
      case 'image': {
        const img = images[page.image];
        if (img) {
          const target = l.bleed ? { x: 0, y: 0, w: l.pageWidth, h: l.pageHeight } : box;
          body = `<image href="${img.url}" ${r(target)} preserveAspectRatio="xMidYMid ${l.bleed ? 'slice' : 'meet'}" ${grey ? 'filter="url(#in-grey)"' : ''}/>`;
        }
        break;
      }
      case 'ruled':
        body = styleMarks(page.style, box, page.dateLine)
          .map((m) =>
            m.kind === 'dot'
              ? `<circle cx="${m.x1 * PX}" cy="${m.y1 * PX}" r="${Math.max(0.6, (m.weight * PX) / 2)}" fill="rgb(${m.grey * 255},${m.grey * 255},${m.grey * 255})"/>`
              : `<line x1="${m.x1 * PX}" y1="${m.y1 * PX}" x2="${m.x2 * PX}" y2="${m.y2 * PX}" stroke="rgb(${m.grey * 255},${m.grey * 255},${m.grey * 255})" stroke-width="${Math.max(0.5, m.weight * PX)}" ${m.dash ? `stroke-dasharray="${m.dash[0] * PX} ${m.dash[1] * PX}"` : ''}/>`,
          )
          .join('');
        if (page.dateLine) body += `<text x="${(box.x + box.w - 2) * PX - 6}" y="${(box.y + 0.3) * PX - 2}" font-size="9" text-anchor="end" fill="#666">Date</text>`;
        if (s.pageNumbers) {
          const y = (box.y + box.h + Math.min(0.18, l.margins.bottom / 2)) * PX;
          body += `<text x="${(page.n % 2 ? box.x + box.w : box.x) * PX}" y="${y}" font-size="8" text-anchor="${page.n % 2 ? 'end' : 'start'}" fill="#555">${page.n}</text>`;
        }
        break;
      case 'belongs':
        body = txt('This book belongs to', tb.y + tb.h * 0.42, 22) + `<line x1="${cx - 1.75 * PX}" x2="${cx + 1.75 * PX}" y1="${(tb.y + tb.h * 0.52) * PX}" y2="${(tb.y + tb.h * 0.52) * PX}" stroke="#444" stroke-width="1"/>`;
        break;
      case 'title':
        body =
          txt(s.title, tb.y + tb.h * 0.36, 30, `textLength="${Math.min(box.w * PX, s.title.length * 16)}" lengthAdjust="spacingAndGlyphs"`) +
          (s.subtitle ? txt(s.subtitle, tb.y + tb.h * 0.36 + 0.65, 15) : '') +
          (s.author ? txt(s.author, tb.y + tb.h * 0.8, 14) : '');
        break;
      case 'copyright': {
        const lines = s.copyright.split(/\n/).slice(0, 12);
        body = lines.map((t, i) => `<text x="${box.x * PX}" y="${(box.y + box.h) * PX - (lines.length - 1 - i) * 12}" font-size="8" fill="#222">${esc(t.slice(0, 90))}${t.length > 90 ? '…' : ''}</text>`).join('');
        break;
      }
      case 'custom':
        body = primsToSvg(designedPrims(page.index, page.n, { x: tb.x, y: tb.y }, tb.w), PX, measureText, design.url);
        if (grey) body = `<g filter="url(#in-grey)">${body}</g>`;
        break;
      case 'blank':
        body = `<text x="${cx}" y="${(tb.y + tb.h / 2) * PX}" font-size="11" text-anchor="middle" fill="#bbb">blank</text>`;
        break;
    }
    const clipId = `in-clip-${page.n}`;
    return `<g transform="translate(${dx} 0)">
      <defs><clipPath id="${clipId}"><rect width="${W}" height="${H}"/></clipPath></defs>
      <rect width="${W}" height="${H}" fill="#fff"/>
      <g clip-path="url(#${clipId})">${body}</g>
      <rect ${r(box)} fill="none" stroke="#3b82f6" stroke-width="1" stroke-opacity=".7"/>
      ${l.bleed ? `<rect ${r(tb)} fill="none" stroke="#e11d48" stroke-width="1" stroke-dasharray="5 4"/>` : ''}
      <text x="${(page.n % 2 ? W - 6 : 6)}" y="${H - 6}" font-size="10" text-anchor="${page.n % 2 ? 'end' : 'start'}" fill="#9ca3af">p. ${page.n}</text>
    </g>`;
  }

  function renderPreview(p: InteriorPlan): void {
    const l = p.layout;
    el.previewWrap.hidden = !l || p.pageCount === 0;
    if (!l) return;
    const spreads = Math.floor(p.pageCount / 2) + 1; // page 1 alone, then pairs, then the last page alone
    spread = Math.max(0, Math.min(spread, spreads - 1));
    const left = spread === 0 ? undefined : p.pages[spread * 2 - 1];
    const right = p.pages[spread * 2];
    const W = l.pageWidth * PX;
    const H = l.pageHeight * PX;
    const grey = ctx.state.paper.startsWith('bw');
    el.preview.innerHTML = `<svg viewBox="0 0 ${W * 2 + 8} ${H}" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="in-grey"><feColorMatrix type="saturate" values="0"/></filter></defs>
      ${pageSvg(p, left, 0, grey)}${pageSvg(p, right, W + 8, grey)}</svg>`;
    el.preview.style.setProperty('--ar', String((W * 2 + 8) / H));
    const nums = [left?.n, right?.n].filter(Boolean).join(' and ');
    el.spreadLabel.textContent = `Page${left && right ? 's' : ''} ${nums} of ${p.pageCount}`;
    el.prev.disabled = spread === 0;
    el.next.disabled = spread >= spreads - 1;
  }
  el.prev.addEventListener('click', () => ((spread = Math.max(0, spread - 1)), refresh()));
  el.next.addEventListener('click', () => ((spread += 1), refresh()));

  function renderList(p: InteriorPlan): void {
    el.listActions.hidden = images.length < 1;
    el.list.innerHTML = images
      .map((img, i) => {
        const pl = p.placements[i];
        const dpi = pl?.dpi;
        const cls = dpi === undefined ? '' : dpi < POOR_IMAGE_DPI ? 'bad' : dpi < MIN_IMAGE_DPI ? 'meh' : 'ok';
        const page = p.pages.find((x) => x.kind === 'image' && x.image === i)?.n;
        return `<li>
          <img src="${img.url}" alt="" loading="lazy" />
          <div class="meta"><strong>${esc(img.name)}</strong><span>${img.widthPx} × ${img.heightPx} px${page ? ` · page ${page}` : ''}</span>
          ${dpi !== undefined ? `<span class="dpi ${cls}">${dpi} DPI${pl!.cropped > 0.05 ? ` · ${Math.round(pl!.cropped * 100)}% cropped` : ''}</span>` : ''}</div>
          <div class="acts">
            <button type="button" class="btn small subtle" data-act="up" data-id="${img.id}" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="btn small subtle" data-act="down" data-id="${img.id}" aria-label="Move down" ${i === images.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="btn small subtle" data-act="remove" data-id="${img.id}" aria-label="Remove">✕</button>
          </div></li>`;
      })
      .join('');
  }

  function renderCover(p: InteriorPlan, l: CoverLayout | null): void {
    el.coverDownload.disabled = true;
    const unit = ctx.state.unit;
    const table = el.coverSizes.closest<HTMLElement>('.table-wrap')!;
    table.hidden = !l || !p.layout;
    el.spineHint.textContent = '';
    if (!l || !p.layout) {
      el.coverLead.textContent = 'Add your pages first: the spine width depends on the page count.';
      el.coverSizes.innerHTML = '';
      el.artStatus.innerHTML = '';
      el.coverPreview.hidden = true;
      el.coverMessages.innerHTML = '';
      return;
    }
    const reg = artRegions(l);
    const ring = l.binding === 'hardcover' ? 'wrap' : 'bleed';
    const draft = p.valid ? '' : ' These sizes will change as you add pages.';
    el.coverLead.textContent = `For ${p.pageCount} pages on ${getPaper(ctx.state.paper).label.toLowerCase()}. Make your art at these sizes (the extra edge is the ${ring}), then add it below for a print-ready full-wrap cover PDF.${draft}`;
    const rows: [string, number, number][] = [
      ['Full cover (back + spine + front)', l.canvas.w, l.canvas.h],
      [`Front cover art, incl. ${ring}`, reg.front.w, reg.front.h],
      [`Back cover art, incl. ${ring}`, reg.back.w, reg.back.h],
      ['Spine', l.spineWidth, l.canvas.h],
    ];
    el.coverSizes.innerHTML = rows.map(([k, w, h]) => `<tr><td>${esc(k)}</td><td>${esc(times(formatSize(w, h, unit)))}</td><td>${esc(pxAt300(w, h))}</td></tr>`).join('');

    const status = (label: string, img: PageImage | null, r: Rect, key: string) => {
      if (!img) return '';
      const fit = artFit(img, r);
      const cls = fit.dpi < POOR_IMAGE_DPI ? 'bad' : fit.dpi < MIN_IMAGE_DPI ? 'meh' : 'ok';
      return `<li><img src="${img.url}" alt="" /><div class="meta"><strong>${label}: ${esc(img.name)}</strong><span class="dpi ${cls}">${fit.dpi} DPI${fit.cropped > 0.02 ? ` · ${Math.round(fit.cropped * 100)}% cropped to fit` : ''}</span></div><button type="button" class="btn small subtle" data-clear="${key}" aria-label="Remove ${label.toLowerCase()} image">✕</button></li>`;
    };
    el.artStatus.innerHTML = status('Front', front, reg.front, 'front') + status('Back', back, reg.back, 'back');
    el.backColorField.hidden = !!back;
    el.spineText.disabled = !l.spineTextAllowed;
    el.spineHint.textContent = l.spineTextAllowed
      ? `Spine is ${n2(l.spineWidth)}" wide. Text is sized to fit the safe zone.`
      : `KDP doesn't allow spine text under 79 pages (this book has ${p.pageCount}).`;

    const msgs: string[] = [];
    for (const w of l.warnings.filter((w) => w.level === 'error')) msgs.push(`<div class="msg error">${esc(w.message)}</div>`);
    for (const [label, img, r] of [['Front', front, reg.front], ['Back', back, reg.back]] as const) {
      if (!img) continue;
      const fit = artFit(img, r);
      if (fit.dpi < POOR_IMAGE_DPI) msgs.push(`<div class="msg warning">${label} cover image is only ${fit.dpi} DPI at this size and will print blurry. Make it ${pxAt300(r.w, r.h)}.</div>`);
      if (fit.cropped > 0.05) msgs.push(`<div class="msg info">${label} cover image is a different shape from the ${label.toLowerCase()} cover, so ${Math.round(fit.cropped * 100)}% is cropped off. Check the preview.</div>`);
    }
    el.coverMessages.innerHTML = msgs.join('');

    el.coverPreview.hidden = !front;
    if (front) {
      const PXc = 40;
      const R = (b: Rect) => `x="${b.x * PXc}" y="${b.y * PXc}" width="${b.w * PXc}" height="${b.h * PXc}"`;
      const W = l.canvas.w * PXc;
      const H = l.canvas.h * PXc;
      const z = l.safe.spineText;
      const spineTxt =
        s.spineText.trim() && z && l.spineTextAllowed
          ? `<text transform="translate(${(z.x + z.w / 2) * PXc} ${(z.y + z.h / 2) * PXc}) rotate(90)" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, sans-serif" font-size="${Math.min(z.w * PXc * 0.7, 24 * (PXc / 72))}" fill="${s.spineTextColor}">${esc(s.spineText.trim())}</text>`
          : '';
      el.coverPreview.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
        <defs><clipPath id="in-cf"><rect ${R(reg.front)}/></clipPath><clipPath id="in-cb"><rect ${R(reg.back)}/></clipPath></defs>
        <rect ${R(reg.back)} fill="${s.backColor}"/>
        ${back ? `<image href="${back.url}" ${R(reg.back)} preserveAspectRatio="xMidYMid slice" clip-path="url(#in-cb)"/>` : ''}
        <rect ${R(reg.spine)} fill="${s.spineColor}"/>
        <image href="${front.url}" ${R(reg.front)} preserveAspectRatio="xMidYMid slice" clip-path="url(#in-cf)"/>
        ${spineTxt}
        <rect ${R(l.trim)} fill="none" stroke="#e11d48" stroke-width="1" stroke-dasharray="6 4"/>
        <line x1="${l.spine.x * PXc}" x2="${l.spine.x * PXc}" y1="0" y2="${H}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 3"/>
        <line x1="${(l.spine.x + l.spine.w) * PXc}" x2="${(l.spine.x + l.spine.w) * PXc}" y1="0" y2="${H}" stroke="#3b82f6" stroke-width="1" stroke-dasharray="3 3"/>
        <rect ${R(l.barcode)} fill="#fff" fill-opacity=".85" stroke="#999" stroke-width="1"/>
        <text x="${(l.barcode.x + l.barcode.w / 2) * PXc}" y="${(l.barcode.y + l.barcode.h / 2) * PXc}" font-size="9" text-anchor="middle" dominant-baseline="central" fill="#666">barcode</text>
      </svg>`;
      el.coverPreview.style.setProperty('--ar', String(W / H));
    }
    el.coverDownload.disabled = busy || !front || !l.valid || !p.valid;
  }

  function refresh(): void {
    kindSeg.sync();
    sidedSeg.sync();
    bleedSeg.sync();
    const journal = s.kind === 'journal';
    const des = s.kind === 'designed' || s.kind === 'puzzles';
    el.coloring.hidden = s.kind !== 'coloring';
    el.journal.hidden = !journal;
    el.designedCard.hidden = !des;
    if (des) {
      if (s.kind === 'puzzles') {
        const n = puzzles.book.puzzles.length;
        el.designedCount.textContent = `${n} puzzle${n === 1 ? '' : 's'} and their answers: ${puzzles.pageCount()} pages, from the Puzzles tab.`;
        el.openDesigner.textContent = 'Open the Puzzles tab';
      } else {
        const n = designed().length;
        el.designedCount.textContent = `${n} page${n === 1 ? '' : 's'} from ${design.doc.pages.length} layout${design.doc.pages.length === 1 ? '' : 's'} in the Page designer.`;
        el.openDesigner.textContent = 'Open the Page designer';
      }
    }
    el.kindHint.textContent = journal
      ? 'Generated writing pages: lined, dot grid, graph, handwriting practice or blank.'
      : s.kind === 'puzzles'
        ? 'Word searches, crosswords, mazes and sudoku from the Puzzles tab, with the answers at the back.'
        : des
        ? 'Planners, journals and notebooks you built in the Page designer, in the page order you set there.'
        : 'One image per page: coloring pages, activity pages, mazes, puzzles.';
    el.sidedHint.textContent =
      s.sided === 'single'
        ? 'Front only: every page is printed on one side and its back is left blank. Best for coloring books, so markers can’t bleed through onto the next design.'
        : 'Front and back: pages are printed on both sides of the paper, like a normal book. Uses half the paper.';
    el.bleedHint.textContent = BLEED_ADVICE;
    el.styleHint.textContent = PAGE_STYLES.find((x) => x.id === s.style)?.note ?? '';

    const p = plan();
    const t = trim();
    const l = p.layout;
    if (l) {
      el.primary.textContent = times(`${p.pageCount} pages · ${formatSize(l.pageWidth, l.pageHeight, ctx.state.unit)}`);
      el.alt.textContent = `${times(formatSize(t.w, t.h, 'in'))} trim, ${s.bleed ? 'with bleed' : 'no bleed'}, ${s.sided === 'single' ? 'printed front only' : 'printed front and back'}`;
    } else {
      el.primary.textContent = p.pageCount ? `${p.pageCount} pages` : '–';
      el.alt.textContent = '';
    }
    const bleedSize = l ? formatSize(l.pageWidth, l.pageHeight, 'in') : '';
    el.sizeHint.textContent = l
      ? s.bleed
        ? `With bleed, make each page image ${times(bleedSize)} (${pxAt300(l.pageWidth, l.pageHeight)}) and let the art run off every edge.`
        : `Without bleed, the image is fitted inside the margins. For a full-size page, ${pxAt300(contentBox(l, 1).w, contentBox(l, 1).h)} fills the safe area exactly.`
      : `Make page images ${times(formatSize(t.w, t.h, 'in'))} at 300 DPI (${pxAt300(t.w, t.h)}).`;

    el.messages.innerHTML = p.warnings.map((w) => `<div class="msg ${w.level}">${esc(w.message)}</div>`).join('');
    if (!journal) renderList(p);
    renderPreview(p);

    el.download.disabled = busy || !p.valid;
    el.downloadHint.textContent = p.valid
      ? `${p.pageCount}-page PDF at ${times(bleedSize)}, fonts embedded. Upload it to KDP as your manuscript and choose “${s.bleed ? 'Bleed' : 'No bleed'}”.`
      : 'Fix the items above to download.';
    const pagesMatch = ctx.state.pages === p.pageCount;
    el.usePages.hidden = !p.valid;
    el.usePages.disabled = pagesMatch;
    el.usePages.textContent = pagesMatch ? `“Your book” is set to ${p.pageCount} pages` : `Use ${p.pageCount} pages in “Your book”`;

    renderCover(p, cover(p));
  }

  el.usePages.addEventListener('click', () => {
    const p = plan();
    if (p.valid) {
      ctx.setPages(p.pageCount);
      toast(`“Your book” now has ${p.pageCount} pages, so the cover template, preflight and mockup match.`);
    }
  });

  async function run(btn: HTMLButtonElement, label: string, job: () => Promise<void>) {
    busy = true;
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try {
      await job();
    } catch (err) {
      console.error(err);
      toast(`Could not create the file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      busy = false;
      btn.textContent = old;
      refresh();
    }
  }

  el.download.addEventListener('click', () =>
    run(el.download, 'Building PDF…', async () => {
      const p = plan();
      const custom =
        s.kind === 'designed' || s.kind === 'puzzles'
          ? {
              render: (i: number, pg: { n: number; origin: { x: number; y: number }; trimWidth: number }) => designedPrims(i, pg.n, pg.origin, pg.trimWidth),
              images: new Map(design.images().map((im) => [im.id, im])),
            }
          : undefined;
      const bytes = await buildInteriorPdf(p, images, await loadFonts(), custom);
      const r = await saveFile(interiorFileName(p), bytes, 'application/pdf');
      if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Interior PDF downloaded');
    }),
  );

  el.coverDownload.addEventListener('click', () =>
    run(el.coverDownload, 'Building PDF…', async () => {
      const p = plan();
      const l = cover(p);
      if (!l || !front) return;
      const bytes = await buildCoverArtPdf(
        l,
        { front, back, spineColor: s.spineColor, backColor: s.backColor, spineText: s.spineText, spineTextColor: s.spineTextColor, title: s.title || 'Cover' },
        await loadFonts(),
      );
      const t = trim();
      const r = await saveFile(`kdp-${l.binding}-cover_${t.w}x${t.h}in_${p.pageCount}pp.pdf`, bytes, 'application/pdf');
      if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Cover PDF downloaded');
    }),
  );

  return { id: 'interior', refresh };
}
