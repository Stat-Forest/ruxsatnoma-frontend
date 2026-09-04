import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { api, setCsrfToken, setSessionGoneHandler } from './client';
import { apiError, ApiError } from './errors';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  setCsrfToken(null);
  setSessionGoneHandler(null);
});
afterAll(() => server.close());

test('a mutating request carries the CSRF token', async () => {
  setCsrfToken('tok-abc');
  let seen: string | null = null;
  server.use(http.post('*/auth/logout', ({ request }) => {
    seen = request.headers.get('X-CSRF-Token');
    return new HttpResponse(null, { status: 204 });
  }));
  await api.POST('/api/v1/auth/logout', {});
  expect(seen).toBe('tok-abc');
});

test('a GET does not carry it', async () => {
  setCsrfToken('tok-abc');
  let seen: string | null = 'unset';
  server.use(http.get('*/notifications/unread-count', ({ request }) => {
    seen = request.headers.get('X-CSRF-Token');
    return HttpResponse.json({ count: 0 });
  }));
  await api.GET('/api/v1/notifications/unread-count', {});
  expect(seen).toBeNull();
});

test('an error body becomes an ApiError carrying the code', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(
    { error: { code: 'ERR-AUTH-002', message: 'session expired' } }, { status: 401 })));
  const { error } = await api.GET('/api/v1/auth/me', {});
  expect(apiError(error)).toBeInstanceOf(ApiError);
  expect(apiError(error).code).toBe('ERR-AUTH-002');
});

// Ruling 10: ERR-AUTH-002 is handled globally, at the client, so every call
// site gets it uniformly — a query, a mutation, or an ad-hoc call outside
// TanStack Query entirely. These two tests stand in for those three shapes.
test('ERR-AUTH-002 on a GET (a query) reaches the registered session-gone handler', async () => {
  const handler = vi.fn();
  setSessionGoneHandler(handler);
  server.use(http.get('*/notifications/unread-count', () => HttpResponse.json(
    { error: { code: 'ERR-AUTH-002', message: 'session gone' } }, { status: 401 })));
  await api.GET('/api/v1/notifications/unread-count', {});
  expect(handler).toHaveBeenCalledTimes(1);
});

test('ERR-AUTH-002 on a POST (a mutation) reaches the registered session-gone handler too', async () => {
  const handler = vi.fn();
  setSessionGoneHandler(handler);
  server.use(http.post('*/auth/logout', () => HttpResponse.json(
    { error: { code: 'ERR-AUTH-002', message: 'session gone' } }, { status: 401 })));
  await api.POST('/api/v1/auth/logout', {});
  expect(handler).toHaveBeenCalledTimes(1);
});

// Ruling 10's second half: ERR-AUTH-006 means the in-memory CSRF token is
// stale. The fix refetches /auth/me (which mints a fresh token) and retries
// the original request exactly once before giving up.
test('ERR-AUTH-006 refreshes the CSRF token and retries the request once, transparently', async () => {
  setCsrfToken('stale-token');
  let logoutCalls = 0;
  let sawTokenOnSecondCall: string | null = null;
  server.use(
    http.post('*/auth/logout', ({ request }) => {
      logoutCalls += 1;
      const token = request.headers.get('X-CSRF-Token');
      if (logoutCalls === 1) {
        expect(token).toBe('stale-token');
        return HttpResponse.json(
          { error: { code: 'ERR-AUTH-006', message: 'csrf refused' } },
          { status: 403 },
        );
      }
      sawTokenOnSecondCall = token;
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('*/auth/me', () => HttpResponse.json({ csrf_token: 'fresh-token' })),
  );

  const { response } = await api.POST('/api/v1/auth/logout', {});

  expect(logoutCalls).toBe(2);
  expect(sawTokenOnSecondCall).toBe('fresh-token');
  expect(response.status).toBe(204);
});

test('a CSRF refusal that persists after the refresh still gives up after exactly one retry', async () => {
  setCsrfToken('stale-token');
  let logoutCalls = 0;
  server.use(
    http.post('*/auth/logout', () => {
      logoutCalls += 1;
      return HttpResponse.json(
        { error: { code: 'ERR-AUTH-006', message: 'csrf refused' } },
        { status: 403 },
      );
    }),
    http.get('*/auth/me', () => HttpResponse.json({ csrf_token: 'fresh-token' })),
  );

  const { response } = await api.POST('/api/v1/auth/logout', {});

  // Original attempt + exactly one retry — never a loop.
  expect(logoutCalls).toBe(2);
  expect(response.status).toBe(403);
});

test('the refresh call itself never gets retried, even if it too answers ERR-AUTH-006', async () => {
  let meCalls = 0;
  server.use(
    http.get('*/auth/me', () => {
      meCalls += 1;
      return HttpResponse.json(
        { error: { code: 'ERR-AUTH-006', message: 'csrf refused' } },
        { status: 403 },
      );
    }),
  );

  await api.GET('/api/v1/auth/me', {});

  expect(meCalls).toBe(1);
});
