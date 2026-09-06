# Task 2 report — oversight register + wiring

Branch `stage-6.7-leadership`. `npm run check` green (lint + typecheck + 502 tests / 74
files) at the end of this task.

This task picked up a half-written, uncommitted state left by an interrupted prior
session (`src/i18n/ru.ts`, `src/i18n/uz_latn.ts`, `LeadershipDashboardPage.tsx`,
`RiskIndicatorsCard.tsx`, `routes.tsx`, `shell/navigation.ts` modified; `src/pages/
oversight/` untracked, never verified). Two real bugs were found and fixed before
anything was committed — see "Fixed from the interrupted state" below.

## Built

- `src/pages/oversight/OversightPage.tsx` — `/oversight`, gated on `oversight.view`
  (`shell/navigation.ts`, `routes.tsx`). Two tabs (`risk`/`events`, local `useState`, no
  router sub-paths), each with its own draft/applied filter bar (Apply/Reset), table,
  `Pagination`, and CSV export (`fetchAllPages`/`toCsv`/`downloadCsv`) — the same
  read-only-register-with-export shape `ApplicationsListPage.tsx`/`PermitsListPage.tsx`
  already give the prosecutor. No write route exists anywhere in this module and no
  "run sweep now" control of any kind is offered.
  - Risk indicators tab: filters `code`/`level`/`status` (selects, "all" option) +
    `object_type` (free text — no classifier backs it) + period; columns Code, Level
    (colored badge), Status, Object, Description, Occurred at, RN status; CSV columns
    `code,level,status,object_type,object_id,description,occurred_at,rn_status`.
  - Events tab: filters `event_type`/`object_type` (free text) + period; columns Event
    type, Object, Occurred at, Correlation id, RN status; CSV columns add `payload` as
    `JSON.stringify(payload ?? {})`.
- `src/pages/oversight/queries.ts` — `useRiskIndicators`/`useEvents`, `page`/`page_size`
  paging (verified against `schema.d.ts`'s `list_risk_indicators_...`/`list_events_...`
  operations — both use `PageParams`, not `norms`'s `limit`/`offset`).
- `src/pages/oversight/format.ts` — `formatObject`, `formatDateTime`, `shortId`,
  `riskLevelBadgeClass` + the level/status/rn_status label-key maps. The 4-step badge
  palette is copied verbatim from `RiskIndicatorsCard.tsx`'s own (hex-for-hex) so both
  screens agree on what "critical" looks like.
- `src/pages/dashboard/components/RiskIndicatorsCard.tsx` — added `canOpenRegister`
  prop; when true, a `react-router` `Link` to `/oversight` renders in the card's
  existing `badge` slot (`DashboardCard`'s own prop, reused as-is — no fork).
- `src/pages/dashboard/LeadershipDashboardPage.tsx` — reads `me` via `useAuth()` and
  passes `canOpenOversightRegister = me.is_superuser || me.permissions.includes
  ('oversight.view')` down to `RiskIndicatorsCard`. This is the only behavioral change
  this task made to a Task-1 file.
- `src/routes.tsx` / `src/shell/navigation.ts` — `/oversight` route + one `NAVIGATION`
  entry (`ShieldAlert` icon, `permission: 'oversight.view'`), imported directly rather
  than through `placeholders.tsx` (no placeholder ever existed for this screen).
- i18n: `nav.oversight` in the flat `nav.*` block, plus 32 keys under
  `leadership.oversight.*` in both `ru.ts`/`uz_latn.ts` (key-for-key symmetric, real
  Russian and real Uzbek-Latin throughout). Reused `prosecutor.exportCsv`/
  `prosecutor.exportTruncated` verbatim for the export button/truncation banner — no
  duplicate keys added for those two strings.

## Fixed from the interrupted state

The uncommitted work on disk had two real bugs, caught by actually running the suite
rather than trusting the diff:

1. **`LeadershipDashboardPage.test.tsx` was never updated** for the `useAuth()` call the
   interrupted session had already added to the page — every one of its 8 tests failed
   with `useAuth must be used within an AuthProvider`. Added an `authValue()` builder
   (mirrors `PermitLifecyclePanel.test.tsx`'s own pattern, `stubAuthActions()` from
   `auth/testAuthActions.ts`) and wrapped `renderDashboard()`'s tree in
   `AuthContext.Provider`. Also added two new tests for the wiring this task actually
   added: a caller with `oversight.view` sees the "open the full register" link
   (`role="link"`, `href="/oversight"`); a caller without it never sees the link — an
   action the backend would refuse is not offered, including a plain navigation link.
2. **`OversightPage.test.tsx`'s own fixture code (`RI-07`) collides with the code
   filter's `<option value="RI-07">RI-07</option>`.** `screen.findByText('RI-07')`
   resolved against the filter dropdown — present on the very first render, before any
   fetch completes — instead of waiting for the actual table row, so assertions that
   depended on the row having loaded raced ahead of the data. Rewrote every such wait to
   `findByTestId('risk-row-<id>')` / `findByTestId('event-row-<id>')` (both already
   emitted by `OversightPage.tsx`) and scoped the per-row assertions with `within(row)`.
   Also removed a leftover `console.log` debug line and an unused `within` import that
   were failing lint.

## Tests

- `OversightPage.test.tsx` (4 tests): risk-indicators tab renders backend rows,
  including a `critical` badge with the right class; switching to the Events tab issues
  `GET /oversight/events`, renders its own rows, and does not re-request risk
  indicators; CSV export calls `URL.createObjectURL`; a parametrized RU/UZ pass walks
  both tabs and asserts no raw `leadership.oversight.*` key reaches the page.
- `shell/navigation.test.tsx` re-run directly (11 tests, all passing) — the "every
  `NAVIGATION` entry resolves to a real route" walk catches a missing route for a new
  nav entry; confirmed green after the `routes.tsx`/`navigation.ts` edits rather than
  assumed.
- `LeadershipDashboardPage.test.tsx` (10 tests, 2 new) — see "Fixed from the interrupted
  state" above.

## What this deliberately does not build

- No "run sweep now" control anywhere — `oversight.sweep` is a 5-minute scheduled job
  with no HTTP route and no registered permission code
  (`app/workers/jobs.py::oversight_sweep`).
- No fake dropdown for `object_type` on either tab's filters — it is a free-text field
  because no classifier or enum backs it server-side.
- No second, client-side territorial-scoping guess anywhere in either task — the
  backend's own `_combined` AND already fails closed.
