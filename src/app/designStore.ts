/**
 * The page designer's document and uploaded images, shared by the Page designer and Interior screens.
 * The document is kept in localStorage; images (too big for it) in IndexedDB. Both stay on this computer.
 */

import { isDesignDoc, newDoc, type DesignDoc } from '../core';
import { readImage } from './media';

export interface StoredImage {
  id: string;
  name: string;
  type: 'png' | 'jpg';
  bytes: Uint8Array;
  widthPx: number;
  heightPx: number;
  url: string;
}

export const DOC_KEY = 'selfpublisher-studio.design.v1';
const DB_NAME = 'selfpublisher-studio';
const STORE = 'images';

let doc: DesignDoc = load();
const images = new Map<string, StoredImage>();
const listeners = new Set<() => void>();

function load(): DesignDoc {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) {
      const d = JSON.parse(raw) as unknown;
      if (isDesignDoc(d)) return d;
    }
  } catch {
    // ignore: start fresh
  }
  return newDoc();
}

export const design = {
  get doc(): DesignDoc {
    return doc;
  },
  /** Replace the whole document (undo, load from file). */
  set(d: DesignDoc): void {
    doc = d;
    design.changed();
  },
  /** Persist and notify. Call after any in-place change. */
  changed(): void {
    try {
      localStorage.setItem(DOC_KEY, JSON.stringify(doc));
    } catch {
      // storage full or blocked: keep working in memory
    }
    for (const l of listeners) l();
  },
  onChange(fn: () => void): void {
    listeners.add(fn);
  },
  image: (id: string) => images.get(id),
  images: () => [...images.values()],
  url: (id: string) => images.get(id)?.url,
};

// --- IndexedDB ---------------------------------------------------------------------------------

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

type Row = Omit<StoredImage, 'url'>;
const blobOf = (r: Row) => new Blob([r.bytes as BlobPart], { type: r.type === 'png' ? 'image/png' : 'image/jpeg' });

/** Load saved images (call once at start-up). Missing IndexedDB just means images aren't remembered. */
export async function loadImages(): Promise<void> {
  try {
    const rows = await tx<Row[]>('readonly', (s) => s.getAll() as IDBRequest<Row[]>);
    for (const r of rows) images.set(r.id, { ...r, url: URL.createObjectURL(blobOf(r)) });
    for (const l of listeners) l();
  } catch {
    // private window or blocked storage
  }
}

export async function addImage(file: File): Promise<StoredImage> {
  const img = await readImage(file);
  const id = `img${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const s: StoredImage = { id, name: img.name, type: img.type, bytes: img.bytes, widthPx: img.widthPx, heightPx: img.heightPx, url: img.url };
  images.set(id, s);
  try {
    const { url: _url, ...row } = s;
    await tx('readwrite', (st) => st.put(row));
  } catch {
    // not persisted; still usable this session
  }
  for (const l of listeners) l();
  return s;
}

export async function removeImage(id: string): Promise<void> {
  const s = images.get(id);
  if (s) URL.revokeObjectURL(s.url);
  images.delete(id);
  try {
    await tx('readwrite', (st) => st.delete(id));
  } catch {
    // ignore
  }
  for (const l of listeners) l();
}

/** Put an image back under its own id (opening a project file). Does nothing if it is already here. */
export async function restoreImage(row: Omit<StoredImage, 'url'>): Promise<void> {
  if (images.has(row.id)) return;
  images.set(row.id, { ...row, url: URL.createObjectURL(blobOf(row)) });
  try {
    await tx('readwrite', (st) => st.put(row));
  } catch {
    // not persisted
  }
}
