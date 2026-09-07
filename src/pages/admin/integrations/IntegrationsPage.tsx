import { useState } from 'react';
import { Loader2, RotateCcw, RefreshCw, Trash2, FileSearch } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Pagination, Tabs } from '../../../components/ui/Navigation';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { useAuth } from '../../../auth/useAuth';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import type { DeadLetterOut, OutboxMessageOut } from './api';
import { INTEGRATIONS_MANAGE } from './permissions';
import {
  useDeadLetterList,
  useDiscardDeadLetter,
  useOutboxList,
  useRequeueOutboxMessage,
} from './queries';
import {
  LABELS,
  LETTER_STATUSES,
  OUTBOX_STATUSES,
  letterStatusLabel,
  outboxStatusLabel,
  type IntegrationsLabels,
} from './labels';

const PAGE_SIZE = 20;

/** `"2026-09-04T08:00:00+05:00"` -> `"04.09.2026, 08:00"`. Folder-local by the
 *  same convention `permits/format.ts` and `staff/format.ts` follow — eight
 *  lines duplicated rather than a cross-track import. */
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const CARD = 'bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs';
/** The same card, tightened for use inside a modal. */
const CARD_TIGHT = 'bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs';

// ── shared bits ────────────────────────────────────────────────────────────

/** A status chip. `dead`/`discarded` read as failures, `delivered` as done. */
function StatusBadge({ status, label }: { status: string; label: string }) {
  const tone =
    status === 'dead' || status === 'discarded'
      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]'
      : status === 'delivered' || status === 'reprocessed'
        ? 'bg-[#F0F7F1] text-[#15803D] border-[#BBE0C6]'
        : 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>
      {label}
    </span>
  );
}

/**
 * The record itself, pretty-printed. `overflow-x-auto` on the block (never on
 * the page) is what keeps a 400-character `last_error` from pushing the
 * whole 375px layout sideways; `break-words` wraps the rest.
 */
function JsonBlock({ value, testId }: { value: unknown; testId: string }) {
  return (
    <pre
      data-testid={testId}
      className="overflow-x-auto max-h-72 overflow-y-auto bg-[#F8F9FA] border border-[#E4E7EA] rounded-lg p-3 text-[11px] leading-relaxed text-[#1A1F24] font-mono"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** One `label: value` line of the confirmation dialogs — the part that makes
 *  a confirmation name its subject instead of asking "are you sure". */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2 py-1 border-b border-[#E4E7EA] last:border-0">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-[#5A646D] sm:w-40 shrink-0">
        {label}
      </span>
      <span className="text-xs text-[#1A1F24] break-all">{children}</span>
    </div>
  );
}

function DetailsModal({
  title,
  record,
  error,
  L,
  onClose,
}: {
  title: string;
  record: unknown;
  error: string | null;
  L: IntegrationsLabels;
  onClose: () => void;
}) {
  return (
    <Modal isOpen title={title} onClose={onClose} maxWidth="2xl">
      <div data-testid="details-modal" className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] mb-1.5">{L.detailsError}</h4>
          <div
            data-testid="details-error"
            className="overflow-x-auto bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg p-3 text-xs text-[#991B1B] font-mono whitespace-pre-wrap break-words"
          >
            {error || L.detailsNoError}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] mb-1.5">{L.detailsRecord}</h4>
          <JsonBlock value={record} testId="details-json" />
        </div>
        <p className="text-xs text-[#5A646D] leading-relaxed">{L.detailsPayloadWithheld}</p>
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {L.actionClose}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  testId,
  title,
  lead,
  warning,
  confirmLabel,
  confirmVariant,
  isSubmitting,
  facts,
  L,
  onCancel,
  onConfirm,
}: {
  testId: string;
  title: string;
  lead: string;
  warning?: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'danger';
  isSubmitting: boolean;
  facts: React.ReactNode;
  L: IntegrationsLabels;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal isOpen title={title} onClose={onCancel} maxWidth="lg">
      <div data-testid={testId} className="space-y-4">
        <p className="text-sm text-[#1A1F24]">{lead}</p>
        <div className={CARD_TIGHT}>{facts}</div>
        {warning && (
          <Alert variant="danger">
            <span className="text-xs leading-relaxed">{warning}</span>
          </Alert>
        )}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSubmitting}>
            {L.actionCancel}
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} isLoading={isSubmitting}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Shared chrome of both tabs: the error banners, the empty/loading rows and
 *  the footer. Only the columns and the actions differ. */
