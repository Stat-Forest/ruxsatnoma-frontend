/**
 * The two cases the card test does not reach: a lawful zero, which has no
 * formula and so no БҲМ to explain, and a total rounded once by the backend
 * while its lines keep their tiyin — both must be said, never left for the
 * citizen to discover as a mismatch.
 */
import { render, screen } from '@testing-library/react';
import { I18nContext } from '../../../i18n/context';
import { CalculationBreakdown, type CalculationLine } from './CalculationBreakdown';

function renderBreakdown(lines: CalculationLine[], amount: string) {
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  render(
    <I18nContext.Provider value={i18n}>
      <CalculationBreakdown
        lines={lines}
        bhm="440000"
        amount={amount}
        livestockName={() => ''}
        activityName={(code) => (code === 'science' ? 'Научные исследования' : 'Сенокошение')}
        benefitName={() => ''}
      />
    </I18nContext.Provider>,
  );
  return (screen.getByTestId('calculation-breakdown').textContent ?? '').replace(/\s+/g, ' ');
}

test('a lawful zero says the law charges nothing, and explains no БРВ', () => {
  const text = renderBreakdown([{ activity_code: 'science', amount: '0', exempt: true }], '0');

  expect(text).toContain('Научные исследования: по закону плата не взимается — 0 сум');
  expect(text).not.toContain('базовая расчётная величина');
  expect(text).not.toContain('округлена');
});

test('lines that add up to a fraction more than the total say the total was rounded', () => {
  const text = renderBreakdown(
    [
      {
        activity_code: 'haymaking',
        quantity: '1',
        quantity_unit: 'ha',
        coefficient: '0.123457',
        amount: '54321.08',
        exempt: false,
      },
    ],
    '54321',
  );

  expect(text).toContain('Сенокошение: 1 га × 0,123457 БРВ × 440 000 сум = 54 321,08 сум');
  expect(text).toContain('Итоговая сумма округлена до целого сума.');
});
