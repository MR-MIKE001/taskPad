import { describe, expect, it } from 'vitest';
import { jobsToCSV, mergeData } from './exportData';
import { applyJobPatch, computeJobStats, createJob, groupJobsByStatus, isFollowUpDue, matchesJobQuery, safeUrl, sanitizeJobs, type NewJobInput } from './jobs';
import { sanitize } from '../store/persistence';
import { createInitialData, reducer } from '../store/reducer';

const TODAY = '2026-11-01';
const job = (company: string, extra: Partial<NewJobInput> = {}, id = company) => createJob({ company, role: 'Engineer', ...extra }, TODAY, 1000, id);

describe('safeUrl', () => {
  it('keeps http(s), adds https to bare domains, and drops dangerous schemes', () => {
    expect(safeUrl('https://jobs.example.com/123')).toBe('https://jobs.example.com/123');
    expect(safeUrl('  jobs.example.com/apply ')).toBe('https://jobs.example.com/apply');
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(safeUrl('data:text/html,hi')).toBe('');
    expect(safeUrl('')).toBe('');
  });
});

describe('createJob / applyJobPatch', () => {
  it('defaults the applied date to today, except on the wishlist', () => {
    expect(job('Acme').appliedOn).toBe(TODAY);
    expect(job('Acme', { status: 'wishlist' }).appliedOn).toBeNull();
    expect(job('Acme', { appliedOn: '2026-10-01' }).appliedOn).toBe('2026-10-01');
  });

  it('records status changes in the timeline and stamps the applied date when leaving the wishlist', () => {
    const saved = job('Acme', { status: 'wishlist' });
    const applied = applyJobPatch(saved, { status: 'applied' }, 2000, '2026-11-03');
    expect(applied.history.map((h) => h.status)).toEqual(['wishlist', 'applied']);
    expect(applied.appliedOn).toBe('2026-11-03');
    // Editing other fields does not add timeline entries.
    expect(applyJobPatch(applied, { notes: 'hi' }, 3000, TODAY).history).toHaveLength(2);
  });

  it('cleans fields on edit', () => {
    const next = applyJobPatch(job('Acme'), { company: '  Big   Co ', url: 'javascript:x', followUp: '2026-02-30' }, 2, TODAY);
    expect(next).toMatchObject({ company: 'Big Co', url: '', followUp: null });
  });
});

describe('selectors', () => {
  it('computes stats including interview rate from history', () => {
    const rejectedAfterInterview = { ...job('B', { status: 'rejected' }), history: [{ status: 'interviewing' as const, at: 1 }, { status: 'rejected' as const, at: 2 }] };
    const stats = computeJobStats([job('A'), rejectedAfterInterview, job('C', { status: 'offer' }), job('D', { status: 'wishlist' })], TODAY);
    expect(stats.applied).toBe(3);
    expect(stats.active).toBe(3);
    expect(stats.interviewRate).toBeCloseTo(2 / 3);
    expect(computeJobStats([], TODAY).interviewRate).toBeNull();
  });

  it('flags due follow-ups only while the application is open', () => {
    expect(isFollowUpDue(job('A', { followUp: TODAY }), TODAY)).toBe(true);
    expect(isFollowUpDue(job('A', { followUp: '2026-11-02' }), TODAY)).toBe(false);
    expect(isFollowUpDue(job('A', { followUp: TODAY, status: 'rejected' }), TODAY)).toBe(false);
  });

  it('groups by status in pipeline order with due follow-ups first', () => {
    const sections = groupJobsByStatus(
      [job('Late', { status: 'interviewing' }), job('Old', { appliedOn: '2026-09-01' }), job('Chase', { appliedOn: '2026-08-01', followUp: TODAY }), job('New')],
      TODAY,
    );
    expect(sections.map((s) => s.status)).toEqual(['applied', 'interviewing']);
    expect(sections[0]?.jobs.map((j) => j.company)).toEqual(['Chase', 'New', 'Old']);
  });

  it('searches across company, role and notes', () => {
    const j = job('Acme', { notes: 'Referred by Sam' });
    expect(matchesJobQuery(j, 'acme engineer')).toBe(true);
    expect(matchesJobQuery(j, 'sam')).toBe(true);
    expect(matchesJobQuery(j, 'globex')).toBe(false);
  });
});

describe('persistence and export', () => {
  it('loads data saved before job tracking existed', () => {
    expect(sanitize({ version: 1, lists: [], tasks: [] }).jobs).toEqual([]);
  });

  it('repairs malformed jobs and drops unusable ones', () => {
    const jobs = sanitizeJobs([
      { id: 'a', company: ' Acme ', role: 'Dev', status: 'hired', url: 'javascript:bad', appliedOn: 'nope', history: [{ status: 'x' }] },
      { id: 'a', company: 'Duplicate', role: 'Dev' },
      { id: 'b', company: '', role: '' },
      { company: 'No id' },
      'junk',
    ]);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ company: 'Acme', status: 'applied', url: '', appliedOn: null });
    expect(jobs[0]?.history).toHaveLength(1);
  });

  it('merges jobs by id on import', () => {
    const current = { ...createInitialData(), jobs: [job('A'), job('B')] };
    const incoming = { ...createInitialData(), jobs: [{ ...job('B'), role: 'Lead' }, job('C')] };
    const merged = mergeData(current, incoming);
    expect(merged.jobs.map((j) => `${j.company}:${j.role}`)).toEqual(['A:Engineer', 'B:Lead', 'C:Engineer']);
  });

  it('exports CSV with formula injection neutralised', () => {
    const csv = jobsToCSV([job('=HYPERLINK("x")')]);
    expect(csv.split('\r\n')[0]).toBe('Company,Role,Status,Applied,Follow up,Location,Salary,Contact,URL,Notes,Created');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('reducer adds, updates and deletes jobs, ignoring unknown ids', () => {
    let state = reducer(createInitialData(), { type: 'job/add', job: job('A') });
    state = reducer(state, { type: 'job/update', id: 'A', patch: { status: 'interviewing' }, now: 5, today: TODAY });
    expect(state.jobs[0]?.status).toBe('interviewing');
    expect(reducer(state, { type: 'job/update', id: 'missing', patch: {}, now: 6, today: TODAY })).toBe(state);
    expect(reducer(state, { type: 'job/delete', id: 'missing' })).toBe(state);
    expect(reducer(state, { type: 'job/delete', id: 'A' }).jobs).toHaveLength(0);
  });
});
