/**
 * The Agency's ratings screen (rulings #140-#143; `plans/
 * 07.7-services-catalog-and-ratings.md`, task 9). What a citizen leaves on
 * their own issued permit (`PermitRatingPanel.tsx`, task 8) surfaces here,
 * aggregated: the overall average and count for the chosen period, the same
 * pair broken down by organization and by activity type, and the anonymous
 * comment feed underneath.
 *
 * **Zone scoping happens server-side (ruling #142) — this screen filters
 * nothing of its own.** `GET /admin/ratings/summary` and `GET /admin/ratings`
 * both narrow to the caller's own zone before this page ever sees a row: a
 * leshoz's `executor_head` gets only their own organization's ratings, the
 * Agency's `central_admin`/`leadership`/`prosecutor` get every zone. The
 * period is the only filter this screen offers — `organization_id`/
 * `activity_type_id` exist on the summary route to narrow that zone
 * further, but nothing here builds a picker for them; the six-activity
 * catalog and the organization tree are each their own screen already.
 *
 * **Ruling #141 — a rating carries no author, here or anywhere else.** The
 * backend sends nothing that could identify who rated (no applicant, no
 * permit number), so this screen adds no column, no link and no "who rated
 * this" affordance of any kind — there is nothing behind such a control to
 * open.
 *
 * **`avg_score` is `null`, never `0`, for a period with no ratings** (ruling
 * #143) — rendered as an em dash, the same posture `dashboard/
 * format.ts::formatPercent` already takes for `avg_occupied_pct` after F7:
 * an absent measurement is not a measured zero. The value is the backend's
 * own serialized decimal string, rendered exactly as sent — never re-parsed
 * through `Number`, which would invite rounding a figure nobody asked this
 * screen to round.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDateTime, pickName } from '../applicant/format';
import { getRatingsSummary, listRatings, type RatingsBreakdownRow } from './api';

const PAGE_SIZE = 20;

/** Today as a plain `YYYY-MM-DD` in the viewer's own zone — the same
 *  computation `dashboard/LeadershipDashboardPage.tsx::todayIso()` uses,
 *  kept as its own copy here rather than shared (that file's own
 *  convention: a small helper duplicated is cheaper than a shared module
 *  every track has to merge around). */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The first day of the viewer's own current month — same reasoning as
 *  `todayIso()` above. */
function firstOfMonthIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

interface PeriodDraft {
  period_from: string;
  period_to: string;
}

function defaultPeriod(): PeriodDraft {
  return { period_from: firstOfMonthIso(), period_to: todayIso() };
}

/** `RatingsSummaryOut.avg_score` / `RatingsBreakdownRow.avg_score` — see the
 *  module note above. */
function formatAvgScore(value: string | null): string {
  return value ?? '—';
}

/** The tile's count, next to an average that already honestly shows an em
 *  dash while loading or on error. Before this, the count fell back to a
 *  bare `?? 0` regardless of query state, so "Number of ratings: 0" rendered
 *  during the fetch and after a failed one too — a number the screen does
 *  not actually have, right beside an average that correctly refuses to
 *  guess. Loading and error both render the same em dash; only a real
 *  successful response with zero ratings renders `0`. */
function formatCount(isLoading: boolean, isError: boolean, count: number | undefined): string | number {
  if (isLoading || isError) return '—';
  return count ?? 0;
}

