import { useEffect, useState } from 'react';
import { todayISO } from '../lib/dates';
import type { ISODate } from '../store/types';

/** Today's local date, refreshed at midnight and when the tab regains focus (laptops sleep through midnight). */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO());

  useEffect(() => {
    let timer: number | undefined;
    const refresh = () => setToday(todayISO());
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        refresh();
        schedule();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return today;
}
