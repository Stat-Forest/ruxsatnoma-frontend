/**
 * The support-tickets queue (`tickets` tab, always visible — `SupportPage`
 * never hides it). One adaptive view, not two: the backend already scopes
 * `GET /help/tickets` server-side by the caller's own permission
 * (`help.service.list_tickets` — every ticket for a `help.tickets.manage`
 * holder, otherwise only tickets the caller opened or is assigned to). This
 * component must NOT re-filter the response on top of that — whatever the
 * server returns for this caller IS the correct list, full stop.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { satisfies } from '../../../shell/navigation';
import { Button } from '../../../components/ui/button';
import { DataTable, type Column } from '../../../components/ui/DataTable';
import { FormField, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import { formatDateTime } from '../format';
import type { TicketOut, TicketStatus } from './api';
import { TicketDetailPanel } from './TicketDetailPanel';
import { TicketFormModal } from './TicketFormModal';
import { useTicketsList } from './queries';

const PAGE_SIZE = 20;
const TICKET_STATUSES: TicketStatus[] = ['new', 'in_progress', 'resolved', 'closed'];

const STATUS_LABEL_KEY: Record<TicketStatus, string> = {
  new: 'support.tickets.statusNew',
  in_progress: 'support.tickets.statusInProgress',
  resolved: 'support.tickets.statusResolved',
  closed: 'support.tickets.statusClosed',
};

export function TicketsTab() {
  const t = useT();
  const errorText = useApiErrorText();
  const { me } = useAuth();
  const canManage = me != null && satisfies('help.tickets.manage', me);

  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useTicketsList({ status, page, page_size: PAGE_SIZE });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function assignmentLabel(row: TicketOut): string {
    if (row.assigned_to === me?.user.id) return t('support.tickets.assignedToMe');
    if (row.assigned_to != null) return t('support.tickets.assignedOther');
    return t('support.tickets.unassigned');
  }

  const columns: Column<TicketOut>[] = [
    {
      key: 'number',
      header: t('support.tickets.colNumber'),
      accessor: (row) => (
        <button
          data-testid={`ticket-open-${row.id}`}
          onClick={() => setSelectedId(row.id)}
          className="cursor-pointer font-mono font-semibold text-[#2E7D4F] hover:underline"
        >
          {row.number}
        </button>
      ),
    },
    { key: 'subject', header: t('support.tickets.colSubject'), accessor: (row) => <span className="block max-w-[280px] truncate">{row.subject}</span> },
    { key: 'status', header: t('support.tickets.colStatus'), accessor: (row) => t(STATUS_LABEL_KEY[row.status as TicketStatus] ?? row.status) },
    { key: 'assigned', header: t('support.tickets.colAssigned'), accessor: (row) => assignmentLabel(row) },
    { key: 'created_at', header: t('support.tickets.colCreated'), accessor: (row) => formatDateTime(row.created_at) },
  ];

  return (
    <div className="space-y-5" data-testid="tickets-tab">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-base font-bold text-[#1A1F24]">{t('support.tickets.title')}</h2>
          <p className="mt-1 text-xs text-[#5A646D]">{t('support.tickets.subtitle')}</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)} className="w-full sm:w-auto">
          {t('support.tickets.newTicket')}
        </Button>
      </div>

      <div className="max-w-xs">
        <FormField label={t('support.tickets.filterStatus')} htmlFor="tickets-status-filter">
          <Select
            id="tickets-status-filter"
            data-testid="tickets-status-filter"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TicketStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: t('support.common.all') },
              ...TICKET_STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL_KEY[s]) })),
            ]}
          />
        </FormField>
      </div>

      {list.error && (
        <div role="alert" data-testid="tickets-error" className="rounded-2xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]">
          {list.error instanceof ApiError ? errorText(list.error) : t('support.tickets.loadFailed')}
        </div>
      )}

      <DataTable
        columns={columns}
        data={list.data?.items ?? []}
        isLoading={list.isLoading}
        loadingText={t('support.common.loading')}
        emptyTitle={t('support.tickets.empty')}
        emptyDescription=""
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
      />

      {creating && (
        <TicketFormModal
          onClose={() => setCreating(false)}
          onCreated={(ticketId) => {
            setCreating(false);
            setSelectedId(ticketId);
          }}
        />
      )}

      {selectedId && (
        <TicketDetailPanel ticketId={selectedId} canManage={canManage} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
