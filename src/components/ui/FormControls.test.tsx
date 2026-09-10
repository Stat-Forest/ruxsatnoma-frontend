import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Checkbox, FileInput, FormField, Input } from './FormControls';
import { DICTIONARIES, I18nContext } from '../../i18n/context';

function renderWithI18n(ui: React.ReactElement, lang: keyof typeof DICTIONARIES = 'uz_latn') {
  const i18n = {
    lang,
    backendLang: lang,
    t: (key: string) => (DICTIONARIES[lang] as Record<string, string>)[key] ?? key,
    setLanguage: async () => {},
  };
  return render(<I18nContext.Provider value={i18n}>{ui}</I18nContext.Provider>);
}

test('two Checkboxes without an explicit id get distinct, correctly-linked ids', () => {
  render(
    <>
      <Checkbox label="First" />
      <Checkbox label="Second" />
    </>
  );
  const first = screen.getByLabelText('First') as HTMLInputElement;
  const second = screen.getByLabelText('Second') as HTMLInputElement;

  expect(first.id).toBeTruthy();
  expect(second.id).toBeTruthy();
  expect(first.id).not.toBe(second.id);
});

test("a Checkbox's generated id is stable across re-renders", () => {
  const { getByLabelText, rerender } = render(<Checkbox label="Stable" hint="v1" />);
  const idBefore = (getByLabelText('Stable') as HTMLInputElement).id;

  // Math.random() would mint a fresh id on every render; useId() must not.
  rerender(<Checkbox label="Stable" hint="v2" />);
  const idAfter = (getByLabelText('Stable') as HTMLInputElement).id;

  expect(idAfter).toBe(idBefore);
});

test('FileInput renders choose button, noFileChosen text, and updates when file is uploaded', async () => {
  const user = userEvent.setup();
  let selectedFile: File | null = null;

  renderWithI18n(
    <FormField label="Fayl yuklash" htmlFor="test-file">
      <FileInput id="test-file" onChange={(file) => { selectedFile = file; }} />
    </FormField>
  );

  expect(screen.getByText('Faylni tanlash')).toBeInTheDocument();
  expect(screen.getByText('Fayl tanlanmagan')).toBeInTheDocument();

  const file = new File(['dummy content'], 'sample.pdf', { type: 'application/pdf' });
  await user.upload(screen.getByLabelText('Fayl yuklash'), file);

  expect(selectedFile).toBe(file);
  expect(screen.getByText('sample.pdf')).toBeInTheDocument();
  expect(screen.queryByText('Fayl tanlanmagan')).not.toBeInTheDocument();
});

test('FileInput remove button clears selected file and calls onChange(null)', async () => {
  const user = userEvent.setup();

  function ControlledFileInput() {
    const [file, setFile] = useState<File | null>(new File(['dummy'], 'test.csv', { type: 'text/csv' }));
    return <FileInput value={file} onChange={setFile} data-testid="file-inp" />;
  }

  renderWithI18n(<ControlledFileInput />);

  expect(screen.getByText('test.csv')).toBeInTheDocument();
  const removeBtn = screen.getByTitle('Faylni oʻchirish');
  await user.click(removeBtn);

  expect(screen.queryByText('test.csv')).not.toBeInTheDocument();
  expect(screen.getByText('Fayl tanlanmagan')).toBeInTheDocument();
});

test('FileInput respects localized dictionary (ru)', () => {
  renderWithI18n(<FileInput />, 'ru');
  expect(screen.getByText('Выберите файл')).toBeInTheDocument();
  expect(screen.getByText('Файл не выбран')).toBeInTheDocument();
});

test('Input type="date" renders localized placeholder overlay across languages', () => {
  const { unmount } = renderWithI18n(<Input type="date" />, 'en');
  expect(screen.getByText('YYYY-MM-DD')).toBeInTheDocument();
  unmount();

  const r2 = renderWithI18n(<Input type="date" />, 'uz_latn');
  expect(screen.getByText('KK.OO.YYYY')).toBeInTheDocument();
  r2.unmount();

  const r3 = renderWithI18n(<Input type="date" />, 'ru');
  expect(screen.getByText('ДД.ММ.ГГГГ')).toBeInTheDocument();
  r3.unmount();

  const r4 = renderWithI18n(<Input type="date" />, 'uz_cyrl');
  expect(screen.getByText('КК.ОО.ЙЙЙЙ')).toBeInTheDocument();
  r4.unmount();

  const r5 = renderWithI18n(<Input type="date" />, 'kaa');
  expect(screen.getByText('KK.AA.JJJJ')).toBeInTheDocument();
  r5.unmount();
});

test('Input type="date" hides placeholder when value is present or on focus', async () => {
  const user = userEvent.setup();
  const { rerender } = renderWithI18n(<Input type="date" data-testid="date-in" />, 'en');
  expect(screen.getByText('YYYY-MM-DD')).toBeInTheDocument();

  const input = screen.getByTestId('date-in');
  await user.click(input);
  expect(screen.queryByText('YYYY-MM-DD')).not.toBeInTheDocument();

  rerender(
    <I18nContext.Provider
      value={{
        lang: 'en',
        backendLang: 'en',
        t: (k: string) => k,
        setLanguage: async () => {},
      }}
    >
      <Input type="date" value="2026-09-09" readOnly data-testid="date-in" />
    </I18nContext.Provider>
  );
  expect(screen.queryByText('YYYY-MM-DD')).not.toBeInTheDocument();
});

