import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, ImportDialog, ListDialog, ShortcutsDialog, applyImport } from './components/Dialogs';
import { AuthorCredit } from './components/AuthorCredit';
import { Icon } from './components/Icon';
import { JobsView } from './components/JobsView';
import { QuickAdd } from './components/QuickAdd';
import { Sidebar } from './components/Sidebar';
import { StorageBanner } from './components/StorageBanner';
import { TaskDialog } from './components/TaskDialog';
import { TaskListView } from './components/TaskListView';
import { Toasts } from './components/Toasts';
import { useHashView } from './hooks/useHashView';
import { useHotkeys } from './hooks/useHotkeys';
import { usePrefs } from './hooks/usePrefs';
import { useToasts } from './hooks/useToasts';
import { useToday } from './hooks/useToday';
import { downloadFile } from './lib/download';
import { jobsToCSV, toCSV, toJSON } from './lib/exportData';
import { computeJobStats } from './lib/jobs';
import { formatDayHeading } from './lib/dates';
import { computeCounts, groupByDay, isOpen, visibleTasks } from './lib/selectors';
import { cx } from './lib/text';
import { useStore } from './store/StoreContext';
import { type SortKey, type Task, type TaskList, type View } from './store/types';

const SORT_LABELS: Record<SortKey, string> = {
  manual: 'Manual order',
  due: 'Due date',
  priority: 'Priority',
  created: 'Newest first',
  title: 'A to Z',
};

function titleFor(view: View, lists: TaskList[]): string {
  switch (view.kind) {
    case 'inbox':
      return 'Inbox';
    case 'today':
      return 'Today';
    case 'upcoming':
      return 'Upcoming';
    case 'all':
      return 'All tasks';
    case 'completed':
      return 'Completed';
    case 'list':
      return lists.find((l) => l.id === view.id)?.name ?? 'List';
    case 'tag':
      return `#${view.tag}`;
    case 'jobs':
      return 'Job applications';
  }
}

const EMPTY: Record<View['kind'], { title: string; hint: string }> = {
  today: { title: 'Nothing due today', hint: 'Enjoy the calm, or add something with a date like "tomorrow" or "friday".' },
  upcoming: { title: 'Nothing scheduled ahead', hint: 'Tasks with a future due date show up here, grouped by day.' },
  inbox: { title: 'Inbox is empty', hint: 'New tasks land here unless you pick a list.' },
  all: { title: 'No open tasks', hint: 'Add your first task above.' },
  completed: { title: 'Nothing completed yet', hint: 'Finished tasks are kept here until you clear them.' },
  list: { title: 'This list is empty', hint: 'Tasks you add while viewing a list go straight into it.' },
  tag: { title: 'No tasks with this tag', hint: 'Add #tags when creating a task to collect them here.' },
  // The jobs view renders its own empty states.
  jobs: { title: '', hint: '' },
};

