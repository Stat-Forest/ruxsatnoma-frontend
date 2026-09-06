/**
 * `POST /archive/{object_type}/{object_id}` — `archive.manage` only
 * (`ArchivePage.tsx` gates the button that opens this). No route lists
 * "objects eligible for archiving" (that would mean reaching into
 * `applications`/`permits` list screens this track does not own), so the
 * operator names the object directly — the same shape the backend contract
 * itself takes.
 */
import { useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Overlay';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { useArchiveObject } from './queries';
import type { ArchiveObjectType } from './api';

export function ArchiveObjectModal({ onClose, onArchived }: { onClose: () => void; onArchived: (itemId: string) => void }) {
  const t = useT();
  const [objectType, setObjectType] = useState<ArchiveObjectType>('application');
  const [objectId, setObjectId] = useState('');
  const [retentionUntil, setRetentionUntil] = useState('');
  const archive = useArchiveObject();

  function submit() {
    if (!objectId.trim()) return;
    archive.mutate(
      { objectType, objectId: objectId.trim(), retentionUntil: retentionUntil || null },
      { onSuccess: (item) => onArchived(item.id) },
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('archive.newItemModal.title')}
      maxWidth="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={archive.isPending}>
            {t('archive.newItemModal.cancel')}
          </Button>
          <Button
            variant="primary"
            isLoading={archive.isPending}
            disabled={!objectId.trim()}
            onClick={submit}
            data-testid="archive-object-submit"
          >
            {t('archive.newItemModal.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label={t('archive.newItemModal.objectType')}>
          <Select
            value={objectType}
            onChange={(e) => setObjectType(e.target.value as ArchiveObjectType)}
            options={[
              { value: 'application', label: t('archive.typeApplication') },
              { value: 'permit', label: t('archive.typePermit') },
            ]}
          />
        </FormField>
        <FormField label={t('archive.newItemModal.objectId')}>
          <Input
            value={objectId}
            onChange={(e) => setObjectId(e.target.value)}
            placeholder={t('archive.newItemModal.objectIdPlaceholder')}
            data-testid="archive-object-id"
          />
        </FormField>
        <FormField label={t('archive.newItemModal.retentionUntil')}>
          <Input type="date" value={retentionUntil} onChange={(e) => setRetentionUntil(e.target.value)} />
        </FormField>
        {archive.error && (
          <Alert variant="danger">
            {archive.error instanceof ApiError
              ? `${archive.error.code}: ${archive.error.message}`
              : t('archive.newItemModal.error')}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
