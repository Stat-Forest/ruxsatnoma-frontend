import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nContext } from '../../i18n/context';
import { NormsPage } from './NormsPage';

// `t` returns the key itself — the tab-switch behaviour under test does not
// depend on which language is active, and IntegrationsPage.test.tsx sets the
// same precedent for a page rendered outside `I18nProvider`.
function renderPage() {
  const i18n = { lang: 'ru' as const, backendLang: 'ru' as const, t: (key: string) => key, setLanguage: async () => {} };
  return render(
    <I18nContext.Provider value={i18n}>
      <NormsPage />
    </I18nContext.Provider>,
  );
}

test('parameters is shown on mount', () => {
  renderPage();
  expect(screen.getByTestId('norms-page')).toBeInTheDocument();
  expect(screen.getByTestId('norms-tab-params')).toBeVisible();
  expect(screen.getByTestId('norms-tab-norms')).not.toBeVisible();
  expect(screen.getByTestId('norms-tab-tariffs')).not.toBeVisible();
});

test('clicking a tab shows its body and hides the others', async () => {
  const user = userEvent.setup();
  renderPage();

  await user.click(screen.getByText('norms.tab.norms'));
  expect(screen.getByTestId('norms-tab-norms')).toBeVisible();
  expect(screen.getByTestId('norms-tab-params')).not.toBeVisible();
  expect(screen.getByTestId('norms-tab-tariffs')).not.toBeVisible();

  // Clicking back to Parameters restores it — and it never unmounted, so
  // any state it held (filters land in task 3) would still be there.
  await user.click(screen.getByText('norms.tab.params'));
  expect(screen.getByTestId('norms-tab-params')).toBeVisible();
  expect(screen.getByTestId('norms-tab-norms')).not.toBeVisible();
});
