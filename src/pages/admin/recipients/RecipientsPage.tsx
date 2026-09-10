/**
 * Stage 7.9, task 9 — the receivers directory (decisions #154-#160).
 *
 * A payment's split is no longer hard-coded 50/50: each row here takes
 * either a PERCENT of every payment or a FIXED amount off the top, never
 * both (`kind` decides which of `percent`/`fixed_amount` a row carries). The
 * leshoz whose contour the application is for is never a row in this
 * table — it receives whatever nobody here took, which is why the parts
 * always add up. That remainder is rendered as a computed, non-editable row
 * (`leshoz-remainder`) so an administrator setting percentages always sees
 * what is left before saving, not after the server refuses a total above
 * 100% (`ERR-VAL-001 percent_total_exceeds_100`).
 *
 * Reachable only by a `payments.recipients.manage` holder — granted to no
 * role today, so in practice a superuser only (see `src/shell/navigation.ts`).
 * An accountant, who holds `payments.view` but not this code, sees the split
 * through the invoice instead (`InvoiceDetailDrawer.tsx`), never this page.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { ExportXlsxButton } from '../../../components/ui/ExportXlsxButton';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { formatMoney } from '../../permits/format';
import { pickName } from '../../applicant/format';
import type { PaymentRecipientIn, PaymentRecipientOut, RecipientKind } from './api';
import { useLabels, type RecipientLabels } from './labels';
import { useCreateRecipient, usePatchRecipient, useRecipientsList } from './queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

/** `50.00` -> `"50%"`, `12.50` -> `"12.5%"` — trailing zeros trimmed, the
 *  same reading `formatMoney` gives a whole so'm amount. */
function formatPercent(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return '—';
  return `${Math.round(num * 100) / 100}%`;
}

/** The sum of `percent` across every ACTIVE `kind: "percent"` row — the pool
 *  the leshoz's own remainder is computed against. Fixed-amount rows take a
 *  flat sum off the top and are not part of this percentage pool at all. */
function activePercentTotal(rows: PaymentRecipientOut[], excludeId?: string): number {
  return rows
    .filter((row) => row.active && row.kind === 'percent' && row.id !== excludeId)
    .reduce((sum, row) => sum + Number(row.percent ?? 0), 0);
}

/** The sum of `fixed_amount` across every ACTIVE `kind: "fixed"` row —
 *  `ledger.py::split_payment` takes every fixed amount off the top BEFORE
 *  the leshoz's remainder is what is left, on every payment regardless of
 *  its size. */
function activeFixedTotal(rows: PaymentRecipientOut[]): number {
  return rows
    .filter((row) => row.active && row.kind === 'fixed')
    .reduce((sum, row) => sum + Number(row.fixed_amount ?? 0), 0);
}

/**
 * A percentage alone cannot express what a fixed amount takes: percent is
 * always a share of the FULL payment (`split_payment`, never of "what is
 * left after fixed deductions"), so the leshoz's true share of money is
 * `remainderPercent% of the payment, minus every active fixed amount` — a
 * figure that depends on the payment's size, not a single number this
 * table could show in the percent column. `EXAMPLE_PAYMENT` is a round,
 * illustrative amount picked only to make that concrete for whoever is
 * reading this screen — never a real invoice, and large enough that a
 * realistic fixed configuration does not make the example go negative.
 */
const EXAMPLE_PAYMENT = 1_000_000;

function exampleLeshozShare(remainderPercent: number, fixedTotal: number): number {
  return (EXAMPLE_PAYMENT * remainderPercent) / 100 - fixedTotal;
}

