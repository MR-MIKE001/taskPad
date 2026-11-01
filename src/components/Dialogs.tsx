import { useRef, useState } from 'react';
import { mergeData, parseImport, type ImportResult } from '../lib/exportData';
import { LIST_DOT } from '../lib/colors';
import { cx } from '../lib/text';
import { INBOX_ID, LIMITS, LIST_COLORS, type AppData, type TaskList } from '../store/types';
import { Dialog } from './Dialog';

const buttonBase = 'rounded-lg px-3 py-2 text-sm font-medium';
export const secondaryButton = cx(buttonBase, 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800');
export const primaryButton = cx(buttonBase, 'bg-indigo-600 text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50');
export const dangerButton = cx(buttonBase, 'bg-red-600 text-white hover:bg-red-500');

// --- Confirm ---------------------------------------------------------------------------------------------------

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} width="max-w-sm">
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButton}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={dangerButton}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

// --- List create / edit ----------------------------------------------------------------------------------------

export function ListDialog({
  open,
  list,
  existingNames,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  /** `null` creates a new list. */
  list: TaskList | null;
  existingNames: string[];
  onClose: () => void;
  onCreate: (name: string, color: TaskList['color']) => void;
  onUpdate: (id: string, patch: Partial<Omit<TaskList, 'id'>>) => void;
  onDelete: (list: TaskList) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={list ? 'Edit list' : 'New list'} width="max-w-sm">
      {open && <ListForm key={list?.id ?? 'new'} list={list} existingNames={existingNames} onClose={onClose} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} />}
    </Dialog>
  );
}

function ListForm({ list, existingNames, onClose, onCreate, onUpdate, onDelete }: Omit<Parameters<typeof ListDialog>[0], 'open'>) {
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState<TaskList['color']>(list?.color ?? 'blue');
  const trimmed = name.trim().replace(/\s+/g, ' ');
  const duplicate = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== list?.name);
  const valid = trimmed !== '' && !duplicate;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        if (list) onUpdate(list.id, { name: trimmed, color });
        else onCreate(trimmed, color);
        onClose();
      }}
    >
      <div>
        <label htmlFor="list-name" className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
          Name
        </label>
        <input
          id="list-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.listName}
          autoFocus
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-950"
        />
        {duplicate && <p className="mt-1 text-xs text-red-600">A list with this name already exists.</p>}
      </div>
      <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
        {LIST_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={color === c}
            aria-label={c}
            onClick={() => setColor(c)}
            className={cx('size-7 rounded-full ring-offset-2 ring-offset-white dark:ring-offset-slate-900', LIST_DOT[c], color === c && 'ring-2 ring-slate-900 dark:ring-slate-100')}
          />
        ))}
      </div>
      <div className="flex items-center justify-between pt-1">
        {list && list.id !== INBOX_ID ? (
          <button type="button" onClick={() => onDelete(list)} className={cx(buttonBase, 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40')}>
            Delete list
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" disabled={!valid} className={primaryButton}>
            {list ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  );
}

// --- Import ----------------------------------------------------------------------------------------------------

export function ImportDialog({
  open,
  current,
  onClose,
  onImport,
}: {
  open: boolean;
  current: AppData;
  onClose: () => void;
  onImport: (data: AppData, mode: 'merge' | 'replace') => void;
}) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const close = () => {
    setResult(null);
    setFileName('');
    onClose();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    if (file.size > 20 * 1024 * 1024) {
      setResult({ ok: false, error: 'That file is larger than 20 MB, which is far beyond a normal export.' });
      return;
    }
    setResult(parseImport(await file.text()));
  };

  return (
    <Dialog open={open} onClose={close} title="Import tasks" width="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300">Choose a JSON file exported from Taskpad. Nothing leaves your device.</p>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Choose a Taskpad JSON export"
        onChange={(e) => void onFile(e.target.files?.[0])}
        className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200 dark:file:bg-slate-800 dark:hover:file:bg-slate-700"
      />
      {result && !result.ok && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {result.error}
        </p>
      )}
      {result?.ok && (
        <div className="mt-4 space-y-3">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <strong>{fileName}</strong> has {result.taskCount} task{result.taskCount === 1 ? '' : 's'} and {result.listCount} list{result.listCount === 1 ? '' : 's'}
            {result.jobCount > 0 && `, plus ${result.jobCount} job application${result.jobCount === 1 ? '' : 's'}`}. You currently have {current.tasks.length}.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={close} className={secondaryButton}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                onImport(result.data, 'merge');
                close();
              }}
              className={primaryButton}
            >
              Merge with current
            </button>
            <button
              type="button"
              onClick={() => {
                onImport(result.data, 'replace');
                close();
              }}
              className={dangerButton}
            >
              Replace everything
            </button>
          </div>
          <p className="text-xs text-slate-500">Either choice can be undone right after with Ctrl+Z.</p>
        </div>
      )}
    </Dialog>
  );
}

export function applyImport(current: AppData, incoming: AppData, mode: 'merge' | 'replace'): AppData {
  return mode === 'replace' ? incoming : mergeData(current, incoming);
}

// --- Shortcuts -------------------------------------------------------------------------------------------------

const SHORTCUTS: Array<[string, string]> = [
  ['N or /', 'Focus the add box'],
  ['Ctrl+K', 'Search'],
  ['Ctrl+Z', 'Undo'],
  ['Ctrl+Shift+Z', 'Redo'],
  ['G then T / U / I / A / J', 'Go to Today, Upcoming, Inbox, All, Jobs'],
  ['?', 'Show this help'],
  ['Ctrl+Enter', 'Save inside the task editor'],
  ['Space, arrows', 'Pick up, move and drop a task using the drag handle'],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" width="max-w-md">
      <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
        {SHORTCUTS.map(([keys, what]) => (
          <div key={keys} className="flex items-baseline justify-between gap-4 py-2">
            <dt>
              <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800">{keys}</kbd>
            </dt>
            <dd className="text-right text-slate-600 dark:text-slate-300">{what}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mb-1 mt-5 text-sm font-semibold">Quick add syntax</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Type naturally and Taskpad picks out the details:{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">Call mum friday !high #family</code>. It understands dates (
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">tomorrow</code>, <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">in 2 weeks</code>,{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">nov 5</code>), repeats (<code className="rounded bg-slate-100 px-1 dark:bg-slate-800">every week</code>), priority (
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">!1</code> to <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">!3</code>), tags and{' '}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">@list</code> names. Click the × on a highlighted chip to keep that word as plain text.
      </p>
    </Dialog>
  );
}
