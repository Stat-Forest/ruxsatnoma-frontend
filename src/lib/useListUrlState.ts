import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

const PAGE_KEY = 'page';

export interface ListUrlStateOptions {
  /** Namespace for every key, `page` included (`acts_result`, `acts_page`):
   * for lists that share one URL, such as the tabs of a tabbed screen that
   * stay mounted side by side and must not overwrite each other's state. */
  prefix?: string;
}

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
export function useListUrlState<F extends StringFilters<F>>(
  defaults: F,
  { prefix }: ListUrlStateOptions = {},
): ListUrlState<F> {
  const [params, setParams] = useSearchParams();

  // Every write starts from the params as they are NOW, never from the
  // render that created the setter. A debounced write (the search box's
  // 400 ms timer) holds the setter of the render that armed it; react-router's
  // own functional `setSearchParams(prev => …)` would hand that setter the
  // params of ITS render, and a status picked inside the debounce window
  // would be written over and silently lost. The ref follows the router
  // after every commit and is advanced eagerly on each write, so two writes
  // in one tick compose too.
  const live = useRef(params);
  useLayoutEffect(() => {
    live.current = params;
  }, [params]);
  const write = useCallback(
    (next: URLSearchParams) => {
      live.current = next;
      setParams(next, { replace: true });
    },
    [setParams],
  );

  const filters = useMemo(() => {
    const out = { ...defaults };
    for (const key of keysOf(defaults)) {
      const value = params.get(paramName(prefix, key));
      if (value !== null) (out as Record<string, string>)[key] = value;
    }
    return out;
  }, [params, defaults, prefix]);

  const page = parsePage(params.get(paramName(prefix, PAGE_KEY)));

  const setFilters = useCallback(
    (patch: Partial<F>) => {
      const prev = live.current;
      const next = new URLSearchParams(prev);
      let changed = false;
      for (const [key, value] of Object.entries(patch) as [string, string | undefined][]) {
        if (value === undefined) continue;
        const name = paramName(prefix, key);
        const current = prev.get(name) ?? defaultOf(defaults, key);
        if (current === value) continue;
        changed = true;
        if (value === defaultOf(defaults, key)) next.delete(name);
        else next.set(name, value);
      }
      if (!changed) return;
      next.delete(paramName(prefix, PAGE_KEY));
      write(next);
    },
    [write, defaults, prefix],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(live.current);
      if (nextPage <= 1) next.delete(paramName(prefix, PAGE_KEY));
      else next.set(paramName(prefix, PAGE_KEY), String(nextPage));
      write(next);
    },
    [write, prefix],
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams(live.current);
    for (const key of keysOf(defaults)) next.delete(paramName(prefix, key));
    next.delete(paramName(prefix, PAGE_KEY));
    write(next);
  }, [write, defaults, prefix]);

  return { filters, page, setFilters, setPage, reset };
}

function paramName(prefix: string | undefined, key: string): string {
  return prefix ? `${prefix}_${key}` : key;
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
