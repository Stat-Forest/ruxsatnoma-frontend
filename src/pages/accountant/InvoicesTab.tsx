import { useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { formatDateTime, formatMoney, shortId } from '../permits/format';
import type { InvoiceStatus } from './api';
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from './statusMeta';
import { useInvoicesList } from './queries';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';

const PAGE_SIZE = 20;

/**
 * G1 — F12a. `GET /invoices` lists the caller's own zone (or narrows to one
 * application) — the register this screen used to say did not exist. The
 * two lookups this tab already offered (by application, by a known invoice
 * id) stay: a citizen or a support ticket still hands an accountant one of
 * those ids directly often enough to keep both shortcuts, on top of the
 * always-visible register rather than gating everything behind a search.
 */
export function InvoicesTab() {
  const t = useT();
  const [applicationIdDraft, setApplicationIdDraft] = useState('');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [directInvoiceId, setDirectInvoiceId] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);

  const listQuery = useInvoicesList({
    application_id: applicationId ?? undefined,
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const statusOptions = [
    { value: '', label: t('accountant.common.all') },
    ...(Object.entries(INVOICE_STATUS_LABEL) as [InvoiceStatus, string][]).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  function searchByApplication(e: React.FormEvent) {
    e.preventDefault();
    setApplicationId(applicationIdDraft.trim() || null);
    setPage(1);
  }

  function clearApplicationFilter() {
    setApplicationId(null);
    setApplicationIdDraft('');
    setPage(1);
  }

  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5" data-testid="invoices-tab">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.searchByApplication')}</h2>
          <form className="flex items-end gap-2" onSubmit={searchByApplication}>
            <FormField label={t('accountant.invoices.applicationIdLabel')} htmlFor="invoices-application-id" className="flex-1">
              <Input
                id="invoices-application-id"
                value={applicationIdDraft}
                onChange={(e) => setApplicationIdDraft(e.target.value)}
                placeholder={t('accountant.invoices.applicationIdPlaceholder')}
              />
            </FormField>
            <Button type="submit" leftIcon={<Search className="h-4 w-4" />}>
              {t('accountant.invoices.searchButton')}
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.openById')}</h2>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (directInvoiceId.trim()) setOpenInvoiceId(directInvoiceId.trim());
            }}
          >
            <FormField label={t('accountant.invoices.invoiceIdLabel')} htmlFor="invoices-direct-id" className="flex-1">
              <Input
                id="invoices-direct-id"
                value={directInvoiceId}
                onChange={(e) => setDirectInvoiceId(e.target.value)}
                placeholder={t('accountant.invoices.invoiceIdPlaceholder')}
              />
            </FormField>
            <Button type="submit" variant="secondary">
              {t('accountant.invoices.openButton')}
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E7EA] p-4">
          <div>
            <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.registerTitle')}</h2>
            <p className="mt-0.5 text-xs text-[#5A646D]">{t('accountant.invoices.registerHint')}</p>
          </div>
          <div className="flex items-end gap-2">
            <FormField label={t('accountant.invoices.statusFilterLabel')} htmlFor="invoices-status-filter">
              <Select
                id="invoices-status-filter"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as InvoiceStatus | '');
                  setPage(1);
                }}
                options={statusOptions}
              />
            </FormField>
          </div>
        </div>

        {applicationId && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] bg-[#F8F9FA] px-4 py-2 text-xs">
            <span className="text-[#5A646D]">
              {t('accountant.invoices.filteredByApplication')}: <span className="font-mono text-[#1A1F24]">{applicationId}</span>
            </span>
            <Button size="sm" variant="outline" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clearApplicationFilter}>
              {t('accountant.invoices.clearFilter')}
            </Button>
          </div>
        )}

        {listQuery.isLoading ? (
          <p className="p-4 text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
        ) : listQuery.isError ? (
          <div className="p-4">
            <Alert variant="danger">
              {listQuery.error instanceof ApiError && listQuery.error.code === 'ERR-SYS-003'
                ? t('accountant.invoices.notFound')
                : t('accountant.invoices.loadFailed')}
            </Alert>
          </div>
        ) : listQuery.data && listQuery.data.items.length === 0 ? (
          <p className="p-4 text-sm text-[#5A646D]">
            {applicationId ? t('accountant.invoices.emptyResults') : t('accountant.invoices.registerEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
                <tr>
                  <th className="px-4 py-3">{t('accountant.invoices.colNumber')}</th>
                  <th className="px-4 py-3">{t('accountant.invoices.colStatus')}</th>
                  {!applicationId && <th className="px-4 py-3">{t('accountant.invoices.colApplication')}</th>}
                  <th className="px-4 py-3 text-right">{t('accountant.invoices.colAmount')}</th>
                  <th className="px-4 py-3">{t('accountant.invoices.colIssuedAt')}</th>
                  <th className="px-4 py-3">{t('accountant.invoices.colDueAt')}</th>
                  <th className="px-4 py-3">{t('accountant.invoices.colPaidAt')}</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.data!.items.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer border-t border-[#E4E7EA] hover:bg-[#F8F9FA]"
                    onClick={() => setOpenInvoiceId(invoice.id)}
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{invoice.number}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                          INVOICE_STATUS_STYLE[invoice.status] ?? INVOICE_STATUS_STYLE.pending
                        }`}
                      >
                        {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                    {!applicationId && (
                      <td className="px-4 py-3 font-mono text-xs" title={invoice.application_id}>
                        {shortId(invoice.application_id)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right font-mono">{formatMoney(invoice.amount)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDateTime(invoice.issued_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDateTime(invoice.due_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {invoice.paid_at ? formatDateTime(invoice.paid_at) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {listQuery.data && listQuery.data.total > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={listQuery.data.total} />
          </div>
        )}
      </section>

      {openInvoiceId && <InvoiceDetailDrawer invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />}
    </div>
  );
}
