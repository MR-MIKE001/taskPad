import { describe, expect, it } from 'vitest';
import { parseQuickAdd } from './parseQuickAdd';

const today = '2026-10-31'; // Saturday
const lists = [
  { id: 'inbox', name: 'Inbox' },
  { id: 'w1', name: 'Work' },
  { id: 'h1', name: 'Home Projects' },
];
const parse = (text: string, ignored: string[] = []) => parseQuickAdd(text, { today, lists, ignored: new Set(ignored) });

describe('parseQuickAdd', () => {
  it('leaves plain text alone', () => {
    const r = parse('Buy milk');
    expect(r).toMatchObject({ title: 'Buy milk', due: null, priority: 0, tags: [], listId: null, recurrence: null, tokens: [] });
  });

  it('extracts keywords and weekdays, swallowing prepositions', () => {
    expect(parse('Call mum tomorrow')).toMatchObject({ title: 'Call mum', due: '2026-11-01' });
    expect(parse('Report by friday')).toMatchObject({ title: 'Report', due: '2026-11-06' });
    expect(parse('today standup')).toMatchObject({ title: 'standup', due: today });
    expect(parse('Lunch next monday')).toMatchObject({ title: 'Lunch', due: '2026-11-02' });
  });

  it('handles relative and absolute dates', () => {
    expect(parse('Dentist in 3 days').due).toBe('2026-11-03');
    expect(parse('Review in 2 weeks').due).toBe('2026-11-14');
    expect(parse('Pay tax nov 5').due).toBe('2026-11-05');
    expect(parse('Pay tax 5 nov').due).toBe('2026-11-05');
    expect(parse('Trip jan 3 2027').due).toBe('2027-01-03');
    expect(parse('Due 2026-12-24').due).toBe('2026-12-24');
    // A past month/day rolls to next year.
    expect(parse('Anniversary jan 3').due).toBe('2027-01-03');
  });

  it('rejects impossible dates instead of guessing', () => {
    const r = parse('Party feb 30');
    expect(r.due).toBeNull();
    expect(r.title).toBe('Party feb 30');
  });

  it('does not match inside other words', () => {
    expect(parse('Buy sunscreen').due).toBeNull();
    expect(parse("Monday's notes").due).toBeNull();
    expect(parse('Read #friday').due).toBeNull();
    expect(parse('Plan the mayday event').due).toBeNull();
  });

  it('parses priority, tags and lists', () => {
    const r = parse('Finish deck !high #work #Slides @work');
    expect(r).toMatchObject({ title: 'Finish deck', priority: 3, tags: ['work', 'slides'], listId: 'w1' });
    expect(parse('x !2').priority).toBe(2);
    expect(parse('Fix @home-projects').listId).toBe('h1');
    // Unknown list stays in the title.
    expect(parse('Email @nobody')).toMatchObject({ listId: null, title: 'Email @nobody' });
  });

  it('parses recurrence and anchors it to a date', () => {
    expect(parse('Pay rent every month')).toMatchObject({ recurrence: 'monthly', due: today, title: 'Pay rent' });
    expect(parse('Gym every monday')).toMatchObject({ recurrence: 'weekly', due: '2026-11-02', title: 'Gym' });
    expect(parse('Standup weekdays')).toMatchObject({ recurrence: 'weekdays', due: '2026-11-02' });
    expect(parse('Water plants daily tomorrow')).toMatchObject({ recurrence: 'daily', due: '2026-11-01' });
  });

  it('uses only the first date and first priority', () => {
    const r = parse('Task friday saturday !1 !3');
    expect(r.due).toBe('2026-11-06');
    expect(r.priority).toBe(1);
  });

  it('treats dismissed phrases as plain text', () => {
    const r = parse('Call friday', ['friday']);
    expect(r.due).toBeNull();
    expect(r.title).toBe('Call friday');
  });

  it('keeps a sensible title and offsets', () => {
    const r = parse('  Email   Sam   tomorrow   #work  ');
    expect(r.title).toBe('Email Sam');
    expect(r.tokens.map((t) => t.kind).sort()).toEqual(['due', 'tag']);
  });

  it('returns an empty title when everything was consumed', () => {
    expect(parse('tomorrow #x').title).toBe('');
  });
});
