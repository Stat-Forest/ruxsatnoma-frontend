import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { CSRF_REFUSED, SESSION_GONE } from './errors';

let csrf: string | null = null;
export function setCsrfToken(token: string | null) { csrf = token; }

/**
 * Registered by `AuthProvider` (never imported here — that would cycle back
 * through `AuthProvider`'s own import of `api`/`setCsrfToken`). A setter of
 * the same shape as `setCsrfToken` above, so the session-gone reaction lives
 * in React state where `me` already lives, while this module stays a plain
 * fetch client with no dependency on `src/auth/`.
 */
let onSessionGone: (() => void) | null = null;
export function setSessionGoneHandler(handler: (() => void) | null) {
  onSessionGone = handler;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BASE_URL = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';
const ME_PATH = '/api/v1/auth/me';

const pristineClones = new WeakMap<Request, Request>();

function getCsrfToken(): string | null {
  if (csrf) return csrf;
  try {
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
  } catch {}
  return null;
}

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = getCsrfToken();
    if (MUTATING.has(request.method) && token) request.headers.set('X-CSRF-Token', token);
    // Stashed before the request is sent — a `Request`'s body can only be
    // read once, so cloning it here, while it is still pristine, is the only
    // point a retryable copy can be taken. `sessionMiddleware.onResponse`
    // below receives this exact `request` object back and looks the clone
    // up by identity.
    pristineClones.set(request, request.clone());
    return request;
  },
};

/** Reads `{error: {code}}` out of a response without consuming the original. */
async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { error?: { code?: string } };
    return body?.error?.code ?? null;
  } catch {
    return null;
  }
}

/**
 * Ruling 10's second half: `ERR-AUTH-006` means the in-memory CSRF token is
 * stale (multi-tab churn, a long-idle tab). `/auth/me` mints a fresh one as
 * a side effect of answering "who am I", so re-fetching it is the refresh.
 * Called with the raw `fetch`, not `api.GET` — going through `api` would
 * re-enter this same middleware and, on a second `ERR-AUTH-006`, recurse.
 *
 * Not de-duplicated: concurrent stale-token failures each fire their own
 * refresh. Safe — every retry uses the token its own refresh call returned,
 * so there is no cross-talk — just redundant network traffic under a burst.
 * A deliberate simplification, not an oversight.
 */
async function refreshCsrfToken(): Promise<string | null> {
  const response = await globalThis.fetch(`${BASE_URL}${ME_PATH}`, { credentials: 'include' });
  if (!response.ok) {
    if ((await readErrorCode(response)) === SESSION_GONE) onSessionGone?.();
    return null;
  }
  const data = (await response.json()) as { csrf_token?: string };
  const token = data.csrf_token ?? null;
  setCsrfToken(token);
  return token;
}

/**
 * Ruling 10's global handling, in one place for every call site — a query, a
 * mutation, or an ad-hoc `api.*` call — rather than once per screen:
 *   - `ERR-AUTH-002` (session gone): tell `AuthProvider` once, via the
 *     registered handler. `RequireAuth` reacts to `me` becoming `null` on
 *     its own; no navigation happens here.
 *   - `ERR-AUTH-006` (CSRF/Origin refused): refresh the token and retry the
 *     original request exactly once, then give up. The retry never goes
 *     through `api` (it uses `globalThis.fetch` on the pristine clone), so
 *     it cannot re-enter this middleware and loop.
 */
const sessionMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.ok) return response;
    const code = await readErrorCode(response);

    if (code === SESSION_GONE) {
      onSessionGone?.();
      return response;
    }

    if (code === CSRF_REFUSED && !request.url.endsWith(ME_PATH)) {
      const pristine = pristineClones.get(request);
      const token = pristine ? await refreshCsrfToken() : null;
      if (!pristine || !token) return response;
      pristine.headers.set('X-CSRF-Token', token);
      const retried = await globalThis.fetch(pristine);
      if (!retried.ok && (await readErrorCode(retried)) === SESSION_GONE) onSessionGone?.();
      return retried;
    }

    return response;
  },
};

export const api = createClient<paths>({
  baseUrl: BASE_URL,
  credentials: 'include',
  // openapi-fetch resolves its `fetch` option once, at createClient() time
  // (`fetch: baseFetch = globalThis.fetch` in its source) — a plain default
  // would freeze in the pre-test `globalThis.fetch` and skip MSW's node
  // interceptor entirely, since MSW patches `globalThis.fetch` only when
  // `server.listen()` runs, which is after this module has already been
  // imported. Looking it up on every call keeps requests going through
  // whatever `globalThis.fetch` currently is.
  fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
});
api.use(csrfMiddleware);
api.use(sessionMiddleware);
