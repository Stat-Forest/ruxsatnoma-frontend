import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Search, XCircle } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { formatDate } from './format';
import { parseQrInput } from './qr';
import { usePublicPermitCheck, type PublicPermitCheckInput } from './queries';

/** The one status `PublicCheckCard.status` reports that means "good" — the
 *  other three (`тўхтатилган`/`муддати тугаган`/`бекор қилинган`) are all
 *  some shade of "not valid right now"; rendered as-is (already localized
 *  Cyrillic Uzbek from the backend), never re-translated or re-derived. */
const POSITIVE_STATUS = 'амалда';

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1 border-b border-[#F0F2F4] last:border-0 text-sm">
      <dt className="text-[#5A646D]">{label}</dt>
      <dd className="font-semibold text-[#1A1F24] text-right">{value}</dd>
    </div>
  );
}

/**
 * С15 — look up a permit by its printed QR token, or by series+number for a
 * citizen's paper copy. Both paths call the SAME anonymous
 * `usePublicPermitCheck` a public visitor would use (`GET
 * /public/permits/check`) — no fake camera simulation (Global Constraint 7),
 * no richer data invented beyond what that endpoint actually returns: a
 * masked `holder`, no contour/location. An operator who needs the FULL
 * record (contour, exact identity, quantities) already has `/permits`
 * (`permits.view_any`) for that — this tab intentionally does not try to
 * bridge the two.
 */
export function ScanTab() {
  const t = useT();
  const errorText = useApiErrorText();
  const [tokenInput, setTokenInput] = useState('');
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [series, setSeries] = useState('');
  const [number, setNumber] = useState('');
  const [submitted, setSubmitted] = useState<PublicPermitCheckInput | null>(null);

  const check = usePublicPermitCheck(submitted);

  function submitToken() {
    const parsed = parseQrInput(tokenInput);
    if (parsed) setSubmitted(parsed);
  }

  function submitSeriesNumber() {
    const parsedNumber = Number(number);
    if (!series.trim() || !number || !Number.isInteger(parsedNumber) || parsedNumber <= 0) return;
    setSubmitted({ series: series.trim(), number: parsedNumber });
  }

  return (
    <div className="space-y-4" data-testid="inspector-scan-tab">
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
        <FormField label={t('inspector.scan.qrLabel')}>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              touchSize
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitToken()}
              placeholder={t('inspector.scan.qrPlaceholder')}
              className="flex-1"
            />
            <Button size="touch" onClick={submitToken} leftIcon={<Search className="w-4 h-4" />}>
              {t('inspector.scan.checkButton')}
            </Button>
          </div>
        </FormField>

        <button
          type="button"
          className="flex items-center gap-1 text-xs font-semibold text-[#5A646D] hover:text-[#1A1F24]"
          onClick={() => setSeriesOpen((open) => !open)}
        >
          {seriesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {t('inspector.scan.orByNumberLabel')}
        </button>

        {seriesOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:items-end">
            <FormField label={t('inspector.scan.seriesLabel')}>
              <Input
                touchSize
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                placeholder="А"
                maxLength={8}
              />
            </FormField>
            <FormField label={t('inspector.scan.numberLabel')}>
              <Input
                touchSize
                inputMode="numeric"
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="000002"
              />
            </FormField>
            <Button size="touch" variant="outline" onClick={submitSeriesNumber}>
              {t('inspector.scan.checkButton')}
            </Button>
          </div>
        )}
      </div>

      {check.isFetching && <p className="text-sm text-[#5A646D]">{t('inspector.scan.loading')}</p>}

      {check.error && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          {check.error instanceof ApiError ? errorText(check.error) : t('inspector.scan.error')}
        </div>
      )}

      {check.data && !check.data.found && (
        <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl text-sm text-[#92400E]">
          {t('inspector.scan.notFound')}
        </div>
      )}

      {check.data && check.data.found && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E4E7EA]">
            {check.data.status === POSITIVE_STATUS ? (
              <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-[#B91C1C] shrink-0" />
            )}
            <span className="font-bold text-[#1A1F24]">{check.data.status}</span>
          </div>
          <dl>
            <ResultRow
              label={t('inspector.scan.validPeriodLabel')}
              value={`${formatDate(check.data.valid_from)} — ${formatDate(check.data.valid_to)}`}
            />
            <ResultRow label={t('inspector.scan.organizationLabel')} value={check.data.organization} />
            <ResultRow label={t('inspector.scan.activityTypeLabel')} value={check.data.activity_type} />
            <ResultRow label={t('inspector.scan.holderLabel')} value={check.data.holder} />
            <ResultRow
              label={t('inspector.scan.signaturesValidLabel')}
              value={
                check.data.signatures_valid
                  ? t('inspector.scan.signaturesValidYes')
                  : t('inspector.scan.signaturesValidNo')
              }
            />
          </dl>
        </div>
      )}
    </div>
  );
}
