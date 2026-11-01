import type { JobStatus, ListColor, Priority } from '../store/types';

/* Tailwind only generates classes it can see as complete strings, so every class is spelled out here. */

export const LIST_DOT: Record<ListColor, string> = {
  slate: 'bg-slate-400',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  green: 'bg-green-500',
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
};

export const PRIORITY_RING: Record<Priority, string> = {
  0: 'border-slate-300 dark:border-slate-600',
  1: 'border-sky-400',
  2: 'border-amber-400',
  3: 'border-red-500',
};

export const PRIORITY_TEXT: Record<Priority, string> = {
  0: 'text-slate-500',
  1: 'text-sky-600 dark:text-sky-400',
  2: 'text-amber-600 dark:text-amber-400',
  3: 'text-red-600 dark:text-red-400',
};

export const JOB_STATUS_BADGE: Record<JobStatus, string> = {
  wishlist: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  applied: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  interviewing: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  offer: 'bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300',
  rejected: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  withdrawn: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export const JOB_STATUS_DOT: Record<JobStatus, string> = {
  wishlist: 'bg-slate-400',
  applied: 'bg-blue-500',
  interviewing: 'bg-amber-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-500',
  withdrawn: 'bg-slate-300 dark:bg-slate-600',
};
