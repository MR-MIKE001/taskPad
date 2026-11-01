import type { CSSProperties, HTMLAttributes, Ref } from 'react';
import { describeDue, formatDue, formatLongDate } from '../lib/dates';
import { LIST_DOT, PRIORITY_RING, PRIORITY_TEXT } from '../lib/colors';
import { isOverdue, subtaskProgress } from '../lib/selectors';
import { cx } from '../lib/text';
import { PRIORITY_LABELS, type ISODate, type Task, type TaskList } from '../store/types';
import { Icon } from './Icon';

export interface TaskRowProps {
  task: Task;
  list: TaskList | undefined;
  today: ISODate;
  /** Show the list chip (hidden inside a list view, where it would be redundant). */
  showList: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  /** Drag support; omitted when the row is not sortable. */
  drag?: {
    setNodeRef: Ref<HTMLLIElement>;
    style: CSSProperties;
    isDragging: boolean;
    handleProps: HTMLAttributes<HTMLButtonElement>;
  };
}

export function TaskRow({ task, list, today, showList, onToggle, onOpen, onDelete, onTagClick, drag }: TaskRowProps) {
  const done = task.completedAt !== null;
  const overdue = isOverdue(task, today);
  const { done: subDone, total: subTotal } = subtaskProgress(task);

  return (
    <li
      ref={drag?.setNodeRef}
      style={drag?.style}
      data-testid="task-row"
      className={cx(
        'group relative flex items-start gap-1 rounded-xl border border-transparent px-1.5 py-2 transition-colors',
        'hover:border-slate-200 hover:bg-white dark:hover:border-slate-800 dark:hover:bg-slate-900',
        'focus-within:border-slate-200 focus-within:bg-white dark:focus-within:border-slate-800 dark:focus-within:bg-slate-900',
        drag?.isDragging && 'z-10 border-indigo-300 bg-white shadow-lg dark:border-indigo-500/60 dark:bg-slate-900',
      )}
    >
      {drag ? (
        <button
          type="button"
          aria-label={`Reorder "${task.title}". Press space, then use arrow keys.`}
          className="mt-0.5 cursor-grab touch-none rounded p-1 text-slate-300 opacity-0 transition-opacity hover:text-slate-500 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing dark:text-slate-600 dark:hover:text-slate-400 max-sm:opacity-60"
          {...drag.handleProps}
        >
          <Icon name="grip" className="size-4" />
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        onClick={() => onToggle(task.id)}
        className="mt-0.5 shrink-0 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500"
      >
        <span
          className={cx(
            'flex size-[18px] items-center justify-center rounded-full border-2 transition-colors',
            done ? 'border-indigo-600 bg-indigo-600 text-white' : cx(PRIORITY_RING[task.priority], 'hover:bg-slate-100 dark:hover:bg-slate-800'),
          )}
        >
          {done && <Icon name="check" className="size-3 animate-pop" strokeWidth={3.5} />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="block w-full rounded text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <span
            className={cx(
              'block break-words text-[15px] leading-snug',
              done ? 'text-slate-400 line-through decoration-slate-300 dark:text-slate-500 dark:decoration-slate-600' : 'text-slate-900 dark:text-slate-100',
            )}
          >
            {task.title}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 empty:hidden">
          {task.due && (
            <span
              title={`${formatLongDate(task.due)}. ${describeDue(task.due, today)}`}
              className={cx('inline-flex items-center gap-1', overdue && !done && 'font-medium text-red-600 dark:text-red-400')}
            >
              <Icon name="calendar" className="size-3.5" />
              {formatDue(task.due, today)}
              {overdue && !done && <span className="sr-only"> (overdue)</span>}
            </span>
          )}
          {task.recurrence && (
            <span className="inline-flex items-center gap-1" title={`Repeats ${task.recurrence}`}>
              <Icon name="repeat" className="size-3.5" />
              <span className="sr-only">Repeats {task.recurrence}</span>
            </span>
          )}
          {task.priority > 0 && (
            <span className={cx('inline-flex items-center gap-1', PRIORITY_TEXT[task.priority])}>
              <Icon name="flag" className="size-3.5" />
              {PRIORITY_LABELS[task.priority]}
              <span className="sr-only"> priority</span>
            </span>
          )}
          {subTotal > 0 && (
            <span className="inline-flex items-center gap-1" title={`${subDone} of ${subTotal} subtasks done`}>
              <Icon name="checkCircle" className="size-3.5" />
              {subDone}/{subTotal}
            </span>
          )}
          {task.notes && (
            <span className="inline-flex items-center" title="Has notes">
              <Icon name="notes" className="size-3.5" />
              <span className="sr-only">Has notes</span>
            </span>
          )}
          {showList && list && (
            <span className="inline-flex items-center gap-1.5">
              <span className={cx('size-2 rounded-full', LIST_DOT[list.color])} aria-hidden="true" />
              {list.name}
            </span>
          )}
          {task.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick(tag)}
              className="rounded text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-400"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDelete(task.id)}
        aria-label={`Delete "${task.title}"`}
        className="mt-0.5 shrink-0 rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400 max-sm:opacity-60"
      >
        <Icon name="trash" />
      </button>
    </li>
  );
}
