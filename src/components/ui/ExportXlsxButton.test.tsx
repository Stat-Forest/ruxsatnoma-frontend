/**
 * Stage 13 (ruling #204): the one «Excel» button every register renders.
 *   1. a click downloads through `downloadXlsx` with the screen's own path
 *      and query and the UI language mapped onto the server's two;
 *   2. a truncated file shows the warning with both numbers;
 *   3. a refusal shows the server's message;
 *   4. `disabled` (a screen still loading) blocks the click.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { DICTIONARIES, I18nContext, type UiLanguage } from '../../i18n/context';
import { ExportXlsxButton } from './ExportXlsxButton';

vi.mock('../../lib/xlsxExport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/xlsxExport')>();
  return { ...actual, downloadXlsx: vi.fn() };
});
import { downloadXlsx } from '../../lib/xlsxExport';
const download = vi.mocked(downloadXlsx);

afterEach(() => vi.clearAllMocks());

function renderIn(lang: UiLanguage, ui: React.ReactNode) {
  const dict = DICTIONARIES[lang] as Record<string, string>;
  return render(
    <I18nContext.Provider
      value={{ lang, backendLang: lang, t: (k) => dict[k] ?? k, setLanguage: async () => {} }}
    >
      {ui}
    </I18nContext.Provider>,
  );
}

test('clicking downloads with the screen path, its query and the mapped language', async () => {
  download.mockResolvedValue({ truncated: false, total: 3, rows: 3 });
  renderIn('uz_cyrl', <ExportXlsxButton path="/api/v1/permits" query={{ status: 'active', page: 2 }} />);

  await userEvent.setup().click(screen.getByTestId('export-xlsx'));

  await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
  expect(download).toHaveBeenCalledWith('/api/v1/permits', { status: 'active', page: 2 }, 'uz_latn');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a truncated file shows the warning with both numbers, in the UI language', async () => {
  download.mockResolvedValue({ truncated: true, total: 12340, rows: 10000 });
  renderIn('ru', <ExportXlsxButton path="/api/v1/applications" query={{}} />);

  await userEvent.setup().click(screen.getByTestId('export-xlsx'));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('В файл вошли первые 10000 строк из 12340');
  expect(download).toHaveBeenCalledWith('/api/v1/applications', {}, 'ru');
});

test('a refusal shows the server message', async () => {
  download.mockRejectedValue(new Error('Ruxsat yoʻq'));
  renderIn('uz_latn', <ExportXlsxButton path="/api/v1/invoices" query={{}} />);

  await userEvent.setup().click(screen.getByTestId('export-xlsx'));

  expect(await screen.findByRole('alert')).toHaveTextContent('Ruxsat yoʻq');
});

test('a disabled button does not download', async () => {
  renderIn('uz_latn', <ExportXlsxButton path="/api/v1/invoices" query={{}} disabled />);
  expect(screen.getByTestId('export-xlsx')).toBeDisabled();
  await userEvent.setup().click(screen.getByTestId('export-xlsx'));
  expect(download).not.toHaveBeenCalled();
});
