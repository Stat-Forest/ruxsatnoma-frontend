/**
 * The write form's OWN client-side checks (task-5 brief: "Enforce it in the
 * create form so the operator gets a useful message instead of a 422"),
 * mirroring `params/RuleParameterFormModal.test.tsx`'s own structure, plus
 * the two things unique to tariffs: the identity fields
 * (`activity_type_id`/`livestock_group`) render read-only in edit mode
 * rather than as a disabled select, and the benefit-modifier row editor.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { TariffFormModal } from './TariffFormModal';
import { I18nContext } from '../../../i18n/context';
import type { TariffOut } from './api';

const ACTIVITY_TYPE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

const server = setupServer(
  http.get('*/api/v1/refs/activity-types', () =>
    HttpResponse.json([{ id: ACTIVITY_TYPE_ID, code: 'grazing', name: { ru: 'Выпас' }, quantity_unit: 'head', status: 'active' }]),
  ),
  http.get('*/api/v1/refs/classifiers/benefit_categories/items', () =>
    HttpResponse.json([
      { id: 'c-1', code: 'veteran', name: { ru: 'Ветеран' }, props: {}, valid_from: '2020-01-01', valid_to: null, status: 'active' },
      { id: 'c-2', code: 'disabled', name: { ru: 'Инвалид' }, props: {}, valid_from: '2020-01-01', valid_to: null, status: 'active' },
    ]),
  ),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ROW: TariffOut = {
  id: 'bbbbbbbb-0000-4000-8000-000000000001',
  activity_type_id: ACTIVITY_TYPE_ID,
  livestock_group: 'large_adult',
  coefficient: '1.500000',
  quantity_unit: 'head',
  benefit_modifiers: { veteran: '0.5' },
  effective_from: '2026-01-01',
  effective_to: null,
  basis: 'provisional',
  status: 'draft',
};

function renderModal(mode: 'create' | 'edit', row?: TariffOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  render(<TariffFormModal mode={mode} row={row} onClose={onClose} onSaved={onSaved} />, { wrapper });
  return { onClose, onSaved };
}

async function findActivityOption() {
  // The Select only carries the real option once `useActivityTypes` has
  // resolved — waiting on it keeps every create-mode test past that fetch.
  await screen.findByText('Выпас');
}

test('create mode renders an activity-type select and no read-only identity block', async () => {
  renderModal('create');
  await findActivityOption();
  expect(screen.getByTestId('tariff-activity-type')).toBeInTheDocument();
  expect(screen.queryByTestId('tariff-activity-type-readonly')).not.toBeInTheDocument();
});

test('edit mode shows the identity fields as read-only facts, never as a (disabled) select', async () => {
  renderModal('edit', ROW);
  // The readonly box renders immediately (falling back to the bare id until
  // `useActivityTypes` resolves) — wait for the resolved NAME specifically.
  await waitFor(() => expect(screen.getByTestId('tariff-activity-type-readonly')).toHaveTextContent('Выпас'));
  expect(screen.getByTestId('tariff-livestock-group-readonly')).toBeInTheDocument();
  expect(screen.queryByTestId('tariff-activity-type')).not.toBeInTheDocument();
  expect(screen.queryByTestId('tariff-livestock-group')).not.toBeInTheDocument();
  // Prefilled from the row, unlike the identity fields above.
  expect(screen.getByTestId('tariff-coefficient')).toHaveValue('1.500000');
});

test('an untouched create is refused locally on every required field, without calling the API', async () => {
  const user = userEvent.setup();
  let called = false;
  server.use(http.post('*/api/v1/tariffs', () => {
    called = true;
    return HttpResponse.json(ROW, { status: 201 });
  }));
  const { onSaved } = renderModal('create');
  await findActivityOption();

  await user.click(screen.getByText('norms.tariffs.form.save'));

  expect(screen.getByText('norms.tariffs.form.activityTypeRequired')).toBeInTheDocument();
  expect(screen.getByText('norms.tariffs.form.coefficientError.required')).toBeInTheDocument();
  expect(screen.getByText('norms.tariffs.form.effectiveFromRequired')).toBeInTheDocument();
  expect(screen.getByText('norms.tariffs.form.basisRequired')).toBeInTheDocument();
  expect(called).toBe(false);
  expect(onSaved).not.toHaveBeenCalled();
});

test('a coefficient with too many fractional digits is refused locally, matching decimal_places=6', async () => {
  const user = userEvent.setup();
  renderModal('create');
  await findActivityOption();

  fireEvent.change(screen.getByTestId('tariff-coefficient'), { target: { value: '1.1234567' } });
  await user.click(screen.getByText('norms.tariffs.form.save'));

  expect(screen.getByText('norms.tariffs.form.coefficientError.tooManyDigits')).toBeInTheDocument();
});

