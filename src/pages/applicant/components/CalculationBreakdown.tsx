import type { components } from '../../../api/schema';
import { useLanguage, useT } from '../../../i18n/useT';
import { formatMoney, formatUnit } from '../format';

export type CalculationLine = components['schemas']['CalculationLineOut'];

const BREAKDOWN_I18N = {
  uz_latn: {
    title: 'Qanday hisoblandi',
    bhm: 'BHM',
    bhmNote: 'BHM — bazaviy hisoblash miqdori, hisob-kitob kunida {value} soʻm.',
    som: 'soʻm',
    head: 'bosh',
    exempt: 'qonunga koʻra toʻlov olinmaydi',
    benefit: 'Imtiyoz «{name}»: toʻlov {percent}% ga kamaytirilgan.',
    benefitFallback: 'imtiyoz',
    total: 'Jami',
    rounded: 'Jami summa butun soʻmgacha yaxlitlangan.',
  },
  uz_cyrl: {
    title: 'Қандай ҳисобланди',
    bhm: 'БҲМ',
    bhmNote: 'БҲМ — базавий ҳисоблаш миқдори, ҳисоб-китоб кунида {value} сўм.',
    som: 'сўм',
    head: 'бош',
    exempt: 'қонунга кўра тўлов олинмайди',
    benefit: 'Имтиёз «{name}»: тўлов {percent}% га камайтирилган.',
    benefitFallback: 'имтиёз',
    total: 'Жами',
    rounded: 'Жами сумма бутун сўмгача яхлитланган.',
  },
  ru: {
    title: 'Как посчитано',
    bhm: 'БРВ',
    bhmNote: 'БРВ — базовая расчётная величина, на дату расчёта {value} сум.',
    som: 'сум',
    head: 'гол.',
    exempt: 'по закону плата не взимается',
    benefit: 'Льгота «{name}»: плата снижена на {percent}%.',
    benefitFallback: 'льгота',
    total: 'Итого',
    rounded: 'Итоговая сумма округлена до целого сума.',
  },
  en: {
    title: 'How it was calculated',
    bhm: 'BCA',
    bhmNote: 'BCA — base calculation amount, {value} UZS on the date of calculation.',
    som: 'UZS',
    head: 'head',
    exempt: 'no fee under the law',
    benefit: 'Benefit “{name}”: fee reduced by {percent}%.',
    benefitFallback: 'benefit',
    total: 'Total',
    rounded: 'The total is rounded to a whole sum.',
  },
  kaa: {
    title: 'Qalay esaplandı',
    bhm: 'BEM',
    bhmNote: 'BEM — bazalıq esaplaw muǵdarı, esaplaw kúninde {value} swm.',
    som: 'swm',
    head: 'bas',
    exempt: 'nızamǵa muwapıq tólem alınbaydı',
    benefit: 'Jeńillik «{name}»: tólem {percent}% ke kemeytilgen.',
    benefitFallback: 'jeńillik',
    total: 'Jámi',
    rounded: 'Jámi summa pútin swmǵa shekem dóńgeleklengen.',
  },
};

/** How much a benefit takes off, in percent — `0.5` is 50, `0` is 100.
 * `null` for a modifier that does not reduce the fee at all. */
function discountPercent(modifier: string): number | null {
  const value = Number(modifier);
  if (!Number.isFinite(value) || value < 0 || value >= 1) return null;
  return Math.round((1 - value) * 10000) / 100;
}

/**
 * «How it was calculated» under a price — the backend's `lines`
 * (`norms.service.explain`, read off the very row or pre-check that priced
 * the application), one per herd group or one for the activity:
 *
 *     Sheep: 40 head × 0,1 BHM × 440 000 soʻm = 1 760 000 soʻm
 *
 * Nothing here computes a figure: every number is the backend's, so this
 * explanation and the amount billed cannot drift apart. The only arithmetic
 * is the comparison that decides whether to say the total was rounded.
 */
export function CalculationBreakdown({
  lines,
  bhm,
  amount,
  livestockName,
  activityName,
  benefitName,
}: {
  lines: CalculationLine[];
  bhm: string | null | undefined;
  amount: string | null;
  livestockName: (code: string) => string;
  activityName: (code: string) => string;
  benefitName: (code: string) => string;
}) {
  const { lang } = useLanguage();
  const t = useT();
  const tr = BREAKDOWN_I18N[lang as keyof typeof BREAKDOWN_I18N] ?? BREAKDOWN_I18N.uz_latn;
  if (lines.length === 0) return null;

  const lineName = (line: CalculationLine) => {
    if (line.livestock_code) return livestockName(line.livestock_code) || line.livestock_code;
    if (line.activity_code) return activityName(line.activity_code) || line.activity_code;
    return '';
  };
  const unit = (line: CalculationLine) =>
    line.quantity_unit === 'head' ? tr.head : formatUnit(line.quantity_unit, t, lang);

  const benefits = new Map<string, string>();
  for (const line of lines) {
    if (line.benefit_code && line.benefit_modifier) benefits.set(line.benefit_code, line.benefit_modifier);
  }
  const charged = lines.some((line) => !line.exempt);
  const linesSum = lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);
  const rounded = Math.abs(linesSum - Number(amount)) >= 0.005;

  return (
    <div data-testid="calculation-breakdown" className="pt-3 border-t border-[#BAE6FD] space-y-2 text-xs text-[#1A1F24]">
      <h3 className="font-bold text-[#0369A1]">{tr.title}</h3>
      <ul className="space-y-1">
        {lines.map((line, index) => (
          <li key={`${line.livestock_code ?? line.activity_code ?? ''}-${index}`} className="break-words">
            <span className="font-semibold">{lineName(line)}:</span>{' '}
            {line.exempt ? (
              <>
                {tr.exempt} — <strong className="font-mono">0 {tr.som}</strong>
              </>
            ) : (
              <>
                <span className="font-mono">
                  {formatMoney(line.quantity)} {unit(line)} × {formatMoney(line.coefficient)} {tr.bhm} × {formatMoney(bhm)}{' '}
                  {tr.som}
                  {line.benefit_modifier && ` × ${formatMoney(line.benefit_modifier)}`}
                </span>{' '}
                = <strong className="font-mono">{formatMoney(line.amount)} {tr.som}</strong>
              </>
            )}
          </li>
        ))}
      </ul>
      {lines.length > 1 && (
        <p>
          {tr.total}: <strong className="font-mono">{formatMoney(amount)} {tr.som}</strong>
        </p>
      )}
      {[...benefits].map(([code, modifier]) => {
        const percent = discountPercent(modifier);
        if (percent === null) return null;
        const name = benefitName(code) || tr.benefitFallback;
        return (
          <p key={code}>
            {tr.benefit.replace('{name}', name).replace('{percent}', formatMoney(String(percent)))}
          </p>
        );
      })}
      {charged && bhm && <p className="text-[#5A646D]">{tr.bhmNote.replace('{value}', formatMoney(bhm))}</p>}
      {rounded && <p className="text-[#5A646D]">{tr.rounded}</p>}
    </div>
  );
}
