import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ExportXlsxButton } from '../../../components/ui/ExportXlsxButton';
import { FormField, Select } from '../../../components/ui/FormControls';
import { Pagination } from '../../../components/ui/Navigation';
import { Modal } from '../../../components/ui/Overlay';
import { StatusBadge, type StatusType } from '../../../components/ui/StatusBadge';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage } from '../../../i18n/useT';
import { formatDate, formatDateTime, pickName } from '../../applicant/format';
import type { AnnouncementAdminOut, AnnouncementStatus } from './api';
import { describeAudience, type AudienceSummary } from './audience';
import { LABELS, type AnnouncementLabels } from './labels';
import { AnnouncementFormModal } from './AnnouncementFormModal';
import {
  useAnnouncementsList,
  useArchiveAnnouncement,
  usePublishAnnouncement,
  useRegions,
  useRoles,
} from './queries';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

const PAGE_SIZE = 20;

/**
 * How each status reads and how it looks. `draft` and `published` are pulled
 * as far apart as the design system allows — grey, quiet, dashed-feeling
 * against green, solid, checked — because the one thing a reader must never
 * do on this screen is mistake a live announcement for one still being
 * written.
 */
const STATUS_META: Record<AnnouncementStatus, { badge: StatusType; label: keyof AnnouncementLabels; accent: string; title: string }> = {
  draft: { badge: 'draft', label: 'statusDraft', accent: 'border-l-[#9AA3AB]', title: 'text-[#5A646D] italic' },
  published: { badge: 'approved', label: 'statusPublished', accent: 'border-l-[#2E7D4F]', title: 'text-[#1A1F24] font-semibold' },
  archived: { badge: 'warning', label: 'statusArchived', accent: 'border-l-[#B45309]', title: 'text-[#9AA3AB] line-through' },
};

function isKnownStatus(status: string): status is AnnouncementStatus {
  return status === 'draft' || status === 'published' || status === 'archived';
}

/** Screen H8 — the announcements register.
 *
 * Three of the four things it does are ordinary CRUD; the fourth,
 * `POST /publish`, is the only button in this whole admin area that puts text
 * in front of citizens, so it is the only one whose confirmation spells out
 * WHO is about to receive it rather than asking "are you sure?".
 */
