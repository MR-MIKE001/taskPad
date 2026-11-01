import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

interface ToastApi {
  toasts: Toast[];
  push: (message: string, action?: Toast['action']) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (message: string, action?: Toast['action']) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { id, message, action }]);
      // Toasts with an action (Undo) linger longer.
      window.setTimeout(() => dismiss(id), action ? 7000 : 3500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToasts(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToasts must be used inside <ToastProvider>');
  return value;
}