export function RecipientsPage() {
  const L = useLabels();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();

  const [formTarget, setFormTarget] = useState<{ id: string | null } | null>(null);

  const list = useRecipientsList();
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const sorted = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);

  const percentTotal = activePercentTotal(items);
  const remainderPercent = 100 - percentTotal;
  const fixedTotal = activeFixedTotal(items);
  const missingPayme = items.filter((row) => row.active && !row.payme_account_id);

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="payment-recipients-page">
      <div className="border-b border-[#E4E7EA] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.pageTitle}</h1>
          <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-2xl">{L.pageSubtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportXlsxButton path="/api/v1/payments/recipients" query={{}} />
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setFormTarget({ id: null })}
          >
            {L.create}
          </Button>
        </div>
      </div>

      {missingPayme.length > 0 && (
        <div data-testid="missing-payme-id-warning">
          <Alert variant="warning">
            {L.missingPaymeWarning}{' '}
            {missingPayme.map((row) => pickName(row.name, lang)).join(', ')}
          </Alert>
        </div>
      )}

      {list.isPending && (
        <div className="flex items-center gap-2 text-sm text-[#5A646D]" data-testid="payment-recipients-loading">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      )}

      {list.isError && (
        <div className="rounded-2xl border border-[#F5C2C0] bg-[#FDF2F2] p-4 text-sm text-[#B42318]">
          {errorText(list.error, L.loadFailed)}
        </div>
      )}

      {list.data && sorted.length === 0 && (
        <div
          data-testid="payment-recipients-empty"
          className="bg-white border border-[#E4E7EA] rounded-2xl p-10 text-center space-y-2"
        >
          <p className="text-sm text-[#5A646D]">{L.empty}</p>
        </div>
      )}

      {list.data && (
        <div className="overflow-x-auto rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
              <tr>
                <th className="px-4 py-3">{L.colName}</th>
                <th className="px-4 py-3">{L.colRule}</th>
                <th className="px-4 py-3">{L.colPaymeId}</th>
                <th className="px-4 py-3">{L.colStatus}</th>
                <th className="px-4 py-3 text-right">{L.colSortOrder}</th>
                <th className="px-4 py-3 text-right">{L.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={row.id}
                  {...clickableRowProps(() => setFormTarget({ id: row.id }))}
                  className={`border-t border-[#E4E7EA] hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}`}
                  data-testid={`recipient-row-${row.id}`}
                >
                  <td className="px-4 py-3 font-semibold text-[#1A1F24]">{pickName(row.name, lang)}</td>
                  <td className="px-4 py-3 font-mono">
                    {row.kind === 'percent' ? formatPercent(row.percent ?? 0) : formatMoney(row.fixed_amount)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.payme_account_id ?? (
                      <span className="italic text-[#9AA3AB]">{L.paymeNotSet}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={row.active ? 'approved' : 'draft'}
                      label={row.active ? L.statusActive : L.statusInactive}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{row.sort_order}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => setFormTarget({ id: row.id })}>
                      {L.edit}
                    </Button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#E4E7EA] bg-[#F8F9FA]" data-testid="leshoz-remainder">
                <td className="px-4 py-3 font-semibold text-[#5A646D]">
                  {L.leshozRow}
                  <p className="text-xs font-normal text-[#9AA3AB]">{L.leshozRowHint}</p>
                </td>
                <td className="px-4 py-3 font-mono text-[#5A646D]">
                  {formatPercent(remainderPercent)}
                  {fixedTotal > 0 && (
                    <p
                      className="mt-1 max-w-xs whitespace-normal font-sans text-xs font-normal normal-case text-[#B45309]"
                      data-testid="leshoz-fixed-note"
                    >
                      {L.leshozFixedNotePrefix} {formatMoney(fixedTotal.toFixed(2))} {L.leshozFixedNoteSuffix}{' '}
                      {L.leshozExamplePrefix} {formatMoney(String(EXAMPLE_PAYMENT))} {L.leshozExampleMiddle}{' '}
                      {formatMoney(exampleLeshozShare(remainderPercent, fixedTotal).toFixed(2))} {L.leshozExampleSuffix}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {formTarget && (
        <RecipientFormModal
          recipientId={formTarget.id}
          rows={items}
          labels={L}
          onClose={() => setFormTarget(null)}
        />
      )}
    </div>
  );
}

interface FormState {
  nameUzLatn: string;
  nameRu: string;
  kind: RecipientKind;
  percent: string;
  fixedAmount: string;
  paymeAccountId: string;
  sortOrder: string;
  note: string;
  active: boolean;
}

function blankState(): FormState {
  return {
    nameUzLatn: '',
    nameRu: '',
    kind: 'percent',
    percent: '',
    fixedAmount: '',
    paymeAccountId: '',
    sortOrder: '0',
    note: '',
    active: true,
  };
}

function stateFrom(row: PaymentRecipientOut): FormState {
  const name = row.name as Record<string, unknown>;
  const text = (key: string) => (typeof name[key] === 'string' ? (name[key] as string) : '');
  return {
    nameUzLatn: text('uz_latn'),
    nameRu: text('ru'),
    kind: row.kind === 'fixed' ? 'fixed' : 'percent',
    percent: row.percent ?? '',
    fixedAmount: row.fixed_amount ?? '',
    paymeAccountId: row.payme_account_id ?? '',
    sortOrder: String(row.sort_order),
    note: row.note ?? '',
    active: row.active,
  };
}

function RecipientFormModal({
  recipientId,
  rows,
  labels: L,
  onClose,
}: {
  recipientId: string | null;
  rows: PaymentRecipientOut[];
  labels: RecipientLabels;
  onClose: () => void;
}) {
  const errorText = useApiErrorText();
  const editing = recipientId !== null ? rows.find((row) => row.id === recipientId) ?? null : null;
  const initial = editing ? stateFrom(editing) : blankState();

  const [form, setForm] = useState<FormState>(initial);
  const [invalid, setInvalid] = useState<string | null>(null);

  const create = useCreateRecipient();
  const patch = usePatchRecipient(recipientId);
  const saving = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** The same check the server makes (`ERR-VAL-001
   *  percent_total_exceeds_100`), run here so a bad total never leaves the
   *  browser. Every OTHER active percent row counts; this row's OWN previous
   *  value never does, so editing a row's own percent down is never blocked
   *  by the number it is replacing. */
  function prospectivePercentTotal(): number {
    const others = activePercentTotal(rows, recipientId ?? undefined);
    if (form.kind !== 'percent' || !form.active) return others;
    return others + Number(form.percent || 0);
  }

  function submit() {
    if (!form.nameUzLatn.trim()) return setInvalid(L.errNameRequired);
    if (form.kind === 'percent' && !form.percent.trim()) return setInvalid(L.errPercentRequired);
    if (form.kind === 'fixed' && !form.fixedAmount.trim()) return setInvalid(L.errFixedRequired);
    if (prospectivePercentTotal() > 100) return setInvalid(L.errPercentExceeds100);
    setInvalid(null);

    const name = { uz_latn: form.nameUzLatn.trim(), ...(form.nameRu.trim() ? { ru: form.nameRu.trim() } : {}) };
    const paymeAccountId = form.paymeAccountId.trim() || null;
    const sortOrder = Number.parseInt(form.sortOrder, 10) || 0;
    const note = form.note.trim() || null;

    if (recipientId) {
      // `kind` is locked on edit, and the backend refuses the OTHER kind's
      // amount key even as `null` (`invalid_percent_for_recipient_kind` /
      // `invalid_fixed_amount_for_recipient_kind`): a PATCH body carries
      // only the field the row's own kind is allowed to hold.
      patch.mutate(
        {
          name,
          payme_account_id: paymeAccountId,
          ...(form.kind === 'percent'
            ? { percent: form.percent.trim() }
            : { fixed_amount: form.fixedAmount.trim() }),
          sort_order: sortOrder,
          note,
          active: form.active,
        },
        { onSuccess: onClose },
      );
      return;
    }

    const body: PaymentRecipientIn = {
      name,
      payme_account_id: paymeAccountId,
      kind: form.kind,
      percent: form.kind === 'percent' ? form.percent.trim() : null,
      fixed_amount: form.kind === 'fixed' ? form.fixedAmount.trim() : null,
      sort_order: sortOrder,
      note,
    };
    create.mutate(body, { onSuccess: onClose });
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={recipientId ? L.formEditTitle : L.formCreateTitle}
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {L.cancel}
          </Button>
          <Button variant="primary" size="sm" disabled={saving} onClick={submit}>
            {L.save}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={L.fieldName} required htmlFor="recipient-name-uz_latn">
            <Input
              id="recipient-name-uz_latn"
              data-testid="recipient-name-uz_latn"
              value={form.nameUzLatn}
              onChange={(e) => set('nameUzLatn', e.target.value)}
            />
          </FormField>
          <FormField label={L.fieldNameRu} htmlFor="recipient-name-ru">
            <Input
              id="recipient-name-ru"
              data-testid="recipient-name-ru"
              value={form.nameRu}
              onChange={(e) => set('nameRu', e.target.value)}
            />
          </FormField>
        </div>

        <FormField label={L.fieldKind} htmlFor="recipient-kind">
          <Select
            id="recipient-kind"
            data-testid="recipient-kind"
            value={form.kind}
            disabled={recipientId !== null}
            onChange={(e) => set('kind', e.target.value as RecipientKind)}
            options={[
              { value: 'percent', label: L.kindPercent },
              { value: 'fixed', label: L.kindFixed },
            ]}
          />
        </FormField>

        {form.kind === 'percent' ? (
          <FormField label={L.fieldPercent} required htmlFor="recipient-percent">
            <Input
              id="recipient-percent"
              data-testid="recipient-percent"
              inputMode="decimal"
              value={form.percent}
              onChange={(e) => set('percent', e.target.value)}
              placeholder="0.00"
            />
          </FormField>
        ) : (
          <FormField label={L.fieldFixedAmount} required htmlFor="recipient-fixed-amount">
            <Input
              id="recipient-fixed-amount"
              data-testid="recipient-fixed-amount"
              inputMode="decimal"
              value={form.fixedAmount}
              onChange={(e) => set('fixedAmount', e.target.value)}
              placeholder="0.00"
            />
          </FormField>
        )}

        <FormField label={L.fieldPaymeAccountId} helperText={L.fieldPaymeAccountIdHint} htmlFor="recipient-payme-id">
          <Input
            id="recipient-payme-id"
            data-testid="recipient-payme-id"
            value={form.paymeAccountId}
            onChange={(e) => set('paymeAccountId', e.target.value)}
          />
        </FormField>

        <FormField label={L.fieldSortOrder} htmlFor="recipient-sort-order">
          <Input
            id="recipient-sort-order"
            data-testid="recipient-sort-order"
            type="number"
            value={form.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
          />
        </FormField>

        <FormField label={L.fieldNote} htmlFor="recipient-note">
          <Textarea id="recipient-note" data-testid="recipient-note" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </FormField>

        {recipientId !== null && (
          <label className="flex items-center gap-2 text-sm text-[#1A1F24]">
            <input
              type="checkbox"
              data-testid="recipient-active"
              checked={form.active}
              onChange={(e) => set('active', e.target.checked)}
            />
            {L.fieldActive}
          </label>
        )}

        {invalid && (
          <p data-testid="recipient-form-error" className="text-sm text-[#B42318] bg-[#FDF2F2] border border-[#F5C2C0] rounded-lg p-3">
            {invalid}
          </p>
        )}
        {failure != null && (
          <p data-testid="recipient-save-error" className="text-sm text-[#B42318] bg-[#FDF2F2] border border-[#F5C2C0] rounded-lg p-3">
            {failure instanceof ApiError ? errorText(failure, L.errSaveFailed) : L.errSaveFailed}
          </p>
        )}
      </div>
    </Modal>
  );
}
