import type { ISODate, RecurrenceRule } from '../store/types';
import { addDays, addMonths, nextBusinessDay } from './dates';

export const RECURRENCE_LABELS: Record<RecurrenceRule, string> = {
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Every week',
  monthly: 'Every month',
};

export const RECURRENCE_RULES = Object.keys(RECURRENCE_LABELS) as RecurrenceRule[];

export function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  return typeof value === 'string' && value in RECURRENCE_LABELS;
}

/** The occurrence after `due`. (Monthly clamps short months: Jan 31 becomes Feb 28, then Mar 28.) */
export function nextOccurrence(due: ISODate, rule: RecurrenceRule): ISODate {
  switch (rule) {
    case 'daily':
      return addDays(due, 1);
    case 'weekdays':
      return nextBusinessDay(due);
    case 'weekly':
      return addDays(due, 7);
    case 'monthly':
      return addMonths(due, 1);
  }
}

/**
 * The next due date when a recurring task is completed on `today`: the first occurrence that is both after
 * the old due date and after today. Finishing a daily task 5 days late schedules tomorrow, not 4 days ago.
 */
export function nextDueAfterCompletion(due: ISODate, rule: RecurrenceRule, today: ISODate): ISODate {
  let next = nextOccurrence(due, rule);
  for (let guard = 0; next <= today && guard < 10_000; guard++) {
    next = nextOccurrence(next, rule);
  }
  return next;
}
