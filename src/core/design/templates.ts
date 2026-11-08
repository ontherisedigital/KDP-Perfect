/** Starter page layouts for the designer, sized to the book's safe area. Users restyle or rearrange them freely. */

import { daysInMonth, parseDate, weekStartOf, addDays, type WeekStart } from './dates';
import type { DesignDoc, PageDesign, SequenceItem } from './document';
import { newElement, type DesignElement, type Props } from './elements';
import type { Box } from './geometry';

export interface TemplateDef {
  id: string;
  label: string;
  /** Suggested repeat for the page in a dated planner. */
  repeat: 'none' | 'day' | 'week' | 'month';
  build(safe: Box): DesignElement[];
}

function el(type: string, x: number, y: number, w: number, h: number, props: Props = {}): DesignElement {
  const e = newElement(type, { x, y }, { w, h });
  Object.assign(e.props, props);
  return e;
}

export const TEMPLATES: readonly TemplateDef[] = [
  { id: 'blank', label: 'Blank page', repeat: 'none', build: () => [] },
  {
    id: 'month',
    label: 'Monthly calendar',
    repeat: 'month',
    build: (s) => [
      el('month', s.x, s.y, s.w, s.h * 0.78, { title: true, pattern: 'none' }),
      el('notes', s.x, s.y + s.h * 0.8, s.w, s.h * 0.2, { title: 'Notes', pattern: 'lines', shape: 'rounded' }),
    ],
  },
  {
    id: 'week',
    label: 'Weekly planner',
    repeat: 'week',
    build: (s) => [
      el('date-heading', s.x, s.y, s.w * 0.6, 0.45, { format: 'week-of', fontSize: 18 }),
      el('mini-month', s.x + s.w - 1.7, s.y, 1.7, 1.2, { fontSize: 6 }),
      el('week', s.x, s.y + 1.3, s.w, s.h - 1.3, { layout: 'grid', pattern: 'lines', shape: 'rounded', corner: 0.08 }),
    ],
  },
  {
    id: 'day',
    label: 'Daily planner',
    repeat: 'day',
    build: (s) => {
      const half = (s.w - 0.2) / 2;
      return [
        el('date-heading', s.x, s.y, s.w, 0.5, { format: 'long', fontSize: 18 }),
        el('schedule', s.x, s.y + 0.65, half, s.h - 0.65, { from: 6, to: 21 }),
        el('list', s.x + half + 0.2, s.y + 0.65, half, 1.3, { title: 'Top 3', rows: 3 }),
        el('checklist', s.x + half + 0.2, s.y + 2.1, half, 2.4, { title: 'To do', rows: 8 }),
        el('tracker', s.x + half + 0.2, s.y + 4.65, half, 0.4, { label: 'Water', count: 8, shape: 'drop' }),
        el('notes', s.x + half + 0.2, s.y + 5.2, half, Math.max(0.8, s.h - 5.2), { title: 'Notes', pattern: 'lines', shape: 'rounded' }),
      ];
    },
  },
  {
    id: 'habits',
    label: 'Monthly habit tracker',
    repeat: 'month',
    build: (s) => [
      el('date-heading', s.x, s.y, s.w, 0.5, { format: 'month-year', align: 'center', fontSize: 20 }),
      el('habit-tracker', s.x, s.y + 0.7, s.w, s.h - 0.7, { rows: 14, days: 'month', habits: '' }),
    ],
  },
  {
    id: 'year',
    label: 'Year at a glance',
    repeat: 'none',
    build: (s) => [el('text', s.x, s.y, s.w, 0.6, { text: 'Year at a glance', fontSize: 22 }), el('year', s.x, s.y + 0.75, s.w, s.h - 0.75, { cols: '3' })],
  },
  {
    id: 'gratitude',
    label: 'Gratitude journal',
    repeat: 'day',
    build: (s) => [
      el('date-heading', s.x, s.y, s.w, 0.5, { dateSource: 'undated', blank: 'Date: ____________', fontSize: 14 }),
      el('list', s.x, s.y + 0.7, s.w, 1.6, { title: 'Today I am grateful for', rows: 3 }),
      el('mood', s.x, s.y + 2.5, s.w * 0.6, 0.45, { label: 'Mood', count: 5, shape: 'heart' }),
      el('writing', s.x, s.y + 3.15, s.w, s.h - 3.15, { style: 'lines' }),
    ],
  },
  {
    id: 'bujo-key',
    label: 'Bullet journal key + index',
    repeat: 'none',
    build: (s) => [
      el('banner', s.x + s.w * 0.15, s.y, s.w * 0.7, 0.7, { text: 'Index' }),
      el('table', s.x, s.y + 0.9, s.w, s.h * 0.55, { cols: 2, rows: 18, header: 'Topic, Page', strokeWidth: 0.4 }),
      el('key', s.x, s.y + 1.1 + s.h * 0.55, Math.min(2.6, s.w / 2), Math.max(0.8, s.h * 0.45 - 1.15)),
    ],
  },
  {
    id: 'meals',
    label: 'Meal planner',
    repeat: 'week',
    build: (s) => [
      el('date-heading', s.x, s.y, s.w, 0.5, { format: 'week-of', fontSize: 18 }),
      el('table', s.x, s.y + 0.7, s.w, s.h * 0.62, { cols: 4, rows: 7, header: ', Breakfast, Lunch, Dinner', firstCol: 'Mon, Tue, Wed, Thu, Fri, Sat, Sun' }),
      el('checklist', s.x, s.y + 0.9 + s.h * 0.62, s.w, s.h * 0.38 - 0.9, { title: 'Shopping list', rows: 6 }),
    ],
  },
  {
    id: 'pixels',
    label: 'Year in pixels',
    repeat: 'none',
    build: (s) => [el('pixels', s.x, s.y, s.w, s.h)],
  },
  {
    id: 'calendar-shapes',
    label: 'Fun-shape month',
    repeat: 'month',
    build: (s) => [el('month', s.x, s.y, s.w, s.h, { title: true, shape: 'flower', gap: 0.05, labelPos: 'center', fontSize: 10, strokeWidth: 0.8 })],
  },
];

/**
 * A dated year planner: for each month, the month page then a weekly page for every week that starts in that month.
 */
export function yearPlanSequence(doc: DesignDoc, monthPageId: string, weekPageId: string | null, months = 12): SequenceItem[] {
  const start = parseDate(doc.startDate) ?? { y: new Date().getFullYear() + 1, m: 0, d: 1 };
  const items: SequenceItem[] = [];
  let id = 0;
  for (let i = 0; i < months; i++) {
    const y = start.y + Math.floor((start.m + i) / 12);
    const m = (start.m + i) % 12;
    items.push({ id: `q${id++}`, pageId: monthPageId, count: 1, repeat: 'month' });
    if (weekPageId) items.push({ id: `q${id++}`, pageId: weekPageId, count: weeksStartingIn(y, m, doc.weekStart), repeat: 'week' });
  }
  return items;
}

export function weeksStartingIn(y: number, m: number, ws: WeekStart): number {
  let d = weekStartOf({ y, m, d: 1 }, ws);
  if (d.m !== m) d = addDays(d, 7);
  let n = 0;
  while (d.m === m && d.d <= daysInMonth(y, m)) {
    n++;
    d = addDays(d, 7);
  }
  return n;
}

export function pageFromTemplate(t: TemplateDef, safe: Box, id: string): PageDesign {
  return { id, name: t.label, elements: t.build(safe), mirror: false };
}
