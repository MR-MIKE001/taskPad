import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../lib/dates';
import { createJob, type NewJobInput } from '../lib/jobs';
import { newId } from '../lib/text';
import { nextOrder } from '../lib/selectors';
import { createHistory, withHistory } from './history';
import { DATA_KEY, loadData, parseStored, saveData, type LoadStatus } from './persistence';
import { reducer, type Action } from './reducer';
import { createTask, type NewTaskInput } from './tasks';
import type { AppData, JobApplication, Task, TaskList } from './types';
import { LIST_COLORS, LIMITS } from './types';

const SAVE_DEBOUNCE_MS = 250;

export type SaveState = 'saved' | 'saving' | 'quota' | 'unavailable' | 'readonly';

export interface StoreApi {
  data: AppData;
  loadStatus: LoadStatus;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  addTask: (input: NewTaskInput) => Task;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
  reorderTasks: (ids: string[]) => void;
  clearCompleted: () => void;
  addList: (name: string, color?: TaskList['color']) => TaskList | null;
  updateList: (id: string, patch: Partial<Omit<TaskList, 'id'>>) => void;
  deleteList: (id: string) => void;
  addJob: (input: NewJobInput) => JobApplication;
  updateJob: (id: string, patch: Partial<NewJobInput>) => void;
  deleteJob: (id: string) => void;
  replaceData: (data: AppData) => void;
  undo: () => void;
  redo: () => void;
  /** Lets the user opt in to overwriting data written by a newer app version. */
  allowOverwrite: () => void;
  dismissLoadStatus: () => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function useStore(): StoreApi {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Read storage exactly once, during the first render.
  const [initial] = useState(loadData);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(initial.status);
  const [overwriteAllowed, setOverwriteAllowed] = useState(false);
  const [persistFailure, setPersistFailure] = useState<'quota' | 'unavailable' | null>(initial.status.kind === 'unavailable' ? 'unavailable' : null);

  const [history, dispatchHistory] = useReducer(
    useMemo(() => withHistory<AppData, Action>(reducer), []),
    initial.data,
    createHistory,
  );
  const data = history.present;
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  });

  const readOnly = loadStatus.kind === 'newer' && !overwriteAllowed;

  // --- persistence ------------------------------------------------------------------------------------------
  const flush = useCallback(() => {
    if (readOnly || history.savedRevision === history.revision) return;
    const result = saveData(dataRef.current);
    if (result.ok) {
      setPersistFailure(null);
      dispatchHistory({ type: 'history/saved', revision: history.revision });
    } else {
      setPersistFailure(result.reason);
    }
  }, [history.revision, history.savedRevision, readOnly]);

  // Debounced write after every change; the cleanup cancels a pending write when another change arrives.
  useEffect(() => {
    if (readOnly || history.savedRevision === history.revision) return;
    const timer = window.setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [history.revision, history.savedRevision, readOnly, flush]);

  // Don't lose the last edit when the tab is closed or backgrounded.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  // --- cross-tab sync ---------------------------------------------------------------------------------------
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DATA_KEY || event.newValue === null) return;
      const result = parseStored(event.newValue);
      if (result.status.kind !== 'ok') return;
      // `reset` marks the adopted state as already saved, so it is not written back (no ping-pong between tabs).
      dispatchHistory({ type: 'history/reset', state: result.data });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // --- actions ----------------------------------------------------------------------------------------------
  const apply = useCallback((action: Action) => dispatchHistory({ type: 'history/apply', action }), []);

  const api = useMemo<StoreApi>(
    () => ({
      data,
      loadStatus,
      saveState: readOnly ? 'readonly' : persistFailure ?? (history.savedRevision === history.revision ? 'saved' : 'saving'),
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      addTask: (input) => {
        const task = createTask(input, nextOrder(dataRef.current.tasks));
        apply({ type: 'task/add', task });
        return task;
      },
      updateTask: (id, patch) => apply({ type: 'task/update', id, patch, now: Date.now() }),
      toggleTask: (id) => apply({ type: 'task/toggle', id, now: Date.now(), today: todayISO(), spawnId: newId() }),
      deleteTask: (id) => apply({ type: 'task/delete', id }),
      reorderTasks: (ids) => apply({ type: 'task/reorder', ids }),
      clearCompleted: () => apply({ type: 'task/clearCompleted' }),
      addList: (name, color) => {
        const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, LIMITS.listName);
        const lists = dataRef.current.lists;
        if (!trimmed || lists.length > LIMITS.lists || lists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return null;
        const list: TaskList = { id: newId(), name: trimmed, color: color ?? LIST_COLORS[(lists.length * 2) % LIST_COLORS.length] ?? 'blue' };
        apply({ type: 'list/add', list });
        return list;
      },
      updateList: (id, patch) => apply({ type: 'list/update', id, patch }),
      deleteList: (id) => apply({ type: 'list/delete', id, now: Date.now() }),
      addJob: (input) => {
        const job = createJob(input, todayISO());
        apply({ type: 'job/add', job });
        return job;
      },
      updateJob: (id, patch) => apply({ type: 'job/update', id, patch, now: Date.now(), today: todayISO() }),
      deleteJob: (id) => apply({ type: 'job/delete', id }),
      replaceData: (next) => apply({ type: 'data/replace', data: next }),
      undo: () => dispatchHistory({ type: 'history/undo' }),
      redo: () => dispatchHistory({ type: 'history/redo' }),
      allowOverwrite: () => {
        setOverwriteAllowed(true);
        setLoadStatus({ kind: 'ok' });
      },
      dismissLoadStatus: () => setLoadStatus((s) => (s.kind === 'newer' ? s : { kind: 'ok' })),
    }),
    [data, loadStatus, readOnly, persistFailure, history.revision, history.savedRevision, history.past.length, history.future.length, apply],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}
