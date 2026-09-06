import { benefitModifiersToRows, modifierError, rowsToBenefitModifiers } from './benefitModifiers';

test('modifierError enforces the 0..1 bound `_benefit_modifiers` checks server-side', () => {
  expect(modifierError('')).toBe('required');
  expect(modifierError('abc')).toBe('invalid');
  expect(modifierError('-0.1')).toBe('outOfRange');
  expect(modifierError('1.1')).toBe('outOfRange');
  expect(modifierError('0')).toBeNull();
  expect(modifierError('1')).toBeNull();
  expect(modifierError('0.5')).toBeNull();
});

test('benefitModifiersToRows turns the wire map into editable rows, and back', () => {
  expect(benefitModifiersToRows(null)).toEqual([]);
  expect(benefitModifiersToRows(undefined)).toEqual([]);
  expect(benefitModifiersToRows({ veteran: '0.5', disabled: '0.3' })).toEqual([
    { code: 'veteran', modifier: '0.5' },
    { code: 'disabled', modifier: '0.3' },
  ]);
});

test('rowsToBenefitModifiers drops a row with no code chosen yet', () => {
  expect(rowsToBenefitModifiers([{ code: '', modifier: '' }])).toBeUndefined();
  expect(rowsToBenefitModifiers([])).toBeUndefined();
});

test('rowsToBenefitModifiers converts code-bearing rows into the wire map, trimming the modifier', () => {
  expect(
    rowsToBenefitModifiers([
      { code: 'veteran', modifier: ' 0.5 ' },
      { code: '', modifier: '' },
    ]),
  ).toEqual({ veteran: '0.5' });
});
