import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AuthContext } from '../../../auth/AuthContext';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../../i18n/context';
import { uz_latn } from '../../../i18n/uz_latn';
import { ProfilePage } from './ProfilePage';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage(
  roleCode: string = 'applicant',
  lang: UiLanguage = 'uz_latn',
  overrides?: { isSuperuser?: boolean; roleName?: Record<string, string>; fullName?: string },
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const dict = DICTIONARIES[lang];
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (dict as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  const auth = {
    me: {
      user: {
        full_name: overrides?.fullName ?? 'Test Applicant',
        login: 'test_login',
        phone: null,
        email: null,
        language: lang,
      },
      role: {
        code: roleCode,
        name: overrides?.roleName ?? { uz_latn: 'Ariza beruvchi' },
      },
      is_superuser: overrides?.isSuperuser ?? false,
      representations: [],
    },
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
  return render(<ProfilePage />, { wrapper });
}

test('the profile tab is selected by default and shows contacts', () => {
  renderPage();
  expect(screen.getByText('Test Applicant')).toBeInTheDocument();
  expect(screen.getByTestId('phone-change')).toBeInTheDocument();
});

test('switching to the password tab shows the existing change-password form (C5)', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: uz_latn['cabinet.profile.tabPassword'] }));
  expect(screen.getByTestId('old-password')).toBeInTheDocument();
  expect(screen.queryByTestId('phone-change')).toBeNull();
});

test('an applicant sees the legal-entity representation tab', async () => {
  renderPage('applicant');
  await userEvent.click(screen.getByRole('button', { name: uz_latn['cabinet.profile.tabRepresentation'] }));
  expect(screen.getByTestId('attach-stir')).toBeInTheDocument();
});

test('a staff role is not offered the representation tab at all — the backend would refuse it', () => {
  renderPage('executor_staff');
  expect(screen.queryByRole('button', { name: uz_latn['cabinet.profile.tabRepresentation'] })).toBeNull();
});

test('every role, staff included, sees the certificates tab', async () => {
  server.use(http.get('*/certificates', () => HttpResponse.json({ items: [], total: 0, page: 1, page_size: 100 })));
  renderPage('executor_staff');
  await userEvent.click(screen.getByRole('button', { name: uz_latn['cabinet.profile.tabCertificates'] }));
  expect(await screen.findByTestId('certificates-empty')).toBeInTheDocument();
});

test('translates profile hero card across all 5 languages for chief forester', () => {
  const testCases: Array<{
    lang: UiLanguage;
    expectedRole: string;
    expectedActive: string;
    expectedSuperuser: string;
    expectedLang: string;
    expectedName: string;
  }> = [
    {
      lang: 'uz_latn',
      expectedRole: "Bosh o'rmonbegi",
      expectedActive: 'Faol hisob',
      expectedSuperuser: 'Superfoydalanuvchi',
      expectedLang: 'Oʻzbekcha',
      expectedName: "Demo Bosh o'rmonbegi (Burchmulla DO'X)",
    },
    {
      lang: 'ru',
      expectedRole: 'Главный лесничий',
      expectedActive: 'Активный аккаунт',
      expectedSuperuser: 'Суперпользователь',
      expectedLang: 'Русский',
      expectedName: 'Демо Главный лесничий (Бурчмуллинский лесхоз)',
    },
    {
      lang: 'en',
      expectedRole: 'Chief forester',
      expectedActive: 'Active account',
      expectedSuperuser: 'Superuser',
      expectedLang: 'English',
      expectedName: 'Demo Chief Forester (Burchmulla Forestry)',
    },
    {
      lang: 'uz_cyrl',
      expectedRole: 'Бош ўрмонбеги',
      expectedActive: 'Фаол ҳисоб',
      expectedSuperuser: 'Суперфойдаланувчи',
      expectedLang: 'Ўзбекча',
      expectedName: 'Демо Бош ўрмонбеги (Бурчмулла ДЎХ)',
    },
    {
      lang: 'kaa',
      expectedRole: 'Bas tokaýshı',
      expectedActive: 'Aktiv esap',
      expectedSuperuser: 'Superpaydalanıwshı',
      expectedLang: 'Qaraqalpaqsha',
      expectedName: 'Demo Bas tokaýshı (Burchmulla TOX)',
    },
  ];

  for (const tc of testCases) {
    const { unmount } = renderPage('chief_forester', tc.lang, {
      isSuperuser: true,
      roleName: { uz_latn: "Bosh o'rmonbegi" },
      fullName: 'Demo Chief Forester (Burchmulla DOX)',
    });

    expect(screen.getByText(tc.expectedRole)).toBeInTheDocument();
    expect(screen.getByText(tc.expectedActive)).toBeInTheDocument();
    expect(screen.getByText(tc.expectedSuperuser)).toBeInTheDocument();
    expect(screen.getByText(tc.expectedLang)).toBeInTheDocument();
    expect(screen.getByText(tc.expectedName)).toBeInTheDocument();

    unmount();
  }
});

test('translates demo user name when initial input is in Russian or Uzbek', () => {
  // When input arrives in Russian from backend seed/session
  const { unmount: u1 } = renderPage('chief_forester', 'uz_latn', {
    fullName: 'Демо Главный лесничий (Бурчмуллинский лесхоз)',
    roleName: { uz_latn: "Bosh o'rmonbegi" },
  });
  expect(screen.getByText("Demo Bosh o'rmonbegi (Burchmulla DO'X)")).toBeInTheDocument();
  // Initials "DB"
  expect(screen.getByText('DB')).toBeInTheDocument();
  u1();

  // When input arrives in Uzbek Latin and UI is in Russian
  const { unmount: u2 } = renderPage('chief_forester', 'ru', {
    fullName: "Demo Bosh o'rmonbegi (Burchmulla DO'X)",
    roleName: { uz_latn: "Bosh o'rmonbegi" },
  });
  expect(screen.getByText('Демо Главный лесничий (Бурчмуллинский лесхоз)')).toBeInTheDocument();
  // Initials "ДГ"
  expect(screen.getByText('ДГ')).toBeInTheDocument();
  u2();

  // When input is in Karakalpak and UI is in English
  const { unmount: u3 } = renderPage('chief_forester', 'en', {
    fullName: 'Demo Bas tokaýshı (Burchmulla TOX)',
    roleName: { uz_latn: "Bosh o'rmonbegi" },
  });
  expect(screen.getByText('Demo Chief Forester (Burchmulla Forestry)')).toBeInTheDocument();
  // Initials "DC"
  expect(screen.getByText('DC')).toBeInTheDocument();
  u3();
});

test('falls back to translating role code when role.name is empty object', () => {
  const { unmount: u1 } = renderPage('chief_forester', 'ru', {
    roleName: {},
  });
  expect(screen.getByText('Главный лесничий')).toBeInTheDocument();
  u1();

  const { unmount: u2 } = renderPage('chief_forester', 'kaa', {
    roleName: {},
  });
  expect(screen.getByText('Bas toǵayshı')).toBeInTheDocument();
  u2();
});

