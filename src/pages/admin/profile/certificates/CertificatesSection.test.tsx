import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../../auth/AuthContext';
import type { AuthContextValue } from '../../../../auth/AuthContext';
import { I18nContext } from '../../../../i18n/context';
import { uz_latn } from '../../../../i18n/uz_latn';
import * as eimzo from '../../../../lib/eimzo';
import { CertificatesSection } from './CertificatesSection';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const t = (key: string) => (uz_latn as Record<string, string>)[key] ?? key;

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  const auth = {
    me: { user: { full_name: 'Aliyev Vali' } },
    loading: false,
    authError: null,
    submitPassword: async () => 'mfa-required',
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    applyMe: () => {},
    refreshMe: async () => {},
  } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<CertificatesSection />, { wrapper });
}

const CERT = {
  id: 'cert-1',
  serial_number: 'MOCK-123',
  issuer: 'MOCK-CA-DEMO',
  subject: 'CN=Aliyev Vali',
  pinfl_or_stir: '30491823410019',
  valid_from: '2026-01-01T00:00:00Z',
  valid_to: '2027-01-01T00:00:00Z',
  status: 'active',
  bound_at: '2026-01-01T00:00:00Z',
  revoked_at: null,
};

test('an empty list shows the empty state', async () => {
  server.use(http.get('*/certificates', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })));
  renderSection();
  expect(await screen.findByTestId('certificates-empty')).toBeInTheDocument();
});

test('a bound certificate lists its serial, subject and status', async () => {
  server.use(
    http.get('*/certificates', () => HttpResponse.json({ items: [CERT], total: 1, page: 1, page_size: 100 })),
  );
  renderSection();
  expect(await screen.findByText('MOCK-123')).toBeInTheDocument();
  expect(screen.getByText(t('cabinet.certificates.statusActive'))).toBeInTheDocument();
});

test('displays active, expired, and revoked certificate badges correctly', async () => {
  const expiredCert = { ...CERT, id: 'cert-2', serial_number: 'MOCK-EXP', status: 'expired' };
  const revokedCert = { ...CERT, id: 'cert-3', serial_number: 'MOCK-REV', status: 'revoked' };
  server.use(
    http.get('*/certificates', () =>
      HttpResponse.json({ items: [CERT, expiredCert, revokedCert], total: 3, page: 1, page_size: 100 }),
    ),
  );
  renderSection();
  expect(await screen.findByText('MOCK-123')).toBeInTheDocument();
  expect(screen.getByText(t('cabinet.certificates.statusActive'))).toBeInTheDocument();
  expect(screen.getByText(t('cabinet.certificates.statusExpired'))).toBeInTheDocument();
  expect(screen.getByText(t('cabinet.certificates.statusRevoked'))).toBeInTheDocument();
});

test('binding sends an ATTACHED envelope (document_b64 present) and refreshes the list', async () => {
  let seenPkcs7 = '';
  server.use(
    http.get('*/certificates', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.post('*/certificates', async ({ request }) => {
      const body = (await request.json()) as { pkcs7: string };
      seenPkcs7 = body.pkcs7;
      return HttpResponse.json(CERT, { status: 201 });
    }),
  );
  renderSection();
  await screen.findByTestId('certificates-empty');

  await userEvent.type(screen.getByTestId('certificate-pinfl'), '30491823410019');
  await userEvent.click(screen.getByTestId('bind-submit'));

  await waitFor(() => expect(seenPkcs7).not.toBe(''));
  const decoded = JSON.parse(
    atob(seenPkcs7.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (seenPkcs7.length % 4)) % 4)),
  );
  expect(decoded.document_b64).toBeTruthy();
});

test('real mode: no PINFL/full-name box, and bind calls signAttached with a random nonce', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const signAttachedSpy = vi.spyOn(eimzo, 'signAttached').mockResolvedValue('REAL-ATTACHED-PKCS7');
  let seenPkcs7 = '';
  server.use(
    http.get('*/certificates', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })),
    http.post('*/certificates', async ({ request }) => {
      const body = (await request.json()) as { pkcs7: string };
      seenPkcs7 = body.pkcs7;
      return HttpResponse.json(CERT, { status: 201 });
    }),
  );
  renderSection();
  await screen.findByTestId('certificates-empty');

  expect(screen.queryByTestId('certificate-pinfl')).not.toBeInTheDocument();
  expect(screen.queryByTestId('certificate-full-name')).not.toBeInTheDocument();

  await userEvent.click(screen.getByTestId('bind-submit'));

  await waitFor(() => expect(seenPkcs7).toBe('REAL-ATTACHED-PKCS7'));
  expect(signAttachedSpy).toHaveBeenCalledTimes(1);
  expect(signAttachedSpy.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
});

test('a real-mode bind failure shows a distinct message, never a generic error', async () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  vi.spyOn(eimzo, 'signAttached').mockRejectedValue(new eimzo.EimzoNotInstalledError());
  server.use(http.get('*/certificates', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })));
  renderSection();
  await screen.findByTestId('certificates-empty');

  await userEvent.click(screen.getByTestId('bind-submit'));

  expect(await screen.findByTestId('bind-error')).toHaveTextContent(
    t(eimzo.EIMZO_ERROR_MESSAGE_KEYS.not_installed),
  );
});

test('unbinding calls DELETE with no confirmation dialog and refreshes the list', async () => {
  let deleted = false;
  server.use(
    http.get('*/certificates', () =>
      HttpResponse.json({ items: deleted ? [] : [CERT], total: deleted ? 0 : 1, page: 1, page_size: 100 }),
    ),
    http.delete('*/certificates/:id', () => {
      deleted = true;
      return new HttpResponse(null, { status: 204 });
    }),
  );
  renderSection();
  await screen.findByText('MOCK-123');

  await userEvent.click(screen.getByTestId('unbind-cert-1'));

  await waitFor(() => expect(deleted).toBe(true));
  expect(await screen.findByTestId('certificates-empty')).toBeInTheDocument();
});
