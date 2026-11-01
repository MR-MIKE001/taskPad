import type { ISODate, SortKey, Task, TaskList, View } from '../store/types';
import { INBOX_ID } from '../store/types';

export const isOpen = (task: Task) => task.completedAt === null;
export const isOverdue = (task: Task, today: ISODate) => isOpen(task) && task.due !== null && task.due < today;

export function matchesView(task: Task, view: View, today: ISODate): boolean {
  switch (view.kind) {
    case 'inbox':
      return isOpen(task) && task.listId === INBOX_ID;
    case 'today':
      return isOpen(task) && task.due !== null && task.due <= today;
    case 'upcoming':
      return isOpen(task) && task.due !== null && task.due > today;
    case 'all':
      return isOpen(task);
    case 'completed':
      return !isOpen(task);
    case 'list':
      return task.listId === view.id;
    case 'tag':
      return task.tags.includes(view.tag);
    case 'jobs':
      return false;
  }
}

/** Case-insensitive match against title, notes, tags and subtask titles. Every word must match somewhere. */
export function matchesQuery(task: Task, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [task.title, task.notes, ...task.tags, ...task.subtasks.map((s) => s.title)].join('\n').toLowerCase();
  return words.every((w) => haystack.includes(w.replace(/^#/, '')));
}

const byOrder = (a: Task, b: Task) => a.order - b.order || a.createdAt - b.createdAt;

export function sortTasks(tasks: readonly Task[], key: SortKey): Task[] {
  const copy = [...tasks];
  switch (key) {
    case 'manual':
      return copy.sort(byOrder);
    case 'due':
      // Dated tasks first (earliest first); undated last.
      return copy.sort((a, b) => (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99') || b.priority - a.priority || byOrder(a, b));
    case 'priority':
      return copy.sort((a, b) => b.priority - a.priority || (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99') || byOrder(a, b));
    case 'created':
      return copy.sort((a, b) => b.createdAt - a.createdAt);
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
  }
}

/** Completed view is always newest-completed first, whatever the sort preference. */
export function visibleTasks(
  tasks: readonly Task[],
  view: View,
  opts: { today: ISODate; sort: SortKey; showCompleted: boolean; query: string },
): Task[] {
  const filtered = tasks.filter((t) => {
    if (!matchesView(t, view, opts.today)) return false;
    if (!opts.showCompleted && view.kind !== 'completed' && !isOpen(t)) return false;
    return matchesQuery(t, opts.query);
  });
  if (view.kind === 'completed') return filtered.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  const sorted = sortTasks(filtered, opts.sort);
  // Keep finished tasks at the bottom when they are shown inline.
  return opts.showCompleted ? [...sorted.filter(isOpen), ...sorted.filter((t) => !isOpen(t))] : sorted;
}

export interface Counts {
  inbox: number;
  today: number;
  overdue: number;
  upcoming: number;
  all: number;
  completed: number;
  byList: Record<string, number>;
  tags: Array<{ tag: string; count: number }>;
}

export function computeCounts(tasks: readonly Task[], lists: readonly TaskList[], today: ISODate): Counts {
  const counts: Counts = { inbox: 0, today: 0, overdue: 0, upcoming: 0, all: 0, completed: 0, byList: {}, tags: [] };
  for (const list of lists) counts.byList[list.id] = 0;
  const tagCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!isOpen(task)) {
      counts.completed++;
      continue;
    }
    counts.all++;
    counts.byList[task.listId] = (counts.byList[task.listId] ?? 0) + 1;
    if (task.listId === INBOX_ID) counts.inbox++;
    if (task.due !== null) {
      if (task.due <= today) counts.today++;
      else counts.upcoming++;
      if (task.due < today) counts.overdue++;
    }
    for (const tag of task.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  counts.tags = [...tagCounts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  return counts;
}

export interface Section {
  key: string;
  /** `null` means "no heading". */
  due: ISODate | 'overdue' | 'none' | null;
  tasks: Task[];
}

/** Groups tasks for Today (overdue + today) and Upcoming (one section per day, then undated). */
export function groupByDay(tasks: readonly Task[], today: ISODate): Section[] {
  const overdue: Task[] = [];
  const days = new Map<ISODate, Task[]>();
  const undated: Task[] = [];
  for (const task of tasks) {
    if (task.due === null) undated.push(task);
    else if (task.due < today) overdue.push(task);
    else days.set(task.due, [...(days.get(task.due) ?? []), task]);
  }
  const sections: Section[] = [];
  if (overdue.length) sections.push({ key: 'overdue', due: 'overdue', tasks: overdue });
  for (const day of [...days.keys()].sort()) sections.push({ key: day, due: day, tasks: days.get(day) ?? [] });
  if (undated.length) sections.push({ key: 'none', due: 'none', tasks: undated });
  return sections;
}

export function subtaskProgress(task: Task): { done: number; total: number } {
  return { done: task.subtasks.filter((s) => s.done).length, total: task.subtasks.length };
}

export function allTags(tasks: readonly Task[]): string[] {
  return [...new Set(tasks.flatMap((t) => t.tags))].sort();
}

/** An order value that places a new task after everything else in the list. */
export function nextOrder(tasks: readonly Task[]): number {
  return tasks.reduce((max, t) => Math.max(max, t.order), 0) + 1024;
}
