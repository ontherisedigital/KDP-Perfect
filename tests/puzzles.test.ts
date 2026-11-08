import { describe, expect, it } from 'vitest';
import { generate, makeCrossword, makeMaze, makeSudoku, makeWordSearch, puzzlePrims, type PuzzleSpec } from '../src/core';

const WORDS = ['OCEAN', 'WHALE', 'DOLPHIN', 'CORAL', 'SHARK', 'TURTLE', 'SEAHORSE', 'CRAB', 'KELP', 'OTTER'];

describe('word search', () => {
  it('places every word where it reads correctly', () => {
    const ws = makeWordSearch({ words: WORDS, size: 14, diagonal: true, backwards: true, seed: 7 });
    expect(ws.skipped).toEqual([]);
    for (const p of ws.placed) {
      const read = [...p.word].map((_, i) => ws.grid[p.r + p.dr * i]![p.c + p.dc * i]).join('');
      expect(read).toBe(p.word);
    }
    expect(ws.grid.flat().every((ch) => /^[A-Z]$/.test(ch))).toBe(true);
  });

  it('is repeatable for a seed', () => {
    const a = makeWordSearch({ words: WORDS, size: 12, diagonal: false, backwards: false, seed: 3 });
    const b = makeWordSearch({ words: WORDS, size: 12, diagonal: false, backwards: false, seed: 3 });
    expect(a.grid).toEqual(b.grid);
  });
});

describe('crossword', () => {
  it('builds a connected grid whose answers read back from the cells', () => {
    const cw = makeCrossword(WORDS.map((w) => ({ answer: w, clue: `Clue for ${w}` })), 11);
    expect(cw.across.length + cw.down.length).toBeGreaterThanOrEqual(7);
    const at = (n: number) => {
      for (let r = 0; r < cw.numbers.length; r++) for (let c = 0; c < cw.numbers[r]!.length; c++) if (cw.numbers[r]![c] === n) return [r, c] as const;
      throw new Error('missing number');
    };
    for (const a of cw.across) {
      const [r, c] = at(a.n);
      expect([...a.answer].map((_, i) => cw.grid[r]![c + i]).join('')).toBe(a.answer);
      expect(cw.grid[r]![c + a.answer.length] ?? null).toBeNull();
    }
    for (const d of cw.down) {
      const [r, c] = at(d.n);
      expect([...d.answer].map((_, i) => cw.grid[r + i]![c]).join('')).toBe(d.answer);
    }
  });
});

describe('maze', () => {
  it('has a solution from the top-left to the bottom-right through open walls', () => {
    const m = makeMaze(12, 16, 5);
    expect(m.solution[0]).toEqual([0, 0]);
    expect(m.solution.at(-1)).toEqual([15, 11]);
    for (let i = 1; i < m.solution.length; i++) {
      const [r0, c0] = m.solution[i - 1]!;
      const [r1, c1] = m.solution[i]!;
      const bit = r1 < r0 ? 1 : c1 > c0 ? 2 : r1 > r0 ? 4 : 8;
      expect(m.open[r0]![c0]! & bit).toBeTruthy();
    }
  });
});

describe('sudoku', () => {
  it('is a valid grid with the right number of clues', () => {
    const s = makeSudoku('medium', 9);
    for (let i = 0; i < 9; i++) {
      expect(new Set(s.solution[i]).size).toBe(9);
      expect(new Set(s.solution.map((r) => r[i])).size).toBe(9);
    }
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (s.puzzle[r]![c]) expect(s.puzzle[r]![c]).toBe(s.solution[r]![c]);
    expect(s.puzzle.flat().filter(Boolean).length).toBeLessThanOrEqual(40);
  });
});

describe('rendering', () => {
  it('every puzzle type renders a page and a solution', () => {
    for (const type of ['wordsearch', 'crossword', 'maze', 'sudoku'] as const) {
      const spec: PuzzleSpec = { id: 'x', type, title: 'Test', seed: 1, words: WORDS.map((w) => `${w} - clue`).join('\n'), size: 12, diagonal: true, backwards: false, difficulty: 'easy' };
      const g = generate(spec);
      const box = { x: 0.5, y: 0.5, w: 5, h: 8 };
      expect(puzzlePrims(spec, g, box, false).length, type).toBeGreaterThan(10);
      expect(puzzlePrims(spec, g, box, true).length, type).toBeGreaterThan(10);
    }
  });
});
