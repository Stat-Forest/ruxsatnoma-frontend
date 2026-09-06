import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { I18nContext } from '../../../i18n/context';
import { ImportsTab } from './ImportsTab';

const t = (key: string) => key;

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

function referenceHandlers() {
  return [
    http.get('*/api/v1/gis/layers', () =>
      HttpResponse.json({ items: [{ id: 'layer-contours', code: 'contours', name: { uz_latn: 'Konturlar' }, geometry_type: 'MULTIPOLYGON', is_public: true, style: {}, status: 'active' }] }),
    ),
    http.get('*/api/v1/refs/organizations', ({ request }) => {
      const url = new URL(request.url);
      const parentId = url.searchParams.get('parent_id');
      if (!parentId) return HttpResponse.json({ items: [{ id: 'org-1', code: 'burchmulla', name: { uz_latn: 'Burchmulla LX' }, kind: 'leshoz', parent_id: null }], total: 1 });
      return HttpResponse.json({ items: [], total: 0 });
    }),
  ];
}

function renderTab(permissions: string[], isSuperuser = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const me = {
    user: { id: 'u-1', full_name: 'Test', login: 'test', language: 'uz_latn' },
    role: { code: 'gis_specialist', name: {} },
    permissions,
    zone: {},
    csrf_token: 'tok',
    is_superuser: isSuperuser,
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
  return render(<ImportsTab t={t} />, { wrapper });
}

test('the upload form is offered only to a contours.manage holder', () => {
  server.use(...referenceHandlers());
  renderTab([]);
  expect(screen.queryByTestId('import-upload-form')).not.toBeInTheDocument();
  expect(screen.getByText('gis.imports.noneSelected')).toBeInTheDocument();
});

test('creating an import uploads the approval document first, then the batch, and shows its live detail', async () => {
  // Deliberately does NOT call `request.formData()` on the multipart POST:
  // a `File` set on a real DOM input via `userEvent.upload` is jsdom's own
  // File implementation, which fails undici's stricter WebIDL brand check
  // when the request is later parsed as multipart server-side inside this
  // same Node process — a test-environment limitation, not a bug in the
  // component. Every other multipart test in this codebase (`uploadFile`'s
  // own usages) avoids it the same way: answer with a canned response and
  // never inspect the body.
  server.use(
    ...referenceHandlers(),
    http.post('*/api/v1/files', () => HttpResponse.json({ id: 'doc-1', filename: 'decree.pdf' })),
    http.post('*/api/v1/gis/imports', () => HttpResponse.json({ import_id: 'import-1' }, { status: 202 })),
    http.get('*/api/v1/gis/imports/import-1', () =>
      HttpResponse.json({
        id: 'import-1',
        layer_id: 'layer-contours',
        organization_id: 'org-1',
        file_id: 'file-1',
        approval_doc_id: 'doc-1',
        format: 'geojson',
        status: 'review',
        attribute_map: {},
        stats: { created: 12, warnings: [] },
        error_report: null,
        created_at: '2026-09-05T10:00:00Z',
        finished_at: '2026-09-05T10:00:05Z',
      }),
    ),
  );
  const ui = userEvent.setup();
  renderTab(['gis.contours.manage']);

  await screen.findByTestId('import-upload-form');
  const orgSelect = screen.getAllByRole('combobox')[1]; // [0] layer, [1] organization, [2] format
  await waitFor(() => expect(within(orgSelect).getByText('Burchmulla LX')).toBeInTheDocument());
  await ui.selectOptions(orgSelect, 'org-1');
  await ui.upload(screen.getByTestId('import-file-input'), new File(['x'], 'data.geojson'));
  await ui.upload(screen.getByTestId('import-approval-input'), new File(['x'], 'decree.pdf'));
  await ui.click(screen.getByRole('button', { name: 'gis.imports.form.submit' }));

  const detail = await screen.findByTestId('import-detail');
  expect(detail).toHaveTextContent('gis.imports.status.review');
  expect(detail).toHaveTextContent('12');
});

test('a failed batch shows its error report', async () => {
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/imports/import-bad', () =>
      HttpResponse.json({
        id: 'import-bad',
        layer_id: 'layer-contours',
        organization_id: 'org-1',
        file_id: 'file-1',
        approval_doc_id: 'doc-1',
        format: 'geojson',
        status: 'failed',
        attribute_map: {},
        stats: null,
        error_report: [{ row: 3, code: 'ERR-GIS-004', message: 'bad geometry' }],
        created_at: '2026-09-05T10:00:00Z',
        finished_at: '2026-09-05T10:00:05Z',
      }),
    ),
  );
  const ui = userEvent.setup();
  renderTab([]);

  await ui.type(screen.getByPlaceholderText('import id'), 'import-bad');
  await ui.click(screen.getByRole('button', { name: 'gis.imports.open' }));

  const detail = await screen.findByTestId('import-detail');
  expect(detail).toHaveTextContent('gis.imports.status.failed');
  // Localized copy for the row's code, not the server's raw `code: message`
  // (F4, `docs/plans/07.3-findings.md`) — the row number is still shown.
  expect(detail).toHaveTextContent('#3');
  expect(detail).toHaveTextContent("Fayl formati qo'llab-quvvatlanmaydi.");
  expect(detail).not.toHaveTextContent('ERR-GIS-004');
  expect(detail).not.toHaveTextContent('bad geometry');
});

