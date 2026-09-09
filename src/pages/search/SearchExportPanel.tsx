/**
 * С22 (decision #98): a watermarked PDF/XLSX export of the CURRENT search
 * result set — the same `kind` and applied filters the table above is
 * showing, never a second, independently-built query. This screen's own
 * zone/permission guarantee comes from `search.service._rows_for`, shared
 * with `GET /search` itself, so nothing here could widen what the operator
 * already sees even if it tried.
 *
 * The export finishes inside one POST (`create_export` in
 * `app/modules/search/service.py` renders and stores the file
 * synchronously) — a click both creates the job AND downloads the result,
 * the same one-shot shape `pages/reports/ReportExportPanel.tsx` uses for its
 * own export; `triggerDownload` is copied from there verbatim (this
 * module's own convention: a small helper is copied across page folders,
 * never imported).
 *
 * The list below is the export REGISTER `design/02` names `export_jobs` —
 * every past export this operator has run, each re-downloadable byte for
 * byte without re-rendering (`GET /search/exports/{id}/file` serves the
 * STORED file). `total_matched` beside `row_count` is shown only when they
 * differ — the configured cap truncated the export, and that must stay
 * visible rather than silent (ruling #20).
 */
import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n/useT';
import { fetchExportFile } from './api';
import { useCreateExport, useExports } from './queries';
import type { ExportFormat, SearchKind } from './api';

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface ExportFilters {
  q?: string;
  status?: string;
  organization_id?: string;
  activity_type_id?: string;
  series?: string;
}

export function SearchExportPanel({ kind, filters }: { kind: SearchKind; filters: ExportFilters }) {
  const t = useT();
  const [pending, setPending] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const createExport = useCreateExport();
  const exports = useExports();

  function reportError(e: unknown) {
    setError(e instanceof ApiError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : t('search.export.error'));
  }

  async function handleExport(format: ExportFormat) {
    setPending(format);
    setError(null);
    try {
      const job = await createExport.mutateAsync({ kind, format, ...filters });
      const blob = await fetchExportFile(job.id);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `search-${kind}-${job.id}.${format}`);
      URL.revokeObjectURL(url);
    } catch (e) {
      reportError(e);
    } finally {
      setPending(null);
    }
  }

  async function redownload(jobId: string, format: ExportFormat) {
    setError(null);
    try {
      const blob = await fetchExportFile(jobId);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `search-export-${jobId}.${format}`);
      URL.revokeObjectURL(url);
    } catch (e) {
      reportError(e);
    }
  }

  return (
    <div
      className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      data-testid="search-export-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#1A1F24]">{t('search.export.title')}</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            isLoading={pending === 'xlsx'}
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5" />}
            data-testid="search-export-xlsx"
            onClick={() => void handleExport('xlsx')}
          >
            {t('search.export.xlsxButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            isLoading={pending === 'pdf'}
            leftIcon={<FileText className="w-3.5 h-3.5" />}
            data-testid="search-export-pdf"
            onClick={() => void handleExport('pdf')}
          >
            {t('search.export.pdfButton')}
          </Button>
        </div>
      </div>

      {error && (
        <div data-testid="search-export-error">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {(exports.data?.length ?? 0) > 0 && (
        <ul className="divide-y divide-[#E4E7EA] text-xs" data-testid="search-export-history">
          {exports.data!.slice(0, 5).map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-[#5A646D]">
                {new Date(job.created_at).toLocaleString()} —{' '}
                {job.kind === 'applications' ? t('search.kindApplications') : t('search.kindPermits')} · .
                {job.format} — {job.row_count}
                {job.total_matched !== null && job.total_matched !== job.row_count
                  ? ` / ${job.total_matched}`
                  : ''}
              </span>
              <button
                className="inline-flex items-center gap-1 text-[#2E7D4F] hover:underline"
                onClick={() => void redownload(job.id, job.format)}
                data-testid={`search-export-download-${job.id}`}
              >
                <Download className="w-3 h-3" /> {t('search.export.download')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
