import { useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDateTime, formatMoney, shortId } from '../permits/format';
import type { InvoiceStatus } from './api';
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, getInvoiceStatusLabel } from './statusMeta';
import { useInvoicesList } from './queries';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../lib/rowClick';

const PAGE_SIZE = 20;

/**
 * G1 — F12a. `GET /invoices` lists the caller's own zone (or narrows to one
 * application, or to one invoice number) — the register this screen used to
 * say did not exist.
 *
 * Stage 14 (#205 R1, R5): both search cards take a person-held PUBLIC number
 * (`RX-2026-00001`, `INV-2026-000123`), never the underlying id — the drawer
 * opens only from a register row, which is the one place an `invoice.id`
 * legitimately exists in this screen's own state.
 */
export function InvoicesTab() {
  const t = useT();
  const { lang } = useLanguage();
  const [applicationNumberDraft, setApplicationNumberDraft] = useState('');
  const [applicationNumber, setApplicationNumber] = useState<string | null>(null);
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [page, setPage] = useState(1);

  const listQuery = useInvoicesList({
    application_number: applicationNumber ?? undefined,
    number: invoiceNumber ?? undefined,
    status: status || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const statusOptions = [
    { value: '', label: t('accountant.common.all') },
    ...(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((value) => ({
      value,
      label: getInvoiceStatusLabel(value, lang),
    })),
  ];

  function searchByApplication(e: React.FormEvent) {
    e.preventDefault();
    setApplicationNumber(applicationNumberDraft.trim() || null);
    setPage(1);
  }

  function searchByInvoiceNumber(e: React.FormEvent) {
    e.preventDefault();
    setInvoiceNumber(invoiceNumberDraft.trim() || null);
    setPage(1);
  }

  /**
   * A5 (final review): resets BOTH filters, not just the one whose banner
   * happened to be clicked — the two can be set at once (they AND together
   * on the backend), so a "clear" that left the other one live would send a
   * still-narrowed request right after the register looked cleared.
   */
  function clearFilters() {
    setApplicationNumber(null);
    setApplicationNumberDraft('');
    setInvoiceNumber(null);
    setInvoiceNumberDraft('');
    setPage(1);
  }

  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5" data-testid="invoices-tab">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.searchByApplication')}</h2>
          <form className="flex flex-col sm:flex-row sm:items-end gap-2.5" onSubmit={searchByApplication}>
            <FormField label={t('accountant.invoices.applicationNumberLabel')} htmlFor="invoices-application-number" className="flex-1 w-full">
              <Input
                id="invoices-application-number"
                value={applicationNumberDraft}
                onChange={(e) => setApplicationNumberDraft(e.target.value)}
                placeholder={t('accountant.invoices.applicationNumberPlaceholder')}
              />
            </FormField>
            <Button type="submit" className="w-full sm:w-auto" leftIcon={<Search className="h-4 w-4" />}>
              {t('accountant.invoices.searchButton')}
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.searchByInvoice')}</h2>
          <form className="flex flex-col sm:flex-row sm:items-end gap-2.5" onSubmit={searchByInvoiceNumber}>
            <FormField label={t('accountant.invoices.invoiceNumberLabel')} htmlFor="invoices-invoice-number" className="flex-1 w-full">
              <Input
                id="invoices-invoice-number"
                value={invoiceNumberDraft}
                onChange={(e) => setInvoiceNumberDraft(e.target.value)}
                placeholder={t('accountant.invoices.invoiceNumberPlaceholder')}
              />
            </FormField>
            <Button type="submit" variant="secondary" className="w-full sm:w-auto" leftIcon={<Search className="h-4 w-4" />}>
              {t('accountant.invoices.searchButton')}
            </Button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7EA] p-4">
          <div>
            <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.registerTitle')}</h2>
            <p className="mt-0.5 text-xs text-[#5A646D]">{t('accountant.invoices.registerHint')}</p>
          </div>
          <div className="flex items-end gap-2 w-full sm:w-auto">
            <FormField label={t('accountant.invoices.statusFilterLabel')} htmlFor="invoices-status-filter" className="w-full sm:w-auto">
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

        {(applicationNumber || invoiceNumber) && (
          <div
            data-testid="invoices-filter-banner"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E7EA] bg-[#F8F9FA] px-4 py-2 text-xs"
          >
            <span className="text-[#5A646D] break-words space-x-1">
              {applicationNumber && (
                <span>
                  {t('accountant.invoices.filteredByApplication')}: <span className="font-mono text-[#1A1F24] break-all">{applicationNumber}</span>
                </span>
              )}
              {invoiceNumber && (
                <span>
                  {t('accountant.invoices.filteredByInvoice')}: <span className="font-mono text-[#1A1F24] break-all">{invoiceNumber}</span>
                </span>
              )}
            </span>
            <Button size="sm" variant="outline" className="w-full sm:w-auto" leftIcon={<RotateCcw className="h-3.5 w-3.5" />} onClick={clearFilters}>
              {t('accountant.invoices.clearFilter')}
            </Button>
          </div>
        )}

        {listQuery.isLoading ? (
          <p className="p-4 text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
        ) : listQuery.isError ? (
          <div className="p-4">
            <Alert variant={listQuery.error instanceof ApiError && listQuery.error.code === 'ERR-SYS-003' && applicationNumber ? 'info' : 'danger'}>
              {listQuery.error instanceof ApiError && listQuery.error.code === 'ERR-SYS-003'
                ? applicationNumber
                  ? t('accountant.invoices.applicationNotFound')
                  : t('accountant.invoices.notFound')
                : t('accountant.invoices.loadFailed')}
            </Alert>
          </div>
        ) : listQuery.data && listQuery.data.items.length === 0 ? (
          <p className="p-4 text-sm text-[#5A646D]">
            {applicationNumber ? t('accountant.invoices.emptyResults') : t('accountant.invoices.registerEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm whitespace-nowrap">
              <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
                <tr>
                  <th className="px-4 py-3">{t('accountant.invoices.colNumber')}</th>
                  <th className="px-4 py-3">{t('accountant.invoices.colStatus')}</th>
                  {!applicationNumber && <th className="px-4 py-3">{t('accountant.invoices.colApplication')}</th>}
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
                    {...clickableRowProps(() => setOpenInvoiceId(invoice.id))}
                    className={`border-t border-[#E4E7EA] hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}`}
                    data-testid={`invoice-row-${invoice.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{invoice.number}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                          INVOICE_STATUS_STYLE[invoice.status] ?? INVOICE_STATUS_STYLE.pending
                        }`}
                      >
                        {getInvoiceStatusLabel(invoice.status, lang)}
                      </span>
                    </td>
                    {!applicationNumber && (
                      <td className="px-4 py-3 font-mono text-xs" title={invoice.application_id}>
                        {invoice.application_number ?? shortId(invoice.application_id)}
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
          <div className="px-4 border-t border-[#E4E7EA] overflow-x-auto">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={listQuery.data.total} />
          </div>
        )}
      </section>

      {openInvoiceId && <InvoiceDetailDrawer invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />}
    </div>
  );
}
