import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Alert } from '../../../components/ui/Feedback';
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { formatDate } from '../format';
import {
  addMonths,
  daysInMonth,
  firstWeekdayMon0,
  formatQuantity,
  isIsoDateInWindows,
  isoDaySpan,
  pad2,
  parseWindows,
  type SeasonWindow,
} from './seasonCalendar';

/**
 * T10 (`docs/plans/09-odilxon-demo-fixes.md`), decision #177 — the wizard's
 * step 2 occupancy calendar. Owns two reads of its own:
 *
 *   - `GET /activity-seasons/effective` resolves through the SAME function
 *     the blocking season check calls server-side
 *     (`checks.resolve_effective_windows`, per `EffectiveSeasonOut`'s own
 *     docstring), so a day this calendar disables can never disagree with
 *     the check that would otherwise refuse it after the fact.
 *   - `GET /gis/contours/{id}/occupancy` for the visible month only — one
 *     query per month shown, not one per day.
 *
 * `windows`/`minTermDays` are exposed to the caller via `onSeasonInfo` so
 * `ApplicationWizardPage.tsx` can fold the SAME numbers into its own native
 * date inputs (`min`/`max`, the reversed/too-long error) rather than keeping
 * two independent readings of "what season applies" that could drift apart.
 *
 * Pure date/formatting helpers (and the wrap-aware window match) live in
 * `./seasonCalendar.ts`, not here — a `.tsx` file that exports anything
 * besides components trips `react-refresh/only-export-components`, and that
 * module's own logic is worth unit-testing without rendering anything
 * (`seasonCalendar.test.ts`).
 */

// Not `export`ed — a `.tsx` file that exports anything besides components
// trips `react-refresh/only-export-components`; a consumer that needs these
// shapes imports straight from `../../../api/schema` the way `../api.ts`
// already does for every other endpoint's types.
type EffectiveSeasonOut = components['schemas']['EffectiveSeasonOut'];
type OccupancyOut = components['schemas']['OccupancyOut'];
type OccupancySubPeriodOut = components['schemas']['OccupancySubPeriodOut'];

async function getEffectiveSeason(activityTypeId: string, contourId: string): Promise<EffectiveSeasonOut> {
  const { data, error } = await api.GET('/api/v1/activity-seasons/effective', {
    params: { query: { activity_type_id: activityTypeId, contour_id: contourId } },
  });
  if (error) throw apiError(error);
  return data;
}

async function getOccupancy(
  contourId: string,
  activityTypeId: string,
  from: string,
  to: string,
): Promise<OccupancyOut> {
  const { data, error } = await api.GET('/api/v1/gis/contours/{contour_id}/occupancy', {
    params: { path: { contour_id: contourId }, query: { activity_type_id: activityTypeId, from, to } },
  });
  if (error) throw apiError(error);
  return data;
}

function periodForDate(periods: OccupancySubPeriodOut[] | undefined, iso: string): OccupancySubPeriodOut | undefined {
  return periods?.find((p) => p.period_from <= iso && iso <= p.period_to);
}

export interface OccupancyCalendarProps {
  contourId: string;
  activityTypeId: string;
  periodFrom: string;
  periodTo: string;
  onSelectRange: (from: string, to: string) => void;
  /** Fired whenever the resolved windows/minimum term change, so the caller
   *  can fold the SAME numbers into its own inline validation instead of
   *  reading `EffectiveSeasonOut` a second time. */
  onSeasonInfo?: (info: { windows: SeasonWindow[]; minTermDays: number | null }) => void;
}

