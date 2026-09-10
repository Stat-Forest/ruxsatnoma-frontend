import { useMemo, useState } from 'react';
import { useLanguage, useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Select } from '../../components/ui/FormControls';
import { useBenefitClaims } from './queries';
import { useActivityTypes } from './refs';
import { compareForQueue, formatWaitingDays, localizedName, shortId, waitingDays } from './format';
import { BenefitClaimDrawer } from './BenefitClaimDrawer';
import type { ApplicationOut, BenefitVerificationStatus, CertificateBearingStatus } from './api';

const PAGE_SIZE = 20;

const STATUS_BADGE_CLASS: Record<BenefitVerificationStatus, string> = {
  not_required: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
  pending: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  verified: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  rejected: 'bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]',
};

/**
 * The verifier's queue (T11 task 1, decisions.md #179): every application
 * carrying a certificate-bearing benefit claim, country-wide — this role's
 * whole surface (`api.ts`'s own docstring). Reached only through
 * `RequireAuth permission="benefits.verify"` (`routes.tsx`, generated from
 * `shell/navigation.ts`'s own `NAVIGATION` entry) — nothing inside this
 * screen re-checks the permission a second time.
 *
 * **Ordering is the point of this screen, not a display detail.** The
 * backend answers `id DESC` (recency) only (`repo.list_certificate_claims`'s
 * own docstring); `compareForQueue` (`./format.ts`) re-sorts each fetched
 * page so every PENDING claim sits above every decided one, oldest-waiting
 * pending claim first — "a claim nobody has looked at is the only thing
 * this role exists for" (the task brief). `DataTable`'s own column-sort is
 * therefore never enabled here: a click that reordered the queue would
 * defeat the one thing this table is for.
 */
export function BenefitVerificationPage() {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();

  const [status, setStatus] = useState<CertificateBearingStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activityTypes = useActivityTypes();
  const list = useBenefitClaims({
    verification_status: status === '' ? undefined : status,
    page,
    page_size: PAGE_SIZE,
  });

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = useMemo(() => [...(list.data?.items ?? [])].sort(compareForQueue), [list.data]);

  const columns: Column<ApplicationOut>[] = [
    {
      key: 'certificate',
      header: t('benefitVerification.col.certificateNo'),
      accessor: (row) => <span className="font-mono text-xs">{row.benefit_certificate_no || '—'}</span>,
    },
    {
      key: 'applicant',
      header: t('benefitVerification.col.applicant'),
      accessor: (row) => <span className="font-mono text-xs">{shortId(row.applicant_id)}</span>,
    },
    {
      key: 'activity',
      header: t('benefitVerification.col.activity'),
      accessor: (row) =>
        row.activity_type_id
          ? localizedName(activityTypes.data?.find((a) => a.id === row.activity_type_id)?.name, lang) ||
            shortId(row.activity_type_id)
          : '—',
    },
    {
      key: 'waiting',
      header: t('benefitVerification.col.waiting'),
      accessor: (row) => formatWaitingDays(waitingDays(row), lang),
    },
    {
      key: 'status',
      header: t('benefitVerification.col.status'),
      accessor: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${STATUS_BADGE_CLASS[row.benefit_verification_status]}`}
        >
          {t(`benefitVerification.status.${row.benefit_verification_status}`)}
        </span>
      ),
    },
    {
      key: 'view',
      header: '',
      accessor: (row) => (
        <button
          className="text-xs font-semibold text-[#2E7D4F] hover:underline"
          onClick={() => setSelectedId(row.id)}
          data-testid={`benefit-claim-open-${row.id}`}
        >
          {t('benefitVerification.col.view')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-16" data-testid="benefit-verification-page">
      <header>
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('benefitVerification.title')}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">{t('benefitVerification.subtitle')}</p>
      </header>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs">
        <div className="max-w-xs">
          <FormField label={t('benefitVerification.filters.status')}>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CertificateBearingStatus | '');
                setPage(1);
              }}
              options={[
                { value: '', label: t('benefitVerification.filters.all') },
                { value: 'pending', label: t('benefitVerification.filters.pending') },
                { value: 'verified', label: t('benefitVerification.filters.verified') },
                { value: 'rejected', label: t('benefitVerification.filters.rejected') },
              ]}
            />
          </FormField>
        </div>
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('benefitVerification.loadError')}
        </div>
      )}

      <DataTable
        columns={columns}
        data={items}
        isLoading={list.isLoading}
        emptyTitle={t('benefitVerification.empty')}
        emptyDescription=""
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
      />

      {selectedId && <BenefitClaimDrawer applicationId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
