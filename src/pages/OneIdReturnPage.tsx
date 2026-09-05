import { Navigate } from 'react-router';
import { ONEID_NEXT_KEY } from '../auth/AuthProvider';

/**
 * Cached for the lifetime of this page load, and that is load-bearing, not an
 * optimisation. `<StrictMode>` (see `main.tsx`) renders every component twice
 * in development: a plain read-and-delete would hand the first render the
 * stored path and the second one nothing, and the second answer is the one
 * that wins — the citizen would land on the dashboard, in dev only, with the
 * production build behaving differently. The browser arrives here by a full
 * page load every time (it is coming back from the identity provider through
 * the backend), so one load really is one hand-off.
 */
let consumed: string | null = null;

/**
 * Where `GET /auth/oneid/callback` sends the browser once it has set the
 * session cookies. Its only job is to consume the path `startOneId` stored
 * before the window left this origin.
 *
 * The stored value is treated as untrusted input even though this origin
 * wrote it: anything that is not a single-slash-prefixed relative path is
 * discarded, so a value planted by another script cannot turn this route into
 * an open redirect.
 */
function takeNext(): string {
  if (consumed !== null) return consumed;
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(ONEID_NEXT_KEY);
    // Cleared as it is read, so an unrelated later login on this tab cannot
    // inherit a destination the citizen has already been sent to.
    sessionStorage.removeItem(ONEID_NEXT_KEY);
  } catch {
    // Private mode, or storage disabled entirely.
  }
  consumed = !stored || !stored.startsWith('/') || stored.startsWith('//') ? '/' : stored;
  return consumed;
}

/** Test-only: the module cache above outlives a single test's render. */
// eslint-disable-next-line react-refresh/only-export-components -- test-only helper, not a component
export function resetOneIdReturnCache() {
  consumed = null;
}

export function OneIdReturnPage() {
  return <Navigate to={takeNext()} replace />;
}
