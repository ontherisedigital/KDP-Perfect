/**
 * ISBN barcodes: an EAN-13 symbol (Bookland, 978/979) with an optional EAN-5 price add-on, drawn as a
 * {@link Scene} so the SVG, PNG and PDF renderers can export it. Sizes follow GS1: 0.33 mm modules at
 * 100%, 11-module quiet zone on the left, 7 on the right.
 */

import type { Primitive, Scene } from './scene';

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const R = L.map((c) => [...c].map((b) => (b === '1' ? '0' : '1')).join(''));
/** G codes are the R codes reversed. */
const G = R.map((c) => [...c].reverse().join(''));
/** Which of the first six digits use the G set, by the leading digit. */
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
const ADDON_PARITY = ['GGLLL', 'GLGLL', 'GLLGL', 'GLLLG', 'LGGLL', 'LLGGL', 'LLLGG', 'LGLGL', 'LGLLG', 'LLGLG'];

export interface IsbnResult {
  ok: boolean;
  /** The 13-digit ISBN (converted from ISBN-10 when needed). */
  isbn13: string;
  error?: string;
}

function ean13Check(d12: string): number {
  const s = [...d12].reduce((a, ch, i) => a + Number(ch) * (i % 2 ? 3 : 1), 0);
  return (10 - (s % 10)) % 10;
}

/** Validate an ISBN-10 or ISBN-13 (hyphens and spaces allowed) and return it as 13 digits. */
export function parseIsbn(input: string): IsbnResult {
  const raw = input.replace(/[\s-]/g, '').toUpperCase().replace(/^ISBN:?/, '');
  if (/^\d{9}[\dX]$/.test(raw)) {
    const sum = [...raw].reduce((a, ch, i) => a + (ch === 'X' ? 10 : Number(ch)) * (10 - i), 0);
    if (raw.slice(0, 9).includes('X') || sum % 11) return { ok: false, isbn13: '', error: 'That ISBN-10 has a wrong check digit. Check for a typo.' };
    const d12 = `978${raw.slice(0, 9)}`;
    return { ok: true, isbn13: d12 + ean13Check(d12) };
  }
  if (/^\d{13}$/.test(raw)) {
    if (!/^97[89]/.test(raw)) return { ok: false, isbn13: '', error: 'A 13-digit ISBN starts with 978 or 979.' };
    if (ean13Check(raw.slice(0, 12)) !== Number(raw[12])) return { ok: false, isbn13: '', error: 'That ISBN has a wrong check digit (the last digit). Check for a typo.' };
    return { ok: true, isbn13: raw };
  }
  return { ok: false, isbn13: '', error: 'Enter a 10- or 13-digit ISBN.' };
}

/** 95 modules ('1' = bar) for a 13-digit code. */
export function ean13Modules(code: string): string {
  const d = [...code].map(Number);
  const par = PARITY[d[0]!]!;
  let s = '101';
  for (let i = 1; i <= 6; i++) s += (par[i - 1] === 'G' ? G : L)[d[i]!]!;
  s += '01010';
  for (let i = 7; i <= 12; i++) s += R[d[i]!]!;
  return s + '101';
}

/** Modules for the 5-digit add-on (price code). */
export function ean5Modules(code: string): string {
  const d = [...code].map(Number);
  const check = (3 * (d[0]! + d[2]! + d[4]!) + 9 * (d[1]! + d[3]!)) % 10;
  const par = ADDON_PARITY[check]!;
  return '1011' + d.map((x, i) => (par[i] === 'G' ? G : L)[x]!).join('01');
}

/** Price add-on from a price: US dollars become `5` + 4 digits; `90000` means "no suggested price". */
export function priceAddon(input: string): { ok: boolean; code: string; error?: string } {
  const t = input.trim();
  if (!t) return { ok: true, code: '' };
  if (/^\d{5}$/.test(t)) return { ok: true, code: t };
  const m = /^\$?(\d{1,2})(?:\.(\d{2}))?$/.exec(t);
  if (m) return { ok: true, code: `5${m[1]!.padStart(2, '0')}${m[2] ?? '00'}` };
  return { ok: false, code: '', error: 'Enter a US price such as 14.99, a 5-digit add-on such as 51499, or leave it empty.' };
}

export interface BarcodeOptions {
  /** 13-digit ISBN. */
  isbn13: string;
  /** Optional 5-digit add-on. */
  addon?: string;
  /** Magnification, 0.8 to 2 (1 = 100%). Default 0.85, usual for book covers (GS1 minimum is 0.8). */
  scale?: number;
}

/** The barcode as a scene, in inches, on a white background (as KDP and printers require). */
export function barcodeScene(o: BarcodeOptions): Scene {
  const k = o.scale ?? 0.85;
  const mod = 0.013 * k; // 0.33 mm
  const qL = 11 * mod;
  const qR = 7 * mod;
  const top = 0.2 * k; // room for the "ISBN ..." line
  const barH = 0.9 * k;
  const digit = 0.11 * k;
  const guardExtra = digit * 0.5; // guard bars reach down between the digit groups
  const main = ean13Modules(o.isbn13);
  const add = o.addon ? ean5Modules(o.addon) : '';
  const gap = add ? 9 * mod : 0;
  const width = qL + main.length * mod + (add ? gap + add.length * mod : 0) + qR;
  const height = top + barH + digit * 0.95;
  const items: Primitive[] = [];
  const guards = new Set([0, 1, 2, 45, 46, 47, 48, 49, 92, 93, 94]);
  const bars = (mods: string, x0: number, y: number, h: (i: number) => number) => {
    for (let i = 0; i < mods.length; ) {
      if (mods[i] !== '1') {
        i++;
        continue;
      }
      let j = i;
      while (j + 1 < mods.length && mods[j + 1] === '1' && h(j + 1) === h(i)) j++;
      items.push({ kind: 'rect', x: x0 + i * mod, y, w: (j - i + 1) * mod, h: h(i), fill: '#000000' });
      i = j + 1;
    }
  };
  bars(main, qL, top, (i) => (guards.has(i) ? barH + guardExtra : barH));
  const text = (x: number, y: number, t: string, size = digit, anchor: 'start' | 'middle' | 'end' = 'middle') =>
    items.push({ kind: 'text', x, y, text: t, size, fill: '#000000', anchor });
  const base = top + barH + digit * 0.82; // digits sit just under the short bars
  text(qL - 2 * mod, base, o.isbn13[0]!, digit, 'end');
  text(qL + (3 + 21) * mod, base, o.isbn13.slice(1, 7));
  text(qL + (50 + 21) * mod, base, o.isbn13.slice(7));
  const isbnLine = `ISBN ${o.isbn13.slice(0, 3)}-${o.isbn13.slice(3, 12)}-${o.isbn13[12]}`;
  text(qL + 47.5 * mod, top - 0.05 * k, isbnLine, 0.1 * k);
  if (add) {
    const ax = qL + main.length * mod + gap;
    const addTop = top + digit * 1.3;
    bars(add, ax, addTop, () => barH + guardExtra - digit * 1.3);
    text(ax + (add.length * mod) / 2, addTop - 0.03 * k, o.addon!);
  }
  return { width, height, background: '#FFFFFF', items };
}
