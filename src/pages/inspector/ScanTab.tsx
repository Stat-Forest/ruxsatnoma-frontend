import { useState } from 'react';
import { Link } from 'react-router';
import { CheckCircle2, ChevronDown, ChevronUp, Search, XCircle } from 'lucide-react';
import { useLanguage, useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { formatDate, formatDecimal, formatPermitNumber, shortId } from './format';
import { PERMIT_STATUS_LABEL, PERMIT_STATUS_STYLE } from '../permits/statusMeta';
import { parseQrInput } from './qr';
import {
  useActivityTypeName,
  useContourNumber,
  useOrganizationName,
  usePermitByNumber,
  usePublicPermitCheck,
  type PermitOut,
  type PublicPermitCheckInput,
} from './queries';

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
 * С15 — look up a permit two ways, and they are NOT the same read anymore
 * (F17). A scanned/pasted QR token has no authenticated equivalent to fall
 * back to — `PublicCheckCard`'s own docstring rules out a route ever
 * returning `qr_token` (anti-enumeration, ruling 8) — so that path still
 * calls the anonymous `usePublicPermitCheck` (`GET /public/permits/check`)
 * a citizen would use, masked `holder` and all: no fake camera simulation
 * (Global Constraint 7), no richer data invented beyond what that endpoint
 * returns.
 *
 * Series+number — what the inspector reads straight off the printed permit
 * in their hand — now goes through `usePermitByNumber` (`GET /permits`,
 * authenticated, the SAME `permits.view_any` read `/permits` itself uses):
 * the real permit id, contour, area, SB load and status, never a masked
 * pseudo-name standing in for an identity check the officer does not need
 * the app to perform (the paper in their hand already carries the full
 * name). The result links straight into `/permits/{id}` for the full
 * document — signatures, timeline, PDF — which `permits.view_any` already
 * unlocks.
 */
export function ScanTab() {
  const t = useT();
  const errorText = useApiErrorText();
  const [tokenInput, setTokenInput] = useState('');
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [series, setSeries] = useState('');
  const [number, setNumber] = useState('');
  const [tokenSubmitted, setTokenSubmitted] = useState<PublicPermitCheckInput | null>(null);
  const [numberSubmitted, setNumberSubmitted] = useState<{ series: string; number: number } | null>(null);

  const check = usePublicPermitCheck(tokenSubmitted);
  const authCheck = usePermitByNumber(numberSubmitted);

  function submitToken() {
    const parsed = parseQrInput(tokenInput);
    if (parsed) setTokenSubmitted(parsed);
  }

  function submitSeriesNumber() {
    const parsedNumber = Number(number);
    if (!series.trim() || !number || !Number.isInteger(parsedNumber) || parsedNumber <= 0) return;
    setNumberSubmitted({ series: series.trim(), number: parsedNumber });
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

      {authCheck.isFetching && <p className="text-sm text-[#5A646D]">{t('inspector.scan.loading')}</p>}

      {authCheck.error && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          {authCheck.error instanceof ApiError
            ? `${authCheck.error.code}: ${authCheck.error.message}`
            : t('inspector.scan.error')}
        </div>
      )}

      {authCheck.isSuccess && authCheck.data === null && (
        <div className="p-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl text-sm text-[#92400E]">
          {t('inspector.scan.notFound')}
        </div>
      )}

      {authCheck.data && <AuthenticatedPermitResult permit={authCheck.data} t={t} />}
    </div>
  );
}

/**
 * F17's actual fix, rendered: the inspector's OWN read of the permit the
 * series+number path found — real id, real contour, real load, no mask.
 * Every field comes straight off `PermitOut` (the permit's own frozen
 * columns) or the three permission-free ref lookups that already resolve
 * them elsewhere in this app (`useActivityTypeName`/`useOrganizationName`/
 * `useContourNumber`); the applicant's own name is NOT resolved here — there
 * is no "look up any applicant by id" route (`permits/PermitRequisitesPanel
 * .tsx`'s own comment), and the printed permit in the inspector's hand
 * already carries it in full, unmasked. The link into `/permits/{id}` is
 * where signatures, history and the PDF live — this card does not repeat
 * them.
 */
function AuthenticatedPermitResult({ permit, t }: { permit: PermitOut; t: (key: string) => string }) {
  const { lang } = useLanguage();
  const activityName = useActivityTypeName(permit.activity_type_id, lang);
  const organizationName = useOrganizationName(permit.organization_id, lang);
  const contourNumber = useContourNumber(permit.contour_id);
  const area = formatDecimal(permit.area_ha);
  const sbLoad = formatDecimal(permit.sb_load);

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-2 shadow-xs" data-testid="scan-auth-result">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E4E7EA]">
        <span className="text-xs font-bold uppercase tracking-wide text-[#5A646D]">
          {t('inspector.scan.authResultTitle')}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
            PERMIT_STATUS_STYLE[permit.status] ?? PERMIT_STATUS_STYLE.pending_signatures
          }`}
        >
          {PERMIT_STATUS_LABEL[permit.status] ?? permit.status}
        </span>
      </div>
      <dl>
        <ResultRow label={t('inspector.scan.permitIdLabel')} value={formatPermitNumber(permit.series, permit.number)} />
        <ResultRow
          label={t('inspector.scan.organizationLabel')}
          value={organizationName ?? `ID ${shortId(permit.organization_id)}`}
        />
        <ResultRow
          label={t('inspector.scan.activityTypeLabel')}
          value={activityName ?? `ID ${shortId(permit.activity_type_id)}`}
        />
        <ResultRow
          label={t('inspector.scan.contourLabel')}
          value={contourNumber ? `№ ${contourNumber}` : `ID ${shortId(permit.contour_id)}`}
        />
        <ResultRow
          label={t('inspector.scan.validPeriodLabel')}
          value={`${formatDate(permit.period_from)} — ${formatDate(permit.period_to)}`}
        />
        <ResultRow label={t('inspector.scan.areaLabel')} value={area ? `${area} ga` : '—'} />
        <ResultRow
          label={t('inspector.scan.sbLoadLabel')}
          value={sbLoad ?? t('inspector.scan.sbLoadNotRequired')}
        />
        <ResultRow label={t('inspector.scan.holderLabel')} value={`ID ${shortId(permit.applicant_id)}`} />
      </dl>
      <div className="pt-2 flex justify-end">
        <Link to={`/permits/${permit.id}`} className="text-xs font-bold text-[#2E7D4F] hover:underline">
          {t('inspector.scan.openFullRecord')}
        </Link>
      </div>
    </div>
  );
}
