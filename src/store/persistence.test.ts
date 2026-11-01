import { describe, expect, it, vi } from 'vitest';
import { mergeData, parseImport, toCSV, csvCell } from '../lib/exportData';
import { DATA_KEY, loadData, parseStored, sanitize, saveData } from './persistence';
import { createInitialData } from './reducer';
import { createTask } from './tasks';
import { INBOX_ID } from './types';

describe('sanitize', () => {
  it('repairs malformed tasks and drops unusable ones', () => {
    const data = sanitize({
      version: 1,
      lists: [{ id: 'L', name: '  Work  ', color: 'neon' }, { id: 'L', name: 'dup' }, { name: 'no id' }, 5],
      tasks: [
        { id: 'a', title: '  Hello   world ', listId: 'ghost', priority: 9, due: '2026-02-30', tags: ['#Big Deal', 7], recurrence: 'yearly', completedAt: 'x' },
        { id: 'a', title: 'duplicate id' },
        { id: 'b', title: '' },
        { title: 'no id' },
        null,
      ],
    });
    expect(data.lists).toEqual([
      { id: INBOX_ID, name: 'Inbox', color: 'slate' },
      { id: 'L', name: 'Work', color: 'slate' },
    ]);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0]).toMatchObject({ title: 'Hello world', listId: INBOX_ID, priority: 0, due: null, tags: ['big-deal'], recurrence: null });
  });

  it('survives non-objects', () => {
    expect(sanitize(null)).toEqual(createInitialData());
    expect(sanitize('x')).toEqual(createInitialData());
    expect(sanitize([])).toEqual(createInitialData());
  });
});

describe('storage', () => {
  it('starts empty, round-trips, and reports status', () => {
    expect(loadData().status.kind).toBe('empty');
    const data = { ...createInitialData(), tasks: [createTask({ title: 'Persist me' }, 1)] };
    expect(saveData(data)).toEqual({ ok: true });
    const loaded = loadData();
    expect(loaded.status.kind).toBe('ok');
    expect(loaded.data.tasks[0]?.title).toBe('Persist me');
  });

  it('keeps a backup of corrupt data instead of destroying it', () => {
    localStorage.setItem(DATA_KEY, '{not json');
    const result = loadData();
    expect(result.status.kind).toBe('corrupt');
    expect(result.data).toEqual(createInitialData());
    const backups = Object.keys(localStorage).filter((k) => k.startsWith('taskpad:data:corrupt:'));
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0] ?? '')).toBe('{not json');
  });

  it('flags data from a newer version', () => {
    const result = parseStored(JSON.stringify({ version: 99, tasks: [], lists: [] }));
    expect(result.status).toEqual({ kind: 'newer', version: 99 });
  });

  it('reports quota errors', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveData(createInitialData())).toEqual({ ok: false, reason: 'quota' });
    spy.mockRestore();
  });
});

describe('import / export', () => {
  it('rejects things that are not exports', () => {
    expect(parseImport('').ok).toBe(false);
    expect(parseImport('nope').ok).toBe(false);
    expect(parseImport('[]').ok).toBe(false);
    expect(parseImport('{"hello":1}').ok).toBe(false);
  });

  it('accepts an export and counts it', () => {
    const result = parseImport(JSON.stringify({ version: 1, lists: [{ id: 'L', name: 'Work', color: 'blue' }], tasks: [{ id: 'a', title: 'x' }] }));
    expect(result).toMatchObject({ ok: true, taskCount: 1, listCount: 1 });
  });

  it('merges by id with imported tasks winning', () => {
    const current = { ...createInitialData(), tasks: [createTask({ title: 'old' }, 1, 1, 'a'), createTask({ title: 'keep' }, 2, 1, 'b')] };
    const incoming = { ...createInitialData(), tasks: [createTask({ title: 'new' }, 1, 2, 'a'), createTask({ title: 'extra' }, 3, 2, 'c')] };
    const merged = mergeData(current, incoming);
    expect(merged.tasks.map((t) => `${t.id}:${t.title}`).sort()).toEqual(['a:new', 'b:keep', 'c:extra']);
  });

  it('guards CSV against formula injection and escapes quotes', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    const csv = toCSV({ ...createInitialData(), tasks: [createTask({ title: '=1+1', tags: ['a'] }, 1)] });
    expect(csv.split('\r\n')[1]).toMatch(/^'=1\+1,Inbox,open,/);
  });
});
