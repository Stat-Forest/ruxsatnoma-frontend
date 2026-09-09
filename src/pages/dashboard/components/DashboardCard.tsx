import type { ComponentType, ReactNode } from 'react';

/**
 * The shell every panel on the home screen sits in — the same white card,
 * hairline border and radius `permits/components/PermitCard.tsx` already
 * uses, so the dashboard reads as part of this application rather than a
 * ported design.
 */
export function DashboardCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-6 shadow-xs overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon ? <Icon className="w-5 h-5 text-[#2E7D4F] shrink-0 mt-0.5" /> : null}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1A1F24] leading-snug break-words">{title}</h2>
            {subtitle ? <p className="text-xs text-[#5A646D] mt-1 leading-relaxed break-words">{subtitle}</p> : null}
          </div>
        </div>
        {badge}
      </header>
      {children}
    </section>
  );
}

/** The pill in a card's top-right corner — a headline figure that belongs to
 *  the panel as a whole rather than to any one mark inside it. */
export function CardBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'brand' }) {
  const palette =
    tone === 'brand'
      ? 'bg-[#F0F7F1] text-[#23653F] border-[#D9EBDC]'
      : 'bg-[#F8F9FA] text-[#5A646D] border-[#E4E7EA]';
  return (
    <span
      className={`inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full border text-xs font-semibold ${palette}`}
    >
      {children}
    </span>
  );
}

/** What a panel shows when the citizen simply has nothing of that kind yet —
 *  a sentence, never an axis drawn around zero, which reads as a measurement
 *  rather than an absence. */
export function EmptyPanel({ children, testId }: { children: ReactNode; testId: string }) {
  return (
    <p
      data-testid={testId}
      className="h-[220px] flex items-center justify-center text-center text-sm text-[#5A646D] bg-[#F8F9FA] border border-dashed border-[#E4E7EA] rounded-xl px-6"
    >
      {children}
    </p>
  );
}
