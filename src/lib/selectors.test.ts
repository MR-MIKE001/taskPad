import { describe, expect, it } from 'vitest';
import { createTask } from '../store/tasks';
import { INBOX_ID } from '../store/types';
import { computeCounts, groupByDay, matchesQuery, sortTasks, visibleTasks } from './selectors';

const today = '2026-10-31';
const t = (title: string, order: number, extra: Parameters<typeof createTask>[0] extends infer I ? Partial<I> : never = {}, id = title) =>
  createTask({ title, ...extra }, order, 1, id);
const lists = [{ id: INBOX_ID, name: 'Inbox', color: 'slate' as const }];

describe('selectors', () => {
  const tasks = [
    t('overdue', 1, { due: '2026-10-29' }),
    t('today', 2, { due: today, priority: 3 }),
    t('later', 3, { due: '2026-11-03', tags: ['x'] }),
    t('undated', 4),
    { ...t('finished', 5, { due: today }), completedAt: 99 },
  ];

  it('filters views', () => {
    const names = (kind: 'today' | 'upcoming' | 'inbox' | 'all' | 'completed') =>
      visibleTasks(tasks, { kind }, { today, sort: 'manual', showCompleted: false, query: '' }).map((x) => x.title);
    expect(names('today')).toEqual(['overdue', 'today']);
    expect(names('upcoming')).toEqual(['later']);
    expect(names('all')).toEqual(['overdue', 'today', 'later', 'undated']);
    expect(names('completed')).toEqual(['finished']);
  });

  it('counts', () => {
    const c = computeCounts(tasks, lists, today);
    expect(c).toMatchObject({ today: 2, overdue: 1, upcoming: 1, all: 4, completed: 1, inbox: 4 });
    expect(c.tags).toEqual([{ tag: 'x', count: 1 }]);
  });

  it('sorts with undated tasks last', () => {
    expect(sortTasks(tasks.slice(0, 4), 'due').map((x) => x.title)).toEqual(['overdue', 'today', 'later', 'undated']);
    expect(sortTasks(tasks.slice(0, 4), 'priority')[0]?.title).toBe('today');
  });

  it('searches every word across fields', () => {
    expect(matchesQuery(tasks[2] ?? tasks[0]!, 'later #x')).toBe(true);
    expect(matchesQuery(tasks[2] ?? tasks[0]!, 'later nope')).toBe(false);
  });

  it('groups by day with overdue first and undated last', () => {
    const sections = groupByDay(tasks.slice(0, 4), today);
    expect(sections.map((s) => s.key)).toEqual(['overdue', today, '2026-11-03', 'none']);
  });
});
