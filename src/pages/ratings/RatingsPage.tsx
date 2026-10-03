/**
 * The ratings screen (rulings #140-#143; `plans/07.7-services-catalog-and-
 * ratings.md`, task 9; the author and the layout reworked 2026-10-04). What
 * a citizen leaves on their own issued permit (`PermitRatingPanel.tsx`)
 * surfaces here: the average, the count and the five-score distribution for
 * the chosen period, the same average broken down by organization or by
 * activity type, and the comment feed underneath.
 *
 * **Zone scoping happens server-side (ruling #142) — this screen filters
 * nothing of its own.** `GET /admin/ratings/summary` and `GET /admin/ratings`
 * both narrow to the caller's own zone before this page ever sees a row: a
 * leshoz's `executor_head` gets only their own organization's ratings, the
 * Agency's `central_admin`/`leadership`/`prosecutor` get every zone. The
 * period is the only filter this screen offers.
 *
 * **The feed names its author** — the applicant and the permit number —
 * to every reader of this screen (Oybek, 2026-10-04, reversing ruling #144's
 * anonymity). The number links to the permit card only where the backend
 * would open it (`canOpenPermitCard` below); everywhere else it is plain text.
 *
 * **`avg_score` is `null`, never `0`, for a period with no ratings** (ruling
 * #143). Such a period renders one notice instead of a column of empty cards;
 * while loading or after a failed fetch the tile shows an em dash, an absent
 * measurement rather than a measured zero. The average is the backend's own
 * serialized decimal string, rendered exactly as sent — never re-parsed
 * through `Number` for display.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw, Star } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import type { AuthContextValue } from '../../auth/AuthContext';
import { Button } from '../../components/ui/button';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { FormField, Input } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDate, formatDateTime, pickName } from '../applicant/format';
import { PERMITS_MANAGE, PERMITS_VIEW_ANY } from '../permits/permissions';
import {
  getRatingsSummary,
  listRatings,
  type RatingCommentRow,
  type RatingsBreakdownRow,
  type RatingsSummaryOut,
} from './api';

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
function formatAvgScore(value: string | null | undefined): string {
  return value ?? '—';
}

/** A count from the summary, next to an average that already honestly shows
 *  an em dash while loading or on error. Loading and error both render the
 *  same em dash; only a real successful response renders a number, `0`
 *  included. */
function formatCount(isLoading: boolean, isError: boolean, count: number | undefined): string | number {
  if (isLoading || isError) return '—';
  return count ?? 0;
}

/** Whether `GET /permits/{id}` would open the card for this reader, so the
 *  permit number may be a link rather than a door to a 404. The card admits
 *  the holder, a required signer of that permit, or a `permits.view_any`
 *  holder in zone. Of the four roles holding `ratings.view`: `prosecutor`
 *  holds `permits.view_any`; `executor_head` holds `permits.manage` and is a
 *  required signer of every permit of its own leshoz — the only leshoz its
 *  feed shows; `central_admin` and `leadership` hold neither. The superuser
 *  passes every gate. */
function canOpenPermitCard(me: AuthContextValue['me']): boolean {
  if (!me) return false;
  return me.is_superuser || me.permissions.includes(PERMITS_VIEW_ANY) || me.permissions.includes(PERMITS_MANAGE);
}

/** Bar colour for a score or an average: green from 4, amber from 3, red
 *  below — the same reading at a glance on both the distribution and the
 *  breakdown. */
function scoreTone(score: number): string {
  if (score >= 4) return 'bg-[#2E7D4F]';
  if (score >= 3) return 'bg-[#D97706]';
  return 'bg-[#B91C1C]';
}

function Stars({ value, size = 'w-3.5 h-3.5' }: { value: number; size?: string }) {
  const filled = Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} / 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={`${size} ${i <= filled ? 'fill-[#F5A524] text-[#F5A524]' : 'text-[#D5DADF]'}`}
        />
      ))}
    </span>
  );
}

