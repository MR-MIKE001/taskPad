import { useCallback, useEffect, useState } from 'react';
import { INBOX_ID, type View } from '../store/types';

/** `#/today`, `#/jobs`, `#/list/<id>`, `#/tag/<name>`. Hash routing needs no server config, so it works on any static host. */
export function parseHash(hash: string): View {
  const [, kind, ...rest] = hash.replace(/^#/, '').split('/');
  const param = decodeURIComponent(rest.join('/'));
  switch (kind) {
    case 'inbox':
    case 'today':
    case 'upcoming':
    case 'all':
    case 'completed':
    case 'jobs':
      return { kind };
    case 'list':
      return param ? { kind: 'list', id: param } : { kind: 'inbox' };
    case 'tag':
      return param ? { kind: 'tag', tag: param } : { kind: 'all' };
    default:
      return { kind: 'today' };
  }
}

export function viewToHash(view: View): string {
  switch (view.kind) {
    case 'list':
      return view.id === INBOX_ID ? '#/inbox' : `#/list/${encodeURIComponent(view.id)}`;
    case 'tag':
      return `#/tag/${encodeURIComponent(view.tag)}`;
    default:
      return `#/${view.kind}`;
  }
}

export function viewKey(view: View): string {
  return viewToHash(view);
}

export function useHashView(): [View, (view: View) => void] {
  const [view, setView] = useState<View>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setView(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: View) => {
    const hash = viewToHash(next);
    if (window.location.hash === hash) return;
    window.location.hash = hash;
  }, []);

  return [view, navigate];
}
