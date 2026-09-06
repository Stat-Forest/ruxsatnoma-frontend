import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import { Drawer } from '../../components/ui/Overlay';
import { Button } from '../../components/ui/button';
import { FormField, Input } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useT } from '../../i18n/useT';
import { formatDateTime, formatMoney } from '../permits/format';
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_STYLE, ALLOCATION_TARGET_LABEL, ENTRY_TYPE_LABEL } from './statusMeta';
import { uploadFile } from './api';
import { useAllocationsForInvoice, useFileManualConfirmation, useInvoice } from './queries';

const PAYMENTS_MANAGE = 'payments.manage';

/**
 * G2 lives here, not on its own screen: the 50/50 ledger is read "through
 * invoice detail" per the plan. The manual-PAID FILING half of G4 lives here
 * too — it is an action on ONE invoice (`ManualConfirmationIn.invoice_id`),
 * so it belongs next to the invoice it pays rather than a floating form on
 * the Discrepancies tab; the CHECKER's confirm/reject half is over there
 * instead, since the checker starts from an id, not from this invoice.
 */
export function InvoiceDetailDrawer({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const t = useT();
  const { me } = useAuth();
  const canFileManualPaid = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_MANAGE));

  const invoiceQuery = useInvoice(invoiceId);
  const allocationsQuery = useAllocationsForInvoice(invoiceId);

  return (
    <Drawer isOpen onClose={onClose} title={t('accountant.invoices.detailTitle')}>
      {invoiceQuery.isLoading ? (
        <p className="text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
      ) : invoiceQuery.isError ? (
        <Alert variant="danger">
          {invoiceQuery.error instanceof ApiError && invoiceQuery.error.code === 'ERR-SYS-003'
            ? t('accountant.invoices.notFound')
            : t('accountant.invoices.loadFailed')}
        </Alert>
      ) : (
        <div className="space-y-6">
          <InvoiceHeader invoice={invoiceQuery.data!} />
          <LedgerSection invoiceId={invoiceId} allocations={allocationsQuery.data} isLoading={allocationsQuery.isLoading} />
          {canFileManualPaid && invoiceQuery.data!.status === 'pending' && (
            <ManualPaidFilingForm invoiceId={invoiceId} />
          )}
        </div>
      )}
    </Drawer>
  );
}

