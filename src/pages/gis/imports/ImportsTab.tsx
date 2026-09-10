import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, UploadCloud } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/Feedback';
import { Input, Select } from '../../../components/ui/FormControls';
import { Pagination } from '../../../components/ui/Navigation';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { pickName, pickLayerName, formatDateTime } from '../format';
import type { ImportOut, PublishImportOut } from '../api';
import {
  useApproveImport,
  useCreateImport,
  useImport,
  useImportsList,
  useLayers,
  useOrganizations,
  usePublishImport,
  useSubmitImportReview,
  useUploadFile,
} from '../queries';
import { recentImports, rememberImport } from './localImports';
import { ChecksReport } from '../contours/ChecksReport';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

const CONTOURS_MANAGE = 'gis.contours.manage';
const CONTOURS_APPROVE = 'gis.contours.approve';

const FORMATS = ['shp', 'geojson', 'kml', 'kmz', 'gpkg', 'csv', 'zip'];
const IMPORTS_PAGE_SIZE = 20;

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'gis.imports.status.pending',
  processing: 'gis.imports.status.processing',
  review: 'gis.imports.status.review',
  approved: 'gis.imports.status.approved',
  done: 'gis.imports.status.done',
  failed: 'gis.imports.status.failed',
};

function UploadForm({ t, onCreated }: { t: (key: string) => string; onCreated: (id: string) => void }) {
  const { lang } = useLanguage();
  const layersQuery = useLayers();
  const organizationsQuery = useOrganizations();
  const uploadFile = useUploadFile();
  const createImport = useCreateImport();
  const errorText = useApiErrorText();

  const [layerCode, setLayerCode] = useState('contours');
  const [organizationId, setOrganizationId] = useState('');
  const [format, setFormat] = useState('geojson');
  const [file, setFile] = useState<File | null>(null);
  const [approvalFile, setApprovalFile] = useState<File | null>(null);
  const [numberField, setNumberField] = useState('number');
  const [areaField, setAreaField] = useState('');
  const [orgNameField, setOrgNameField] = useState('');

  const orgOptions = (organizationsQuery.data ?? []).map((o) => ({ value: o.id, label: pickName(o.name, lang) || o.code }));

  async function handleSubmit() {
    if (!file || !approvalFile || !organizationId) return;
    const approvalDoc = await uploadFile.mutateAsync(approvalFile);
    const attributes: Record<string, string> = {};
    if (numberField.trim()) attributes.number = numberField.trim();
    if (areaField.trim()) attributes.declared_area_ha = areaField.trim();
    if (orgNameField.trim()) attributes.organization_name = orgNameField.trim();
    const result = await createImport.mutateAsync({
      file,
      layer_code: layerCode,
      organization_id: organizationId,
      approval_doc_id: approvalDoc.id,
      format,
      attributes,
    });
    rememberImport(result.import_id);
    onCreated(result.import_id);
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="import-upload-form">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.imports.form.title')}</h3>

      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.imports.form.layer')}</span>
        <Select
          value={layerCode}
          onChange={(e) => setLayerCode(e.target.value)}
          options={(layersQuery.data ?? []).map((l) => ({ value: l.code, label: pickLayerName(l, lang) }))}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.imports.form.organization')}</span>
        <Select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} options={orgOptions} />
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.imports.form.format')}</span>
        <Select
          value={format}
          onChange={(e) => setFormat(e.target.value)}
          options={FORMATS.map((f) => ({ value: f, label: f }))}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="block space-y-1 text-xs">
          <span className="text-[#5A646D]">{t('gis.imports.form.numberField')}</span>
          <Input value={numberField} onChange={(e) => setNumberField(e.target.value)} />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-[#5A646D]">{t('gis.imports.form.areaField')}</span>
          <Input value={areaField} onChange={(e) => setAreaField(e.target.value)} placeholder="area_ha" />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="text-[#5A646D]">{t('gis.imports.form.orgNameField')}</span>
          <Input value={orgNameField} onChange={(e) => setOrgNameField(e.target.value)} placeholder="leskhoz" />
        </label>
      </div>

      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.imports.form.file')}</span>
        <input
          type="file"
          data-testid="import-file-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs"
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span className="text-[#5A646D]">{t('gis.imports.form.approvalDoc')}</span>
        <input
          type="file"
          data-testid="import-approval-input"
          onChange={(e) => setApprovalFile(e.target.files?.[0] ?? null)}
          className="block w-full text-xs"
        />
      </label>

      {createImport.isError && (
        <Alert variant="danger">{errorText(createImport.error, t('gis.imports.form.failed'))}</Alert>
      )}

      <Button
        variant="primary"
        size="sm"
        leftIcon={<UploadCloud className="w-4 h-4" />}
        disabled={!file || !approvalFile || !organizationId}
        isLoading={uploadFile.isPending || createImport.isPending}
        className="cursor-pointer"
        onClick={handleSubmit}
      >
        {t('gis.imports.form.submit')}
      </Button>
    </div>
  );
}

