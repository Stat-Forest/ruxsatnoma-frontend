import { useRef, useState } from 'react';
import { AlertTriangle, UploadCloud } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FileInput, FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { Alert } from '../../components/ui/Feedback';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { useAuth } from '../../auth/useAuth';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../i18n/useT';
import { formatDate, formatDateTime, formatMoney } from '../permits/format';
import {
  MATCH_STATUS_STYLE,
  STATEMENT_STATUS_LABEL,
  STATEMENT_STATUS_STYLE,
  getMatchStatusLabel,
  getStatementStatusLabel,
} from './statusMeta';
import { useBankStatement, useBankStatements, useCreateBankStatement } from './queries';

const PAYMENTS_VIEW = 'payments.view';
const PAYMENTS_MANAGE = 'payments.manage';
const PAGE_SIZE = 20;

/**
 * G3 — bank-statement import and reconciliation (matching itself is a
 * backend worker job, `app/workers/jobs.py::process_bank_statements`; this
 * screen uploads, then polls `GET /payments/bank-statements/{id}` while the
 * status is `pending`/`parsing`, same idea `useBankStatement`'s own
 * `refetchInterval` implements).
 *
 * `GET /payments/bank-statements` is the register (backend-gaps finding 3).
 * This screen said for three stages that no such route existed and made do
 * with a per-session list of ids uploaded in THIS session plus a hand-typed
 * id to reopen an earlier one — the route has existed since 7.x, this
 * screen simply lagged it. Stage 14 (#205 R4) replaces both stand-ins with
 * `StatementsRegister` below: `useBankStatements` lists every statement
 * (optionally narrowed by `status`), newest first, and a row's own «Ochish»
 * button is the only way `openId` is ever set from state that did not just
 * come out of an upload's own response.
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

  const [openId, setOpenId] = useState<string | null>(null);

  if (!canUpload && !canView) {
    return (
      <div data-testid="statements-tab">
        <Alert variant="info">{t('accountant.statements.noAccess')}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="statements-tab">
      {canUpload && <UploadForm onAccepted={(id) => setOpenId(id)} />}

      {canView && <StatementsRegister onOpen={setOpenId} />}

      {canView && openId && <StatementDetail statementId={openId} />}
    </div>
  );
}

/** `imported`/`skipped` are read off `stats` defensively — it is a loose
 *  `Record<string, unknown>` the worker fills in once parsing settles, so a
 *  `pending`/`parsing` row's `stats` is `{}` and has neither key yet. */
function importedSkippedText(stats: Record<string, unknown>): string {
  const hasImported = Object.prototype.hasOwnProperty.call(stats, 'imported');
  const hasSkipped = Object.prototype.hasOwnProperty.call(stats, 'skipped');
  if (!hasImported && !hasSkipped) return '—';
  return `${hasImported ? String(stats.imported) : '—'} / ${hasSkipped ? String(stats.skipped) : '—'}`;
}

function StatementsRegister({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const { lang } = useLanguage();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useBankStatements({ status: status || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  const statusOptions = [
    { value: '', label: t('accountant.common.all') },
    ...Object.keys(STATEMENT_STATUS_LABEL).map((value) => ({ value, label: getStatementStatusLabel(value, lang) })),
  ];

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / PAGE_SIZE)) : 1;

  return (
    <section className="rounded-2xl border border-[#E4E7EA] bg-white shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E4E7EA] p-4">
        <h2 className="text-sm font-bold text-[#1A1F24]">{t('accountant.statements.registerTitle')}</h2>
        <div className="flex items-end gap-2 w-full sm:w-auto">
          <FormField label={t('accountant.invoices.statusFilterLabel')} htmlFor="statements-status-filter" className="w-full sm:w-auto">
            <Select
              id="statements-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={statusOptions}
            />
          </FormField>
          <ExportXlsxButton
            className="ml-auto"
            path="/api/v1/payments/bank-statements"
            query={{ status: status || undefined }}
            disabled={!query.data?.total}
          />
        </div>
      </div>

      {query.isLoading ? (
        <p className="p-4 text-sm text-[#5A646D]">{t('accountant.common.loading')}</p>
      ) : query.isError ? (
        <div className="p-4">
          <Alert variant="danger">{t('accountant.statements.loadFailed')}</Alert>
        </div>
      ) : query.data!.items.length === 0 ? (
        <p className="p-4 text-sm text-[#5A646D]">{t('accountant.statements.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[650px] whitespace-nowrap">
            <thead className="bg-[#F8F9FA] text-left text-xs font-bold uppercase tracking-wide text-[#5A646D]">
              <tr>
                <th className="px-4 py-3">{t('accountant.statements.dateLabel')}</th>
                <th className="px-4 py-3">{t('accountant.statements.colSource')}</th>
                <th className="px-4 py-3">{t('accountant.statements.colStatus')}</th>
                <th className="px-4 py-3">{t('accountant.statements.colImported')}</th>
                <th className="px-4 py-3">{t('accountant.statements.updatedAt')}</th>
                <th className="px-4 py-3 text-right">{t('accountant.discrepancies.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {query.data!.items.map((row) => (
                <tr key={row.id} className="border-t border-[#E4E7EA]" data-testid={`statement-row-${row.id}`}>
                  <td className="px-4 py-3 font-mono text-xs">{formatDate(row.statement_date)}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.source} / {row.format}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${
                        STATEMENT_STATUS_STYLE[row.status] ?? STATEMENT_STATUS_STYLE.pending
                      }`}
                    >
                      {getStatementStatusLabel(row.status, lang)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{importedSkippedText(row.stats)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => onOpen(row.id)}>
                      {t('accountant.statements.openRow')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data && query.data.total > 0 && (
        <div className="px-4 border-t border-[#E4E7EA] overflow-x-auto">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={query.data.total} />
        </div>
      )}
    </section>
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
