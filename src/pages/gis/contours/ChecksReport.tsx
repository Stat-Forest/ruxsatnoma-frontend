import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { CheckResultOut } from '../api';
import { BLOCKING_CHECKS, CHECK_LABEL_KEYS } from './checksLogic';

/** Renders the four topology checks (`POST .../checks`), splitting blocking
 * failures from advisory warnings into two different visual registers —
 * getting this backwards would either let an operator publish over a real
 * defect, or block a legitimate grazing permit on something only the norm
 * module is meant to price. */
export function ChecksReport({ checks, t }: { checks: CheckResultOut[]; t: (key: string) => string }) {
  if (checks.length === 0) return null;
  return (
    <ul className="space-y-2" data-testid="checks-report">
      {checks.map((check) => {
        const label = CHECK_LABEL_KEYS[check.check] ? t(CHECK_LABEL_KEYS[check.check]) : check.check;
        if (check.result === 'pass' || check.result === 'skipped') {
          return (
            <li
              key={check.check}
              data-testid={`check-${check.check}`}
              data-result={check.result}
              className="flex items-center gap-2 text-xs text-[#5A646D]"
            >
              <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
              <span>{label}</span>
              {check.result === 'skipped' && (
                <span className="text-[11px] text-[#9AA3AB]">({t('gis.versions.checks.skipped')})</span>
              )}
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
                    {item.name ?? '—'}
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
