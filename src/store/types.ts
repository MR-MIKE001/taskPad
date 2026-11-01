/** Calendar date in the user's local time zone, formatted `YYYY-MM-DD`. Never a timestamp, so it can't shift across time zones. */
export type ISODate = string;

/** 0 = none, 1 = low, 2 = medium, 3 = high. */
export type Priority = 0 | 1 | 2 | 3;

export type RecurrenceRule = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string;
  listId: string;
  priority: Priority;
  due: ISODate | null;
  /** Lowercase, unique, no leading `#`. */
  tags: string[];
  subtasks: Subtask[];
  recurrence: RecurrenceRule | null;
  /** Epoch ms, or null while open. */
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** Manual ordering, ascending. Gaps and ties are allowed. */
  order: number;
}

export const LIST_COLORS = ['slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'] as const;
export type ListColor = (typeof LIST_COLORS)[number];

export interface TaskList {
  id: string;
  name: string;
  color: ListColor;
}

export const JOB_STATUSES = ['wishlist', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface JobStatusChange {
  status: JobStatus;
  /** Epoch ms. */
  at: number;
}

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: JobStatus;
  location: string;
  /** Always empty or an http(s) URL, so it is safe to render as a link. */
  url: string;
  salary: string;
  contact: string;
  notes: string;
  appliedOn: ISODate | null;
  /** When to chase this application next. */
  followUp: ISODate | null;
  /** Every status the application has been in, oldest first. */
  history: JobStatusChange[];
  createdAt: number;
  updatedAt: number;
}

export const INBOX_ID = 'inbox';

export const CURRENT_VERSION = 1;

/** Everything that gets persisted and exported. */
export interface AppData {
  version: typeof CURRENT_VERSION;
  tasks: Task[];
  lists: TaskList[];
  jobs: JobApplication[];
}

export const LIMITS = {
  title: 300,
  notes: 20_000,
  tag: 24,
  tagsPerTask: 12,
  subtasksPerTask: 100,
  listName: 40,
  lists: 50,
  company: 120,
  role: 160,
  jobField: 200,
  url: 2000,
  jobHistory: 50,
} as const;

export type ThemePref = 'system' | 'light' | 'dark';
export type SortKey = 'manual' | 'due' | 'priority' | 'created' | 'title';

export interface Prefs {
  theme: ThemePref;
  sort: SortKey;
  showCompleted: boolean;
}

export const DEFAULT_PREFS: Prefs = { theme: 'system', sort: 'manual', showCompleted: false };

export type View =
  | { kind: 'inbox' }
  | { kind: 'today' }
  | { kind: 'upcoming' }
  | { kind: 'all' }
  | { kind: 'completed' }
  | { kind: 'list'; id: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'jobs' };

export const PRIORITY_LABELS: Record<Priority, string> = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' };
