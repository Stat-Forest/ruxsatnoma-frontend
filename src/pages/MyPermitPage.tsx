import { useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { Alert } from '../components/ui/Feedback';
import { toApiError } from './permits/apiErrorHelpers';
import { formatPermitNumber } from './permits/format';
import { PermitPdfPanel } from './permits/PermitPdfPanel';
import { PermitRequisitesPanel } from './permits/PermitRequisitesPanel';
import { PermitSignaturesPanel } from './permits/PermitSignaturesPanel';
import { useAuth } from '../auth/useAuth';

/**
 * B10 — the applicant's own permit: view, download the PDF, sign with ERI.
 *
 * `GET /permits/{id}` gates on ownership inside the service layer
 * (`permits/service.py::_readable_permit`), not on a route-level permission —
 * a plain citizen with no staff grant at all still reads their own permit
 * here, which is why `routes.tsx` carries no `permission` on this route.
 */
export function MyPermitPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const queryClient = useQueryClient();

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

  if (permitQuery.isLoading) {
    return <div className="text-sm text-[#5A646D]">Yuklanmoqda…</div>;
  }
  if (permitQuery.isError) {
    const e = toApiError(permitQuery.error);
    return (
      <Alert variant="danger" title="Ruxsatnoma topilmadi">
        {e.code === 'ERR-SYS-003'
          ? "Bunday ruxsatnoma mavjud emas yoki sizga tegishli emas."
          : e.message}
      </Alert>
    );
  }

  const permit = permitQuery.data!;
  // Fact 3 (task brief): a paid, unsigned permit is a real state — shown
  // honestly, never hidden behind an "active"-looking screen.
  const isPendingSignatures = permit.status === 'pending_signatures';

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans pb-16">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          Ruxsatnoma {formatPermitNumber(permit.series, permit.number)}
        </h1>
      </div>

      {isPendingSignatures && (
        <Alert variant="warning" title="Barcha imzolar hali qoʻyilmagan">
          Ruxsatnoma hujjati shakllantirilgan va toʻlov qabul qilingan, lekin u faqat toʻrtta imzoning
          barchasi qoʻyilgach kuchga kiradi. Quyida qaysi imzolar qoʻyilganini koʻrishingiz mumkin.
        </Alert>
      )}

      <PermitRequisitesPanel
        permit={permit}
        applicantName={me?.applicant && me.applicant.id === permit.applicant_id ? me.applicant.name : null}
      />

      <PermitPdfPanel
        permitId={permit.id}
        fileName={`permit-${permit.series}-${String(permit.number).padStart(6, '0')}.pdf`}
        ready={!!permit.doc_hash}
      />

      <PermitSignaturesPanel
        permit={permit}
        onSigned={() => void queryClient.invalidateQueries({ queryKey: ['permit', id] })}
      />
    </div>
  );
}
