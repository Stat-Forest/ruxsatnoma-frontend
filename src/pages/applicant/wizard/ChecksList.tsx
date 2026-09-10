import { AlertTriangle, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { useT } from '../../../i18n/useT';
import { getCheckResultLabel, getCheckTypeLabel, type NormalizedCheck } from '../checkTypeLabels';

const ICON_BY_RESULT: Record<string, typeof CheckCircle2> = {
  pass: CheckCircle2,
  fail: XCircle,
  warning: AlertTriangle,
  skipped: MinusCircle,
};

const COLOR_BY_RESULT: Record<string, string> = {
  pass: 'text-[#15803D] bg-[#F0F7F1] border-[#D9EBDC]',
  fail: 'text-[#B91C1C] bg-[#FEF2F2] border-[#FCA5A5]',
  warning: 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]',
  skipped: 'text-[#5A646D] bg-[#F8F9FA] border-[#E4E7EA]',
};

/** `"50.0"` -> `"50"`, `"12.50"` -> `"12,5"` — the trailing-zero trim every
 *  other decimal display in this app already applies (`permits/format.ts`'s
 *  own `formatDecimal`), duplicated here per this track's own convention of
 *  not reaching into a sibling track's file for a four-line helper. */
function trimSbNumber(value: string | number): string {
  const str = String(value);
  const trimmed = str.includes('.') ? str.replace(/0+$/, '').replace(/\.$/, '') : str;
  return (trimmed || '0').replace('.', ',');
}

/** A quantity field that may be present, `null`, `undefined`, a JSON number
 *  or a `Decimal`-as-string (`norms.calculator.jsonable`) — trimmed the same
 *  way `trimSbNumber` above already does, or `undefined` when the field
 *  simply is not there. */
function numField(d: Record<string, unknown>, key: string): string | undefined {
  const value = d[key];
  return value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'string')
    ? trimSbNumber(value as string | number)
    : undefined;
}

