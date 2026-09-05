/**
 * The same shape of gap `../localVersions.ts` documents, one route smaller:
 * `gis/imports_router.py` has `GET /gis/imports/{id}` but no LIST route at
 * all — nothing enumerates past batches. This keeps a browser-local history
 * of import ids this session has created or opened, capped, so returning to
 * the tab after a reload still shows something to click on rather than a
 * blank screen demanding the id be retyped from memory.
 */
const KEY = 'gis.recent-imports.v1';
const MAX_ENTRIES = 20;

function safeGet(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function safeSet(value: string): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Storage full or blocked — the id the caller already has in hand still
    // works for the rest of this page's lifetime.
  }
}

export function rememberImport(importId: string): void {
  const existing = recentImports().filter((id) => id !== importId);
  const next = [importId, ...existing].slice(0, MAX_ENTRIES);
  safeSet(JSON.stringify(next));
}

export function recentImports(): string[] {
  const raw = safeGet();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
