import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Textarea } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Overlay';
import { Alert } from '../../components/ui/Feedback';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDateTime, formatMoney } from '../permits/format';
import {
  RECONCILIATION_STATUS_STYLE,
  getReconciliationResultLabel,
  getReconciliationStatusLabel,
} from './statusMeta';
import { fileUrl, uploadFile, type ManualConfirmationOut, type ReconciliationOut } from './api';
import {
  useConfirmManualConfirmation,
  useManualConfirmations,
  useReconciliations,
  useRejectManualConfirmation,
  useResolveReconciliation,
} from './queries';

const PAYMENTS_VIEW = 'payments.view';
const PAYMENTS_MANAGE = 'payments.manage';
const PAYMENTS_CONFIRM = 'payments.confirm';

/**
 * G4 — the discrepancy register (`GET /payments/reconciliations`, resolved
 * with a comment) plus the manual-PAID CHECKER half of the maker-checker
 * flow the invoice detail drawer's filing form starts (`06.5-accountant.md`
 * ruling R2): confirm/reject by id, since no route lists pending ones.
 *
 * `GET /payments/reconciliations` requires `payments.view`
 * (`backoffice_router.py`) — a code `executor_head` (the checker, holding
 * only `payments.confirm`) does NOT have. Re-verified against the current
 * source 2026-09-05 after the backend worktree turned out to be 53 commits
 * stale when this screen was first built. The register is therefore gated
 * on `payments.view` here: rendering it unconditionally to whoever reaches
 * this tab (which `06.5-accountant.md` ruling R4 widened to include
 * `executor_head`) would fire a query the backend refuses on load, not on
 * an offered action — the same house rule, one query earlier than a button.
 */
export function DiscrepanciesTab() {
  const t = useT();
  const { me } = useAuth();
  const canView = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_VIEW));
  const canResolve = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_MANAGE));
  const canCheck = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_CONFIRM));

  return (
    <div className="space-y-5" data-testid="discrepancies-tab">
      {canView ? (
        <ReconciliationRegister canResolve={canResolve} />
      ) : (
        <Alert variant="info">{t('accountant.discrepancies.noViewAccess')}</Alert>
      )}
      {canCheck && <ManualConfirmationCheckPanel />}
    </div>
  );
}

