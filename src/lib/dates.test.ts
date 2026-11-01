import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffInDays, formatDue, isValidISODate, makeISODate, nextBusinessDay, nextWeekday, weekdayOf } from './dates';

describe('dates', () => {
  it('validates real calendar dates only', () => {
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
    expect(isValidISODate('2026-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-1-1')).toBe(false);
    expect(isValidISODate(20260101)).toBe(false);
    expect(makeISODate(2026, 2, 30)).toBeNull();
  });

  it('adds days across month, year and leap boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('clamps months to the last valid day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('is unaffected by daylight saving transitions', () => {
    expect(diffInDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(diffInDays('2026-11-02', '2026-10-31')).toBe(2);
  });

  it('finds weekdays', () => {
    expect(weekdayOf('2026-10-31')).toBe(6); // Saturday
    expect(nextWeekday('2026-10-31', 1)).toBe('2026-11-02'); // next Monday
    expect(nextWeekday('2026-11-02', 1)).toBe('2026-11-09'); // strictly after
    expect(nextBusinessDay('2026-10-30')).toBe('2026-11-02'); // Friday -> Monday
  });

  it('labels due dates relative to today', () => {
    const today = '2026-10-31';
    expect(formatDue('2026-10-31', today, 'en-US')).toBe('Today');
    expect(formatDue('2026-11-01', today, 'en-US')).toBe('Tomorrow');
    expect(formatDue('2026-10-30', today, 'en-US')).toBe('Yesterday');
    expect(formatDue('2026-11-04', today, 'en-US')).toBe('Wed');
    expect(formatDue('2026-12-25', today, 'en-US')).toBe('Dec 25');
    expect(formatDue('2027-01-05', today, 'en-US')).toBe('Jan 5, 2027');
  });
});