export function RatingsPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
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

  // Only a real answer of zero is an empty period: while loading, or after a
  // failed fetch, the screen does not know that yet and shows the tiles.
  const isEmpty = summary.isSuccess && summary.data.count === 0;
  const totalPages = feed.data ? Math.max(1, Math.ceil(feed.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5 font-sans pb-16" data-testid="ratings-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{t('ratings.title')}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-2xl">{t('ratings.subtitle')}</p>
      </div>

      <div
        data-testid="ratings-filters"
        className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs flex flex-wrap items-end gap-3"
      >
        <FormField label={t('ratings.filters.periodFrom')} className="w-full sm:w-44">
          <Input
            type="date"
            value={draft.period_from}
            onChange={(e) => setDraft((d) => ({ ...d, period_from: e.target.value }))}
          />
        </FormField>
        <FormField label={t('ratings.filters.periodTo')} className="w-full sm:w-44">
          <Input
            type="date"
            value={draft.period_to}
            onChange={(e) => setDraft((d) => ({ ...d, period_to: e.target.value }))}
          />
        </FormField>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={resetFilters}
            data-testid="ratings-reset"
          >
            {t('ratings.filters.reset')}
          </Button>
          <Button variant="primary" size="md" onClick={applyFilters} data-testid="ratings-apply">
            {t('ratings.filters.apply')}
          </Button>
        </div>
        <ExportXlsxButton
          className="sm:ml-auto"
          path="/api/v1/admin/ratings"
          query={{ ...applied, page, page_size: PAGE_SIZE }}
          disabled={!feed.data?.total}
        />
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

      {isEmpty ? (
        <div
          data-testid="ratings-empty"
          className="flex items-center gap-3 rounded-2xl border border-[#E4E7EA] bg-white px-5 py-4 shadow-xs"
        >
          <Star className="w-5 h-5 shrink-0 text-[#9AA3AB]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[#1A1F24]">
              {t('ratings.empty.title')
                .replace('{from}', formatDate(applied.period_from))
                .replace('{to}', formatDate(applied.period_to))}
            </p>
            <p className="text-xs text-[#5A646D] mt-0.5">{t('ratings.empty.hint')}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <SummaryCard summary={summary.data} isLoading={summary.isLoading} isError={summary.isError} />
            <BreakdownCard summary={summary.data} lang={lang} />
          </div>

          <FeedCard
            rows={feed.data?.items}
            isLoading={feed.isLoading}
            error={feed.error ? errorText(feed.error, t('ratings.loadError')) : null}
            lang={lang}
            permitLinks={canOpenPermitCard(me)}
            footer={
              feed.data && feed.data.total > 0 ? (
                <div className="px-4 border-t border-[#E4E7EA]">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalRecords={feed.data.total}
                  />
                </div>
              ) : null
            }
          />
        </>
      )}
    </div>
  );
}

/** The average with its stars, the two counts, and how many ratings gave
 *  each score — `by_score` always carries all five, a score nobody gave as
 *  `0`, so five bars are drawn without guessing. */