function TableShell({
  columns,
  isLoading,
  isEmpty,
  emptyText,
  loadingText,
  children,
  total,
  page,
  onPageChange,
  L,
}: {
  columns: string[];
  isLoading: boolean;
  isEmpty: boolean;
  emptyText: string;
  loadingText: string;
  children: React.ReactNode;
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  L: IntegrationsLabels;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
      {/* The one horizontal scroller on the screen: the table is wider than a
          phone, the page is not. */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
              {columns.map((column, index) => (
                <th key={column} className={`p-3 ${index === columns.length - 1 ? 'text-right' : ''}`}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EA]">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-[#5A646D]">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                  {loadingText}
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-[#5A646D]">
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
      {total > 0 && (
        <div className="px-4 border-t border-[#E4E7EA]">
          <div className="pt-3 text-xs text-[#5A646D]">
            {total} {L.totalRecords}
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}

// ── the outbox tab ─────────────────────────────────────────────────────────

function OutboxTab({ L }: { L: IntegrationsLabels }) {
  const { me } = useAuth();
  const errorText = useApiErrorText();
  // Both list routes accept EITHER `admin.integrations.view` or
  // `admin.integrations.manage` (`require_any_permission`), which is why the
  // page itself opens on the weaker `.view` code — but `POST .../requeue`
  // requires `.manage` alone, so a view-only holder must not be offered the
  // button at all (house rule: an action the backend would refuse is not
  // offered).
  const canManage = !!me && (me.is_superuser || me.permissions.includes(INTEGRATIONS_MANAGE));
  const [form, setForm] = useState({ status: '', destination: '' });
  const [applied, setApplied] = useState({ status: '', destination: '' });
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<OutboxMessageOut | null>(null);
  const [confirming, setConfirming] = useState<OutboxMessageOut | null>(null);

  const list = useOutboxList({
    status: applied.status || undefined,
    destination: applied.destination || undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const requeue = useRequeueOutboxMessage();

  function apply() {
    setApplied(form);
    setPage(1);
  }

  function reset() {
    setForm({ status: '', destination: '' });
    setApplied({ status: '', destination: '' });
    setPage(1);
  }

  function askRequeue(message: OutboxMessageOut) {
    // Clear the previous failure so a fresh dialog does not open under a
    // stale red banner from an unrelated row.
    requeue.reset();
    setConfirming(message);
  }

  function doRequeue() {
    if (!confirming) return;
    // `onSettled`, not `onSuccess`: on a refusal the dialog gets out of the
    // way so the operator can actually read the banner it would otherwise
    // cover — the modal is a fixed overlay above the page.
    requeue.mutate(confirming.id, { onSettled: () => setConfirming(null) });
  }

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className={`${CARD} space-y-3`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <FormField label={L.filterStatus}>
            <Select
              data-testid="outbox-status-filter"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              options={[
                { value: '', label: L.filterStatusAll },
                ...OUTBOX_STATUSES.map((status) => ({ value: status, label: outboxStatusLabel(status, L) })),
              ]}
            />
          </FormField>
          <FormField label={L.filterDestination}>
            <Input
              data-testid="outbox-destination-filter"
              value={form.destination}
              onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
              placeholder={L.filterDestinationPlaceholder}
            />
          </FormField>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={reset}>
            {L.filterReset}
          </Button>
          <Button variant="primary" size="sm" onClick={apply}>
            {L.filterApply}
          </Button>
        </div>
      </div>

      {list.error && (
        <div data-testid="list-error">
          <Alert variant="danger">{errorText(list.error, L.stateListFailed)}</Alert>
        </div>
      )}
      {requeue.error && (
        <div data-testid="action-error">
          <Alert variant="danger" onClose={() => requeue.reset()}>
            {errorText(requeue.error, L.stateActionFailed)}
          </Alert>
        </div>
      )}

      <TableShell
        columns={[
          L.colDestination,
          L.colStatus,
          L.colAttempts,
          L.colNextAttempt,
          L.colCreated,
          L.colLastError,
          L.colActions,
        ]}
        isLoading={list.isLoading}
        isEmpty={items.length === 0}
        emptyText={L.stateEmptyOutbox}
        loadingText={L.stateLoading}
        total={list.data?.total ?? 0}
        page={page}
        onPageChange={setPage}
        L={L}
      >
        {items.map((message) => (
          <tr key={message.id} data-testid={`outbox-row-${message.id}`} className="hover:bg-[#F8F9FA]">
            <td className="p-3 font-semibold text-[#1A1F24] whitespace-nowrap">{message.destination}</td>
            <td className="p-3">
              <StatusBadge status={message.status} label={outboxStatusLabel(message.status, L)} />
            </td>
            <td className="p-3 tabular-nums">{message.attempts}</td>
            <td className="p-3 whitespace-nowrap text-[#5A646D]">{formatDateTime(message.next_attempt_at)}</td>
            <td className="p-3 whitespace-nowrap text-[#5A646D]">{formatDateTime(message.created_at)}</td>
            <td className="p-3 max-w-[240px]">
              <span className="block truncate text-[#B91C1C]" title={message.last_error ?? ''}>
                {message.last_error ?? '—'}
              </span>
            </td>
            <td className="p-3">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FileSearch className="w-3.5 h-3.5" />}
                  onClick={() => setDetails(message)}
                >
                  {L.actionDetails}
                </Button>
                {/* Only a `dead` row can be requeued — the backend refuses
                    anything else with `ERR-VAL-001 / not_dead`, so offering
                    the button elsewhere would offer a guaranteed error. A
                    view-only holder gets the same treatment: the backend
                    refuses with 403 for lacking `.manage`, so the button is
                    not offered to them either. */}
                {message.status === 'dead' ? (
                  canManage ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => askRequeue(message)}
                    >
                      {L.actionRequeue}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-[#9AA3AB] self-center max-w-[160px] text-right">
                      {L.requeueNoPermission}
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-[#9AA3AB] self-center max-w-[160px] text-right">
                    {L.requeueOnlyDead}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {details && (
        <DetailsModal
          title={L.detailsOutboxTitle}
          record={details}
          error={details.last_error}
          L={L}
          onClose={() => setDetails(null)}
        />
      )}

      {confirming && (
        <ConfirmModal
          testId="confirm-requeue"
          title={L.requeueTitle}
          lead={L.requeueLead}
          confirmLabel={L.requeueConfirm}
          confirmVariant="primary"
          isSubmitting={requeue.isPending}
          L={L}
          onCancel={() => setConfirming(null)}
          onConfirm={doRequeue}
          facts={
            <>
              <Fact label={L.colDestination}>{confirming.destination}</Fact>
              <Fact label={L.fieldId}>{confirming.id}</Fact>
              <Fact label={L.colAttempts}>{confirming.attempts}</Fact>
              <Fact label={L.colCreated}>{formatDateTime(confirming.created_at)}</Fact>
              <Fact label={L.colLastError}>{confirming.last_error ?? '—'}</Fact>
            </>
          }
        />
      )}
    </div>
  );
}

// ── the dead-letter tab ────────────────────────────────────────────────────

function DeadLettersTab({ L }: { L: IntegrationsLabels }) {
  const { me } = useAuth();
  const errorText = useApiErrorText();
  // Same asymmetry as `OutboxTab.canManage` above: the list route accepts
  // either code, `POST .../discard` requires `.manage` alone.
  const canManage = !!me && (me.is_superuser || me.permissions.includes(INTEGRATIONS_MANAGE));
  const [form, setForm] = useState({ status: '' });
  const [applied, setApplied] = useState({ status: '' });
  const [page, setPage] = useState(1);
  const [details, setDetails] = useState<DeadLetterOut | null>(null);
  const [confirming, setConfirming] = useState<DeadLetterOut | null>(null);

  const list = useDeadLetterList({ status: applied.status || undefined, page, page_size: PAGE_SIZE });
  const discard = useDiscardDeadLetter();

  function apply() {
    setApplied(form);
    setPage(1);
  }

  function reset() {
    setForm({ status: '' });
    setApplied({ status: '' });
    setPage(1);
  }

  function askDiscard(letter: DeadLetterOut) {
    discard.reset();
    setConfirming(letter);
  }

  function doDiscard() {
    if (!confirming) return;
    discard.mutate(confirming.id, { onSettled: () => setConfirming(null) });
  }

  const items = list.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className={`${CARD} space-y-3`}>
        {/* `list_dead_letters` takes `status` and paging — and nothing else.
            No `source` filter is offered because the route accepts none. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <FormField label={L.filterStatus}>
            <Select
              data-testid="letters-status-filter"
              value={form.status}
              onChange={(e) => setForm({ status: e.target.value })}
              options={[
                { value: '', label: L.filterStatusAll },
                ...LETTER_STATUSES.map((status) => ({ value: status, label: letterStatusLabel(status, L) })),
              ]}
            />
          </FormField>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={reset}>
            {L.filterReset}
          </Button>
          <Button variant="primary" size="sm" onClick={apply}>
            {L.filterApply}
          </Button>
        </div>
      </div>

      {list.error && (
        <div data-testid="list-error">
          <Alert variant="danger">{errorText(list.error, L.stateListFailed)}</Alert>
        </div>
      )}
      {discard.error && (
        <div data-testid="action-error">
          <Alert variant="danger" onClose={() => discard.reset()}>
            {errorText(discard.error, L.stateActionFailed)}
          </Alert>
        </div>
      )}

      <TableShell
        columns={[L.colSource, L.colStatus, L.colError, L.colReceived, L.colProcessedAt, L.colActions]}
        isLoading={list.isLoading}
        isEmpty={items.length === 0}
        emptyText={L.stateEmptyLetters}
        loadingText={L.stateLoading}
        total={list.data?.total ?? 0}
        page={page}
        onPageChange={setPage}
        L={L}
      >
        {items.map((letter) => (
          <tr key={letter.id} data-testid={`letter-row-${letter.id}`} className="hover:bg-[#F8F9FA]">
            <td className="p-3 font-semibold text-[#1A1F24] whitespace-nowrap">{letter.source}</td>
            <td className="p-3">
              <StatusBadge status={letter.status} label={letterStatusLabel(letter.status, L)} />
            </td>
            <td className="p-3 max-w-[280px]">
              <span className="block truncate text-[#B91C1C]" title={letter.error}>
                {letter.error}
              </span>
            </td>
            <td className="p-3 whitespace-nowrap text-[#5A646D]">{formatDateTime(letter.received_at)}</td>
            <td className="p-3 whitespace-nowrap text-[#5A646D]">{formatDateTime(letter.processed_at)}</td>
            <td className="p-3">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<FileSearch className="w-3.5 h-3.5" />}
                  onClick={() => setDetails(letter)}
                >
                  {L.actionDetails}
                </Button>
                {/* Only a `new` letter can be discarded: one already triaged
                    would have its trail overwritten, so the backend refuses
                    (`ERR-VAL-001 / not_new`) and the button is not offered.
                    A view-only holder gets the same treatment — the backend
                    refuses with 403 for lacking `.manage`. */}
                {letter.status === 'new' ? (
                  canManage ? (
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => askDiscard(letter)}
                    >
                      {L.actionDiscard}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-[#9AA3AB] self-center max-w-[160px] text-right">
                      {L.discardNoPermission}
                    </span>
                  )
                ) : (
                  <span className="text-[11px] text-[#9AA3AB] self-center max-w-[160px] text-right">
                    {L.discardOnlyNew}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {details && (
        <DetailsModal
          title={L.detailsLetterTitle}
          record={details}
          error={details.error}
          L={L}
          onClose={() => setDetails(null)}
        />
      )}

      {confirming && (
        <ConfirmModal
          testId="confirm-discard"
          title={L.discardTitle}
          lead={L.discardLead}
          warning={L.discardIrreversible}
          confirmLabel={L.discardConfirm}
          confirmVariant="danger"
          isSubmitting={discard.isPending}
          L={L}
          onCancel={() => setConfirming(null)}
          onConfirm={doDiscard}
          facts={
            <>
              <Fact label={L.colSource}>{confirming.source}</Fact>
              <Fact label={L.fieldId}>{confirming.id}</Fact>
              <Fact label={L.colReceived}>{formatDateTime(confirming.received_at)}</Fact>
              <Fact label={L.colError}>{confirming.error}</Fact>
            </>
          }
        />
      )}
    </div>
  );
}

// ── the screen ─────────────────────────────────────────────────────────────

type TabId = 'outbox' | 'dead-letters';

/**
 * H10 — the outbox and the inbound dead-letter queue.
 *
 * Two operational surfaces over `admin/integrations_router.py`. Both actions
 * on this screen touch real delivery, so both are confirmed: requeue puts a
 * message back on the wire, and discard is irreversible — there is no
 * un-discard route, and the backend refuses a second attempt precisely so the
 * triage trail cannot be rewritten. The discard dialog therefore names the
 * letter (source, id, arrival time, error) rather than asking "are you sure".
 *
 * The route opens on `admin.integrations.view` (`navigation.ts`) — the
 * weaker of the two codes, correctly, since both list routes accept either.
 * Requeue and discard require `admin.integrations.manage` alone
 * (`integrations_router.py`), so `OutboxTab`/`DeadLettersTab` each gate their
 * own write button on `canManage` and fall back to `requeueNoPermission` /
 * `discardNoPermission` for a view-only holder — the same "not offered when
 * the backend would refuse it" rule the status-based fallback already
 * follows.
 *
 * Neither list route returns the message body: the backend strips `payload`
 * from both schemas because an outbox row may carry a one-time SMS code. The
 * detail view shows every field the API does return, pretty-printed, and says
 * plainly where the body went — rather than rendering an empty "payload" box
 * that reads as a bug.
 *
 * The inactive tab's query is disabled, so opening the screen makes one
 * request, not two.
 */
export function IntegrationsPage() {
  const { lang } = useLanguage();
  const L = LABELS[lang];
  const [tab, setTab] = useState<TabId>('outbox');

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="integrations-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.title}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-3xl">{L.subtitle}</p>
      </div>

      <Tabs
        tabs={[
          { id: 'outbox', label: L.tabOutbox },
          { id: 'dead-letters', label: L.tabDeadLetters },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {/* Unmounted rather than hidden: the inactive tab keeps no stale
          filters, no open dialog and no in-flight request. */}
      {tab === 'outbox' ? <OutboxTab L={L} /> : <DeadLettersTab L={L} />}
    </div>
  );
}
