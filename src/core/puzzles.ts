/**
 * Puzzle generators for activity books: word search, crossword, maze and sudoku. Each is seeded, so the same
 * settings always give the same puzzle (a saved book rebuilds identically). Each renders a puzzle page and a solution
 * page as designer primitives inside a content box.
 */

import { linePath, rectPath, type Box } from './design/geometry';
import { PT, textPrim, type Prim } from './design/prims';

// --- seeded random -------------------------------------------------------------------------------

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(a: T[], r: () => number) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

/** Upper-case letters only (spaces and punctuation removed), for grids. */
export const cleanWord = (w: string) => w.toUpperCase().replace(/[^A-Z]/g, '');

// --- word search ------------------------------------------------------------------------------

export interface WordSearchOptions {
  words: string[];
  size: number;
  diagonal: boolean;
  backwards: boolean;
  seed: number;
}

export interface WordSearch {
  grid: string[][];
  placed: { word: string; r: number; c: number; dr: number; dc: number }[];
  /** Words that did not fit. */
  skipped: string[];
}

export function makeWordSearch(o: WordSearchOptions): WordSearch {
  const n = Math.max(5, Math.min(30, Math.round(o.size)));
  const r = rng(o.seed);
  const grid: string[][] = Array.from({ length: n }, () => Array(n).fill(''));
  const dirs: [number, number][] = [
    [0, 1],
    [1, 0],
  ];
  if (o.diagonal) dirs.push([1, 1], [-1, 1]);
  if (o.backwards) for (const [a, b] of [...dirs]) dirs.push([-a, -b]);
  const placed: WordSearch['placed'] = [];
  const skipped: string[] = [];
  const words = [...new Set(o.words.map(cleanWord).filter((w) => w.length >= 2))].sort((a, b) => b.length - a.length);
  for (const w of words) {
    let ok = false;
    for (let tries = 0; tries < 400 && !ok; tries++) {
      const [dr, dc] = dirs[Math.floor(r() * dirs.length)]!;
      const row = Math.floor(r() * n);
      const col = Math.floor(r() * n);
      const er = row + dr * (w.length - 1);
      const ec = col + dc * (w.length - 1);
      if (er < 0 || er >= n || ec < 0 || ec >= n) continue;
      let fits = true;
      for (let i = 0; i < w.length && fits; i++) {
        const cur = grid[row + dr * i]![col + dc * i]!;
        if (cur && cur !== w[i]) fits = false;
      }
      if (!fits) continue;
      for (let i = 0; i < w.length; i++) grid[row + dr * i]![col + dc * i] = w[i]!;
      placed.push({ word: w, r: row, c: col, dr, dc });
      ok = true;
    }
    if (!ok) skipped.push(w);
  }
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const row of grid) for (let c = 0; c < n; c++) if (!row[c]) row[c] = A[Math.floor(r() * 26)]!;
  return { grid, placed, skipped };
}

// --- crossword --------------------------------------------------------------------------------

export interface CrosswordEntry {
  answer: string;
  clue: string;
}
export interface Crossword {
  /** `null` = black square. */
  grid: (string | null)[][];
  numbers: (number | null)[][];
  across: { n: number; clue: string; answer: string }[];
  down: { n: number; clue: string; answer: string }[];
  skipped: string[];
}

interface Placed {
  w: string;
  clue: string;
  r: number;
  c: number;
  down: boolean;
}

/** Greedy crossword builder: places the longest word, then each next word where it crosses the most letters. */
export function makeCrossword(entries: CrosswordEntry[], seed: number, attempts = 30): Crossword {
  const list = entries.map((e) => ({ w: cleanWord(e.answer), clue: e.clue.trim() })).filter((e) => e.w.length >= 2);
  let best: { placed: Placed[]; skipped: string[]; score: number } | null = null;
  for (let a = 0; a < attempts; a++) {
    const r = rng(seed + a * 7919);
    const order = a === 0 ? [...list].sort((x, y) => y.w.length - x.w.length) : shuffle([...list], r).sort((x, y) => (r() < 0.6 ? y.w.length - x.w.length : 0));
    const res = buildCrossword(order, r);
    const box = bounds(res.placed);
    const score = res.placed.length * 1000 - box.w * box.h;
    if (!best || score > best.score) best = { ...res, score };
  }
  return finishCrossword(best!.placed, best!.skipped);
}

