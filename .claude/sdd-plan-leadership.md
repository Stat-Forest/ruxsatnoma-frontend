# Plan — stage 6.7 track J3: leadership dashboard + oversight register

Branch `stage-6.7-leadership`, worktree `adminka/.claude/worktrees/leadership`. No spec
document exists for this track beyond the dispatch brief already given to the controller
session; this plan file IS the spec, written after reading the real backend source
(`app/modules/dashboard/{router,schemas,service,repo}.py`,
`app/modules/oversight/{router,schemas,service,models,jobs}.py`) and the existing
front-end house precedent (`src/pages/dashboard/ApplicantDashboardPage.tsx` and its
`components/`, `format.ts`, `queries.ts`).

## Global constraints (apply to every task)

- **Never render a plausible constant.** Every figure on screen must come from a real
  API field. `KpiOut.omitted` is itself an API field naming tiles that could not be
  built (`inspections_count`, `violations_count`) — render that list honestly (a small
  notice), never fill the gap with a fake number.
- **Territorial scoping already works and is fail-closed** (verified:
  `app/modules/dashboard/repo.py::_combined` ANDs the actor's own zone with any explicit
  `region_id`/`district_id`/`organization_id` filter — a filter can only narrow the
  actor's own zone, never widen it). Do not add a second client-side scoping guess on
  top of this; trust the backend's own AND and let an out-of-zone filter simply return
  empty rows.
- **No action the backend would refuse.** Both `dashboard` and `oversight` are pure
  readers (`design/01 rule 5` in both module docstrings) — there is no
  create/update/delete route anywhere in either module, and no route to manually
  trigger the oversight sweep (it is a 5-minute scheduled job,
  `app/workers/jobs.py::oversight_sweep` → `app/modules/oversight/jobs.py::sweep`, with
  no HTTP entry point and no `oversight.sweep` permission code registered anywhere in
  the backend — only an audit-log `action` string of that name). **Build no
  "run sweep now" control of any kind.**
- **i18n:** every new user-facing string goes through `useT()` with a key under the
  `leadership.*` namespace (new nav labels are the one exception — see Task 2 — they
  join the existing flat `nav.*` namespace every track's nav entry already uses). Add
  the key to **both** `src/i18n/ru.ts` and `src/i18n/uz_latn.ts`, same key, in the same
  relative position (append a new `// --- J3: ... ---` block before the closing `};` in
  each file) — the two files must stay key-for-key symmetric. Follow the bilingual
  convention `src/pages/staff/format.ts::STATUS_LABELS` uses only where you are told to
  reuse that exact map (Task 1); everywhere else write a real Russian string in `ru.ts`
  and a real Uzbek-Latin string in `uz_latn.ts`, not the same text pasted twice.
- **Money/number formatting:** reuse `src/pages/dashboard/format.ts` — add to it, never
  duplicate `formatCompactMoney`/`formatHectares`/`formatReviewDays` elsewhere.
- **Components to reuse verbatim (do not fork or re-implement):**
  `src/pages/dashboard/components/DashboardCard.tsx` (`DashboardCard`, `CardBadge`,
  `EmptyPanel`), `src/pages/dashboard/components/KpiTile.tsx` (`KpiTile`, `TileCount`).
- **Test discipline:** every test file that stands up its own MSW server must call
  `server.listen({ onUnhandledRequest: 'error' })` — copy the pattern from
  `src/pages/dashboard/ApplicantDashboardPage.test.tsx` (a `setupServer()` +
  `beforeAll`/`afterEach`/`afterAll` block). `TZ=Asia/Tashkent` is fixed in
  `vite.config.ts`; never assert a hard-coded "today" — either drive the date fields
  through the UI before asserting, or assert on the shape/format of a query param
  rather than its exact value.
- **`npm run check` must be green** (typecheck + lint + test) before a task's commit,
  and again before the task is reported done.
- Commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- Do not touch any file outside this plan's task lists. Do not regenerate
  `src/api/schema.d.ts`. Do not `git push`.

## Backend contract this plan is built on (verified against source, not guessed)

`GET /api/v1/dashboard/kpi` — query `period_from` (date, required), `period_to` (date,
required), `region_id?`, `district_id?`, `organization_id?`, `activity_type_id?`,
`compare_previous?` (bool). Returns `KpiOut`:

```
period: { period_from, period_to }
permits: { issued_count, active_count, previous_issued_count | null }
applications: { total_count, by_status: Record<status, count>, previous_total_count | null }
occupancy: { contour_count, avg_occupied_pct: string | null }   // Decimal serializes as string
sb_load_total: string                                            // Decimal as string — "condition head" grazing load, sum of active permits' `permits.sb_load`
payments: { invoiced_amount, paid_amount, budget_share_amount, recipient_share_amount }  // all Decimal-as-string
sla: { active_count, overdue_count }
rejections: [{ reason_item_id: uuid, count: int }]                // uuid resolves via classifier code "rejection_reasons"
risk_indicators: { by_code: Record<"RI-01".."RI-15", count>, by_level: Record<"low"|"medium"|"high"|"critical", count> }
omitted: string[]   // e.g. "inspections_count: the 4.1 `inspections` module is not merged into `dev` yet"
```

`previous_*` fields are populated only when `compare_previous=true` was passed;
otherwise `null`. `previous_*` exists ONLY for `permits.issued_count` and
`applications.total_count` — no other tile has a prior-period comparison, do not
invent one.

`GET /api/v1/dashboard/territory-slice` — query `period_from`, `period_to` (both
required), `region_id?`, `district_id?`, `organization_id?`. Exactly one filter is ever
passed by a well-behaved caller, and it picks the next drill level: none → `region`
cells; `region_id` → `district` cells of that region; `district_id` → `organization`
cells of that district; `organization_id` → `contour` cells of that organization
(terminal — no further drill). Returns `TerritorySliceOut`:

```
level: "region" | "district" | "organization" | "contour"
k_anonymity_threshold: int
cells: [{ level, key: uuid | null, label: string, applications_count: int | null,
          permits_count: int | null, applicant_count: int | null, suppressed: bool }]
```

When `suppressed` is `true`, all three counts are `null` — render that row as
"hidden below the anonymity threshold", never as zero.

`GET /api/v1/oversight/risk-indicators` — query `code?` (`RI-01`..`RI-15`), `level?`
(`low`|`medium`|`high`|`critical`), `status?` (`new`|`in_review`|`closed`),
`object_type?` (string), `object_id?` (uuid), `period_from?`, `period_to?`, `page?`,
`page_size?`. Returns `Page<RiskIndicatorOut>` where each item is `{ id, code, level,
object_type, object_id, responsible_user_id, description, details, occurred_at,
status, rn_status }`.

`GET /api/v1/oversight/events` — query `event_type?` (string), `object_type?` (string),
`period_from?`, `period_to?`, `page?`, `page_size?`. Returns `Page<OversightEventOut>`
where each item is `{ id, event_type, object_type, object_id, payload, correlation_id,
occurred_at, rn_status }`.

Both oversight routes are gated on permission `oversight.view` alone (granted by
migration 0028 to `central_admin`, `leadership`, `executor_head` zone-scoped to their
own org, and `prosecutor` — `sys_admin` passes as superuser). `rn_status` is always
`"internal"` today (the check constraint allows `internal|pending|sent|failed`, but
nothing in this codebase ever moves it past `internal` — RN transport, `tz/09`, does
not exist yet) — render whatever the field says, never assume or hint it means "sent
to the prosecutor's office."

Both dashboard routes are gated on `dashboard.view` (granted to every staff role except
`applicant`, per `tz/03`'s matrix — zone-scoped per caller, never by a second code).

Role code for this track's dashboard branch is literally `leadership` (`docs/tz/03-roli.md`
role #3, "Руководство агентства"). `DashboardPage.tsx` currently branches only on
`role.code === 'applicant'`; this plan adds one more branch, for `'leadership'`, leaving
every other role on the existing placeholder — the screen inventory (J1/J2) assigns
inspector's and central apparatus's own dashboards to other tracks/stages, not this one.

## Task 1 — Leadership KPI dashboard

**Goal:** `/` (the existing dashboard route, no new route needed) renders a real
dashboard for a user whose `role.code === 'leadership'`, built only from `KpiOut` and
`TerritorySliceOut` — the two `dashboard` routes above.

**Files to create:**
- `src/pages/dashboard/LeadershipDashboardPage.tsx`
- `src/pages/dashboard/LeadershipDashboardPage.test.tsx`
- `src/pages/dashboard/components/KpiFilters.tsx`
- `src/pages/dashboard/components/TerritoryDrilldown.tsx`
- `src/pages/dashboard/components/TerritoryDrilldown.test.tsx`
- `src/pages/dashboard/components/OmittedNotice.tsx`
- `src/pages/dashboard/components/RiskIndicatorsCard.tsx`
- `src/pages/dashboard/components/RejectionsCard.tsx`

**Files to edit:**
- `src/pages/dashboard/queries.ts` — add:
  - `useKpi(params: { period_from: string; period_to: string; region_id?: string; district_id?: string; organization_id?: string; activity_type_id?: string; compare_previous?: boolean })` — `useQuery`, `queryKey: ['dashboard', 'kpi', params]`, `GET /api/v1/dashboard/kpi`, same `apiError` pattern as the rest of this file.
  - `useTerritorySlice(params: { period_from: string; period_to: string; region_id?: string; district_id?: string; organization_id?: string })` — `queryKey: ['dashboard', 'territory-slice', params]`, `GET /api/v1/dashboard/territory-slice`.
  - `useRejectionReasonItems()` — mirrors `src/pages/staff/queries.ts::useRejectionReasons` exactly (same classifier code `'rejection_reasons'`, same `GET /api/v1/refs/classifiers/{code}/items` call, same `staleTime: 10 * 60_000`) but defined locally in this file — this folder's own convention (see the file's own header comment) is to duplicate a small cross-cutting query rather than import another page folder's module.
  - `useRegions()` — `GET /api/v1/refs/regions`, `queryKey: ['refs', 'regions']`, `staleTime: 10 * 60_000`.
  - `useDistricts(regionId: string | undefined)` — `GET /api/v1/refs/districts` with `query: { region_id: regionId }` when `regionId` is set, otherwise do not fire the query (`enabled: !!regionId`) and return an empty list from the component's perspective; `queryKey: ['refs', 'districts', regionId]`.
  - `useOrganizationsInRegion(regionId: string | undefined)` — `GET /api/v1/refs/organizations` with `query: { region_id: regionId, page_size: 100 }`, `enabled: !!regionId`, `queryKey: ['refs', 'organizations', regionId]`. (There is no `district_id` query param on this route — `OrganizationOut.district_id` exists on each returned row, so the caller filters client-side when a district is also selected. Do the filtering in `KpiFilters.tsx`, not in this hook.)
- `src/pages/dashboard/format.ts` — add:
  - `formatPercent(value: string | null): string` — `value` is `OccupancyKpiOut.avg_occupied_pct` as a decimal string (e.g. `"42.50"`) or `null`. Return `"—"` for `null` (there were zero contours in scope — not "0%", which would claim a measured value of zero occupancy). Otherwise format to one decimal with a `%` suffix, e.g. `"42.5%"`.
  - `formatDelta(current: number, previous: number | null): string | null` — `null` when `previous` is `null` (comparison off or unavailable). Otherwise `"+N"` or `"−N"` (real minus sign U+2212, matching this codebase's money/number conventions) for the difference `current - previous`, `"±0"` when equal.
- `src/pages/dashboard/DashboardPage.tsx` — add a `role.code === 'leadership'` branch (import `LeadershipDashboardPage`), update the doc comment to say two roles now have real screens.
- `src/pages/dashboard/DashboardPage.test.tsx` — add a `vi.mock('./LeadershipDashboardPage', ...)` (same pattern as the existing `ApplicantDashboardPage` mock) and a test `'a leadership user lands on the KPI dashboard'` asserting the mocked marker renders. Leave the existing two tests untouched — they stay true.
- `src/i18n/ru.ts`, `src/i18n/uz_latn.ts` — append the key set below (§ i18n keys), same key list, same order, real Russian in `ru.ts` and real Uzbek-Latin in `uz_latn.ts`.

**Page layout (`LeadershipDashboardPage.tsx`):**

1. **Filters bar** (`KpiFilters`): draft-state-until-Apply, same UX shape as
   `src/pages/staff/ApplicationsListPage.tsx` (local draft object, `applyFilters`/
   `resetFilters`, an "Apply"/"Reset" button pair — use `t()` for their labels this
   time, do not hardcode Uzbek text the way that older file does). Fields: `period_from`
   / `period_to` date inputs (default: first day of the current month → today, computed
   the same way `ApplicantDashboardPage.tsx::todayIso()` does — local `Date` getters,
   correct under the suite's fixed `TZ=Asia/Tashkent`); region/district/organization
   cascading selects (`useRegions`/`useDistricts`/`useOrganizationsInRegion`, each
   select disabled and empty until its parent is chosen, "Barchasi"/"Barcha
   tumanlar"-style "all" option at the top via `t()`); an activity-type select (reuse
   the existing `useActivityTypes()` already in this file); a "compare with the
   previous period" checkbox controlling `compare_previous`.
2. **KPI tiles row** (`KpiTile`, 4 tiles): permits issued (`permits.issued_count`,
   hint = active_count, delta via `formatDelta(issued_count, previous_issued_count)`
   shown only when compare is on and the value is non-null); applications total
   (`applications.total_count`, same delta treatment against
   `previous_total_count`); payments (`formatCompactMoney(paid_amount)` as the
   headline, hint = `formatCompactMoney(invoiced_amount)` and the paid/invoiced ratio
   when `invoiced_amount > 0`, else an honest "no invoices in this period" hint — never
   divide by zero into a fake percentage); SLA (`active_count` headline,
   `overdue_count` as the hint, `tone="brand"` only when `overdue_count > 0` so an
   actual problem visually stands out, never a decorative default).
3. **Occupancy + sb_load row** (two `DashboardCard`s or one card with two stats):
   `formatPercent(avg_occupied_pct)` over `contour_count` contours (state the contour
   count in the subtitle — an average over zero contours must not be presented as
   `"—"` floating with no explanation) and `sb_load_total` (label this
   "Нагрузка (условные головы)" / "Yuklama (shartli boshlar)" — the same
   "shartli bosh" / "условная голова" terminology `src/i18n/*.ts` already uses at
   `norms.norms.col.maxSb` and the archive-confirm dialog text near it — grep for
   "shartli" in `uz_latn.ts` before writing the new strings so the wording matches).
4. **Rejections card** (`RejectionsCard`): `KpiOut.rejections` (list of
   `{reason_item_id, count}`) resolved against `useRejectionReasonItems()` by matching
   `id`; render as a small ranked list (label + count), falling back to the raw id
   string if a reason item is not found in the resolved list (never drop the row
   silently) . `EmptyPanel` when the list is empty (no rejections in the period — a
   good sign, present it as an empty state, not a chart drawn around zero).
5. **Risk indicators card** (`RiskIndicatorsCard`): `risk_indicators.by_code` and
   `by_level` as two small breakdowns (badges or a compact two-column list) — `by_level`
   coloured consistent with how `oversight`'s own page will colour level badges in Task
   2 (low/medium/high/critical — pick a 4-step neutral-to-alarming palette now and hand
   the exact hex values to Task 2's brief so both screens agree). `EmptyPanel` when both
   maps are empty. This component takes its data as props (`byCode`, `byLevel`) — it
   does NOT fetch anything itself, so Task 2 can extend it with a navigation link later
   without touching its data layer.
6. **Territory drill-down** (`TerritoryDrilldown`): owns its OWN navigation state
   (starts at `region` level with no filter — independent of the `KpiFilters`
   region/district/organization selects, which are a different, unrelated narrowing of
   the KPI tiles above; do not wire them together). Renders `k_anonymity_threshold`
   once near the table header ("свёрнуто при значении ниже N" / equivalent), a
   breadcrumb ("Republic ▸ <region label> ▸ <district label>") built from the labels
   the user has already clicked through (state kept in the component, not re-fetched),
   and a table of `cells`: `label`, `applications_count`, `permits_count`,
   `applicant_count` — every suppressed cell renders all three counts as a fixed
   "скрыто (< N)" / "yashirin (< N)" string instead of the `null`s, with a lock icon,
   never as `0` or `—` (those both read as real numbers/absences, not as "suppressed
   for privacy", which is the actual reason). A row's `label` is clickable to drill
   deeper by passing that row's own `key` as the appropriate next filter — EXCEPT at
   `level === "contour"` (terminal, unclickable) and except a `suppressed` row (its
   `key` may still be present but drilling into a cell too small to show counts for is
   not a real next step — render its label as plain text, not a button, when
   `suppressed` is true). A "back" control returns one level up using the breadcrumb
   state.
7. **Omitted notice** (`OmittedNotice`): renders `KpiOut.omitted` as a small dismissable
   or just-always-visible notice card, ONE localized sentence per recognized prefix
   (match on the text before the first `:` — `"inspections_count"` /
   `"violations_count"` — via a small lookup map in this component); an unrecognized
   entry (the array is genuinely a `list[str]`, so a future backend addition is
   possible) renders its raw string rather than being silently dropped. When the array
   is empty, render nothing at all (not an empty card).

**Loading/error states:** mirror `ApplicantDashboardPage.tsx` — a `dashboard-loading`
testid block while `useKpi`/`useTerritorySlice` are pending, a `dashboard-error` block
using `<Alert variant="danger">` on error (`ApiError` message when available).

**`LeadershipDashboardPage.test.tsx` must cover** (MSW, `onUnhandledRequest: 'error'`):
- KPI tiles render real numbers from a mocked `KpiOut` fixture (assert on rendered text
  for at least: issued/active permits, applications total, an occupancy percentage, the
  SLA overdue count).
- A mocked `omitted: ["inspections_count: ..."]` renders the recognized localized
  sentence, not the raw backend string.
- A mocked `omitted: []` renders nothing extra (no empty notice card in the DOM).
- Occupancy `avg_occupied_pct: null` with `contour_count: 0` renders `"—"`, never `"0%"`.
- A `TerritorySliceOut` fixture with one `suppressed: true` cell renders the
  "hidden below threshold" text for that row and never renders `0` for its counts.
- Changing the period via the UI and clicking Apply issues a new `dashboard/kpi`
  request with the new `period_from`/`period_to` (assert via the MSW handler capturing
  the request URL's query string — do not assert against a hard-coded literal date,
  drive the value through the date inputs first).

**`TerritoryDrilldown.test.tsx` must cover** (can mock the hook / take data as props if
you choose to make the fetching a prop-driven presentational component — your call, but
document the choice in the component's own docstring): drilling from region → district
→ organization by clicking a cell issues the next-level query with the right filter id;
a suppressed cell is not clickable; the terminal `contour` level renders no
clickable rows at all.

**i18n keys to add** (both files, same set, `leadership.*` except where noted):
`leadership.dash.filters.periodFrom`, `.periodTo`, `.region`, `.district`,
`.organization`, `.activityType`, `.allRegions`, `.allDistricts`, `.allOrganizations`,
`.allActivityTypes`, `.comparePrevious`, `.apply`, `.reset`,
`leadership.dash.tile.permits.label`, `.hint`, `leadership.dash.tile.applications.label`,
`.hint`, `leadership.dash.tile.payments.label`, `.noInvoices`, `.paidOfInvoiced`,
`leadership.dash.tile.sla.label`, `.hint`, `leadership.dash.occupancy.title`,
`.subtitle`, `leadership.dash.sbLoad.title`, `leadership.dash.rejections.title`,
`leadership.dash.rejections.empty`, `leadership.dash.risk.title`,
`leadership.dash.risk.empty`, `leadership.dash.territory.title`,
`leadership.dash.territory.threshold`, `.suppressed`, `.back`, `.root`,
`leadership.dash.omitted.inspections`, `.violations`, `leadership.dash.loading`,
`leadership.dash.error`. (Add more only if the layout above genuinely needs them —
do not pad the list; do not skip one this list names.)

**Report file:** `.claude/sdd-task1-report.md` inside this worktree.

---

## Task 2 — Oversight register (extends the prosecutor's read-only area) + wiring

**Goal:** a new page at route `/oversight`, gated on permission `oversight.view`,
listing `risk-indicators` and `events` — the same "read-only register with CSV export"
shape `src/pages/staff/ApplicationsListPage.tsx` and `src/pages/permits/PermitsListPage.tsx`
already give the prosecutor for applications/permits (I1). This is a NEW page (no
existing oversight UI anywhere in the repo — verified by grep), reusing that same
established pattern rather than inventing a new one.

**Files to create:**
- `src/pages/oversight/OversightPage.tsx`
- `src/pages/oversight/OversightPage.test.tsx`
- `src/pages/oversight/queries.ts`
- `src/pages/oversight/format.ts`

**Files to edit:**
- `src/pages/dashboard/components/RiskIndicatorsCard.tsx` (created in Task 1) — add an
  optional small "Open the full register →" link (`react-router`'s `Link`, not a plain
  `<a>`, to `/oversight`) rendered only when a new `canOpenRegister: boolean` prop is
  `true`; `LeadershipDashboardPage.tsx` passes
  `me?.permissions.includes('oversight.view') || me?.is_superuser` for that prop. This
  is the only edit this task makes to Task 1's files — do not touch anything else there.
- `src/pages/placeholders.tsx` — add `export function OversightPage() { return
  <OversightPageImpl />; }`-style re-export, OR import `OversightPage` directly in
  `routes.tsx` (this repo does both in different places — `DashboardPage`/`GisPage`/etc.
  are re-exported here, while `LoginPage`/`UsersPage`/the admin pages are imported
  directly in `routes.tsx`). Since `/oversight` is a brand-new nav entry (not a
  placeholder being replaced), import it directly in `routes.tsx` — do not add a
  needless re-export to `placeholders.tsx` for a page that never had a placeholder.
- `src/routes.tsx` — import `OversightPage` from `./pages/oversight/OversightPage`; add
  `'/oversight': <OversightPage />` to `CHILD_PAGES`.
- `src/shell/navigation.ts` — add one `NAVIGATION` entry:
  `{ to: '/oversight', labelKey: 'nav.oversight', permission: 'oversight.view', icon: ShieldAlert }`
  (import `ShieldAlert` from `lucide-react` alongside the existing icon imports;
  distinct from `ShieldCheck`, already used for `/admin/roles`). Place it near the other
  read-oriented entries (after `/permits`, before `/admin/users` reads well, but exact
  position is your judgment — it does not affect any test that walks `NAVIGATION` by
  content rather than by index).
- `src/i18n/ru.ts`, `src/i18n/uz_latn.ts` — add `nav.oversight` to the existing flat
  `nav.*` block at the top of each file (not inside a `leadership.*` block — every
  other `nav.*` key from every track lives there ungrouped), plus the
  `leadership.oversight.*` keys below in a new block. Reuse the EXISTING
  `prosecutor.exportCsv` / `prosecutor.exportTruncated` keys verbatim for this screen's
  export button and truncation banner — do not create `leadership.oversight.exportCsv`
  as a duplicate of an existing key.

**`OversightPage.tsx` layout:**

Two tabs, "Risk indicators" (default) and "Events" (a simple local `useState<'risk' |
'events'>` — no router sub-paths needed, this is one screen with two registers, same
choice `src/pages/accountant/AccountantWorkspace.tsx` makes for its own tabs — check
that file's tab-switch pattern before writing this one from scratch).

**Risk indicators tab:**
- Filters (draft/applied, Apply/Reset, same shape as Task 1's `KpiFilters` and as
  `ApplicationsListPage`): `code` select (`RI-01`..`RI-15`, plus "all"), `level` select
  (`low`/`medium`/`high`/`critical`, plus "all" — reuse Task 1's exact level color
  palette for the badges here), `status` select (`new`/`in_review`/`closed`, plus
  "all"), `period_from`/`period_to` dates, `object_type` free-text input (no classifier
  or enum backs this field — a small optional text box is honest here, do not build a
  fake dropdown of guessed values).
- Table columns: Code, Level (colored badge), Status, Object (`object_type` +
  shortened `object_id`, or `"—"` when either is `null`), Description, Occurred at,
  RN status (a plain badge showing the literal value — `internal` today, always; do
  not add a tooltip or label implying anything is actually transmitted anywhere, since
  nothing is yet).
- Pagination via the existing `Pagination` component (`currentPage`/`totalPages`/
  `onPageChange`/`totalRecords` — same props `ApplicationsListPage.tsx` passes).
- CSV export via `fetchAllPages`/`toCsv`/`downloadCsv` (`src/lib/csvExport.ts`),
  columns: `code`, `level`, `status`, `object_type`, `object_id`, `description`,
  `occurred_at`, `rn_status`. Button label `t('prosecutor.exportCsv')`, truncation
  banner `t('prosecutor.exportTruncated')` — identical text to the existing registers,
  same 2000-row cap behavior.

**Events tab:**
- Filters: `event_type` free-text, `object_type` free-text, `period_from`/`period_to`.
- Table columns: Event type, Object (`object_type` + short `object_id`), Occurred at,
  Correlation id (`"—"` when `null`), RN status.
- Same `Pagination`, same CSV export shape, columns: `event_type`, `object_type`,
  `object_id`, `correlation_id`, `occurred_at`, `rn_status`, and `payload` as
  `JSON.stringify(row.payload ?? {})` (a flat CSV field holding a JSON string is
  acceptable here — better than silently dropping the one column that carries the
  actual event detail).

**`queries.ts`:** `useRiskIndicators(filters)` and `useEvents(filters)`, same
`useQuery`/`api.GET`/`apiError` shape as every other list query in this codebase (see
`src/pages/staff/queries.ts` for the closest analogue, but do not import from it —
duplicate the small query function per this codebase's own stated convention).

**`format.ts`:** `RISK_LEVEL_LABELS`/`riskLevelBadgeClass`,
`RISK_STATUS_LABELS`, badge color classes matching the palette Task 1's brief hands you
(read Task 1's committed `RiskIndicatorsCard.tsx` before writing this file — the two
screens must agree pixel-for-pixel on what "high" looks like).

**`OversightPage.test.tsx` must cover** (MSW, `onUnhandledRequest: 'error'`):
- Risk indicators tab renders rows from a mocked `Page<RiskIndicatorOut>` fixture,
  including one `level: "critical"` row rendering the expected badge class/text.
- Switching to the Events tab issues a `GET /api/v1/oversight/events` request and
  renders its rows (assert the risk-indicators mock is NOT re-requested by the tab
  switch, or at least that the events endpoint is the one populating the second
  table — register both mocked routes distinctly, most-specific first, per the fleet's
  MSW-first-match-wins rule).
- CSV export on the risk-indicators tab produces a call to `URL.createObjectURL`
  (mirror `ApplicationsListPage.test.tsx`'s own assertion style for this).
- A caller whose `me.permissions` lacks `oversight.view` — render this page directly in
  the test (not through `RequireAuth`, which is exercised elsewhere) is out of scope;
  instead assert `shell/navigation.test.tsx`'s existing "every NAVIGATION entry resolves
  to a real route" walk still passes after your `routes.tsx`/`navigation.ts` edit (run
  it, do not just assume) — that is the test that actually catches a missing route for
  a new nav entry.

**i18n keys to add:** `nav.oversight` (flat block, both files);
`leadership.oversight.tabs.riskIndicators`, `.events`,
`leadership.oversight.filters.code`, `.level`, `.status`, `.objectType`,
`.eventType`, `.allCodes`, `.allLevels`, `.allStatuses`,
`leadership.oversight.col.code`, `.level`, `.status`, `.object`, `.description`,
`.occurredAt`, `.rnStatus`, `.eventType`, `.correlationId`,
`leadership.oversight.rnStatus.internal`, `.pending`, `.sent`, `.failed`,
`leadership.oversight.level.low`, `.medium`, `.high`, `.critical`,
`leadership.oversight.status.new`, `.inReview`, `.closed`,
`leadership.oversight.empty`. (Reuse `prosecutor.exportCsv`/`prosecutor.exportTruncated`
— do not add new keys for those two strings.)

**Report file:** `.claude/sdd-task2-report.md` inside this worktree.

---

## Final whole-branch review

After both tasks: `superpowers:requesting-code-review`'s `code-reviewer.md`, dispatched
on the most capable available model, over the full diff from this branch's merge-base
with `dev` to `HEAD`. Point it at this plan's Global Constraints section and at the
two Backend-contract sections above as the binding spec.
