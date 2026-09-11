/**
 * `POST /archive/application/by-number` and `POST /archive/permit/by-number`
 * — `archive.manage` only (`ArchivePage.tsx` gates the button that opens
 * this). No route lists "objects eligible for archiving" (that would mean
 * reaching into `applications`/`permits` list screens this track does not
 * own), so the operator names the object by the number they read off the
 * register — an application's own number, or a permit's series and number —
 * and the backend resolves it to an object (#205 R6).
 */
import { useState } from 'react';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Modal } from '../../components/ui/Overlay';
import { ApiError } from '../../api/errors';
import { useT } from '../../i18n/useT';
import { useArchiveByNumber } from './queries';
import type { ArchiveObjectType } from './api';

export function ArchiveObjectModal({ onClose, onArchived }: { onClose: () => void; onArchived: (itemId: string) => void }) {
  const t = useT();
  const [objectType, setObjectType] = useState<ArchiveObjectType>('application');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [permitSeries, setPermitSeries] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [retentionUntil, setRetentionUntil] = useState('');
  const archive = useArchiveByNumber();

  const parsedPermitNumber = Number.parseInt(permitNumber, 10);
  const permitNumberValid = Number.isInteger(parsedPermitNumber) && parsedPermitNumber >= 1;
  const canSubmit =
    objectType === 'application' ? applicationNumber.trim() !== '' : permitSeries.trim() !== '' && permitNumberValid;

  function submit() {
    if (!canSubmit) return;
    const retention = retentionUntil || null;
    archive.mutate(
      objectType === 'application'
        ? { objectType: 'application', number: applicationNumber.trim(), retentionUntil: retention }
        : { objectType: 'permit', series: permitSeries.trim(), number: parsedPermitNumber, retentionUntil: retention },
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
            disabled={!canSubmit}
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
            data-testid="archive-object-type"
            options={[
              { value: 'application', label: t('archive.typeApplication') },
              { value: 'permit', label: t('archive.typePermit') },
            ]}
          />
        </FormField>
        {objectType === 'application' ? (
          <FormField label={t('archive.newItemModal.objectNumber')}>
            <Input
              value={applicationNumber}
              onChange={(e) => setApplicationNumber(e.target.value)}
              placeholder={t('archive.newItemModal.objectNumberPlaceholder')}
              data-testid="archive-object-number"
            />
          </FormField>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('archive.newItemModal.permitSeries')}>
              <Input
                value={permitSeries}
                onChange={(e) => setPermitSeries(e.target.value)}
                data-testid="archive-permit-series"
              />
            </FormField>
            <FormField label={t('archive.newItemModal.permitNumber')}>
              <Input
                type="text"
                inputMode="numeric"
                value={permitNumber}
                onChange={(e) => setPermitNumber(e.target.value)}
                placeholder={t('archive.newItemModal.permitNumberPlaceholder')}
                data-testid="archive-permit-number"
              />
            </FormField>
          </div>
        )}
        <FormField label={t('archive.newItemModal.retentionUntil')}>
          <Input type="date" value={retentionUntil} onChange={(e) => setRetentionUntil(e.target.value)} />
        </FormField>
        {archive.error && (
          <Alert variant="danger">
            {archive.error instanceof ApiError
              ? archive.error.code === 'ERR-SYS-003'
                ? t('archive.newItemModal.notFound')
                : `${archive.error.code}: ${archive.error.message}`
              : t('archive.newItemModal.error')}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