function buildCrossword(order: { w: string; clue: string }[], r: () => number): { placed: Placed[]; skipped: string[] } {
  const cells = new Map<string, string>();
  const key = (row: number, col: number) => `${row},${col}`;
  const placed: Placed[] = [];
  const skipped: string[] = [];
  const canPlace = (w: string, row: number, col: number, down: boolean): number => {
    let crossings = 0;
    const dr = down ? 1 : 0;
    const dc = down ? 0 : 1;
    if (cells.has(key(row - dr, col - dc)) || cells.has(key(row + dr * w.length, col + dc * w.length))) return -1;
    for (let i = 0; i < w.length; i++) {
      const rr = row + dr * i;
      const cc = col + dc * i;
      const cur = cells.get(key(rr, cc));
      if (cur) {
        if (cur !== w[i]) return -1;
        crossings++;
      } else {
        // No touching neighbours alongside (would create unintended words).
        if (cells.has(key(rr + dc, cc + dr)) || cells.has(key(rr - dc, cc - dr))) return -1;
      }
    }
    return crossings;
  };
  const put = (p: Placed) => {
    for (let i = 0; i < p.w.length; i++) cells.set(key(p.r + (p.down ? i : 0), p.c + (p.down ? 0 : i)), p.w[i]!);
    placed.push(p);
  };
  for (const e of order) {
    if (!placed.length) {
      put({ w: e.w, clue: e.clue, r: 0, c: 0, down: false });
      continue;
    }
    let bestP: Placed | null = null;
    let bestScore = 0;
    for (const p of placed)
      for (let i = 0; i < p.w.length; i++)
        for (let j = 0; j < e.w.length; j++) {
          if (p.w[i] !== e.w[j]) continue;
          const down = !p.down;
          const pr = p.r + (p.down ? i : 0);
          const pc = p.c + (p.down ? 0 : i);
          const row = down ? pr - j : pr;
          const col = down ? pc : pc - j;
          const sc = canPlace(e.w, row, col, down);
          if (sc > 0) {
            const v = sc + r() * 0.5;
            if (v > bestScore) {
              bestScore = v;
              bestP = { w: e.w, clue: e.clue, r: row, c: col, down };
            }
          }
        }
    if (bestP) put(bestP);
    else skipped.push(e.w);
  }
  return { placed, skipped };
}

function bounds(ps: Placed[]) {
  let r0 = Infinity;
  let c0 = Infinity;
  let r1 = -Infinity;
  let c1 = -Infinity;
  for (const p of ps) {
    r0 = Math.min(r0, p.r);
    c0 = Math.min(c0, p.c);
    r1 = Math.max(r1, p.r + (p.down ? p.w.length - 1 : 0));
    c1 = Math.max(c1, p.c + (p.down ? 0 : p.w.length - 1));
  }
  return { r0, c0, w: c1 - c0 + 1, h: r1 - r0 + 1 };
}

function finishCrossword(placed: Placed[], skipped: string[]): Crossword {
  const b = bounds(placed);
  const grid: (string | null)[][] = Array.from({ length: b.h }, () => Array(b.w).fill(null));
  for (const p of placed) for (let i = 0; i < p.w.length; i++) grid[p.r - b.r0 + (p.down ? i : 0)]![p.c - b.c0 + (p.down ? 0 : i)] = p.w[i]!;
  const numbers: (number | null)[][] = grid.map((row) => row.map(() => null));
  const starts = new Map<string, number>();
  let n = 0;
  for (let r = 0; r < b.h; r++)
    for (let c = 0; c < b.w; c++) {
      const isStart = placed.some((p) => p.r - b.r0 === r && p.c - b.c0 === c);
      if (isStart) {
        numbers[r]![c] = ++n;
        starts.set(`${r},${c}`, n);
      }
    }
  const across: Crossword['across'] = [];
  const down: Crossword['down'] = [];
  for (const p of placed) {
    const num = starts.get(`${p.r - b.r0},${p.c - b.c0}`)!;
    (p.down ? down : across).push({ n: num, clue: p.clue || '(no clue)', answer: p.w });
  }
  across.sort((x, y) => x.n - y.n);
  down.sort((x, y) => x.n - y.n);
  return { grid, numbers, across, down, skipped };
}

// --- maze --------------------------------------------------------------------------------------

export interface Maze {
  cols: number;
  rows: number;
  /** For each cell, open walls: bit 1 = north, 2 = east, 4 = south, 8 = west. */
  open: number[][];
  solution: [number, number][];
}

