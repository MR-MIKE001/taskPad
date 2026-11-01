import type { ISODate } from '../store/types';

/*
 * Due dates are plain calendar dates ("2026-11-05"), not timestamps. A task due on the 5th is due on the
 * 5th wherever you travel, and arithmetic is done on UTC calendar fields so daylight saving never skews it.
 */

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

export function toISODate(date: Date): ISODate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

function utcMs(iso: ISODate): number {
  const match = ISO_PATTERN.exec(iso);
  if (!match) throw new RangeError(`Invalid ISO date: ${iso}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function fromUtcMs(ms: number): ISODate {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isValidISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const match = ISO_PATTERN.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  // Round-trip catches impossible dates like 2026-02-30, which Date silently rolls over.
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Builds a date from parts, or null if it doesn't exist (e.g. Feb 30). */
export function makeISODate(year: number, month: number, day: number): ISODate | null {
  const iso = `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
  return isValidISODate(iso) ? iso : null;
}

export function addDays(iso: ISODate, days: number): ISODate {
  return fromUtcMs(utcMs(iso) + days * DAY_MS);
}

/** Adds calendar months, clamping the day (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(iso: ISODate, months: number): ISODate {
  const match = ISO_PATTERN.exec(iso);
  if (!match) throw new RangeError(`Invalid ISO date: ${iso}`);
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1 + months;
  const day = Number(match[3]);
  const target = new Date(Date.UTC(year, monthIndex, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${pad(target.getUTCFullYear(), 4)}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`;
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(iso: ISODate): number {
  return new Date(utcMs(iso)).getUTCDay();
}

/** Whole days from `b` to `a` (positive when `a` is later). */
export function diffInDays(a: ISODate, b: ISODate): number {
  return Math.round((utcMs(a) - utcMs(b)) / DAY_MS);
}

/** The next date strictly after `from` that falls on `weekday` (0 = Sunday). */
export function nextWeekday(from: ISODate, weekday: number): ISODate {
  const delta = (weekday - weekdayOf(from) + 7) % 7 || 7;
  return addDays(from, delta);
}

export function isWeekday(iso: ISODate): boolean {
  const day = weekdayOf(iso);
  return day >= 1 && day <= 5;
}

/** `from` itself if it's Monday to Friday, otherwise the following Monday. */
export function sameOrNextBusinessDay(from: ISODate): ISODate {
  let current = from;
  while (!isWeekday(current)) current = addDays(current, 1);
  return current;
}

export function nextBusinessDay(from: ISODate): ISODate {
  return sameOrNextBusinessDay(addDays(from, 1));
}

function formatter(options: Intl.DateTimeFormatOptions, locale?: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options });
}

const yearOf = (iso: ISODate) => Number(iso.slice(0, 4));

/** Short, human label for a due date: "Today", "Tomorrow", "Fri", "Nov 5", "Nov 5, 2027". */
export function formatDue(iso: ISODate, today: ISODate, locale?: string): string {
  const diff = diffInDays(iso, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const date = new Date(utcMs(iso));
  if (diff > 1 && diff < 7) return formatter({ weekday: 'short' }, locale).format(date);
  const sameYear = yearOf(iso) === yearOf(today);
  return formatter(sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }, locale).format(date);
}

/** Section heading for a day: "Tomorrow", "Mon, Nov 2", "Mon, Nov 2, 2027". */
export function formatDayHeading(iso: ISODate, today: ISODate, locale?: string): string {
  const diff = diffInDays(iso, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const sameYear = yearOf(iso) === yearOf(today);
  return formatter(
    sameYear ? { weekday: 'short', month: 'short', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
    locale,
  ).format(new Date(utcMs(iso)));
}

/** Full date for tooltips and screen readers: "Saturday, October 31, 2026". */
export function formatLongDate(iso: ISODate, locale?: string): string {
  return formatter({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, locale).format(new Date(utcMs(iso)));
}

/** "3 days overdue", "due today", "due in 2 days". */
export function describeDue(iso: ISODate, today: ISODate): string {
  const diff = diffInDays(iso, today);
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff === -1) return '1 day overdue';
  if (diff < 0) return `${-diff} days overdue`;
  return `Due in ${diff} days`;
}

/** Local calendar date of an epoch timestamp. */
export function isoFromTimestamp(ms: number): ISODate {
  return toISODate(new Date(ms));
}
