import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import App from '../App';
import { setCsrfToken } from '../api/client';
import { router } from '../routes';

const ME = {
  user: {
    id: '11111111-1111-1111-1111-111111111111',
    full_name: 'Boshliq Test',
    login: 'ehead',
    phone: null,
    email: null,
    must_change_password: false,
    language: 'uz_latn',
  },
  role: { code: 'executor_head', name: { uz_cyrl: "Ijrochi boshlig'i", ru: 'Начальник исполнителя' } },
  permissions: ['applications.review'],
  zone: { region_id: null, district_id: null, organization_id: null },
  csrf_token: 'tok-1',
  is_superuser: false,
  applicant: null,
  representations: [],
  registration_complete: true,
};

/** jsdom implements no `matchMedia` at all; AppShell itself does not call it
 *  (ruling R5 — the drawer's visibility is driven by `open` state alone, never
 *  a media query), but a polyfill still belongs in test setup as a backstop
 *  against any dependency that does. */
function mockMatchMedia(queries: Record<string, boolean>) {
  return (query: string): MediaQueryList =>
    ({
      matches: queries[query] ?? false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

const server = setupServer(
  http.get('*/auth/me', () => HttpResponse.json(ME)),
  http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.post('*/auth/logout', () => new HttpResponse(null, { status: 204 })),
);
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  setCsrfToken(null);
});
afterAll(() => server.close());

async function renderShell() {
  await router.navigate('/');
  return render(<App />);
}

test('on a phone the navigation is a drawer, closed by default', async () => {
  window.matchMedia = mockMatchMedia({ '(min-width: 768px)': false });
  await renderShell();
  expect(await screen.findByTestId('nav-drawer')).not.toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /menyu/i }));
  expect(await screen.findByTestId('nav-drawer')).toBeVisible();
});

test('the unread badge comes from the server, not from a guess', async () => {
  server.use(http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 3 })));
  await renderShell();
  expect(await screen.findByTestId('unread-badge')).toHaveTextContent('3');
});

test('a session that expires mid-session lands on the login page, not on a broken screen', async () => {
  await renderShell();
  server.use(
    http.get('*/notifications/unread-count', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'idle timeout' } }, { status: 401 }),
    ),
  );
  await userEvent.click(await screen.findByTestId('refresh-notifications'));
  expect(await screen.findByTestId('login-page')).toBeInTheDocument();
});

// The language switch (`I18nProvider.setLanguage`) is a mutating call made
// directly through `api.PUT`, never through TanStack Query — exactly the
// call site the review flagged as escaping session/CSRF handling entirely.
// A stale token here must recover transparently via `sessionMiddleware`
// (src/api/client.ts), the same as any other call.
test('a stale CSRF token on the language switch recovers transparently, not as a silent failure', async () => {
  await renderShell();
  let putCalls = 0;
  server.use(
    http.put('*/auth/me/language', ({ request }) => {
      putCalls += 1;
      const token = request.headers.get('X-CSRF-Token');
      if (token === 'tok-1') {
        return HttpResponse.json(
          { error: { code: 'ERR-AUTH-006', message: 'csrf refused' } },
          { status: 403 },
        );
      }
      return HttpResponse.json({ language: 'ru' });
    }),
    http.get('*/auth/me', () => HttpResponse.json({ ...ME, csrf_token: 'fresh-tok' })),
  );

  await screen.findByTestId('app-shell');
  await userEvent.click(screen.getByRole('button', { name: 'RU' }));

  expect(await screen.findByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'true');
  expect(putCalls).toBe(2);
});

// Whatever error survives the global handling (anything other than the two
// codes ruling 10 names) must not become an unhandled promise rejection —
// only an unhandled rejection this test would catch if the click handler's
// `.catch` were removed, since Vitest fails a test whose window fires one.
test('a language switch failure that is not session/CSRF related does not throw an unhandled rejection', async () => {
  await renderShell();
  server.use(
    http.put('*/auth/me/language', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'unexpected' } }, { status: 500 }),
    ),
  );

  await screen.findByTestId('app-shell');
  await userEvent.click(screen.getByRole('button', { name: 'RU' }));
  // Give the rejected promise a tick to surface as an unhandled rejection,
  // were it not caught.
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(screen.getByRole('button', { name: 'UZ' })).toHaveAttribute('aria-pressed', 'true');
});
