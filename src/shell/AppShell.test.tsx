import { render, screen, waitFor, within } from '@testing-library/react';
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

/** A citizen — the one role the video guide is shown to. */
const APPLICANT_ME = {
  ...ME,
  user: { ...ME.user, full_name: 'Aliyev Vali', login: 'applicant1' },
  role: { code: 'applicant', name: { uz_latn: 'Ariza beruvchi', ru: 'Заявитель' } },
  permissions: [],
  applicant: {
    id: 'ap000000-0000-4000-8000-000000000001',
    kind: 'individual',
    pinfl: '31708860250017',
    stir: null,
    name: 'Aliyev Vali',
    phone: null,
    email: null,
    region_id: null,
    district_id: null,
    address: null,
    verified_at: null,
  },
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

// The unread count refetches on its 30 s interval and whenever the tab
// regains focus (TanStack Query's `refetchOnWindowFocus`, listening on
// `visibilitychange`). The tests below need a refetch on demand, so they
// pretend the tab just came back into view.
function refocusWindow() {
  window.dispatchEvent(new Event('visibilitychange'));
}

test('on a phone the navigation is a drawer, closed by default', async () => {
  window.matchMedia = mockMatchMedia({ '(min-width: 768px)': false });
  await renderShell();
  expect(await screen.findByTestId('nav-drawer')).not.toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /menyu/i }));
  expect(await screen.findByTestId('nav-drawer')).toBeVisible();
});

// The tech-support line (Oybek, 2026-09-11). jsdom applies no CSS, so the
// `lg:`-gated header copy and the drawer copy are both in the DOM here — each
// is checked inside its own landmark.
test('the header carries the tech-support line as a tel: link', async () => {
  await renderShell();
  const header = await screen.findByRole('banner');
  const phone = within(header).getByRole('link', { name: /\+998 71 207 88 77/ });
  expect(phone).toHaveAttribute('href', 'tel:+998712078877');
  expect(header).toHaveTextContent('1010');
});

// The video guide is for citizens only (Oybek, 2026-09-13): an applicant gets
// it in a new tab, a staff role does not get the button at all.
test('the video guide is shown to an applicant, in a new tab', async () => {
  server.use(http.get('*/auth/me', () => HttpResponse.json(APPLICANT_ME)));
  await renderShell();
  const header = await screen.findByRole('banner');
  const video = within(header).getByRole('link', { name: /video qo.llanma/i });
  expect(video).toHaveAttribute('target', '_blank');
  expect(video.getAttribute('rel')).toContain('noopener');
  expect(video.getAttribute('href')).toMatch(/^https:\/\//);
});

test('the video guide is hidden from staff roles', async () => {
  await renderShell();
  const header = await screen.findByRole('banner');
  expect(within(header).queryByRole('link', { name: /video qo.llanma/i })).toBeNull();
  expect(screen.queryByTestId('video-guide-link')).toBeNull();
});

// Below `lg` the header hides the line: the drawer (phones) and the persistent
// sidebar (tablets, where there is no drawer) each carry it at the bottom.
test('the drawer and the sidebar both repeat the tech-support line the header hides', async () => {
  window.matchMedia = mockMatchMedia({ '(min-width: 768px)': false });
  await renderShell();
  const drawer = await screen.findByTestId('nav-drawer');
  await userEvent.click(screen.getByRole('button', { name: /menyu/i }));
  expect(within(drawer).getByRole('link', { name: /\+998 71 207 88 77/ })).toHaveAttribute(
    'href',
    'tel:+998712078877',
  );
  const sidebar = screen.getByRole('complementary');
  expect(within(sidebar).getByRole('link', { name: /\+998 71 207 88 77/ })).toHaveAttribute(
    'href',
    'tel:+998712078877',
  );
});

test('the unread badge comes from the server, not from a guess', async () => {
  server.use(http.get('*/notifications/unread-count', () => HttpResponse.json({ count: 3 })));
  await renderShell();
  expect(await screen.findByTestId('unread-badge')).toHaveTextContent('3');
});

test('a zero unread count shows no badge at all, not a red "0"', async () => {
  let count = 3;
  server.use(http.get('*/notifications/unread-count', () => HttpResponse.json({ count })));
  await renderShell();
  expect(await screen.findByTestId('unread-badge')).toHaveTextContent('3');
  count = 0;
  refocusWindow();
  await waitFor(() => expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument());
});

test('a session that expires mid-session lands on the login page, not on a broken screen', async () => {
  await renderShell();
  server.use(
    http.get('*/notifications/unread-count', () =>
      HttpResponse.json({ error: { code: 'ERR-AUTH-002', message: 'idle timeout' } }, { status: 401 }),
    ),
  );
  refocusWindow();
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
  // `kaa` dictionary renders translated Karakalpak copy
  expect(screen.getByRole('button', { name: 'Shıǵıw' })).toBeInTheDocument();
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

test('clicking the user profile in the header navigates to /profile', async () => {
  await renderShell();
  const profileLink = await screen.findByTestId('header-profile-link');
  expect(profileLink).toHaveAttribute('href', '/profile');
  await userEvent.click(profileLink);
  expect(await screen.findByTestId('profile-page')).toBeInTheDocument();
});

test('chief forester role name translates in header when language changes to Russian', async () => {
  window.matchMedia = mockMatchMedia({ '(min-width: 768px)': true });
  server.use(
    http.get('*/auth/me', () =>
      HttpResponse.json({
        ...ME,
        user: {
          ...ME.user,
          id: '22222222-2222-2222-2222-222222222222',
          full_name: 'Demo Chief Forester (Burchmulla DOX)',
          language: 'uz_latn',
        },
        role: { code: 'chief_forester', name: { uz_latn: "Bosh o'rmonbegi" } },
      }),
    ),
    http.put('*/auth/me/language', () => HttpResponse.json({ language: 'ru' })),
    http.get('*/refs/organizations', () => HttpResponse.json([])),
    http.get('*/gis/*', () => HttpResponse.json([])),
    http.get('*/permits', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 10 })),
  );

  await renderShell();
  const profileLink = await screen.findByTestId('header-profile-link');
  expect(within(profileLink).getByText("Bosh o'rmonbegi")).toBeInTheDocument();

  // Switch to Russian
  await userEvent.click(screen.getByTestId('language-trigger'));
  await userEvent.click(screen.getByRole('menuitemradio', { name: /Русский/ }));

  await waitFor(() => {
    expect(within(profileLink).getByText('Главный лесничий')).toBeInTheDocument();
    expect(within(profileLink).getByText('Демо Главный лесничий (Бурчмуллинский лесхоз)')).toBeInTheDocument();
  });
});
