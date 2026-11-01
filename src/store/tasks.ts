import { cleanTitle, newId, normalizeTags } from '../lib/text';
import type { ISODate, Priority, RecurrenceRule, Task } from './types';
import { INBOX_ID } from './types';

export interface NewTaskInput {
  title: string;
  notes?: string;
  listId?: string;
  priority?: Priority;
  due?: ISODate | null;
  tags?: string[];
  recurrence?: RecurrenceRule | null;
}

export function createTask(input: NewTaskInput, order: number, now: number = Date.now(), id: string = newId()): Task {
  return {
    id,
    title: cleanTitle(input.title),
    notes: input.notes ?? '',
    listId: input.listId ?? INBOX_ID,
    priority: input.priority ?? 0,
    due: input.due ?? null,
    tags: normalizeTags(input.tags ?? []),
    subtasks: [],
    recurrence: input.recurrence ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    order,
  };
}
