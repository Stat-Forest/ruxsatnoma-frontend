/**
 * `ReportDataPanel` — column metadata comes ONLY from the form
 * (`useReportForm`), never hard-coded; row values are plain
 * `Record<string, unknown>` keyed by column CODE. Four things this panel
 * must not get wrong:
 *   1. empty/missing `data.rows` renders `notGeneratedYet`, not an empty
 *      table;
 *   2. a populated table renders one header per form column and the right
 *      cell per row;
 *   3. `generate` is gated on `REPORT_EDITABLE_STATUSES` — an `approved`
 *      report offers no generate button;
 *   4. edit mode offers an `<input>` only for `source: 'manual'` columns —
 *      an `auto` column (computed by `generate`, overwritten on the next
 *      run regardless of any hand edit) stays plain text even while editing.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import { ReportDataPanel } from './ReportDataPanel';
import type { ReportFormOut, ReportOut } from './api';

const REPORT_ID = 'r1000000-0000-4000-8000-000000000001';
const FORM_ID = 'f1000000-0000-4000-8000-000000000001';
const ORG_ID = 'org00000-0000-4000-8000-000000000001';

const FORM: ReportFormOut = {
  id: FORM_ID,
  code: 'form-1',
  version: 1,
  name: { ru: 'Форма 1', uz_latn: '1-forma' },
  activity_type_id: null,
  period_type: 'month',
  columns: [
    { code: 'head_count', label: { ru: 'Поголовье', uz_latn: 'Bosh soni' }, source: 'auto', type: 'number' },
    { code: 'note', label: { ru: 'Примечание', uz_latn: 'Izoh' }, source: 'manual', type: 'text' },
    { code: 'amount', label: { ru: 'Сумма', uz_latn: 'Summa' }, source: 'auto', type: 'money' },
  ],
  rules: [],
  schedule: {},
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as unknown as ReportFormOut;

const server = setupServer(
  http.get(`*/api/v1/reports/forms/${FORM_ID}`, () => HttpResponse.json(FORM)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function report(over: Partial<ReportOut> = {}): ReportOut {
  return {
    id: REPORT_ID,
    form_id: FORM_ID,
    organization_id: ORG_ID,
    period_start: '2026-01-01',
    period_end: '2026-01-31',
    version_no: 1,
    parent_report_id: null,
    status: 'created',
    returned_by: null,
    data: { rows: [] },
    filled_by: null,
    submitted_at: null,
    returned_comment: null,
    approved_by: null,
    approved_at: null,
    due_at: null,
    created_by: 'u0000000-0000-4000-8000-000000000001',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test User', login: 'test', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
      role: { code: 'executor_staff', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: ORG_ID },
      csrf_token: 'tok-1',
      is_superuser: false,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function renderPanel(reportOut: ReportOut, permissions: string[] = ['reports.manage']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const lang = 'uz_latn' as const;
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <ReportDataPanel report={reportOut} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('missing rows renders notGeneratedYet, not an empty table', async () => {
  renderPanel(report({ data: {} }));
  expect(await screen.findByTestId('report-data-empty')).toBeInTheDocument();
  expect(screen.queryByTestId('report-data-table')).not.toBeInTheDocument();
});

test('a populated report renders the form columns and matching cell values', async () => {
  renderPanel(
    report({
      data: { rows: [{ head_count: '12', note: 'birinchi', amount: '150000.00' }] },
    }),
  );

  const table = await screen.findByTestId('report-data-table');
  expect(table).toHaveTextContent('Bosh soni');
  expect(table).toHaveTextContent('Izoh');
  expect(table).toHaveTextContent('Summa');
  expect(table).toHaveTextContent('12');
  expect(table).toHaveTextContent('birinchi');
  expect(table).toHaveTextContent('150000.00');
});

test('generate is offered in created', async () => {
  renderPanel(report({ status: 'created', data: { rows: [] } }));
  expect(await screen.findByTestId('report-data-generate')).toBeInTheDocument();
});

test('generate is hidden in approved (not an editable status)', async () => {
  renderPanel(report({ status: 'approved', data: { rows: [{ head_count: '1', note: 'x', amount: '1' }] } }));
  await screen.findByTestId('report-data-table');
  expect(screen.queryByTestId('report-data-generate')).not.toBeInTheDocument();
});

test('edit mode offers an input only for the manual column, auto columns stay plain text', async () => {
  const user = userEvent.setup();
  renderPanel(
    report({
      status: 'created',
      data: { rows: [{ head_count: '12', note: 'birinchi', amount: '150000.00' }] },
    }),
  );

  await user.click(await screen.findByTestId('report-data-edit'));

  expect(await screen.findByTestId('report-data-cell-note-0')).toBeInTheDocument();
  expect(screen.queryByTestId('report-data-cell-head_count-0')).not.toBeInTheDocument();
  expect(screen.queryByTestId('report-data-cell-amount-0')).not.toBeInTheDocument();

  const table = screen.getByTestId('report-data-table');
  expect(table).toHaveTextContent('12');
  expect(table).toHaveTextContent('150000.00');
});
