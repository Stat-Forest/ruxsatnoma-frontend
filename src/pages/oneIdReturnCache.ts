/**
 * Reads for the OneID "where was the citizen heading" value `startOneId`
 * stores before the window leaves this origin — one consuming read
 * (`takeNext`, for `OneIdReturnPage`) and one non-consuming read
 * (`peekStoredNext`, for `LoginPage`'s failure path). Split out of
 * `OneIdReturnPage.tsx` because a file that exports anything but components
 * breaks fast refresh (`react-refresh/only-export-components`) — and because
 * `resetOneIdReturnCache` needs to be callable from the test file without
 * pulling in the component.
 */
import { ONEID_NEXT_KEY } from '../auth/AuthProvider';

/**
 * The stored value is treated as untrusted input even though this origin
 * wrote it: anything that is not a single-slash-prefixed relative path is
 * discarded, so a value planted by another script cannot turn a redirect
 * into an open one. That includes a protocol-relative URL like
 * `//evil.example/steal` — it passes `startsWith('/')` but is still an
 * absolute (scheme-relative) target, so it needs its own explicit check.
 * Shared by both readers below so the rule can only be defined once.
 */
function sanitize(stored: string | null): string | null {
  return !stored || !stored.startsWith('/') || stored.startsWith('//') ? null : stored;
}

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
 */
export function takeNext(): string {
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
  consumed = sanitize(stored) ?? '/';
  return consumed;
}

/**
 * Where `LoginPage` recovers `next` after a failed OneID round trip. The
 * backend's `/login?error=oneid` redirect is a full page load, so React
 * Router's own `location.state.next` is gone by the time the browser gets
 * here — but `startOneId` already wrote the intended destination before it
 * left, and that write survives the round trip untouched. Reads only:
 * consuming the value is `takeNext`'s job alone, reached solely by a
 * SUCCESSFUL return, so a retry (which calls `startOneId` again, storing the
 * same value again) is never starved of it by a failure in between.
 */
export function peekStoredNext(): string | null {
  try {
    return sanitize(sessionStorage.getItem(ONEID_NEXT_KEY));
  } catch {
    // Private mode, or storage disabled entirely.
    return null;
  }
}

/** Test-only: the module cache above outlives a single test's render. */
export function resetOneIdReturnCache() {
  consumed = null;
}
