import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { Alert } from '../../../components/ui/Feedback';
import { useT, useLanguage } from '../../../i18n/useT';
import { REFUND_STATUS_STYLE, getRefundStatusLabel } from '../../accountant/statusMeta';
import { formatDate, formatDateTime, formatMoney } from '../../permits/format';
import { pickName } from '../format';
import type { RefundOut } from '../api';
import { RefundRequestModal, type BillableApplication, type ListStatus } from './RefundRequestModal';
import { useMyApplicationsIndex, useMyInvoices, useMyRefunds, useRefundReasons } from './queries';

const PAGE_SIZE = 50;
const INVOICE_STATUS_RANK: Record<string, number> = { paid: 0, pending: 1, expired: 2, cancelled: 3 };

/** A query's tri-state for the modal — `isPending`/`isError` collapsed into
 * one value so a failed or still-loading list never reads as "empty" (see
 * `RefundRequestModal.tsx`'s `ListStatus`). */
function queryStatus(query: { isPending: boolean; isError: boolean }): ListStatus {
  if (query.isError) return 'error';
  if (query.isPending) return 'pending';
  return 'ready';
}

/** Stage 11 — the citizen's refund requests from `GET /refunds` without
 * `application_id` (rulings R1, R3), and the button that files one (R4). The backend has
 * already blanked the accountant's working fields for this reader, so a
 * row shows `final_amount` when decided and «Qaror kutilmoqda» until then —
 * never `suggested_amount`, which the response does not carry for them. */
export function MyRefundsTab() {
  const t = useT();
  const { lang } = useLanguage();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const refundsQuery = useMyRefunds({ page, pageSize: PAGE_SIZE });
  const invoicesQuery = useMyInvoices({ page: 1, pageSize: 200 });
  const reasonsQuery = useRefundReasons();
  const { index: applications } = useMyApplicationsIndex();

  const lists: { invoices: ListStatus; reasons: ListStatus } = {
    invoices: queryStatus(invoicesQuery),
    reasons: queryStatus(reasonsQuery),
  };

  const reasonById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of reasonsQuery.data ?? []) map.set(item.id, pickName(item.name, lang));
    return map;
  }, [reasonsQuery.data, lang]);

  /** One entry per application that carries an invoice, labelled with its
   * best invoice's status (paid before pending before the rest). */
  const billable: BillableApplication[] = useMemo(() => {
    const best = new Map<string, string>();
    for (const invoice of invoicesQuery.data?.items ?? []) {
      const current = best.get(invoice.application_id);
      if (current === undefined || (INVOICE_STATUS_RANK[invoice.status] ?? 9) < (INVOICE_STATUS_RANK[current] ?? 9)) {
        best.set(invoice.application_id, invoice.status);
      }
    }
    return Array.from(best, ([id, invoiceStatus]) => ({
      id,
      number: applications.get(id)?.number ?? null,
      invoiceStatus,
    }));
  }, [invoicesQuery.data, applications]);

  const columns: Column<RefundOut>[] = [
    {
      key: 'application',
      header: t('myPayments.refunds.colApplication'),
      accessor: (row) => {
        const application = applications.get(row.application_id);
        return (
          <Link to={`/my/applications/${row.application_id}`} className="font-mono hover:underline">
            {application?.number ?? row.application_id.slice(0, 8)}
          </Link>
        );
      },
    },
    {
      key: 'basis',
      header: t('myPayments.refunds.colBasis'),
      accessor: (row) => (
        <div>
          <div>{reasonById.get(row.basis_item_id) ?? '—'}</div>
          {row.comment != null && <div className="text-xs text-[#5A646D] mt-0.5">{row.comment}</div>}
        </div>
      ),
    },
    {
      key: 'final',
      header: t('myPayments.refunds.colFinal'),
      accessor: (row) =>
        row.final_amount !== null ? (
          <span className="font-mono">{formatMoney(row.final_amount)} soʻm</span>
        ) : (
          <span className="text-[#5A646D]">{t('myPayments.refunds.pendingDecision')}</span>
        ),
    },
    {
      key: 'status',
      header: t('myPayments.refunds.colStatus'),
      accessor: (row) => (
        <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold ${REFUND_STATUS_STYLE[row.status] ?? ''}`}>
          {getRefundStatusLabel(row.status, lang)}
        </span>
      ),
    },
    { key: 'requested', header: t('myPayments.refunds.colRequestedAt'), accessor: (row) => formatDateTime(row.requested_at) },
    { key: 'due', header: t('myPayments.refunds.colDue'), accessor: (row) => formatDate(row.due_at) },
    { key: 'decidedAt', header: t('myPayments.refunds.colDecidedAt'), accessor: (row) => formatDateTime(row.decided_at) },
  ];

  const total = refundsQuery.data?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
          {t('myPayments.refunds.newRequest')}
        </Button>
      </div>
      {refundsQuery.isError ? (
        <Alert variant="danger">{t('myPayments.refunds.loadFailed')}</Alert>
      ) : (
        <>
          {sent && <Alert variant="success">{t('myPayments.refunds.requestSent')}</Alert>}
          <DataTable
            columns={columns}
            data={refundsQuery.data?.items ?? []}
            isLoading={refundsQuery.isPending}
            emptyTitle={t('myPayments.refunds.empty')}
            pagination={{
              currentPage: page,
              totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
              onPageChange: setPage,
              totalRecords: total,
            }}
          />
        </>
      )}
      {open && (
        <RefundRequestModal
          onClose={() => setOpen(false)}
          onSent={() => setSent(true)}
          applications={billable}
          reasons={reasonsQuery.data ?? []}
          lists={lists}
        />
      )}
    </div>
  );
}
