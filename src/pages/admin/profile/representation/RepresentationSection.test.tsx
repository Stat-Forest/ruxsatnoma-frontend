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
import { RepresentationSection } from './RepresentationSection';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const t = (key: string) => (uz_latn as Record<string, string>)[key] ?? key;

function renderSection(representations: unknown[] = [], refreshMe: () => Promise<void> = async () => {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const i18n = { lang: 'uz_latn' as const, backendLang: 'uz_latn' as const, t, setLanguage: async () => {} };
  const auth = {
    me: {
      user: { full_name: 'Aliyev Vali' },
      role: { code: 'applicant' },
      representations,
    },
    loading: false,
    authError: null,
    requestMfa: async () => {},
    verifyMfa: async () => {},
    startOneId: async () => {},
    loginViaEimzo: async () => {},
    logout: async () => {},
    applyMe: () => {},
    refreshMe,
  } as unknown as AuthContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <I18nContext.Provider value={i18n}>
        <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
      </I18nContext.Provider>
    </QueryClientProvider>
  );
  return render(<RepresentationSection />, { wrapper });
}

const REP = {
  id: 'rep-1',
  applicant: { id: 'app-1', name: 'OOO Forest LLC', stir: '123456789' },
  basis: 'org_eri',
  valid_from: '2026-01-01',
  valid_until: null,
  status: 'active',
};

test('an empty list shows the empty state, and the colleague form explains why it is hidden', () => {
  renderSection([]);
  expect(screen.getByText(t('cabinet.representation.listEmpty'))).toBeInTheDocument();
  expect(screen.getByText(t('cabinet.representation.needOrgEriOrDirector'))).toBeInTheDocument();
});

test('an existing representation lists its organization, basis and validity', () => {
  renderSection([REP]);
  expect(screen.getByText('OOO Forest LLC')).toBeInTheDocument();
  expect(screen.getByText(/123456789/)).toBeInTheDocument();
});

test('attaching via director_registry needs only a STIR, and refreshes me on success', async () => {
  let called = false;
  server.use(
    http.post('*/auth/applicants', async ({ request }) => {
      called = true;
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ stir: '123456789', basis: 'director_registry' });
      return HttpResponse.json({ applicant: {}, representation: {} });
    }),
  );
  let refreshed = false;
  renderSection([], async () => {
    refreshed = true;
  });

  await userEvent.type(screen.getByTestId('attach-stir'), '123456789');
  await userEvent.click(screen.getByText(t('cabinet.representation.basisDirector')));
  await userEvent.click(screen.getByTestId('attach-submit'));

  await waitFor(() => expect(called).toBe(true));
  await waitFor(() => expect(refreshed).toBe(true));
});

test('attaching via poa requires the file, the term and the organization name before it can submit', async () => {
  let called = false;
  server.use(
    http.post('*/files', () => HttpResponse.json({ id: 'file-1', filename: 'poa.pdf' })),
    http.post('*/auth/applicants', () => {
      called = true;
      return HttpResponse.json({ applicant: {}, representation: {} });
    }),
  );
  renderSection();

  await userEvent.type(screen.getByTestId('attach-stir'), '123456789');
  await userEvent.click(screen.getByText(t('cabinet.representation.basisPoa')));
  await userEvent.click(screen.getByTestId('attach-submit'));
  expect(called).toBe(false); // org name, file, and date are all still missing

  await userEvent.type(screen.getByTestId('attach-org-name'), 'OOO Forest LLC');
  const file = new File(['%PDF-1.4'], 'poa.pdf', { type: 'application/pdf' });
  await userEvent.upload(screen.getByTestId('attach-poa-file'), file);
  await screen.findByTestId('attach-poa-uploaded');
  await userEvent.type(screen.getByTestId('attach-valid-until'), '2027-01-01');
  await userEvent.click(screen.getByTestId('attach-submit'));

  await waitFor(() => expect(called).toBe(true));
});

test('attaching via org_eri signs the challenge with the STIR as tin', async () => {
  const seenChallengeBody: Record<string, unknown>[] = [];
  server.use(
    http.post('*/auth/eimzo/challenge', () => HttpResponse.json({ challenge: 'chal-xyz' })),
    http.post('*/auth/applicants', async ({ request }) => {
      seenChallengeBody.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ applicant: {}, representation: {} });
    }),
  );
  renderSection();

  await userEvent.type(screen.getByTestId('attach-stir'), '123456789');
  // org_eri is the default selection.
  await userEvent.type(screen.getByTestId('attach-signer-pinfl'), '30491823410019');
  await userEvent.click(screen.getByTestId('attach-submit'));

  await waitFor(() => expect(seenChallengeBody).toHaveLength(1));
  expect(seenChallengeBody[0]).toMatchObject({ stir: '123456789', basis: 'org_eri' });
  expect(typeof seenChallengeBody[0].signed_challenge).toBe('string');
});

test('adding a colleague is refused before it can be attempted when the only basis is poa', () => {
  renderSection([{ ...REP, basis: 'poa' }]);
  expect(screen.getByText(t('cabinet.representation.needOrgEriOrDirector'))).toBeInTheDocument();
  expect(screen.queryByTestId('colleague-pinfl')).toBeNull();
});

test('adding a colleague is offered under an org_eri representation, and refreshes me on success', async () => {
  let called = false;
  server.use(
    http.post('*/auth/eimzo/challenge', () => HttpResponse.json({ challenge: 'chal-2' })),
    http.post('*/auth/applicants/:id/representations', async ({ request, params }) => {
      called = true;
      expect(params.id).toBe('app-1');
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toMatchObject({ user_pinfl: '30491823410099', basis: 'org_eri' });
      return HttpResponse.json({});
    }),
  );
  let refreshed = false;
  renderSection([REP], async () => {
    refreshed = true;
  });

  await userEvent.type(screen.getByTestId('colleague-pinfl'), '30491823410099');
  await userEvent.type(screen.getByTestId('colleague-signer-pinfl'), '30491823410019');
  await userEvent.click(screen.getByTestId('colleague-submit'));

  await waitFor(() => expect(called).toBe(true));
  await waitFor(() => expect(refreshed).toBe(true));
});
