import { useToasts } from '../hooks/useToasts';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex animate-toast items-center gap-3 rounded-xl bg-slate-900 py-2 pl-4 pr-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.run();
                dismiss(toast.id);
              }}
              className="rounded-lg px-2.5 py-1 font-semibold text-indigo-300 hover:bg-white/10 dark:text-indigo-600 dark:hover:bg-slate-900/10"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
