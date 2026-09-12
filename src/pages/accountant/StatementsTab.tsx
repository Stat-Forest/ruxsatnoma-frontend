import { useRef, useState } from 'react';
import { AlertTriangle, Search, UploadCloud } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FileInput, FormField, Input } from '../../components/ui/FormControls';
import { Alert } from '../../components/ui/Feedback';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDate, formatDateTime, formatMoney } from '../permits/format';
import {
  MATCH_STATUS_STYLE,
  STATEMENT_STATUS_STYLE,
  getMatchStatusLabel,
  getStatementStatusLabel,
} from './statusMeta';
import { useBankStatement, useCreateBankStatement } from './queries';

const PAYMENTS_VIEW = 'payments.view';
const PAYMENTS_MANAGE = 'payments.manage';

/**
 * G3 — bank-statement import and reconciliation (matching itself is a
 * backend worker job, `app/workers/jobs.py::process_bank_statements`; this
 * screen uploads, then polls `GET /payments/bank-statements/{id}` while the
 * status is `pending`/`parsing`, same idea `useBankStatement`'s own
 * `refetchInterval` implements).
 *
 * Like G1 (`06.5-accountant.md` ruling R1), there is no route that lists
 * statements at all — only a `POST` and a by-id `GET`. Opening one after
 * this session's own upload is a courtesy list kept in component state;
 * opening one from an earlier session works only by pasting its id.
 *
 * `POST /payments/bank-statements` requires `payments.manage`,
 * `GET /payments/bank-statements/{id}` requires `payments.view`
 * (`backoffice_router.py`) — re-verified against the current source
 * 2026-09-05 after the backend worktree turned out to be 53 commits stale
 * when this screen was first built. `accountant` holds both (migration
 * 0017), so nothing changes for the maker; `executor_head` (reachable here
 * via ruling R4's widened nav permission) holds neither, and has no
 * legitimate business with bank statements at all — the tab shows neither
 * half to that role rather than offering a button the backend would refuse.
 */
