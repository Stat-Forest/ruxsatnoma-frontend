import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { useBeekeepersList } from './queries';
import type { BeekeeperOut } from './api';
import { BeekeeperFormModal } from './BeekeeperFormModal';
import { RemoveBeekeeperModal } from './RemoveBeekeeperModal';

const PAGE_SIZE = 20;

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'bg-[#F0F7F1] text-[#123522] border-[#D9EBDC]',
  removed: 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]',
};

/**
 * The registrar's workplace (rulings #181/#182): the Union's own beekeeper
 * certificate register, maintained by `beekeeping_registrar` (renamed from
 * `benefit_verifier`, migration 0053) — never scoped to a leshoz, and never
 * a queue of applications. `beekeepers.service.match_certificate` (backend)
 * is what an apiary claim is checked against at filing time; this screen is
 * only where the register itself is kept current.
 *
 * Search/filter follow this repo's own `applied vs draft` idiom
 * (`admin/users/UsersPage.tsx`): typing into `q` does not fire a request
 * per keystroke against a route that scans certificate/name/PINFL with
 * ILIKE — only "Apply" (or the status `Select`, which is cheap enough to
 * apply immediately) commits a new query.
 */
export function BeekeepersPage() {
  const t = useT();
  const errorText = useApiErrorText();

  const [qDraft, setQDraft] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<BeekeeperOut | null>(null);
  const [removing, setRemoving] = useState<BeekeeperOut | null>(null);

  const list = useBeekeepersList({ q: q || undefined, status: status || undefined, page, page_size: PAGE_SIZE });

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applySearch() {
    setQ(qDraft.trim());
    setPage(1);
  }

  function resetSearch() {
    setQDraft('');
    setQ('');
    setStatus('');
    setPage(1);
  }

  const columns: Column<BeekeeperOut>[] = [
    {
      key: 'certificateNo',
      header: t('beekeepers.col.certificateNo'),
      accessor: (row) => <span className="font-mono text-xs">{row.certificate_no}</span>,
    },
    {
      key: 'pinfl',
      header: t('beekeepers.col.pinfl'),
      accessor: (row) => <span className="font-mono text-xs">{row.pinfl}</span>,
    },
    { key: 'fullName', header: t('beekeepers.col.fullName'), accessor: (row) => row.full_name },
    { key: 'farmName', header: t('beekeepers.col.farmName'), accessor: (row) => row.farm_name || '—' },
    {
      key: 'status',
      header: t('beekeepers.col.status'),
      accessor: (row) => (
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${STATUS_BADGE_CLASS[row.status] ?? STATUS_BADGE_CLASS.removed}`}
        >
          {row.status === 'active' ? t('beekeepers.status.active') : t('beekeepers.status.removed')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('beekeepers.col.actions'),
      accessor: (row) => (
        <div className="flex gap-2 justify-end">
          <button
            className="text-xs font-semibold text-[#2E7D4F] hover:underline"
            onClick={() => {
              setEditing(row);
              setFormMode('edit');
            }}
            data-testid={`beekeeper-edit-${row.id}`}
          >
            {t('beekeepers.action.edit')}
          </button>
          {row.status === 'active' && (
            <button
              className="text-xs font-semibold text-[#B91C1C] hover:underline"
              onClick={() => setRemoving(row)}
              data-testid={`beekeeper-remove-${row.id}`}
            >
              {t('beekeepers.action.remove')}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 pb-16" data-testid="beekeepers-page">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('beekeepers.title')}</h1>
          <p className="text-xs md:text-sm text-[#5A646D] mt-1">{t('beekeepers.subtitle')}</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormMode('create');
          }}
          leftIcon={<Plus className="w-4 h-4" />}
          data-testid="beekeeper-create-button"
        >
          {t('beekeepers.create')}
        </Button>
      </header>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label={t('beekeepers.filters.q')}>
            <Input
              value={qDraft}
              placeholder={t('beekeepers.filters.qPlaceholder')}
              onChange={(e) => setQDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applySearch();
              }}
              data-testid="beekeepers-filter-q"
            />
          </FormField>
          <FormField label={t('beekeepers.filters.status')}>
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: t('beekeepers.filters.all') },
                { value: 'active', label: t('beekeepers.filters.active') },
                { value: 'removed', label: t('beekeepers.filters.removed') },
              ]}
              data-testid="beekeepers-filter-status"
            />
          </FormField>
        </div>
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={applySearch}>
            {t('beekeepers.apply')}
          </Button>
          <Button size="sm" variant="outline" onClick={resetSearch}>
            {t('beekeepers.reset')}
          </Button>
        </div>
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : t('beekeepers.loadError')}
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        emptyTitle={t('beekeepers.empty')}
        emptyDescription=""
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
      />

      {formMode && (
        <BeekeeperFormModal
          mode={formMode}
          beekeeper={formMode === 'edit' ? editing : null}
          onClose={() => {
            setFormMode(null);
            setEditing(null);
          }}
        />
      )}

      {removing && <RemoveBeekeeperModal beekeeper={removing} onClose={() => setRemoving(null)} onRemoved={() => setRemoving(null)} />}
    </div>
  );
}
