/**
 * The write form's OWN client-side checks (task-4 brief: "Enforce it in the
 * create form so the operator gets a useful message instead of a 422") and
 * the one field asymmetry between create and edit — `code` is not
 * patchable at all (`RuleParameterPatch` has no such field), so edit mode
 * never renders it, rather than rendering a disabled one.
 */
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { RuleParameterFormModal } from './RuleParameterFormModal';
import { I18nContext } from '../../../i18n/context';
import type { RuleParameterOut } from './api';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ROW: RuleParameterOut = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  code: 'coef_sb:qoramol',
  value: '0.8',
  unit: null,
  effective_from: '2026-01-01',
  effective_to: null,
  basis: 'provisional',
  status: 'draft',
  created_by: null,
  approved_by: null,
  created_at: '2026-01-01T00:00:00+05:00',
};

function renderModal(mode: 'create' | 'edit', row?: RuleParameterOut) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>{children}</I18nContext.Provider>
    </QueryClientProvider>
  );
  render(<RuleParameterFormModal mode={mode} row={row} onClose={onClose} onSaved={onSaved} />, { wrapper });
  return { onClose, onSaved };
}

function fillCommonFields(basis = 'Some basis') {
  fireEvent.change(screen.getByTestId('rp-effective-from'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByTestId('rp-basis'), { target: { value: basis } });
}

test('edit mode never renders a code field — RuleParameterPatch has no such field at all', () => {
  renderModal('edit', ROW);
  expect(screen.queryByTestId('rp-code')).not.toBeInTheDocument();
});

test('create mode rejects a code that does not match the server pattern, without calling the API', async () => {
  const user = userEvent.setup();
  let called = false;
  server.use(
    http.post('*/api/v1/rule-parameters', () => {
      called = true;
      return HttpResponse.json(ROW, { status: 201 });
    }),
  );
  renderModal('create');

  await user.type(screen.getByTestId('rp-code'), 'Not A Valid Code!');
  fillCommonFields();
  await user.click(screen.getByText('norms.params.form.save'));

  expect(await screen.findByText('norms.params.form.codeInvalid')).toBeInTheDocument();
  expect(called).toBe(false);
});

test('a missing basis is refused locally with its own message', async () => {
  const user = userEvent.setup();
  renderModal('create');

  await user.type(screen.getByTestId('rp-code'), 'coef_sb:qoramol');
  fireEvent.change(screen.getByTestId('rp-effective-from'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByTestId('rp-value'), { target: { value: '"0.8"' } });
  await user.click(screen.getByText('norms.params.form.save'));

  expect(await screen.findByText('norms.params.form.basisRequired')).toBeInTheDocument();
});

// Review round 1, minor 1: a fresh create form's JSON value editor used to
// default its text to the literal `'null'`, which parses cleanly — so the
// value field (marked required) could be saved without ever being filled.
test('an untouched value field on create is refused locally as required, without calling the API', async () => {
  const user = userEvent.setup();
  let called = false;
  server.use(
    http.post('*/api/v1/rule-parameters', () => {
      called = true;
      return HttpResponse.json(ROW, { status: 201 });
    }),
  );
  renderModal('create');

  // The value editor starts EMPTY on create (fixed) — not the text 'null'
  // that used to parse into a silently-accepted `null` value.
  expect(screen.getByTestId('rp-value')).toHaveValue('');

  await user.type(screen.getByTestId('rp-code'), 'coef_sb:qoramol');
  fillCommonFields();
  await user.click(screen.getByText('norms.params.form.save'));

  expect(await screen.findByText('norms.params.form.valueRequired')).toBeInTheDocument();
  expect(called).toBe(false);
});

test('a valid create submits the typed value in the request body and reports the saved row back to the caller', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.post('*/api/v1/rule-parameters', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json(ROW, { status: 201 });
    }),
  );
  const { onSaved } = renderModal('create');

  await user.type(screen.getByTestId('rp-code'), 'coef_sb:qoramol');
  fireEvent.change(screen.getByTestId('rp-value'), { target: { value: '"0.8"' } });
  fillCommonFields();
  await user.click(screen.getByText('norms.params.form.save'));

  // Not `toHaveBeenCalledWith(ROW)`: `onSaved` is wired straight in as
  // `useMutation`'s own `onSuccess`, whose real signature is
  // `(data, variables, context)` — react-query passes all three, so an
  // exact-arguments check would fail on the extra ones despite the row
  // itself being correct. `ParamsTab`'s own usage is a one-arg arrow
  // function, which simply ignores what it does not declare.
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(onSaved.mock.calls[0][0]).toEqual(ROW);
  // The actual request body is what minor 1 asked this test to prove: the
  // JSON editor's typed text really reaches the server as the parsed JSON
  // value `"0.8"` (a string), not the unfilled default.
  expect(sentBody).toMatchObject({ code: 'coef_sb:qoramol', value: '0.8', basis: 'Some basis' });
});

test('editing a draft with a NUMBER value keeps the numeric editor and sends a real number', async () => {
  const user = userEvent.setup();
  let sentBody: unknown;
  server.use(
    http.patch('*/api/v1/rule-parameters/:id', async ({ request }) => {
      sentBody = await request.json();
      return HttpResponse.json({ ...ROW, value: 12 });
    }),
  );
  const { onSaved } = renderModal('edit', { ...ROW, value: 10 });

  const valueInput = screen.getByTestId('rp-value');
  expect(valueInput).toHaveValue(10);
  fireEvent.change(valueInput, { target: { value: '12' } });
  await user.click(screen.getByText('norms.params.form.save'));

  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect((sentBody as { value: number }).value).toBe(12);
});