export function makeMaze(cols: number, rows: number, seed: number): Maze {
  cols = Math.max(4, Math.min(60, Math.round(cols)));
  rows = Math.max(4, Math.min(80, Math.round(rows)));
  const r = rng(seed);
  const open = Array.from({ length: rows }, () => Array(cols).fill(0) as number[]);
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false) as boolean[]);
  const stack: [number, number][] = [[0, 0]];
  seen[0]![0] = true;
  const D: [number, number, number, number][] = [
    [-1, 0, 1, 4],
    [0, 1, 2, 8],
    [1, 0, 4, 1],
    [0, -1, 8, 2],
  ];
  while (stack.length) {
    const [y, x] = stack[stack.length - 1]!;
    const next = shuffle([...D], r).find(([dy, dx]) => seen[y + dy]?.[x + dx] === false);
    if (!next) {
      stack.pop();
      continue;
    }
    const [dy, dx, a, b] = next;
    open[y]![x]! |= a;
    open[y + dy]![x + dx]! |= b;
    seen[y + dy]![x + dx] = true;
    stack.push([y + dy, x + dx]);
  }
  // Entrance top-left (north), exit bottom-right (south).
  open[0]![0]! |= 1;
  open[rows - 1]![cols - 1]! |= 4;
  // Solve by BFS.
  const prev = new Map<string, [number, number] | null>([['0,0', null]]);
  const q: [number, number][] = [[0, 0]];
  while (q.length) {
    const [y, x] = q.shift()!;
    if (y === rows - 1 && x === cols - 1) break;
    for (const [dy, dx, a] of D) {
      const ny = y + dy;
      const nx = x + dx;
      if (open[y]![x]! & a && ny >= 0 && nx >= 0 && ny < rows && nx < cols && !prev.has(`${ny},${nx}`)) {
        prev.set(`${ny},${nx}`, [y, x]);
        q.push([ny, nx]);
      }
    }
  }
  const solution: [number, number][] = [];
  let cur: [number, number] | null | undefined = [rows - 1, cols - 1];
  while (cur) {
    solution.unshift(cur);
    cur = prev.get(`${cur[0]},${cur[1]}`);
  }
  return { cols, rows, open, solution };
}

// --- sudoku ------------------------------------------------------------------------------------

export type Difficulty = 'easy' | 'medium' | 'hard';
const CLUES: Record<Difficulty, number> = { easy: 40, medium: 32, hard: 27 };

export interface Sudoku {
  puzzle: number[][];
  solution: number[][];
}

function solveCount(g: number[][], limit: number): number {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (!g[r]![c]) {
        let count = 0;
        for (let v = 1; v <= 9; v++)
          if (allowed(g, r, c, v)) {
            g[r]![c] = v;
            count += solveCount(g, limit - count);
            g[r]![c] = 0;
            if (count >= limit) return count;
          }
        return count;
      }
  return 1;
}
function allowed(g: number[][], r: number, c: number, v: number): boolean {
  for (let i = 0; i < 9; i++) if (g[r]![i] === v || g[i]![c] === v) return false;
  const br = r - (r % 3);
  const bc = c - (c % 3);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if (g[br + i]![bc + j] === v) return false;
  return true;
}

export function makeSudoku(difficulty: Difficulty, seed: number): Sudoku {
  const r = rng(seed);
  const g = Array.from({ length: 9 }, () => Array(9).fill(0) as number[]);
  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const row = Math.floor(i / 9);
    const col = i % 9;
    for (const v of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], r))
      if (allowed(g, row, col, v)) {
        g[row]![col] = v;
        if (fill(i + 1)) return true;
        g[row]![col] = 0;
      }
    return false;
  };
  fill(0);
  const solution = g.map((row) => [...row]);
  const puzzle = g.map((row) => [...row]);
  let clues = 81;
  for (const i of shuffle([...Array(81).keys()], r)) {
    if (clues <= CLUES[difficulty]) break;
    const row = Math.floor(i / 9);
    const col = i % 9;
    const keep = puzzle[row]![col]!;
    puzzle[row]![col] = 0;
    if (solveCount(puzzle.map((x) => [...x]), 2) !== 1) puzzle[row]![col] = keep;
    else clues--;
  }
  return { puzzle, solution };
}

// --- puzzle documents and rendering ---------------------------------------------------------

export type PuzzleType = 'wordsearch' | 'crossword' | 'maze' | 'sudoku';

export interface PuzzleSpec {
  id: string;
  type: PuzzleType;
  title: string;
  seed: number;
  /** Word search: one word per line. Crossword: `ANSWER - clue` per line. */
  words: string;
  size: number;
  diagonal: boolean;
  backwards: boolean;
  difficulty: Difficulty;
}

export const PUZZLE_TYPES: readonly { id: PuzzleType; label: string }[] = [
  { id: 'wordsearch', label: 'Word search' },
  { id: 'crossword', label: 'Crossword' },
  { id: 'maze', label: 'Maze' },
  { id: 'sudoku', label: 'Sudoku' },
];

