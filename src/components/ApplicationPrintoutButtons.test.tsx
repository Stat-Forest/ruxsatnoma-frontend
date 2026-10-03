/**
 * Stage 16 (ruling R2): «Ariza xati» and «Rad etish xati», the application's
 * two printed documents. `useLanguage()` falls back to `uz_latn` with no
 * `I18nContext.Provider` in the tree (`i18n/useT.ts`), so these render
 * without one, the way the brief's own test does.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationPrintoutButtons } from './ApplicationPrintoutButtons';
import * as download from '../lib/xlsxExport';

const letter = { kind: 'letter' as const, number: null, language: 'uz_latn', created_at: '2026-09-24T10:00:00Z' };
const notice = { kind: 'rejection_notice' as const, number: 'RD-2026-000001', language: 'uz_latn', created_at: '2026-09-24T11:00:00Z' };

describe('ApplicationPrintoutButtons', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('renders nothing when the card has no printouts', () => {
    const { container } = render(<ApplicationPrintoutButtons applicationId="a1" printouts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers only the letter for an application that was not rejected', () => {
    render(<ApplicationPrintoutButtons applicationId="a1" printouts={[letter]} />);
    expect(screen.getByRole('button', { name: /Ariza xati/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rad etish xati/ })).toBeNull();
  });

  it('downloads each document from its own route', async () => {
    const spy = vi.spyOn(download, 'downloadAttachment').mockResolvedValue(new Response());
    render(<ApplicationPrintoutButtons applicationId="a1" printouts={[letter, notice]} />);
    fireEvent.click(screen.getByRole('button', { name: /Rad etish xati/ }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/applications\/a1\/rejection-notice\.pdf$/),
        'rad-etish-xati-RD-2026-000001.pdf',
      ),
    );
  });

  it('shows the server message when a download fails', async () => {
    vi.spyOn(download, 'downloadAttachment').mockRejectedValue(new Error('Belgi chizilmaydi'));
    render(<ApplicationPrintoutButtons applicationId="a1" printouts={[letter]} />);
    fireEvent.click(screen.getByRole('button', { name: /Ariza xati/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Belgi chizilmaydi');
  });
});
