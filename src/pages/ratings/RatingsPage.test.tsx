/**
 * The Agency's ratings screen (rulings #140-#143, stage 7.7, task 9). Three
 * things this screen must not get wrong, one test each — from the task
 * brief itself:
 *   1. the overall average, count, and both breakdowns (by organization, by
 *      activity type) all render from `GET /admin/ratings/summary`;
 *   2. the comment feed (`GET /admin/ratings`) renders the comment text but
 *      carries no author affordance whatsoever — no name, no permit number,
 *      nothing a leshoz could use to work out who complained (ruling #141);
 *   3. a period with zero ratings renders an em dash, never "0.00" — the
 *      same posture the statistics tiles took after F7 (decision behind
 *      ruling #143: a portal may not state a number it cannot produce);
 *   4. the count beside that average renders the same em dash while loading
 *      and on error, never a bare "0" — a number the screen does not
 *      actually have yet (or ever, on a failed fetch).
 *
 * Plus two regression guards this codebase's own sibling screens already
 * carry: the chosen period actually reaches both routes (the KPI filter
 * bar's own test, `LeadershipDashboardPage.test.tsx`), a failed fetch
 * surfaces as a visible alert rather than a silently blank screen (this
 * project's own repeated defect direction — see `activityTypes.loadError`),
 * and no `ratings.*` key reaches the rendered page untranslated in either
 * language (`i18n/context.ts`'s compile-time parity check cannot catch a
 * key missing from BOTH dictionaries).
 */
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RatingsPage } from './RatingsPage';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { I18nContextValue, UiLanguage } from '../../i18n/context';

const ORG_ID = '0198f200-0001-7000-8000-000000000001';
const ACT_ID = '0198f200-0002-7000-8000-000000000001';

const EMPTY_SUMMARY = { avg_score: null, count: 0, by_organization: [], by_activity_type: [] };
const EMPTY_PAGE = { items: [], total: 0, page: 1, page_size: 20 };

const PAGE_WITH_ONE_COMMENT = {
  items: [
    {
      created_at: '2026-09-01T10:00:00Z',
      score: 5,
      comment: 'Tez va qulay xizmat, rahmat!',
      organization_name: { uz_latn: 'Burchmulla' },
      activity_type_name: { uz_latn: 'Chorva boqish' },
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
    // The real dictionary, and the real fallback — a key missing from either
    // map renders as the key itself, which the last-resort test below
    // catches (mirrors `LeadershipDashboardPage.test.tsx`'s own convention).
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
}

function renderWithProviders(
  ui: ReactElement,
  {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    lang = 'uz_latn' as UiLanguage,
  } = {},
) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <I18nContext.Provider value={i18nValue(lang)}>{ui}</I18nContext.Provider>
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

test('shows the average, the count and the breakdowns', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () =>
      HttpResponse.json({
        avg_score: '4.00',
        count: 3,
        by_organization: [{ organization_id: ORG_ID, name: { uz_latn: 'Burchmulla' }, avg_score: '4.50', count: 2 }],
        by_activity_type: [
          { activity_type_id: ACT_ID, name: { uz_latn: 'Chorva boqish' }, avg_score: '3.00', count: 1 },
        ],
      }),
    ),
  );
  renderWithProviders(<RatingsPage />);
  expect(await screen.findByText('4.00')).toBeInTheDocument();
  expect(await screen.findByText('Burchmulla')).toBeInTheDocument();
  expect(await screen.findByText('Chorva boqish')).toBeInTheDocument();
});

test('renders a comment without any author affordance', async () => {
  server.use(http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)));
  renderWithProviders(<RatingsPage />);
  expect(await screen.findByText(/tez va qulay/i)).toBeInTheDocument();
  expect(screen.queryByText(/F\.I\.SH|ФИО|ruxsatnoma raqami/i)).not.toBeInTheDocument();
});

test('says "-" rather than 0 when the period has no ratings', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () =>
      HttpResponse.json({ avg_score: null, count: 0, by_organization: [], by_activity_type: [] }),
    ),
  );
  renderWithProviders(<RatingsPage />);
  expect(await screen.findByText('—')).toBeInTheDocument();
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
  const periodFromInput = dateInputs[0];
  const periodToInput = dateInputs[1];

  fireEvent.change(periodFromInput, { target: { value: '2026-01-01' } });
  fireEvent.change(periodToInput, { target: { value: '2026-01-31' } });
  const user = userEvent.setup();
  await user.click(screen.getByTestId('ratings-apply'));

  await waitFor(() => expect(summaryPeriods.some((p) => p === '2026-01-01..2026-01-31')).toBe(true));
  await waitFor(() => expect(feedPeriods.some((p) => p === '2026-01-01..2026-01-31')).toBe(true));
});

test('the Excel export carries the applied period filter and nothing about paging', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () => HttpResponse.json(EMPTY_SUMMARY)),
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

test('a failed summary fetch shows a visible alert, never a silently blank screen', async () => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () =>
      HttpResponse.json({ error: { code: 'ERR-SYS-000', message: 'Unexpected error' } }, { status: 500 }),
    ),
  );
  renderWithProviders(<RatingsPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  // The count sits right next to an average that already honestly shows an
  // em dash on failure — "Baholar soni: 0" here would be a number the
  // screen never actually received.
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
// guarantees the two dictionaries hold the SAME keys — it cannot know
// whether this screen asks for a key that exists in NEITHER, which `t`
// renders as the bare key and a reader sees in the middle of the page.
test.each(['uz_latn', 'ru'] as const)('no untranslated ratings.* key reaches the screen in %s', async (lang) => {
  server.use(
    http.get('*/api/v1/admin/ratings/summary', () =>
      HttpResponse.json({
        avg_score: '4.00',
        count: 3,
        by_organization: [{ organization_id: ORG_ID, name: { uz_latn: 'Burchmulla' }, avg_score: '4.50', count: 2 }],
        by_activity_type: [
          { activity_type_id: ACT_ID, name: { uz_latn: 'Chorva boqish' }, avg_score: '3.00', count: 1 },
        ],
      }),
    ),
    http.get('*/api/v1/admin/ratings', () => HttpResponse.json(PAGE_WITH_ONE_COMMENT)),
  );
  renderWithProviders(<RatingsPage />, { lang });
  await screen.findByTestId('ratings-comment-0');

  expect(document.body.textContent).not.toMatch(/ratings\.[a-zA-Z.]+/);
});
