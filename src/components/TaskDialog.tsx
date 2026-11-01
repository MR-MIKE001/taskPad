import { useState, type FormEvent } from 'react';
import { RECURRENCE_LABELS, RECURRENCE_RULES, isRecurrenceRule } from '../lib/recurrence';
import { isValidISODate } from '../lib/dates';
import { cleanTitle, cx, newId, normalizeTags } from '../lib/text';
import { LIMITS, PRIORITY_LABELS, type Priority, type Subtask, type Task, type TaskList } from '../store/types';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

interface TaskDialogProps {
  task: Task | null;
  lists: TaskList[];
  onClose: () => void;
  onSave: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950';
const label = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function TaskDialog({ task, lists, onClose, onSave, onDelete }: TaskDialogProps) {
  return (
    <Dialog open={task !== null} onClose={onClose} title="Edit task" width="max-w-xl">
      {task && <TaskForm key={task.id} task={task} lists={lists} onClose={onClose} onSave={onSave} onDelete={onDelete} />}
    </Dialog>
  );
}

function TaskForm({ task, lists, onClose, onSave, onDelete }: Omit<TaskDialogProps, 'task'> & { task: Task }) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [listId, setListId] = useState(task.listId);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [due, setDue] = useState(task.due ?? '');
  const [recurrence, setRecurrence] = useState(task.recurrence ?? '');
  const [tags, setTags] = useState(task.tags.join(' '));
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks);
  const [newSubtask, setNewSubtask] = useState('');

  const cleanedTitle = cleanTitle(title);
  const dueValid = due === '' || isValidISODate(due);
  // A repeating task needs a date to repeat from.
  const recurrenceNeedsDue = recurrence !== '' && due === '';
  const canSave = cleanedTitle !== '' && dueValid && !recurrenceNeedsDue;

  const addSubtask = () => {
    const text = cleanTitle(newSubtask);
    if (!text || subtasks.length >= LIMITS.subtasksPerTask) return;
    setSubtasks([...subtasks, { id: newId(), title: text, done: false }]);
    setNewSubtask('');
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSave) return;
    // Include a subtask typed but not yet added with Enter.
    const pending = cleanTitle(newSubtask);
    const finalSubtasks = pending ? [...subtasks, { id: newId(), title: pending, done: false }] : subtasks;
    onSave(task.id, {
      title: cleanedTitle,
      notes,
      listId,
      priority,
      due: due === '' ? null : due,
      recurrence: isRecurrenceRule(recurrence) ? recurrence : null,
      tags: normalizeTags(tags.split(/[\s,]+/)),
      subtasks: finalSubtasks,
    });
    onClose();
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="task-title" className={label}>
          Title
        </label>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} className={field} />
      </div>

      <div>
        <label htmlFor="task-notes" className={label}>
          Notes
        </label>
        <textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={LIMITS.notes} className={cx(field, 'resize-y')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="task-due" className={label}>
            Due date
          </label>
          <div className="flex gap-2">
            <input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
            {due && (
              <button type="button" onClick={() => setDue('')} className="rounded-lg px-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                Clear
              </button>
            )}
          </div>
        </div>
        <div>
          <label htmlFor="task-repeat" className={label}>
            Repeat
          </label>
          <select id="task-repeat" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={field}>
            <option value="">Does not repeat</option>
            {RECURRENCE_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {RECURRENCE_LABELS[rule]}
              </option>
            ))}
          </select>
          {recurrenceNeedsDue && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Pick a due date to repeat from.</p>}
        </div>
        <div>
          <label htmlFor="task-list" className={label}>
            List
          </label>
          <select id="task-list" value={listId} onChange={(e) => setListId(e.target.value)} className={field}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className={label} id="task-priority-label">
            Priority
          </span>
          <div role="radiogroup" aria-labelledby="task-priority-label" className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {([0, 1, 2, 3] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setPriority(p)}
                className={cx(
                  'rounded-md px-1 py-1 text-xs font-medium transition-colors',
                  priority === p ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100',
                )}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="task-tags" className={label}>
          Tags
        </label>
        <input id="task-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="home errands (space or comma separated)" className={field} />
      </div>

      <div>
        <span className={label}>Subtasks</span>
        <ul className="space-y-1">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={s.done}
                aria-label={`Subtask done: ${s.title}`}
                onChange={() => setSubtasks(subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                className="size-4 accent-indigo-600"
              />
              <span className={cx('flex-1 break-words text-sm', s.done && 'text-slate-400 line-through')}>{s.title}</span>
              <button
                type="button"
                aria-label={`Remove subtask: ${s.title}`}
                onClick={() => setSubtasks(subtasks.filter((x) => x.id !== s.id))}
                className="rounded p-1 text-slate-400 hover:text-red-600"
              >
                <Icon name="x" className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <input
            value={newSubtask}
            onChange={(e) => setNewSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                addSubtask();
              }
            }}
            aria-label="New subtask"
            placeholder="Add a subtask and press Enter"
            maxLength={LIMITS.title}
            className={field}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() => {
            onDelete(task.id);
            onClose();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <Icon name="trash" /> Delete
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}
