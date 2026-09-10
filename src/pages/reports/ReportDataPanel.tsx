/**
 * The report's own row data — `GET /reports/{id}` already carries
 * `data.rows` (a plain `Record<string, unknown>[]`, one entry per column
 * CODE), but the column metadata (`code`/`label`/`source`/`type`) lives on
 * the FORM, never hard-coded here (`ReportDataUpdate`'s own docstring: "the
 * set of columns is the FORM's, not fixed in code") — `useReportForm` is
 * the only source for it.
 *
 * `generate` (re)computes the row set from `permits`/`invoices` server-side
 * (`service.generate_report`); the manual-edit path here only ever corrects
 * VALUES within that existing row set — adding or removing whole rows is
 * deliberately out of scope (task brief), the same way `rules.check_rows`
 * only ever validates relationships WITHIN a row, never row count.
 *
 * Both the generate button and the edit toggle share one gate:
 * `report.status` in `REPORT_EDITABLE_STATUSES` AND the actor holds
 * `reports.manage` — the same statuses `service._assert_editable` allows
 * `generate`/`PATCH data` in.
 */
import { useState } from 'react';
import { Pencil, RefreshCw, Save, X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { reportErrorMessage } from './errors';
import { pickLocalizedName } from './format';
import { REPORTS_MANAGE } from './permissions';
import { REPORT_EDITABLE_STATUSES } from './transitions';
import { useGenerateReport, useReportForm, useUpdateReportData } from './queries';
import type { ReportFormColumn, ReportOut } from './api';

function asApiError(err: unknown): ApiError | null {
  return err instanceof ApiError ? err : null;
}

type Row = Record<string, unknown>;

function cellText(value: unknown): string {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

export function ReportDataPanel({ report }: { report: ReportOut }) {
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();

  const formQuery = useReportForm(report.form_id);
  const generate = useGenerateReport(report.id);
  const update = useUpdateReportData(report.id);

  const [editing, setEditing] = useState(false);
  const [draftRows, setDraftRows] = useState<Row[]>([]);
  const [justSaved, setJustSaved] = useState(false);

  const columns = (formQuery.data?.columns ?? []) as ReportFormColumn[];
  const rows = ((report.data as { rows?: unknown }).rows as Row[] | undefined) ?? [];
  const hasRows = rows.length > 0;
  const isEditableStatus = (REPORT_EDITABLE_STATUSES as readonly string[]).includes(report.status);
  const canManage = !!me && (me.is_superuser || me.permissions.includes(REPORTS_MANAGE));
  const canGenerate = isEditableStatus && canManage;
  const canToggleEdit = isEditableStatus && canManage && hasRows;

  const displayRows = editing ? draftRows : rows;
  const generateErr = asApiError(generate.error);
  const updateErr = asApiError(update.error);

  function startEdit() {
    update.reset();
    setJustSaved(false);
    setDraftRows(rows.map((row) => ({ ...row })));
    setEditing(true);
  }

  function cancelEdit() {
    update.reset();
    setEditing(false);
    setDraftRows([]);
  }

  function editCell(rowIndex: number, code: string, value: string) {
    setDraftRows((previous) => previous.map((row, i) => (i === rowIndex ? { ...row, [code]: value } : row)));
  }

  function saveEdit() {
    update.mutate(
      { rows: draftRows },
      {
        onSuccess: () => {
          setEditing(false);
          setJustSaved(true);
        },
      },
    );
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs font-sans space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <h2 className="text-base font-bold text-[#1A1F24]">{t('reports.data.panelTitle')}</h2>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full sm:w-auto">
          {canGenerate && !editing && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              isLoading={generate.isPending}
              leftIcon={<RefreshCw className="h-4 w-4" />}
              data-testid="report-data-generate"
              onClick={() => {
                setJustSaved(false);
                generate.mutate();
              }}
            >
              {t('reports.data.generateButton')}
            </Button>
          )}
          {canToggleEdit && !editing && (
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              leftIcon={<Pencil className="h-4 w-4" />}
              data-testid="report-data-edit"
              onClick={startEdit}
            >
              {t('reports.data.editButton')}
            </Button>
          )}
          {editing && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                leftIcon={<X className="h-4 w-4" />}
                disabled={update.isPending}
                data-testid="report-data-cancel"
                onClick={cancelEdit}
              >
                {t('reports.data.cancelEditButton')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto"
                isLoading={update.isPending}
                leftIcon={<Save className="h-4 w-4" />}
                data-testid="report-data-save"
                onClick={saveEdit}
              >
                {t('reports.data.saveButton')}
              </Button>
            </>
          )}
        </div>
      </div>

      {canGenerate && <p className="text-xs text-[#5A646D]">{t('reports.data.generateHint')}</p>}

      {justSaved && !editing && (
        <p data-testid="report-data-saved" className="text-xs font-semibold text-[#15803D]">
          {t('reports.data.savedNote')}
        </p>
      )}

      {generateErr && <Alert variant="danger">{reportErrorMessage(t, generateErr)}</Alert>}
      {updateErr && <Alert variant="danger">{reportErrorMessage(t, updateErr)}</Alert>}

      {!hasRows && !editing ? (
        <p data-testid="report-data-empty" className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          {t('reports.data.notGeneratedYet')}
        </p>
      ) : columns.length === 0 ? (
        <p className="text-xs text-[#5A646D] bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          {t('reports.data.emptyColumns')}
        </p>
      ) : (
        <div className="w-full overflow-x-auto" data-testid="report-data-table">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
                {columns.map((column) => (
                  <th key={column.code} className="p-3 text-xs font-semibold text-[#5A646D] uppercase tracking-wider">
                    {pickLocalizedName(column.label, lang)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {displayRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => {
                    if (editing && column.source === 'manual') {
                      return (
                        <td key={column.code} className="p-2">
                          <Input
                            value={cellText(row[column.code]) === '—' ? '' : String(row[column.code])}
                            data-testid={`report-data-cell-${column.code}-${rowIndex}`}
                            onChange={(e) => editCell(rowIndex, column.code, e.target.value)}
                          />
                        </td>
                      );
                    }
                    return (
                      <td
                        key={column.code}
                        className={
                          column.type === 'money'
                            ? 'p-3 text-right font-mono text-xs text-[#1A1F24]'
                            : 'p-3 text-xs text-[#1A1F24]'
                        }
                      >
                        {cellText(row[column.code])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isEditableStatus && hasRows && (
        <p data-testid="report-data-readonly" className="text-xs text-[#5A646D]">
          {t('reports.data.readOnlyNote')}
        </p>
      )}
    </div>
  );
}
