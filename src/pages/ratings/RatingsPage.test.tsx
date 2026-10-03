/**
 * The ratings screen (rulings #140-#143, stage 7.7, task 9; the author and
 * the layout reworked 2026-10-04). What this screen must not get wrong:
 *   1. the average, the count, the comment count, the five-score
 *      distribution and both breakdowns (by organization, by activity type,
 *      one at a time behind a toggle) render from `GET /admin/ratings/summary`;
 *   2. the comment feed (`GET /admin/ratings`) names the author — the
 *      applicant and the permit number — and the number links to the permit
 *      card only for a reader the backend lets open it (`permits.view_any`,
 *      `permits.manage` or the superuser); the Agency's `central_admin`/
 *      `leadership` hold neither and get plain text, not a link to a 404;
 *   3. a period with zero ratings renders ONE empty notice, not a column of
 *      empty cards, and never "0.00" — an absent measurement is not a zero
 *      (ruling #143);
 *   4. the count renders an em dash while loading and on error, never a
 *      bare "0" — a number the screen does not actually have.
 *
 * Plus the regression guards this codebase's sibling screens carry: the
 * chosen period reaches both routes, the export carries it, a failed fetch
 * surfaces as a visible alert, and no `ratings.*` key reaches the page
 * untranslated (`i18n/context.ts`'s parity check cannot catch a key missing
 * from EVERY dictionary).
 */
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router';
import { RatingsPage } from './RatingsPage';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { I18nContextValue, UiLanguage } from '../../i18n/context';

const ORG_ID = '0198f200-0001-7000-8000-000000000001';
const ACT_ID = '0198f200-0002-7000-8000-000000000001';
const PERMIT_ID = '0198f200-0003-7000-8000-000000000001';

const ZERO_SCORES = [1, 2, 3, 4, 5].map((score) => ({ score, count: 0 }));
const EMPTY_SUMMARY = {
  avg_score: null,
  count: 0,
  comment_count: 0,
  by_score: ZERO_SCORES,
  by_organization: [],
  by_activity_type: [],
};
const SUMMARY = {
  avg_score: '4.00',
  count: 3,
  comment_count: 2,
  by_score: [
    { score: 1, count: 0 },
    { score: 2, count: 0 },
    { score: 3, count: 1 },
    { score: 4, count: 1 },
    { score: 5, count: 1 },
  ],
  by_organization: [{ organization_id: ORG_ID, name: { uz_latn: 'Burchmulla' }, avg_score: '4.50', count: 2 }],
  by_activity_type: [{ activity_type_id: ACT_ID, name: { uz_latn: 'Chorva boqish' }, avg_score: '3.00', count: 1 }],
};
const EMPTY_PAGE = { items: [], total: 0, page: 1, page_size: 20 };