export function parseCrosswordLines(text: string): CrosswordEntry[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(.+?)\s*(?:[-–—:|]|\t)\s*(.+)$/.exec(l);
      return m ? { answer: m[1]!, clue: m[2]! } : { answer: l, clue: '' };
    });
}

export type Generated =
  | { type: 'wordsearch'; ws: WordSearch }
  | { type: 'crossword'; cw: Crossword }
  | { type: 'maze'; maze: Maze }
  | { type: 'sudoku'; sd: Sudoku };

export function generate(p: PuzzleSpec): Generated {
  switch (p.type) {
    case 'wordsearch':
      return { type: 'wordsearch', ws: makeWordSearch({ words: p.words.split(/[\n,]/), size: p.size, diagonal: p.diagonal, backwards: p.backwards, seed: p.seed }) };
    case 'crossword':
      return { type: 'crossword', cw: makeCrossword(parseCrosswordLines(p.words), p.seed) };
    case 'maze':
      return { type: 'maze', maze: makeMaze(p.size, Math.round(p.size * 1.35), p.seed) };
    case 'sudoku':
      return { type: 'sudoku', sd: makeSudoku(p.difficulty, p.seed) };
  }
}

const INK = '#111111';
const SOFT = '#666666';

/** Draw a puzzle (or its solution) inside `box`. `compact` = small solution thumbnails (no word list/clues). */
export function puzzlePrims(p: PuzzleSpec, g: Generated, box: Box, solution: boolean, compact = false): Prim[] {
  const out: Prim[] = [];
  const titleSize = compact ? 11 : 20;
  const th = (titleSize * 1.6) / 72;
  out.push(textPrim({ x: box.x, y: box.y, w: box.w, h: th }, `${p.title}${solution && !compact ? ' (solution)' : ''}`, titleSize, { font: 'display', fill: INK, align: 'center' }));
  const area: Box = { x: box.x, y: box.y + th + 0.1, w: box.w, h: box.h - th - 0.1 };

  if (g.type === 'wordsearch') {
    const n = g.ws.grid.length;
    const listH = compact ? 0 : Math.min(area.h * 0.3, 0.3 + Math.ceil(g.ws.placed.length / 3) * 0.25);
    const cell = Math.min(area.w / n, (area.h - listH) / n);
    const gx = area.x + (area.w - cell * n) / 2;
    const gy = area.y;
    if (solution)
      for (const pl of g.ws.placed) {
        const x1 = gx + (pl.c + 0.5) * cell;
        const y1 = gy + (pl.r + 0.5) * cell;
        const x2 = gx + (pl.c + pl.dc * (pl.word.length - 1) + 0.5) * cell;
        const y2 = gy + (pl.r + pl.dr * (pl.word.length - 1) + 0.5) * cell;
        out.push({ k: 'path', path: linePath(x1, y1, x2, y2), stroke: '#bbbbbb', sw: cell * 0.7, round: true });
      }
    const fs = cell * 72 * 0.62;
    g.ws.grid.forEach((row, r) => row.forEach((ch, c) => out.push(textPrim({ x: gx + c * cell, y: gy + r * cell, w: cell, h: cell }, ch, fs, { font: 'body', fill: INK, align: 'center' }))));
    out.push({ k: 'path', path: rectPath(gx - 0.05, gy - 0.05, cell * n + 0.1, cell * n + 0.1, 0.06), stroke: INK, sw: PT });
    if (!compact) {
      const words = g.ws.placed.map((x) => x.word).sort();
      const cols = 3;
      const ly = gy + cell * n + 0.25;
      const rh = Math.min(0.25, (area.y + area.h - ly) / Math.ceil(words.length / cols));
      words.forEach((w, i) =>
        out.push(textPrim({ x: area.x + (i % cols) * (area.w / cols), y: ly + Math.floor(i / cols) * rh, w: area.w / cols, h: rh }, w, Math.min(11, rh * 72 * 0.7), { font: 'body', fill: INK, align: 'center' })),
      );
    }
  } else if (g.type === 'crossword') {
    const cw = g.cw;
    const rows = cw.grid.length;
    const cols = cw.grid[0]?.length ?? 1;
    const clueH = compact ? 0 : area.h * 0.42;
    const cell = Math.min(area.w / cols, (area.h - clueH) / rows, 0.45);
    const gx = area.x + (area.w - cell * cols) / 2;
    const gy = area.y;
    cw.grid.forEach((row, r) =>
      row.forEach((ch, c) => {
        if (ch === null) return;
        const x = gx + c * cell;
        const y = gy + r * cell;
        out.push({ k: 'path', path: rectPath(x, y, cell, cell), fill: '#ffffff', stroke: INK, sw: 0.8 * PT });
        const num = cw.numbers[r]![c];
        if (num && !compact) out.push(textPrim({ x: x + 0.02, y: y + 0.01, w: cell, h: cell * 0.35 }, String(num), Math.max(5, cell * 72 * 0.24), { font: 'body', fill: INK, valign: 'top' }));
        if (solution) out.push(textPrim({ x, y: y + cell * 0.1, w: cell, h: cell }, ch, cell * 72 * 0.55, { font: 'body', fill: INK, align: 'center' }));
      }),
    );
    if (!compact) {
      const top = gy + cell * rows + 0.25;
      const half = (area.w - 0.2) / 2;
      const list = (title: string, items: { n: number; clue: string }[], x: number) => {
        out.push(textPrim({ x, y: top, w: half, h: 0.28 }, title, 12, { font: 'display', fill: INK }));
        const avail = area.y + area.h - top - 0.32;
        const fs = Math.max(6.5, Math.min(10, (avail / Math.max(1, items.length)) * 72 * 0.62));
        items.forEach((it, i) => out.push(textPrim({ x, y: top + 0.32 + (i * fs * 1.45) / 72, w: half, h: (fs * 1.45) / 72 }, `${it.n}. ${it.clue}`, fs, { font: 'body', fill: INK, valign: 'top' })));
      };
      list('Across', cw.across, area.x);
      list('Down', cw.down, area.x + half + 0.2);
    }
  } else if (g.type === 'maze') {
    const m = g.maze;
    const cell = Math.min(area.w / m.cols, area.h / m.rows);
    const gx = area.x + (area.w - cell * m.cols) / 2;
    const gy = area.y + (area.h - cell * m.rows) / 2;
    const sw = Math.max(0.6, Math.min(2, cell * 72 * 0.08)) * PT;
    if (solution) {
      const path = m.solution.map(([r, c], i) => [i ? 'L' : 'M', gx + (c + 0.5) * cell, gy + (r + 0.5) * cell] as ['L', number, number]);
      out.push({ k: 'path', path, stroke: '#999999', sw: cell * 0.35, round: true });
    }
    for (let r = 0; r < m.rows; r++)
      for (let c = 0; c < m.cols; c++) {
        const o = m.open[r]![c]!;
        const x = gx + c * cell;
        const y = gy + r * cell;
        if (!(o & 1)) out.push({ k: 'path', path: linePath(x, y, x + cell, y), stroke: INK, sw, round: true });
        if (!(o & 8)) out.push({ k: 'path', path: linePath(x, y, x, y + cell), stroke: INK, sw, round: true });
        if (c === m.cols - 1 && !(o & 2)) out.push({ k: 'path', path: linePath(x + cell, y, x + cell, y + cell), stroke: INK, sw, round: true });
        if (r === m.rows - 1 && !(o & 4)) out.push({ k: 'path', path: linePath(x, y + cell, x + cell, y + cell), stroke: INK, sw, round: true });
      }
    if (!compact) {
      out.push(textPrim({ x: gx - 0.6, y: gy - 0.32, w: 1.2 + cell, h: 0.25 }, 'Start', 9, { font: 'body', fill: SOFT, align: 'center' }));
      out.push(textPrim({ x: gx + cell * (m.cols - 1) - 0.6, y: gy + cell * m.rows + 0.06, w: 1.2 + cell, h: 0.25 }, 'Finish', 9, { font: 'body', fill: SOFT, align: 'center' }));
    }
  } else {
    const sd = g.sd;
    const cell = Math.min(area.w, area.h) / 9;
    const gx = area.x + (area.w - cell * 9) / 2;
    const gy = area.y + (area.h - cell * 9) / 2;
    for (let i = 0; i <= 9; i++) {
      const w = (i % 3 === 0 ? 2 : 0.6) * PT;
      out.push({ k: 'path', path: linePath(gx, gy + i * cell, gx + 9 * cell, gy + i * cell), stroke: INK, sw: w });
      out.push({ k: 'path', path: linePath(gx + i * cell, gy, gx + i * cell, gy + 9 * cell), stroke: INK, sw: w });
    }
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 9; c++) {
        const given = sd.puzzle[r]![c]!;
        const v = given || (solution ? sd.solution[r]![c]! : 0);
        if (v) out.push(textPrim({ x: gx + c * cell, y: gy + r * cell, w: cell, h: cell }, String(v), cell * 72 * 0.55, { font: given ? 'display' : 'body', fill: given ? INK : SOFT, align: 'center' }));
      }
  }
  return out;
}
