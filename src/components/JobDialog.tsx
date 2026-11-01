import { useState, type FormEvent } from 'react';
import { isValidISODate } from '../lib/dates';
import { JOB_STATUS_LABELS, safeUrl, type NewJobInput } from '../lib/jobs';
import { JOB_STATUS_DOT } from '../lib/colors';
import { cleanTitle, cx } from '../lib/text';
import { JOB_STATUSES, LIMITS, type JobApplication, type JobStatus } from '../store/types';
import { Dialog } from './Dialog';
import { primaryButton, secondaryButton } from './Dialogs';
import { Icon } from './Icon';

interface JobDialogProps {
  open: boolean;
  /** `null` creates a new application. */
  job: JobApplication | null;
  onClose: () => void;
  onCreate: (input: NewJobInput) => void;
  onSave: (id: string, patch: Partial<NewJobInput>) => void;
  onDelete: (id: string) => void;
}

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950';
const label = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

const timeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export function JobDialog({ open, job, onClose, onCreate, onSave, onDelete }: JobDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={job ? 'Edit application' : 'New application'} width="max-w-xl">
      {open && <JobForm key={job?.id ?? 'new'} job={job} onClose={onClose} onCreate={onCreate} onSave={onSave} onDelete={onDelete} />}
    </Dialog>
  );
}

function JobForm({ job, onClose, onCreate, onSave, onDelete }: Omit<JobDialogProps, 'open'>) {
  const [company, setCompany] = useState(job?.company ?? '');
  const [role, setRole] = useState(job?.role ?? '');
  const [status, setStatus] = useState<JobStatus>(job?.status ?? 'applied');
  const [appliedOn, setAppliedOn] = useState(job?.appliedOn ?? '');
  const [followUp, setFollowUp] = useState(job?.followUp ?? '');
  const [location, setLocation] = useState(job?.location ?? '');
  const [salary, setSalary] = useState(job?.salary ?? '');
  const [url, setUrl] = useState(job?.url ?? '');
  const [contact, setContact] = useState(job?.contact ?? '');
  const [notes, setNotes] = useState(job?.notes ?? '');

  const datesValid = (appliedOn === '' || isValidISODate(appliedOn)) && (followUp === '' || isValidISODate(followUp));
  const urlInvalid = url.trim() !== '' && safeUrl(url) === '';
  const canSave = cleanTitle(company) !== '' && cleanTitle(role) !== '' && datesValid && !urlInvalid;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSave) return;
    const input = {
      company,
      role,
      status,
      location,
      salary,
      url,
      contact,
      notes,
      followUp: followUp === '' ? null : followUp,
    };
    if (job) {
      onSave(job.id, { ...input, appliedOn: appliedOn === '' ? null : appliedOn });
    } else {
      // Leaving "Applied on" blank on a new application lets it default to today.
      onCreate(appliedOn === '' ? input : { ...input, appliedOn });
    }
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="job-company" className={label}>
            Company
          </label>
          <input id="job-company" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={LIMITS.company} required autoFocus className={field} />
        </div>
        <div>
          <label htmlFor="job-role" className={label}>
            Role
          </label>
          <input id="job-role" value={role} onChange={(e) => setRole(e.target.value)} maxLength={LIMITS.role} required className={field} />
        </div>
        <div>
          <label htmlFor="job-status" className={label}>
            Status
          </label>
          <select id="job-status" value={status} onChange={(e) => setStatus(e.target.value as JobStatus)} className={field}>
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="job-location" className={label}>
            Location
          </label>
          <input id="job-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={LIMITS.jobField} placeholder="Remote, London…" className={field} />
        </div>
        <div>
          <label htmlFor="job-applied" className={label}>
            Applied on
          </label>
          <input id="job-applied" type="date" value={appliedOn} onChange={(e) => setAppliedOn(e.target.value)} className={field} />
          {!job && appliedOn === '' && status !== 'wishlist' && <p className="mt-1 text-xs text-slate-400">Defaults to today.</p>}
        </div>
        <div>
          <label htmlFor="job-followup" className={label}>
            Follow up on
          </label>
          <div className="flex gap-2">
            <input id="job-followup" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} className={field} />
            {followUp && (
              <button type="button" onClick={() => setFollowUp('')} className="rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="job-salary" className={label}>
            Salary
          </label>
          <input id="job-salary" value={salary} onChange={(e) => setSalary(e.target.value)} maxLength={LIMITS.jobField} placeholder="$90k–110k" className={field} />
        </div>
        <div>
          <label htmlFor="job-contact" className={label}>
            Contact
          </label>
          <input id="job-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={LIMITS.jobField} placeholder="Recruiter name or email" className={field} />
        </div>
      </div>

      <div>
        <label htmlFor="job-url" className={label}>
          Job posting link
        </label>
        {/* Plain text, not type="url": the browser would reject a bare domain that `safeUrl` happily accepts. */}
        <input id="job-url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} maxLength={LIMITS.url} placeholder="https://…" className={field} />
        {urlInvalid && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Use a web address starting with http:// or https://.</p>}
      </div>

      <div>
        <label htmlFor="job-notes" className={label}>
          Notes
        </label>
        <textarea id="job-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={LIMITS.notes} placeholder="Interview prep, questions to ask, who referred you…" className={cx(field, 'resize-y')} />
      </div>

      {job && job.history.length > 0 && (
        <div>
          <span className={label}>Timeline</span>
          <ol className="space-y-1.5 border-l border-slate-200 pl-4 dark:border-slate-700" aria-label="Status timeline">
            {job.history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="relative text-sm">
                <span className={cx('absolute -left-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-white dark:ring-slate-900', JOB_STATUS_DOT[h.status])} />
                <span className="font-medium">{JOB_STATUS_LABELS[h.status]}</span>
                <span className="ml-2 text-slate-500 dark:text-slate-400">{timeFormat.format(h.at)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {job ? (
          <button
            type="button"
            onClick={() => {
              onDelete(job.id);
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Icon name="trash" /> Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={!canSave} className={primaryButton}>
            {job ? 'Save' : 'Add application'}
          </button>
        </div>
      </div>
    </form>
  );
}
