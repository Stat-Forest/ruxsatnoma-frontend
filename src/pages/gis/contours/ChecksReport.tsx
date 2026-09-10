import { AlertTriangle, CheckCircle2, CircleSlash, XCircle } from 'lucide-react';
import { useLanguage } from '../../../i18n/useT';
import { translateTerm } from '../../../i18n/terms';
import type { CheckResultOut } from '../api';
import { BLOCKING_CHECKS, CHECK_LABEL_KEYS } from './checksLogic';

/** Known `details.reason` values a `skipped` result carries, mapped to a
 * translated explanation — `no_geometry` (decision #178: a leshoz with no
 * delivered GIS layer, or a contour filed by requisites alone) and
 * `layer_empty` (ruling 9, `within_fund` before the fund boundary is
 * delivered). An unrecognised reason still renders (the raw string, in
 * `ChecksReport` below), it just has no localized label — a skipped result
 * must never look like an untranslated key was silently swallowed. */
const SKIP_REASON_KEYS: Record<string, string> = {
  no_geometry: 'gis.versions.checks.skipReason.noGeometry',
  layer_empty: 'gis.versions.checks.skipReason.layerEmpty',
};

/** Renders the four topology checks (`POST .../checks`), splitting blocking
 * failures from advisory warnings into two different visual registers —
 * getting this backwards would either let an operator publish over a real
 * defect, or block a legitimate grazing permit on something only the norm
 * module is meant to price.
 *
 * A THIRD register is `skipped`: rendered with its own neutral icon and
 * wording, never `pass`'s green checkmark. Sharing that checkmark used to be
 * exactly the hiding-direction defect this project keeps tripping on
 * (`docs/status.md`) — a geometry-less contour (decision #178) reports every
 * one of these checks `skipped`, and a green tick next to "within forest
 * fund boundaries" would tell a reviewer the plot WAS confirmed inside the
 * fund when nobody could confirm anything. */
export function ChecksReport({ checks, t }: { checks: CheckResultOut[]; t: (key: string) => string }) {
  const { lang } = useLanguage();
  if (checks.length === 0) return null;
  return (
    <ul className="space-y-2" data-testid="checks-report">
      {checks.map((check) => {
        const label = CHECK_LABEL_KEYS[check.check] ? t(CHECK_LABEL_KEYS[check.check]) : check.check;
        if (check.result === 'pass') {
          return (
            <li
              key={check.check}
              data-testid={`check-${check.check}`}
              data-result={check.result}
              className="flex items-center gap-2 text-xs text-[#5A646D]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              <span>{label}</span>
            </li>
          );
        }
        if (check.result === 'skipped') {
          const reason = (check.details as { reason?: unknown } | undefined)?.reason;
          const reasonLabel =
            typeof reason === 'string' ? (SKIP_REASON_KEYS[reason] ? t(SKIP_REASON_KEYS[reason]) : reason) : undefined;
          return (
            <li
              key={check.check}
              data-testid={`check-${check.check}`}
              data-result={check.result}
              className="flex items-center gap-2 rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-2.5 text-xs text-[#5A646D]"
            >
              <CircleSlash className="w-4 h-4 text-[#9AA3AB] shrink-0" />
              <span>
                <span className="font-semibold text-[#3D444B]">{label}</span>
                {' — '}
                {t('gis.versions.checks.skipped')}
                {reasonLabel && <span className="text-[#9AA3AB]"> ({reasonLabel})</span>}
              </span>
            </li>
          );
        }
        const blocking = BLOCKING_CHECKS.has(check.check);
        const items = Array.isArray((check.details as { items?: unknown[] })?.items)
          ? ((check.details as { items: { name?: string; area_m2?: number }[] }).items ?? [])
          : [];
        return (
          <li
            key={check.check}
            data-testid={`check-${check.check}`}
            data-result={check.result}
            className={`rounded-lg border p-3 text-xs ${
              blocking
                ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]'
                : 'border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {blocking ? (
                <XCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{label}</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">
                {blocking ? t('gis.versions.checks.blocking') : t('gis.versions.checks.advisory')}
              </span>
            </div>
            {items.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-6">
                {items.map((item, i) => (
                  <li key={i}>
                    {translateTerm(item.name, lang) || '—'}
                    {typeof item.area_m2 === 'number' ? ` — ${Math.round(item.area_m2)} m²` : ''}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
