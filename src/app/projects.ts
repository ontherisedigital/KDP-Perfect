/**
 * Saved book projects. A project is a snapshot of the settings on every tab, the Page designer document
 * and the puzzle book, kept in localStorage. Opening one writes it back and reloads the app, so every
 * screen starts cleanly from it. Project files (for backup or another computer) carry their images.
 */

import { imagesUsed, isProject, isProjectFile, newProjectId, PROJECT_FORMAT, uniqueName, type Project, type ProjectFile, type ProjectSnapshot } from '../core';
import { DOC_KEY, design, restoreImage } from './designStore';
import { esc, toast } from './dom';
import { saveFile } from './files';
import { PUZZLES_KEY } from './puzzleStore';
import { STATE_KEY } from './state';

const LIST_KEY = 'selfpublisher-studio.projects.v1';
const CURRENT_KEY = 'selfpublisher-studio.project.current';
const SNAPSHOT_KEYS = { state: STATE_KEY, design: DOC_KEY, puzzles: PUZZLES_KEY } as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function list(): Project[] {
  const l = read<unknown[]>(LIST_KEY, []);
  return Array.isArray(l) ? l.filter(isProject) : [];
}

function writeList(l: Project[]): boolean {
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(l));
    return true;
  } catch {
    toast('Could not save: this computer’s app storage is full. Export a project file and delete old projects.');
    return false;
  }
}

const currentId = () => localStorage.getItem(CURRENT_KEY);
const setCurrent = (id: string | null) => (id ? localStorage.setItem(CURRENT_KEY, id) : localStorage.removeItem(CURRENT_KEY));

function snapshot(): ProjectSnapshot {
  return { state: read(SNAPSHOT_KEYS.state, null), design: read(SNAPSHOT_KEYS.design, null), puzzles: read(SNAPSHOT_KEYS.puzzles, null) };
}

const same = (a: ProjectSnapshot, b: ProjectSnapshot) => JSON.stringify([a.state, a.design, a.puzzles]) === JSON.stringify([b.state, b.design, b.puzzles]);

function suggestedName(): string {
  const s = snapshot().state as { interior?: { title?: string }; trimId?: string; binding?: string } | null;
  return s?.interior?.title?.trim() || `${s?.binding === 'hardcover' ? 'Hardcover' : 'Paperback'} ${s?.trimId ?? ''}`.trim();
}

/** Write a project into the app's storage and reload. */
function openProject(p: Project): void {
  for (const [k, key] of Object.entries(SNAPSHOT_KEYS)) {
    const v = p[k as keyof ProjectSnapshot];
    if (v === null || v === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  }
  setCurrent(p.id);
  location.reload();
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

async function exportProject(p: Project): Promise<void> {
  const stored = design.images();
  const used = new Set(imagesUsed(p, stored.map((i) => i.id)));
  const file: ProjectFile = {
    format: PROJECT_FORMAT,
    version: 1,
    project: p,
    images: stored.filter((i) => used.has(i.id)).map((i) => ({ id: i.id, name: i.name, type: i.type, widthPx: i.widthPx, heightPx: i.heightPx, data: b64(i.bytes) })),
  };
  const safe = p.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'book';
  const r = await saveFile(`${safe}.sps-project.json`, JSON.stringify(file), 'application/json');
  if (r.saved) toast(r.path ? `Saved ${r.path}` : 'Project file downloaded');
}

async function importProject(file: File): Promise<Project | null> {
  try {
    const data = JSON.parse(await file.text()) as unknown;
    if (!isProjectFile(data)) throw new Error('bad');
    for (const im of data.images) {
      const bytes = Uint8Array.from(atob(im.data), (c) => c.charCodeAt(0));
      await restoreImage({ id: im.id, name: im.name, type: im.type, widthPx: im.widthPx, heightPx: im.heightPx, bytes });
    }
    const l = list();
    const p: Project = { ...data.project, id: l.some((x) => x.id === data.project.id) ? newProjectId() : data.project.id, name: uniqueName(data.project.name, l.map((x) => x.name)) };
    l.unshift(p);
    return writeList(l) ? p : null;
  } catch {
    toast('That file is not a SelfPublisher Studio project file.');
    return null;
  }
}

let dialog: HTMLDialogElement | null = null;

function render(d: HTMLDialogElement): void {
  const l = list();
  const cur = l.find((p) => p.id === currentId()) ?? null;
  const dirty = cur ? !same(cur, snapshot()) : true;
  const body = d.querySelector('.projects-body')!;
  body.innerHTML = `
    <div class="projects-current">
      <strong>${cur ? esc(cur.name) : 'Unsaved book'}</strong>
      ${cur ? `<button type="button" class="btn primary small" data-act="save" ${dirty ? '' : 'disabled'}>${dirty ? 'Save changes' : 'Saved'}</button>` : ''}
      <button type="button" class="btn small${cur ? '' : ' primary'}" data-act="save-as">${cur ? 'Save as new…' : 'Save this book…'}</button>
      <button type="button" class="btn small subtle" data-act="new">New book</button>
    </div>
    <p class="hint">A project keeps everything for one book: the book details, every tab's settings, the Page designer pages and the puzzles. Uploaded covers and coloring pages are not kept; add them again when you need them.</p>
    ${
      l.length
        ? `<ul class="project-list">${l
            .map(
              (p) => `<li class="project-row${p.id === cur?.id ? ' current' : ''}" data-id="${esc(p.id)}">
                <div class="meta"><b>${esc(p.name)}</b><span>Saved ${esc(fmtDate(p.savedAt))}</span></div>
                ${p.id === cur?.id ? '<span class="hint">Open now</span>' : '<button type="button" class="btn small" data-act="open">Open</button>'}
                <button type="button" class="btn small subtle" data-act="rename">Rename</button>
                <button type="button" class="btn small subtle" data-act="export" title="Save a file for backup or another computer">Export</button>
                <button type="button" class="btn small subtle" data-act="delete" aria-label="Delete ${esc(p.name)}">Delete</button>
              </li>`,
            )
            .join('')}</ul>`
        : '<p class="hint">No saved books yet.</p>'
    }
    <div class="btn-row wide"><label class="btn file subtle" for="projects-import">Open a project file…<input id="projects-import" type="file" accept="application/json,.json" /></label></div>`;
  body.querySelector<HTMLInputElement>('#projects-import')!.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const p = await importProject(f);
    if (p) {
      toast(`Added "${p.name}"`);
      render(d);
    }
  });
}