const PAGE_WITH_ONE_COMMENT = {
  items: [
    {
      created_at: '2026-09-01T10:00:00Z',
      score: 5,
      comment: 'Tez va qulay xizmat, rahmat!',
      applicant_name: 'Aliyev Alisher',
      permit_id: PERMIT_ID,
      permit_number: 'А-000123',
      organization_name: { uz_latn: 'Burchmulla' },
      activity_type_name: { uz_latn: 'Pichan oʻrish' },
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
};

function i18nValue(lang: UiLanguage): I18nContextValue {
  return {
    lang,
    backendLang: lang,
    // The real dictionary, and the real fallback — a key missing from it
    // renders as the key itself, which the last test below catches.
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
}

/** A staff session: `executor_head` (holds `permits.manage`, opens the cards
 *  of its own leshoz) by default, `central_admin` (holds neither permits
 *  code) when a test needs the reader who cannot. */
function authValue(role: 'executor_head' | 'central_admin' = 'executor_head'): AuthContextValue {
  return {
    me: {
      user: {
        id: '0198f200-0004-7000-8000-000000000001',
        full_name: 'Test Reader',
        login: 'reader',
        phone: null,
        email: null,
        must_change_password: false,
        pinfl: null,
        language: 'uz_latn',
      },
      role: { code: role, name: {} },
      permissions: role === 'executor_head' ? ['ratings.view', 'permits.manage'] : ['ratings.view'],
      zone: { region_id: null, district_id: null, organization_id: role === 'executor_head' ? ORG_ID : null },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: null,
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderWithProviders(
  ui: ReactElement,
  {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    lang = 'uz_latn' as UiLanguage,
    auth = authValue(),
  } = {},
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18nValue(lang)}>
          <AuthContext.Provider value={auth}>
            <MemoryRouter>{ui}</MemoryRouter>
          </AuthContext.Provider>
        </I18nContext.Provider>
      </QueryClientProvider>,
    ),
  };
}

const server = setupServer(
  http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(EMPTY_SUMMARY)),
  http.get('*/api/v1/admin/ratings', () => HttpResponse.json(EMPTY_PAGE)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('shows the average, the counts, the distribution and both breakdowns behind a toggle', async () => {
  server.use(http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(SUMMARY)));
  renderWithProviders(<RatingsPage />);

  await waitFor(() => expect(screen.getByTestId('ratings-avg-score')).toHaveTextContent('4.00'));
  expect(screen.getByTestId('ratings-count')).toHaveTextContent('3');
  expect(screen.getByTestId('ratings-comment-count')).toHaveTextContent('2');
  expect(screen.getByTestId('ratings-score-5')).toHaveTextContent('1');
  expect(screen.getByTestId('ratings-score-1')).toHaveTextContent('0');

  const breakdown = screen.getByTestId('ratings-breakdown');
  expect(within(breakdown).getByText('Burchmulla')).toBeInTheDocument();
  expect(within(breakdown).queryByText('Chorva boqish')).not.toBeInTheDocument();

  await userEvent.setup().click(screen.getByTestId('ratings-breakdown-activity'));
  expect(within(breakdown).getByText('Chorva boqish')).toBeInTheDocument();
  expect(within(breakdown).queryByText('Burchmulla')).not.toBeInTheDocument();
});

test('names the author and links the permit number for a reader who can open the card', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(SUMMARY)),
    http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)),
  );
  renderWithProviders(<RatingsPage />);

  const row = await screen.findByTestId('ratings-comment-0');
  expect(within(row).getByText('Aliyev Alisher')).toBeInTheDocument();
  expect(within(row).getByText(/tez va qulay/i)).toBeInTheDocument();
  expect(within(row).getByRole('link', { name: /А-000123/ })).toHaveAttribute('href', `/permits/${PERMIT_ID}`);
});

test('shows the permit number as plain text to a reader the card would refuse', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(SUMMARY)),
    http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)),
  );
  renderWithProviders(<RatingsPage />, { auth: authValue('central_admin') });

  const row = await screen.findByTestId('ratings-comment-0');
  expect(within(row).getByText('Aliyev Alisher')).toBeInTheDocument();
  expect(within(row).getByText('А-000123')).toBeInTheDocument();
  expect(within(row).queryByRole('link')).not.toBeInTheDocument();
});

test('a period with no ratings shows one notice instead of empty cards, and never 0.00', async () => {
  renderWithProviders(<RatingsPage />);

  expect(await screen.findByTestId('ratings-empty')).toBeInTheDocument();
  expect(screen.queryByTestId('ratings-breakdown')).not.toBeInTheDocument();
  expect(screen.queryByTestId('ratings-feed')).not.toBeInTheDocument();
  expect(screen.queryByText('0.00')).not.toBeInTheDocument();
});

test('changing the period and clicking Apply asks both routes for the new dates', async () => {
  const summaryPeriods: string[] = [];
  const feedPeriods: string[] = [];
  server.use(
    http.get('*/api/v1/admin/ratings/summary', ({ request }) => {
      const url = new URL(request.url);
      summaryPeriods.push(`${url.searchParams.get('period_from')}..${url.searchParams.get('period_to')}`);
      return HttpResponse.json(EMPTY_SUMMARY);
    }),
    http.get('*/api/v1/admin/ratings', ({ request }) => {
      const url = new URL(request.url);
      feedPeriods.push(`${url.searchParams.get('period_from')}..${url.searchParams.get('period_to')}`);
      return HttpResponse.json(EMPTY_PAGE);
    }),
  );
  renderWithProviders(<RatingsPage />);

  const filters = await screen.findByTestId('ratings-filters');
  const dateInputs = filters.querySelectorAll('input[type="date"]');
  expect(dateInputs).toHaveLength(2);

  fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });
  fireEvent.change(dateInputs[1], { target: { value: '2026-01-31' } });
  await userEvent.setup().click(screen.getByTestId('ratings-apply'));

  await waitFor(() => expect(summaryPeriods.some((p) => p === '2026-01-01..2026-01-31')).toBe(true));
  await waitFor(() => expect(feedPeriods.some((p) => p === '2026-01-01..2026-01-31')).toBe(true));
});

