/**
 * The report lifecycle panel — the task this whole track exists for. Four
 * things this panel must not get wrong (mirrors
 * `pages/permits/components/PermitLifecyclePanel.test.tsx`'s own shape):
 *   1. buttons are gated on the right permission AND the report's own
 *      current status (`transitions.ts::actionsFor`);
 *   2. `sign`/the head's own `return` ALSO require
 *      `isHeadOfReportOrg` — an `executor_head` of a DIFFERENT leshoz who
 *      still holds `reports.sign` nationally must see `noPermissionSign`,
 *      never a working button for a report that isn't theirs;
 *   3. `submit` refused with `ERR-REP-002` renders every row-level
 *      violation, not a generic message;
 *   4. `revise`'s 201 is a DIFFERENT report — `onRevised` is called with
 *      the NEW id, the caller (task 7) navigates, this panel never does.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, expect, test, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import { DICTIONARIES, I18nContext } from '../../i18n/context';
import * as eimzo from '../../lib/eimzo';
import { reportDocumentJson } from './reportDocument';
import { ReportLifecyclePanel } from './ReportLifecyclePanel';
import type { ReportOut } from './api';

const REPORT_ID = 'r1000000-0000-4000-8000-000000000001';
const ORG_ID = 'org00000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = 'org00000-0000-4000-8000-000000000002';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function report(over: Partial<ReportOut> = {}): ReportOut {
  return {
    id: REPORT_ID,
    form_id: 'f1000000-0000-4000-8000-000000000001',
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

function authValue(roleCode: string, permissions: string[], organizationId: string | null): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test User', login: 'test', phone: null, email: null, must_change_password: false, language: 'uz_latn' },
      role: { code: roleCode, name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: organizationId },
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

function renderPanel(reportOut: ReportOut, auth: AuthContextValue, onRevised: (id: string) => void = () => {}) {
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
        <AuthContext.Provider value={auth}>
          <ReportLifecyclePanel report={reportOut} onRevised={onRevised} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('created + reports.manage renders Submit; without it renders noPermission', async () => {
  renderPanel(report({ status: 'created' }), authValue('executor_staff', ['reports.manage'], ORG_ID));
  expect(await screen.findByTestId('report-action-submit')).toBeInTheDocument();

  renderPanel(report({ status: 'created' }), authValue('executor_staff', [], ORG_ID));
  expect(await screen.findByTestId('report-no-permission')).toBeInTheDocument();
});

test('submitted + executor_head of the SAME org sees Sign and Return', async () => {
  renderPanel(report({ status: 'submitted' }), authValue('executor_head', ['reports.sign'], ORG_ID));

  expect(await screen.findByTestId('report-action-sign')).toBeInTheDocument();
  expect(screen.getByTestId('report-action-return')).toBeInTheDocument();
});

test('submitted + executor_head of a DIFFERENT org sees noPermissionSign, no button', async () => {
  renderPanel(report({ status: 'submitted' }), authValue('executor_head', ['reports.sign'], OTHER_ORG_ID));

  expect(await screen.findByTestId('report-no-permission-sign')).toBeInTheDocument();
  expect(screen.queryByTestId('report-action-sign')).not.toBeInTheDocument();
  expect(screen.queryByTestId('report-action-return')).not.toBeInTheDocument();
});

test('head_approved + reports.accept (central, no org) sees Approve and Return, no identity gate', async () => {
  renderPanel(report({ status: 'head_approved' }), authValue('central_admin', ['reports.accept'], null));

  expect(await screen.findByTestId('report-action-approve')).toBeInTheDocument();
  expect(screen.getByTestId('report-action-return')).toBeInTheDocument();
});

test('approved + reports.manage renders Revise; confirming calls onRevised with the NEW id', async () => {
  const NEW_ID = 'r2000000-0000-4000-8000-000000000002';
  server.use(
    http.post(`*/api/v1/reports/${REPORT_ID}/revise`, () =>
      HttpResponse.json(report({ id: NEW_ID, status: 'created', version_no: 2, parent_report_id: REPORT_ID }), { status: 201 }),
    ),
  );
  const onRevised = vi.fn();
  const user = userEvent.setup();

  renderPanel(report({ status: 'approved' }), authValue('executor_staff', ['reports.manage'], ORG_ID), onRevised);

  await user.click(await screen.findByTestId('report-action-revise'));
  await user.click(await screen.findByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(onRevised).toHaveBeenCalledWith(NEW_ID));
});

test('approved with no revise permission renders the terminal note, not noPermission', async () => {
  renderPanel(report({ status: 'approved' }), authValue('executor_staff', [], ORG_ID));
  expect(await screen.findByTestId('report-terminal-note')).toBeInTheDocument();
  expect(screen.queryByTestId('report-no-permission')).not.toBeInTheDocument();
});

test('submit refused with ERR-REP-002 renders every row violation', async () => {
  server.use(
    http.post(`*/api/v1/reports/${REPORT_ID}/submit`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'ERR-REP-002',
            message: 'Row checks failed',
            details: {
              checks: [
                { row_index: 0, code: 'paid_exceeds_total', message: 'x' },
                { row_index: 1, code: 'period_reversed', message: 'y' },
              ],
            },
          },
        },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderPanel(report({ status: 'created' }), authValue('executor_staff', ['reports.manage'], ORG_ID));

  await user.click(await screen.findByTestId('report-action-submit'));
  await user.click(await screen.findByTestId('confirm-dialog-confirm'));

  const violations = await screen.findByTestId('submit-violations');
  expect(violations).toHaveTextContent('Qator 1');
  expect(violations).toHaveTextContent('Toʻlangan summa hisoblangan summadan koʻp');
  expect(violations).toHaveTextContent('Qator 2');
  expect(violations).toHaveTextContent('Davr tugashi boshlanishidan oldin');
});

test('sign refused server-side with ERR-SIGN-001 renders the signer message', async () => {
  server.use(
    http.post(`*/api/v1/reports/${REPORT_ID}/sign`, () =>
      HttpResponse.json(
        { error: { code: 'ERR-SIGN-001', message: 'not authorized', details: { reason: 'signer_not_authorized' } } },
        { status: 422 },
      ),
    ),
  );
  const user = userEvent.setup();
  renderPanel(report({ status: 'submitted' }), authValue('executor_head', ['reports.sign'], ORG_ID));

  await user.click(await screen.findByTestId('report-action-sign'));
  await user.type(screen.getByPlaceholderText('31708860250017'), '12345678901234');
  await user.click(screen.getByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(screen.getByTestId('confirm-dialog-error')).toBeInTheDocument());
  expect(screen.getByTestId('confirm-dialog-error')).toHaveTextContent('Faqat shu oʻrmon xoʻjaligi rahbari imzolashi mumkin');
});

// Finding 2 (review of stage 5.2): this call site was still hardwired to the
// mock builder, bypassing the mock/real switch entirely — real mode signs
// DETACHED, over the exact canonical bytes `reports/service.py::sign_report`
// hashes server-side.
test('real mode: no PINFL box, and sign calls signDocument over the canonical report bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  const user = userEvent.setup();
  let sentPkcs7 = '';
  server.use(
    http.post(`*/api/v1/reports/${REPORT_ID}/sign`, async ({ request }) => {
      sentPkcs7 = ((await request.json()) as { pkcs7: string }).pkcs7;
      return HttpResponse.json(report({ status: 'head_approved' }));
    }),
  );
  const reportOut = report({ status: 'submitted' });
  renderPanel(reportOut, authValue('executor_head', ['reports.sign'], ORG_ID));

  await user.click(await screen.findByTestId('report-action-sign'));
  expect(screen.queryByPlaceholderText('31708860250017')).not.toBeInTheDocument();
  await user.click(screen.getByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(sentPkcs7).toBe('REAL-PKCS7'));
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);
  const expectedJson = reportDocumentJson({
    reportId: reportOut.id,
    formId: reportOut.form_id,
    organizationId: reportOut.organization_id,
    periodStart: reportOut.period_start,
    periodEnd: reportOut.period_end,
    versionNo: reportOut.version_no,
    data: reportOut.data,
  });
  const signedBytes = signDocumentSpy.mock.calls[0][0];
  expect(new TextDecoder().decode(signedBytes)).toBe(expectedJson);
});

test('a real-mode signing failure shows a distinct message and never reaches the sign mutation', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  const user = userEvent.setup();
  let called = false;
  server.use(
    http.post(`*/api/v1/reports/${REPORT_ID}/sign`, () => {
      called = true;
      return HttpResponse.json(report({ status: 'head_approved' }));
    }),
  );
  renderPanel(report({ status: 'submitted' }), authValue('executor_head', ['reports.sign'], ORG_ID));

  await user.click(await screen.findByTestId('report-action-sign'));
  await user.click(screen.getByTestId('confirm-dialog-confirm'));

  await waitFor(() => expect(screen.getByTestId('confirm-dialog-error')).toBeInTheDocument());
  expect(screen.getByTestId('confirm-dialog-error')).toHaveTextContent(
    DICTIONARIES.uz_latn[eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password as keyof (typeof DICTIONARIES)['uz_latn']],
  );
  expect(called).toBe(false);
});
