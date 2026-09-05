import { render, screen } from '@testing-library/react';
import { ChecksReport } from './ChecksReport';
import type { CheckResultOut } from '../api';

const t = (key: string) => key;

test('renders pass and skipped checks quietly, with the skip reason called out', () => {
  const checks: CheckResultOut[] = [
    { check: 'validity', result: 'pass', details: {} },
    { check: 'within_fund', result: 'skipped', details: { reason: 'layer_empty' } },
  ];
  render(<ChecksReport checks={checks} t={t} />);
  expect(screen.getByTestId('check-validity')).toHaveAttribute('data-result', 'pass');
  expect(screen.getByTestId('check-within_fund')).toHaveTextContent('gis.versions.checks.skipped');
});

test('a blocking failure and an advisory warning render in visibly different registers', () => {
  const checks: CheckResultOut[] = [
    {
      check: 'overlap',
      result: 'fail',
      details: { items: [{ name: 'K-002', area_m2: 1500 }] },
    },
    {
      check: 'restrictions',
      result: 'warning',
      details: { items: [{ name: 'Fire ban zone', area_m2: 300 }] },
    },
  ];
  render(<ChecksReport checks={checks} t={t} />);

  const overlap = screen.getByTestId('check-overlap');
  expect(overlap).toHaveTextContent('gis.versions.checks.blocking');
  expect(overlap).toHaveTextContent('K-002');
  expect(overlap).toHaveTextContent('1500 m²');

  const restrictions = screen.getByTestId('check-restrictions');
  expect(restrictions).toHaveTextContent('gis.versions.checks.advisory');
  expect(restrictions).toHaveTextContent('Fire ban zone');
});

test('an empty check list renders nothing', () => {
  const { container } = render(<ChecksReport checks={[]} t={t} />);
  expect(container).toBeEmptyDOMElement();
});