export function StatementsTab() {
  const t = useT();
  const { me } = useAuth();
  const canUpload = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_MANAGE));
  const canView = Boolean(me?.is_superuser || me?.permissions.includes(PAYMENTS_VIEW));

  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openIdDraft, setOpenIdDraft] = useState('');

  if (!canUpload && !canView) {
    return (
      <div data-testid="statements-tab">
        <Alert variant="info">{t('accountant.statements.noAccess')}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="statements-tab">
      {canUpload && (
        <UploadForm
          onAccepted={(id) => {
            setUploadedIds((prev) => [id, ...prev]);
            setOpenId(id);
          }}
        />
      )}

      {canView && (
        <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.statements.openIdLabel')}</h2>
            <ExportXlsxButton path="/api/v1/payments/bank-statements" query={{}} />
          </div>
          <form
            className="flex flex-col sm:flex-row sm:items-end gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (openIdDraft.trim()) setOpenId(openIdDraft.trim());
            }}
          >
            <FormField label={t('accountant.statements.openIdLabel')} htmlFor="statement-open-id" className="flex-1 w-full">
              <Input id="statement-open-id" value={openIdDraft} onChange={(e) => setOpenIdDraft(e.target.value)} placeholder="UUID" />
            </FormField>
            <Button type="submit" variant="secondary" className="w-full sm:w-auto" leftIcon={<Search className="h-4 w-4" />}>
              {t('accountant.statements.openButton')}
            </Button>
          </form>

          {uploadedIds.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {uploadedIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className="font-mono text-[#2E7D4F] underline hover:text-[#23653F] break-all text-left"
                    onClick={() => setOpenId(id)}
                  >
                    {id}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canView && openId && <StatementDetail statementId={openId} />}
    </div>
  );
}

function UploadForm({ onAccepted }: { onAccepted: (id: string) => void }) {
  const t = useT();
  const errorText = useApiErrorText();
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const [file, setFile] = useState<File | null>(null);
  const [statementDate, setStatementDate] = useState('');
  const [amountCol, setAmountCol] = useState('amount');
  const [operationDateCol, setOperationDateCol] = useState('operation_date');
  const [purposeCol, setPurposeCol] = useState('purpose');
  const [docNumberCol, setDocNumberCol] = useState('');
  const [payerNameCol, setPayerNameCol] = useState('');
  const [payerAccountCol, setPayerAccountCol] = useState('');

  const mutation = useCreateBankStatement();

  const canSubmit =
    file !== null && statementDate.trim() !== '' && amountCol.trim() !== '' && operationDateCol.trim() !== '' && purposeCol.trim() !== '';

  function submit() {
    if (!file) return;
    const columnMap: Record<string, string> = {
      amount: amountCol.trim(),
      operation_date: operationDateCol.trim(),
      purpose: purposeCol.trim(),
    };
    if (docNumberCol.trim()) columnMap.doc_number = docNumberCol.trim();
    if (payerNameCol.trim()) columnMap.payer_name = payerNameCol.trim();
    if (payerAccountCol.trim()) columnMap.payer_account = payerAccountCol.trim();

    mutation.mutate(
      { file, statementDate, columnMap, idempotencyKey: idempotencyKeyRef.current },
      {
        onSuccess: (result) => {
          idempotencyKeyRef.current = crypto.randomUUID();
          onAccepted(result.id);
        },
      },
    );
  }

  const error =
    mutation.error instanceof ApiError ? errorText(mutation.error) : mutation.isError ? t('accountant.statements.uploadFailed') : null;

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs">
      <h2 className="mb-1 text-sm font-bold text-[#1A1F24]">{t('accountant.statements.uploadTitle')}</h2>
      <p className="mb-3 text-xs text-[#5A646D]">{t('accountant.statements.uploadSubtitle')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label={t('accountant.statements.fileLabel')} htmlFor="statement-file">
          <FileInput
            id="statement-file"
            accept=".csv,text/csv"
            value={file}
            onChange={setFile}
          />
        </FormField>
        <FormField label={t('accountant.statements.dateLabel')} htmlFor="statement-date">
          <Input id="statement-date" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} />
        </FormField>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('accountant.statements.columnMapLabel')}</p>
      <p className="mb-3 text-xs text-[#5A646D]">{t('accountant.statements.columnMapHint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FormField label={t('accountant.statements.colAmount')} required htmlFor="col-amount">
          <Input id="col-amount" value={amountCol} onChange={(e) => setAmountCol(e.target.value)} />
        </FormField>
        <FormField label={t('accountant.statements.colDate')} required htmlFor="col-date">
          <Input id="col-date" value={operationDateCol} onChange={(e) => setOperationDateCol(e.target.value)} />
        </FormField>
        <FormField label={t('accountant.statements.colPurpose')} required htmlFor="col-purpose">
          <Input id="col-purpose" value={purposeCol} onChange={(e) => setPurposeCol(e.target.value)} />
        </FormField>
        <FormField label={t('accountant.statements.colDoc')} htmlFor="col-doc">
          <Input id="col-doc" value={docNumberCol} onChange={(e) => setDocNumberCol(e.target.value)} />
        </FormField>
        <FormField label={t('accountant.statements.colPayer')} htmlFor="col-payer">
          <Input id="col-payer" value={payerNameCol} onChange={(e) => setPayerNameCol(e.target.value)} />
        </FormField>
        <FormField label={t('accountant.statements.colPayerAccount')} htmlFor="col-payer-account">
          <Input id="col-payer-account" value={payerAccountCol} onChange={(e) => setPayerAccountCol(e.target.value)} />
        </FormField>
      </div>

      {error && (
        <div className="mt-3">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      <Button
        className="mt-4 w-full sm:w-auto"
        variant="primary"
        leftIcon={<UploadCloud className="h-4 w-4" />}
        disabled={!canSubmit}
        isLoading={mutation.isPending}
        onClick={submit}
      >
        {t('accountant.statements.uploadButton')}
      </Button>
    </section>
  );
}

function StatementDetail({ statementId }: { statementId: string }) {
  const t = useT();
  const { lang } = useLanguage();
  const query = useBankStatement(statementId, { limit: 50, offset: 0 });

  if (query.isLoading) {
    return <p className="text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>;
  }
  if (query.isError) {
    return (
      <Alert variant="danger">
        {query.error instanceof ApiError && query.error.code === 'ERR-SYS-003'
          ? t('accountant.statements.notFound')
          : t('accountant.statements.loadFailed')}
      </Alert>
    );
  }

  const statement = query.data!;
  const errorReport = statement.error_report as { errors?: { line_no: number; field: string; message: string }[]; omitted?: number } | null;

  return (
    <section className="space-y-4 rounded-2xl border border-[#E4E7EA] bg-white p-4 shadow-xs" data-testid="statement-detail">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-[#5A646D] break-all">{statement.id}</span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
              STATEMENT_STATUS_STYLE[statement.status] ?? STATEMENT_STATUS_STYLE.pending
            }`}
          >
            {getStatementStatusLabel(statement.status, lang)}
          </span>
        </div>
        <span className="text-xs text-[#5A646D]">
          {t('accountant.statements.periodLabel')}: {statement.period_from ? formatDate(statement.period_from) : '—'} –{' '}
          {statement.period_to ? formatDate(statement.period_to) : '—'}
        </span>
      </div>

      {Object.keys(statement.stats ?? {}).length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('accountant.statements.statsLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(statement.stats as Record<string, unknown>).map(([key, value]) => (
              <span key={key} className="rounded-full border border-[#E4E7EA] bg-[#F8F9FA] px-2.5 py-1 text-xs">
                {key}: <strong>{String(value)}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {errorReport && errorReport.errors && errorReport.errors.length > 0 && (
        <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 break-words">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#92400E]">
            <AlertTriangle className="h-3.5 w-3.5" /> {t('accountant.statements.errorReportLabel')}
          </p>
          <ul className="space-y-1 text-xs text-[#92400E]">
            {errorReport.errors.map((row, i) => (
              <li key={i}>
                {t('accountant.statements.colLine')} {row.line_no} ({row.field}): {row.message}
              </li>
            ))}
          </ul>
          {typeof errorReport.omitted === 'number' && errorReport.omitted > 0 && (
            <p className="mt-1 text-xs italic text-[#92400E]">
              +{errorReport.omitted} {t('accountant.statements.moreOmitted')}
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-bold text-[#1A1F24]">
          {t('accountant.statements.linesTitle')} ({statement.lines_total})
        </h3>
        {statement.lines.length === 0 ? (
          <p className="text-xs text-[#5A646D]">{t('accountant.statements.emptyLines')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E4E7EA]">
            <table className="w-full text-xs min-w-[600px] whitespace-nowrap">
              <thead className="bg-[#F8F9FA] text-left font-semibold uppercase tracking-wide text-[#5A646D]">
                <tr>
                  <th className="px-3 py-2">{t('accountant.statements.colLine')}</th>
                  <th className="px-3 py-2">{t('accountant.statements.colDoc')}</th>
                  <th className="px-3 py-2 text-right">{t('accountant.statements.colAmount')}</th>
                  <th className="px-3 py-2">{t('accountant.statements.colDate')}</th>
                  <th className="px-3 py-2">{t('accountant.statements.colPayer')}</th>
                  <th className="px-3 py-2">{t('accountant.statements.colMatch')}</th>
                </tr>
              </thead>
              <tbody>
                {statement.lines.map((line) => (
                  <tr key={line.id} className="border-t border-[#E4E7EA]">
                    <td className="px-3 py-2">{line.line_no}</td>
                    <td className="px-3 py-2 font-mono">{line.doc_number ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatMoney(line.amount)}</td>
                    <td className="px-3 py-2 font-mono">{formatDate(line.operation_date)}</td>
                    <td className="px-3 py-2">{line.payer_name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                          MATCH_STATUS_STYLE[line.match_status] ?? MATCH_STATUS_STYLE.unmatched
                        }`}
                      >
                        {getMatchStatusLabel(line.match_status, lang)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-[#5A646D]">{t('accountant.statements.updatedAt')}: {formatDateTime(statement.created_at)}</p>
    </section>
  );
}
