import { useMemo, useState, type Ref } from 'react';
import { formatDue } from '../lib/dates';
import { parseQuickAdd, type ParsedToken } from '../lib/parseQuickAdd';
import { RECURRENCE_LABELS } from '../lib/recurrence';
import { cx } from '../lib/text';
import { PRIORITY_LABELS, type ISODate, type TaskList } from '../store/types';
import type { NewTaskInput } from '../store/tasks';
import { Icon, type IconName } from './Icon';

interface QuickAddProps {
  today: ISODate;
  lists: TaskList[];
  /** Applied when the text does not say otherwise: the list or tag you are currently looking at. */
  defaults: { listId?: string; tag?: string; due?: ISODate };
  onAdd: (input: NewTaskInput) => void;
  inputRef?: Ref<HTMLInputElement>;
}

function chipLabel(token: ParsedToken, today: ISODate, lists: TaskList[]): { icon: IconName; text: string } {
  switch (token.kind) {
    case 'due':
      return { icon: 'calendar', text: formatDue(token.value, today) };
    case 'recurrence':
      return { icon: 'repeat', text: RECURRENCE_LABELS[token.value] };
    case 'priority':
      return { icon: 'flag', text: PRIORITY_LABELS[token.value] };
    case 'tag':
      return { icon: 'tag', text: token.value };
    case 'list':
      return { icon: 'inbox', text: lists.find((l) => l.id === token.value)?.name ?? token.raw };
  }
}

export function QuickAdd({ today, lists, defaults, onAdd, inputRef }: QuickAddProps) {
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());

  const parsed = useMemo(() => parseQuickAdd(text, { today, lists, ignored }), [text, today, lists, ignored]);

  const submit = () => {
    if (!parsed.title) return;
    const tags = defaults.tag && !parsed.tags.includes(defaults.tag) ? [...parsed.tags, defaults.tag] : parsed.tags;
    onAdd({
      title: parsed.title,
      due: parsed.due ?? defaults.due ?? null,
      priority: parsed.priority,
      tags,
      listId: parsed.listId ?? defaults.listId,
      recurrence: parsed.recurrence,
    });
    setText('');
    setIgnored(new Set());
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900 dark:focus-within:border-indigo-500"
    >
      <div className="flex items-center gap-2 px-3">
        <Icon name="plus" className="size-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <input
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={400}
          aria-label="Add a task"
          placeholder='Add a task, e.g. "Pay rent every month !high #bills"'
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-3.5 text-[15px] outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={!parsed.title}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
        >
          Add
        </button>
      </div>

      {parsed.tokens.length > 0 && (
        <ul aria-label="Detected details" className="flex flex-wrap gap-1.5 border-t border-slate-100 px-3 py-2 dark:border-slate-800">
          {parsed.tokens.map((token) => {
            const { icon, text: label } = chipLabel(token, today, lists);
            return (
              <li key={`${token.kind}:${token.raw}`}>
                <span
                  className={cx(
                    'inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pl-2 pr-1 text-xs font-medium text-indigo-700',
                    'dark:bg-indigo-500/15 dark:text-indigo-300',
                  )}
                >
                  <Icon name={icon} className="size-3" />
                  {label}
                  <button
                    type="button"
                    aria-label={`Don't treat "${token.raw}" as ${token.kind === 'due' ? 'a date' : token.kind}`}
                    onClick={() => setIgnored((prev) => new Set(prev).add(token.raw.toLowerCase()))}
                    className="rounded-full p-0.5 hover:bg-indigo-100 dark:hover:bg-indigo-500/25"
                  >
                    <Icon name="x" className="size-3" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