/** Ask for a name inside the dialog (Electron has no window.prompt). */
function askName(d: HTMLDialogElement, label: string, value: string): Promise<string | null> {
  const body = d.querySelector('.projects-body')!;
  body.innerHTML = `<form class="field" id="projects-name-form">
      <label for="projects-name-input">${esc(label)}</label>
      <input id="projects-name-input" type="text" maxlength="120" value="${esc(value)}" />
      <div class="btn-row wide"><button type="submit" class="btn primary">Save</button><button type="button" class="btn subtle" data-cancel>Cancel</button></div>
    </form>`;
  const form = body.querySelector<HTMLFormElement>('form')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  input.focus();
  input.select();
  return new Promise((resolve) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      resolve(input.value.trim() || null);
    });
    form.querySelector('[data-cancel]')!.addEventListener('click', (e) => {
      e.stopPropagation();
      resolve(null);
    });
  });
}

async function act(d: HTMLDialogElement, action: string, id: string | undefined): Promise<void> {
  const l = list();
  const cur = l.find((p) => p.id === currentId()) ?? null;
  const target = l.find((p) => p.id === id);
  const now = new Date().toISOString();
  switch (action) {
    case 'save': {
      if (!cur) return;
      Object.assign(cur, snapshot(), { savedAt: now });
      if (writeList(l)) toast(`Saved "${cur.name}"`);
      break;
    }
    case 'save-as': {
      const name = await askName(d, 'Name this book', uniqueName(suggestedName(), l.map((p) => p.name)));
      if (name === null) break;
      const p: Project = { id: newProjectId(), name: uniqueName(name, l.map((x) => x.name)), savedAt: now, ...snapshot() };
      l.unshift(p);
      if (writeList(l)) {
        setCurrent(p.id);
        toast(`Saved "${p.name}"`);
      }
      break;
    }
    case 'new': {
      if (cur && !same(cur, snapshot()) && !confirm(`Start a new book? Unsaved changes to "${cur.name}" will be lost.`)) return;
      if (!cur && !confirm('Start a new book? This book has not been saved and will be cleared.')) return;
      for (const key of Object.values(SNAPSHOT_KEYS)) localStorage.removeItem(key);
      setCurrent(null);
      location.reload();
      return;
    }
    case 'open': {
      if (!target) return;
      const unsaved = cur ? !same(cur, snapshot()) : true;
      if (unsaved && !confirm(`Open "${target.name}"? ${cur ? `Unsaved changes to "${cur.name}"` : 'This unsaved book'} will be replaced.`)) return;
      openProject(target);
      return;
    }
    case 'rename': {
      if (!target) return;
      const name = await askName(d, 'Rename this book', target.name);
      if (!name) break;
      target.name = uniqueName(name, l.filter((p) => p !== target).map((p) => p.name));
      writeList(l);
      break;
    }
    case 'export':
      if (target) void exportProject(target);
      return;
    case 'delete': {
      if (!target || !confirm(`Delete "${target.name}"? This cannot be undone. Export it first if you may want it back.`)) return;
      writeList(l.filter((p) => p !== target));
      if (target.id === cur?.id) setCurrent(null);
      break;
    }
  }
  render(d);
  updateButton();
}

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'guide projects glass';
  d.setAttribute('aria-labelledby', 'projects-title');
  d.innerHTML = `
    <header class="guide-head">
      <h2 id="projects-title">Book projects</h2>
      <button type="button" class="btn small subtle guide-close" aria-label="Close">✕</button>
    </header>
    <div class="projects-body"></div>`;
  d.addEventListener('click', (e) => {
    if (e.target === d || (e.target as HTMLElement).closest('.guide-close')) return d.close();
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (b) void act(d, b.dataset.act!, b.closest<HTMLElement>('[data-id]')?.dataset.id);
  });
  document.body.appendChild(d);
  return d;
}

function updateButton(): void {
  const el = document.getElementById('projects-name');
  if (!el) return;
  const cur = list().find((p) => p.id === currentId());
  el.textContent = cur ? cur.name : 'Projects';
}

export function openProjects(): void {
  dialog ??= build();
  render(dialog);
  if (!dialog.open) dialog.showModal();
}

export function initProjects(): void {
  document.getElementById('projects-btn')?.addEventListener('click', openProjects);
  updateButton();
}
