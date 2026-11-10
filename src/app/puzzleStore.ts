/** The puzzle book: its puzzles and how answers are printed. Kept in localStorage; shared with the Interior tab. */

import { generate, puzzlePrims, type Box, type Generated, type Prim, type PuzzleSpec, type PuzzleType } from '../core';

export type SolutionLayout = 'none' | 'one' | 'four';

interface Book {
  puzzles: PuzzleSpec[];
  solutions: SolutionLayout;
}

const KEY = 'selfpublisher-studio.puzzles.v1';
let book: Book = load();
const cache = new Map<string, { sig: string; g: Generated }>();
const listeners = new Set<() => void>();

function load(): Book {
  try {
    const b = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Book | null;
    if (b && Array.isArray(b.puzzles)) return { puzzles: b.puzzles, solutions: ['none', 'one', 'four'].includes(b.solutions) ? b.solutions : 'four' };
  } catch {
    // start fresh
  }
  return { puzzles: [], solutions: 'four' };
}

export const puzzles = {
  get book(): Book {
    return book;
  },
  changed(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(book));
    } catch {
      // ignore
    }
    for (const l of listeners) l();
  },
  onChange(fn: () => void): void {
    listeners.add(fn);
  },
  /** The generated puzzle (cached until its settings change). */
  generated(p: PuzzleSpec): Generated {
    const sig = JSON.stringify(p);
    const hit = cache.get(p.id);
    if (hit && hit.sig === sig) return hit.g;
    const g = generate(p);
    cache.set(p.id, { sig, g });
    return g;
  },
  add(type: PuzzleType): PuzzleSpec {
    const n = book.puzzles.filter((x) => x.type === type).length + 1;
    const label = { wordsearch: 'Word search', crossword: 'Crossword', maze: 'Maze', sudoku: 'Sudoku' }[type];
    const p: PuzzleSpec = {
      id: `z${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      type,
      title: `${label} ${n}`,
      seed: Math.floor(Math.random() * 1e9),
      words:
        type === 'crossword'
          ? 'OCEAN - Very large body of salt water\nWHALE - Largest animal on Earth\nCORAL - Reef builder\nSHARK - Fish with rows of teeth\nTURTLE - Reptile with a shell\nCRAB - Walks sideways\nKELP - Underwater forest plant\nOTTER - Floats on its back'
          : type === 'wordsearch'
            ? 'OCEAN\nWHALE\nDOLPHIN\nCORAL\nSHARK\nTURTLE\nSEAHORSE\nCRAB\nKELP\nOTTER'
            : '',
      size: type === 'maze' ? 14 : 14,
      diagonal: true,
      backwards: false,
      difficulty: 'medium',
    };
    book.puzzles.push(p);
    puzzles.changed();
    return p;
  },
  /** Pages of the book: one per puzzle, then the answer pages. */
  pageCount(): number {
    const n = book.puzzles.length;
    if (!n || book.solutions === 'none') return n;
    return n + (book.solutions === 'one' ? n : Math.ceil(n / 4));
  },
  /** Primitives for book page `index` inside the content `box`. */
  pagePrims(index: number, box: Box): Prim[] {
    const ps = book.puzzles;
    if (index < ps.length) return puzzlePrims(ps[index]!, puzzles.generated(ps[index]!), box, false);
    const k = index - ps.length;
    if (book.solutions === 'one') {
      const p = ps[k];
      return p ? puzzlePrims(p, puzzles.generated(p), box, true) : [];
    }
    // Four answers per page, in a 2 x 2 grid.
    const out: Prim[] = [];
    const w = (box.w - 0.3) / 2;
    const h = (box.h - 0.3) / 2;
    for (let i = 0; i < 4; i++) {
      const p = ps[k * 4 + i];
      if (!p) break;
      out.push(...puzzlePrims(p, puzzles.generated(p), { x: box.x + (i % 2) * (w + 0.3), y: box.y + Math.floor(i / 2) * (h + 0.3), w, h }, true, true));
    }
    return out;
  },
};