export default function App() {
  const store = useStore();
  const { data } = store;
  const [prefs, updatePrefs] = usePrefs();
  const toasts = useToasts();
  const today = useToday();
  const [rawView, navigate] = useHashView();

  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listDialog, setListDialog] = useState<{ open: boolean; list: TaskList | null }>({ open: false, list: null });
  const [confirmListDelete, setConfirmListDelete] = useState<TaskList | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const addRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // A deleted list or stale link falls back to the inbox instead of showing a dead page.
  const view: View = rawView.kind === 'list' && !data.lists.some((l) => l.id === rawView.id) ? { kind: 'inbox' } : rawView;
  const title = titleFor(view, data.lists);

  const counts = useMemo(() => computeCounts(data.tasks, data.lists, today), [data.tasks, data.lists, today]);
  const jobStats = useMemo(() => computeJobStats(data.jobs, today), [data.jobs, today]);
  const tasks = useMemo(
    () => visibleTasks(data.tasks, view, { today, sort: prefs.sort, showCompleted: prefs.showCompleted, query }),
    // `view` is rebuilt each render; its serialised parts are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, view.kind, 'id' in view ? view.id : '', 'tag' in view ? view.tag : '', today, prefs.sort, prefs.showCompleted, query],
  );
  const listById = useMemo(() => new Map(data.lists.map((l) => [l.id, l])), [data.lists]);
  const grouped = view.kind === 'today' || view.kind === 'upcoming';
  const sections = useMemo(() => (grouped ? groupByDay(tasks, today) : []), [grouped, tasks, today]);
  const canDrag = !grouped && prefs.sort === 'manual' && query === '' && view.kind !== 'completed' && tasks.length > 1;
  const editing = editingId ? (data.tasks.find((t) => t.id === editingId) ?? null) : null;

  useEffect(() => {
    const open = view.kind === 'today' ? counts.today : counts.all;
    document.title = `${open > 0 && view.kind === 'today' ? `(${open}) ` : ''}${title} · Taskpad`;
  }, [title, counts.today, counts.all, view.kind]);

  // --- shortcuts --------------------------------------------------------------------------------------------
  const goPending = useRef(false);
  const goTimer = useRef<number | undefined>(undefined);
  const goTo = (target: View) => () => {
    if (!goPending.current) return;
    goPending.current = false;
    navigate(target);
  };
  useHotkeys([
    { key: 'n', run: () => addRef.current?.focus() },
    { key: '/', run: () => addRef.current?.focus() },
    { key: 'k', mod: true, allowInInput: true, run: () => searchRef.current?.focus() },
    { key: 'z', mod: true, shift: false, run: () => store.undo() },
    { key: 'z', mod: true, shift: true, run: () => store.redo() },
    { key: 'y', mod: true, run: () => store.redo() },
    { key: '?', run: () => setShortcutsOpen(true) },
    {
      key: 'g',
      run: () => {
        goPending.current = true;
        window.clearTimeout(goTimer.current);
        goTimer.current = window.setTimeout(() => (goPending.current = false), 1200);
      },
    },
    { key: 't', run: goTo({ kind: 'today' }) },
    { key: 'u', run: goTo({ kind: 'upcoming' }) },
    { key: 'i', run: goTo({ kind: 'inbox' }) },
    { key: 'a', run: goTo({ kind: 'all' }) },
    { key: 'j', run: goTo({ kind: 'jobs' }) },
  ]);

  // --- handlers ---------------------------------------------------------------------------------------------
  const deleteTask = (id: string) => {
    const task = data.tasks.find((t) => t.id === id);
    store.deleteTask(id);
    toasts.push(task ? `Deleted "${task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title}"` : 'Task deleted', { label: 'Undo', run: store.undo });
  };

  const deleteJob = (id: string) => {
    const job = data.jobs.find((j) => j.id === id);
    store.deleteJob(id);
    toasts.push(job ? `Deleted application to ${job.company}` : 'Application deleted', { label: 'Undo', run: store.undo });
  };

  const exportStamp = () => new Date().toISOString().slice(0, 10);
  const exportJSON = () => downloadFile(`taskpad-${exportStamp()}.json`, toJSON(data), 'application/json');
  const exportCSV = () => downloadFile(`taskpad-${exportStamp()}.csv`, toCSV(data), 'text/csv');
  const exportJobsCSV = () => downloadFile(`taskpad-jobs-${exportStamp()}.csv`, jobsToCSV(data.jobs), 'text/csv');

  const defaults = {
    listId: view.kind === 'list' ? view.id : undefined,
    tag: view.kind === 'tag' ? view.tag : undefined,
    due: view.kind === 'today' ? today : undefined,
  };

  const rowProps = {
    today,
    showList: view.kind !== 'list' && view.kind !== 'inbox',
    listFor: (task: Task) => listById.get(task.listId),
    onToggle: store.toggleTask,
    onOpen: setEditingId,
    onDelete: deleteTask,
    onTagClick: (tag: string) => navigate({ kind: 'tag', tag }),
  };

  const subtitle = (() => {
    const open = tasks.filter(isOpen).length;
    if (query) return `${tasks.length} result${tasks.length === 1 ? '' : 's'}`;
    if (view.kind === 'today' && counts.overdue > 0) return `${open} to do · ${counts.overdue} overdue`;
    if (view.kind === 'completed') return `${tasks.length} finished`;
    return `${open} open`;
  })();

  const iconButton = 'rounded-lg p-2 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

  // Shared by the task header and the jobs header.
  const menuButton = (
    <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Open menu" className={cx(iconButton, 'lg:hidden')}>
      <Icon name="menu" className="size-5" />
    </button>
  );
  const historyButtons = (
    <>
      <button type="button" onClick={store.undo} disabled={!store.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)" className={iconButton}>
        <Icon name="undo" className="size-[18px]" />
      </button>
      <button type="button" onClick={store.redo} disabled={!store.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)" className={iconButton}>
        <Icon name="redo" className="size-[18px]" />
      </button>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        view={view}
        counts={counts}
        jobs={{ active: jobStats.active, followUpsDue: jobStats.followUpsDue }}
        lists={data.lists}
        theme={prefs.theme}
        open={sidebarOpen}
        onNavigate={navigate}
        onClose={() => setSidebarOpen(false)}
        onNewList={() => {
          setListDialog({ open: true, list: null });
          setSidebarOpen(false);
        }}
        onEditList={(list) => {
          setListDialog({ open: true, list });
          setSidebarOpen(false);
        }}
        onThemeChange={(theme) => updatePrefs({ theme })}
        onExportJSON={exportJSON}
        onExportCSV={exportCSV}
        onImport={() => setImportOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          {view.kind === 'jobs' ? (
            <JobsView
              jobs={data.jobs}
              today={today}
              searchRef={searchRef}
              onAdd={(input) => store.addJob(input)}
              onUpdate={store.updateJob}
              onDelete={deleteJob}
              onExportCSV={exportJobsCSV}
              leading={menuButton}
              trailing={historyButtons}
            />
          ) : (
            <>
              <header className="sticky top-0 z-20 -mx-4 bg-slate-50/90 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:px-6 dark:bg-slate-950/90">
                <div className="flex items-center gap-2">
                  {menuButton}
                  <div className="min-w-0 flex-1">
                    <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
                  </div>
                  {historyButtons}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-40 flex-1">
                    <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setQuery('');
                          e.currentTarget.blur();
                        }
                      }}
                      aria-label="Search tasks"
                      placeholder="Search (Ctrl+K)"
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <Icon name="sort" className="size-4 text-slate-400" />
                    <span className="sr-only">Sort by</span>
                    <select
                      value={prefs.sort}
                      onChange={(e) => updatePrefs({ sort: e.target.value as SortKey })}
                      className="rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-sm outline-none focus:border-indigo-400 dark:border-slate-800 dark:bg-slate-900"
                    >
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                        <option key={key} value={key}>
                          {SORT_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {view.kind !== 'completed' && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <input type="checkbox" checked={prefs.showCompleted} onChange={(e) => updatePrefs({ showCompleted: e.target.checked })} className="size-4 accent-indigo-600" />
                      Show done
                    </label>
                  )}
                </div>
              </header>

              <div className="space-y-4">
                <StorageBanner onExport={exportJSON} />

                {view.kind !== 'completed' && <QuickAdd today={today} lists={data.lists} defaults={defaults} onAdd={(input) => store.addTask(input)} inputRef={addRef} />}

                {view.kind === 'completed' && counts.completed > 0 && (
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setConfirmClear(true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
                      Clear all completed
                    </button>
                  </div>
                )}

                {tasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
                    <p className="font-medium">{query ? 'No matching tasks' : EMPTY[view.kind].title}</p>
                    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{query ? 'Try fewer words, or clear the search.' : EMPTY[view.kind].hint}</p>
                  </div>
                ) : grouped ? (
                  <div className="space-y-5">
                    {sections.map((section) => (
                      <section key={section.key} aria-labelledby={`sec-${section.key}`}>
                        <h2 id={`sec-${section.key}`} className={cx('mb-1 px-1.5 text-xs font-semibold uppercase tracking-wide', section.due === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400')}>
                          {section.due === 'overdue' ? 'Overdue' : section.due === 'none' ? 'No date' : section.due ? formatDayHeading(section.due, today) : ''}
                          <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">{section.tasks.length}</span>
                        </h2>
                        <TaskListView tasks={section.tasks} sortable={false} onReorder={store.reorderTasks} {...rowProps} />
                      </section>
                    ))}
                  </div>
                ) : (
                  <TaskListView tasks={tasks} sortable={canDrag} onReorder={store.reorderTasks} {...rowProps} />
                )}

                {!canDrag && prefs.sort !== 'manual' && !grouped && tasks.length > 1 && (
                  <p className="px-1.5 text-xs text-slate-400">Drag to reorder is available with “Manual order” and no search.</p>
                )}
              </div>
            </>
          )}
          {/* On small screens the sidebar (and its credit) is hidden behind the menu, so repeat it here. */}
          <footer className="mt-12 text-center lg:hidden">
            <AuthorCredit />
          </footer>
        </div>
      </main>

      <TaskDialog
        task={editing}
        lists={data.lists}
        onClose={() => setEditingId(null)}
        onSave={(id, patch) => store.updateTask(id, patch)}
        onDelete={deleteTask}
      />

      <ListDialog
        open={listDialog.open}
        list={listDialog.list}
        existingNames={data.lists.map((l) => l.name)}
        onClose={() => setListDialog((s) => ({ ...s, open: false }))}
        onCreate={(name, color) => {
          const created = store.addList(name, color);
          if (created) navigate({ kind: 'list', id: created.id });
        }}
        onUpdate={store.updateList}
        onDelete={(list) => {
          setListDialog((s) => ({ ...s, open: false }));
          setConfirmListDelete(list);
        }}
      />

      <ConfirmDialog
        open={confirmListDelete !== null}
        title="Delete list?"
        message={`“${confirmListDelete?.name ?? ''}” will be removed. Its tasks are not deleted; they move to your Inbox.`}
        confirmLabel="Delete list"
        onClose={() => setConfirmListDelete(null)}
        onConfirm={() => {
          if (!confirmListDelete) return;
          store.deleteList(confirmListDelete.id);
          if (view.kind === 'list' && view.id === confirmListDelete.id) navigate({ kind: 'inbox' });
          toasts.push(`Deleted list “${confirmListDelete.name}”`, { label: 'Undo', run: store.undo });
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear completed tasks?"
        message={`${counts.completed} completed task${counts.completed === 1 ? '' : 's'} will be permanently removed. You can undo this right after.`}
        confirmLabel="Clear"
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          store.clearCompleted();
          toasts.push('Cleared completed tasks', { label: 'Undo', run: store.undo });
        }}
      />

      <ImportDialog
        open={importOpen}
        current={data}
        onClose={() => setImportOpen(false)}
        onImport={(incoming, mode) => {
          store.replaceData(applyImport(data, incoming, mode));
          toasts.push(mode === 'replace' ? 'Replaced your tasks with the import' : 'Imported and merged', { label: 'Undo', run: store.undo });
        }}
      />

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Toasts />
    </div>
  );
}

