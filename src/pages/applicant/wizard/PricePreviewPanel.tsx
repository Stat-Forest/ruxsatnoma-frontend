import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Alert } from '../../../components/ui/Feedback';
import { ApiError } from '../../../api/errors';
import { useT } from '../../../i18n/useT';
import { previewCalculation, type CalculationIn } from '../api';
import { formatMoney } from '../format';
import { fromPreviewChecks } from '../checkTypeLabels';
import { ChecksList } from './ChecksList';

/**
 * The live price panel — `POST /api/v1/calculations/preview`. Its refusals
 * come in two shapes and must be told apart:
 *
 *   - a BLOCKING check (herd over the limit, a fire ban, ...) is DATA inside
 *     `checks[]` at a plain 200 — rendered by `ChecksList` below, never a
 *     crash;
 *   - a broken INPUT is a genuine HTTP error — `ERR-NORM-004` when a rule
 *     parameter (grazing's `coef_sb:*` most visibly) is not published,
 *     `ERR-VAL-001` for an unknown activity/benefit code. Both are caught
 *     here and rendered as a readable explanation, never a stack trace, and
 *     NEVER papered over with an invented number.
 */
export function PricePreviewPanel({ request }: { request: CalculationIn | null }) {
  const t = useT();
  const query = useQuery({
    queryKey: ['calc-preview', request],
    queryFn: () => previewCalculation(request!),
    enabled: request !== null,
    retry: false,
  });

  if (!request) {
    return <p className="text-xs text-[#5A646D]">{t('wizard.step3.pricePrompt')}</p>;
  }
  if (query.isLoading) {
    return (
      <p className="text-xs text-[#5A646D] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.step3.calculating')}
      </p>
    );
  }
  if (query.isError) {
    const err = query.error;
    const code = err instanceof ApiError ? err.code : 'ERR-SYS-000';
    if (code === 'ERR-NORM-004') {
      return (
        <Alert variant="warning" title={t('wizard.step3.priceUnavailableTitle')}>
          {t('wizard.step3.priceUnavailableDesc')}
        </Alert>
      );
    }
    return (
      <Alert variant="danger" title={t('wizard.step3.calcFailedTitle')}>
        {err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi."}
      </Alert>
    );
  }

  const data = query.data!;
  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#BAE6FD] rounded-xl p-4 flex items-center gap-4">
        <div className="font-mono text-2xl font-extrabold text-[#123522] bg-[#DCFCE7] px-3 py-1 rounded-xl border border-[#86EFAC]">
          {formatMoney(data.amount)}
        </div>
        <div className="text-xs text-[#1A1F24]">
          <strong>{t('wizard.step3.currency')}</strong> — {t('wizard.step3.priceTariffNote')}
          {data.max_sb !== null && (
            <span className="block text-[#5A646D] mt-0.5">
              {t('wizard.step3.loadRatio')} {data.used_sb}/{data.max_sb} {t('wizard.step3.conditionalHead')}
            </span>
          )}
        </div>
      </div>
      <ChecksList checks={fromPreviewChecks(data.checks)} />
    </div>
  );
}
