import {
  activePermitsSummary,
  applicationsInProgress,
  expiryByActivity,
  monthlySeries,
  nearestExpiry,
  reviewDeadlines,
  reviewStats,
  seasonalPayments,
} from './metrics';
import { application, invoice, permit } from './fixtures';

/** Every "today" below is this date, so a fixture's `period_to` reads as a
 *  fixed number of days away rather than drifting with the wall clock. */
const TODAY = '2026-09-05';

// --- tile 1: active permits and their area -------------------------------

test('the area tile sums only ACTIVE permits', () => {
  const summary = activePermitsSummary([
    permit({ status: 'active', area_ha: '42.6000' }),
    permit({ status: 'active', area_ha: '18.4000' }),
    permit({ status: 'expired', area_ha: '99.0000' }),
    permit({ status: 'pending_signatures', area_ha: '77.0000' }),
  ]);

  expect(summary.count).toBe(2);
  expect(summary.totalAreaHa).toBeCloseTo(61.0);
});

test('no permits reads as zero area, never NaN', () => {
  expect(activePermitsSummary([])).toEqual({ count: 0, totalAreaHa: 0 });
});

// --- tile 2: applications still moving -----------------------------------

test('an application in progress is one that is not yet finished', () => {
  const summary = applicationsInProgress([
    application({ status: 'SUBMITTED' }),
    application({ status: 'IN_REVIEW' }),
    application({ status: 'INVOICED' }),
    application({ status: 'CANCELLED' }),
    application({ status: 'PERMIT_ISSUED' }),
    application({ status: 'REJECTED' }),
  ]);

  expect(summary.count).toBe(3);
});

test('only an INVOICED application is waiting for the citizen to pay', () => {
  const summary = applicationsInProgress([
    application({ status: 'INVOICED' }),
    application({ status: 'INVOICED' }),
    application({ status: 'IN_REVIEW' }),
  ]);

  expect(summary.awaitingPayment).toBe(2);
});

// --- tile 3: the season's money ------------------------------------------

test('the season total is the sum of the active permits own amounts', () => {
  const summary = seasonalPayments(
    [
      permit({ status: 'active', amount: '2680000.00' }),
      permit({ status: 'active', amount: '1000000.00' }),
      permit({ status: 'revoked', amount: '5000000.00' }),
    ],
    [],
  );

  expect(summary.totalAmount).toBeCloseTo(3680000);
});

test('the receipt share counts paid invoices against all of them', () => {
  const summary = seasonalPayments(
    [],
    [invoice({ paid_at: '2026-04-12T10:00:00+05:00' }), invoice({ paid_at: null })],
  );

  expect(summary.receiptsConfirmedPct).toBe(50);
});

test('with no invoice at all the receipt share is unknown, not 100%', () => {
  expect(seasonalPayments([], []).receiptsConfirmedPct).toBeNull();
});

// --- tile 4: the nearest expiry (replaces the field-inspection tile) ------

test('the nearest expiry is the soonest ACTIVE permit still ahead of today', () => {
  const nearest = nearestExpiry(
    [
      permit({ status: 'active', period_to: '2026-11-26' }),
      permit({ status: 'active', period_to: '2026-09-26' }),
      permit({ status: 'expired', period_to: '2026-09-06' }),
    ],
    TODAY,
  );

  expect(nearest?.daysLeft).toBe(21);
});

test('a permit whose period ended is not the nearest expiry', () => {
  const nearest = nearestExpiry([permit({ status: 'active', period_to: '2026-09-01' })], TODAY);

  expect(nearest).toBeNull();
});

// --- the dynamics chart ---------------------------------------------------

test('the dynamics chart returns one point per month of the window', () => {
  const series = monthlySeries({ applications: [], permits: [], invoices: [] }, { today: TODAY, months: 6 });

  expect(series).toHaveLength(6);
  expect(series[0].key).toBe('2026-04');
  expect(series[5].key).toBe('2026-09');
});

test('each event lands in the month it happened in', () => {
  const series = monthlySeries(
    {
      applications: [
        application({ submitted_at: '2026-06-10T10:00:00+05:00' }),
        application({ submitted_at: '2026-06-20T10:00:00+05:00' }),
      ],
      permits: [permit({ issued_at: '2026-07-01T10:00:00+05:00' })],
      invoices: [invoice({ paid_at: '2026-08-15T10:00:00+05:00' })],
    },
    { today: TODAY, months: 6 },
  );

  const at = (key: string) => series.find((point) => point.key === key)!;
  expect(at('2026-06').applications).toBe(2);
  expect(at('2026-07').permits).toBe(1);
  expect(at('2026-08').payments).toBe(1);
});

test('an event older than the window is left out rather than folded into the first month', () => {
  const series = monthlySeries(
    { applications: [application({ submitted_at: '2024-01-10T10:00:00+05:00' })], permits: [], invoices: [] },
    { today: TODAY, months: 6 },
  );

  expect(series.reduce((sum, point) => sum + point.applications, 0)).toBe(0);
});

test('an application never submitted contributes to no month', () => {
  const series = monthlySeries(
    { applications: [application({ submitted_at: null })], permits: [], invoices: [] },
    { today: TODAY, months: 6 },
  );

  expect(series.reduce((sum, point) => sum + point.applications, 0)).toBe(0);
});

// --- the footer under the chart ------------------------------------------

test('the average review time counts only applications that were decided', () => {
  const stats = reviewStats([
    application({ submitted_at: '2026-04-01T00:00:00+05:00', decided_at: '2026-04-11T00:00:00+05:00' }),
    application({ submitted_at: '2026-05-01T00:00:00+05:00', decided_at: '2026-05-09T00:00:00+05:00' }),
    application({ submitted_at: '2026-06-01T00:00:00+05:00', decided_at: null }),
  ]);

  expect(stats.avgReviewDays).toBe(9);
});

