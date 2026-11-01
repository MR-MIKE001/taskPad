import { describe, expect, it } from 'vitest';
import { createHistory, withHistory } from './history';
import { createInitialData, reducer, type Action } from './reducer';
import { createTask } from './tasks';
import { INBOX_ID, type AppData } from './types';

const task = (title: string, order: number, extra: Partial<Parameters<typeof createTask>[0]> = {}, id = title) => createTask({ title, ...extra }, order, 1000, id);
const withTasks = (...tasks: ReturnType<typeof task>[]): AppData => ({ ...createInitialData(), tasks });

describe('reducer', () => {
  it('toggles completion and back', () => {
    const state = withTasks(task('a', 1));
    const done = reducer(state, { type: 'task/toggle', id: 'a', now: 5, today: '2026-10-31', spawnId: 'x' });
    expect(done.tasks[0]?.completedAt).toBe(5);
    const undone = reducer(done, { type: 'task/toggle', id: 'a', now: 6, today: '2026-10-31', spawnId: 'y' });
    expect(undone.tasks[0]?.completedAt).toBeNull();
    expect(undone.tasks).toHaveLength(1);
  });

  it('spawns the next instance of a recurring task with reset subtasks', () => {
    const t = { ...task('rent', 1, { due: '2026-10-31', recurrence: 'monthly' }), subtasks: [{ id: 's', title: 'transfer', done: true }] };
    const next = reducer(withTasks(t), { type: 'task/toggle', id: 'rent', now: 9, today: '2026-10-31', spawnId: 'rent2' });
    expect(next.tasks).toHaveLength(2);
    const spawned = next.tasks.find((x) => x.id === 'rent2');
    expect(spawned).toMatchObject({ due: '2026-11-30', completedAt: null, recurrence: 'monthly' });
    expect(spawned?.subtasks[0]?.done).toBe(false);
    expect(next.tasks.find((x) => x.id === 'rent')?.completedAt).toBe(9);
  });

  it('returns the same reference for no-op actions', () => {
    const state = withTasks(task('a', 1));
    expect(reducer(state, { type: 'task/delete', id: 'missing' })).toBe(state);
    expect(reducer(state, { type: 'task/update', id: 'missing', patch: {}, now: 1 })).toBe(state);
    expect(reducer(state, { type: 'task/clearCompleted' })).toBe(state);
  });

  it('reorders only the given tasks, reusing their order slots', () => {
    const state = withTasks(task('a', 10), task('b', 20), task('c', 30), task('z', 25));
    const next = reducer(state, { type: 'task/reorder', ids: ['c', 'a', 'b'] });
    const order = Object.fromEntries(next.tasks.map((t) => [t.id, t.order]));
    expect(order).toEqual({ c: 10, a: 20, b: 30, z: 25 });
  });

  it('moves tasks to the inbox when their list is deleted, and protects the inbox', () => {
    const base = withTasks(task('a', 1, { listId: 'L' }));
    const state: AppData = { ...base, lists: [...base.lists, { id: 'L', name: 'Work', color: 'blue' }] };
    const next = reducer(state, { type: 'list/delete', id: 'L', now: 3 });
    expect(next.lists.map((l) => l.id)).toEqual([INBOX_ID]);
    expect(next.tasks[0]?.listId).toBe(INBOX_ID);
    expect(reducer(next, { type: 'list/delete', id: INBOX_ID, now: 4 })).toBe(next);
    expect(reducer(next, { type: 'list/update', id: INBOX_ID, patch: { name: 'Renamed' } })).toBe(next);
  });
});

describe('history', () => {
  const run = withHistory<AppData, Action>(reducer, 3);

  it('undoes and redoes, and clears redo on new work', () => {
    let h = createHistory(createInitialData());
    h = run(h, { type: 'history/apply', action: { type: 'task/add', task: task('a', 1) } });
    h = run(h, { type: 'history/apply', action: { type: 'task/add', task: task('b', 2) } });
    expect(h.present.tasks).toHaveLength(2);
    h = run(h, { type: 'history/undo' });
    expect(h.present.tasks).toHaveLength(1);
    h = run(h, { type: 'history/redo' });
    expect(h.present.tasks).toHaveLength(2);
    h = run(h, { type: 'history/undo' });
    h = run(h, { type: 'history/apply', action: { type: 'task/add', task: task('c', 3) } });
    expect(h.future).toHaveLength(0);
  });

  it('ignores no-op actions, caps depth, and tracks revisions', () => {
    let h = createHistory(createInitialData());
    const same = run(h, { type: 'history/apply', action: { type: 'task/delete', id: 'nope' } });
    expect(same).toBe(h);
    for (let i = 0; i < 6; i++) h = run(h, { type: 'history/apply', action: { type: 'task/add', task: task(`t${i}`, i) } });
    expect(h.past).toHaveLength(3);
    expect(h.revision).toBe(6);
  });

  it('reset adopts external state without history and marks it saved', () => {
    let h = createHistory(createInitialData());
    h = run(h, { type: 'history/apply', action: { type: 'task/add', task: task('a', 1) } });
    h = run(h, { type: 'history/reset', state: createInitialData() });
    expect(h.past).toHaveLength(0);
    expect(h.savedRevision).toBe(h.revision);
  });
});
