import {
  ASPECTS,
  BACKGROUNDS,
  LONG_SIDES,
  POSES,
  bookDims,
  buildCoverScene,
  frontAspect,
  getAspect,
  getBackground,
  coverCrop,
  outputSize,
  pageEdgeColor,
  pickPhoto,
  wrapRegions,
  type CoverLayout,
  type PoseId,
} from '../../core';
import { averageColor, coverFit, cropRegion, loadArtwork, newCanvas, sceneToCanvas, shade, type Artwork } from '../artwork';
import type { Ctx, Screen } from '../context';
import { $, bindFileInput, esc, rafThrottle, segment, toast } from '../dom';
import { saveFile } from '../files';
import type { Book3D, PanelImages } from '../mockup/book3d';

/** Photo backgrounds bundled with the app, by file name. */
const PHOTO_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob('../mockup/bgs/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>).map(([k, v]) => [
    k.split('/').pop()!.replace('.jpg', ''),
    v,
  ]),
);

/** The photo (and its URL) to use for a background at an aspect ratio, or null for colour backgrounds. */
function photoFor(bgId: string, aspect: number): { url: string; w: number; h: number } | null {
  const bg = getBackground(bgId);
  if (!bg.photos?.length) return null;
  const p = pickPhoto(bg.photos, aspect);
  return { url: PHOTO_URLS[p.file] ?? '', w: p.w, h: p.h };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load the background photo.'));
    img.src = url;
  });
}

const SOURCE_HINT = {
  wrap: 'Upload your finished full-wrap cover. The back, spine and front are cut out using your book settings on the left.',
  front: 'Upload just the front cover. Pick a colour for the spine and back, or add a back cover.',
} as const;

