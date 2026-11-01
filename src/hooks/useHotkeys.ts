import { useEffect, useRef } from 'react';

export interface Hotkey {
  /** `event.key` value, e.g. "n", "/", "?". Case-insensitive for letters. */
  key: string;
  /** Require Ctrl (or Cmd on macOS). */
  mod?: boolean;
  shift?: boolean;
  /** Fire even while typing in an input. Only sensible with `mod` or Escape. */
  allowInInput?: boolean;
  run: (event: KeyboardEvent) => void;
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useHotkeys(hotkeys: Hotkey[]): void {
  const ref = useRef(hotkeys);
  useEffect(() => {
    ref.current = hotkeys;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      const mod = event.ctrlKey || event.metaKey;
      for (const hotkey of ref.current) {
        if (hotkey.key.toLowerCase() !== event.key.toLowerCase()) continue;
        if (Boolean(hotkey.mod) !== mod) continue;
        if (!hotkey.mod && (event.altKey || event.ctrlKey || event.metaKey)) continue;
        if (hotkey.shift !== undefined && hotkey.shift !== event.shiftKey) continue;
        if (!hotkey.allowInInput && isTyping(event.target)) continue;
        // Don't steal keys from an open dialog unless the hotkey opts in.
        if (!hotkey.allowInInput && document.querySelector('dialog[open]')) continue;
        event.preventDefault();
        hotkey.run(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
