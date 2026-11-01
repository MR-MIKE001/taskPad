import type { ReactNode } from 'react';
import { LIST_DOT } from '../lib/colors';
import type { Counts } from '../lib/selectors';
import { cx } from '../lib/text';
import { viewKey } from '../hooks/useHashView';
import { INBOX_ID, type TaskList, type ThemePref, type View } from '../store/types';
import { Icon, type IconName } from './Icon';

interface SidebarProps {
  view: View;
  counts: Counts;
  jobs: { active: number; followUpsDue: number };
  lists: TaskList[];
  theme: ThemePref;
  open: boolean;
  onNavigate: (view: View) => void;
  onClose: () => void;
  onNewList: () => void;
  onEditList: (list: TaskList) => void;
  onThemeChange: (theme: ThemePref) => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
  onImport: () => void;
  onShortcuts: () => void;
}

function NavButton({ active, onClick, icon, children, count, alert }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode; count?: number; alert?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cx(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
        active
          ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70',
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {count !== undefined && count > 0 && (
        <span className={cx('text-xs tabular-nums', alert ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500')}>{count}</span>
      )}
    </button>
  );
}

const THEMES: Array<{ value: ThemePref; icon: IconName; label: string }> = [
  { value: 'light', icon: 'sun', label: 'Light theme' },
  { value: 'system', icon: 'monitor', label: 'Match system theme' },
  { value: 'dark', icon: 'moon', label: 'Dark theme' },
];

export function Sidebar(props: SidebarProps) {
  const { view, counts, lists, theme, open, onNavigate, onClose } = props;
  const go = (next: View) => {
    onNavigate(next);
    onClose();
  };
  const isActive = (target: View) => viewKey(view) === viewKey(target);

  const smart: Array<{ view: View; label: string; icon: IconName; count?: number; alert?: boolean }> = [
    { view: { kind: 'today' }, label: 'Today', icon: 'sun', count: counts.today, alert: counts.overdue > 0 },
    { view: { kind: 'upcoming' }, label: 'Upcoming', icon: 'calendar', count: counts.upcoming },
    { view: { kind: 'inbox' }, label: 'Inbox', icon: 'inbox', count: counts.inbox },
    { view: { kind: 'all' }, label: 'All tasks', icon: 'layers', count: counts.all },
    { view: { kind: 'completed' }, label: 'Completed', icon: 'checkCircle' },
  ];

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label="Sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-slate-50 transition-transform dark:border-slate-800 dark:bg-slate-950',
          'lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pb-2 pt-5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Icon name="check" className="size-5" strokeWidth={3} />
          </span>
          <div>
            <p className="text-base font-semibold leading-none">Taskpad</p>
            <p className="mt-1 text-[11px] leading-none text-slate-500">Private. Stored on this device.</p>
          </div>
        </div>

        <nav aria-label="Views" className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
          <div className="space-y-0.5">
            {smart.map((item) => (
              <NavButton
                key={item.label}
                active={isActive(item.view)}
                onClick={() => go(item.view)}
                icon={<Icon name={item.icon} />}
                count={item.count}
                alert={item.alert}
              >
                {item.label}
              </NavButton>
            ))}
          </div>

          <div>
            <h2 className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Career</h2>
            {/* A due follow-up turns the count red and shows how many need chasing; otherwise it counts active applications. */}
            <NavButton
              active={isActive({ kind: 'jobs' })}
              onClick={() => go({ kind: 'jobs' })}
              icon={<Icon name="briefcase" />}
              count={props.jobs.followUpsDue > 0 ? props.jobs.followUpsDue : props.jobs.active}
              alert={props.jobs.followUpsDue > 0}
            >
              Job applications
            </NavButton>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between px-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Lists</h2>
              <button
                type="button"
                onClick={props.onNewList}
                aria-label="New list"
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <Icon name="plus" className="size-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {lists
                .filter((l) => l.id !== INBOX_ID)
                .map((list) => (
                  <li key={list.id} className="group relative">
                    <NavButton
                      active={isActive({ kind: 'list', id: list.id })}
                      onClick={() => go({ kind: 'list', id: list.id })}
                      icon={<span className={cx('size-2.5 rounded-full', LIST_DOT[list.color])} />}
                      count={counts.byList[list.id]}
                    >
                      {list.name}
                    </NavButton>
                    <button
                      type="button"
                      onClick={() => props.onEditList(list)}
                      aria-label={`Edit list ${list.name}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-slate-50 p-1 text-slate-400 opacity-0 hover:text-slate-700 focus-visible:opacity-100 group-hover:opacity-100 dark:bg-slate-950 dark:hover:text-slate-200"
                    >
                      <Icon name="pencil" className="size-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
            {lists.length <= 1 && <p className="px-2.5 py-1 text-xs text-slate-400">Group tasks into lists like Work or Home.</p>}
          </div>

          {counts.tags.length > 0 && (
            <div>
              <h2 className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Tags</h2>
              <ul className="space-y-0.5">
                {counts.tags.slice(0, 20).map(({ tag, count }) => (
                  <li key={tag}>
                    <NavButton active={isActive({ kind: 'tag', tag })} onClick={() => go({ kind: 'tag', tag })} icon={<Icon name="tag" className="size-3.5" />} count={count}>
                      {tag}
                    </NavButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-200/60 p-1 dark:bg-slate-900">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                aria-label={t.label}
                title={t.label}
                onClick={() => props.onThemeChange(t.value)}
                className={cx(
                  'flex justify-center rounded-md py-1.5 transition-colors',
                  theme === t.value ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
                )}
              >
                <Icon name={t.icon} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 text-xs">
            {(
              [
                ['Export JSON', 'download', props.onExportJSON],
                ['Export CSV', 'download', props.onExportCSV],
                ['Import', 'upload', props.onImport],
                ['Shortcuts', 'keyboard', props.onShortcuts],
              ] as const
            ).map(([text, icon, run]) => (
              <button
                key={text}
                type="button"
                onClick={() => {
                  run();
                  onClose();
                }}
                className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-slate-600 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Icon name={icon} className="size-3.5" />
                {text}
              </button>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
