import { ArrowRight, FileCheck2, QrCode, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { CardBadge, DashboardCard } from './DashboardCard';
import type { PermitOut } from '../queries';

/**
 * The legal standing of what the citizen holds.
 *
 * The design reference put two more rows here — "GPS boundaries: 100%
 * compliant" and "field inspection findings: no violations" — and both are
 * dropped rather than filled with a plausible-looking constant: field
 * inspections are stage 4.1 (`inspections`), no module answers for them, and
 * a green tick nobody computed is worse than a row that is not there. What
 * stays is what the permit itself carries: it is signed, and its document
 * hash is the identity the QR check page verifies against.
 */
export function LegalStatusCard({ permit, t }: { permit: PermitOut | null; t: (key: string) => string }) {
  const signed = permit !== null && permit.doc_hash !== null;

  return (
    <DashboardCard
      title={t('dash.legal.title')}
      icon={ShieldCheck}
      badge={<CardBadge tone={signed ? 'brand' : 'neutral'}>QR / E-IMZO</CardBadge>}
    >
      <p className="text-sm text-[#5A646D] leading-relaxed">{t('dash.legal.body')}</p>

      <dl className="mt-4 space-y-2.5">
        <Row icon={QrCode} label={t('dash.legal.qrLabel')}>
          <span className={signed ? 'text-[#15803D]' : 'text-[#5A646D]'}>
            {signed ? t('dash.legal.qrActive') : t('dash.legal.qrNone')}
          </span>
        </Row>
        {signed ? (
          <Row icon={FileCheck2} label={t('dash.legal.hashLabel')}>
            {/* Truncated, and never presented as the whole thing: the full
                hash is on the permit's own page, where it can be copied. */}
            <span className="font-mono text-xs text-[#1A1F24]">{permit.doc_hash!.slice(0, 12)}…</span>
          </Row>
        ) : null}
      </dl>

      <Link
        to="/my/permits"
        className="mt-5 w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-[#E4E7EA] bg-white hover:bg-[#F8F9FA] text-sm font-semibold text-[#23653F] transition-colors"
      >
        {t('dash.legal.openPermits')}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </DashboardCard>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl px-3.5 py-2.5">
      <dt className="flex items-center gap-2 min-w-0 text-xs text-[#5A646D]">
        <Icon className="w-4 h-4 shrink-0 text-[#767F87]" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="text-xs font-bold shrink-0">{children}</dd>
    </div>
  );
}
