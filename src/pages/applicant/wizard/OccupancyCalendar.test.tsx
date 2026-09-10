import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { OccupancyCalendar } from './OccupancyCalendar';

const CONTOUR_ID = 'c1000000-0000-4000-8000-000000000001';
const ACTIVITY_ID = 'a1000000-0000-4000-8000-000000000001';

function effectiveSeason(over: Record<string, unknown> = {}) {
  return {
    activity_type_id: ACTIVITY_ID,
    organization_id: 'org-1',
    contour_id: CONTOUR_ID,
    windows: [],
    season_source: 'none',
    min_term_days: null,
    min_term_source: 'none',
    ...over,
  };
}

function occupancy(periods: Record<string, unknown>[], over: Record<string, unknown> = {}) {
  return {
    contour_id: CONTOUR_ID,
    activity_type_id: ACTIVITY_ID,
    period_from: '2026-03-01',
    period_to: '2026-03-31',
    capacity: '100.0000',
    unit: 'sb',
    exclusive: false,
    load_source: 'permits',
    periods,
    ...over,
  };
}

let seenOccupancyRequests: { from: string | null; to: string | null }[] = [];

const server = setupServer(
  http.get('*/api/v1/activity-seasons/effective', () => HttpResponse.json(effectiveSeason())),
  http.get('*/api/v1/gis/contours/:contourId/occupancy', ({ request }) => {
    const url = new URL(request.url);
    seenOccupancyRequests.push({ from: url.searchParams.get('from'), to: url.searchParams.get('to') });
    return HttpResponse.json(occupancy([]));
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  seenOccupancyRequests = [];
});
afterAll(() => server.close());

function renderCalendar(props: Partial<React.ComponentProps<typeof OccupancyCalendar>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSelectRange = vi.fn();
  const utils = render(
    <QueryClientProvider client={client}>
      <OccupancyCalendar
        contourId={CONTOUR_ID}
        activityTypeId={ACTIVITY_ID}
        periodFrom="2026-03-01"
        periodTo=""
        onSelectRange={onSelectRange}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { ...utils, onSelectRange, client };
}

test('a date outside the effective season cannot be selected at all', async () => {
  server.use(
    http.get('*/api/v1/activity-seasons/effective', () =>
      HttpResponse.json(effectiveSeason({ windows: [{ from: '03-01', to: '03-15' }], season_source: 'activity_season' })),
    ),
  );
  // A COMPLETE range already stands (from earlier in the wizard) — the view
  // month stays fixed at March 2026 via `periodFrom`, and this click starts
  // a fresh selection rather than extending the old one.
  const { onSelectRange } = renderCalendar({ periodFrom: '2026-03-01', periodTo: '2026-03-01' });

  const inSeasonDay = await screen.findByRole('button', { name: /05\.03\.2026/ });
  const outOfSeasonDay = await screen.findByRole('button', { name: /20\.03\.2026 — Mavsumdan tashqarida/ });

  expect(outOfSeasonDay).toBeDisabled();
  expect(inSeasonDay).not.toBeDisabled();

  await userEvent.click(outOfSeasonDay);
  expect(onSelectRange).not.toHaveBeenCalled();

  await userEvent.click(inSeasonDay);
  expect(onSelectRange).toHaveBeenCalledWith('2026-03-05', '');
});

test('the minimum term is stated and enforced: a too-short end date cannot be picked', async () => {
  server.use(
    http.get('*/api/v1/activity-seasons/effective', () =>
      HttpResponse.json(effectiveSeason({ min_term_days: 30, min_term_source: 'activity_season' })),
    ),
  );
  // Picking the END date: `periodFrom` set, `periodTo` empty.
  const { onSelectRange } = renderCalendar({ periodFrom: '2026-03-01', periodTo: '' });

  // 2026-03-10 is only a 9-day span from 2026-03-01 — too short for a
  // 30-day minimum.
  const tooShort = await screen.findByRole('button', { name: /10\.03\.2026 — .*kamida 30 kun/ });
  expect(tooShort).toBeDisabled();
  await userEvent.click(tooShort);
  expect(onSelectRange).not.toHaveBeenCalled();

  // Far enough out, it becomes pickable and completes the range.
  const farEnough = await screen.findByRole('button', { name: /31\.03\.2026/ });
  expect(farEnough).not.toBeDisabled();
  await userEvent.click(farEnough);
  expect(onSelectRange).toHaveBeenCalledWith('2026-03-01', '2026-03-31');
});

test('three occupancy colours: free, partial (with the remainder and its unit), and full', async () => {
  server.use(
    http.get('*/api/v1/gis/contours/:contourId/occupancy', () =>
      HttpResponse.json(
        occupancy([
          { period_from: '2026-03-01', period_to: '2026-03-10', committed: '0', remaining: '100.0000', result: 'free' },
          {
            period_from: '2026-03-11',
            period_to: '2026-03-20',
            committed: '60.0000',
            remaining: '40.0000',
            result: 'partial',
          },
          { period_from: '2026-03-21', period_to: '2026-03-31', committed: '100.0000', remaining: '0', result: 'full' },
        ]),
      ),
    ),
  );
  renderCalendar();

  const free = await screen.findByRole('button', { name: /05\.03\.2026 — Boʻsh$/ });
  expect(free).not.toBeDisabled();

  // A pasture with 60 of 100 taken must read as PARTLY free, with the
  // remainder and its unit stated — never simply "taken" (Oybek's rejected
  // two-colour reading).
  const partial = await screen.findByRole('button', {
    name: /15\.03\.2026 — Qisman band, boʻsh: 40 shartli bosh/,
  });
  expect(partial).not.toBeDisabled();
  expect(partial).toHaveTextContent('40');

  const full = await screen.findByRole('button', { name: /25\.03\.2026 — Toʻliq band/ });
  expect(full).toBeDisabled();
});

test('an unknown or absent occupancy unit renders as a bare number, never a guessed word', async () => {
  server.use(
    http.get('*/api/v1/gis/contours/:contourId/occupancy', () =>
      HttpResponse.json(
        occupancy(
          [
            {
              period_from: '2026-03-01',
              period_to: '2026-03-31',
              committed: '3.0000',
              remaining: '7.0000',
              result: 'partial',
            },
          ],
          { unit: 'crates' },
        ),
      ),
    ),
  );
  renderCalendar();

  const partial = await screen.findByRole('button', { name: /15\.03\.2026 — Qisman band, boʻsh: 7$/ });
  expect(partial).toBeInTheDocument();
});

test('an exclusive contour (no capacity) shows only free/full, never a fabricated remainder', async () => {
  server.use(
    http.get('*/api/v1/gis/contours/:contourId/occupancy', () =>
      HttpResponse.json(
        occupancy(
          [
            { period_from: '2026-03-01', period_to: '2026-03-15', committed: null, remaining: null, result: 'free' },
            { period_from: '2026-03-16', period_to: '2026-03-31', committed: null, remaining: null, result: 'full' },
          ],
          { capacity: null, exclusive: true },
        ),
      ),
    ),
  );
  renderCalendar();

  expect(await screen.findByRole('button', { name: /05\.03\.2026 — Boʻsh$/ })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: /20\.03\.2026 — Toʻliq band$/ })).toBeInTheDocument();
});

