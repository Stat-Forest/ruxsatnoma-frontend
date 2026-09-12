/**
 * The archive register (stage 4.7, `docs/plans/04.5-4.7-search-archive.md`)
 * — `GET /api/v1/archive`, zone-scoped, plus one item's own card and the
 * archive/verify actions.
 *
 * F23 (`docs/plans/07.3-findings.md`, stage 6.9): the register used to sit
 * behind `archive.manage` alone, so a read-only role could never hold the
 * read without also getting the write. Reading gates on `archive.view`
 * (`shell/navigation.ts`, `routes.tsx`); this screen additionally checks
 * `archive.manage` itself — with `satisfies`, the same predicate the menu
 * filters with — before showing the "archive an object" button or a row's
 * "verify" action, since those two need the write code the route-level gate
 * does not require.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { satisfies } from '../../shell/navigation';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { FormField, Select } from '../../components/ui/FormControls';
import { useLanguage, useT } from '../../i18n/useT';
import { pickLocalizedName, useLeshozOrganizations } from './refs';
import { useArchiveItems } from './queries';
import { ArchiveItemDrawer } from './ArchiveItemDrawer';
import { ArchiveObjectModal } from './ArchiveObjectModal';
import type { ArchiveItemOut, ArchiveItemStatus, ArchiveObjectType } from './api';

const ARCHIVE_MANAGE = 'archive.manage';
const PAGE_SIZE = 20;

export function ArchivePage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me } = useAuth();
  const canManage = me != null && satisfies(ARCHIVE_MANAGE, me);

  const [objectType, setObjectType] = useState<ArchiveObjectType | ''>('');
  const [status, setStatus] = useState<ArchiveItemStatus | ''>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const organizations = useLeshozOrganizations();
  const list = useArchiveItems({
    object_type: objectType || undefined,
    status: status || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<ArchiveItemOut>[] = [
    {
      key: 'object_type',
      header: t('archive.col.objectType'),
      accessor: (row) => (row.object_type === 'application' ? t('archive.typeApplication') : t('archive.typePermit')),
    },
    {
      key: 'object_id',
      header: t('archive.col.object'),
      accessor: (row) => (
        <Link
          to={row.object_type === 'application' ? `/applications/${row.object_id}` : `/permits/${row.object_id}`}
          className="font-mono text-xs text-[#2E7D4F] hover:underline"
        >
          {row.object_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'organization',
      header: t('archive.col.organization'),
      accessor: (row) => {
        const org = organizations.data?.items.find((o) => o.id === row.organization_id);
        return org ? pickLocalizedName(org.name, lang) : '—';
      },
    },
    {
      key: 'status',
      header: t('archive.col.status'),
      accessor: (row) => (
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
            row.status === 'verified'
              ? 'border-[#D9EBDC] bg-[#F0F7F1] text-[#123522]'
              : 'border-[#E4E7EA] bg-[#F8F9FA] text-[#5A646D]'
          }`}
        >
          {row.status === 'verified' ? t('archive.statusVerified') : t('archive.statusStored')}
        </span>
      ),
    },
    { key: 'archived_at', header: t('archive.col.archivedAt'), accessor: (row) => new Date(row.archived_at).toLocaleString() },
    { key: 'retention_until', header: t('archive.col.retentionUntil'), accessor: (row) => row.retention_until ?? '—' },
    {
      key: 'view',
      header: '',
      accessor: (row) => (
        <button
          className="text-xs font-semibold text-[#2E7D4F] hover:underline"
          onClick={() => setSelectedId(row.id)}
          data-testid={`archive-open-${row.id}`}
        >
          {t('archive.col.view')}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-16" data-testid="archive-page">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('archive.title')}</h1>
        {canManage && (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreating(true)}>
            {t('archive.actions.newItem')}
          </Button>
        )}
      </header>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label={t('archive.filters.objectType')}>
            <Select
              value={objectType}
              onChange={(e) => {
                setObjectType(e.target.value as ArchiveObjectType | '');
                setPage(1);
              }}
              options={[
                { value: '', label: t('archive.filters.allTypes') },
                { value: 'application', label: t('archive.typeApplication') },
                { value: 'permit', label: t('archive.typePermit') },
              ]}
            />
          </FormField>
          <FormField label={t('archive.filters.status')}>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ArchiveItemStatus | '');
                setPage(1);
              }}
              options={[
                { value: '', label: t('archive.filters.allStatuses') },
                { value: 'stored', label: t('archive.statusStored') },
                { value: 'verified', label: t('archive.statusVerified') },
              ]}
            />
          </FormField>
        </div>
      </div>

      <div className="flex justify-end">
        <ExportXlsxButton className="ml-auto"
          path="/api/v1/archive"
          query={{ object_type: objectType || undefined, status: status || undefined }}
        />
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : t('archive.error')}
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        emptyTitle={t('archive.empty')}
        emptyDescription=""
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
        onRowClick={(row) => setSelectedId(row.id)}
      />

      {creating && (
        <ArchiveObjectModal
          onClose={() => setCreating(false)}
          onArchived={(itemId) => {
            setCreating(false);
            setSelectedId(itemId);
          }}
        />
      )}

      {selectedId && <ArchiveItemDrawer itemId={selectedId} canManage={canManage} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
