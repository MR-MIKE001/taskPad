import type { ReactNode } from 'react';
import { useStore } from '../store/StoreContext';
import { Icon } from './Icon';

function Banner({ tone, children, actions }: { tone: 'warn' | 'error'; children: ReactNode; actions?: ReactNode }) {
  const colors = tone === 'error' ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200';
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 text-sm ${colors}`}>
      <Icon name="alert" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{children}</p>
      {actions}
    </div>
  );
}

const linkButton = 'rounded-md px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline';

/** Surfaces every way persistence can go wrong, because silent data loss is the worst failure a task app has. */
export function StorageBanner({ onExport }: { onExport: () => void }) {
  const { loadStatus, saveState, allowOverwrite, dismissLoadStatus } = useStore();

  if (loadStatus.kind === 'unavailable' || saveState === 'unavailable') {
    return (
      <Banner tone="error" actions={<button type="button" onClick={onExport} className={linkButton}>Export a backup</button>}>
        Your browser is blocking storage (private mode?). Tasks work for now but will be lost when you close this tab.
      </Banner>
    );
  }
  if (saveState === 'quota') {
    return (
      <Banner tone="error" actions={<button type="button" onClick={onExport} className={linkButton}>Export a backup</button>}>
        Browser storage is full, so recent changes are not being saved. Export a backup and delete some completed tasks.
      </Banner>
    );
  }
  if (loadStatus.kind === 'newer') {
    return (
      <Banner
        tone="warn"
        actions={
          <button type="button" onClick={allowOverwrite} className={linkButton}>
            Allow saving anyway
          </button>
        }
      >
        This data was saved by a newer version of Taskpad. It is shown read-only so it is not damaged.
      </Banner>
    );
  }
  if (loadStatus.kind === 'corrupt') {
    return (
      <Banner
        tone="warn"
        actions={
          <button type="button" onClick={dismissLoadStatus} className={linkButton}>
            Dismiss
          </button>
        }
      >
        Saved data could not be read, so you are starting fresh.{' '}
        {loadStatus.backupKey ? 'The unreadable data was kept in your browser storage in case it can be recovered.' : ''}
      </Banner>
    );
  }
  return null;
}
