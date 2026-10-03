import { useLocation } from 'react-router';

/** Router `state` for a list row's `navigate` / `<Link>`: the URL of this
 * list as it stands now (filters and page included), so the card it opens
 * can send the reader back to the same view — see `useBackToList`. */
export function useReturnHereState(): { from: string } {
  const location = useLocation();
  return { from: location.pathname + location.search };
}

/**
 * The target of a card's own "back to list" link. Browser Back restores the
 * filtered list URL by itself; a hard-coded `<Link to="/applications">`
 * does not, and would drop every filter the reader had set. When the list
 * row passed its URL as `state.from` (`useReturnHereState`) and that URL
 * really is this list, return it; otherwise — a card reached from a
 * dashboard, a notification, a pasted address — the bare `listPath`. The
 * check keeps a link labelled "back to applications" from ever leading
 * somewhere else.
 */
export function useBackToList(listPath: string): string {
  const location = useLocation();
  const from = (location.state as { from?: unknown } | null)?.from;
  if (typeof from === 'string' && (from === listPath || from.startsWith(`${listPath}?`))) return from;
  return listPath;
}
