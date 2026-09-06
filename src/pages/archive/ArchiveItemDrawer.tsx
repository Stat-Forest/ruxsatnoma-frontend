/**
 * One archive item's own card — `GET /archive/{id}` (`archive.view`), plus
 * the integrity-verify action (`POST /archive/{id}/verify`, `archive.manage`
 * — `canManage` is passed down from `ArchivePage`, already computed with
 * `satisfies('archive.manage', me)`, no second permission check here, same
 * shape `TicketDetailPanel.tsx` uses for its own `canManage` prop).
 *
 * `content_hash`/`storage_ref` are shown in full (monospace, wrapped) rather
 * than truncated: an operator comparing them against an external record is
 * exactly what this screen exists for.
 */
import { Link } from 'react-router';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { Drawer } from '../../components/ui/Overlay';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { useArchiveItem, useVerifyArchiveItem } from './queries';

export interface ArchiveItemDrawerProps {
  itemId: string;
  canManage: boolean;
  onClose: () => void;
}

export function ArchiveItemDrawer({ itemId, canManage, onClose }: ArchiveItemDrawerProps) {
  const t = useT();
  const detail = useArchiveItem(itemId);
  const verify = useVerifyArchiveItem(itemId);

  return (
    <Drawer isOpen onClose={onClose} title={t('archive.detail.title')}>
      {detail.isLoading ? (
        <p className="py-8 text-center text-sm text-[#5A646D]">{t('archive.loading')}</p>
      ) : detail.error ? (
        <p className="py-8 text-center text-sm text-[#991B1B]" role="alert">
          {detail.error instanceof ApiError ? `${detail.error.code}: ${detail.error.message}` : t('archive.detail.loadFailed')}
        </p>
      ) : detail.data ? (
        <div className="space-y-4" data-testid={`archive-item-detail-${detail.data.id}`}>
          <Field label={t('archive.col.objectType')}>
            {detail.data.object_type === 'application' ? t('archive.typeApplication') : t('archive.typePermit')}
          </Field>
          <Field label={t('archive.col.object')}>
            <Link
              to={detail.data.object_type === 'application' ? `/applications/${detail.data.object_id}` : `/permits/${detail.data.object_id}`}
              className="font-mono text-[#2E7D4F] hover:underline"
            >
              {detail.data.object_id}
            </Link>
          </Field>
          <Field label={t('archive.col.status')}>
            {detail.data.status === 'verified' ? t('archive.statusVerified') : t('archive.statusStored')}
          </Field>
          <Field label={t('archive.col.archivedAt')}>{new Date(detail.data.archived_at).toLocaleString()}</Field>
          <Field label={t('archive.col.retentionUntil')}>{detail.data.retention_until ?? '—'}</Field>
          <Field label={t('archive.detail.contentHash')}>
            <span className="font-mono text-xs break-all">{detail.data.content_hash}</span>
          </Field>
          <Field label={t('archive.detail.storageRef')}>
            <span className="font-mono text-xs break-all">{detail.data.storage_ref}</span>
          </Field>

          {verify.error && (
            <Alert variant="danger">
              {verify.error instanceof ApiError ? `${verify.error.code}: ${verify.error.message}` : t('archive.verifyError')}
            </Alert>
          )}

          {canManage && detail.data.status === 'stored' && (
            <Button
              variant="primary"
              size="sm"
              isLoading={verify.isPending}
              onClick={() => verify.mutate()}
              data-testid="archive-verify-button"
            >
              {t('archive.verifyButton')}
            </Button>
          )}
        </div>
      ) : null}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">{label}</p>
      <p className="mt-0.5 text-sm text-[#1A1F24]">{children}</p>
    </div>
  );
}