function SummaryCard({
  summary,
  isLoading,
  isError,
}: {
  summary: RatingsSummaryOut | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const t = useT();
  const avg = summary?.avg_score ?? null;
  const total = summary?.count ?? 0;
  // `?? []`: a backend older than this screen sends no `by_score` — draw no
  // bars rather than crash the page while the two deploys catch up.
  const byScore = [...(summary?.by_score ?? [])].sort((a, b) => b.score - a.score);

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white p-5 shadow-xs">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D]">
        {t('ratings.tile.avgScoreLabel')}
      </h3>
      <div className="flex items-baseline gap-3 mt-2">
        <p
          className="text-3xl font-bold font-mono tabular-nums text-[#1A1F24] leading-none"
          data-testid="ratings-avg-score"
        >
          {isLoading ? t('ratings.loading') : formatAvgScore(avg)}
        </p>
        {avg !== null && <Stars value={Number(avg)} />}
      </div>
      <p className="text-xs text-[#5A646D] mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span data-testid="ratings-count">
          {t('ratings.tile.countLabel')}: {formatCount(isLoading, isError, summary?.count)}
        </span>
        <span data-testid="ratings-comment-count">
          {t('ratings.tile.commentCountLabel')}: {formatCount(isLoading, isError, summary?.comment_count)}
        </span>
      </p>
      {byScore.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label={t('ratings.tile.distributionLabel')}>
          {byScore.map((row) => (
            <li key={row.score} data-testid={`ratings-score-${row.score}`} className="flex items-center gap-2 text-xs">
              <span className="w-7 shrink-0 inline-flex items-center gap-0.5 text-[#5A646D] tabular-nums">
                {row.score}
                <Star className="w-3 h-3 fill-[#F5A524] text-[#F5A524]" aria-hidden="true" />
              </span>
              <span className="h-1.5 flex-1 rounded-full bg-[#EEF0F2] overflow-hidden">
                <span
                  className={`block h-full rounded-full ${scoreTone(row.score)}`}
                  style={{ width: total > 0 ? `${(row.count / total) * 100}%` : '0%' }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono tabular-nums text-[#1A1F24]">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type BreakdownView = 'organization' | 'activity';

/** The summary's two breakdowns, one at a time behind a toggle. With a
 *  single organization in scope — always so for a leshoz head, whose zone is
 *  its own leshoz — the organization view is one row repeating the overall
 *  average, so it is dropped: the card shows the service breakdown alone,
 *  under a plain heading. Each row's bar is its average out of 5.
 *  `RatingsBreakdownRow.avg_score` is never `null` on the wire (a group with
 *  zero ratings has nothing to group), but `formatAvgScore` still guards it. */
function BreakdownCard({ summary, lang }: { summary: RatingsSummaryOut | undefined; lang: string }) {
  const t = useT();
  const [chosen, setChosen] = useState<BreakdownView>('organization');
  const severalOrganizations = (summary?.by_organization.length ?? 0) > 1;
  const view: BreakdownView = severalOrganizations ? chosen : 'activity';
  const rows: RatingsBreakdownRow[] =
    (view === 'organization' ? summary?.by_organization : summary?.by_activity_type) ?? [];

  const tabs: { key: BreakdownView; label: string; testId: string }[] = [
    { key: 'organization', label: t('ratings.byOrganization.title'), testId: 'ratings-breakdown-organization' },
    { key: 'activity', label: t('ratings.byActivityType.title'), testId: 'ratings-breakdown-activity' },
  ];

  return (
    <section
      data-testid="ratings-breakdown"
      className="lg:col-span-2 rounded-2xl border border-[#E4E7EA] bg-white p-5 shadow-xs"
    >
      {severalOrganizations ? (
        <div role="tablist" className="inline-flex rounded-xl border border-[#E4E7EA] p-0.5 bg-[#F8F9FA] mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={view === tab.key}
              data-testid={tab.testId}
              onClick={() => setChosen(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-[10px] transition-colors ${
                view === tab.key ? 'bg-white text-[#1A1F24] shadow-xs' : 'text-[#5A646D] hover:text-[#1A1F24]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : (
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D] mb-3">
          {t('ratings.byActivityType.title')}
        </h3>
      )}
      <ul className="divide-y divide-[#EEF0F2]">
        {rows.map((row, index) => {
          const avg = row.avg_score === null ? null : Number(row.avg_score);
          return (
            <li
              key={row.organization_id ?? row.activity_type_id ?? index}
              className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2.5 text-sm"
            >
              <span className="min-w-0 break-words text-[#1A1F24]">{pickName(row.name, lang)}</span>
              <span className="hidden sm:block h-1.5 rounded-full bg-[#EEF0F2] overflow-hidden">
                {avg !== null && (
                  <span className={`block h-full rounded-full ${scoreTone(avg)}`} style={{ width: `${(avg / 5) * 100}%` }} />
                )}
              </span>
              <span className="shrink-0 flex items-center gap-1.5 justify-end">
                <span className="font-mono font-bold tabular-nums text-[#1A1F24]">{formatAvgScore(row.avg_score)}</span>
                <span className="text-xs text-[#5A646D] tabular-nums">({row.count})</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The comment feed: who, where, the score and what they wrote. The permit
 *  number is a link only when `permitLinks` says the card would open. */
function FeedCard({
  rows,
  isLoading,
  error,
  lang,
  permitLinks,
  footer,
}: {
  rows: RatingCommentRow[] | undefined;
  isLoading: boolean;
  error: string | null;
  lang: string;
  permitLinks: boolean;
  footer: ReactNode;
}) {
  const t = useT();
  return (
    <section data-testid="ratings-feed" className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
      <div className="p-5 pb-0">
        <h2 className="text-base font-bold text-[#1A1F24]">{t('ratings.feed.title')}</h2>
      </div>

      {error && (
        <div
          role="alert"
          data-testid="ratings-feed-error"
          className="m-5 p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#991B1B]"
        >
          {error}
        </div>
      )}

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-left text-xs border-collapse min-w-[760px]">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
              <th className="p-3 w-32">{t('ratings.feed.colDate')}</th>
              <th className="p-3 w-52">{t('ratings.feed.colAuthor')}</th>
              <th className="p-3 w-52">{t('ratings.feed.colWhere')}</th>
              <th className="p-3 w-28">{t('ratings.feed.colScore')}</th>
              <th className="p-3">{t('ratings.feed.colComment')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EA]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#5A646D]">
                  {t('ratings.loading')}
                </td>
              </tr>
            ) : !rows || rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[#5A646D]">
                  {t('ratings.feed.empty')}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.permit_id}-${index}`} data-testid={`ratings-comment-${index}`} className="align-top">
                  <td className="p-3 text-[#5A646D] whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="p-3">
                    <span className="block text-[#1A1F24] font-medium break-words">{row.applicant_name}</span>
                    {permitLinks ? (
                      <Link
                        to={`/permits/${row.permit_id}`}
                        className="text-[11px] font-mono text-[#2E7D4F] hover:text-[#23653F] hover:underline"
                      >
                        {row.permit_number}
                      </Link>
                    ) : (
                      <span className="text-[11px] font-mono text-[#5A646D]">{row.permit_number}</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="block text-[#1A1F24] break-words">{pickName(row.organization_name, lang)}</span>
                    <span className="block text-[11px] text-[#5A646D] break-words">
                      {pickName(row.activity_type_name, lang)}
                    </span>
                  </td>
                  <td className="p-3">
                    <Stars value={row.score} />
                  </td>
                  <td className="p-3 text-[#1A1F24] break-words">
                    {row.comment?.trim() ? row.comment : <span className="text-[#9AA3AB]">—</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footer}
    </section>
  );
}
