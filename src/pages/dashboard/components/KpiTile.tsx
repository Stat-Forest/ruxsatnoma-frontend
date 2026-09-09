import type { ComponentType, ReactNode } from 'react';

export type TileTone = 'brand' | 'info' | 'neutral';

const VALUE_COLOR: Record<TileTone, string> = {
  brand: 'text-[#2E7D4F]',
  info: 'text-[#0369A1]',
  neutral: 'text-[#1A1F24]',
};

/**
 * One headline figure: what it measures, the figure itself, and one line of
 * context under it. The context line is not decoration — it is what stops a
 * bare "3" from being read as three of the wrong thing.
 */
export function KpiTile({
  testId,
  label,
  value,
  hint,
  hintIcon: HintIcon,
  badge,
  tone = 'neutral',
}: {
  testId: string;
  label: string;
  value: string;
  hint: string;
  hintIcon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  tone?: TileTone;
}) {
  return (
    <article
      data-testid={testId}
      className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#5A646D] leading-tight">{label}</h3>
        {badge}
      </div>
      <p className={`text-2xl font-bold font-mono tabular-nums leading-none ${VALUE_COLOR[tone]}`}>{value}</p>
      <p className="flex items-start gap-1.5 text-xs text-[#5A646D] leading-snug">
        {HintIcon ? <HintIcon className="w-3.5 h-3.5 shrink-0 text-[#767F87] mt-0.5" /> : null}
        <span className="min-w-0 break-words">{hint}</span>
      </p>
    </article>
  );
}

/** The count chip in a tile's corner — the same number the value repeats in
 *  words, kept because scanning four tiles for a digit is faster than reading
 *  four sentences. */
export function TileCount({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'info' }) {
  const palette = tone === 'brand' ? 'bg-[#F0F7F1] text-[#23653F]' : 'bg-[#EFF6FF] text-[#0369A1]';
  return (
    <span className={`shrink-0 min-w-[28px] h-7 px-2 rounded-lg grid place-items-center text-sm font-bold ${palette}`}>
      {children}
    </span>
  );
}
