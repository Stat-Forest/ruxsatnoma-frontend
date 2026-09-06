import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { VersionPanel } from './VersionPanel';
import type { VersionOut } from '../api';

const CONTOUR_ID = 'c-1';
const t = (key: string) => key;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function version(overrides: Partial<VersionOut> = {}): VersionOut {
  return {
    id: 'v-1',
    contour_id: CONTOUR_ID,
    version_no: 1,
    status: 'draft',
    source: 'survey',
    area_ha: '10.5000',
    declared_area_ha: '10.5000',
    accuracy_m: null,
    survey_date: null,
    effective_from: null,
    approval_doc_id: null,
    approved_by: null,
    published_at: null,
    ...overrides,
  };
}

function renderPanel(v: VersionOut, permissions: string[], onVersionChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'gis_specialist', name: {} },
    permissions,
    zone: {},
    csrf_token: 'tok',
    is_superuser: false,
    applicant: null,
    representations: [],
    registration_complete: true,
  };
  const authValue = { me, loading: false, authError: null } as unknown as AuthContextValue;
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(
    <VersionPanel contourId={CONTOUR_ID} version={v} onVersionChange={onVersionChange} t={t} />,
    { wrapper },
  );
}

function mockChecks(results: { check: string; result: string; details?: Record<string, unknown> }[] = []) {
  server.use(
    http.post(`*/api/v1/gis/contours/${CONTOUR_ID}/versions/:versionId/checks`, () =>
      HttpResponse.json({ checks: results, blocked: results.some((r) => r.result === 'fail') }),
    ),
  );
}

test('a draft version, held by a specialist, offers submit-for-review and nothing else', async () => {
  mockChecks();
  server.use(
    http.post(`*/api/v1/gis/contours/${CONTOUR_ID}/versions/:versionId/submit-review`, () =>
      HttpResponse.json(version({ status: 'review' })),
    ),
  );
  const onVersionChange = vi.fn();
  const ui = userEvent.setup();
  renderPanel(version({ status: 'draft' }), ['gis.contours.manage'], onVersionChange);

  expect(screen.getByTestId('version-status-badge')).toHaveTextContent('gis.versions.status.draft');
  const submitBtn = screen.getByRole('button', { name: 'gis.versions.actions.submitReview' });
  expect(screen.queryByRole('button', { name: 'gis.versions.actions.approve' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gis.versions.actions.publish' })).not.toBeInTheDocument();

  await ui.click(submitBtn);
  await waitFor(() => expect(onVersionChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'review' })));
});

test('a draft version is NOT offered submit-for-review to someone without contours.manage', () => {
  mockChecks();
  renderPanel(version({ status: 'draft' }), []);
  expect(screen.queryByRole('button', { name: 'gis.versions.actions.submitReview' })).not.toBeInTheDocument();
});

test('a review version offers approve (with a mandatory document) to an approver, and return-to-draft to the specialist', async () => {
  mockChecks();
  server.use(
    http.post(`*/api/v1/files`, () => HttpResponse.json({ id: 'file-1', filename: 'decree.pdf' })),
    http.post(`*/api/v1/gis/contours/${CONTOUR_ID}/versions/:versionId/approve`, async ({ request }) => {
      const body = (await request.json()) as { approval_doc_id: string };
      expect(body.approval_doc_id).toBe('file-1');
      return HttpResponse.json(version({ status: 'approved', approval_doc_id: 'file-1' }));
    }),
  );
  const onVersionChange = vi.fn();
  const ui = userEvent.setup();
  renderPanel(version({ status: 'review' }), ['gis.contours.approve'], onVersionChange);

  const approveBtn = screen.getByRole('button', { name: 'gis.versions.actions.approve' });
  expect(approveBtn).toBeDisabled();

  const file = new File(['x'], 'decree.pdf', { type: 'application/pdf' });
  await ui.upload(screen.getByTestId('approval-doc-input'), file);
  expect(approveBtn).toBeEnabled();
  await ui.click(approveBtn);

  await waitFor(() =>
    expect(onVersionChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' })),
  );
});

test('a review version offers return-to-draft to the specialist, not approve', () => {
  mockChecks();
  renderPanel(version({ status: 'review' }), ['gis.contours.manage']);
  expect(screen.getByRole('button', { name: 'gis.versions.actions.returnToDraft' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gis.versions.actions.approve' })).not.toBeInTheDocument();
});

test('an approved version auto-runs checks, and Publish is disabled while a blocking check fails', async () => {
  mockChecks([{ check: 'overlap', result: 'fail', details: { items: [] } }]);
  renderPanel(version({ status: 'approved' }), ['gis.contours.approve']);

  await waitFor(() => expect(screen.getByTestId('check-overlap')).toBeInTheDocument());
  const publishBtn = screen.getByRole('button', { name: 'gis.versions.actions.publish' });
  expect(publishBtn).toBeDisabled();
});

test('an approved version with only a warning may still be published', async () => {
  mockChecks([{ check: 'restrictions', result: 'warning', details: { items: [] } }]);
  server.use(
    http.post(`*/api/v1/gis/contours/${CONTOUR_ID}/versions/:versionId/publish`, () =>
      HttpResponse.json(version({ status: 'published', published_at: '2026-09-05T10:00:00Z' })),
    ),
  );
  const onVersionChange = vi.fn();
  const ui = userEvent.setup();
  renderPanel(version({ status: 'approved' }), ['gis.contours.approve'], onVersionChange);

  await waitFor(() => expect(screen.getByTestId('check-restrictions')).toBeInTheDocument());
  const publishBtn = screen.getByRole('button', { name: 'gis.versions.actions.publish' });
  expect(publishBtn).toBeEnabled();
  await ui.click(publishBtn);
  await waitFor(() =>
    expect(onVersionChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' })),
  );
});

test('a published version offers archive to the approver only', () => {
  mockChecks();
  renderPanel(version({ status: 'published' }), ['gis.contours.approve']);
  expect(screen.getByRole('button', { name: 'gis.versions.actions.archive' })).toBeInTheDocument();
});

test('an archived version offers no transition at all', () => {
  mockChecks();
  renderPanel(version({ status: 'archived' }), ['gis.contours.manage', 'gis.contours.approve']);
  expect(screen.queryByRole('button', { name: /gis\.versions\.actions\./ })).not.toBeInTheDocument();
});