function InvoiceHeader({ invoice }: { invoice: import('./api').InvoiceOut }) {
  const t = useT();
  return (
    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailNumber')}</dt>
        <dd className="font-mono font-bold text-[#1A1F24]">{invoice.number}</dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailStatus')}</dt>
        <dd>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              INVOICE_STATUS_STYLE[invoice.status] ?? INVOICE_STATUS_STYLE.pending
            }`}
          >
            {INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
          </span>
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailAmount')}</dt>
        <dd className="font-mono text-base font-bold text-[#123522]">{formatMoney(invoice.amount)}</dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailApplication')}</dt>
        <dd className="font-mono text-[#1A1F24]" title={invoice.application_id}>
          {invoice.application_id.slice(0, 8)}
        </dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailIssuedAt')}</dt>
        <dd className="font-mono text-[#1A1F24]">{formatDateTime(invoice.issued_at)}</dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailDueAt')}</dt>
        <dd className="font-mono text-[#1A1F24]">{formatDateTime(invoice.due_at)}</dd>
      </div>
      <div>
        <dt className="font-semibold text-[#5A646D]">{t('accountant.invoices.detailPaidAt')}</dt>
        <dd className="font-mono text-[#1A1F24]">{invoice.paid_at ? formatDateTime(invoice.paid_at) : '—'}</dd>
      </div>
    </dl>
  );
}

function LedgerSection({
  allocations,
  isLoading,
}: {
  invoiceId: string;
  allocations: import('./api').AllocationOut[] | undefined;
  isLoading: boolean;
}) {
  const t = useT();
  return (
    <section>
      <h3 className="mb-2 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.ledgerTitle')}</h3>
      {isLoading ? (
        <p className="text-xs text-[#5A646D]">{t('accountant.common.loading')}</p>
      ) : !allocations || allocations.length === 0 ? (
        <p className="text-xs text-[#5A646D]">{t('accountant.invoices.ledgerEmpty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E4E7EA]">
          <table className="w-full text-xs">
            <thead className="bg-[#F8F9FA] text-left font-semibold uppercase tracking-wide text-[#5A646D]">
              <tr>
                <th className="px-3 py-2">{t('accountant.invoices.ledgerColType')}</th>
                <th className="px-3 py-2">{t('accountant.invoices.ledgerColTarget')}</th>
                <th className="px-3 py-2">{t('accountant.invoices.ledgerColAccount')}</th>
                <th className="px-3 py-2 text-right">{t('accountant.invoices.ledgerColAmount')}</th>
                <th className="px-3 py-2">{t('accountant.invoices.ledgerColOccurredAt')}</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((row) => (
                <tr key={row.id} className="border-t border-[#E4E7EA]">
                  <td className="px-3 py-2">{ENTRY_TYPE_LABEL[row.entry_type] ?? row.entry_type}</td>
                  <td className="px-3 py-2">{ALLOCATION_TARGET_LABEL[row.target] ?? row.target}</td>
                  <td className="px-3 py-2">
                    {row.account ?? (
                      <span className="italic text-[#9AA3AB]">{t('accountant.invoices.ledgerAccountSettledExternally')}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{formatMoney(row.amount)}</td>
                  <td className="px-3 py-2 font-mono">{formatDateTime(row.occurred_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ManualPaidFilingForm({ invoiceId }: { invoiceId: string }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useFileManualConfirmation();

  const canSubmit = amount.trim() !== '' && paidAt.trim() !== '' && file !== null && !mutation.isPending;

  async function submit() {
    if (!file) return;
    setUploadError(null);
    try {
      const uploaded = await uploadFile(file);
      mutation.mutate({
        invoice_id: invoiceId,
        amount: amount.trim(),
        paid_at: new Date(paidAt).toISOString(),
        bank_doc_file_id: uploaded.id,
      });
    } catch {
      setUploadError(t('accountant.invoices.manualPaidUploadFailed'));
    }
  }

  const filed = mutation.data;
  const error =
    mutation.error instanceof ApiError
      ? errorText(mutation.error)
      : mutation.isError
        ? t('accountant.invoices.manualPaidFailed')
        : null;

  return (
    <section className="rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] p-4">
      <h3 className="mb-1 text-sm font-bold text-[#1A1F24]">{t('accountant.invoices.manualPaidTitle')}</h3>
      <p className="mb-3 text-xs text-[#5A646D]">{t('accountant.invoices.manualPaidHint')}</p>

      {filed ? (
        <div className="space-y-3">
          <Alert variant="success">
            {filed.amount_matches_invoice
              ? t('accountant.invoices.manualPaidFiled')
              : t('accountant.invoices.manualPaidMismatch')}
          </Alert>
          <div className="rounded-lg border border-[#E4E7EA] bg-white p-3">
            <p className="text-xs font-semibold text-[#5A646D]">{t('accountant.invoices.manualPaidIdLabel')}</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-[#F8F9FA] px-2 py-1 text-xs">{filed.id}</code>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  void navigator.clipboard?.writeText(filed.id);
                  setCopied(true);
                }}
              >
                {copied ? t('accountant.common.copied') : t('accountant.common.copy')}
              </Button>
            </div>
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[#92400E]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('accountant.invoices.manualPaidShareHint')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <FormField label={t('accountant.invoices.manualPaidAmountLabel')} htmlFor="manual-paid-amount">
            <Input
              id="manual-paid-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </FormField>
          <FormField label={t('accountant.invoices.manualPaidPaidAtLabel')} htmlFor="manual-paid-paid-at">
            <Input
              id="manual-paid-paid-at"
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </FormField>
          <FormField label={t('accountant.invoices.manualPaidDocLabel')} htmlFor="manual-paid-doc">
            <input
              ref={fileInputRef}
              id="manual-paid-doc"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-[#5A646D] file:mr-3 file:rounded-md file:border-0 file:bg-[#F0F7F1] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#2E7D4F]"
            />
          </FormField>
          {uploadError && <Alert variant="danger">{uploadError}</Alert>}
          {error && <Alert variant="danger">{error}</Alert>}
          <Button
            variant="primary"
            size="sm"
            fullWidth
            disabled={!canSubmit}
            isLoading={mutation.isPending}
            onClick={() => void submit()}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('accountant.invoices.manualPaidSubmit')}
          </Button>
        </div>
      )}
    </section>
  );
}