test('SLA is met when the decision landed on or before the deadline', () => {
  const stats = reviewStats([
    application({
      sla_deadline_at: '2026-04-15T00:00:00+05:00',
      decided_at: '2026-04-14T00:00:00+05:00',
      submitted_at: '2026-04-01T00:00:00+05:00',
    }),
    application({
      sla_deadline_at: '2026-05-15T00:00:00+05:00',
      decided_at: '2026-05-20T00:00:00+05:00',
      submitted_at: '2026-05-01T00:00:00+05:00',
    }),
  ]);

  expect(stats.slaOnTimePct).toBe(50);
});

test('an application with no SLA deadline is left out of the SLA share', () => {
  const stats = reviewStats([
    application({ sla_deadline_at: null, decided_at: '2026-04-14T00:00:00+05:00' }),
  ]);

  expect(stats.slaOnTimePct).toBeNull();
});

test('the success share weighs approved outcomes against rejected ones', () => {
  const stats = reviewStats([
    application({ status: 'PERMIT_ISSUED' }),
    application({ status: 'APPROVED' }),
    application({ status: 'INVOICED' }),
    application({ status: 'REJECTED' }),
    application({ status: 'IN_REVIEW' }),
  ]);

  expect(stats.approvedPct).toBe(75);
});

test('the history line spans the first and last application years', () => {
  const stats = reviewStats([
    application({ created_at: '2024-03-01T00:00:00+05:00' }),
    application({ created_at: '2026-09-01T00:00:00+05:00' }),
  ]);

  expect(stats.total).toBe(2);
  expect(stats.yearsFrom).toBe(2024);
  expect(stats.yearsTo).toBe(2026);
});

// --- the deadlines card: permits by type ---------------------------------

test('each activity type shows the days left on its soonest ACTIVE permit', () => {
  const rows = expiryByActivity(
    [
      permit({ status: 'active', activity_type_id: 'grazing', period_to: '2026-11-26' }),
      permit({ status: 'active', activity_type_id: 'grazing', period_to: '2026-09-26' }),
      permit({ status: 'active', activity_type_id: 'haymaking', period_to: '2026-10-05' }),
      permit({ status: 'expired', activity_type_id: 'grazing', period_to: '2026-09-06' }),
    ],
    TODAY,
  );

  expect(rows).toEqual([
    { activityTypeId: 'grazing', daysLeft: 21, count: 2 },
    { activityTypeId: 'haymaking', daysLeft: 30, count: 1 },
  ]);
});

test('an active permit already past its end date shows no negative days', () => {
  const rows = expiryByActivity([permit({ status: 'active', period_to: '2026-08-01' })], TODAY);

  expect(rows[0].daysLeft).toBe(0);
});

// --- the deadlines card: applications under review ------------------------

/** A Thursday, so the counts below have a weekend to skip. */
const NOW = new Date('2026-09-24T10:00:00+05:00');

test('the review countdown counts working days only, Monday to Friday', () => {
  const [row] = reviewDeadlines(
    [application({ status: 'IN_REVIEW', sla_deadline_at: '2026-10-01T10:00:00+05:00' })],
    NOW,
  );

  // Fri 25, Mon 28, Tue 29, Wed 30, Thu 1 — the weekend between is not counted.
  expect(row).toMatchObject({ state: 'running', workingDaysLeft: 5 });
});

test('a deadline later today leaves zero working days, and is not yet overdue', () => {
  const [row] = reviewDeadlines(
    [application({ status: 'SUBMITTED', sla_deadline_at: '2026-09-24T18:00:00+05:00' })],
    NOW,
  );

  expect(row).toMatchObject({ state: 'running', workingDaysLeft: 0 });
});

test('a deadline that has passed while the office holds the file is overdue', () => {
  const [row] = reviewDeadlines(
    [application({ status: 'IN_REVIEW', sla_deadline_at: '2026-09-23T10:00:00+05:00' })],
    NOW,
  );

  expect(row.state).toBe('overdue');
});

test('while the office waits on the citizen the clock is paused, whatever the stored deadline says', () => {
  const rows = reviewDeadlines(
    [
      application({ status: 'PENDING_INFO', sla_deadline_at: '2026-09-20T10:00:00+05:00' }),
      application({ status: 'RETURNED', sla_deadline_at: '2026-10-01T10:00:00+05:00' }),
    ],
    NOW,
  );

  expect(rows.map((row) => row.state)).toEqual(['paused', 'paused']);
});

test('a decided application has no review countdown left to show', () => {
  const rows = reviewDeadlines(
    (['APPROVED', 'INVOICED', 'PAID', 'PERMIT_ISSUED', 'REJECTED', 'CANCELLED'] as const).map((status) =>
      application({ status, sla_deadline_at: '2026-10-01T10:00:00+05:00' }),
    ),
    NOW,
  );

  expect(rows).toEqual([]);
});

test('the list puts overdue first, then the fewest working days left, then the paused', () => {
  const rows = reviewDeadlines(
    [
      application({ number: 'paused', status: 'PENDING_INFO', sla_deadline_at: '2026-09-25T10:00:00+05:00' }),
      application({ number: 'later', status: 'IN_REVIEW', sla_deadline_at: '2026-10-01T10:00:00+05:00' }),
      application({ number: 'late', status: 'IN_REVIEW', sla_deadline_at: '2026-09-22T10:00:00+05:00' }),
      application({ number: 'sooner', status: 'SUBMITTED', sla_deadline_at: '2026-09-28T10:00:00+05:00' }),
    ],
    NOW,
  );

  expect(rows.map((row) => row.number)).toEqual(['late', 'sooner', 'later', 'paused']);
});
