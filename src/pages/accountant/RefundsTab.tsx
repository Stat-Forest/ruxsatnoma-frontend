import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Overlay';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDate, formatDateTime, formatMoney } from '../permits/format';
import { pickName } from '../applicant/format';
import { REFUND_STATUS_STYLE, getRefundStatusLabel } from './statusMeta';
import type { AvailableSourceOut, RefundOut } from './api';
import { useApproveRefund, useRefund, useRefunds, useRequestRefund, useSubmitRefundDecision } from './queries';

const PAYMENTS_VIEW = 'payments.view';
const PAYMENTS_MANAGE = 'payments.manage';
const PAYMENTS_CONFIRM = 'payments.confirm';

/** The four seeded `refund_reasons` classifier items (migration 0022) —
 *  hard-coded here rather than fetched, the same way `MyInvoicePage.tsx`
 *  hard-codes `provider: 'payme'`: these codes are the classifier's whole
 *  content today, and `GET /refs/classifiers/{code}/items` for
 *  `refund_reasons` would be one more round trip to list four rows that do
 *  not change per zone or per user. Labels are UZ (uz_cyrl in the seed),
 *  transliterated to the UI's own uz_latn since this classifier has no
 *  translated set yet — an accountant reads the reason, not the code. */
const REFUND_BASIS_OPTIONS = [
  { value: 'RF-01', labelKey: 'accountant.refunds.basisRevoked' },
  { value: 'RF-02', labelKey: 'accountant.refunds.basisUnusedPeriod' },
  { value: 'RF-03', labelKey: 'accountant.refunds.basisOverpayment' },
  { value: 'RF-04', labelKey: 'accountant.refunds.basisBenefit' },
] as const;

type StatusFilter = '' | 'requested' | 'in_review' | 'returned' | 'rejected';

/**
 * G5 — refunds. `POST /refunds` itself carries no permission gate on the
 * backend (an applicant appeals their own application, or staff files on
 * anyone's behalf — ownership is checked in the service, not by a
 * dependency) but this screen still shows "new request" only to a
 * `payments.manage` holder: filing on someone else's behalf is the
 * accountant's own job per the plan, not something to hand every role that
 * merely opens this page (an editorial choice, not a backend requirement —
 * `06.5-accountant.md`'s report names the cost if this reading is wrong).
 *
 * `GET /refunds` requires `payments.view` (`refunds_router.py`) —
 * `executor_head` (the approver, holding only `payments.confirm`) does NOT
 * have it. Re-verified against the current source 2026-09-05 after the
 * backend worktree turned out to be 53 commits stale when this screen was
 * first built: the register below only mounts (and only then fires
 * `GET /refunds`) for a `payments.view` holder. A `payments.confirm`-only
 * holder gets `ApproveByIdPanel` instead — the same id-handoff shape ruling
 * R2 already uses for the manual-PAID checker, extended here because the
 * same structural gap applies: no route lets that role discover which
 * refund is `in_review` on its own.
 */
export function RefundsTab() {
  const t = useT();
  const { me } = useAuth();
  const canView = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_VIEW));
  const canFile = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_MANAGE));
  const canApprove = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_CONFIRM));

  return (
    <div className="space-y-5" data-testid="refunds-tab">
      {canView ? (
        <RefundsRegister canFile={canFile} canApprove={canApprove} />
      ) : canApprove ? (
        <ApproveByIdPanel />
      ) : (
        <Alert variant="info">{t('accountant.refunds.noViewAccess')}</Alert>
      )}
    </div>
  );
}

