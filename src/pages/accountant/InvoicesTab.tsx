import { useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { formatDateTime, formatMoney } from '../permits/format';
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE } from './statusMeta';
import { useInvoicesByApplication } from './queries';
import { InvoiceDetailDrawer } from './InvoiceDetailDrawer';

/**
 * G1 — NOT a browsable "every invoice" register: `GET /invoices` has no
 * route that lists without a filter (`application_id` is required on the
 * wire). `06.5-accountant.md` ruling R1 makes this a lookup instead: search
 * every invoice of one application, or open one directly if its id is
 * already known (from a citizen, a support ticket, another screen's link).
 */
export function InvoicesTab() {
  const t = useT();
  const [applicationIdDraft, setApplicationIdDraft] = useState('');
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [directInvoiceId, setDirectInvoiceId] = useState('');
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);

  const listQuery = useInvoicesByApplication(applicationId);

  return (
    <div className="space-y-5" data-testid="invoices-tab">
      <Alert variant="info">{t('accountant.invoices.noRoute')}</Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.searchByApplication')}</h2>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setApplicationId(applicationIdDraft.trim() || null);
            }}
          >
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

      {applicationId && (
        <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
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
          ) : listQuery.data && listQuery.data.length === 0 ? (
            <p className="p-4 text-sm text-[#5A646D]">{t('accountant.invoices.emptyResults')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
                  <tr>
                    <th className="px-4 py-3">{t('accountant.invoices.colNumber')}</th>
                    <th className="px-4 py-3">{t('accountant.invoices.colStatus')}</th>
                    <th className="px-4 py-3 text-right">{t('accountant.invoices.colAmount')}</th>
                    <th className="px-4 py-3">{t('accountant.invoices.colIssuedAt')}</th>
                    <th className="px-4 py-3">{t('accountant.invoices.colDueAt')}</th>
                    <th className="px-4 py-3">{t('accountant.invoices.colPaidAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {listQuery.data!.map((invoice) => (
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
        </section>
      )}

      {openInvoiceId && <InvoiceDetailDrawer invoiceId={openInvoiceId} onClose={() => setOpenInvoiceId(null)} />}
    </div>
  );
}
