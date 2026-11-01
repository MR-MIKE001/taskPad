import { LIMITS } from '../store/types';

/** Lowercase, `#`-less, hyphenated tag; empty string when nothing usable remains. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, LIMITS.tag);
}

export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const tag of raw) {
    const normalized = normalizeTag(tag);
    if (normalized) seen.add(normalized);
    if (seen.size >= LIMITS.tagsPerTask) break;
  }
  return [...seen];
}

/** Collapses whitespace and trims. */
export function cleanTitle(raw: string, max: number = LIMITS.title): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Key used to match `@list-name` mentions against list names. */
export function listSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers / insecure contexts.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
