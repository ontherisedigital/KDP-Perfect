/**
 * Page designer: build your own planner, journal and notebook pages from the element library, with your own images.
 * Drag elements or image files onto the page; move, resize and rotate them; edit them on the right. Page layouts are
 * repeated (and dated) by the page order below, and the Interior tab turns them into the book.
 */

import {
  CATEGORIES,
  CUSTOM_TRIM_ID,
  ELEMENTS,
  TEMPLATES,
  expandSequence,
  formatDate,
  getElementDef,
  getTrimSize,
  interiorLayout,
  newElement,
  outsideSafe,
  pageFromTemplate,
  primsToSvg,
  renderPage,
  yearPlanSequence,
  contentBox,
  type Box,
  type DesignDoc,
  type DesignElement,
  type Field,
  type PageDesign,
  type Repeat,
} from '../../core';
import type { Ctx, Screen } from '../context';
import { addImage, design, loadImages, removeImage } from '../designStore';
import { $, esc, toast } from '../dom';
import { saveFile } from '../files';
import { measureText } from '../media';

const PX = 72; // SVG units per inch
const SNAP = 0.05; // grid step, inches
const SNAP_DIST = 0.08; // how close (inches) before an edge snaps to a guide
const REPEATS: { id: Repeat; label: string }[] = [
  { id: 'none', label: 'Not dated' },
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

type Drag =
  | { mode: 'move'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { mode: 'resize'; id: string; handle: string; sx: number; sy: number; o: DesignElement; keep: boolean }
  | { mode: 'rotate'; id: string; cx: number; cy: number };

export function initDesignerScreen(ctx: Ctx & { show(id: 'interior'): void }): Screen {
  let pageId = design.doc.pages[0]!.id;
  let selected: string | null = null;
  let drag: Drag | null = null;
  let guides: { x?: number; y?: number }[] = [];
  const undo: string[] = [];
  const redo: string[] = [];
  let clipboard: DesignElement | null = null;

  const el = {
    pages: $('dz-pages'),
    template: $<HTMLSelectElement>('dz-template'),
    undo: $<HTMLButtonElement>('dz-undo'),
    redo: $<HTMLButtonElement>('dz-redo'),
    snap: $<HTMLInputElement>('dz-snap'),
    grid: $<HTMLInputElement>('dz-grid'),
    size: $('dz-size'),
    lib: $('dz-lib'),
    canvas: $('dz-canvas'),
    props: $('dz-props'),
    dateLabel: $('dz-date-label'),
    warn: $('dz-warn'),
    start: $<HTMLInputElement>('dz-start'),
    weekStart: $<HTMLSelectElement>('dz-weekstart'),
    seq: $('dz-seq'),
    seqAdd: $<HTMLButtonElement>('dz-seq-add'),
    year: $<HTMLButtonElement>('dz-year'),
    seqTotal: $('dz-seq-total'),
    toInterior: $<HTMLButtonElement>('dz-to-interior'),
    export: $<HTMLButtonElement>('dz-export'),
    import: $<HTMLInputElement>('dz-import'),
  };

  const doc = () => design.doc;
  const page = (): PageDesign => doc().pages.find((p) => p.id === pageId) ?? doc().pages[0]!;
  const sel = () => page().elements.find((e) => e.id === selected) ?? null;

  /** Record an undo step, then apply a change. */
  function edit(fn: () => void): void {
    undo.push(JSON.stringify(doc()));
    if (undo.length > 100) undo.shift();
    redo.length = 0;
    fn();
    design.changed();
  }

  // --- page geometry -------------------------------------------------------------------------
  function trim() {
    const st = ctx.state;
    const custom = st.binding === 'paperback' && st.trimId === CUSTOM_TRIM_ID;
    const preset = custom ? undefined : getTrimSize(st.trimId, st.binding);
    return { w: preset ? preset.width : st.customWidth, h: preset ? preset.height : st.customHeight };
  }
  /** Safe area of a right-hand page, using the gutter for the book's current page count. */
  function safe(): Box {
    const t = trim();
    const n = Math.max(24, Math.min(828, expandSequence(doc()).length || 24));
    const l = interiorLayout(t.w, t.h, n, false);
    return contentBox(l, 1);
  }

  // --- library -------------------------------------------------------------------------------
  function renderLibrary(): void {
    const imgs = design.images();
    el.lib.innerHTML =
      CATEGORIES.map(
        (c) => `<details open><summary>${c}</summary><div class="dz-items">${ELEMENTS.filter((d) => d.category === c)
          .map((d) => `<button type="button" class="dz-item" draggable="true" data-add="${d.type}">${esc(d.label)}</button>`)
          .join('')}</div></details>`,
      ).join('') +
      `<details open><summary>Your images</summary>
        <label class="drop small" id="dz-img-drop" for="dz-img-file"><input id="dz-img-file" type="file" multiple accept="image/png,image/jpeg,image/webp" /><strong>Add images</strong><span>or drop them here or on the page</span></label>
        <div class="dz-imgs">${imgs
          .map((i) => `<figure draggable="true" data-img="${i.id}" title="${esc(i.name)}"><img src="${i.url}" alt="${esc(i.name)}" /><button type="button" class="dz-x" data-del-img="${i.id}" aria-label="Delete ${esc(i.name)}">✕</button></figure>`)
          .join('')}</div></details>`;
    const file = el.lib.querySelector<HTMLInputElement>('#dz-img-file')!;
    file.addEventListener('change', async () => {
      for (const f of Array.from(file.files ?? [])) await addImage(f).catch(() => toast(`${f.name} could not be read as an image.`));
      file.value = '';
    });
  }

  el.lib.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const add = t.closest<HTMLElement>('[data-add]');
    if (add) {
      const def = getElementDef(add.dataset.add!)!;
      const s = safe();
      addElement(add.dataset.add!, s.x + (s.w - def.w) / 2, s.y + (s.h - def.h) / 2);
      return;
    }
    const del = t.closest<HTMLElement>('[data-del-img]');
    if (del) {
      e.preventDefault();
      void removeImage(del.dataset.delImg!);
      return;
    }
    const img = t.closest<HTMLElement>('[data-img]');
    if (img) addImageElement(img.dataset.img!, null);
  });
  el.lib.addEventListener('dragstart', (e) => {
    const t = e.target as HTMLElement;
    const add = t.closest<HTMLElement>('[data-add]');
    const img = t.closest<HTMLElement>('[data-img]');
    if (add) e.dataTransfer!.setData('text/x-kdp-element', add.dataset.add!);
    else if (img) e.dataTransfer!.setData('text/x-kdp-image', img.dataset.img!);
    e.dataTransfer!.effectAllowed = 'copy';
  });
  el.lib.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
  });
  el.lib.addEventListener('drop', async (e) => {
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    for (const f of Array.from(e.dataTransfer.files)) if (/^image\//.test(f.type)) await addImage(f).catch(() => toast(`${f.name} could not be read.`));
  });

  function addElement(type: string, x: number, y: number): DesignElement {
    const e = newElement(type, { x: round(x), y: round(y) });
    edit(() => page().elements.push(e));
    selected = e.id;
    render();
    return e;
  }

  /** Put an image on the page, at `at` (inches) or centred, sized to its shape. */
  function addImageElement(id: string, at: { x: number; y: number } | null): void {
    const img = design.image(id);
    if (!img) return;
    const s = safe();
    const ar = img.widthPx / img.heightPx;
    let w = Math.min(s.w * 0.6, 3);
    let h = w / ar;
    if (h > s.h * 0.6) {
      h = s.h * 0.6;
      w = h * ar;
    }
    const x = at ? at.x - w / 2 : s.x + (s.w - w) / 2;
    const y = at ? at.y - h / 2 : s.y + (s.h - h) / 2;
    const e = newElement('image', { x: round(x), y: round(y) }, { w: round(w), h: round(h) });
    e.props.src = id;
    edit(() => page().elements.push(e));
    selected = e.id;
    render();
  }

  // --- canvas --------------------------------------------------------------------------------
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const snapTo = (n: number) => (el.snap.checked ? Math.round(n / SNAP) * SNAP : n);

  function toInches(ev: { clientX: number; clientY: number }): { x: number; y: number } {
    const svg = el.canvas.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x / PX, y: p.y / PX };
  }

  function previewDate() {
    const occ = expandSequence(doc()).find((p) => p.pageId === pageId && p.date);
    return occ?.date;
  }

  function renderCanvas(): void {
    const t = trim();
    const s = safe();
    const W = t.w * PX;
    const H = t.h * PX;
    const d = previewDate();
    const prims = renderPage(page(), { date: d, pageNumber: 1 });
    const body = primsToSvg(prims, PX, measureText, design.url);
    const grid = el.grid.checked
      ? `<pattern id="dz-gp" width="${0.25 * PX}" height="${0.25 * PX}" patternUnits="userSpaceOnUse"><path d="M ${0.25 * PX} 0 L 0 0 0 ${0.25 * PX}" fill="none" stroke="#c8d0e8" stroke-width=".5"/></pattern><rect width="${W}" height="${H}" fill="url(#dz-gp)"/>`
      : '';
    const e = sel();
    let handles = '';
    if (e) {
      const cx = (e.x + e.w / 2) * PX;
      const cy = (e.y + e.h / 2) * PX;
      const hs = 7;
      const pts: [string, number, number][] = [
        ['nw', 0, 0], ['n', e.w / 2, 0], ['ne', e.w, 0], ['e', e.w, e.h / 2], ['se', e.w, e.h], ['s', e.w / 2, e.h], ['sw', 0, e.h], ['w', 0, e.h / 2],
      ];
      handles = `<g transform="rotate(${e.rotate} ${cx} ${cy})" class="dz-sel">
        <rect x="${e.x * PX}" y="${e.y * PX}" width="${e.w * PX}" height="${e.h * PX}" class="dz-sel-box"/>
        ${e.locked ? '' : pts.map(([h, x, y]) => `<rect data-handle="${h}" x="${(e.x + x) * PX - hs / 2}" y="${(e.y + y) * PX - hs / 2}" width="${hs}" height="${hs}" class="dz-handle h-${h}"/>`).join('')}
        ${e.locked ? '' : `<line x1="${cx}" y1="${e.y * PX}" x2="${cx}" y2="${e.y * PX - 22}" class="dz-rot-line"/><circle data-handle="rotate" cx="${cx}" cy="${e.y * PX - 26}" r="6" class="dz-handle dz-rot"/>`}
      </g>`;
    }
    const guideLines = guides
      .map((g) => (g.x !== undefined ? `<line x1="${g.x * PX}" y1="0" x2="${g.x * PX}" y2="${H}" class="dz-guide"/>` : `<line x1="0" y1="${g.y! * PX}" x2="${W}" y2="${g.y! * PX}" class="dz-guide"/>`))
      .join('');
    // Hit targets: one transparent rect per element (rotated with it).
    const hits = page()
      .elements.map((x) => `<rect data-id="${x.id}" x="${x.x * PX}" y="${x.y * PX}" width="${x.w * PX}" height="${x.h * PX}" transform="rotate(${x.rotate} ${(x.x + x.w / 2) * PX} ${(x.y + x.h / 2) * PX})" class="dz-hit"/>`)
      .join('');
    el.canvas.innerHTML = `<svg viewBox="-30 -40 ${W + 60} ${H + 70}" xmlns="http://www.w3.org/2000/svg" class="${ctx.state.paper.startsWith('bw') ? 'bw' : ''}">
      <rect width="${W}" height="${H}" fill="#fff" class="dz-paper"/>${grid}
      <rect x="${s.x * PX}" y="${s.y * PX}" width="${s.w * PX}" height="${s.h * PX}" class="dz-margin"/>
      <g class="dz-art">${body}</g>${hits}${guideLines}${handles}</svg>`;
    el.canvas.style.setProperty('--ar', String((W + 60) / (H + 70)));
    el.dateLabel.textContent = d ? `Previewing as ${formatDate(d, 'long')}` : 'Not dated';
    const out = outsideSafe(page(), s);
    el.warn.textContent = out.length ? `⚠ ${out.length} element${out.length === 1 ? ' reaches' : 's reach'} into the margins (blue box). KDP may reject content there.` : '';
  }

  el.canvas.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element;
    const p = toInches(ev);
    const handle = t.getAttribute('data-handle');
    const e = sel();
    if (handle && e) {
      el.canvas.setPointerCapture(ev.pointerId);
      undo.push(JSON.stringify(doc()));
      redo.length = 0;
      drag = handle === 'rotate' ? { mode: 'rotate', id: e.id, cx: e.x + e.w / 2, cy: e.y + e.h / 2 } : { mode: 'resize', id: e.id, handle, sx: p.x, sy: p.y, o: structuredClone(e), keep: ev.shiftKey };
      return;
    }
    const id = t.getAttribute('data-id');
    if (id) {
      selected = id;
      const x = page().elements.find((q) => q.id === id)!;
      if (!x.locked) {
        el.canvas.setPointerCapture(ev.pointerId);
        undo.push(JSON.stringify(doc()));
        redo.length = 0;
        drag = { mode: 'move', id, sx: p.x, sy: p.y, ox: x.x, oy: x.y, moved: false };
      }
    } else selected = null;
    el.canvas.focus({ preventScroll: true });
    render();
  });

  el.canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const e = page().elements.find((q) => q.id === drag!.id);
    if (!e) return;
    const p = toInches(ev);
    guides = [];
    if (drag.mode === 'move') {
      let x = drag.ox + p.x - drag.sx;
      let y = drag.oy + p.y - drag.sy;
      drag.moved = true;
      if (el.snap.checked && !ev.altKey) [x, y] = snapMove(e, x, y);
      e.x = round(x);
      e.y = round(y);
    } else if (drag.mode === 'resize') {
      resize(e, drag, p, ev.shiftKey || drag.keep);
    } else {
      let a = (Math.atan2(p.y - drag.cy, p.x - drag.cx) * 180) / Math.PI + 90;
      if (el.snap.checked && !ev.altKey) a = Math.round(a / 15) * 15;
      e.rotate = ((Math.round(a) % 360) + 360) % 360;
      if (e.rotate > 180) e.rotate -= 360;
    }
    renderCanvas();
  });

  const endDrag = () => {
    if (!drag) return;
    if (drag.mode === 'move' && !drag.moved) undo.pop();
    drag = null;
    guides = [];
    design.changed();
    renderCanvas();
    renderProps();
    el.undo.disabled = !undo.length;
  };
  el.canvas.addEventListener('pointerup', endDrag);
  el.canvas.addEventListener('pointercancel', endDrag);

  /** Snap the moving element's edges and centre to the page centre, margins and other elements. */
  function snapMove(e: DesignElement, x: number, y: number): [number, number] {
    const t = trim();
    const s = safe();
    const xs = [0, t.w / 2, t.w, s.x, s.x + s.w];
    const ys = [0, t.h / 2, t.h, s.y, s.y + s.h];
    for (const o of page().elements)
      if (o.id !== e.id) {
        xs.push(o.x, o.x + o.w / 2, o.x + o.w);
        ys.push(o.y, o.y + o.h / 2, o.y + o.h);
      }
    const fit = (pos: number, size: number, cands: number[]): [number, number | undefined] => {
      let best: [number, number | undefined] = [snapTo(pos), undefined];
      let dist = SNAP_DIST;
      for (const c of cands)
        for (const k of [0, 0.5, 1]) {
          const d = Math.abs(pos + size * k - c);
          if (d < dist) {
            dist = d;
            best = [c - size * k, c];
          }
        }
      return best;
    };
    const [nx, gx] = fit(x, e.w, xs);
    const [ny, gy] = fit(y, e.h, ys);
    if (gx !== undefined) guides.push({ x: gx });
    if (gy !== undefined) guides.push({ y: gy });
    return [nx, ny];
  }

  function resize(e: DesignElement, d: Extract<Drag, { mode: 'resize' }>, p: { x: number; y: number }, keep: boolean): void {
    // Work in the element's own (unrotated) axes.
    const a = (-d.o.rotate * Math.PI) / 180;
    const dx0 = p.x - d.sx;
    const dy0 = p.y - d.sy;
    const dx = dx0 * Math.cos(a) - dy0 * Math.sin(a);
    const dy = dx0 * Math.sin(a) + dy0 * Math.cos(a);
    const h = d.handle;
    let { x, y, w, h: hh } = d.o;
    if (h.includes('e')) w = d.o.w + dx;
    if (h.includes('s')) hh = d.o.h + dy;
    if (h.includes('w')) {
      w = d.o.w - dx;
      x = d.o.x + dx;
    }
    if (h.includes('n')) {
      hh = d.o.h - dy;
      y = d.o.y + dy;
    }
    if (keep && (h.length === 2)) {
      const r = d.o.w / d.o.h;
      if (w / hh > r) w = hh * r;
      else hh = w / r;
      if (h.includes('w')) x = d.o.x + d.o.w - w;
      if (h.includes('n')) y = d.o.y + d.o.h - hh;
    }
    const min = 0.1;
    if (w < min) {
      if (h.includes('w')) x -= min - w;
      w = min;
    }
    if (hh < min) {
      if (h.includes('n')) y -= min - hh;
      hh = min;
    }
    if (el.snap.checked && !d.o.rotate) {
      const sx = snapTo(x);
      const sy = snapTo(y);
      if (h.includes('w')) (w += x - sx), (x = sx);
      if (h.includes('n')) (hh += y - sy), (y = sy);
      if (h.includes('e')) w = snapTo(x + w) - x;
      if (h.includes('s')) hh = snapTo(y + hh) - y;
    }
    Object.assign(e, { x: round(x), y: round(y), w: round(Math.max(min, w)), h: round(Math.max(min, hh)) });
  }

  // Drop elements and images (from the library or from the computer) onto the page.
  el.canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    el.canvas.classList.add('over');
  });
  el.canvas.addEventListener('dragleave', () => el.canvas.classList.remove('over'));
  el.canvas.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.canvas.classList.remove('over');
    const at = toInches(e);
    const dt = e.dataTransfer!;
    const type = dt.getData('text/x-kdp-element');
    const imgId = dt.getData('text/x-kdp-image');
    const target = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.getAttribute('data-id');
    const onImage = page().elements.find((x) => x.id === target && x.type === 'image');
    if (type) {
      const def = getElementDef(type)!;
      addElement(type, snapTo(at.x - def.w / 2), snapTo(at.y - def.h / 2));
    } else if (imgId) {
      if (onImage) edit(() => (onImage.props.src = imgId));
      else addImageElement(imgId, at);
      render();
    } else if (dt.files.length) {
      for (const f of Array.from(dt.files).filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name))) {
        try {
          const img = await addImage(f);
          if (onImage) {
            edit(() => (onImage.props.src = img.id));
            render();
          } else addImageElement(img.id, at);
        } catch {
          toast(`${f.name} could not be read as an image.`);
        }
      }
    }
  });

  // Keyboard: delete, nudge, undo/redo, duplicate, copy/paste.
  el.canvas.addEventListener('keydown', (e) => {
    const x = sel();
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') return e.preventDefault(), e.shiftKey ? doRedo() : doUndo();
    if ((e.ctrlKey || e.metaKey) && k === 'y') return e.preventDefault(), doRedo();
    if (!x) return;
    if (k === 'delete' || k === 'backspace') return e.preventDefault(), remove();
    if ((e.ctrlKey || e.metaKey) && k === 'd') return e.preventDefault(), duplicate();
    if ((e.ctrlKey || e.metaKey) && k === 'c') return (clipboard = structuredClone(x)), undefined;
    if ((e.ctrlKey || e.metaKey) && k === 'v' && clipboard) return e.preventDefault(), paste();
    const step = e.shiftKey ? 0.1 : 0.01;
    const mv: Record<string, [number, number]> = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] };
    if (mv[k] && !x.locked) {
      e.preventDefault();
      edit(() => {
        x.x = round(x.x + mv[k]![0]);
        x.y = round(x.y + mv[k]![1]);
      });
      render();
    }
  });

  function remove(): void {
    const x = sel();
    if (!x) return;
    edit(() => (page().elements = page().elements.filter((q) => q.id !== x.id)));
    selected = null;
    render();
  }
  function duplicate(): void {
    const x = sel();
    if (!x) return;
    const c = { ...structuredClone(x), id: newElement(x.type, { x: 0, y: 0 }).id, x: round(x.x + 0.2), y: round(x.y + 0.2), locked: false };
    edit(() => page().elements.push(c));
    selected = c.id;
    render();
  }
  function paste(): void {
    if (!clipboard) return;
    const c = { ...structuredClone(clipboard), id: newElement(clipboard.type, { x: 0, y: 0 }).id, x: round(clipboard.x + 0.2), y: round(clipboard.y + 0.2) };
    edit(() => page().elements.push(c));
    selected = c.id;
    render();
  }
  function doUndo(): void {
    const s = undo.pop();
    if (!s) return;
    redo.push(JSON.stringify(doc()));
    design.set(JSON.parse(s) as DesignDoc);
    render();
  }
  function doRedo(): void {
    const s = redo.pop();
    if (!s) return;
    undo.push(JSON.stringify(doc()));
    design.set(JSON.parse(s) as DesignDoc);
    render();
  }
  el.undo.addEventListener('click', doUndo);
  el.redo.addEventListener('click', doRedo);
  el.snap.addEventListener('change', renderCanvas);
  el.grid.addEventListener('change', renderCanvas);

  // --- properties ----------------------------------------------------------------------------
  function fieldHtml(f: Field, v: unknown): string {
    const id = `dzf-${f.key}`;
    const val = v ?? '';
    switch (f.kind) {
      case 'bool':
        return `<label class="check"><input type="checkbox" id="${id}" data-key="${f.key}" ${v === true ? 'checked' : ''}/> ${esc(f.label)}</label>`;
      case 'select':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><select id="${id}" data-key="${f.key}">${f.options!.map((o) => `<option value="${o.id}" ${o.id === val ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
      case 'color':
        return `<label class="inline-color">${esc(f.label)} <input type="color" id="${id}" data-key="${f.key}" value="${esc(String(val || '#000000'))}"/></label>`;
      case 'range':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><input type="range" id="${id}" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}"/></div>`;
      case 'number':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><input type="number" id="${id}" data-key="${f.key}" min="${f.min ?? ''}" max="${f.max ?? ''}" step="${f.step ?? 'any'}" value="${val}"/></div>`;
      case 'textarea':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><textarea id="${id}" data-key="${f.key}" rows="4">${esc(String(val))}</textarea></div>`;
      case 'month':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><input type="month" id="${id}" data-key="${f.key}" value="${esc(String(val).slice(0, 7))}"/></div>`;
      case 'date':
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><input type="date" id="${id}" data-key="${f.key}" value="${esc(String(val))}"/></div>`;
      case 'image': {
        const imgs = design.images();
        return `<div class="field tight"><span class="label">${esc(f.label)}</span><div class="dz-pick">${imgs.length ? imgs.map((i) => `<button type="button" data-pick="${i.id}" class="${i.id === val ? 'on' : ''}" title="${esc(i.name)}"><img src="${i.url}" alt="${esc(i.name)}"/></button>`).join('') : '<span class="hint">Add images in the library, or drop one onto this frame.</span>'}</div></div>`;
      }
      default:
        return `<div class="field tight"><label for="${id}">${esc(f.label)}</label><input type="text" id="${id}" data-key="${f.key}" value="${esc(String(val))}"/></div>`;
    }
  }

  function renderProps(): void {
    const x = sel();
    if (!x) {
      const p = page();
      el.props.innerHTML = `<h3>Page layout</h3>
        <div class="field tight"><label for="dz-pname">Name</label><input type="text" id="dz-pname" value="${esc(p.name)}"/></div>
        <label class="check"><input type="checkbox" id="dz-mirror" ${p.mirror ? 'checked' : ''}/> Mirror on left-hand pages</label>
        <p class="hint">Mirroring flips the layout on left-hand pages, so wide inside margins stay by the spine.</p>
        <p class="hint">Click an element to edit it. Drag elements and images from the library onto the page.</p>
        <div class="btn-row"><button type="button" class="btn subtle small" data-page-act="dup">Duplicate layout</button><button type="button" class="btn subtle small" data-page-act="del" ${doc().pages.length < 2 ? 'disabled' : ''}>Delete layout</button></div>`;
      return;
    }
    const def = getElementDef(x.type)!;
    const groups = new Map<string, Field[]>();
    for (const f of def.fields) {
      if (f.when && !f.when(x.props)) continue;
      const g = f.group ?? 'Settings';
      groups.set(g, [...(groups.get(g) ?? []), f]);
    }
    el.props.innerHTML = `<h3>${esc(def.label)}</h3>
      <div class="dz-arrange">
        <button type="button" class="btn small subtle" data-act="dup" title="Duplicate (Ctrl+D)">Duplicate</button>
        <button type="button" class="btn small subtle" data-act="front" title="Bring to front">Front</button>
        <button type="button" class="btn small subtle" data-act="back" title="Send to back">Back</button>
        <button type="button" class="btn small subtle" data-act="center" title="Centre on the page">Centre</button>
        <button type="button" class="btn small subtle" data-act="lock">${x.locked ? 'Unlock' : 'Lock'}</button>
        <button type="button" class="btn small subtle danger" data-act="del" title="Delete (Del)">Delete</button>
      </div>
      <details open><summary>Position and size (inches)</summary><div class="dz-geo">
        ${(['x', 'y', 'w', 'h', 'rotate'] as const).map((k) => `<label>${{ x: 'X', y: 'Y', w: 'Width', h: 'Height', rotate: 'Rotate°' }[k]}<input type="number" step="${k === 'rotate' ? 1 : 0.01}" data-geo="${k}" value="${x[k]}"/></label>`).join('')}
      </div></details>
      ${[...groups].map(([g, fs]) => `<details open><summary>${esc(g)}</summary>${fs.map((f) => fieldHtml(f, x.props[f.key])).join('')}</details>`).join('')}`;
  }

  el.props.addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    const x = sel();
    if (t.id === 'dz-pname') {
      page().name = t.value;
      design.changed();
      renderPages();
      return;
    }
    if (!x) return;
    if (t.dataset.geo) {
      const v = t.valueAsNumber;
      if (!Number.isFinite(v)) return;
      edit(() => ((x as unknown as Record<string, number>)[t.dataset.geo!] = t.dataset.geo === 'w' || t.dataset.geo === 'h' ? Math.max(0.1, v) : v));
      renderCanvas();
      return;
    }
    const key = t.dataset.key;
    if (!key) return;
    const v = t.type === 'checkbox' ? t.checked : t.type === 'number' || t.type === 'range' ? t.valueAsNumber : t.value;
    if (typeof v === 'number' && !Number.isFinite(v)) return;
    edit(() => (x.props[key] = v));
    renderCanvas();
  });
  // Re-render the panel when a select/checkbox changes, so dependent fields appear.
  el.props.addEventListener('change', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (t.id === 'dz-mirror') {
      edit(() => (page().mirror = t.checked));
      return;
    }
    if (t.tagName === 'SELECT' || t.type === 'checkbox') renderProps();
  });
  el.props.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    const pick = t.closest<HTMLElement>('[data-pick]');
    const x = sel();
    if (pick && x) {
      edit(() => (x.props.src = pick.dataset.pick!));
      render();
      return;
    }
    const pa = t.closest<HTMLElement>('[data-page-act]')?.dataset.pageAct;
    if (pa === 'dup') return duplicatePage();
    if (pa === 'del') return deletePage();
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act || !x) return;
    const els = page().elements;
    if (act === 'del') return remove();
    if (act === 'dup') return duplicate();
    edit(() => {
      if (act === 'front' || act === 'back') {
        const i = els.indexOf(x);
        els.splice(i, 1);
        if (act === 'front') els.push(x);
        else els.unshift(x);
      } else if (act === 'center') {
        const tr = trim();
        x.x = round((tr.w - x.w) / 2);
      } else if (act === 'lock') x.locked = !x.locked;
    });
    render();
  });

  // --- page layouts --------------------------------------------------------------------------
  function renderPages(): void {
    el.pages.innerHTML =
      doc().pages.map((p) => `<button type="button" role="tab" data-page="${p.id}" aria-selected="${p.id === pageId}">${esc(p.name || 'Untitled')}</button>`).join('') +
      `<button type="button" class="dz-add-page" data-page-new aria-label="New page layout" title="New page layout">+</button>`;
  }
  el.pages.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-page-new]')) {
      const id = `p${Date.now().toString(36)}`;
      edit(() => {
        doc().pages.push({ id, name: `Page ${doc().pages.length + 1}`, elements: [], mirror: false });
        doc().sequence.push({ id: `s${id}`, pageId: id, count: 1, repeat: 'none' });
      });
      pageId = id;
      selected = null;
      render();
      return;
    }
    const b = t.closest<HTMLElement>('[data-page]');
    if (b) {
      pageId = b.dataset.page!;
      selected = null;
      render();
    }
  });
  function duplicatePage(): void {
    const p = page();
    const id = `p${Date.now().toString(36)}`;
    const copy: PageDesign = { ...structuredClone(p), id, name: `${p.name} copy` };
    copy.elements.forEach((e) => (e.id = newElement(e.type, { x: 0, y: 0 }).id));
    edit(() => doc().pages.push(copy));
    pageId = id;
    render();
  }
  function deletePage(): void {
    if (doc().pages.length < 2) return;
    if (!confirm(`Delete the layout "${page().name}"? It is also removed from the page order.`)) return;
    const id = pageId;
    edit(() => {
      doc().pages = doc().pages.filter((p) => p.id !== id);
      doc().sequence = doc().sequence.filter((s) => s.pageId !== id);
    });
    pageId = doc().pages[0]!.id;
    selected = null;
    render();
  }

  el.template.innerHTML = `<option value="">Start from a template…</option>` + TEMPLATES.map((t) => `<option value="${t.id}">${esc(t.label)}</option>`).join('');
  el.template.addEventListener('change', () => {
    const t = TEMPLATES.find((x) => x.id === el.template.value);
    el.template.value = '';
    if (!t) return;
    if (page().elements.length && !confirm(`Replace everything on "${page().name}" with the ${t.label} template?`)) return;
    edit(() => {
      const fresh = pageFromTemplate(t, safe(), pageId);
      page().elements = fresh.elements;
      if (/^Page \d+$/.test(page().name)) page().name = t.label;
      const item = doc().sequence.find((s) => s.pageId === pageId);
      if (item && item.repeat === 'none') item.repeat = t.repeat;
    });
    selected = null;
    render();
  });

  // --- page order ----------------------------------------------------------------------------
  function renderSequence(): void {
    const d = doc();
    el.start.value = d.startDate;
    el.weekStart.value = d.weekStart;
    el.seq.innerHTML = d.sequence
      .map(
        (s) => `<tr data-seq="${s.id}">
        <td><select data-f="pageId" aria-label="Layout">${d.pages.map((p) => `<option value="${p.id}" ${p.id === s.pageId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></td>
        <td><input type="number" data-f="count" min="0" max="1000" step="1" value="${s.count}" aria-label="Copies"/></td>
        <td><select data-f="repeat" aria-label="Dates">${REPEATS.map((r) => `<option value="${r.id}" ${r.id === s.repeat ? 'selected' : ''}>${r.label}</option>`).join('')}</select></td>
        <td class="dz-seq-acts"><button type="button" class="btn small subtle" data-mv="-1" aria-label="Move up">↑</button><button type="button" class="btn small subtle" data-mv="1" aria-label="Move down">↓</button><button type="button" class="btn small subtle" data-rm aria-label="Remove row">✕</button></td></tr>`,
      )
      .join('');
    const n = expandSequence(d).length;
    el.seqTotal.textContent = `${n} designed page${n === 1 ? '' : 's'}. Front pages, blank backs (front-only printing) and the final blank page are added on the Interior tab.`;
  }
  el.seq.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const row = t.closest<HTMLElement>('[data-seq]');
    const item = doc().sequence.find((s) => s.id === row?.dataset.seq);
    if (!item) return;
    edit(() => {
      if (t.dataset.f === 'count') item.count = Math.max(0, Math.min(1000, Math.round(t.valueAsNumber || 0)));
      else if (t.dataset.f === 'pageId') item.pageId = t.value;
      else if (t.dataset.f === 'repeat') item.repeat = t.value as Repeat;
    });
    renderSequence();
    renderCanvas();
  });
  el.seq.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('[data-seq]');
    const seq = doc().sequence;
    const i = seq.findIndex((s) => s.id === row?.dataset.seq);
    if (i < 0) return;
    if (t.closest('[data-rm]')) edit(() => seq.splice(i, 1));
    const mv = t.closest<HTMLElement>('[data-mv]');
    if (mv) {
      const j = i + Number(mv.dataset.mv);
      if (j < 0 || j >= seq.length) return;
      edit(() => ([seq[i], seq[j]] = [seq[j]!, seq[i]!]));
    }
    renderSequence();
  });
  el.seqAdd.addEventListener('click', () => {
    edit(() => doc().sequence.push({ id: `s${Date.now().toString(36)}`, pageId, count: 1, repeat: 'none' }));
    renderSequence();
  });
  el.start.addEventListener('change', () => {
    if (!el.start.value) return;
    edit(() => (doc().startDate = el.start.value));
    render();
  });
  el.weekStart.addEventListener('change', () => {
    edit(() => (doc().weekStart = el.weekStart.value as 'mon'));
    render();
  });
  el.year.addEventListener('click', () => {
    const pages = doc().pages;
    const names = pages.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const mi = Number(prompt(`Year planner: which layout is the MONTH page?\n\n${names}`, '1'));
    const month = pages[mi - 1];
    if (!month) return;
    const wi = prompt(`Which layout is the WEEK page? (leave empty for none)\n\n${names}`, pages.length > 1 ? '2' : '');
    const week = wi ? pages[Number(wi) - 1] : undefined;
    edit(() => (doc().sequence = yearPlanSequence(doc(), month.id, week?.id ?? null, 12)));
    toast(`Page order set: 12 months from ${doc().startDate}, each followed by its weeks.`);
    render();
  });

  el.toInterior.addEventListener('click', () => {
    ctx.state.interior.kind = 'designed';
    ctx.save();
    ctx.show('interior');
  });
  el.export.addEventListener('click', async () => {
    // The design file carries its images so it opens on another computer.
    const imgs = Object.fromEntries(
      design
        .images()
        .filter((i) => JSON.stringify(doc()).includes(i.id))
        .map((i) => [i.id, { name: i.name, type: i.type, widthPx: i.widthPx, heightPx: i.heightPx, data: btoa(Array.from(i.bytes, (b) => String.fromCharCode(b)).join('')) }]),
    );
    const r = await saveFile('kdp-perfect-design.json', JSON.stringify({ ...doc(), images: imgs }), 'application/json');
    if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Design file downloaded');
  });
  el.import.addEventListener('change', async () => {
    const f = el.import.files?.[0];
    el.import.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as DesignDoc & { images?: Record<string, { name: string; type: 'png' | 'jpg'; data: string }> };
      const { images, ...d } = data;
      if (!(d.version === 1 && Array.isArray(d.pages))) throw new Error('not a design file');
      // Re-add images under new ids and point the elements at them.
      const remap = new Map<string, string>();
      for (const [oldId, im] of Object.entries(images ?? {})) {
        const bytes = Uint8Array.from(atob(im.data), (c) => c.charCodeAt(0));
        const s = await addImage(new File([bytes], im.name, { type: im.type === 'png' ? 'image/png' : 'image/jpeg' }));
        remap.set(oldId, s.id);
      }
      for (const p of d.pages) for (const e of p.elements) if (typeof e.props.src === 'string' && remap.has(e.props.src)) e.props.src = remap.get(e.props.src)!;
      edit(() => design.set(d as DesignDoc));
      pageId = d.pages[0]!.id;
      selected = null;
      render();
      toast('Design opened');
    } catch {
      toast('That file is not a KDP Perfect design file.');
    }
  });

  function render(): void {
    if (!doc().pages.some((p) => p.id === pageId)) pageId = doc().pages[0]!.id;
    const t = trim();
    el.size.textContent = `Pages are ${t.w}" × ${t.h}" (trim size from "Your book"). The blue box is the safe area. For bleed, let background art run 0.125" past the page edge.`;
    el.undo.disabled = !undo.length;
    el.redo.disabled = !redo.length;
    renderPages();
    renderCanvas();
    renderProps();
    renderSequence();
  }

  renderLibrary();
  let imgSig = '';
  design.onChange(() => {
    // Only the image list in the library depends on the store; keep its scroll position otherwise.
    const sig = design.images().map((i) => i.id).join();
    if (sig !== imgSig) {
      imgSig = sig;
      renderLibrary();
      renderProps();
    }
  });
  void loadImages();

  return { id: 'designer', refresh: render };
}
