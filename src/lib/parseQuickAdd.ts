import type { ISODate, Priority, RecurrenceRule, TaskList } from '../store/types';
import { LIMITS } from '../store/types';
import { addDays, addMonths, makeISODate, nextWeekday, sameOrNextBusinessDay } from './dates';
import { cleanTitle, listSlug, normalizeTag } from './text';

/**
 * Natural-language quick add: "Pay rent every month !high #bills @home" becomes a title plus structured fields.
 *
 *   dates        today, tomorrow, tmr, fri, next monday, next week, in 3 days, in 2 weeks, nov 5, 5 nov 2027, 2026-11-05
 *                (a leading "on", "by", "due" or "before" is swallowed: "report by friday" -> "report")
 *   repeat       every day, every weekday, every week, every month, every monday, daily, weekdays, weekly, monthly
 *   priority     !1 !2 !3, !low !med !high !urgent
 *   tags         #groceries
 *   list         @work (must match an existing list name; spaces become dashes)
 *
 * Every recognised phrase comes back in `tokens` so the UI can show it as a chip and let the user dismiss it
 * (dismissed phrases go in `ignored`, lowercased, and are then treated as ordinary title text).
 */

export type ParsedToken =
  | { kind: 'due'; raw: string; value: ISODate }
  | { kind: 'priority'; raw: string; value: Priority }
  | { kind: 'tag'; raw: string; value: string }
  | { kind: 'list'; raw: string; value: string }
  | { kind: 'recurrence'; raw: string; value: RecurrenceRule };

export interface ParsedQuickAdd {
  title: string;
  due: ISODate | null;
  priority: Priority;
  tags: string[];
  listId: string | null;
  recurrence: RecurrenceRule | null;
  tokens: ParsedToken[];
}

export interface ParseContext {
  today: ISODate;
  lists: ReadonlyArray<Pick<TaskList, 'id' | 'name'>>;
  /** Lowercased token texts the user dismissed. */
  ignored?: ReadonlySet<string>;
}

interface Candidate {
  start: number;
  end: number;
  token: ParsedToken;
  /** For `every monday`: the date the series should start on if no explicit date is given. */
  dueHint?: ISODate;
}

const WEEKDAYS = 'sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat';
const MONTHS = 'january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec';
const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MONTH_INDEX: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// A phrase must not start or end inside a larger word ("Monday's", "sunscreen", "#friday").
const BEFORE = String.raw`(?<![\p{L}\p{N}_#@!])`;
const AFTER = String.raw`(?![\p{L}\p{N}_'’])`;
const PREPOSITION = String.raw`(?:(?:on|by|due|before)\s+)?`;

function phrase(core: string): RegExp {
  return new RegExp(`${BEFORE}(${PREPOSITION})(${core})${AFTER}`, 'giu');
}

const weekdayIndex = (name: string) => WEEKDAY_INDEX[name.slice(0, 3).toLowerCase()] ?? 0;
const monthIndex = (name: string) => MONTH_INDEX[name.slice(0, 3).toLowerCase()] ?? 1;

