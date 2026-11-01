/**
 * Generic undo/redo around any reducer. `revision` increments on every change to `present`, which gives
 * persistence a cheap "did anything change" signal without deep comparison.
 */

export interface History<S> {
  past: S[];
  present: S;
  future: S[];
  revision: number;
  /** Revision last written to storage (or adopted from it). */
  savedRevision: number;
}

export type HistoryAction<A> =
  | { type: 'history/apply'; action: A }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  /** Replace state without recording history (initial load, other-tab sync, import). */
  | { type: 'history/reset'; state: unknown }
  | { type: 'history/saved'; revision: number };

export const HISTORY_LIMIT = 100;

export function createHistory<S>(present: S): History<S> {
  return { past: [], present, future: [], revision: 0, savedRevision: 0 };
}

export function withHistory<S, A>(reduce: (state: S, action: A) => S, limit = HISTORY_LIMIT) {
  return (history: History<S>, action: HistoryAction<A>): History<S> => {
    switch (action.type) {
      case 'history/apply': {
        const next = reduce(history.present, action.action);
        if (Object.is(next, history.present)) return history;
        return { ...history, past: [...history.past, history.present].slice(-limit), present: next, future: [], revision: history.revision + 1 };
      }
      case 'history/undo': {
        const previous = history.past[history.past.length - 1];
        if (previous === undefined) return history;
        return {
          ...history,
          past: history.past.slice(0, -1),
          present: previous,
          future: [history.present, ...history.future],
          revision: history.revision + 1,
        };
      }
      case 'history/redo': {
        const [next, ...rest] = history.future;
        if (next === undefined) return history;
        return { ...history, past: [...history.past, history.present], present: next, future: rest, revision: history.revision + 1 };
      }
      case 'history/reset': {
        const revision = history.revision + 1;
        return { past: [], present: action.state as S, future: [], revision, savedRevision: revision };
      }
      case 'history/saved':
        return action.revision > history.savedRevision ? { ...history, savedRevision: action.revision } : history;
    }
  };
}
