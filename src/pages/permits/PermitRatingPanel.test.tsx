/**
 * B10's own rating panel (ruling #140/#141, task 8 of
 * `07.7-services-catalog-and-ratings`). Four things this panel must not get
 * wrong, one test each:
 *   1. all five scores are offered, including "1" — the option the old
 *      landing form never had (task-8-brief.md point 1);
 *   2. once the card already carries a `rating`, the form is REPLACED by the
 *      given score, not merely disabled (decision 3) — no submit button left
 *      to click;
 *   3. the panel renders nothing at all while the permit is still
 *      `pending_signatures` — there is no service yet to rate (decision 2);
 *   4. a submission sends exactly `{score}` when the comment is left blank
 *      (decision 4 — the comment is optional) and, on success, invalidates
 *      the `['permit', id]` query so the card picks up its own `rating`
 *      (decision 6).
 */
import type { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { PermitRatingPanel } from './PermitRatingPanel';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import type { I18nContextValue, UiLanguage } from '../../i18n/context';

const ID = 'p1000000-0000-4000-8000-000000000001';
const NOW = '2026-09-01T10:00:00Z';

function i18nValue(lang: UiLanguage): I18nContextValue {
  return {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
}

function renderWithProviders(
  ui: ReactElement,
  { client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }), lang = 'uz_latn' as UiLanguage } = {},
) {
  return { client, ...render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18nValue(lang)}>{ui}</I18nContext.Provider>
    </QueryClientProvider>,
  ) };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('offers all five scores, one being possible', async () => {
  renderWithProviders(<PermitRatingPanel permitId={ID} rating={null} status="active" />);
  for (const score of [1, 2, 3, 4, 5]) {
    expect(await screen.findByRole('radio', { name: new RegExp(`^${score}`) })).toBeInTheDocument();
  }
});

test('shows the given score instead of the form once rated', async () => {
  renderWithProviders(
    <PermitRatingPanel permitId={ID} rating={{ score: 4, comment: null, created_at: NOW }} status="active" />,
  );
  expect(await screen.findByText(/4/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /yuborish/i })).not.toBeInTheDocument();
});

test('does not appear while the permit is still awaiting signatures', () => {
  const { container } = renderWithProviders(
    <PermitRatingPanel permitId={ID} rating={null} status="pending_signatures" />,
  );
  expect(container).toBeEmptyDOMElement();
});

test('submits {score} alone when the comment is left blank, then invalidates the permit query', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.post('*/api/v1/permits/:id/rating', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json({ score: 5, comment: null, created_at: NOW }, { status: 201 });
    }),
  );
  const { client } = renderWithProviders(<PermitRatingPanel permitId={ID} rating={null} status="active" />);
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');

  await user.click(await screen.findByRole('radio', { name: /^5/ }));
  await user.click(screen.getByRole('button', { name: /yuborish/i }));

  await waitFor(() => expect(sentBody).toEqual({ score: 5 }));
  expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['permit', ID] });
});

test('a written comment rides along with the score', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.post('*/api/v1/permits/:id/rating', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json({ score: 3, comment: 'Juda sekin ishladi', created_at: NOW }, { status: 201 });
    }),
  );
  renderWithProviders(<PermitRatingPanel permitId={ID} rating={null} status="active" />);

  await user.click(await screen.findByRole('radio', { name: /^3/ }));
  await user.type(screen.getByLabelText(/izoh/i), 'Juda sekin ishladi');
  await user.click(screen.getByRole('button', { name: /yuborish/i }));

  await waitFor(() => expect(sentBody).toEqual({ score: 3, comment: 'Juda sekin ishladi' }));
});

test('the submit button stays disabled until a score is chosen', async () => {
  renderWithProviders(<PermitRatingPanel permitId={ID} rating={null} status="active" />);
  expect(await screen.findByRole('button', { name: /yuborish/i })).toBeDisabled();
});
