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

// Stage 9, T3, item 3 — the demo's central complaint: a failed limit check
// used to print the exact same "current load / limit" sentence a PASSING
// one does, so a refused applicant saw nothing that read as a refusal.
test('a failing norm_limit check reads as a refusal, not as the same neutral sentence a passing one gets', () => {
  const details = { used_sb: '160.0', max_sb: 147, committed_sb: '0', remaining_sb: '147', load_source: 'permits' };
  render(<ChecksList checks={[check({ type: 'norm_limit', result: 'fail', details })]} />);
  expect(screen.getByText(/160 shartli bosh/)).toBeInTheDocument();
  expect(screen.getByText(/147 shartli bosh/)).toBeInTheDocument();
  // Not the passing-check sentence ("Joriy yuklama") — a distinct refusal one.
  expect(screen.queryByText(/Joriy yuklama/)).not.toBeInTheDocument();
  expect(screen.getByText(/oshib ketmoqda/)).toBeInTheDocument();
});

test('a passing norm_limit check keeps the existing neutral sentence unchanged', () => {
  const details = { used_sb: '50.0', max_sb: 147, committed_sb: '0', remaining_sb: '97', load_source: 'permits' };
  render(<ChecksList checks={[check({ type: 'norm_limit', result: 'pass', details })]} />);
  expect(screen.getByText(/Joriy yuklama/)).toBeInTheDocument();
  expect(screen.queryByText(/oshib ketmoqda/)).not.toBeInTheDocument();
});

// The general capacity shape stage 9's T4 is introducing on the backend
// (#176) — every non-grazing activity, in its own `quantity_unit`.
test('a failing capacity check (non-grazing shape) states requested/capacity/remaining with the unit', () => {
  const details = { requested: '12.5', capacity: '10', remaining: '2', unit: 'ha' };
  render(<ChecksList checks={[check({ type: 'limit', result: 'fail', details })]} />);
  expect(screen.getByText(/12,5 ha/)).toBeInTheDocument();
  expect(screen.getByText(/10 ha/)).toBeInTheDocument();
  expect(screen.getByText(/oshib ketmoqda/)).toBeInTheDocument();
});

test('a passing capacity check (non-grazing shape) states the same three numbers, informationally', () => {
  const details = { requested: '5', capacity: '10', remaining: '5', unit: 'ha' };
  render(<ChecksList checks={[check({ type: 'limit', result: 'pass', details })]} />);
  expect(screen.getByText(/5 ha/)).toBeInTheDocument();
  expect(screen.queryByText(/oshib ketmoqda/)).not.toBeInTheDocument();
});

// A contour with no capacity set at all is EXCLUSIVE, not unlimited (#176,
// Oybek's option а) — the failing check then carries a date instead of numbers.
test('an exclusive-occupied limit check names the date it frees up', () => {
  const details = { reason: 'exclusive_occupied', free_from: '2026-12-01' };
  render(<ChecksList checks={[check({ type: 'limit', result: 'fail', details })]} />);
  expect(screen.getByText(/01\.12\.2026/)).toBeInTheDocument();
  expect(screen.queryByText(/exclusive_occupied/)).not.toBeInTheDocument();
});

test('an exclusive-occupied limit check with no date still reads as "occupied", never as raw JSON', () => {
  const details = { reason: 'exclusive_occupied' };
  render(<ChecksList checks={[check({ type: 'limit', result: 'fail', details })]} />);
  expect(screen.queryByText(/\{/)).not.toBeInTheDocument();
  expect(screen.queryByText(/exclusive_occupied/)).not.toBeInTheDocument();
  // Some note is still shown — "occupied", not silence, for a reason the
  // component DOES recognise.
  expect(document.querySelector('li')?.textContent).toMatch(/band/);
});
