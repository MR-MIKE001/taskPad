import { applyJobPatch, type NewJobInput } from '../lib/jobs';
import { nextDueAfterCompletion } from '../lib/recurrence';
import type { AppData, JobApplication, Task, TaskList } from './types';
import { INBOX_ID } from './types';

/*
 * Pure reducer: no clocks, no random ids. Anything impure (timestamps, ids, "today") arrives inside the action,
 * which keeps this trivially testable and makes undo/redo deterministic.
 */

export type Action =
  | { type: 'task/add'; task: Task }
  | { type: 'task/update'; id: string; patch: Partial<Omit<Task, 'id' | 'createdAt'>>; now: number }
  | { type: 'task/toggle'; id: string; now: number; today: string; spawnId: string }
  | { type: 'task/delete'; id: string }
  | { type: 'task/reorder'; ids: string[] }
  | { type: 'task/clearCompleted' }
  | { type: 'list/add'; list: TaskList }
  | { type: 'list/update'; id: string; patch: Partial<Omit<TaskList, 'id'>> }
  | { type: 'list/delete'; id: string; now: number }
  | { type: 'job/add'; job: JobApplication }
  | { type: 'job/update'; id: string; patch: Partial<NewJobInput>; now: number; today: string }
  | { type: 'job/delete'; id: string }
  | { type: 'data/replace'; data: AppData };

export function createInitialData(): AppData {
  return { version: 1, tasks: [], lists: [{ id: INBOX_ID, name: 'Inbox', color: 'slate' }], jobs: [] };
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'task/add':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'task/update': {
      if (!state.tasks.some((t) => t.id === action.id)) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch, updatedAt: action.now } : t)),
      };
    }

    case 'task/toggle': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      if (task.completedAt !== null) {
        return {
          ...state,
          tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, completedAt: null, updatedAt: action.now } : t)),
        };
      }
      const completed: Task = { ...task, completedAt: action.now, updatedAt: action.now };
      const tasks = state.tasks.map((t) => (t.id === task.id ? completed : t));
      // Completing a repeating task leaves the finished copy in history and schedules a fresh one.
      if (task.recurrence && task.due) {
        const next: Task = {
          ...task,
          id: action.spawnId,
          due: nextDueAfterCompletion(task.due, task.recurrence, action.today),
          subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
          completedAt: null,
          createdAt: action.now,
          updatedAt: action.now,
          order: task.order,
        };
        tasks.push(next);
      }
      return { ...state, tasks };
    }

    case 'task/delete':
      return state.tasks.some((t) => t.id === action.id) ? { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) } : state;

    case 'task/reorder': {
      // Re-number the given ids in the order supplied; tasks not listed keep their order values.
      const slots = action.ids
        .map((id) => state.tasks.find((t) => t.id === id)?.order)
        .filter((o): o is number => o !== undefined)
        .sort((a, b) => a - b);
      const newOrder = new Map<string, number>();
      action.ids.forEach((id, i) => {
        const slot = slots[i];
        if (slot !== undefined) newOrder.set(id, slot);
      });
      // Ties (e.g. imported data) would make the swap invisible; fall back to a fresh sequence.
      const hasTies = new Set(slots).size !== slots.length;
      return {
        ...state,
        tasks: state.tasks.map((t) => {
          const idx = action.ids.indexOf(t.id);
          if (idx === -1) return t;
          const order = hasTies ? (slots[0] ?? 0) + idx : newOrder.get(t.id);
          return order === undefined ? t : { ...t, order };
        }),
      };
    }

    case 'task/clearCompleted':
      return state.tasks.some((t) => t.completedAt !== null) ? { ...state, tasks: state.tasks.filter((t) => t.completedAt === null) } : state;

    case 'list/add':
      return { ...state, lists: [...state.lists, action.list] };

    case 'list/update': {
      if (action.id === INBOX_ID) {
        // The inbox can be recoloured but not renamed.
        const { color } = action.patch;
        return color ? { ...state, lists: state.lists.map((l) => (l.id === INBOX_ID ? { ...l, color } : l)) } : state;
      }
      return { ...state, lists: state.lists.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) };
    }

    case 'list/delete': {
      if (action.id === INBOX_ID || !state.lists.some((l) => l.id === action.id)) return state;
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        // Tasks are never destroyed by deleting a list; they fall back to the inbox.
        tasks: state.tasks.map((t) => (t.listId === action.id ? { ...t, listId: INBOX_ID, updatedAt: action.now } : t)),
      };
    }

    case 'job/add':
      return { ...state, jobs: [...state.jobs, action.job] };

    case 'job/update': {
      if (!state.jobs.some((j) => j.id === action.id)) return state;
      return { ...state, jobs: state.jobs.map((j) => (j.id === action.id ? applyJobPatch(j, action.patch, action.now, action.today) : j)) };
    }

    case 'job/delete':
      return state.jobs.some((j) => j.id === action.id) ? { ...state, jobs: state.jobs.filter((j) => j.id !== action.id) } : state;

    case 'data/replace':
      return action.data;
  }
}
