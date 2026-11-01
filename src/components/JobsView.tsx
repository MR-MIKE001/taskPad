import { useMemo, useState, type ReactNode, type RefObject } from 'react';
import { describeDue, formatDue, formatLongDate } from '../lib/dates';
import { JOB_STATUS_BADGE, JOB_STATUS_DOT } from '../lib/colors';
import { ACTIVE_JOB_STATUSES, JOB_STATUS_LABELS, computeJobStats, groupJobsByStatus, isFollowUpDue, matchesJobQuery, type NewJobInput } from '../lib/jobs';
import { cx } from '../lib/text';
import { JOB_STATUSES, type ISODate, type JobApplication, type JobStatus } from '../store/types';
import { Icon } from './Icon';
import { JobDialog } from './JobDialog';

type Filter = JobStatus | 'active' | 'all';

interface JobsViewProps {
  jobs: JobApplication[];
  today: ISODate;
  searchRef: RefObject<HTMLInputElement | null>;
  onAdd: (input: NewJobInput) => void;
  onUpdate: (id: string, patch: Partial<NewJobInput>) => void;
  onDelete: (id: string) => void;
  onExportCSV: () => void;
  /** App-shell controls either side of the title: the mobile menu button, and undo / redo. */
  leading: ReactNode;
  trailing: ReactNode;
}

const describeAge = (iso: ISODate, today: ISODate) => {
  const text = describeDue(iso, today);
  // describeDue speaks in "due" terms; for an application date we only want the distance.
  if (text === 'Due today') return 'today';
  if (text === 'Due tomorrow') return 'tomorrow';
  if (text === '1 day overdue') return '1 day ago';
  return text.replace(/ days overdue$/, ' days ago').replace(/^Due in /, 'in ');
};

