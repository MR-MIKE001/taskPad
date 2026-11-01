import { cleanTitle, newId } from './text';
import { isValidISODate } from './dates';
import type { ISODate, JobApplication, JobStatus, JobStatusChange } from '../store/types';
import { JOB_STATUSES, LIMITS } from '../store/types';

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  wishlist: 'Wishlist',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

/** Still in play: worth showing up front and chasing. */
export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ['wishlist', 'applied', 'interviewing', 'offer'];

export const isJobStatus = (v: unknown): v is JobStatus => (JOB_STATUSES as readonly unknown[]).includes(v);
export const isActiveJob = (job: JobApplication) => ACTIVE_JOB_STATUSES.includes(job.status);
/** A follow-up is due once its date arrives, but only while the application is still open. */
export const isFollowUpDue = (job: JobApplication, today: ISODate) => isActiveJob(job) && job.followUp !== null && job.followUp <= today;

/**
 * Returns an http(s) URL or an empty string. Anything else (`javascript:`, `data:`, junk) is dropped, so the
 * value can be rendered straight into an `href`. A bare domain like `jobs.example.com` gets `https://`.
 */
export function safeUrl(raw: string): string {
  const trimmed = raw.trim().slice(0, LIMITS.url);
  if (!trimmed) return '';
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

export interface NewJobInput {
  company: string;
  role: string;
  status?: JobStatus;
  location?: string;
  url?: string;
  salary?: string;
  contact?: string;
  notes?: string;
  appliedOn?: ISODate | null;
  followUp?: ISODate | null;
}

/** Cleans every user-editable field. Shared by create, edit and import so the rules live in one place. */
export function cleanJobFields(input: Partial<NewJobInput>): Partial<JobApplication> {
  const out: Partial<JobApplication> = {};
  if (input.company !== undefined) out.company = cleanTitle(input.company, LIMITS.company);
  if (input.role !== undefined) out.role = cleanTitle(input.role, LIMITS.role);
  if (input.status !== undefined) out.status = input.status;
  if (input.location !== undefined) out.location = cleanTitle(input.location, LIMITS.jobField);
  if (input.url !== undefined) out.url = safeUrl(input.url);
  if (input.salary !== undefined) out.salary = cleanTitle(input.salary, LIMITS.jobField);
  if (input.contact !== undefined) out.contact = cleanTitle(input.contact, LIMITS.jobField);
  if (input.notes !== undefined) out.notes = input.notes.slice(0, LIMITS.notes);
  if (input.appliedOn !== undefined) out.appliedOn = isValidISODate(input.appliedOn) ? input.appliedOn : null;
  if (input.followUp !== undefined) out.followUp = isValidISODate(input.followUp) ? input.followUp : null;
  return out;
}

export function createJob(input: NewJobInput, today: ISODate, now: number = Date.now(), id: string = newId()): JobApplication {
  const status = input.status ?? 'applied';
  return {
    id,
    company: '',
    role: '',
    location: '',
    url: '',
    salary: '',
    contact: '',
    notes: '',
    followUp: null,
    ...cleanJobFields(input),
    status,
    // Anything past the wishlist has been applied for; default the date to today unless one was given.
    appliedOn: input.appliedOn !== undefined ? (isValidISODate(input.appliedOn) ? input.appliedOn : null) : status === 'wishlist' ? null : today,
    history: [{ status, at: now }],
    createdAt: now,
    updatedAt: now,
  };
}

/** Applies an edit, recording a status change in the timeline. Pure: `now` and `today` come from the caller. */
export function applyJobPatch(job: JobApplication, patch: Partial<NewJobInput>, now: number, today: ISODate): JobApplication {
  const cleaned = cleanJobFields(patch);
  const next: JobApplication = { ...job, ...cleaned, updatedAt: now };
  if (cleaned.status !== undefined && cleaned.status !== job.status) {
    const change: JobStatusChange = { status: cleaned.status, at: now };
    next.history = [...job.history, change].slice(-LIMITS.jobHistory);
    if (next.appliedOn === null && cleaned.status !== 'wishlist' && patch.appliedOn === undefined) next.appliedOn = today;
  }
  return next;
}

// --- import / storage --------------------------------------------------------------------------------------------

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const finite = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function sanitizeJob(raw: unknown, now: number): JobApplication | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const fields = cleanJobFields({
    company: str(raw.company),
    role: str(raw.role),
    location: str(raw.location),
    url: str(raw.url),
    salary: str(raw.salary),
    contact: str(raw.contact),
    notes: str(raw.notes),
    appliedOn: str(raw.appliedOn) || null,
    followUp: str(raw.followUp) || null,
  });
  if (!id || (!fields.company && !fields.role)) return null;
  const status = isJobStatus(raw.status) ? raw.status : 'applied';
  const createdAt = finite(raw.createdAt, now);
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .filter((h): h is Record<string, unknown> => isRecord(h) && isJobStatus(h.status))
    .map((h) => ({ status: h.status as JobStatus, at: finite(h.at, createdAt) }))
    .slice(-LIMITS.jobHistory);
  return {
    id,
    company: '',
    role: '',
    location: '',
    url: '',
    salary: '',
    contact: '',
    notes: '',
    appliedOn: null,
    followUp: null,
    ...fields,
    status,
    history: history.length > 0 ? history : [{ status, at: createdAt }],
    createdAt,
    updatedAt: finite(raw.updatedAt, createdAt),
  };
}

