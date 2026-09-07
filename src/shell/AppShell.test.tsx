import { render, screen, waitFor } from '@testing-library/react';
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
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
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
  await userEvent.click(screen.getByTestId('language-trigger'));
  await userEvent.click(screen.getByRole('menuitemradio', { name: /Русский/ }));

  await waitFor(() =>
    expect(screen.getByTestId('language-trigger')).toHaveTextContent('RU'),
  );
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
  await userEvent.click(screen.getByTestId('language-trigger'));
  await userEvent.click(screen.getByRole('menuitemradio', { name: /Русский/ }));
  // Give the rejected promise a tick to surface as an unhandled rejection,
  // were it not caught.
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(screen.getByTestId('language-trigger')).toHaveTextContent('UZ');
});

// Decision #18: the switcher offers all five languages the backend accepts
// (`LanguageIn`) from V1, not only the two that have a string map of their own.
// Picking one of the other three stores it on the account — which is what makes
// server-side text (notifications, documents) arrive in it — while the UI copy
// falls back to Latin Uzbek through `resolveLanguage()`.
test('the switcher offers all five backend languages, and one without a string map still stores', async () => {
  await renderShell();
  let stored: string | null = null;
  server.use(
    http.put('*/auth/me/language', async ({ request }) => {
      stored = ((await request.json()) as { language: string }).language;
      return HttpResponse.json({ language: stored });
    }),
  );

  await screen.findByTestId('app-shell');
  await userEvent.click(screen.getByTestId('language-trigger'));
  expect(screen.getAllByRole('menuitemradio').map((item) => item.textContent)).toEqual([
    'ЎЗЎзбекча (кирилл)',
    'UZOʻzbekcha (lotin)',
    'RUРусский',
    'ҚҚQaraqalpaqsha',
    'ENEnglish',
  ]);

  await userEvent.click(screen.getByRole('menuitemradio', { name: /Qaraqalpaqsha/ }));

  await waitFor(() => expect(screen.getByTestId('language-trigger')).toHaveTextContent('ҚҚ'));
  expect(stored).toBe('kaa');
  // The menu closes on a pick — it is a header control, not a panel.
  expect(screen.queryByTestId('language-menu')).toBeNull();
  // `kaa` has no dictionary yet, so the copy stays Latin Uzbek rather than
  // rendering raw keys — the fallback, not a missing translation.
  expect(screen.getByRole('button', { name: 'Chiqish' })).toBeInTheDocument();
});

// F14 (`docs/plans/07.3-findings.md`): the shell used to render the role
// name from `uz_cyrl` for a `uz_latn` account — true only before decision
// #90 made `uz_latn` the required (backfilled) field of every
// `LocalizedName`, so a `uz_latn` reader is now owed their own field.
test('the role name renders in the account\'s own uz_latn field, never uz_cyrl', async () => {
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({
        ...ME,
        role: { code: 'executor_head', name: { uz_cyrl: "Ijrochi boshlig'i", uz_latn: 'Executor head', ru: 'Начальник' } },
      }),
    ),
  );
  await renderShell();
  expect(await screen.findByText('Executor head')).toBeInTheDocument();
  expect(screen.queryByText("Ijrochi boshlig'i")).not.toBeInTheDocument();
});
