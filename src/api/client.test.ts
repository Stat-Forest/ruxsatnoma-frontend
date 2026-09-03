import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { api, setCsrfToken } from './client';
import { apiError, ApiError } from './errors';

const server = setupServer();
beforeAll(() => server.listen());
afterEach(() => { server.resetHandlers(); setCsrfToken(null); });
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