const EVERY = phrase(String.raw`every\s+(day|weekdays?|week|month|${WEEKDAYS})`);
const ADVERB = phrase(String.raw`daily|weekdays|weekly|monthly`);
const RELATIVE = phrase(String.raw`in\s+(\d{1,3})\s*(days?|d|weeks?|w|months?|mo)`);
const NEXT = phrase(String.raw`next\s+(week|month|${WEEKDAYS})`);
const KEYWORD = phrase(String.raw`today|tonight|tomorrow|tmrw|tmr`);
const MONTH_DAY = phrase(String.raw`(${MONTHS})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?`);
const DAY_MONTH = phrase(String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(${MONTHS})\.?(?:,?\s+(\d{4}))?`);
const ISO = phrase(String.raw`(\d{4})-(\d{2})-(\d{2})`);
const WEEKDAY = phrase(WEEKDAYS);

const PRIORITY = /(?<!\S)(!(?:1|2|3|low|medium|med|high|urgent))(?![\p{L}\p{N}_])/giu;
const TAG = /(?<!\S)(#[\p{L}\p{N}_-]+)/gu;
const MENTION = /(?<!\S)(@[\p{L}\p{N}_-]+)/gu;

const PRIORITY_WORDS: Record<string, Priority> = { '1': 1, low: 1, '2': 2, med: 2, medium: 2, '3': 3, high: 3, urgent: 3 };

/** Resolves "month day [year]" to the next such date on or after today when no year is given. */
function resolveMonthDay(month: number, day: number, yearText: string | undefined, today: ISODate): ISODate | null {
  const todayYear = Number(today.slice(0, 4));
  if (yearText) return makeISODate(Number(yearText), month, day);
  const thisYear = makeISODate(todayYear, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return makeISODate(todayYear + 1, month, day);
}

export function parseQuickAdd(input: string, ctx: ParseContext): ParsedQuickAdd {
  const { today, lists, ignored } = ctx;
  const candidates: Candidate[] = [];

  /** Registers a match unless the user dismissed its text. `core` is the matched phrase without the preposition. */
  const consider = (match: RegExpExecArray, core: string, build: (raw: string) => Omit<Candidate, 'start' | 'end'> | null, prefixLength: number) => {
    const raw = core.trim();
    if (ignored?.has(raw.toLowerCase())) return;
    const built = build(raw);
    if (!built) return;
    const start = match.index;
    candidates.push({ ...built, start, end: match.index + prefixLength + core.length + (match[0].length - prefixLength - core.length) });
  };

  const scan = (re: RegExp, build: (match: RegExpExecArray, raw: string) => Omit<Candidate, 'start' | 'end'> | null) => {
    for (const match of input.matchAll(re)) {
      const m = match as RegExpExecArray;
      const prefix = m[1] ?? '';
      const core = m[2] ?? '';
      consider(m, core, (raw) => build(m, raw), prefix.length);
    }
  };

  // --- recurrence -------------------------------------------------------------------------------------------
  scan(EVERY, (m, raw) => {
    const what = (m[3] ?? '').toLowerCase();
    if (what === 'day') return { token: { kind: 'recurrence', raw, value: 'daily' } };
    if (what.startsWith('weekday')) return { token: { kind: 'recurrence', raw, value: 'weekdays' } };
    if (what === 'week') return { token: { kind: 'recurrence', raw, value: 'weekly' } };
    if (what === 'month') return { token: { kind: 'recurrence', raw, value: 'monthly' } };
    return { token: { kind: 'recurrence', raw, value: 'weekly' }, dueHint: nextWeekday(today, weekdayIndex(what)) };
  });
  scan(ADVERB, (_m, raw) => {
    const word = raw.toLowerCase();
    const value: RecurrenceRule = word === 'daily' ? 'daily' : word === 'weekdays' ? 'weekdays' : word === 'weekly' ? 'weekly' : 'monthly';
    return { token: { kind: 'recurrence', raw, value } };
  });

  // --- dates ------------------------------------------------------------------------------------------------
  scan(RELATIVE, (m, raw) => {
    const amount = Number(m[3]);
    const unit = (m[4] ?? '').toLowerCase();
    if (!amount) return null;
    const value = unit.startsWith('d') ? addDays(today, amount) : unit.startsWith('w') ? addDays(today, amount * 7) : addMonths(today, amount);
    return { token: { kind: 'due', raw, value } };
  });
  scan(NEXT, (m, raw) => {
    const what = (m[3] ?? '').toLowerCase();
    const value = what === 'week' ? nextWeekday(today, 1) : what === 'month' ? addMonths(today, 1) : nextWeekday(today, weekdayIndex(what));
    return { token: { kind: 'due', raw, value } };
  });
  scan(KEYWORD, (_m, raw) => {
    const word = raw.toLowerCase();
    return { token: { kind: 'due', raw, value: word === 'today' || word === 'tonight' ? today : addDays(today, 1) } };
  });
  scan(MONTH_DAY, (m, raw) => {
    const value = resolveMonthDay(monthIndex(m[3] ?? ''), Number(m[4]), m[5], today);
    return value ? { token: { kind: 'due', raw, value } } : null;
  });
  scan(DAY_MONTH, (m, raw) => {
    const value = resolveMonthDay(monthIndex(m[4] ?? ''), Number(m[3]), m[5], today);
    return value ? { token: { kind: 'due', raw, value } } : null;
  });
  scan(ISO, (m, raw) => {
    const value = makeISODate(Number(m[3]), Number(m[4]), Number(m[5]));
    return value ? { token: { kind: 'due', raw, value } } : null;
  });
  scan(WEEKDAY, (m, raw) => ({ token: { kind: 'due', raw, value: nextWeekday(today, weekdayIndex(m[3] ?? raw)) } }));

  // --- symbols: !priority #tag @list -------------------------------------------------------------------------
  const symbol = (re: RegExp, build: (raw: string) => ParsedToken | null) => {
    for (const match of input.matchAll(re)) {
      const raw = match[1] ?? '';
      if (ignored?.has(raw.toLowerCase())) continue;
      const token = build(raw);
      if (token) candidates.push({ start: match.index, end: match.index + raw.length, token });
    }
  };
  symbol(PRIORITY, (raw) => ({ kind: 'priority', raw, value: PRIORITY_WORDS[raw.slice(1).toLowerCase()] ?? 0 }));
  symbol(TAG, (raw) => {
    const value = normalizeTag(raw);
    return value ? { kind: 'tag', raw, value } : null;
  });
  symbol(MENTION, (raw) => {
    const slug = listSlug(raw.slice(1));
    const list = lists.find((l) => listSlug(l.name) === slug);
    return list ? { kind: 'list', raw, value: list.id } : null;
  });

  // --- choose a non-overlapping set; earliest wins, longer wins ties; one due/priority/recurrence/list each ----
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const accepted: Candidate[] = [];
  const taken = new Set<ParsedToken['kind']>();
  let lastEnd = -1;
  for (const candidate of candidates) {
    if (candidate.start < lastEnd) continue;
    const kind = candidate.token.kind;
    if (kind !== 'tag' && taken.has(kind)) continue;
    accepted.push(candidate);
    taken.add(kind);
    lastEnd = candidate.end;
  }

  // --- assemble ---------------------------------------------------------------------------------------------
  let title = '';
  let cursor = 0;
  for (const candidate of accepted) {
    title += input.slice(cursor, candidate.start) + ' ';
    cursor = candidate.end;
  }
  title += input.slice(cursor);
  title = cleanTitle(title.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, ''));

  let due: ISODate | null = null;
  let priority: Priority = 0;
  let listId: string | null = null;
  let recurrence: RecurrenceRule | null = null;
  let dueHint: ISODate | undefined;
  const tags: string[] = [];
  const tokens: ParsedToken[] = [];

  for (const { token, dueHint: hint } of accepted) {
    switch (token.kind) {
      case 'due':
        due = token.value;
        break;
      case 'priority':
        priority = token.value;
        break;
      case 'list':
        listId = token.value;
        break;
      case 'recurrence':
        recurrence = token.value;
        dueHint = hint;
        break;
      case 'tag':
        if (!tags.includes(token.value) && tags.length < LIMITS.tagsPerTask) tags.push(token.value);
        break;
    }
    tokens.push(token);
  }

  // A repeating task needs an anchor date: use the hint ("every monday"), else today (next business day for weekdays).
  if (recurrence && !due) {
    due = dueHint ?? (recurrence === 'weekdays' ? sameOrNextBusinessDay(today) : today);
  }

  return { title, due, priority, tags, listId, recurrence, tokens };
}
