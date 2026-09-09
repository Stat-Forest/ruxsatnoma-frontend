/**
 * E3 — permit lifecycle (suspend / resume / revoke, С13).
 *
 * Four things this panel must not get wrong:
 *   1. buttons are gated on `permits.manage` and on the permit's OWN
 *      status (active -> suspend/revoke, suspended -> resume/revoke);
 *   2. `pending_signatures` renders fact #2 honestly — no button the
 *      backend would refuse with `bad_transition` (tz/12 #16);
 *   3. the reason picklist is filtered to grounds that actually apply to
 *      the act being taken (`grounds._kinds`, mirrored client-side);
 *   4. a suspend/revoke posts `pkcs7` built over the exact canonical bytes
 *      `decisions.py::decision_document()` builds server-side.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { stubAuthActions } from '../../../auth/testAuthActions';
import { I18nContext } from '../../../i18n/context';
import * as eimzo from '../../../lib/eimzo';
import { PermitLifecyclePanel } from './PermitLifecyclePanel';
import { decisionDocumentJson } from '../lifecycleDocument';
import type { PermitCardOut } from '../lifecycle';

const PERMIT_ID = 'p1000000-0000-4000-8000-000000000001';

function permit(over: Partial<PermitCardOut> = {}): PermitCardOut {
  return {
    id: PERMIT_ID,
    series: 'А',
    number: 42,
    status: 'active',
    application_id: 'a1000000-0000-4000-8000-000000000001',
    applicant_id: 'ap000000-0000-4000-8000-000000000001',
    activity_type_id: 'act00000-0000-4000-8000-000000000001',
    organization_id: 'org00000-0000-4000-8000-000000000001',
    contour_id: 'c1000000-0000-4000-8000-000000000001',
    contour_version_id: 'cv000000-0000-4000-8000-000000000001',
    area_ha: '12.5',
    period_from: '2026-01-01',
    period_to: '2026-12-31',
    amount: '2060000.00',
    sb_load: null,
    pdf_file_id: 'f0000000-0000-4000-8000-000000000001',
    doc_hash: 'a'.repeat(64),
    template_id: null,
    issued_at: '2026-08-01T10:00:00+05:00',
    document_date: '2026-08-01',
    created_at: '2026-08-01T10:00:00+05:00',
    signatures: [],
    history: [],
    missing_signatures: [],
    ...over,
  };
}

function authValue(permissions: string[]): AuthContextValue {
  return {
    me: {
      user: {
        id: 'u0000000-0000-4000-8000-000000000001',
        full_name: 'Yusupov Anvar',
        login: 'yusupov',
        phone: null,
        email: null,
        must_change_password: false,
        language: 'uz_latn',
      },
      role: { code: 'executor_head', name: {} },
      permissions,
      zone: { region_id: null, district_id: null, organization_id: 'org00000-0000-4000-8000-000000000001' },
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

const REASONS = [
  {
    id: 'ps-01',
    code: 'PS-01',
    name: { uz_latn: "Yong'in xavfi" },
    props: { kinds: ['suspend'] },
    valid_from: '2026-01-01',
    valid_to: null,
    status: 'active',
  },
  {
    id: 'ps-06',
    code: 'PS-06',
    name: { uz_latn: 'Sabab bartaraf etildi' },
    props: { kinds: ['resume'] },
    valid_from: '2026-01-01',
    valid_to: null,
    status: 'active',
  },
  {
    id: 'ps-07',
    code: 'PS-07',
    name: { uz_latn: 'Boshqa (izoh majburiy)' },
    props: { kinds: ['suspend', 'resume', 'revoke'] },
    valid_from: '2026-01-01',
    valid_to: null,
    status: 'active',
  },
];

const server = setupServer(
  http.get('*/api/v1/refs/classifiers/:code/items', () => HttpResponse.json(REASONS)),
);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

function renderPanel(permissions: string[], permitOver: Partial<PermitCardOut> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue(permissions)}>
          <PermitLifecyclePanel permit={permit(permitOver)} />
        </AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>,
  );
}

test('an active permit offers suspend and revoke to permits.manage, nothing to anyone else', () => {
  renderPanel(['permits.manage'], { status: 'active' });
  expect(screen.getByText('permits.lifecycle.suspendButton')).toBeInTheDocument();
  expect(screen.getByText('permits.lifecycle.revokeButton')).toBeInTheDocument();
  expect(screen.queryByText('permits.lifecycle.resumeButton')).not.toBeInTheDocument();
});

test('without permits.manage, no button renders and the reason is stated', () => {
  renderPanel([], { status: 'active' });
  expect(screen.queryByText('permits.lifecycle.suspendButton')).not.toBeInTheDocument();
  expect(screen.getByText('permits.lifecycle.noPermission')).toBeInTheDocument();
});

test('a suspended permit offers resume and revoke', () => {
  renderPanel(['permits.manage'], { status: 'suspended' });
  expect(screen.getByText('permits.lifecycle.resumeButton')).toBeInTheDocument();
  expect(screen.getByText('permits.lifecycle.revokeButton')).toBeInTheDocument();
  expect(screen.queryByText('permits.lifecycle.suspendButton')).not.toBeInTheDocument();
});

test('pending_signatures offers no action at all, per tz/12 #16', () => {
  renderPanel(['permits.manage'], { status: 'pending_signatures' });
  expect(screen.getByText('permits.lifecycle.pendingSignaturesNote')).toBeInTheDocument();
  expect(screen.queryByText('permits.lifecycle.suspendButton')).not.toBeInTheDocument();
  expect(screen.queryByText('permits.lifecycle.revokeButton')).not.toBeInTheDocument();
});

