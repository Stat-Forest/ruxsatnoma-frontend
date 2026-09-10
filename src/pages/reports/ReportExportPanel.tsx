/**
 * Exports of the report's CURRENT data — `export.xlsx`/`export.pdf` both
 * answer a binary response, so `api.ts::fetchReportExcel`/`fetchReportPdf`
 * bypass the typed JSON client the same way `PermitPdfPanel.tsx` does for
 * `GET /permits/{id}/pdf`. Unlike that panel, these exports need no inline
 * preview: a FROZEN permit PDF is worth looking at before trusting it, a
 * report export is just a file to hand off, so this is a direct download —
 * `triggerDownload` is `PermitPdfPanel.tsx`'s own helper, copied verbatim
 * rather than imported across page folders (this module's own convention,
 * see `format.ts`'s header).
 *
 * Available in every status: loading the report at all already required
 * `reports.view`, and there is nothing export-specific to gate further.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { fetchReportExcel, fetchReportPdf } from './api';

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

type ExportKind = 'xlsx' | 'pdf';

export function ReportExportPanel({ reportId }: { reportId: string }) {
  const t = useT();
  const [pending, setPending] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(kind: ExportKind) {
    setPending(kind);
    setError(null);
    try {
      const blob = kind === 'xlsx' ? await fetchReportExcel(reportId) : await fetchReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `report-${reportId}.${kind}`);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('reports.export.error'));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs font-sans space-y-4">
      <h2 className="text-base font-bold text-[#1A1F24] border-b border-[#E4E7EA] pb-3">
        {t('reports.export.panelTitle')}
      </h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          isLoading={pending === 'xlsx'}
          leftIcon={<Download className="h-4 w-4" />}
          data-testid="report-export-xlsx"
          onClick={() => void handleDownload('xlsx')}
        >
          {t('reports.export.xlsxButton')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          isLoading={pending === 'pdf'}
          leftIcon={<Download className="h-4 w-4" />}
          data-testid="report-export-pdf"
          onClick={() => void handleDownload('pdf')}
        >
          {t('reports.export.pdfButton')}
        </Button>
      </div>
      {error && (
        <div data-testid="report-export-error">
          <Alert variant="danger">
            {t('reports.export.error')}: {error}
          </Alert>
        </div>
      )}
    </div>
  );
}
