/**
 * H9 — notification templates.
 *
 * The register of the texts the system sends: one row per template VERSION,
 * with the event it fires on, the channel it goes out through, and — the
 * column that makes the screen honest — which version it is. Templates are
 * never overwritten: `POST /notification-templates/{id}` supersedes, so
 * editing produces v(n+1) and leaves v(n) exactly as the citizens who already
 * received it saw it. Every piece of copy here says "new version", never
 * "save changes".
 *
 * The other thing this screen exists to surface is `warning`: a save can
 * succeed and still come back with the backend complaining about the text
 * (an unresolvable `{placeholder}`, most often). It is the only channel the
 * backend has for telling the author, so `TemplateEditor` stays open on
 * success and renders it above the body fields rather than closing over it.
 */
import { useState } from 'react';
import { Plus, Pencil, Archive, RotateCcw } from 'lucide-react';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Button } from '../../../components/ui/button';
import { ExportXlsxButton } from '../../../components/ui/ExportXlsxButton';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { formatDateTime } from '../../applicant/format';
import { TEMPLATE_CHANNELS, TEMPLATE_STATUSES, type TemplateOut } from './api';
import { useArchiveTemplate, useTemplatesList } from './queries';
import { labels as LABELS } from './labels';
import { channelLabel, statusLabel, statusTone } from './display';
import { TemplateEditor } from './TemplateEditor';

const PAGE_SIZE = 20;

interface FilterState {
  event_code: string;
  channel: string;
  status: string;
}

const EMPTY_FILTERS: FilterState = { event_code: '', channel: '', status: '' };

export function TemplatesPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = LABELS[lang];

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  // `undefined` = closed; `null` = open on a blank template; a row = open on
  // that version. Three states in one variable so the editor can never be
  // open on nothing and creating can never be confused with editing.
  const [editing, setEditing] = useState<TemplateOut | null | undefined>(undefined);
  const [archiving, setArchiving] = useState<TemplateOut | null>(null);

  const queryParams = {
    event_code: applied.event_code || undefined,
    channel: applied.channel || undefined,
    status: applied.status || undefined,
    page,
    page_size: PAGE_SIZE,
  };
  const list = useTemplatesList(queryParams);
  const archive = useArchiveTemplate();

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function applyFilters() {
    setApplied(filters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  async function confirmArchive() {
    if (!archiving) return;
    try {
      await archive.mutateAsync(archiving.id);
      setArchiving(null);
    } catch {
      // Kept open with the error below, so the operator sees why nothing moved.
    }
  }

  const columns: Column<TemplateOut>[] = [
    {
      key: 'event_code',
      header: L.colEvent,
      accessor: (row) => <span className="font-mono text-xs text-[#1A1F24]">{row.event_code}</span>,
    },
    {
      key: 'channel',
      header: L.colChannel,
      accessor: (row) => <span className="text-xs">{channelLabel(row.channel, L)}</span>,
    },
    {
      key: 'version',
      header: L.colVersion,
      width: '90px',
      accessor: (row) => (
        <span className="inline-flex items-center rounded-md bg-[#F0F7F1] border border-[#D9EBDC] px-2 py-0.5 text-xs font-semibold text-[#123522]">
          {`v${row.version}`}
        </span>
      ),
    },
    {
      key: 'status',
      header: L.colStatus,
      accessor: (row) => <StatusBadge status={statusTone(row.status)} label={statusLabel(row.status, L)} size="sm" />,
    },
    {
      key: 'updated_at',
      header: L.colUpdated,
      accessor: (row) => <span className="text-xs text-[#5A646D] whitespace-nowrap">{formatDateTime(row.updated_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="templates-page">
      <div className="border-b border-[#E4E7EA] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.title}</h1>
          <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-2xl">{L.subtitle}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setEditing(null)}
          data-testid="template-create"
        >
          {L.create}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <FormField label={L.filterEventCode}>
            <Input
              value={filters.event_code}
              onChange={(e) => setFilters((f) => ({ ...f, event_code: e.target.value }))}
              placeholder="application.submitted"
              className="font-mono"
              data-testid="filter-event-code"
            />
          </FormField>
          <FormField label={L.filterChannel}>
            <Select
              value={filters.channel}
              onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
              options={[
                { value: '', label: L.all },
                ...TEMPLATE_CHANNELS.map((value) => ({ value, label: channelLabel(value, L) })),
              ]}
              data-testid="filter-channel"
            />
          </FormField>
          <FormField label={L.filterStatus}>
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              options={[
                { value: '', label: L.all },
                ...TEMPLATE_STATUSES.map((value) => ({ value, label: statusLabel(value, L) })),
              ]}
              data-testid="filter-status"
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {L.reset}
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            {L.apply}
          </Button>
          <ExportXlsxButton path="/api/v1/admin/notification-templates" query={queryParams} />
        </div>
      </div>

      {list.error && (
        <Alert variant="danger">
          <span data-testid="templates-error">
            {list.error instanceof ApiError ? errorText(list.error) : L.loadError}
          </span>
        </Alert>
      )}

      <div data-testid="templates-table">
        <DataTable<TemplateOut>
          columns={columns}
          data={list.data?.items ?? []}
          isLoading={list.isLoading}
          emptyTitle={L.emptyTitle}
          emptyDescription={L.emptyDescription}
          onRowClick={(row) => setEditing(row)}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setEditing(row)}
                title={L.edit}
                aria-label={`${L.edit}: ${row.event_code}`}
                data-testid={`template-edit-${row.id}`}
                className="p-1.5 rounded-md text-[#5A646D] hover:text-[#2E7D4F] hover:bg-[#F0F7F1] transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {row.status !== 'archived' && (
                <button
                  type="button"
                  onClick={() => setArchiving(row)}
                  title={L.archive}
                  aria-label={`${L.archive}: ${row.event_code}`}
                  data-testid={`template-archive-${row.id}`}
                  className="p-1.5 rounded-md text-[#5A646D] hover:text-[#B45309] hover:bg-[#FFFBEB] transition-colors"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          pagination={{
            currentPage: page,
            totalPages,
            onPageChange: setPage,
            totalRecords: list.data?.total,
          }}
        />
      </div>

      {editing !== undefined && (
        <TemplateEditor
          key={editing?.id ?? 'new'}
          template={editing}
          labels={L}
          onClose={() => setEditing(undefined)}
        />
      )}

      {archiving && (
        <Modal
          isOpen
          onClose={() => setArchiving(null)}
          title={L.archiveTitle}
          subtitle={`${archiving.event_code} · ${channelLabel(archiving.channel, L)} · v${archiving.version}`}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setArchiving(null)} data-testid="archive-cancel">
                {L.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmArchive}
                isLoading={archive.isPending}
                data-testid="archive-confirm-submit"
              >
                {L.archiveConfirm}
              </Button>
            </>
          }
        >
          <div className="space-y-3" data-testid="archive-confirm">
            <p>{L.archiveQuestion}</p>
            {archive.error && (
              <Alert variant="danger" title={L.archiveError}>
                {archive.error instanceof ApiError ? errorText(archive.error) : String(archive.error)}
              </Alert>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