function RefundsRegister({ canFile, canApprove }: { canFile: boolean; canApprove: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const canDecide = canFile;

  const [status, setStatus] = useState<StatusFilter>('');
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<RefundOut | null>(null);
  const [approveTarget, setApproveTarget] = useState<RefundOut | null>(null);

  const query = useRefunds({ status: status || undefined, limit: 100, offset: 0 });

  return (
    <>
      <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7EA] p-4">
          <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.refunds.title')}</h2>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <Select
              className="w-full sm:w-auto"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              options={[
                { value: '', label: t('accountant.refunds.filterAll') },
                { value: 'requested', label: getRefundStatusLabel('requested', lang) },
                { value: 'in_review', label: getRefundStatusLabel('in_review', lang) },
                { value: 'returned', label: getRefundStatusLabel('returned', lang) },
                { value: 'rejected', label: getRefundStatusLabel('rejected', lang) },
              ]}
            />
            {canFile && (
              <Button size="sm" className="w-full sm:w-auto" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setNewRequestOpen(true)}>
                {t('accountant.refunds.newRequest')}
              </Button>
            )}
          </div>
        </div>

        {query.isLoading ? (
          <p className="p-4 text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
        ) : query.isError ? (
          <div className="p-4">
            <Alert variant="danger">{t('accountant.refunds.loadFailed')}</Alert>
          </div>
        ) : query.data!.items.length === 0 ? (
          <p className="p-4 text-sm text-[#5A646D]">{t('accountant.refunds.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px] whitespace-nowrap">
              <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
                <tr>
                  <th className="px-4 py-3">{t('accountant.refunds.colApplication')}</th>
                  <th className="px-4 py-3 text-right">{t('accountant.refunds.colSuggested')}</th>
                  <th className="px-4 py-3 text-right">{t('accountant.refunds.colFinal')}</th>
                  <th className="px-4 py-3">{t('accountant.refunds.colStatus')}</th>
                  <th className="px-4 py-3">{t('accountant.refunds.colDue')}</th>
                  <th className="px-4 py-3">{t('accountant.refunds.colRequestedAt')}</th>
                  <th className="px-4 py-3 text-right">{t('accountant.discrepancies.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {query.data!.items.map((refund) => (
                  <tr key={refund.id} className="border-t border-[#E4E7EA]" data-testid={`refund-row-${refund.id}`}>
                    <td className="px-4 py-3 font-mono text-xs" title={refund.application_id}>
                      {refund.application_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {refund.suggested_amount ? formatMoney(refund.suggested_amount) : t('accountant.refunds.noSuggestion')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{refund.final_amount ? formatMoney(refund.final_amount) : '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                          REFUND_STATUS_STYLE[refund.status] ?? REFUND_STATUS_STYLE.requested
                        }`}
                      >
                        {getRefundStatusLabel(refund.status, lang)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDate(refund.due_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatDateTime(refund.requested_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {canDecide && refund.status === 'requested' && (
                        <Button size="sm" variant="outline" onClick={() => setDecisionTarget(refund)}>
                          {t('accountant.refunds.decisionTitle')}
                        </Button>
                      )}
                      {canApprove && refund.status === 'in_review' && (
                        <Button size="sm" variant="outline" onClick={() => setApproveTarget(refund)}>
                          {t('accountant.refunds.approveTitle')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {newRequestOpen && <NewRequestModal onClose={() => setNewRequestOpen(false)} />}
      {decisionTarget && <DecisionModal refund={decisionTarget} onClose={() => setDecisionTarget(null)} />}
      {approveTarget && <ApproveModal refund={approveTarget} onClose={() => setApproveTarget(null)} />}
    </>
  );
}

/**
 * The `payments.confirm`-only fallback (ruling R2, extended to refunds):
 * approve or reject a refund by id, with no row ever loaded — `GET /refunds`
 * is not open to this role at all, so there is nothing to show beside the
 * id except what the two mutation responses themselves carry.
 */
function ApproveByIdPanel() {
  const t = useT();
  const errorText = useApiErrorText();
  const [refundId, setRefundId] = useState('');
  const [comment, setComment] = useState('');
  const mutation = useApproveRefund();

  const error =
    mutation.error instanceof ApiError ? errorText(mutation.error) : mutation.isError ? t('accountant.refunds.approveFailed') : null;
  const result = mutation.data;

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs" data-testid="refund-approve-by-id-panel">
      <h2 className="mb-1 text-sm font-bold text-[#1A1F24]">{t('accountant.refunds.approveTitle')}</h2>
      <p className="mb-3 text-xs text-[#5A646D]">{t('accountant.refunds.approveByIdHint')}</p>

      <FormField label={t('accountant.refunds.refundIdLabel')} htmlFor="refund-approve-id">
        <Input
          id="refund-approve-id"
          value={refundId}
          onChange={(e) => {
            setRefundId(e.target.value);
            mutation.reset();
          }}
          placeholder="UUID"
        />
      </FormField>

      {!result && (
        <FormField label={t('accountant.refunds.approveCommentLabel')} htmlFor="refund-approve-by-id-comment" className="mt-3">
          <Textarea id="refund-approve-by-id-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
      )}

      {error && (
        <div className="mt-3">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      {result && (
        <div className="mt-3">
          <Alert variant={result.status === 'returned' ? 'success' : 'warning'}>
            {result.status === 'returned' ? t('accountant.refunds.approvedReturned') : t('accountant.refunds.approvedRejected')}
          </Alert>
        </div>
      )}

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Button
          variant="danger"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!refundId.trim()}
          isLoading={mutation.isPending && mutation.variables?.resolution === 'rejected'}
          onClick={() => mutation.mutate({ id: refundId.trim(), resolution: 'rejected', comment: comment.trim() || null })}
        >
          {t('accountant.refunds.approveReject')}
        </Button>
        <Button
          variant="success"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!refundId.trim()}
          isLoading={mutation.isPending && mutation.variables?.resolution === 'returned'}
          onClick={() => mutation.mutate({ id: refundId.trim(), resolution: 'returned', comment: comment.trim() || null })}
        >
          {t('accountant.refunds.approveReturn')}
        </Button>
      </div>
    </section>
  );
}

function NewRequestModal({ onClose }: { onClose: () => void }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [applicationId, setApplicationId] = useState('');
  const [basisItemId, setBasisItemId] = useState<string>(REFUND_BASIS_OPTIONS[0].value);
  const [comment, setComment] = useState('');
  const mutation = useRequestRefund();

  const error =
    mutation.error instanceof ApiError
      ? mutation.error.code === 'ERR-SYS-003'
        ? t('accountant.refunds.requestNotFound')
        : errorText(mutation.error)
      : mutation.isError
        ? t('accountant.refunds.requestFailed')
        : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('accountant.refunds.newRequest')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('accountant.common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!applicationId.trim()}
            isLoading={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { application_id: applicationId.trim(), basis_item_id: basisItemId, comment: comment.trim() || null },
                { onSuccess: onClose },
              )
            }
          >
            {t('accountant.refunds.submitRequest')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label={t('accountant.refunds.applicationIdLabel')} required htmlFor="refund-application-id">
          <Input id="refund-application-id" value={applicationId} onChange={(e) => setApplicationId(e.target.value)} placeholder="UUID" />
        </FormField>
        <FormField label={t('accountant.refunds.basisLabel')} htmlFor="refund-basis">
          <Select
            id="refund-basis"
            value={basisItemId}
            onChange={(e) => setBasisItemId(e.target.value)}
            options={REFUND_BASIS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
          />
        </FormField>
        <FormField label={t('accountant.refunds.commentLabel')} htmlFor="refund-comment">
          <Textarea id="refund-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

/** `null` (the leshoz's own remainder, `AvailableSourceOut.recipient_id`) is
 *  not usable as a React key or an object key on its own — this gives it a
 *  stable string stand-in, local to this form. */
function sourceKey(source: { recipient_id: string | null }): string {
  return source.recipient_id ?? '__leshoz__';
}

/** Money as fixed-scale-NUMERIC integer cents — comparing two decimal
 *  STRINGS for equality has to go through this, never a float `===`, the
 *  same reasoning `api.ts`'s own header gives for never parsing an amount
 *  through `Number()` for anything but display. */
function toCents(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) : 0;
}

function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function DecisionModal({ refund, onClose }: { refund: RefundOut; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const detail = useRefund(refund.id);
  const [finalAmount, setFinalAmount] = useState(refund.suggested_amount ?? '');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const mutation = useSubmitRefundDecision();

  const sources: AvailableSourceOut[] = detail.data?.available_sources ?? [];
  const amountFor = (key: string) => amounts[key] ?? '0.00';
  const setAmount = (key: string, value: string) => setAmounts((prev) => ({ ...prev, [key]: value }));

  const totalCents = sources.reduce((sum, source) => sum + toCents(amountFor(sourceKey(source))), 0);
  const finalCents = toCents(finalAmount);
  // Nothing to compare against an empty/blank amount — the submit stays
  // disabled rather than reading a blank field as "zero and therefore equal".
  const matches = finalAmount.trim() !== '' && sources.length > 0 && totalCents === finalCents;

  const error =
    mutation.error instanceof ApiError ? errorText(mutation.error) : mutation.isError ? t('accountant.refunds.decisionFailed') : null;

  function submit() {
    const components = sources.map((source) => ({ recipient_id: source.recipient_id, amount: amountFor(sourceKey(source)) }));
    mutation.mutate(
      { id: refund.id, final_amount: finalAmount.trim(), components, comment: comment.trim() || null },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('accountant.refunds.decisionTitle')}
      subtitle={
        refund.suggested_amount
          ? `${t('accountant.refunds.suggestedAmountHint')}: ${formatMoney(refund.suggested_amount)}`
          : refund.suggestion_reason ?? undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('accountant.common.cancel')}
          </Button>
          <Button variant="primary" disabled={!matches || mutation.isPending} isLoading={mutation.isPending} onClick={submit}>
            {t('accountant.refunds.decisionSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label={t('accountant.refunds.finalAmountLabel')} required htmlFor="refund-final-amount">
          <Input id="refund-final-amount" inputMode="decimal" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
        </FormField>

        {detail.isLoading ? (
          <p className="text-xs text-[#5A646D]">{t('accountant.common.loading')}</p>
        ) : sources.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t('accountant.refunds.noSources')}</p>
        ) : (
          <div className="space-y-3" data-testid="refund-components">
            {/* One row per `available_sources` entry — the invoice's OWN
             *  frozen split (stage 7.9 task 7), replacing the old fixed
             *  budget/recipient/other trio; a directory of any size does not
             *  fit three named buckets. The leshoz's own remainder is just
             *  the LAST row here (`kind === "remainder"`), not a special case. */}
            {sources.map((source) => {
              const key = sourceKey(source);
              return (
                <FormField key={key} label={pickName(source.name, lang)} htmlFor={`refund-component-${key}`}>
                  <Input
                    id={`refund-component-${key}`}
                    data-testid={`refund-component-${key}`}
                    inputMode="decimal"
                    value={amountFor(key)}
                    onChange={(e) => setAmount(key, e.target.value)}
                  />
                </FormField>
              );
            })}
            <div
              data-testid="refund-components-total"
              className={`flex justify-between rounded-lg px-3 py-2 text-xs font-mono ${
                matches ? 'bg-[#F0F7F1] text-[#15803D]' : 'bg-[#FDF2F2] text-[#B91C1C]'
              }`}
            >
              <span>{t('accountant.refunds.componentsTotalLabel')}</span>
              <span>{formatMoney(centsToAmount(totalCents))}</span>
            </div>
            {!matches && <p className="text-xs text-[#B91C1C]">{t('accountant.refunds.componentsMismatchHint')}</p>}
          </div>
        )}

        <FormField label={t('accountant.refunds.decisionCommentLabel')} htmlFor="refund-decision-comment">
          <Textarea id="refund-decision-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
        </FormField>
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function ApproveModal({ refund, onClose }: { refund: RefundOut; onClose: () => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [comment, setComment] = useState('');
  const mutation = useApproveRefund();

  const error =
    mutation.error instanceof ApiError ? errorText(mutation.error) : mutation.isError ? t('accountant.refunds.approveFailed') : null;
  const result = mutation.data;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('accountant.refunds.approveTitle')}
      subtitle={`${t('accountant.refunds.finalAmountLabel')}: ${refund.final_amount ? formatMoney(refund.final_amount) : '—'}`}
      footer={
        result ? (
          <Button variant="outline" onClick={onClose}>
            {t('accountant.common.close')}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t('accountant.common.cancel')}
            </Button>
            <Button
              variant="danger"
              isLoading={mutation.isPending && mutation.variables?.resolution === 'rejected'}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ id: refund.id, resolution: 'rejected', comment: comment.trim() || null })}
            >
              {t('accountant.refunds.approveReject')}
            </Button>
            <Button
              variant="success"
              isLoading={mutation.isPending && mutation.variables?.resolution === 'returned'}
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ id: refund.id, resolution: 'returned', comment: comment.trim() || null })}
            >
              {t('accountant.refunds.approveReturn')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <Alert variant={result.status === 'returned' ? 'success' : 'warning'}>
            {result.status === 'returned' ? t('accountant.refunds.approvedReturned') : t('accountant.refunds.approvedRejected')}
          </Alert>
          {result.status === 'returned' && result.components && result.components.length > 0 && (
            <ul className="space-y-1 text-xs">
              {result.components.map((component, i) => (
                <li key={i} className="flex justify-between rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] px-3 py-2">
                  <span>{pickName(component.name, lang)}</span>
                  <span className="font-mono">{formatMoney(component.amount)}</span>
                  <span className="text-[#9AA3AB]">
                    {component.account ?? t('accountant.invoices.ledgerAccountSettledExternally')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <FormField label={t('accountant.refunds.approveCommentLabel')} htmlFor="refund-approve-comment">
            <Textarea id="refund-approve-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </FormField>
          {error && <Alert variant="danger">{error}</Alert>}
        </div>
      )}
    </Modal>
  );
}
