import { parseStored, sanitize } from '../store/persistence';
import type { AppData, JobApplication } from '../store/types';
import { JOB_STATUS_LABELS } from './jobs';

export function toJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

/** Spreadsheet apps execute cells starting with = + - @ as formulas; prefix them so exports are safe to open. */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCSV(data: AppData): string {
  const listName = new Map(data.lists.map((l) => [l.id, l.name]));
  const header = ['Title', 'List', 'Status', 'Priority', 'Due', 'Repeats', 'Tags', 'Subtasks', 'Notes', 'Created', 'Completed'];
  const priority = ['', 'low', 'medium', 'high'];
  const rows = data.tasks.map((t) => [
    t.title,
    listName.get(t.listId) ?? 'Inbox',
    t.completedAt === null ? 'open' : 'done',
    priority[t.priority] ?? '',
    t.due ?? '',
    t.recurrence ?? '',
    t.tags.join(' '),
    t.subtasks.map((s) => `${s.done ? '[x]' : '[ ]'} ${s.title}`).join('; '),
    t.notes,
    new Date(t.createdAt).toISOString(),
    t.completedAt === null ? '' : new Date(t.completedAt).toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function jobsToCSV(jobs: readonly JobApplication[]): string {
  const header = ['Company', 'Role', 'Status', 'Applied', 'Follow up', 'Location', 'Salary', 'Contact', 'URL', 'Notes', 'Created'];
  const rows = jobs.map((j) => [
    j.company,
    j.role,
    JOB_STATUS_LABELS[j.status],
    j.appliedOn ?? '',
    j.followUp ?? '',
    j.location,
    j.salary,
    j.contact,
    j.url,
    j.notes,
    new Date(j.createdAt).toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export type ImportResult = { ok: true; data: AppData; taskCount: number; listCount: number; jobCount: number } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'The file is empty.' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'That file is not valid JSON. Import a file exported from Taskpad.' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !('tasks' in parsed)) {
    return { ok: false, error: 'This does not look like a Taskpad export (no "tasks" found).' };
  }
  const result = parseStored(trimmed);
  const data = result.status.kind === 'corrupt' ? sanitize(parsed) : result.data;
  return { ok: true, data, taskCount: data.tasks.length, listCount: data.lists.length - 1, jobCount: data.jobs.length };
}

/** Merges imported data into current data: lists, tasks and jobs by id (imported wins), nothing deleted. */
export function mergeData(current: AppData, incoming: AppData): AppData {
  const lists = [...current.lists];
  for (const list of incoming.lists) if (!lists.some((l) => l.id === list.id)) lists.push(list);
  const byId = new Map(current.tasks.map((t) => [t.id, t]));
  for (const task of incoming.tasks) byId.set(task.id, task);
  const jobsById = new Map(current.jobs.map((j) => [j.id, j]));
  for (const job of incoming.jobs) jobsById.set(job.id, job);
  return { version: current.version, lists, tasks: [...byId.values()], jobs: [...jobsById.values()] };
}