export function initMockupScreen(ctx: Ctx): Screen {
  const m = ctx.state.mockup;
  let art: Artwork | null = null;
  let backArt: Artwork | null = null;
  let engine: Book3D | null = null;
  let engineFailed = false;
  let visible = false;
  let observer: ResizeObserver | null = null;
  let autoSpine = '#444444';
  let customSpine: string | null = null;

  const el = {
    stage: $('mock-stage'),
    canvas: $<HTMLCanvasElement>('mock-canvas'),
    msg: $('mock-msg'),
    empty: $('mock-empty'),
    reset: $<HTMLButtonElement>('mock-reset'),
    source: $('mock-source'),
    sourceHint: $('mock-source-hint'),
    file: $<HTMLInputElement>('mock-file'),
    backFile: $<HTMLInputElement>('mock-back-file'),
    backLabel: $('mock-back-label'),
    sample: $<HTMLButtonElement>('mock-sample'),
    artName: $('mock-art-name'),
    spineField: $('mock-spine-field'),
    spineColor: $<HTMLInputElement>('mock-spine-color'),
    pose: $('mock-pose'),
    aspect: $('mock-aspect'),
    bg: $('mock-bg'),
    finish: $('mock-finish'),
    shadow: $<HTMLInputElement>('mock-shadow'),
    crease: $<HTMLInputElement>('mock-crease'),
    size: $<HTMLSelectElement>('mock-size'),
    format: $('mock-format'),
    sizeHint: $('mock-size-hint'),
    download: $<HTMLButtonElement>('mock-download'),
  };

  // ---- controls ----------------------------------------------------------------------------

  const sourceSeg = segment<'wrap' | 'front'>(
    el.source,
    [
      { value: 'wrap', label: 'Full wrap cover' },
      { value: 'front', label: 'Front cover only' },
    ],
    () => m.source,
    (v) => {
      m.source = v;
      art = null;
      backArt = null;
      ctx.save();
      refresh();
    },
  );
  const finishSeg = segment<'matte' | 'glossy'>(
    el.finish,
    [
      { value: 'matte', label: 'Matte' },
      { value: 'glossy', label: 'Glossy' },
    ],
    () => m.finish,
    (v) => {
      m.finish = v;
      ctx.save();
      refresh();
    },
  );
  const formatSeg = segment<'png' | 'jpg'>(
    el.format,
    [
      { value: 'png', label: 'PNG' },
      { value: 'jpg', label: 'JPG' },
    ],
    () => m.format,
    (v) => {
      m.format = v;
      ctx.save();
      refresh();
    },
  );

  el.pose.innerHTML = POSES.map((p) => `<button type="button" class="chip" data-v="${p.id}" title="${esc(p.hint)}">${esc(p.label)}</button>`).join('');
  el.aspect.innerHTML = ASPECTS.map((a) => `<button type="button" class="chip" data-v="${esc(a.id)}">${esc(a.label)}</button>`).join('');
  el.bg.innerHTML = BACKGROUNDS.map((b) => {
    const thumb = b.photos ? PHOTO_URLS[b.photos[0]!.file] : undefined;
    const css = thumb ? `background:url('${thumb}') center/cover` : b.from === null ? '' : `background:linear-gradient(${b.from},${b.to ?? b.from})`;
    return `<button type="button" class="swatch${b.from === null && !thumb ? ' clear' : ''}" data-v="${b.id}" title="${esc(b.label)}" aria-label="${esc(b.label)}" style="${css}"></button>`;
  }).join('');
  el.size.innerHTML = LONG_SIDES.map((s) => `<option value="${s}">${s} px</option>`).join('');

  const chipClick = (host: HTMLElement, apply: (v: string) => void) =>
    host.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (b) apply(b.dataset.v!);
    });
  chipClick(el.pose, (v) => {
    m.pose = v as PoseId;
    ctx.save();
    refresh();
  });
  chipClick(el.aspect, (v) => {
    m.aspect = v;
    ctx.save();
    refresh();
  });
  chipClick(el.bg, (v) => {
    m.background = v;
    const b = getBackground(v);
    if (b.from === null && !b.photos && m.format === 'jpg') m.format = 'png';
    ctx.save();
    refresh();
  });
  el.shadow.addEventListener('change', () => {
    m.shadow = el.shadow.checked;
    ctx.save();
    refresh();
  });
  el.crease.addEventListener('change', () => {
    m.crease = el.crease.checked;
    ctx.save();
    refresh();
  });
  el.size.addEventListener('change', () => {
    m.longSide = Number(el.size.value);
    ctx.save();
    refresh();
  });
  el.spineColor.addEventListener('input', () => {
    customSpine = el.spineColor.value;
    refresh();
  });
  el.sample.addEventListener('click', () => {
    art = null;
    backArt = null;
    customSpine = null;
    refresh();
  });
  el.reset.addEventListener('click', () => engine?.setView({ yaw: 0, pitch: 0, zoom: 1 }));

  const onFile = (target: 'main' | 'back') => async (file: File) => {
    try {
      const a = await loadArtwork(file, 4096);
      if (target === 'main') art = a;
      else backArt = a;
      customSpine = null;
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err));
    }
    refresh();
  };
  bindFileInput(el.file, el.stage, onFile('main'));
  bindFileInput(el.backFile, null, onFile('back'));

  // ---- 3D engine (loaded on first use) -----------------------------------------------------

  async function ensureEngine(): Promise<Book3D | null> {
    if (engine || engineFailed) return engine;
    try {
      const { Book3D } = await import('../mockup/book3d');
      engine = new Book3D(el.canvas);
      if (import.meta.env.DEV) (window as unknown as { __book3d?: Book3D }).__book3d = engine; // dev-only debug handle
    } catch (err) {
      console.error(err);
      engineFailed = true;
      el.msg.hidden = false;
      el.msg.textContent = '3D preview is not available here (WebGL could not start). Try a different browser or update your graphics driver.';
      return null;
    }
    observer = new ResizeObserver(() => resizeEngine());
    observer.observe(el.stage);
    attachInteraction();
    return engine;
  }

  function resizeEngine(): void {
    if (!engine || !visible) return;
    const r = el.stage.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) engine.resize(r.width, r.height);
  }

  function attachInteraction(): void {
    let drag: { x: number; y: number } | null = null;
    el.canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      el.canvas.setPointerCapture(e.pointerId);
      el.canvas.classList.add('grabbing');
    });
    el.canvas.addEventListener('pointermove', (e) => {
      if (!drag || !engine) return;
      const v = engine.getView();
      v.yaw -= (e.clientX - drag.x) * 0.4;
      v.pitch += (e.clientY - drag.y) * 0.3;
      v.pitch = Math.max(-40, Math.min(60, v.pitch));
      drag = { x: e.clientX, y: e.clientY };
      engine.setView(v);
    });
    const end = () => {
      drag = null;
      el.canvas.classList.remove('grabbing');
    };
    el.canvas.addEventListener('pointerup', end);
    el.canvas.addEventListener('pointercancel', end);
    el.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!engine) return;
        e.preventDefault();
        const v = engine.getView();
        v.zoom = Math.max(0.5, Math.min(2.4, v.zoom * Math.exp(-e.deltaY * 0.0012)));
        engine.setView(v);
      },
      { passive: false },
    );
  }

  // ---- building the book ---------------------------------------------------------------------

  function solid(color: string, w = 64, h = 512): HTMLCanvasElement {
    const c = newCanvas(w, h);
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    return c;
  }

  /** A faint fold line where a real cover creases beside the spine. */
  function addCrease(canvas: HTMLCanvasElement, layout: CoverLayout): HTMLCanvasElement {
    const out = newCanvas(canvas.width, canvas.height);
    const g = out.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const widthIn = layout.panel.w;
    const offsetIn = layout.binding === 'hardcover' ? layout.hinge : 0.32;
    const spineOnLeft = layout.input.readingDirection === 'ltr'; // viewing the front cover
    const px = (offsetIn / widthIn) * out.width;
    const x = spineOnLeft ? px : out.width - px;
    const w = Math.max(1.5, out.width * 0.0035);
    const dark = g.createLinearGradient(x - w * 2, 0, x + w * 2, 0);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.5, 'rgba(0,0,0,0.11)');
    dark.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = dark;
    g.fillRect(x - w * 2, 0, w * 4, out.height);
    return out;
  }

  function buildImages(layout: CoverLayout): PanelImages {
    const regions = wrapRegions(layout);
    let front: HTMLCanvasElement;
    let back: HTMLCanvasElement;
    let spine: HTMLCanvasElement;

    if (m.source === 'wrap') {
      const base = art?.canvas ?? sceneToCanvas(buildCoverScene(layout, { mode: 'template', dpi: 300 }), 120);
      front = cropRegion(base, regions.front);
      back = cropRegion(base, regions.back);
      spine = cropRegion(base, regions.spine, 2048);
    } else {
      const aspect = frontAspect(layout);
      const sample = sceneToCanvas(buildCoverScene(layout, { mode: 'template', dpi: 300 }), 120);
      front = art ? coverFit(art.canvas, aspect) : cropRegion(sample, regions.front);
      const edge = layout.input.readingDirection === 'ltr' ? { x: 0, y: 0, w: 0.04, h: 1 } : { x: 0.96, y: 0, w: 0.04, h: 1 };
      autoSpine = shade(averageColor(front, edge), 0.92);
      const color = customSpine ?? autoSpine;
      spine = solid(color);
      back = backArt ? coverFit(backArt.canvas, aspect) : solid(color, 256, Math.round(256 / aspect));
    }
    if (m.crease) front = addCrease(front, layout);
    return { front, back, spine };
  }

  async function rebuild(): Promise<void> {
    const layout = ctx.layout();
    if (!visible) return;
    const usable = !!layout && layout.valid;
    el.empty.hidden = usable;
    el.stage.hidden = !usable;
    if (!layout || !usable) return;
    const e = await ensureEngine();
    if (!e) return;
    resizeEngine();
    const images = buildImages(layout);
    const dims = bookDims(layout);
    const bg = getBackground(m.background);
    const frontEdge = averageColor(images.front, { x: 0, y: 0, w: 1, h: 1 });
    e.configure(
      dims,
      images,
      {
        glossy: m.finish === 'glossy',
        paperColor: pageEdgeColor(layout),
        shadow: m.shadow,
        background: { from: bg.from, to: bg.to },
        boardEdge: shade(frontEdge, 0.5),
      },
      m.pose,
    );
  }
  const scheduleRebuild = rafThrottle(() => void rebuild());

  // ---- refresh -----------------------------------------------------------------------------

  function refresh(): void {
    const layout = ctx.layout();
    const a = getAspect(m.aspect);
    el.stage.style.setProperty('--ar', String(a.w / a.h));
    // Photo backgrounds sit behind the transparent 3D canvas, cropped to the image shape (same crop as the export).
    const photo = photoFor(m.background, a.w / a.h);
    el.stage.style.backgroundImage = photo ? `url('${photo.url}')` : '';
    el.stage.style.backgroundSize = photo ? 'cover' : '';
    el.stage.style.backgroundPosition = photo ? 'center' : '';

    sourceSeg.sync();
    finishSeg.sync();
    formatSeg.sync();
    const transparent = getBackground(m.background).from === null && !photo;
    formatSeg.disable('jpg', transparent, 'JPG cannot be transparent');
    if (transparent && m.format === 'jpg') m.format = 'png';
    for (const b of el.pose.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === m.pose));
    for (const b of el.aspect.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === m.aspect));
    for (const b of el.bg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.v === m.background));
    el.shadow.checked = m.shadow;
    el.crease.checked = m.crease;
    el.size.value = String(m.longSide);
    for (const o of el.size.options) {
      const s = outputSize(m.aspect, Number(o.value));
      o.textContent = `${s.w} × ${s.h} px`;
    }

    el.sourceHint.textContent = SOURCE_HINT[m.source];
    el.backLabel.hidden = m.source !== 'front';
    el.spineField.hidden = m.source !== 'front';
    el.spineColor.value = customSpine ?? autoSpine;
    const names = [art && `Using ${art.name}`, backArt && `back: ${backArt.name}`].filter(Boolean);
    let note = names.length ? names.join(', ') : 'Showing your cover template as the artwork. Upload your own to see the real thing.';
    if (layout && art && m.source === 'wrap') {
      const expected = layout.canvas.w / layout.canvas.h;
      const rel = Math.abs(art.canvas.width / art.canvas.height - expected) / expected;
      if (rel > 0.01) note += ' This image is not the shape of a full-wrap cover for the book on the left, so the spine and panels may be misplaced. Check it on the Preflight tab.';
    }
    el.artName.textContent = note;

    const size = outputSize(m.aspect, m.longSide);
    const maxTex = engine?.maxTextureSize() ?? 4096;
    const tooBig = Math.max(size.w, size.h) > maxTex;
    el.download.disabled = !layout?.valid || engineFailed || tooBig;
    el.sizeHint.textContent = tooBig
      ? `This graphics card can draw images up to ${maxTex} px. Choose a smaller size.`
      : `${size.w} × ${size.h} px, ${getAspect(m.aspect).label.toLowerCase()}. ${transparent ? 'Transparent background; the shadow stays.' : ''}`;
    el.download.textContent = `Download mockup (${m.format.toUpperCase()})`;

    scheduleRebuild();
  }

  el.download.addEventListener('click', async () => {
    const layout = ctx.layout();
    if (!layout?.valid || !engine) return;
    const { w, h } = outputSize(m.aspect, m.longSide);
    try {
      const mime = m.format === 'png' ? 'image/png' : 'image/jpeg';
      const photo = photoFor(m.background, w / h);
      let blob: Blob;
      if (photo) {
        // Render the book on transparent, then lay it over the cropped photo.
        const [bookBlob, img] = await Promise.all([engine.exportImage(w, h, 'image/png'), loadImage(photo.url)]);
        const book = await createImageBitmap(bookBlob);
        const out = newCanvas(w, h);
        const g = out.getContext('2d')!;
        const c = coverCrop(img.naturalWidth, img.naturalHeight, w, h);
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, c.x, c.y, c.w, c.h, 0, 0, w, h);
        g.drawImage(book, 0, 0);
        blob = await new Promise<Blob>((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error('Image encoding failed.'))), mime, 0.92));
      } else blob = await engine.exportImage(w, h, mime, 0.92);
      const name = `kdp-book-mockup_${m.pose}_${m.background}_${m.aspect.replace(':', 'x')}_${w}x${h}.${m.format}`;
      const r = await saveFile(name, blob, blob.type);
      if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Mockup downloaded');
    } catch (err) {
      console.error(err);
      toast(`Could not create the mockup: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  return {
    id: 'mockup',
    refresh,
    activate: () => {
      visible = true;
      scheduleRebuild();
      requestAnimationFrame(resizeEngine);
    },
    deactivate: () => {
      visible = false;
    },
  };
}
