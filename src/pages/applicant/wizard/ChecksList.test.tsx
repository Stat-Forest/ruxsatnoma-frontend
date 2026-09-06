/**
 * F3 (`docs/plans/07.3-findings.md`) — the citizen's checks panel must never
 * print a check's raw `details` object; each of the three shapes actually
 * observed on dev gets its own sentence.
 */
import { render, screen } from '@testing-library/react';
import { ChecksList } from './ChecksList';
import type { NormalizedCheck } from '../checkTypeLabels';

function check(over: Partial<NormalizedCheck>): NormalizedCheck {
  return { key: 'k1', type: 'gis_within_fund', result: 'skipped', details: null, ...over };
}

test('gis_within_fund/layer_empty reads as a sentence, never as JSON', () => {
  render(
    <ChecksList
      checks={[check({ type: 'gis_within_fund', result: 'skipped', details: { reason: 'layer_empty' } })]}
    />,
  );
  expect(screen.getByText(/hali toʻliq kiritilmagan/)).toBeInTheDocument();
  expect(screen.queryByText(/"reason"/)).not.toBeInTheDocument();
  expect(screen.queryByText(/layer_empty/)).not.toBeInTheDocument();
});

test('norm_season/no_season_defined reads as a sentence, never as JSON', () => {
  render(
    <ChecksList
      checks={[check({ type: 'norm_season', result: 'skipped', details: { reason: 'no_season_defined' } })]}
    />,
  );
  expect(screen.getByText(/mavsumiy cheklov belgilanmagan/)).toBeInTheDocument();
  expect(screen.queryByText(/no_season_defined/)).not.toBeInTheDocument();
});

test('the live preview\'s unmapped "season" type is recognised the same way', () => {
  render(<ChecksList checks={[check({ type: 'season', result: 'skipped', details: { reason: 'no_season_defined' } })]} />);
  expect(screen.getByText(/mavsumiy cheklov belgilanmagan/)).toBeInTheDocument();
});

test('norm_limit (MaxSB) reads as a plain-language load sentence, never as JSON', () => {
  render(
    <ChecksList
      checks={[
        check({
          type: 'norm_limit',
          result: 'pass',
          details: { used_sb: '50.0', max_sb: 147, committed_sb: '0', remaining_sb: '147', load_source: 'permits' },
        }),
      ]}
    />,
  );
  expect(screen.getByText(/50 shartli bosh/)).toBeInTheDocument();
  expect(screen.getByText(/147 shartli bosh/)).toBeInTheDocument();
  expect(screen.queryByText(/used_sb/)).not.toBeInTheDocument();
  expect(screen.queryByText(/load_source/)).not.toBeInTheDocument();
  expect(screen.queryByText(/permits"/)).not.toBeInTheDocument();
});

test('an unrecognised detail shape is left unsaid rather than dumped as JSON', () => {
  render(<ChecksList checks={[check({ type: 'gis_overlap', result: 'fail', details: { other_permit_id: 'p-1' } })]} />);
  expect(screen.queryByText(/other_permit_id/)).not.toBeInTheDocument();
  expect(screen.queryByText(/\{/)).not.toBeInTheDocument();
});

test('a plain string detail still renders as-is', () => {
  render(<ChecksList checks={[check({ type: 'norm_fire_ban', result: 'warning', details: 'Yongʻin xavfi eʼlon qilingan.' })]} />);
  expect(screen.getByText('Yongʻin xavfi eʼlon qilingan.')).toBeInTheDocument();
});
