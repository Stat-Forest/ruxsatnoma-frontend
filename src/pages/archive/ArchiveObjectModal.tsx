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
import { PUBLIC_NUMBER_MAX_LENGTH } from '../../api/limits';
import { useT } from '../../i18n/useT';
import { parsePermitNo } from '../../lib/permitNumber';
import { useArchiveByNumber } from './queries';
import type { ArchiveObjectType } from './api';

export function ArchiveObjectModal({ onClose, onArchived }: { onClose: () => void; onArchived: (itemId: string) => void }) {
  const t = useT();
  const [objectType, setObjectType] = useState<ArchiveObjectType>('application');
  const [applicationNumber, setApplicationNumber] = useState('');
  const [permitNo, setPermitNo] = useState('');
  const [retentionUntil, setRetentionUntil] = useState('');
  const archive = useArchiveByNumber();

  // One box, typed the way the permit is printed («А № 000002», «a2»), split
  // by the same parser the permits register and the inspector's scan use —
  // a Latin «A» is folded into the Cyrillic series, a zero or a trailing
  // letter is "invalid" rather than a quietly different number.
  const parsedPermitNo = parsePermitNo(permitNo);
  const permitSeries = parsedPermitNo?.series;
  const permitNumber = parsedPermitNo?.number;
  const permitNoInvalid = permitNo.trim() !== '' && (!permitSeries || !permitNumber);
  const canSubmit =
    objectType === 'application' ? applicationNumber.trim() !== '' : Boolean(permitSeries && permitNumber);

  function submit() {
    const retention = retentionUntil || null;
    const onSuccess = (item: { id: string }) => onArchived(item.id);
    if (objectType === 'application') {
      if (applicationNumber.trim() === '') return;
      archive.mutate({ objectType: 'application', number: applicationNumber.trim(), retentionUntil: retention }, { onSuccess });
    } else if (permitSeries && permitNumber) {
      archive.mutate({ objectType: 'permit', series: permitSeries, number: permitNumber, retentionUntil: retention }, { onSuccess });
    }
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
              maxLength={PUBLIC_NUMBER_MAX_LENGTH}
              data-testid="archive-object-number"
            />
          </FormField>
        ) : (
          <FormField
            label={t('archive.newItemModal.permitNo')}
            error={permitNoInvalid ? t('archive.newItemModal.permitNoInvalid') : undefined}
          >
            <Input
              value={permitNo}
              onChange={(e) => setPermitNo(e.target.value)}
              placeholder={t('archive.newItemModal.permitNoPlaceholder')}
              maxLength={32}
              error={permitNoInvalid}
              data-testid="archive-permit-no"
            />
          </FormField>
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