export function JobsView({ jobs, today, searchRef, onAdd, onUpdate, onDelete, onExportCSV, leading, trailing }: JobsViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [dialog, setDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const stats = useMemo(() => computeJobStats(jobs, today), [jobs, today]);
  const visible = useMemo(
    () =>
      jobs.filter((job) => {
        if (filter === 'active' && !ACTIVE_JOB_STATUSES.includes(job.status)) return false;
        if (filter !== 'active' && filter !== 'all' && job.status !== filter) return false;
        return matchesJobQuery(job, query);
      }),
    [jobs, filter, query],
  );
  const sections = useMemo(() => groupJobsByStatus(visible, today), [visible, today]);
  const editing = dialog.id ? (jobs.find((j) => j.id === dialog.id) ?? null) : null;

  const subtitle =
    jobs.length === 0
      ? 'Track every application in one place'
      : `${stats.active} active${stats.followUpsDue > 0 ? ` · ${stats.followUpsDue} follow-up${stats.followUpsDue === 1 ? '' : 's'} due` : ''}`;

  const filterButton = (value: Filter, text: string, count: number, dot?: string) => (
    <button
      key={value}
      type="button"
      aria-pressed={filter === value}
      onClick={() => setFilter(value)}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors',
        filter === value
          ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700',
      )}
    >
      {dot && <span className={cx('size-2 rounded-full', dot)} />}
      {text}
      <span className="tabular-nums text-slate-400">{count}</span>
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-20 -mx-4 bg-slate-50/90 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-slate-950/90">
        <div className="flex items-center gap-2">
          {leading}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight">Job applications</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          {trailing}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-40 flex-1">
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  e.currentTarget.blur();
                }
              }}
              aria-label="Search applications"
              placeholder="Search company, role, notes (Ctrl+K)"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={onExportCSV}
            disabled={jobs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/70 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Icon name="download" className="size-4" /> CSV
          </button>
          <button
            type="button"
            onClick={() => setDialog({ open: true, id: null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <Icon name="plus" className="size-4" /> Add application
          </button>
        </div>
      </header>

      <div className="space-y-5">
        {jobs.length > 0 && (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ['Applied', String(stats.applied)],
                ['Interviewing', String(stats.byStatus.interviewing)],
                ['Offers', String(stats.byStatus.offer)],
                ['Interview rate', stats.interviewRate === null ? '–' : `${Math.round(stats.interviewRate * 100)}%`],
              ] as const
            ).map(([name, value]) => (
              <div key={name} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{name}</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {jobs.length > 0 && (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {filterButton('active', 'Active', stats.active)}
            {filterButton('all', 'All', jobs.length)}
            {JOB_STATUSES.map((s) => filterButton(s, JOB_STATUS_LABELS[s], stats.byStatus[s], JOB_STATUS_DOT[s]))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
            <p className="font-medium">{jobs.length === 0 ? 'No applications yet' : query ? 'No matching applications' : 'Nothing in this stage'}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              {jobs.length === 0
                ? 'Add a job you have applied for, or one you want to apply for. Set a follow-up date and it will be flagged when it is time to chase.'
                : query
                  ? 'Try fewer words, or clear the search.'
                  : 'Pick another filter above.'}
            </p>
            {jobs.length === 0 && (
              <button type="button" onClick={() => setDialog({ open: true, id: null })} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Add your first application
              </button>
            )}
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.status} aria-labelledby={`job-sec-${section.status}`}>
              <h2 id={`job-sec-${section.status}`} className="mb-1 flex items-center gap-2 px-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span className={cx('size-2 rounded-full', JOB_STATUS_DOT[section.status])} />
                {JOB_STATUS_LABELS[section.status]}
                <span className="font-normal normal-case tracking-normal text-slate-400">{section.jobs.length}</span>
              </h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {section.jobs.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    today={today}
                    onOpen={() => setDialog({ open: true, id: job.id })}
                    onStatus={(status) => onUpdate(job.id, { status })}
                    onDelete={() => onDelete(job.id)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <JobDialog
        open={dialog.open}
        job={editing}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onCreate={onAdd}
        onSave={onUpdate}
        onDelete={onDelete}
      />
    </>
  );
}

function JobRow({ job, today, onOpen, onStatus, onDelete }: { job: JobApplication; today: ISODate; onOpen: () => void; onStatus: (s: JobStatus) => void; onDelete: () => void }) {
  const followUpDue = isFollowUpDue(job, today);
  const name = `${job.role} at ${job.company}`;
  return (
    <li data-testid="job-row" className="group flex items-start gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onOpen} className="block max-w-full text-left">
          <span className="block truncate text-sm font-medium">{job.role || 'Untitled role'}</span>
          <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
            {job.company}
            {job.location && ` · ${job.location}`}
            {job.salary && ` · ${job.salary}`}
          </span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          {job.appliedOn && <span title={formatLongDate(job.appliedOn)}>Applied {formatDue(job.appliedOn, today)} ({describeAge(job.appliedOn, today)})</span>}
          {job.followUp && (
            <span
              title={`Follow up ${formatLongDate(job.followUp)}`}
              className={cx('inline-flex items-center gap-1', followUpDue && 'rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800 dark:bg-amber-500/20 dark:text-amber-300')}
            >
              <Icon name="flag" className="size-3" />
              {followUpDue ? 'Follow up now' : `Follow up ${formatDue(job.followUp, today)}`}
            </span>
          )}
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline dark:text-indigo-400">
              <Icon name="link" className="size-3" /> Posting
            </a>
          )}
        </div>
      </div>
      <select
        value={job.status}
        onChange={(e) => onStatus(e.target.value as JobStatus)}
        aria-label={`Status for ${name}`}
        className={cx('shrink-0 rounded-full border-0 py-1 pl-2.5 pr-7 text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500', JOB_STATUS_BADGE[job.status])}
      >
        {JOB_STATUSES.map((s) => (
          <option key={s} value={s}>
            {JOB_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${name}`}
        className="shrink-0 rounded p-1.5 text-slate-400 opacity-0 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
      >
        <Icon name="trash" className="size-4" />
      </button>
    </li>
  );
}
