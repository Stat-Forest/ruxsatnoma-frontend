/**
 * Archival is the closest thing this system has to deleting an organization,
 * and a user's `organization_id` is what scopes everything they may see — so
 * it is never one click away from the row.
 *
 * The one refusal worth naming is the backend's own: a node with active
 * children cannot be archived (`ERR-VAL-001`,
 * `details.reason === "active children"`), because the subtree has to be
 * archived leaves-first.
 */
import { Alert } from '../../../components/ui/Feedback';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { useLanguage } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import type { OrganizationOut } from '../api';
import { useLabels, type Labels } from './labels';
import { useArchiveOrganization } from './queries';

function describeArchiveError(error: unknown, labels: Labels): string {
  if (!(error instanceof ApiError)) return labels['archive.error'];
  const details = error.details as { reason?: string } | undefined;
  if (details?.reason === 'active children') return labels['archive.error.children'];
  return `${labels['archive.error']}: ${error.message}`;
}

export interface ArchiveConfirmModalProps {
  org: OrganizationOut;
  onClose: () => void;
  onArchived: () => void;
}

export function ArchiveConfirmModal({ org, onClose, onArchived }: ArchiveConfirmModalProps) {
  const labels = useLabels();
  const { lang } = useLanguage();
  const archive = useArchiveOrganization();

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={labels['archive.title']}
      maxWidth="md"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            data-testid="archive-confirm-cancel"
            onClick={onClose}
            disabled={archive.isPending}
          >
            {labels['archive.cancel']}
          </Button>
          <Button
            type="button"
            variant="danger"
            data-testid="archive-confirm-submit"
            isLoading={archive.isPending}
            onClick={() => archive.mutate(org.id, { onSuccess: onArchived })}
          >
            {labels['archive.confirm']}
          </Button>
        </>
      }
    >
      <div data-testid="archive-confirm" className="space-y-3">
        <p className="text-sm text-[#5A646D]">{labels['archive.question']}</p>
        <div className="rounded-lg border border-[#E4E7EA] bg-[#F8F9FA] p-3">
          <p className="text-sm font-semibold text-[#1A1F24]">{pickName(org.name, lang) || org.code}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[#5A646D]">{org.code}</p>
        </div>
        <Alert variant="warning">{labels['archive.warning']}</Alert>
        {archive.error && (
          <p
            data-testid="archive-error"
            role="alert"
            className="rounded-md border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-sm text-[#991B1B]"
          >
            {describeArchiveError(archive.error, labels)}
          </p>
        )}
      </div>
    </Modal>
  );
}