function ReconciliationRegister({ canResolve }: { canResolve: boolean }) {
  const t = useT();
  const { lang } = useLanguage();
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [resolveTarget, setResolveTarget] = useState<ReconciliationOut | null>(null);
  const query = useReconciliations({ status, limit: 100, offset: 0 });

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
      <div className="flex items-center justify-between gap-2 border-b border-[#E4E7EA] p-4">
        <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.discrepancies.title')}</h2>
        <div className="flex gap-1">
          <Button size="sm" variant={status === 'open' ? 'primary' : 'outline'} onClick={() => setStatus('open')}>
            {t('accountant.discrepancies.filterOpen')}
          </Button>
          <Button size="sm" variant={status === 'resolved' ? 'primary' : 'outline'} onClick={() => setStatus('resolved')}>
            {t('accountant.discrepancies.filterResolved')}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <p className="p-4 text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
      ) : query.isError ? (
        <div className="p-4">
          <Alert variant="danger">{t('accountant.discrepancies.loadFailed')}</Alert>
        </div>
      ) : query.data!.items.length === 0 ? (
        <p className="p-4 text-sm text-[#5A646D]">{t('accountant.discrepancies.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
              <tr>
                <th className="px-4 py-3">{t('accountant.discrepancies.colInvoice')}</th>
                <th className="px-4 py-3">{t('accountant.discrepancies.colResult')}</th>
                <th className="px-4 py-3 text-right">{t('accountant.discrepancies.colDifference')}</th>
                <th className="px-4 py-3">{t('accountant.discrepancies.colStatus')}</th>
                <th className="px-4 py-3">{t('accountant.discrepancies.colOccurredAt')}</th>
                <th className="px-4 py-3">{t('accountant.discrepancies.colComment')}</th>
                {canResolve && <th className="px-4 py-3 text-right">{t('accountant.discrepancies.colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {query.data!.items.map((row) => (
                <tr key={row.id} className="border-t border-[#E4E7EA]" data-testid={`reconciliation-row-${row.id}`}>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.invoice_id
                      ? row.invoice_id.slice(0, 8)
                      : <span className="italic text-[#9AA3AB]">{t('accountant.discrepancies.periodNote')}</span>}
                  </td>
                  <td className="px-4 py-3">{getReconciliationResultLabel(row.result, lang)}</td>
                  <td className="px-4 py-3 text-right font-mono">{row.difference ? formatMoney(row.difference) : '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                        RECONCILIATION_STATUS_STYLE[row.status] ?? RECONCILIATION_STATUS_STYLE.open
                      }`}
                    >
                      {getReconciliationStatusLabel(row.status, lang)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateTime(row.occurred_at)}</td>
                  <td className="px-4 py-3 text-xs text-[#5A646D]">{row.comment ?? '—'}</td>
                  {canResolve && (
                    <td className="px-4 py-3 text-right">
                      {row.status === 'open' && (
                        <Button size="sm" variant="outline" onClick={() => setResolveTarget(row)}>
                          {t('accountant.discrepancies.resolveButton')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {resolveTarget && <ResolveModal row={resolveTarget} onClose={() => setResolveTarget(null)} />}
    </section>
  );
}

function ResolveModal({ row, onClose }: { row: ReconciliationOut; onClose: () => void }) {
  const t = useT();
  const errorText = useApiErrorText();
  const [comment, setComment] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const mutation = useResolveReconciliation();

  async function submit() {
    if (!comment.trim()) return;
    setUploadError(null);
    try {
      const resolutionDocId = file ? (await uploadFile(file)).id : null;
      mutation.mutate(
        { id: row.id, comment: comment.trim(), resolutionDocId },
        { onSuccess: onClose },
      );
    } catch {
      setUploadError(t('accountant.discrepancies.resolveUploadFailed'));
    }
  }

  const error =
    mutation.error instanceof ApiError
      ? errorText(mutation.error)
      : mutation.isError
        ? t('accountant.discrepancies.resolveFailed')
        : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('accountant.discrepancies.resolveTitle')}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {t('accountant.common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!comment.trim()} isLoading={mutation.isPending}>
            {t('accountant.discrepancies.resolveSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label={t('accountant.discrepancies.resolveCommentLabel')} required htmlFor="resolve-comment">
          <Textarea id="resolve-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
        </FormField>
        <FormField label={t('accountant.discrepancies.resolveDocLabel')} htmlFor="resolve-doc">
          <input
            id="resolve-doc"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#5A646D] file:mr-3 file:rounded-md file:border-0 file:bg-[#F0F7F1] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#2E7D4F]"
          />
        </FormField>
        {uploadError && <Alert variant="danger">{uploadError}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

function ManualConfirmationCheckPanel() {
  const t = useT();
  const errorText = useApiErrorText();
  const [confirmationId, setConfirmationId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);

  const pendingQuery = useManualConfirmations({ status: 'pending_check', limit: 50, offset: 0 });
  const confirmMutation = useConfirmManualConfirmation();
  const rejectMutation = useRejectManualConfirmation();

  const result = confirmMutation.data ?? rejectMutation.data;
  const error =
    confirmMutation.error instanceof ApiError
      ? confirmMutation.error
      : rejectMutation.error instanceof ApiError
        ? rejectMutation.error
        : null;

  function reset() {
    confirmMutation.reset();
    rejectMutation.reset();
  }

  /** F12b — a row's own "Tasdiqlash" acts directly on that row's id, the
   *  same route the manual-id form below submits to. */
  function confirmRow(id: string) {
    reset();
    setShowReject(false);
    confirmMutation.mutate(id);
  }

  /** A rejection always needs a reason, so a row's own "Rad etish" cannot be
   *  one click — it selects that row into the id field below (the checker
   *  sees which one they are about to reject) and opens the reason box,
   *  reusing the exact same submit path a typed-in id already uses. */
  function startRejectRow(id: string) {
    reset();
    setConfirmationId(id);
    setRejectReason('');
    setShowReject(true);
  }

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs" data-testid="manual-check-panel">
      <h2 className="mb-1 text-sm font-bold text-[#1A1F24]">{t('accountant.discrepancies.manualCheckTitle')}</h2>
      <p className="mb-3 text-xs text-[#5A646D]">{t('accountant.discrepancies.manualCheckHint')}</p>

      <ManualConfirmationsPendingList
        query={pendingQuery}
        onConfirm={confirmRow}
        onReject={startRejectRow}
        confirmingId={confirmMutation.isPending ? confirmMutation.variables ?? null : null}
      />

      <p className="mb-2 text-xs font-semibold text-[#5A646D]">{t('accountant.discrepancies.manualByIdHint')}</p>

      <FormField label={t('accountant.discrepancies.manualConfirmationIdLabel')} htmlFor="manual-check-id">
        <Input
          id="manual-check-id"
          value={confirmationId}
          onChange={(e) => {
            setConfirmationId(e.target.value);
            reset();
          }}
          placeholder="UUID"
        />
      </FormField>

      {showReject && (
        <FormField label={t('accountant.discrepancies.manualRejectReasonLabel')} htmlFor="manual-reject-reason" className="mt-3" required>
          <Textarea id="manual-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} />
        </FormField>
      )}

      {error && (
        <div className="mt-3">
          <Alert variant="danger">
            {error.code === 'ERR-ACL-001' ? t('accountant.discrepancies.manualCheckMakerIsChecker') : errorText(error)}
          </Alert>
        </div>
      )}
      {result && (
        <div className="mt-3">
          <Alert variant="success">
            {result.status === 'confirmed' ? t('accountant.discrepancies.manualConfirmed') : t('accountant.discrepancies.manualRejected')}
          </Alert>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          leftIcon={<CheckCircle2 className="h-4 w-4" />}
          disabled={!confirmationId.trim()}
          isLoading={confirmMutation.isPending}
          onClick={() => confirmMutation.mutate(confirmationId.trim())}
        >
          {t('accountant.discrepancies.manualConfirmButton')}
        </Button>
        {!showReject ? (
          <Button variant="danger" size="sm" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => setShowReject(true)}>
            {t('accountant.discrepancies.manualRejectButton')}
          </Button>
        ) : (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<XCircle className="h-4 w-4" />}
            disabled={!confirmationId.trim() || !rejectReason.trim()}
            isLoading={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({ id: confirmationId.trim(), reason: rejectReason.trim() })}
          >
            {t('accountant.discrepancies.manualRejectSubmit')}
          </Button>
        )}
      </div>
    </section>
  );
}

/**
 * F12b — the checker's own worklist (`GET /payments/manual-confirmations`,
 * defaults to `pending_check`), replacing the id the checker used to have
 * to be handed out of band. `bank_doc_file_id` is the whole legal basis of
 * a manual PAID (`ManualConfirmationOut`'s own docstring) — linked here via
 * `fileUrl`, not just named, now that F13 made the read reachable to a
 * `payments.confirm` holder.
 */
function ManualConfirmationsPendingList({
  query,
  onConfirm,
  onReject,
  confirmingId,
}: {
  query: ReturnType<typeof useManualConfirmations>;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  confirmingId: string | null;
}) {
  const t = useT();

  if (query.isLoading) {
    return <p className="mb-4 text-xs text-[#5A646D]">{t('accountant.common.loading')}</p>;
  }
  if (query.isError) {
    return (
      <div className="mb-4">
        <Alert variant="danger">{t('accountant.discrepancies.manualPendingLoadFailed')}</Alert>
      </div>
    );
  }
  if (query.data!.items.length === 0) {
    return <p className="mb-4 text-xs text-[#5A646D]">{t('accountant.discrepancies.manualPendingEmpty')}</p>;
  }

  return (
    <div className="mb-4 overflow-x-auto rounded-xl border border-[#E4E7EA]">
      <table className="w-full text-xs">
        <thead className="bg-[#F8F9FA] text-left font-bold uppercase tracking-wide text-[#5A646D]">
          <tr>
            <th className="px-3 py-2 text-right">{t('accountant.discrepancies.manualPendingColAmount')}</th>
            <th className="px-3 py-2">{t('accountant.discrepancies.manualPendingColPaidAt')}</th>
            <th className="px-3 py-2">{t('accountant.discrepancies.manualPendingColDoc')}</th>
            <th className="px-3 py-2 text-right">{t('accountant.discrepancies.manualPendingColActions')}</th>
          </tr>
        </thead>
        <tbody>
          {query.data!.items.map((row: ManualConfirmationOut) => (
            <tr key={row.id} className="border-t border-[#E4E7EA]" data-testid={`manual-confirmation-row-${row.id}`}>
              <td className="px-3 py-2 text-right font-mono">{formatMoney(row.amount)}</td>
              <td className="px-3 py-2 font-mono">{formatDateTime(row.paid_at)}</td>
              <td className="px-3 py-2">
                <a
                  href={fileUrl(row.bank_doc_file_id)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#2E7D4F] hover:underline"
                >
                  {t('accountant.discrepancies.manualPendingViewDoc')}
                </a>
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="success"
                    isLoading={confirmingId === row.id}
                    onClick={() => onConfirm(row.id)}
                  >
                    {t('accountant.discrepancies.manualConfirmButton')}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => onReject(row.id)}>
                    {t('accountant.discrepancies.manualRejectButton')}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
