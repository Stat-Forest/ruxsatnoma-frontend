import { useState } from 'react';
import { Link } from 'react-router';
import { CreditCard, Eye } from 'lucide-react';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { FormField, Select } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { ExportXlsxButton } from '../../../components/ui/ExportXlsxButton';
import { useLanguage, useT } from '../../../i18n/useT';
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, getInvoiceStatusLabel } from '../../permits/statusMeta';
import { formatDateTime, formatMoney } from '../../permits/format';
import type { InvoiceOut } from '../api';
import { useMyApplicationsIndex, useMyInvoices } from './queries';

const PAGE_SIZE = 50;
const STATUSES = Object.keys(INVOICE_STATUS_LABEL);

/** Stage 11 — every invoice of every application the citizen owns or
 * represents, from `GET /invoices` without `application_id` (ruling R1). The application
 * number comes from the citizen's own application list, joined here by id:
 * `InvoiceOut` carries `application_id` only, and a second backend field for
 * a number the same page already holds would be one more place to disagree. */
export function MyInvoicesTab() {
  const t = useT();
  const { lang } = useLanguage();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const invoicesQuery = useMyInvoices({ status, page, pageSize: PAGE_SIZE });
  const { index: applications } = useMyApplicationsIndex();

  const columns: Column<InvoiceOut>[] = [
    {
      key: 'number',
      header: t('myPayments.invoices.colNumber'),
      accessor: (row) => <span className="font-mono font-semibold text-[#1A1F24]">{row.number}</span>,
    },
    {
      key: 'application',
      header: t('myPayments.invoices.colApplication'),
      accessor: (row) => {
        const application = applications.get(row.application_id);
        return application ? (
          <Link to={`/my/applications/${row.application_id}`} className="font-mono hover:underline">
            {application.number ?? application.id.slice(0, 8)}
          </Link>
        ) : (
          <span className="font-mono text-[#5A646D]">{row.application_id.slice(0, 8)}</span>
        );
      },
    },
    {
      key: 'amount',
      header: t('myPayments.invoices.colAmount'),
      accessor: (row) => <span className="font-mono">{formatMoney(row.amount)} soʻm</span>,
    },
    {
      key: 'status',
      header: t('myPayments.invoices.colStatus'),
      accessor: (row) => (
        <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-semibold ${INVOICE_STATUS_STYLE[row.status] ?? ''}`}>
          {getInvoiceStatusLabel(row.status, lang)}
        </span>
      ),
    },
    { key: 'issued', header: t('myPayments.invoices.colIssued'), accessor: (row) => formatDateTime(row.issued_at) },
    { key: 'due', header: t('myPayments.invoices.colDue'), accessor: (row) => formatDateTime(row.due_at) },
  ];

  if (invoicesQuery.isError) {
    return <Alert variant="danger">{t('myPayments.invoices.loadFailed')}</Alert>;
  }

  const total = invoicesQuery.data?.total ?? 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('myPayments.invoices.colStatus')} htmlFor="my-invoices-status">
          <Select
            id="my-invoices-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('myPayments.filterAll') },
              ...STATUSES.map((value) => ({ value, label: getInvoiceStatusLabel(value, lang) })),
            ]}
          />
        </FormField>
        <ExportXlsxButton className="ml-auto" path="/api/v1/invoices" query={{ status: status || undefined }} />
      </div>
      <DataTable
        columns={columns}
        data={invoicesQuery.data?.items ?? []}
        isLoading={invoicesQuery.isPending}
        emptyTitle={t('myPayments.invoices.empty')}
        emptyDescription={t('myPayments.invoices.emptyHint')}
        actions={(row) =>
          row.status === 'pending' ? (
            <Link to={`/my/invoices/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#2E7D4F] hover:underline">
              <CreditCard className="w-4 h-4" /> {t('myPayments.invoices.pay')}
            </Link>
          ) : (
            <Link to={`/my/invoices/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-[#1A1F24] hover:underline">
              <Eye className="w-4 h-4" /> {t('myPayments.invoices.open')}
            </Link>
          )
        }
        pagination={{
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
          onPageChange: setPage,
          totalRecords: total,
        }}
      />
    </div>
  );
}
