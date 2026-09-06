import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stamp } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { useAuth } from '../auth/useAuth';
import { Alert } from '../components/ui/Feedback';
import { Button } from '../components/ui/button';
import { PERMITS_ISSUE } from './permits/permissions';
import { toApiError } from './permits/apiErrorHelpers';
import { formatPermitNumber } from './permits/format';
import { PermitPdfPanel } from './permits/PermitPdfPanel';
import { PermitRequisitesPanel } from './permits/PermitRequisitesPanel';
import { PermitSignaturesPanel } from './permits/PermitSignaturesPanel';
import { PermitTimelinePanel } from './permits/PermitTimelinePanel';
import { PermitLifecyclePanel } from './permits/components/PermitLifecyclePanel';

/** Every reason `POST /applications/{id}/permit` documents refusing, turned
 *  into copy an operator can act on (`permits/service.py::issue`). */
function issueErrorMessage(err: ReturnType<typeof toApiError>): string {
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.code === 'ERR-PAY-001') return "Ariza hali toʻlanmagan — ruxsatnoma faqat toʻlangan arizadan chiqariladi.";
  if (err.code === 'ERR-PERM-001') return "Bu ariza uchun ruxsatnoma allaqachon chiqarilgan.";
  if (err.code === 'ERR-ACL-002') return "Bu uchastka sizning hudud vakolatingizdan tashqarida.";
  if (err.code === 'ERR-VAL-001') {
    if (reason === 'no_calculation') return "Ariza boʻyicha hisob-kitob topilmadi.";
    if (reason === 'no_active_template') return "Bu faoliyat turi uchun ruxsatnoma shabloni sozlanmagan.";
    if (reason === 'calculation_for_another_subject') return "Hisob-kitob boshqa kontur/faoliyat turi uchun — nomuvofiqlik.";
    if (reason === 'calculation_after_decision') return "Hisob-kitob qaror qabul qilingandan keyin yaratilgan — nomuvofiqlik.";
    return err.message;
  }
  if (err.code === 'ERR-SYS-003') return "Ariza topilmadi.";
  if (err.code === 'ERR-SYS-001') return "Ruxsatnoma seriyasi sozlanmagan (tizim xatosi).";
  return err.message;
}

/**
 * The permit document as STAFF sees it: issue it, the requisites, the
 * signatures. `routes.tsx`'s `permits/:id` is a single frozen route, so this
 * component reads `:id` as EITHER a permit id (the ordinary case, reached
 * from a permit registry or a link) OR — when nothing answers `GET
 * /permits/{id}` — as the id of a PAID application still awaiting its
 * permit, offering `POST /applications/{id}/permit` right here instead of
 * requiring a second screen this sprint has no route for. On success the URL
 * is replaced with the real permit id so a reload, and a share of the link,
 * both resolve the ordinary way from then on.
 */
export function PermitDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [issueError, setIssueError] = useState<string | null>(null);

  const permitQuery = useQuery({
    queryKey: ['permit', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/permits/{permit_id}', {
        params: { path: { permit_id: id! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/applications/{application_id}/permit', {
        params: { path: { application_id: id! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: (permit) => {
      setIssueError(null);
      // Seeds the permit query cache for the NEW id so the page below renders
      // immediately, without waiting for a second round trip — `navigate`
      // then makes that id the canonical URL.
      queryClient.setQueryData(['permit', permit.id], {
        ...permit,
        signatures: [],
        history: [
          {
            from_status: null,
            to_status: permit.status,
            reason_item_id: null,
            legal_basis: null,
            doc_file_id: null,
            changed_by: me?.user.id ?? null,
            occurred_at: permit.created_at,
          },
        ],
        missing_signatures: ['permit_head', 'permit_chief_forester', 'permit_accountant', 'permit_recipient'],
      });
      navigate(`/permits/${permit.id}`, { replace: true });
    },
    onError: (err: unknown) => setIssueError(issueErrorMessage(toApiError(err))),
  });

  if (permitQuery.isLoading) {
    return <div className="text-sm text-[#5A646D]">Yuklanmoqda…</div>;
  }

  if (permitQuery.isError) {
    const e = toApiError(permitQuery.error);
    if (e.code !== 'ERR-SYS-003') {
      // Anything other than "not found" (chiefly ERR-ACL-002, a zone
      // mismatch) is a real refusal, not "this id has no permit yet".
      return (
        <Alert variant="danger" title="Ruxsatnoma ochilmadi">
          {e.code === 'ERR-ACL-002' ? "Bu ruxsatnoma sizning hudud vakolatingizga kirmaydi." : e.message}
        </Alert>
      );
    }
    const canIssue = !!me?.permissions.includes(PERMITS_ISSUE) || !!me?.is_superuser;
    return (
      <div className="max-w-2xl mx-auto space-y-4 font-sans">
        <Alert variant="info" title="Bu ID boʻyicha ruxsatnoma hali mavjud emas">
          Agar bu toʻlangan arizaning IDsi boʻlsa, quyidan ruxsatnoma chiqarishingiz mumkin. Aks holda,
          ID notoʻgʻri boʻlishi mumkin.
        </Alert>
        {issueError && <Alert variant="danger">{issueError}</Alert>}
        {canIssue && (
          <Button
            variant="primary"
            size="touch"
            fullWidth
            isLoading={issueMutation.isPending}
            leftIcon={<Stamp className="w-4 h-4" />}
            onClick={() => issueMutation.mutate()}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
          >
            Ruxsatnoma chiqarish
          </Button>
        )}
      </div>
    );
  }

  const permit = permitQuery.data!;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-16">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          Ruxsatnoma {formatPermitNumber(permit.series, permit.number)}
        </h1>
        <p className="text-xs text-[#5A646D] mt-0.5">
          Ariza <span className="font-mono text-[#1A1F24]">{permit.application_id}</span>
        </p>
      </div>

      <PermitRequisitesPanel permit={permit} />

      <PermitPdfPanel
        permitId={permit.id}
        fileName={`permit-${permit.series}-${String(permit.number).padStart(6, '0')}.pdf`}
        ready={!!permit.doc_hash}
      />

      <PermitSignaturesPanel
        permit={permit}
        onSigned={() => void queryClient.invalidateQueries({ queryKey: ['permit', id] })}
      />

      <PermitLifecyclePanel permit={permit} />

      <PermitTimelinePanel history={permit.history} />
    </div>
  );
}
