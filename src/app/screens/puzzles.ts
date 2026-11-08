/** Puzzles tab: build word searches, crosswords, mazes and sudoku for a puzzle book. Separate from the Page designer. */

import { CUSTOM_TRIM_ID, PUZZLE_TYPES, contentBox, getTrimSize, interiorLayout, primsToSvg, puzzlePrims, type PuzzleSpec, type PuzzleType } from '../../core';
import type { Ctx, Screen } from '../context';
import { $, esc, segment } from '../dom';
import { measureText } from '../media';
import { puzzles, type SolutionLayout } from '../puzzleStore';

const PX = 60;

export function initPuzzlesScreen(ctx: Ctx & { show(id: 'interior'): void }): Screen {
  let selected: string | null = puzzles.book.puzzles[0]?.id ?? null;
  let showSolution = false;

  const el = {
    primary: $('pz-primary'),
    add: $('pz-add'),
    list: $('pz-list'),
    editor: $('pz-editor'),
    editorTitle: $('pz-editor-title'),
    title: $<HTMLInputElement>('pz-title'),
    wordsField: $('pz-words-field'),
    wordsLabel: $('pz-words-label'),
    words: $<HTMLTextAreaElement>('pz-words'),
    wordsHint: $('pz-words-hint'),
    sizeField: $('pz-size-field'),
    sizeLabel: $('pz-size-label'),
    size: $<HTMLInputElement>('pz-size'),
    diffField: $('pz-diff-field'),
    diff: $<HTMLSelectElement>('pz-diff'),
    wsOpts: $('pz-ws-opts'),
    diag: $<HTMLInputElement>('pz-diag'),
    back: $<HTMLInputElement>('pz-back'),
    messages: $('pz-messages'),
    shuffle: $<HTMLButtonElement>('pz-shuffle'),
    showSol: $<HTMLButtonElement>('pz-show-sol'),
    preview: $('pz-preview'),
    toInterior: $<HTMLButtonElement>('pz-to-interior'),
  };

  el.add.innerHTML = PUZZLE_TYPES.map((t) => `<button type="button" class="btn subtle" data-type="${t.id}">+ ${t.label}</button>`).join('');
  el.add.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
    if (!b) return;
    selected = puzzles.add(b.dataset.type as PuzzleType).id;
    showSolution = false;
    refresh();
  });

  const solSeg = segment<SolutionLayout>(
    $('pz-solutions'),
    [
      { value: 'four', label: '4 answers per page' },
      { value: 'one', label: '1 per page' },
      { value: 'none', label: 'No answers' },
    ],
    () => puzzles.book.solutions,
    (v) => {
      puzzles.book.solutions = v;
      puzzles.changed();
      refresh();
    },
  );

  const cur = (): PuzzleSpec | undefined => puzzles.book.puzzles.find((p) => p.id === selected);
  const set = (fn: (p: PuzzleSpec) => void) => {
    const p = cur();
    if (!p) return;
    fn(p);
    puzzles.changed();
    renderList();
    renderPreview();
  };
  el.title.addEventListener('input', () => set((p) => (p.title = el.title.value)));
  el.words.addEventListener('input', () => set((p) => (p.words = el.words.value)));
  el.size.addEventListener('input', () => {
    const v = el.size.valueAsNumber;
    if (Number.isFinite(v)) set((p) => (p.size = Math.max(5, Math.min(p.type === 'maze' ? 50 : 30, Math.round(v)))));
  });
  el.diff.addEventListener('change', () => set((p) => (p.difficulty = el.diff.value as PuzzleSpec['difficulty'])));
  el.diag.addEventListener('change', () => set((p) => (p.diagonal = el.diag.checked)));
  el.back.addEventListener('change', () => set((p) => (p.backwards = el.back.checked)));
  el.shuffle.addEventListener('click', () => set((p) => (p.seed = Math.floor(Math.random() * 1e9))));
  el.showSol.addEventListener('click', () => {
    showSolution = !showSolution;
    renderPreview();
  });

  el.list.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const li = t.closest<HTMLElement>('[data-id]');
    if (!li) return;
    const ps = puzzles.book.puzzles;
    const i = ps.findIndex((p) => p.id === li.dataset.id);
    const act = t.closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'remove') {
      ps.splice(i, 1);
      if (selected === li.dataset.id) selected = ps[0]?.id ?? null;
    } else if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < ps.length) [ps[i], ps[j]] = [ps[j]!, ps[i]!];
    } else if (act === 'dup') {
      const c = { ...ps[i]!, id: `z${Date.now().toString(36)}`, title: `${ps[i]!.title} copy`, seed: Math.floor(Math.random() * 1e9) };
      ps.splice(i + 1, 0, c);
      selected = c.id;
    } else selected = li.dataset.id!;
    puzzles.changed();
    refresh();
  });

  function box() {
    const st = ctx.state;
    const custom = st.binding === 'paperback' && st.trimId === CUSTOM_TRIM_ID;
    const preset = custom ? undefined : getTrimSize(st.trimId, st.binding);
    const w = preset ? preset.width : st.customWidth;
    const h = preset ? preset.height : st.customHeight;
    return { w, h, safe: contentBox(interiorLayout(w, h, Math.max(24, puzzles.pageCount()), false), 1) };
  }

  function renderList(): void {
    const label = Object.fromEntries(PUZZLE_TYPES.map((t) => [t.id, t.label]));
    el.list.innerHTML = puzzles.book.puzzles
      .map(
        (p, i) => `<li data-id="${p.id}" class="${p.id === selected ? 'on' : ''}"><span class="pz-num">${i + 1}</span>
        <div class="meta"><strong>${esc(p.title || 'Untitled')}</strong><span>${label[p.type]}</span></div>
        <div class="acts"><button type="button" class="btn small subtle" data-act="up" aria-label="Move up">↑</button><button type="button" class="btn small subtle" data-act="down" aria-label="Move down">↓</button><button type="button" class="btn small subtle" data-act="dup" aria-label="Duplicate">⧉</button><button type="button" class="btn small subtle" data-act="remove" aria-label="Remove">✕</button></div></li>`,
      )
      .join('');
    const n = puzzles.book.puzzles.length;
    el.primary.textContent = n ? `${n} puzzle${n === 1 ? '' : 's'} · ${puzzles.pageCount()} pages` : 'No puzzles yet';
    el.toInterior.disabled = !n;
  }

  function renderPreview(): void {
    const p = cur();
    if (!p) return;
    const g = puzzles.generated(p);
    const b = box();
    const prims = puzzlePrims(p, g, b.safe, showSolution);
    el.preview.innerHTML = `<svg viewBox="0 0 ${b.w * PX} ${b.h * PX}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#fff"/>${primsToSvg(prims, PX, measureText, () => undefined)}</svg>`;
    el.preview.style.setProperty('--ar', String(b.w / b.h));
    el.showSol.textContent = showSolution ? 'Show the puzzle' : 'Show the answer';
    const skipped = g.type === 'wordsearch' ? g.ws.skipped : g.type === 'crossword' ? g.cw.skipped : [];
    el.messages.innerHTML = skipped.length
      ? `<div class="msg warning">${skipped.length} word${skipped.length === 1 ? '' : 's'} didn't fit: ${esc(skipped.join(', '))}. ${p.type === 'wordsearch' ? 'Make the grid bigger or use fewer words.' : 'Try "New layout", or add words that share letters.'}</div>`
      : '';
  }

  function refresh(): void {
    solSeg.sync();
    renderList();
    const p = cur();
    el.editor.hidden = !p;
    if (!p) return;
    const label = PUZZLE_TYPES.find((t) => t.id === p.type)!.label;
    el.editorTitle.textContent = label;
    el.title.value = p.title;
    el.words.value = p.words;
    el.size.value = String(p.size);
    el.diff.value = p.difficulty;
    el.diag.checked = p.diagonal;
    el.back.checked = p.backwards;
    el.wordsField.hidden = p.type === 'maze' || p.type === 'sudoku';
    el.sizeField.hidden = p.type === 'crossword' || p.type === 'sudoku';
    el.diffField.hidden = p.type !== 'sudoku';
    el.wsOpts.hidden = p.type !== 'wordsearch';
    el.sizeLabel.textContent = p.type === 'maze' ? 'Maze width (cells)' : 'Grid size (letters across)';
    el.size.max = p.type === 'maze' ? '50' : '30';
    el.wordsLabel.textContent = p.type === 'crossword' ? 'Answers and clues' : 'Words';
    el.wordsHint.textContent =
      p.type === 'crossword'
        ? 'One per line: ANSWER - clue. Spaces and punctuation in answers are ignored. Words that share letters fit best.'
        : 'One word per line (or separated by commas). Spaces and punctuation are ignored.';
    renderPreview();
  }

  el.toInterior.addEventListener('click', () => {
    ctx.state.interior.kind = 'puzzles';
    ctx.save();
    ctx.show('interior');
  });

  return { id: 'puzzles', refresh };
}
