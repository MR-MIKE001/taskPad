import { isValidISODate } from '../lib/dates';
import { sanitizeJobs } from '../lib/jobs';
import { isRecurrenceRule } from '../lib/recurrence';
import { cleanTitle, normalizeTags } from '../lib/text';
import { createInitialData } from './reducer';
import type { AppData, ListColor, Prefs, Priority, Subtask, Task, TaskList } from './types';
import { CURRENT_VERSION, DEFAULT_PREFS, INBOX_ID, LIMITS, LIST_COLORS } from './types';

export const DATA_KEY = 'taskpad:data:v1';
export const PREFS_KEY = 'taskpad:prefs:v1';
const CORRUPT_PREFIX = 'taskpad:data:corrupt:';

/*
 * Everything that crosses the storage boundary (localStorage, imported files, other tabs) is untrusted.
 * `sanitize` turns arbitrary JSON into a valid AppData, dropping or repairing anything malformed, so the rest
 * of the app can rely on its types.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sanitizeSubtasks(raw: unknown): Subtask[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Subtask[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const title = cleanTitle(str(item.title));
    if (!title) continue;
    let id = str(item.id);
    if (!id || seen.has(id)) id = `s-${out.length}-${Math.random().toString(36).slice(2, 8)}`;
    seen.add(id);
    out.push({ id, title, done: item.done === true });
    if (out.length >= LIMITS.subtasksPerTask) break;
  }
  return out;
}

function sanitizeTask(raw: unknown, listIds: ReadonlySet<string>, index: number, now: number): Task | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const title = cleanTitle(str(raw.title));
  if (!id || !title) return null;
  const priority = [0, 1, 2, 3].includes(raw.priority as number) ? (raw.priority as Priority) : 0;
  const createdAt = finite(raw.createdAt, now);
  const listId = str(raw.listId);
  return {
    id,
    title,
    notes: str(raw.notes).slice(0, LIMITS.notes),
    listId: listIds.has(listId) ? listId : INBOX_ID,
    priority,
    due: isValidISODate(raw.due) ? raw.due : null,
    tags: Array.isArray(raw.tags) ? normalizeTags(raw.tags.filter((t): t is string => typeof t === 'string')) : [],
    subtasks: sanitizeSubtasks(raw.subtasks),
    recurrence: isRecurrenceRule(raw.recurrence) ? raw.recurrence : null,
    completedAt: raw.completedAt === null || raw.completedAt === undefined ? null : finite(raw.completedAt, now),
    createdAt,
    updatedAt: finite(raw.updatedAt, createdAt),
    order: finite(raw.order, (index + 1) * 1024),
  };
}

function sanitizeLists(raw: unknown): TaskList[] {
  const lists: TaskList[] = [{ id: INBOX_ID, name: 'Inbox', color: 'slate' }];
  if (!Array.isArray(raw)) return lists;
  const seen = new Set<string>([INBOX_ID]);
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = str(item.id);
    if (!id) continue;
    if (id === INBOX_ID) {
      const color = str(item.color);
      if ((LIST_COLORS as readonly string[]).includes(color)) lists[0] = { id: INBOX_ID, name: 'Inbox', color: color as ListColor };
      continue;
    }
    const name = cleanTitle(str(item.name), LIMITS.listName);
    if (!name || seen.has(id) || lists.length > LIMITS.lists) continue;
    seen.add(id);
    const color = str(item.color);
    lists.push({ id, name, color: (LIST_COLORS as readonly string[]).includes(color) ? (color as ListColor) : 'slate' });
  }
  return lists;
}

export function sanitize(raw: unknown, now = Date.now()): AppData {
  if (!isRecord(raw)) return createInitialData();
  const lists = sanitizeLists(raw.lists);
  const listIds = new Set(lists.map((l) => l.id));
  const seen = new Set<string>();
  const tasks: Task[] = [];
  (Array.isArray(raw.tasks) ? raw.tasks : []).forEach((item, index) => {
    const task = sanitizeTask(item, listIds, index, now);
    if (!task || seen.has(task.id)) return;
    seen.add(task.id);
    tasks.push(task);
  });
  // Data saved before job tracking existed has no `jobs`; that simply means none yet.
  return { version: CURRENT_VERSION, tasks, lists, jobs: sanitizeJobs(raw.jobs, now) };
}

export type LoadStatus =
  | { kind: 'empty' }
  | { kind: 'ok' }
  /** Stored JSON was unreadable; a copy was kept under `backupKey` and the app starts fresh. */
  | { kind: 'corrupt'; backupKey: string | null }
  /** Data was written by a newer version of the app. We show it but never overwrite it. */
  | { kind: 'newer'; version: number }
  | { kind: 'unavailable' };

export interface LoadResult {
  data: AppData;
  status: LoadStatus;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing localStorage can throw when storage is blocked.
    return null;
  }
}

export function parseStored(text: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { data: createInitialData(), status: { kind: 'corrupt', backupKey: null } };
  }
  if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version > CURRENT_VERSION) {
    return { data: sanitize(parsed), status: { kind: 'newer', version: parsed.version } };
  }
  if (!isRecord(parsed)) return { data: createInitialData(), status: { kind: 'corrupt', backupKey: null } };
  return { data: sanitize(parsed), status: { kind: 'ok' } };
}

export function loadData(): LoadResult {
  const store = storage();
  if (!store) return { data: createInitialData(), status: { kind: 'unavailable' } };
  let text: string | null;
  try {
    text = store.getItem(DATA_KEY);
  } catch {
    return { data: createInitialData(), status: { kind: 'unavailable' } };
  }
  if (text === null) return { data: createInitialData(), status: { kind: 'empty' } };
  const result = parseStored(text);
  if (result.status.kind === 'corrupt') {
    // Never destroy what we couldn't read: stash it so it can be recovered by hand.
    const backupKey = `${CORRUPT_PREFIX}${Date.now()}`;
    try {
      store.setItem(backupKey, text);
      return { data: result.data, status: { kind: 'corrupt', backupKey } };
    } catch {
      return result;
    }
  }
  return result;
}

export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

export function saveData(data: AppData): SaveResult {
  const store = storage();
  if (!store) return { ok: false, reason: 'unavailable' };
  try {
    store.setItem(DATA_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}

export function sanitizePrefs(raw: unknown): Prefs {
  if (!isRecord(raw)) return DEFAULT_PREFS;
  const theme = raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : DEFAULT_PREFS.theme;
  const sorts = ['manual', 'due', 'priority', 'created', 'title'] as const;
  const sort = sorts.find((s) => s === raw.sort) ?? DEFAULT_PREFS.sort;
  return { theme, sort, showCompleted: raw.showCompleted === true };
}

export function loadPrefs(): Prefs {
  try {
    const text = storage()?.getItem(PREFS_KEY);
    return text ? sanitizePrefs(JSON.parse(text)) : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  try {
    storage()?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a convenience; losing them is not worth interrupting the user.
  }
}