export function OccupancyCalendar({
  contourId,
  activityTypeId,
  periodFrom,
  periodTo,
  onSelectRange,
  onSeasonInfo,
}: OccupancyCalendarProps) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();

  const [viewMonth, setViewMonth] = useState(() => (periodFrom || new Date().toISOString().slice(0, 10)).slice(0, 7));

  // Keeps the visible month in step with `periodFrom` set OUTSIDE this
  // component (the native date input this track keeps alongside the
  // calendar, or a resumed draft) — adjusted DURING RENDER against a STATE-
  // tracked previous value, React's own documented "adjusting state when a
  // prop changes" idiom (react.dev/learn/you-might-not-need-an-effect), not
  // a `useRef` comparison: a ref read/written during render is flagged by
  // this project's `eslint-plugin-react-hooks` (`react-hooks/refs`), which
  // `ApplicationWizardPage.tsx`'s own `hydratedForId` ref predates.
  const [lastSyncedPeriodFrom, setLastSyncedPeriodFrom] = useState(periodFrom);
  if (periodFrom !== lastSyncedPeriodFrom) {
    setLastSyncedPeriodFrom(periodFrom);
    if (periodFrom) {
      const month = periodFrom.slice(0, 7);
      if (month !== viewMonth) setViewMonth(month);
    }
  }

  const seasonQuery = useQuery({
    queryKey: ['effective-season', contourId, activityTypeId],
    queryFn: () => getEffectiveSeason(activityTypeId, contourId),
    enabled: !!contourId && !!activityTypeId,
  });

  const windows = useMemo(() => parseWindows(seasonQuery.data?.windows), [seasonQuery.data]);
  const minTermDays = seasonQuery.data?.min_term_days ?? null;

  useEffect(() => {
    onSeasonInfo?.({ windows, minTermDays });
    // `onSeasonInfo` is intentionally excluded — it is a fresh closure every
    // parent render, and the only thing this effect needs to react to is the
    // resolved season DATA actually changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windows, minTermDays]);

  const monthStart = `${viewMonth}-01`;
  const monthEnd = `${viewMonth}-${pad2(daysInMonth(viewMonth))}`;

  const occupancyQuery = useQuery({
    queryKey: ['occupancy', contourId, activityTypeId, viewMonth],
    queryFn: () => getOccupancy(contourId, activityTypeId, monthStart, monthEnd),
    enabled: !!contourId && !!activityTypeId,
  });

  function handleDayClick(iso: string, selectable: boolean) {
    if (!selectable) return;
    if (!periodFrom || periodTo) {
      // Nothing picked yet, or a complete range already stands — this click
      // starts a NEW one.
      onSelectRange(iso, '');
      return;
    }
    // `periodFrom` set, `periodTo` not yet — this click completes the range,
    // unless it lands before `periodFrom`, in which case it restarts from
    // here rather than erroring (the same "just pick again" idiom a plain
    // native date input already offers).
    if (iso < periodFrom) {
      onSelectRange(iso, '');
    } else {
      onSelectRange(periodFrom, iso);
    }
  }

  const weekdays = t('wizard.calendar.weekdays').split(',');
  const leadingBlanks = firstWeekdayMon0(viewMonth);
  const totalDays = daysInMonth(viewMonth);
  const cells = useMemo(() => {
    const list: { iso: string | null; day: number | null }[] = [];
    for (let i = 0; i < leadingBlanks; i++) list.push({ iso: null, day: null });
    for (let d = 1; d <= totalDays; d++) list.push({ iso: `${viewMonth}-${pad2(d)}`, day: d });
    return list;
  }, [viewMonth, leadingBlanks, totalDays]);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.calendar.heading')}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('wizard.calendar.prevMonth')}
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
            className="p-1 rounded-lg hover:bg-[#F0F7F1] cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono font-semibold text-[#1A1F24] min-w-[4.5rem] text-center">
            {viewMonth.split('-').reverse().join('.')}
          </span>
          <button
            type="button"
            aria-label={t('wizard.calendar.nextMonth')}
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
            className="p-1 rounded-lg hover:bg-[#F0F7F1] cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {occupancyQuery.isError && (
        <Alert variant="warning">{errorText(occupancyQuery.error, t('wizard.step3.calcFailedTitle'))}</Alert>
      )}

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((wd) => (
          <div key={wd} className="text-[10px] font-bold text-[#5A646D] uppercase">
            {wd}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.iso) return <div key={`blank-${idx}`} />;
          const iso = cell.iso;
          const inSeason = isIsoDateInWindows(iso, windows);
          const period = periodForDate(occupancyQuery.data?.periods, iso);
          const result = period?.result;
          const full = result === 'full';
          const isFrom = periodFrom === iso;
          const isTo = periodTo === iso;
          const inRange = periodFrom && periodTo && iso >= periodFrom && iso <= periodTo;

          // Picking the END date: a day closer than `minTermDays` to the
          // already-picked start is disabled too, the same "cannot be
          // selected at all" treatment as an out-of-season day — stated up
          // front by `wizard.step2.minTermNotice`, not discovered from a
          // refusal after the fact.
          const pickingTo = !!periodFrom && !periodTo;
          const tooShortForEnd =
            pickingTo && iso >= periodFrom && minTermDays != null && isoDaySpan(periodFrom, iso) < minTermDays;
          const selectable = inSeason && !full && !tooShortForEnd;

          let colorClass = 'bg-white border-[#E4E7EA] text-[#1A1F24]';
          let statusLabel = '';
          let remainderText: string | null = null;
          if (!inSeason) {
            colorClass = 'bg-[#F3F4F6] border-[#E4E7EA] text-[#9CA3AF]';
            statusLabel = t('wizard.calendar.outOfSeason');
          } else if (tooShortForEnd) {
            colorClass = 'bg-[#F3F4F6] border-[#E4E7EA] text-[#9CA3AF]';
            statusLabel = t('wizard.step2.minTermNotice').replace('{days}', String(minTermDays));
          } else if (result === 'free') {
            colorClass = 'bg-[#F0F7F1] border-[#86EFAC] text-[#123522]';
            statusLabel = t('wizard.calendar.legendFree');
          } else if (result === 'partial') {
            colorClass = 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]';
            statusLabel = t('wizard.calendar.legendPartial');
            if (period?.remaining != null) {
              remainderText = formatQuantity(period.remaining, occupancyQuery.data?.unit, t, lang);
            }
          } else if (result === 'full') {
            colorClass = 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]';
            statusLabel = t('wizard.calendar.legendFull');
          }
          // The PICKED range overrides the availability colour instead of
          // decorating it (Oybek, 2026-09-10, from the stand): a free day was
          // pale green and a chosen day was the same pale green with a thin
          // ring, so the applicant could not tell what they had actually
          // selected. The two edges are solid dark green with white text, the
          // days between them a filled green — neither can be mistaken for
          // "free". The remainder still prints inside the cell, so a partly
          // taken day that is also selected keeps saying how much is left.
          if (isFrom || isTo) {
            colorClass = 'bg-[#123522] border-[#123522] text-white';
            statusLabel = t('wizard.calendar.selectedEdge');
          } else if (inRange) {
            colorClass = 'bg-[#86EFAC] border-[#2E7D4F] text-[#123522]';
            statusLabel = t('wizard.calendar.selectedRange');
          }

          const label = remainderText
            ? `${formatDate(iso)} — ${statusLabel}, ${t('wizard.calendar.remainderLabel').replace('{value}', remainderText)}`
            : `${formatDate(iso)} — ${statusLabel}`;

          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              aria-label={label}
              title={label}
              onClick={() => handleDayClick(iso, selectable)}
              className={`relative rounded-lg border py-1.5 text-xs font-semibold transition-colors ${colorClass} ${
                selectable ? 'cursor-pointer hover:brightness-95' : 'cursor-not-allowed opacity-70'
              }`}
            >
              {cell.day}
              {remainderText && <span className="block text-[9px] font-normal leading-none">{remainderText}</span>}
            </button>
          );
        })}
      </div>

      {occupancyQuery.isFetching && (
        <p className="text-[11px] text-[#5A646D] flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('wizard.step2.loading')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5A646D] pt-1 border-t border-[#E4E7EA]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#F0F7F1] border border-[#86EFAC]" /> {t('wizard.calendar.legendFree')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#FFFBEB] border border-[#FDE68A]" /> {t('wizard.calendar.legendPartial')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#FEF2F2] border border-[#FCA5A5]" /> {t('wizard.calendar.legendFull')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#F3F4F6] border border-[#E4E7EA]" /> {t('wizard.calendar.outOfSeason')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-3 h-3 rounded-sm bg-[#123522] border border-[#123522]" />{' '}
          {t('wizard.calendar.selectedEdge')}
        </span>
      </div>
    </div>
  );
}
