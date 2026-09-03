import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

let csrf: string | null = null;
export function setCsrfToken(token: string | null) { csrf = token; }

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const csrfMiddleware: Middleware = {
  async onRequest({ request }) {
    if (MUTATING.has(request.method) && csrf) request.headers.set('X-CSRF-Token', csrf);
    return request;
  },
};

export const api = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE ?? 'http://localhost:8000',
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