export function AnnouncementsPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = LABELS[lang] ?? LABELS.uz_latn;

  const [status, setStatus] = useState<AnnouncementStatus | ''>('');
  const [page, setPage] = useState(1);
  /** `{ id: null }` — a new announcement; `{ id }` — editing that one. */
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [confirming, setConfirming] = useState<{ kind: 'publish' | 'archive'; row: AnnouncementAdminOut } | null>(null);

  const list = useAnnouncementsList({ status, page, page_size: PAGE_SIZE });
  const roles = useRoles();
  const regions = useRegions();
  const publish = usePublishAnnouncement();
  const archive = useArchiveAnnouncement();

  const roleList = roles.data ?? [];
  const regionList = regions.data ?? [];
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  function openConfirm(kind: 'publish' | 'archive', row: AnnouncementAdminOut) {
    // A stale failure from the previous row would otherwise greet the
    // operator inside a dialog about a different announcement.
    publish.reset();
    archive.reset();
    setConfirming({ kind, row });
  }

  function runConfirmed() {
    if (!confirming) return;
    const action = confirming.kind === 'publish' ? publish : archive;
    action.mutate(confirming.row.id, { onSuccess: () => setConfirming(null) });
  }

  const confirmAudience: AudienceSummary | null = confirming
    ? describeAudience(confirming.row.audience, roleList, regionList, lang)
    : null;
  const confirmFailure = confirming?.kind === 'publish' ? publish.error : archive.error;

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="announcements-page">
      <div className="border-b border-[#E4E7EA] pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.pageTitle}</h1>
          <p className="text-xs md:text-sm text-[#5A646D] mt-1">{L.pageSubtitle}</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setEditor({ id: null })}
        >
          {L.create}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField label={L.filterStatus} htmlFor="announcements-status-filter">
            <Select
              id="announcements-status-filter"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as AnnouncementStatus | '');
                setPage(1);
              }}
              options={[
                { value: '', label: L.filterAll },
                { value: 'draft', label: L.statusDraft },
                { value: 'published', label: L.statusPublished },
                { value: 'archived', label: L.statusArchived },
              ]}
            />
          </FormField>
        </div>
        <div className="mt-4 flex justify-end">
          <ExportXlsxButton path="/api/v1/admin/announcements" query={{ status, page, page_size: PAGE_SIZE }} />
        </div>
      </div>

      {list.error && (
        <div
          data-testid="announcements-error"
          role="alert"
          className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]"
        >
          {list.error instanceof ApiError ? errorText(list.error) : L.loadFailed}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[860px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">{L.colTitle}</th>
                <th className="p-3">{L.colAudience}</th>
                <th className="p-3">{L.colStatus}</th>
                <th className="p-3">{L.colPeriod}</th>
                <th className="p-3">{L.colCreated}</th>
                <th className="p-3 text-right">{L.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {L.loading}
                  </td>
                </tr>
              ) : (list.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#5A646D]">
                    {L.empty}
                  </td>
                </tr>
              ) : (
                list.data!.items.map((row) => (
                  <AnnouncementRow
                    key={row.id}
                    row={row}
                    L={L}
                    lang={lang}
                    audience={describeAudience(row.audience, roleList, regionList, lang)}
                    onEdit={() => setEditor({ id: row.id })}
                    onPublish={() => openConfirm('publish', row)}
                    onArchive={() => openConfirm('archive', row)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {list.data && list.data.total > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
          </div>
        )}
      </div>

      {editor && (
        <AnnouncementFormModal
          key={editor.id ?? 'new'}
          announcementId={editor.id}
          roles={roleList}
          regions={regionList}
          lang={lang}
          L={L}
          onClose={() => setEditor(null)}
        />
      )}

      {confirming && confirmAudience && (
        <Modal
          isOpen
          onClose={() => setConfirming(null)}
          title={confirming.kind === 'publish' ? L.publishConfirmTitle : L.archiveConfirmTitle}
          footer={
            <>
              <Button variant="outline" size="sm" onClick={() => setConfirming(null)}>
                {L.cancel}
              </Button>
              <Button
                variant={confirming.kind === 'publish' ? 'primary' : 'danger'}
                size="sm"
                onClick={runConfirmed}
                isLoading={publish.isPending || archive.isPending}
              >
                {confirming.kind === 'publish' ? L.publishConfirmAction : L.archiveConfirmAction}
              </Button>
            </>
          }
        >
          <div data-testid={confirming.kind === 'publish' ? 'publish-confirm' : 'archive-confirm'} className="space-y-3">
            <p className="font-semibold text-[#1A1F24]">{pickName(confirming.row.title, lang) || L.untitled}</p>

            {confirming.kind === 'publish' ? (
              <>
                <p className="text-sm text-[#5A646D]">{L.publishConfirmLead}</p>
                <div
                  data-testid="publish-audience"
                  className="rounded-xl border border-[#E4E7EA] bg-[#F0F7F1] p-3 space-y-2 text-sm text-[#1A1F24]"
                >
                  {confirmAudience.everyone ? (
                    <p className="font-semibold">{L.audienceEveryone}</p>
                  ) : (
                    <>
                      {confirmAudience.roleNames.length > 0 && (
                        <p>
                          <span className="text-xs uppercase tracking-wider text-[#5A646D]">{L.audienceRoles}: </span>
                          <span className="font-semibold">{confirmAudience.roleNames.join(', ')}</span>
                        </p>
                      )}
                      {confirmAudience.regionNames.length > 0 && (
                        <p>
                          <span className="text-xs uppercase tracking-wider text-[#5A646D]">{L.audienceRegions}: </span>
                          <span className="font-semibold">{confirmAudience.regionNames.join(', ')}</span>
                        </p>
                      )}
                    </>
                  )}
                </div>
                <p className="text-xs text-[#5A646D]">{L.publishConfirmTail}</p>
              </>
            ) : (
              <p className="text-sm text-[#5A646D]">{L.archiveConfirmText}</p>
            )}

            {confirmFailure && (
              <div
                data-testid={confirming.kind === 'publish' ? 'publish-error' : 'archive-error'}
                role="alert"
                className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#991B1B]"
              >
                {confirmFailure instanceof ApiError ? errorText(confirmFailure) : confirmFailure.message}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

interface AnnouncementRowProps {
  row: AnnouncementAdminOut;
  L: AnnouncementLabels;
  lang: string;
  audience: AudienceSummary;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
}

function AnnouncementRow({ row, L, lang, audience, onEdit, onPublish, onArchive }: AnnouncementRowProps) {
  // `status` is a bare `string` in the contract; an unknown value renders as
  // itself rather than being forced into one of the three known buckets.
  const meta = isKnownStatus(row.status) ? STATUS_META[row.status] : null;
  // An archived announcement has no editor to open, so its row stays plain.
  const editable = row.status !== 'archived';

  return (
    <tr
      {...(editable ? clickableRowProps(onEdit) : {})}
      data-testid={`announcement-row-${row.id}`}
      data-status={row.status}
      className={`align-top ${row.status === 'archived' ? 'bg-[#FAFAFA]' : `bg-white hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}`}`}
    >
      <td className={`p-3 border-l-4 ${meta?.accent ?? 'border-l-[#E4E7EA]'}`}>
        <span className={`block max-w-[280px] ${meta?.title ?? 'text-[#1A1F24]'}`}>
          {pickName(row.title, lang) || L.untitled}
        </span>
      </td>
      <td className="p-3 text-[#5A646D]">
        {audience.everyone ? (
          <span className="text-[#1A1F24]">{L.audienceEveryone}</span>
        ) : (
          <span className="block max-w-[240px]">
            {[...audience.roleNames, ...audience.regionNames].join(', ')}
          </span>
        )}
        {/* "Everybody" already means every LOGGED-IN user; this row also
            leaves the system entirely, and that is a different statement. */}
        {row.public_on_landing && (
          <span
            data-testid="announcement-public-badge"
            className="mt-1 inline-block px-2 py-0.5 rounded-full bg-[#F0F7F1] border border-[#D9EBDC] text-[10px] font-bold text-[#2E7D4F]"
          >
            {L.publicBadge}
          </span>
        )}
      </td>
      <td className="p-3">
        <span data-testid="announcement-status">
          <StatusBadge
            size="sm"
            status={meta?.badge ?? 'info'}
            label={meta ? L[meta.label] : row.status}
          />
        </span>
      </td>
      <td className="p-3 text-[#5A646D] whitespace-nowrap">
        {formatDate(row.publish_from)} — {formatDate(row.publish_to)}
      </td>
      <td className="p-3 text-[#5A646D] whitespace-nowrap">{formatDateTime(row.created_at)}</td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          {row.status !== 'archived' && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              {L.actionEdit}
            </Button>
          )}
          {row.status === 'draft' && (
            <Button variant="primary" size="sm" onClick={onPublish}>
              {L.actionPublish}
            </Button>
          )}
          {(row.status === 'draft' || row.status === 'published') && (
            <Button variant="secondary" size="sm" onClick={onArchive}>
              {L.actionArchive}
            </Button>
          )}
          {row.status === 'archived' && <span className="text-[#9AA3AB]">—</span>}
        </div>
      </td>
    </tr>
  );
}