test('the Excel export carries the applied period filter and nothing about paging', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(SUMMARY)),
    http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)),
  );

  let exportUrl: URL | null = null;
  server.use(
    http.get('*/api/v1/admin/ratings/export.xlsx', ({ request }) => {
      exportUrl = new URL(request.url);
      return HttpResponse.text('xlsx-bytes', {
        headers: {
          'Content-Disposition': 'attachment; filename="baholar.xlsx"',
          'X-Export-Truncated': 'false',
        },
      });
    }),
  );

  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  renderWithProviders(<RatingsPage />);

  const filters = await screen.findByTestId('ratings-filters');
  const dateInputs = filters.querySelectorAll('input[type="date"]');
  fireEvent.change(dateInputs[0], { target: { value: '2026-02-01' } });
  fireEvent.change(dateInputs[1], { target: { value: '2026-02-28' } });
  const user = userEvent.setup();
  await user.click(screen.getByTestId('ratings-apply'));
  await screen.findByTestId('ratings-comment-0');

  await user.click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(exportUrl!.searchParams.get('period_from')).toBe('2026-02-01');
  expect(exportUrl!.searchParams.get('period_to')).toBe('2026-02-28');
  expect(exportUrl!.searchParams.has('page')).toBe(false);
  expect(exportUrl!.searchParams.has('page_size')).toBe(false);
});

test('an empty period disables the Excel button — there is nothing to export', async () => {
  // The default handlers already answer with EMPTY_PAGE / EMPTY_SUMMARY.
  renderWithProviders(<RatingsPage />);

  await screen.findByTestId('ratings-empty');

  expect(screen.getByTestId('export-xlsx')).toBeDisabled();
});

test('a failed summary fetch shows a visible alert, never a silently blank screen', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'Unexpected error' } }, { status: 500 }),
    ),
  );
  renderWithProviders(<RatingsPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  // A failed fetch is not an empty period: no "no ratings" notice, and the
  // count beside the average shows the same em dash, never a "0" the
  // screen never actually received.
  expect(screen.queryByTestId('ratings-empty')).not.toBeInTheDocument();
  expect(screen.getByTestId('ratings-count')).toHaveTextContent('—');
  expect(screen.getByTestId('ratings-count')).not.toHaveTextContent('0');
});

test('shows the count as unknown while the summary is still loading, not zero', () => {
  // No `await` before the assertion — this reads the tile in its very first
  // render, before either mocked route has had a chance to resolve.
  renderWithProviders(<RatingsPage />);
  expect(screen.getByTestId('ratings-count')).toHaveTextContent('—');
  expect(screen.getByTestId('ratings-count')).not.toHaveTextContent('0');
});

// Compile-time parity (`Record<TranslationKey, string>` in `i18n/context.ts`)
// guarantees the dictionaries hold the SAME keys — it cannot know whether
// this screen asks for a key that exists in NONE, which `t` renders as the
// bare key and a reader sees in the middle of the page.
test.each(['uz_latn', 'ru'] as const)('no untranslated ratings.* key reaches the screen in %s', async (lang) => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(SUMMARY)),
    http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)),
  );
  renderWithProviders(<RatingsPage />, { lang });
  await screen.findByTestId('ratings-comment-0');

  expect(document.body.textContent).not.toMatch(/ratings\.[a-zA-Z.]+/);
});

test('the empty notice is translated too', async () => {
  renderWithProviders(<RatingsPage />, { lang: 'ru' });
  await screen.findByTestId('ratings-empty');

  expect(document.body.textContent).not.toMatch(/ratings\.[a-zA-Z.]+/);
});
