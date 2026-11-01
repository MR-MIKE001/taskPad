import { useCallback, useEffect, useState } from 'react';
import { loadPrefs, PREFS_KEY, sanitizePrefs, savePrefs } from '../store/persistence';
import type { Prefs } from '../store/types';

function applyTheme(theme: Prefs['theme']) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  useEffect(() => {
    applyTheme(prefs.theme);
    if (prefs.theme !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [prefs.theme]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== PREFS_KEY || event.newValue === null) return;
      try {
        setPrefs(sanitizePrefs(JSON.parse(event.newValue)));
      } catch {
        /* ignore malformed value */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }, []);

  return [prefs, update];
}
