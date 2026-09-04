import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText, Receipt } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import {
  getApplicationCard,
  getApplicationTimeline,
  listActivityTypes,
  listClassifierItems,
  listInvoicesForApplication,
  listLivestockTypes,
} from './api';
import { formatDate, formatDateTime, formatMoney, pickName } from './format';
import { STATUS_BADGE_KIND, STATUS_LABELS } from './statusMeta';
import { ApplicantTimeline } from './components/ApplicantTimeline';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8000';

/**
 * B8 — the applicant's OWN application card. Deliberately the SIMPLE view:
 * status, timeline, attached documents, the calculated amount and a link to
 * the invoice. The staff card (checks, GIS conclusion, action rail, the
 * richer history) is a separate, staff-owned component built by the parallel
 * "staff path" track (`StaffApplicationCardPage`) — this file intentionally
 * does not share panels with it, per the sprint's ownership boundary: a
 * duplicated ninety-line panel costs less today than a merge conflict on a
 * shared one.
 */
export function MyApplicationCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const cardQuery = useQuery({
    queryKey: ['my-application-card', id],
    queryFn: () => getApplicationCard(id!),
    enabled: !!id,
  });
  const timelineQuery = useQuery({
    queryKey: ['my-application-timeline', id],
    queryFn: () => getApplicationTimeline(id!),
    enabled: !!id,
  });
  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const livestockTypesQuery = useQuery({ queryKey: ['livestock-types'], queryFn: listLivestockTypes });
  const docTypesQuery = useQuery({ queryKey: ['classifier-items', 'doc_types'], queryFn: () => listClassifierItems('doc_types') });
  const invoicesQuery = useQuery({
    queryKey: ['invoices-for-application', id],
    queryFn: () => listInvoicesForApplication(id!),
    enabled: !!id,
    // Most statuses never had an invoice at all; a 404-shaped empty result is
    // the normal case here, not a fetch failure worth retrying.
    retry: false,
  });

  if (!id) return null;

  if (cardQuery.isLoading) {
    return <div className="max-w-5xl mx-auto py-16 text-center text-sm text-[#5A646D]">Yuklanmoqda...</div>;
  }
  if (cardQuery.isError || !cardQuery.data) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center space-y-3">
        <p className="text-sm text-[#B91C1C]" role="alert">
          Ariza topilmadi yoki uni koʻrish huquqingiz yoʻq.
        </p>
        <Button variant="outline" onClick={() => navigate('/my/applications')}>
          Roʻyxatga qaytish
        </Button>
      </div>
    );
  }

  const card = cardQuery.data;
  const activityName = card.activity_type_id
    ? pickName(activityTypesQuery.data?.find((a) => a.id === card.activity_type_id)?.name)
    : '—';
  const livestockName = (livestockTypeId: string) =>
    pickName(livestockTypesQuery.data?.find((l) => l.id === livestockTypeId)?.name);
  const docTypeName = (docTypeItemId: string) =>
    pickName(docTypesQuery.data?.find((d) => d.id === docTypeItemId)?.name) || 'Hujjat';

  const invoice = invoicesQuery.data?.[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-16">
      <div className="flex items-center gap-2 text-xs text-[#5A646D] border-b border-[#E4E7EA] pb-3">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/my/applications')}
          className="text-[#2E7D4F] font-bold hover:bg-[#F0F7F1] cursor-pointer"
        >
          Arizalar roʻyxatiga qaytish
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[#1A1F24] font-mono">{card.number ?? `Qoralama (${card.id.slice(0, 8)})`}</h1>
            <p className="text-sm text-[#5A646D] mt-1">{activityName}</p>
          </div>
          <StatusBadge status={STATUS_BADGE_KIND[card.status]} label={STATUS_LABELS[card.status]} />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#E4E7EA] text-xs">
          <div>
            <dt className="text-[#5A646D]">Davr</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">
              {card.period_from && card.period_to ? `${formatDate(card.period_from)} — ${formatDate(card.period_to)}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#5A646D]">Maydon</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">
              {card.requested_area_ha ? `${card.requested_area_ha} ga` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-[#5A646D]">Topshirilgan</dt>
            <dd className="font-semibold text-[#1A1F24] mt-0.5">{formatDateTime(card.submitted_at)}</dd>
          </div>
        </dl>

        {card.items.length > 0 && (
          <div className="pt-3 border-t border-[#E4E7EA]">
            <dt className="text-xs text-[#5A646D] mb-1">Chorva tarkibi</dt>
            <ul className="text-xs text-[#1A1F24] space-y-0.5">
              {card.items.map((item) => (
                <li key={item.id}>
                  {livestockName(item.livestock_type_id)}: <strong>{item.head_count}</strong> bosh
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.quantity && (
          <div className="pt-3 border-t border-[#E4E7EA] text-xs">
            <span className="text-[#5A646D]">Miqdor: </span>
            <strong className="text-[#1A1F24]">{card.quantity}</strong>
          </div>
        )}

        {card.status === 'DRAFT' && (
          <div className="pt-3 border-t border-[#E4E7EA]">
            <Button variant="primary" size="sm" onClick={() => navigate(`/my/applications/new?draft=${card.id}`)} className="cursor-pointer font-bold">
              Tahrirlashni davom ettirish
            </Button>
          </div>
        )}
      </div>

      {/* Calculated amount */}
      <section className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-6 shadow-xs space-y-2">
        <h2 className="text-sm font-bold text-[#0369A1] uppercase tracking-wider">Hisoblangan summa</h2>
        {card.calculation ? (
          <>
            <div className="font-mono text-2xl font-extrabold text-[#123522]">{formatMoney(card.calculation.amount)} soʻm</div>
            <p className="text-xs text-[#5A646D]">
              rule_version: <code className="bg-white px-1 py-0.5 rounded border border-[#BAE6FD]">{card.calculation.rule_version}</code>
              {card.calculation.max_sb !== null && (
                <>
                  {' '}
                  · limit: {card.calculation.used_sb}/{card.calculation.max_sb} shartli bosh
                </>
              )}
            </p>
          </>
        ) : (
          <p className="text-xs text-[#5A646D]">Hali hisob-kitob qilinmagan.</p>
        )}

        {invoice && (
          <div className="pt-3 border-t border-[#BAE6FD] flex items-center justify-between gap-3">
            <div className="text-xs text-[#1A1F24]">
              <span className="text-[#5A646D]">Hisob-faktura: </span>
              <strong className="font-mono">{invoice.number}</strong> — {formatMoney(invoice.amount)} soʻm
            </div>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Receipt className="w-4 h-4" />}
              onClick={() => navigate(`/my/invoices/${invoice.id}`)}
              className="cursor-pointer"
            >
              Hisob-fakturani koʻrish
            </Button>
          </div>
        )}
      </section>

      {/* Documents */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs p-6 space-y-3">
        <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">
          Ilova qilingan hujjatlar {card.documents.length > 0 && `(${card.documents.length})`}
        </h2>
        {card.documents.length === 0 ? (
          <p className="text-xs text-[#5A646D]">Hujjat biriktirilmagan.</p>
        ) : (
          <ul className="space-y-2">
            {card.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 p-3 border border-[#E4E7EA] rounded-xl text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5A646D] shrink-0" />
                  <span className="font-semibold text-[#1A1F24]">{docTypeName(doc.doc_type_item_id)}</span>
                  {doc.note && <span className="text-[#5A646D]">— {doc.note}</span>}
                </div>
                <a
                  href={`${API_BASE}/api/v1/files/${doc.file_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#2E7D4F] hover:underline shrink-0"
                >
                  Yuklab olish
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Timeline */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs p-6 space-y-3">
        <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">Holatlar tarixi</h2>
        <ApplicantTimeline timeline={timelineQuery.data} />
      </section>
    </div>
  );
}
