import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

const PAGE_KEY = 'page';

/** Every filter is a string (the empty string standing for "not set"); an
 * interface with string members qualifies, no index signature needed. */
type StringFilters<F> = { [K in keyof F]: string };

export interface ListUrlState<F extends StringFilters<F>> {
  /** The applied filters, read from `?key=value`; an absent key is its default. */
  filters: F;
  /** 1-based page, read from `?page=`; absent or malformed reads as 1. */
  page: number;
  /** Merge a patch into the filters and return to page 1. A patch that
   * changes nothing is a no-op — no URL write, and the page stays. */
  setFilters: (patch: Partial<F>) => void;
  setPage: (page: number) => void;
  /** Every filter back to its default, page back to 1. */
  reset: () => void;
}

/**
 * A list screen's applied filters and page number, kept in the URL query
 * string rather than in `useState`. Component state dies with the component:
 * open a row's card, press Back, and a `useState` list is empty again. The
 * URL is what Back restores, so the list re-reads exactly what it showed.
 *
 * Only the keys of `defaults` (plus `page`) are owned by the hook; anything
 * else in the query string (`?tab=`, an arrival filter) is left as it was.
 * A value equal to its default is removed from the URL, never written, so
 * the address stays as short as what the reader actually chose. Writes
 * REPLACE the history entry: one Back from the card crosses every filter
 * change and lands on the list, not on each intermediate filter state.
 *
 * Pass `defaults` as a module-level constant: it is a memo dependency.
 */
export function useListUrlState<F extends StringFilters<F>>(defaults: F): ListUrlState<F> {
  const [params, setParams] = useSearchParams();

  const filters = useMemo(() => {
    const out = { ...defaults };
    for (const key of keysOf(defaults)) {
      const value = params.get(key);
      if (value !== null) (out as Record<string, string>)[key] = value;
    }
    return out;
  }, [params, defaults]);

  const page = parsePage(params.get(PAGE_KEY));

  const setFilters = useCallback(
    (patch: Partial<F>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          let changed = false;
          for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
            if (value === undefined) continue;
            const current = prev.get(key) ?? defaultOf(defaults, key);
            if (current === value) continue;
            changed = true;
            if (value === defaultOf(defaults, key)) next.delete(key);
            else next.set(key, value);
          }
          if (!changed) return prev;
          next.delete(PAGE_KEY);
          return next;
        },
        { replace: true },
      );
    },
    [setParams, defaults],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage <= 1) next.delete(PAGE_KEY);
          else next.set(PAGE_KEY, String(nextPage));
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of keysOf(defaults)) next.delete(key);
        next.delete(PAGE_KEY);
        return next;
      },
      { replace: true },
    );
  }, [setParams, defaults]);

  return { filters, page, setFilters, setPage, reset };
}

function keysOf<F extends StringFilters<F>>(defaults: F): string[] {
  return Object.keys(defaults);
}

function defaultOf<F extends StringFilters<F>>(defaults: F, key: string): string {
  return (defaults as Record<string, string>)[key];
}

function parsePage(raw: string | null): number {
  if (raw === null) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