test('month navigation re-fetches occupancy for the newly visible month, one query per month', async () => {
  renderCalendar();

  await waitFor(() => expect(seenOccupancyRequests).toEqual([{ from: '2026-03-01', to: '2026-03-31' }]));

  await userEvent.click(screen.getByLabelText('Keyingi oy'));

  await waitFor(() =>
    expect(seenOccupancyRequests).toEqual([
      { from: '2026-03-01', to: '2026-03-31' },
      { from: '2026-04-01', to: '2026-04-30' },
    ]),
  );
  expect(screen.getByText('04.2026')).toBeInTheDocument();
});

test('onSeasonInfo hands the resolved windows and minimum term back to the caller', async () => {
  server.use(
    http.get('*/api/v1/activity-seasons/effective', () =>
      HttpResponse.json(effectiveSeason({ windows: [{ from: '11-01', to: '03-31' }], min_term_days: 15 })),
    ),
  );
  const onSeasonInfo = vi.fn();
  renderCalendar({ onSeasonInfo });

  await waitFor(() =>
    expect(onSeasonInfo).toHaveBeenCalledWith({ windows: [{ from: '11-01', to: '03-31' }], minTermDays: 15 }),
  );
});

test('completing a range and then clicking again starts a NEW selection', async () => {
  const { onSelectRange, rerender, client } = renderCalendar({ periodFrom: '2026-03-01', periodTo: '2026-03-20' });

  const day = await screen.findByRole('button', { name: /10\.03\.2026/ });
  await userEvent.click(day);
  expect(onSelectRange).toHaveBeenCalledWith('2026-03-10', '');

  // Clicking BEFORE the picked start, mid-selection, restarts from there
  // rather than erroring.
  onSelectRange.mockClear();
  rerender(
    <QueryClientProvider client={client}>
      <OccupancyCalendar
        contourId={CONTOUR_ID}
        activityTypeId={ACTIVITY_ID}
        periodFrom="2026-03-15"
        periodTo=""
        onSelectRange={onSelectRange}
      />
    </QueryClientProvider>,
  );
  const earlierDay = await screen.findByRole('button', { name: /05\.03\.2026/ });
  await userEvent.click(earlierDay);
  expect(onSelectRange).toHaveBeenCalledWith('2026-03-05', '');
});

test('a picked day cannot be mistaken for a free one', async () => {
  // Oybek, 2026-09-10, from the dev stand: a free day was pale green and a
  // chosen day was the SAME pale green with a thin ring, so the applicant
  // could not tell what they had actually selected. The picked range now
  // overrides the availability colour rather than decorating it.
  renderCalendar({ periodFrom: '2026-03-10', periodTo: '2026-03-12' });

  const edge = await screen.findByRole('button', { name: /10\.03\.2026/ });
  const middle = await screen.findByRole('button', { name: /11\.03\.2026/ });
  const free = await screen.findByRole('button', { name: /20\.03\.2026/ });

  // The two edges are solid dark green with white text; the day between them
  // is a filled green; neither shares the free day's own class.
  expect(edge.className).toContain('bg-[#123522]');
  expect(middle.className).toContain('bg-[#86EFAC]');
  // Whatever an UNPICKED day looks like, it must not look like a picked one:
  // that is the whole complaint, and asserting the picked classes are absent
  // survives a later change to the availability palette.
  expect(free.className).not.toContain('bg-[#123522]');
  expect(free.className).not.toContain('bg-[#86EFAC]');
  expect(free.getAttribute('title')).not.toMatch(/Tanlangan/);

  // And it is said in words too, not only in colour — a calendar read by
  // someone who cannot distinguish these greens must still work.
  expect(edge.getAttribute('title')).toMatch(/Tanlangan sana/);
  expect(middle.getAttribute('title')).toMatch(/Tanlangan davr/);
});