function strField(d: Record<string, unknown>, key: string): string | undefined {
  const value = d[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** `"2026-09-01"` -> `"01.09.2026"` — the same DD.MM.YYYY every other date
 *  on these screens uses, never re-parsed through `Date` (which would apply
 *  the browser's own timezone to a plain date). */
function formatIsoDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : value;
}

/** The `limit`/`norm_limit` check's own note — factored out of `detailNote`
 *  because it now covers four shapes of `details`, not one:
 *
 *   - grazing's own `used_sb`/`max_sb`/`remaining_sb` (`norms/checks.py`'s
 *     `_limit_check`, live today);
 *   - the general capacity this check is growing into for every activity
 *     (#176, stage 9 T4, backend in progress) — `requested`/`capacity`/
 *     `remaining`, with an optional `unit`;
 *   - `reason: "exclusive_occupied"` for a contour with no capacity set at
 *     all, where one active permit occupies the whole period and every
 *     other applicant is refused outright (#176, Oybek's option а) — dated
 *     when the backend names the date it frees up, stated plainly when it
 *     does not;
 *   - anything else, left unsaid.
 *
 *  Read as a REFUSAL when `failed` — the bug the demo found: the same
 *  neutral "current load / limit" sentence used to print whether the check
 *  passed or failed, so a blocked applicant saw no different from an
 *  admitted one. */
function limitDetailNote(d: Record<string, unknown>, failed: boolean, t: (key: string) => string): string | null {
  if (d.reason === 'exclusive_occupied') {
    const until =
      strField(d, 'free_from') ?? strField(d, 'until') ?? strField(d, 'occupied_until') ?? strField(d, 'available_from');
    return until
      ? t('wizard.checks.exclusiveOccupied').replace('{date}', formatIsoDate(until))
      : t('wizard.checks.exclusiveOccupiedUnknown');
  }

  const used = numField(d, 'used_sb');
  const max = numField(d, 'max_sb');
  if (used !== undefined && max !== undefined) {
    const remaining = numField(d, 'remaining_sb');
    if (failed) {
      return remaining !== undefined
        ? t('wizard.checks.loadDetailsFail').replace('{used}', used).replace('{max}', max).replace('{remaining}', remaining)
        : t('wizard.checks.loadDetailsFailNoRemaining').replace('{used}', used).replace('{max}', max);
    }
    return remaining !== undefined
      ? t('wizard.checks.loadDetails').replace('{used}', used).replace('{max}', max).replace('{remaining}', remaining)
      : t('wizard.checks.loadDetailsNoRemaining').replace('{used}', used).replace('{max}', max);
  }

  const unit = strField(d, 'unit');
  const withUnit = (value: string) => (unit ? `${value} ${unit}` : value);
  const requestedRaw = numField(d, 'requested');
  const capacityRaw = numField(d, 'capacity');
  if (requestedRaw !== undefined && capacityRaw !== undefined) {
    const requested = withUnit(requestedRaw);
    const capacity = withUnit(capacityRaw);
    const remainingRaw = numField(d, 'remaining');
    const remaining = remainingRaw !== undefined ? withUnit(remainingRaw) : undefined;
    if (failed) {
      return remaining !== undefined
        ? t('wizard.checks.capacityDetailsFail')
            .replace('{requested}', requested)
            .replace('{capacity}', capacity)
            .replace('{remaining}', remaining)
        : t('wizard.checks.capacityDetailsFailNoRemaining').replace('{requested}', requested).replace('{capacity}', capacity);
    }
    return remaining !== undefined
      ? t('wizard.checks.capacityDetails')
          .replace('{requested}', requested)
          .replace('{capacity}', capacity)
          .replace('{remaining}', remaining)
      : t('wizard.checks.capacityDetailsNoRemaining').replace('{requested}', requested).replace('{capacity}', capacity);
  }

  return null;
}

/** Ruling #177 task 3 — `norms/checks.py`'s `_min_term_check` carries
 *  `min_term_days` on EVERY outcome so the screen can state the rule, not
 *  merely enforce it: `skipped` with `reason: "no_min_term_defined"` when the
 *  leshoz dictionary names no figure, `fail` with `period_too_short` plus
 *  `requested_days` (inclusive of both ends), `pass` with the figure alone.
 *  A shape with none of that is left unsaid, like every other check's. */
function minTermDetailNote(d: Record<string, unknown>, failed: boolean, t: (key: string) => string): string | null {
  if (d.reason === 'no_min_term_defined') return t('wizard.checks.noMinTerm');
  const min = numField(d, 'min_term_days');
  if (min === undefined) return null;
  const requested = numField(d, 'requested_days');
  if (failed && requested !== undefined) {
    return t('wizard.checks.minTermFail').replace('{requested}', requested).replace('{min}', min);
  }
  return t('wizard.checks.minTermPass').replace('{min}', min);
}

/** F3 (`docs/plans/07.3-findings.md`) — three of the nine automatic checks
 *  carry a `details` object meant for a developer reading a log, not for the
 *  applicant reading this screen: `{"reason":"layer_empty"}`,
 *  `{"reason":"no_season_defined"}`, and the MaxSB/capacity load object. Each
 *  is turned into the one sentence an applicant can actually act on; anything
 *  this function does not recognise is left unsaid rather than dumped as
 *  JSON — the check's own icon, label and result already state the verdict,
 *  and an unreadable technical aside is worse than no aside at all. */
function detailNote(check: NormalizedCheck, t: (key: string) => string): string | null {
  const { type, details } = check;
  if (typeof details === 'string') return details;
  if (typeof details !== 'object' || details === null) return null;
  const d = details as Record<string, unknown>;

  if ((type === 'gis_within_fund') && d.reason === 'layer_empty') {
    return t('wizard.checks.layerEmpty');
  }
  if ((type === 'norm_season' || type === 'season') && d.reason === 'no_season_defined') {
    return t('wizard.checks.noSeason');
  }
  if (type === 'norm_min_term' || type === 'min_term') {
    return minTermDetailNote(d, check.result === 'fail', t);
  }
  if (type === 'norm_limit' || type === 'limit') {
    return limitDetailNote(d, check.result === 'fail', t);
  }
  return null;
}

/** Renders checks as evidence, exactly the way the backend means it: a
 * `fail` here is DATA in a 200 response (design/03), not a crash — shared by
 * the wizard's live price preview and its official precheck step, so the
 * two never describe a check differently. Callers normalize their own
 * endpoint's shape first — `fromApplicationChecks`/`fromPreviewChecks`,
 * re-exported above from `checkTypeLabels.ts` (see its own comment for why
 * the two endpoints cannot share one shape). */
export function ChecksList({ checks }: { checks: NormalizedCheck[] }) {
  const t = useT();
  if (checks.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {checks.map((check) => {
        const Icon = ICON_BY_RESULT[check.result] ?? MinusCircle;
        const note = detailNote(check, t);
        const typeLabel = getCheckTypeLabel(check.type, t);
        const resultLabel = getCheckResultLabel(check.result, t);
        return (
          <li
            key={check.key}
            className={`flex items-start gap-2 text-xs p-2 rounded-lg border ${COLOR_BY_RESULT[check.result] ?? COLOR_BY_RESULT.skipped}`}
            title={resultLabel}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" aria-label={resultLabel} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{typeLabel}</span>
                <span className="text-[10px] font-bold opacity-75">{resultLabel}</span>
              </div>
              {note && <span className="block text-[11px] opacity-80 mt-0.5">{note}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