test('a terminal status (revoked) offers no action', () => {
  renderPanel(['permits.manage'], { status: 'revoked' });
  expect(screen.getByText('permits.lifecycle.terminalNote')).toBeInTheDocument();
  expect(screen.queryByText('permits.lifecycle.revokeButton')).not.toBeInTheDocument();
});

test('the reason picklist for suspend excludes a ground typed only for resume', async () => {
  const user = userEvent.setup();
  renderPanel(['permits.manage'], { status: 'active' });
  await user.click(screen.getByText('permits.lifecycle.suspendButton'));

  expect(await screen.findByText("Yong'in xavfi")).toBeInTheDocument();
  expect(screen.getByText('Boshqa (izoh majburiy)')).toBeInTheDocument();
  expect(screen.queryByText('Sabab bartaraf etildi')).not.toBeInTheDocument();
});

test('suspend stays disabled without a supporting document (_assert_decision_doc)', async () => {
  const user = userEvent.setup();
  renderPanel(['permits.manage'], { status: 'active' });
  await user.click(screen.getByText('permits.lifecycle.suspendButton'));

  const reasonSelect = await screen.findByDisplayValue('permits.lifecycle.selectPlaceholder');
  await user.selectOptions(reasonSelect, "Yong'in xavfi");

  // No document uploaded — suspend requires one, so the submit stays disabled.
  const submitButton = screen.getByText('permits.lifecycle.confirmSuspend').closest('button')!;
  expect(submitButton).toBeDisabled();
});

test('resume (no document required) signs the canonical bytes byte-for-byte', async () => {
  const user = userEvent.setup();
  let sentBody: { reason_item_id: string; legal_basis: string | null; doc_file_id: string | null; pkcs7: string } | undefined;
  server.use(
    http.post('*/api/v1/permits/:id/resume', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json(permit({ status: 'active' }));
    }),
  );

  renderPanel(['permits.manage'], { status: 'suspended' });
  await user.click(screen.getByText('permits.lifecycle.resumeButton'));

  const reasonSelect = await screen.findByDisplayValue('permits.lifecycle.selectPlaceholder');
  await user.selectOptions(reasonSelect, 'Sabab bartaraf etildi');
  await user.type(screen.getByPlaceholderText('31708860250017'), '31708860250017');
  await user.click(screen.getByText('permits.lifecycle.confirmResume'));

  await waitFor(() => expect(sentBody).toBeDefined());
  expect(sentBody!.reason_item_id).toBe('ps-06');
  expect(sentBody!.doc_file_id).toBeNull();

  const expectedDocumentJson = decisionDocumentJson({
    permitId: PERMIT_ID,
    series: 'А',
    number: 42,
    toStatus: 'active',
    reasonCode: 'PS-06',
    legalBasis: null,
    docFileId: null,
  });
  const expectedHashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(expectedDocumentJson));
  const expectedHash = Array.from(new Uint8Array(expectedHashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const decoded = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(sentBody!.pkcs7.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
    ),
  );
  expect(decoded.document_sha256).toBe(expectedHash);
  expect(decoded.pinfl_or_stir).toBe('31708860250017');
});

test('real mode: no PINFL box, and resume calls signDocument over the canonical bytes (DETACHED)', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signDocumentSpy = vi.spyOn(eimzo, 'signDocument').mockResolvedValue('REAL-PKCS7');
  const user = userEvent.setup();
  let sentBody: { pkcs7: string } | undefined;
  server.use(
    http.post('*/api/v1/permits/:id/resume', async ({ request }) => {
      sentBody = (await request.json()) as typeof sentBody;
      return HttpResponse.json(permit({ status: 'active' }));
    }),
  );

  renderPanel(['permits.manage'], { status: 'suspended' });
  await user.click(screen.getByText('permits.lifecycle.resumeButton'));

  expect(screen.queryByPlaceholderText('31708860250017')).not.toBeInTheDocument();

  const reasonSelect = await screen.findByDisplayValue('permits.lifecycle.selectPlaceholder');
  await user.selectOptions(reasonSelect, 'Sabab bartaraf etildi');
  await user.click(screen.getByText('permits.lifecycle.confirmResume'));

  await waitFor(() => expect(sentBody).toBeDefined());
  expect(signDocumentSpy).toHaveBeenCalledTimes(1);

  const expectedDocumentJson = decisionDocumentJson({
    permitId: PERMIT_ID,
    series: 'А',
    number: 42,
    toStatus: 'active',
    reasonCode: 'PS-06',
    legalBasis: null,
    docFileId: null,
  });
  const signedBytes = signDocumentSpy.mock.calls[0][0];
  expect(new TextDecoder().decode(signedBytes)).toBe(expectedDocumentJson);
  expect(sentBody!.pkcs7).toBe('REAL-PKCS7');
});

test('a real-mode signing failure shows a distinct message and never reaches the resume mutation', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signDocument').mockRejectedValue(new eimzo.EimzoPasswordError());
  let called = false;
  server.use(
    http.post('*/api/v1/permits/:id/resume', () => {
      called = true;
      return HttpResponse.json(permit({ status: 'active' }));
    }),
  );

  const user = userEvent.setup();
  renderPanel(['permits.manage'], { status: 'suspended' });
  await user.click(screen.getByText('permits.lifecycle.resumeButton'));

  const reasonSelect = await screen.findByDisplayValue('permits.lifecycle.selectPlaceholder');
  await user.selectOptions(reasonSelect, 'Sabab bartaraf etildi');
  await user.click(screen.getByText('permits.lifecycle.confirmResume'));

  expect(await screen.findByText(eimzo.EIMZO_ERROR_MESSAGE_KEYS.wrong_password)).toBeInTheDocument();
  expect(called).toBe(false);
});