function ImportDetail({ importId, t }: { importId: string; t: (key: string) => string }) {
  const { me } = useAuth();
  const errorText = useApiErrorText();
  const canManage = !!me?.permissions.includes(CONTOURS_MANAGE) || !!me?.is_superuser;
  const canApprove = !!me?.permissions.includes(CONTOURS_APPROVE) || !!me?.is_superuser;

  const importQuery = useImport(importId);
  const queryClient = useQueryClient();
  const submitReview = useSubmitImportReview();
  const approve = useApproveImport();
  const publish = usePublishImport();
  // The backend gives no signal that `submit-review` was already called for
  // THIS batch — `ImportOut.status` stays `review` before and after it (its
  // real effect is on the versions it created, not the batch row itself,
  // per `gis/service.py::submit_import_review`'s own docstring). Tracked
  // locally so the button disappears for the rest of THIS session; a reload
  // shows it again, and a second click is answered honestly by the backend's
  // own `already_submitted` 409 rather than hidden.
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishImportOut | null>(null);

  function writeThrough(data: ImportOut) {
    queryClient.setQueryData(['gis', 'imports', importId], data);
  }

  if (importQuery.isLoading) {
    return (
      <p className="text-xs text-[#5A646D]">
        <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.imports.loading')}
      </p>
    );
  }
  if (importQuery.isError || !importQuery.data) {
    return <Alert variant="danger">{errorText(importQuery.error, t('gis.imports.notFound'))}</Alert>;
  }
  const row = importQuery.data;
  const stats = (row.stats ?? {}) as { created?: number; warnings?: unknown[]; published?: number; blocked?: number };

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-3" data-testid="import-detail">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[#5A646D]">{row.id}</span>
        <span className="rounded-full border border-[#E4E7EA] bg-[#F8F9FA] px-2.5 py-1 text-xs font-semibold text-[#1A1F24]">
          {t(STATUS_LABEL_KEYS[row.status] ?? row.status)}
        </span>
      </div>

      {(row.status === 'pending' || row.status === 'processing') && (
        <p className="text-xs text-[#5A646D]">
          <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.imports.parsing')}
        </p>
      )}

      {row.status === 'failed' && Array.isArray(row.error_report) && (
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-[#991B1B]">{t('gis.imports.errorReport')}</p>
          <ul className="space-y-1">
            {(row.error_report as { row?: number; code?: string; message?: string }[]).map((e, i) => (
              <li key={i} className="rounded border border-[#FCA5A5] bg-[#FEF2F2] p-2 text-[#991B1B]">
                #{e.row} {errorText(e)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.created != null && (
        <dl className="grid grid-cols-2 gap-y-1 text-xs">
          <dt className="text-[#5A646D]">{t('gis.imports.created')}</dt>
          <dd className="text-right font-mono font-semibold">{stats.created}</dd>
          {stats.published != null && (
            <>
              <dt className="text-[#5A646D]">{t('gis.imports.published')}</dt>
              <dd className="text-right font-mono">{stats.published}</dd>
            </>
          )}
          {stats.blocked != null && (
            <>
              <dt className="text-[#5A646D]">{t('gis.imports.blocked')}</dt>
              <dd className="text-right font-mono">{stats.blocked}</dd>
            </>
          )}
        </dl>
      )}
      {Array.isArray(stats.warnings) && stats.warnings.length > 0 && (
        <Alert variant="warning">
          {stats.warnings.length} {t('gis.imports.warningsCount')}
        </Alert>
      )}

      {publishResult && publishResult.blocked.length > 0 && (
        <div className="space-y-2">
          <Alert variant="warning">
            {publishResult.published} {t('gis.imports.published')}, {publishResult.blocked.length}{' '}
            {t('gis.imports.blocked')}
          </Alert>
          {publishResult.blocked.map((b, i) => {
            const versionId = typeof b.version_id === 'string' ? b.version_id : String(i);
            const checks = Array.isArray(b.checks) ? (b.checks as never) : [];
            return (
              <div key={versionId} className="rounded-lg border border-[#FCA5A5] p-2">
                <p className="font-mono text-[10px] text-[#5A646D]">{versionId}</p>
                <ChecksReport checks={checks} t={t} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-[#E4E7EA] pt-3">
        {row.status === 'review' && canManage && !reviewSubmitted && (
          <Button
            variant="primary"
            size="sm"
            isLoading={submitReview.isPending}
            className="cursor-pointer"
            onClick={async () => {
              const result = await submitReview.mutateAsync(importId);
              writeThrough(result);
              setReviewSubmitted(true);
            }}
          >
            {t('gis.imports.actions.submitReview')}
          </Button>
        )}
        {row.status === 'review' && canApprove && reviewSubmitted && (
          <Button
            variant="success"
            size="sm"
            isLoading={approve.isPending}
            className="cursor-pointer"
            onClick={async () => writeThrough(await approve.mutateAsync(importId))}
          >
            {t('gis.imports.actions.approve')}
          </Button>
        )}
        {row.status === 'approved' && canApprove && (
          <Button
            variant="primary"
            size="sm"
            isLoading={publish.isPending}
            className="cursor-pointer"
            onClick={async () => {
              const result = await publish.mutateAsync(importId);
              setPublishResult(result);
              importQuery.refetch();
            }}
          >
            {t('gis.imports.actions.publish')}
          </Button>
        )}
        {(submitReview.isError || approve.isError || publish.isError) && (
          <Alert variant="danger" className="w-full">
            {errorText(submitReview.error ?? approve.error ?? publish.error, t('gis.imports.actions.failed'))}
          </Alert>
        )}
      </div>
    </div>
  );
}

/**
 * F12c — the register `gis/imports_router.py` now has (`GET /gis/imports`,
 * verified against a regenerated `schema.d.ts`): every batch this caller's
 * zone can see, newest first, status-filterable and paged. Replaces the
 * "open by id" box as the primary way in — that box stays below (an
 * operator handed an id out of band, e.g. from a notification, still
 * benefits from it) but is no longer the only door.
 */
function ImportsListPanel({ t, onOpen }: { t: (key: string) => string; onOpen: (id: string) => void }) {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const listQuery = useImportsList({ status: status || undefined, page, page_size: IMPORTS_PAGE_SIZE });
  const layersQuery = useLayers();
  const organizationsQuery = useOrganizations();

  const layerLabel = (layerId: string) => {
    const layer = layersQuery.data?.find((l) => l.id === layerId);
    return layer ? pickLayerName(layer, lang) : layerId.slice(0, 8);
  };
  const organizationLabel = (organizationId: string) => {
    const org = organizationsQuery.data?.find((o) => o.id === organizationId);
    return org ? pickName(org.name, lang) || org.code : organizationId.slice(0, 8);
  };

  const totalPages = listQuery.data ? Math.max(1, Math.ceil(listQuery.data.total / IMPORTS_PAGE_SIZE)) : 1;

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs" data-testid="imports-list-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E7EA] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.imports.list.title')}</h3>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-[#5A646D]">{t('gis.imports.list.colStatus')}</span>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('gis.imports.list.statusFilterAll') },
              ...Object.entries(STATUS_LABEL_KEYS).map(([value, key]) => ({ value, label: t(key) })),
            ]}
          />
        </label>
      </div>

      {listQuery.isLoading ? (
        <p className="p-4 text-xs text-[#5A646D]">
          <Loader2 className="w-4 h-4 inline animate-spin mr-1" /> {t('gis.imports.loading')}
        </p>
      ) : listQuery.isError ? (
        <div className="p-4">
          <Alert variant="danger">{errorText(listQuery.error, t('gis.imports.list.loadFailed'))}</Alert>
        </div>
      ) : listQuery.data!.items.length === 0 ? (
        <p className="p-4 text-xs text-[#5A646D]">{t('gis.imports.list.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#F8F9FA] text-left font-bold uppercase tracking-wide text-[#5A646D]">
              <tr>
                <th className="px-4 py-2">{t('gis.imports.list.colCreatedAt')}</th>
                <th className="px-4 py-2">{t('gis.imports.list.colStatus')}</th>
                <th className="px-4 py-2">{t('gis.imports.list.colLayer')}</th>
                <th className="px-4 py-2">{t('gis.imports.list.colOrganization')}</th>
                <th className="px-4 py-2">{t('gis.imports.list.colFormat')}</th>
                <th className="px-4 py-2 text-right">{t('gis.imports.list.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data!.items.map((row) => (
                <tr
                  key={row.id}
                  {...clickableRowProps(() => onOpen(row.id))}
                  className={`border-t border-[#E4E7EA] hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}`}
                  data-testid={`import-row-${row.id}`}
                >
                  <td className="px-4 py-2 font-mono">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full border border-[#E4E7EA] bg-[#F8F9FA] px-2 py-0.5 font-semibold text-[#1A1F24]">
                      {t(STATUS_LABEL_KEYS[row.status] ?? row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-2">{layerLabel(row.layer_id)}</td>
                  <td className="px-4 py-2">{organizationLabel(row.organization_id)}</td>
                  <td className="px-4 py-2 font-mono">{row.format}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => onOpen(row.id)}>
                      {t('gis.imports.open')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {listQuery.data && listQuery.data.total > 0 && (
        <div className="px-4 border-t border-[#E4E7EA]">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={listQuery.data.total} />
        </div>
      )}
    </div>
  );
}

/**
 * F3 — geodata import. F12c added the register above (`ImportsListPanel`);
 * the "open by id" box below it stays as a fallback for an id handed over
 * out of band (e.g. from a notification), which is a real path and not the
 * only one any more.
 */
export function ImportsTab({ t }: { t: (key: string) => string }) {
  const { me } = useAuth();
  const canManage = !!me?.permissions.includes(CONTOURS_MANAGE) || !!me?.is_superuser;
  const [activeId, setActiveId] = useState<string | null>(recentImports()[0] ?? null);
  const [openId, setOpenId] = useState('');

  function openImport(id: string) {
    rememberImport(id);
    setActiveId(id);
  }

  return (
    <div className="space-y-4">
      <ImportsListPanel t={t} onOpen={openImport} />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">
        <div className="space-y-3">
          {canManage && <UploadForm t={t} onCreated={setActiveId} />}

          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.imports.openById')}</h3>
            <div className="flex gap-2">
              <Input value={openId} onChange={(e) => setOpenId(e.target.value)} placeholder="import id" />
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                onClick={() => {
                  if (openId.trim()) openImport(openId.trim());
                }}
              >
                {t('gis.imports.open')}
              </Button>
            </div>
          </div>

          {recentImports().length > 0 && (
            <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{t('gis.imports.recent')}</h3>
              {recentImports().map((id) => (
                <button
                  key={id}
                  onClick={() => setActiveId(id)}
                  className={`block w-full truncate rounded px-2 py-1 text-left font-mono text-[11px] cursor-pointer ${
                    activeId === id ? 'bg-[#F0F7F1] text-[#123522]' : 'text-[#5A646D] hover:bg-[#F8F9FA]'
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {activeId ? (
            <ImportDetail importId={activeId} t={t} />
          ) : (
            <p className="text-xs text-[#5A646D]">{t('gis.imports.noneSelected')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