test('a valid create submits activity_type_id/livestock_group alongside the shared fields, coefficient as typed text', async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/tariffs', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body }, { status: 201 });
    }),
  );
  const { onSaved } = renderModal('create');
  await findActivityOption();

  await user.selectOptions(screen.getByTestId('tariff-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('tariff-coefficient'), { target: { value: '1.500000' } });
  fireEvent.change(screen.getByTestId('tariff-effective-from'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByTestId('tariff-basis'), { target: { value: 'VMQ 278' } });
  await user.click(screen.getByText('norms.tariffs.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).toMatchObject({
    activity_type_id: ACTIVITY_TYPE_ID,
    livestock_group: null,
    coefficient: '1.500000',
    quantity_unit: 'head',
    effective_from: '2026-02-01',
    basis: 'VMQ 278',
  });
});

test('editing sends a TariffPatch with no activity_type_id/livestock_group at all', async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | null = null;
  server.use(
    http.patch('*/api/v1/tariffs/:id', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body });
    }),
  );
  const { onSaved } = renderModal('edit', ROW);
  await screen.findByTestId('tariff-activity-type-readonly');

  await user.click(screen.getByText('norms.tariffs.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).not.toBeNull();
  expect(body).not.toHaveProperty('activity_type_id');
  expect(body).not.toHaveProperty('livestock_group');
  expect(body).toMatchObject({ coefficient: '1.500000', basis: 'provisional' });
});

test('benefit modifiers: adding a row offers only unused codes, and an out-of-range value blocks submit', async () => {
  const user = userEvent.setup();
  let called = false;
  server.use(http.post('*/api/v1/tariffs', () => {
    called = true;
    return HttpResponse.json(ROW, { status: 201 });
  }));
  renderModal('create');
  await findActivityOption();
  await screen.findByText('norms.tariffs.form.benefitAdd'); // categories loaded

  await user.click(screen.getByTestId('tariff-benefit-add'));
  await user.selectOptions(screen.getByTestId('tariff-benefit-code-0'), 'veteran');
  fireEvent.change(screen.getByTestId('tariff-benefit-modifier-0'), { target: { value: '1.5' } });

  // Fill the rest so only the benefit modifier blocks submission.
  await user.selectOptions(screen.getByTestId('tariff-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('tariff-coefficient'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('tariff-effective-from'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByTestId('tariff-basis'), { target: { value: 'VMQ 278' } });
  await user.click(screen.getByText('norms.tariffs.form.save'));

  expect(screen.getByText('norms.tariffs.form.benefitModifierError.outOfRange')).toBeInTheDocument();
  expect(called).toBe(false);
});

test('benefit modifiers: a valid row reaches the request body under its own code', async () => {
  const user = userEvent.setup();
  let body: Record<string, unknown> | null = null;
  server.use(
    http.post('*/api/v1/tariffs', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ...ROW, ...body }, { status: 201 });
    }),
  );
  const { onSaved } = renderModal('create');
  await findActivityOption();
  await screen.findByText('norms.tariffs.form.benefitAdd');

  await user.click(screen.getByTestId('tariff-benefit-add'));
  await user.selectOptions(screen.getByTestId('tariff-benefit-code-0'), 'veteran');
  fireEvent.change(screen.getByTestId('tariff-benefit-modifier-0'), { target: { value: '0.5' } });
  await user.selectOptions(screen.getByTestId('tariff-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('tariff-coefficient'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('tariff-effective-from'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByTestId('tariff-basis'), { target: { value: 'VMQ 278' } });
  await user.click(screen.getByText('norms.tariffs.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(body).toMatchObject({ benefit_modifiers: { veteran: '0.5' } });
});

test('an unknown-benefit-category refusal from the server is rendered, not swallowed', async () => {
  const user = userEvent.setup();
  server.use(
    http.post('*/api/v1/tariffs', () =>
      HttpResponse.json(
        { error: { code: 'ERR-VAL-001', message: 'unknown benefit category', details: { reason: 'unknown_benefit_category', codes: ['ghost'] } } },
        { status: 422 },
      ),
    ),
  );
  renderModal('create');
  await findActivityOption();

  await user.selectOptions(screen.getByTestId('tariff-activity-type'), ACTIVITY_TYPE_ID);
  fireEvent.change(screen.getByTestId('tariff-coefficient'), { target: { value: '1' } });
  fireEvent.change(screen.getByTestId('tariff-effective-from'), { target: { value: '2026-02-01' } });
  fireEvent.change(screen.getByTestId('tariff-basis'), { target: { value: 'VMQ 278' } });
  await user.click(screen.getByText('norms.tariffs.form.save'));

  const error = await screen.findByTestId('tariff-form-error');
  expect(error).toHaveTextContent('norms.tariffs.form.unknownBenefitCategory');
  expect(error).toHaveTextContent('ghost');
});