export function sanitizeJobs(raw: unknown, now = Date.now()): JobApplication[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: JobApplication[] = [];
  for (const item of raw) {
    const job = sanitizeJob(item, now);
    if (!job || seen.has(job.id)) continue;
    seen.add(job.id);
    out.push(job);
  }
  return out;
}

// --- selectors ---------------------------------------------------------------------------------------------------

export interface JobStats {
  byStatus: Record<JobStatus, number>;
  active: number;
  followUpsDue: number;
  /** Applications that went past the wishlist. */
  applied: number;
  /** Share of applied jobs that ever reached an interview or offer, 0 to 1; null when nothing was applied for. */
  interviewRate: number | null;
}

const reached = (job: JobApplication, statuses: readonly JobStatus[]) => statuses.includes(job.status) || job.history.some((h) => statuses.includes(h.status));

export function computeJobStats(jobs: readonly JobApplication[], today: ISODate): JobStats {
  const byStatus = Object.fromEntries(JOB_STATUSES.map((s) => [s, 0])) as Record<JobStatus, number>;
  let active = 0;
  let followUpsDue = 0;
  let applied = 0;
  let interviewed = 0;
  for (const job of jobs) {
    byStatus[job.status]++;
    if (isActiveJob(job)) active++;
    if (isFollowUpDue(job, today)) followUpsDue++;
    if (job.status !== 'wishlist') {
      applied++;
      if (reached(job, ['interviewing', 'offer'])) interviewed++;
    }
  }
  return { byStatus, active, followUpsDue, applied, interviewRate: applied === 0 ? null : interviewed / applied };
}

export function matchesJobQuery(job: JobApplication, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [job.company, job.role, job.location, job.salary, job.contact, job.notes].join('\n').toLowerCase();
  return words.every((w) => haystack.includes(w));
}

/** Follow-ups that are due float to the top, then the most recently applied (or added). */
export function sortJobs(jobs: readonly JobApplication[], today: ISODate): JobApplication[] {
  const key = (j: JobApplication) => j.appliedOn ?? '';
  return [...jobs].sort(
    (a, b) => Number(isFollowUpDue(b, today)) - Number(isFollowUpDue(a, today)) || key(b).localeCompare(key(a)) || b.createdAt - a.createdAt,
  );
}

export interface JobSection {
  status: JobStatus;
  jobs: JobApplication[];
}

/** One section per status, in pipeline order, skipping empty ones. */
export function groupJobsByStatus(jobs: readonly JobApplication[], today: ISODate): JobSection[] {
  return JOB_STATUSES.map((status) => ({ status, jobs: sortJobs(jobs.filter((j) => j.status === status), today) })).filter((s) => s.jobs.length > 0);
}