export function RatingsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();

  const [draft, setDraft] = useState<PeriodDraft>(defaultPeriod);
  const [applied, setApplied] = useState<PeriodDraft>(defaultPeriod);
  const [page, setPage] = useState(1);

  const summary = useQuery({
    queryKey: ['admin', 'ratings', 'summary', applied],
    queryFn: () => getRatingsSummary(applied),
  });

  const feed = useQuery({
    queryKey: ['admin', 'ratings', 'list', applied, page],
    queryFn: () => listRatings({ ...applied, page, page_size: PAGE_SIZE }),
  });

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  function resetFilters() {
    const fresh = defaultPeriod();
    setDraft(fresh);
    setApplied(fresh);
    setPage(1);
  }

  const totalPages = feed.data ? Math.max(1, Math.ceil(feed.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="ratings-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{t('ratings.title')}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-2xl">{t('ratings.subtitle')}</p>
      </div>

      <div
        data-testid="ratings-filters"
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <FormField label={t('ratings.filters.periodFrom')}>
            <Input
              type="date"
              value={draft.period_from}
              onChange={(e) => setDraft((d) => ({ ...d, period_from: e.target.value }))}
            />
          </FormField>
          <FormField label={t('ratings.filters.periodTo')}>
            <Input
              type="date"
              value={draft.period_to}
              onChange={(e) => setDraft((d) => ({ ...d, period_to: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={resetFilters}
            data-testid="ratings-reset"
          >
            {t('ratings.filters.reset')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters} data-testid="ratings-apply">
            {t('ratings.filters.apply')}
          </Button>
        </div>
      </div>

      {summary.error && (
        <div
          role="alert"
          data-testid="ratings-summary-error"
          className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#991B1B]"
        >
          {errorText(summary.error, t('ratings.loadError'))}
        </div>
      )}

      <div className="rounded-2xl border border-[#E4E7EA] bg-white p-5 shadow-xs max-w-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D]">
          {t('ratings.tile.avgScoreLabel')}
        </h3>
        <p
          className="text-2xl font-bold font-mono tabular-nums text-[#1A1F24] mt-2 leading-none"
          data-testid="ratings-avg-score"
        >
          {summary.isLoading ? t('ratings.loading') : formatAvgScore(summary.data?.avg_score ?? null)}
        </p>
        <p className="text-xs text-[#5A646D] mt-1.5" data-testid="ratings-count">
          {t('ratings.tile.countLabel')}: {formatCount(summary.isLoading, summary.isError, summary.data?.count)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BreakdownCard
          title={t('ratings.byOrganization.title')}
          emptyText={t('ratings.byOrganization.empty')}
          rows={summary.data?.by_organization ?? []}
          lang={lang}
        />
        <BreakdownCard
          title={t('ratings.byActivityType.title')}
          emptyText={t('ratings.byActivityType.empty')}
          rows={summary.data?.by_activity_type ?? []}
          lang={lang}
        />
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 pb-0">
          <h2 className="text-base font-bold text-[#1A1F24]">{t('ratings.feed.title')}</h2>
        </div>

        {feed.error && (
          <div
            role="alert"
            data-testid="ratings-feed-error"
            className="m-5 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#991B1B]"
          >
            {errorText(feed.error, t('ratings.loadError'))}
          </div>
        )}

        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">{t('ratings.feed.colDate')}</th>
                <th className="p-3">{t('ratings.feed.colOrganization')}</th>
                <th className="p-3">{t('ratings.feed.colActivityType')}</th>
                <th className="p-3">{t('ratings.feed.colScore')}</th>
                <th className="p-3">{t('ratings.feed.colComment')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {feed.isLoading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#5A646D]">
                    {t('ratings.loading')}
                  </td>
                </tr>
              ) : (feed.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#5A646D]">
                    {t('ratings.feed.empty')}
                  </td>
                </tr>
              ) : (
                feed.data!.items.map((row, index) => (
                  <tr key={index} data-testid={`ratings-comment-${index}`}>
                    <td className="p-3">{formatDateTime(row.created_at)}</td>
                    <td className="p-3">{pickName(row.organization_name, lang)}</td>
                    <td className="p-3">{pickName(row.activity_type_name, lang)}</td>
                    <td className="p-3 font-mono font-bold">{row.score} / 5</td>
                    <td className="p-3">{row.comment ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {feed.data && feed.data.total > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalRecords={feed.data.total}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/** One of the summary's two breakdowns (`by_organization`/`by_activity_type`)
 *  — a plain ranked list, the same "name left, figure right" shape
 *  `dashboard/components/RejectionsCard.tsx` already uses for its own list.
 *  `RatingsBreakdownRow.avg_score` is never `null` on the wire (a group with
 *  zero ratings in it has nothing to group), but `formatAvgScore` still
 *  guards it rather than assuming the backend never changes its mind. */
function BreakdownCard({
  title,
  emptyText,
  rows,
  lang,
}: {
  title: string;
  emptyText: string;
  rows: RatingsBreakdownRow[];
  lang: 'uz_latn' | 'ru';
}) {
  return (
    <div className="rounded-2xl border border-[#E4E7EA] bg-white p-5 shadow-xs">
      <h2 className="text-base font-bold text-[#1A1F24] mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[#5A646D]">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.organization_id ?? row.activity_type_id ?? index}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 truncate text-[#1A1F24]">{pickName(row.name, lang)}</span>
              <span className="shrink-0 flex items-center gap-1.5">
                <span className="font-mono font-bold tabular-nums text-[#1A1F24]">
                  {formatAvgScore(row.avg_score)}
                </span>
                <span className="text-xs text-[#5A646D]">({row.count})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