test('a superuser can drive a review batch through submit-review, approve and publish', async () => {
  let status: 'review' | 'approved' | 'done' = 'review';
  server.use(
    ...referenceHandlers(),
    http.get('*/api/v1/gis/imports/import-2', () =>
      HttpResponse.json({
        id: 'import-2',
        layer_id: 'layer-contours',
        organization_id: 'org-1',
        file_id: 'file-1',
        approval_doc_id: 'doc-1',
        format: 'geojson',
        status,
        attribute_map: {},
        stats: { created: 3, warnings: [] },
        error_report: null,
        created_at: '2026-09-05T10:00:00Z',
        finished_at: '2026-09-05T10:00:05Z',
      }),
    ),
    http.post('*/api/v1/gis/imports/import-2/submit-review', () => {
      // The batch row itself stays `review` — this action moves the
      // versions it created, per `gis/service.py`'s own docstring.
      return HttpResponse.json({ id: 'import-2', layer_id: 'layer-contours', organization_id: 'org-1', file_id: 'file-1', approval_doc_id: 'doc-1', format: 'geojson', status: 'review', attribute_map: {}, stats: { created: 3, warnings: [] }, error_report: null, created_at: '2026-09-05T10:00:00Z', finished_at: '2026-09-05T10:00:05Z' });
    }),
    http.post('*/api/v1/gis/imports/import-2/approve', () => {
      status = 'approved';
      return HttpResponse.json({ id: 'import-2', layer_id: 'layer-contours', organization_id: 'org-1', file_id: 'file-1', approval_doc_id: 'doc-1', format: 'geojson', status, attribute_map: {}, stats: { created: 3, warnings: [] }, error_report: null, created_at: '2026-09-05T10:00:00Z', finished_at: '2026-09-05T10:00:05Z' });
    }),
    http.post('*/api/v1/gis/imports/import-2/publish', () => {
      status = 'done';
      return HttpResponse.json({ published: 3, blocked: [] });
    }),
  );
  const ui = userEvent.setup();
  renderTab([], true);

  await ui.type(screen.getByPlaceholderText('import id'), 'import-2');
  await ui.click(screen.getByRole('button', { name: 'gis.imports.open' }));
  await screen.findByTestId('import-detail');

  await ui.click(screen.getByRole('button', { name: 'gis.imports.actions.submitReview' }));
  const approveBtn = await screen.findByRole('button', { name: 'gis.imports.actions.approve' });
  await ui.click(approveBtn);
  const publishBtn = await screen.findByRole('button', { name: 'gis.imports.actions.publish' });
  await ui.click(publishBtn);

  await waitFor(() => expect(screen.getByTestId('import-detail')).toHaveTextContent('gis.imports.status.done'));
});
