/**
 * The report as its actors see it end to end: header requisites, row data,
 * the lifecycle action panel, and the two exports. Same shape as
 * `PermitDocumentPage.tsx` (`useParams<{id}>`, one detail query, loading/
 * error states, then a header plus composed panels).
 *
 * `useReviseReport`'s 201 answers with a DIFFERENT report — this page is
 * the caller `ReportLifecyclePanel.tsx` defers navigation to
 * (`onRevised`), replacing the URL so a reload resolves the new revision
 * directly rather than bouncing through the one that no longer accepts
 * further action.
 */
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '../api/errors';
import { useLanguage, useT } from '../i18n/useT';
import { Alert } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/StatusBadge';
import { formatDate, pickLocalizedName } from './reports/format';
import { statusLabelKey } from './reports/transitions';
import { useLeshozOrganizations, useReport, useReportForm } from './reports/queries';
import { ReportDataPanel } from './reports/ReportDataPanel';
import { ReportExportPanel } from './reports/ReportExportPanel';
import { ReportLifecyclePanel } from './reports/ReportLifecyclePanel';

function asApiError(err: unknown): ApiError | null {
  return err instanceof ApiError ? err : null;
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { lang } = useLanguage();

  const reportQuery = useReport(id);
  const report = reportQuery.data;
  const formQuery = useReportForm(report?.form_id);
  const organizations = useLeshozOrganizations(true);

  if (reportQuery.isLoading) {
    return <div className="text-sm text-[#5A646D] font-sans p-6">{t('reports.detail.loading')}</div>;
  }

  if (reportQuery.isError) {
    const err = asApiError(reportQuery.error);
    let message = err ? `${t('reports.detail.loadError')}: ${err.message}` : t('reports.detail.loadError');
    if (err?.code === 'ERR-SYS-003') message = t('reports.detail.notFound');
    else if (err?.code === 'ERR-ACL-002') message = t('reports.detail.wrongZone');
    return (
      <div className="max-w-4xl mx-auto p-6 font-sans">
        <Alert variant="danger">{message}</Alert>
      </div>
    );
  }

  if (!report) return null;

  const org = organizations.data?.items.find((item) => item.id === report.organization_id);
  const organizationName = org ? pickLocalizedName(org.name, lang) || org.code : report.organization_id;
  const formLabel = formQuery.data
    ? `${pickLocalizedName(formQuery.data.name, lang) || formQuery.data.code} (v${formQuery.data.version})`
    : '…';

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-16 px-4 sm:px-0">
      <div className="border-b border-[#E4E7EA] pb-4 space-y-2">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D4F] hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t('reports.detail.backToList')}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1F24] tracking-tight break-words">{formLabel}</h1>
          <StatusBadge status="info" label={t(statusLabelKey(report.status))} size="sm" showIcon={false} />
        </div>

        <p className="text-xs text-[#5A646D] leading-relaxed break-words">
          {t('reports.detail.organizationLabel')}: {organizationName} · {t('reports.detail.periodLabel')}:{' '}
          {formatDate(report.period_start)} – {formatDate(report.period_end)} · {t('reports.detail.versionLabel')}:{' '}
          {report.version_no}
        </p>

        {report.parent_report_id != null && (
          <Link
            to={`/reports/${report.parent_report_id}`}
            data-testid="report-parent-link"
            className="inline-block text-xs font-semibold text-[#2E7D4F] hover:underline"
          >
            {t('reports.detail.parentLink')} →
          </Link>
        )}

        {report.status === 'returned' && (
          <div
            data-testid="report-returned-note"
            className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E] space-y-1"
          >
            <p className="font-semibold">{t('reports.detail.returnedNote')}</p>
            <p>{report.returned_by === 'head' ? t('reports.detail.returnedByHead') : t('reports.detail.returnedByCenter')}</p>
            {report.returned_comment && <p>{report.returned_comment}</p>}
          </div>
        )}
      </div>

      <ReportDataPanel report={report} />

      {/* History & Audit Log */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs font-sans space-y-3" data-testid="report-history">
        <h2 className="text-base font-bold text-[#1A1F24] border-b border-[#E4E7EA] pb-3">
          {t('reports.detail.historyTitle')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-[#5A646D]">
          <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E4E7EA] space-y-1">
            <span className="font-semibold text-[#1A1F24] block">{t('reports.detail.historyCreated')}</span>
            <span>{formatDate(report.created_at)}</span>
          </div>
          {report.submitted_at && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E4E7EA] space-y-1">
              <span className="font-semibold text-[#1A1F24] block">{t('reports.detail.historySubmitted')}</span>
              <span>{formatDate(report.submitted_at)}</span>
            </div>
          )}
          {report.approved_at && (
            <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E4E7EA] space-y-1">
              <span className="font-semibold text-[#1A1F24] block">{t('reports.detail.historyApproved')}</span>
              <span>{formatDate(report.approved_at)}</span>
            </div>
          )}
          <div className="p-3 rounded-xl bg-[#F8F9FA] border border-[#E4E7EA] space-y-1">
            <span className="font-semibold text-[#1A1F24] block">{t('reports.detail.historyUpdated')}</span>
            <span>{formatDate(report.updated_at)}</span>
          </div>
        </div>
      </div>

      <ReportLifecyclePanel report={report} onRevised={(newId) => navigate(`/reports/${newId}`, { replace: true })} />

      <ReportExportPanel reportId={report.id} />
    </div>
  );
}
