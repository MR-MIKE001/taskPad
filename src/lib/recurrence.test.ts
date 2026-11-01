import { describe, expect, it } from 'vitest';
import { nextDueAfterCompletion, nextOccurrence } from './recurrence';

describe('recurrence', () => {
  it('computes the next occurrence for each rule', () => {
    expect(nextOccurrence('2026-10-31', 'daily')).toBe('2026-11-01');
    expect(nextOccurrence('2026-10-30', 'weekdays')).toBe('2026-11-02');
    expect(nextOccurrence('2026-10-31', 'weekly')).toBe('2026-11-07');
    expect(nextOccurrence('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  it('skips past occurrences when completed late', () => {
    // Due 5 days ago, finished today: next is tomorrow, not 4 days ago.
    expect(nextDueAfterCompletion('2026-10-26', 'daily', '2026-10-31')).toBe('2026-11-01');
    expect(nextDueAfterCompletion('2026-10-01', 'weekly', '2026-10-31')).toBe('2026-11-05');
  });

  it('schedules normally when completed early', () => {
    expect(nextDueAfterCompletion('2026-11-10', 'weekly', '2026-10-31')).toBe('2026-11-17');
  });
});
