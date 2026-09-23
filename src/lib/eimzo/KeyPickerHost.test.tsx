/**
 * The picker itself: what it shows, what it refuses to let anyone click,
 * and what the promise `client.ts` is waiting on does in each case.
 *
 * The scenario every test here is built from is the real one, measured on
 * 2026-09-23 against a live E-IMZO install: several certificates connected,
 * the signer's own EXPIRED, and a valid one belonging to somebody else.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EimzoKeyInfo } from './client';
import { EimzoCancelledError } from './errors';
import { getEimzoKeySelector, setEimzoKeySelector } from './keySelector';
import { KeyPickerHost } from './KeyPickerHost';

function key(overrides: Partial<EimzoKeyInfo> = {}): EimzoKeyInfo {
  return {
    id: 'pfx-0-SN-1',
    commonName: 'YULDASHOV OYBEK FAXRIDDIN OʻGʻLI',
    pinfl: '30210996180090',
    tin: '',
    organization: '',
    serialNumber: 'SN-1',
    validFrom: new Date('2024-09-09T00:00:00Z'),
    validTo: new Date('2099-01-01T00:00:00Z'),
    type: 'pfx',
    ...overrides,
  };
}

const MINE_EXPIRED = key({
  id: 'pfx-0-SN-MINE',
  serialNumber: 'SN-MINE',
  validTo: new Date('2026-09-09T09:42:43Z'),
});
const COLLEAGUE_VALID = key({
  id: 'pfx-1-SN-OTHER',
  commonName: 'XAITMETOV DILSHOD XALMIRZAYEVICH',
  organization: 'B2B SPACE MCHJ',
  tin: '306865819',
  serialNumber: 'SN-OTHER',
  validTo: new Date('2026-11-19T17:20:28Z'),
});

afterEach(() => setEimzoKeySelector(null));

/** Opens the dialog and never answers it — for the tests that only look
 *  at what was rendered. Swallows the rejection a later unmount may cause. */
function ask_(keys: readonly EimzoKeyInfo[]): void {
  void ask(keys).catch(() => {});
}

/** Opens the dialog the way `client.ts` does, through the registry. */
function ask(keys: readonly EimzoKeyInfo[]): Promise<EimzoKeyInfo> {
  const selector = getEimzoKeySelector();
  if (!selector) throw new Error('no selector registered — the host did not mount');
  return selector(keys);
}

describe('KeyPickerHost', () => {
  it('renders nothing until a signature actually needs a certificate', () => {
    render(<KeyPickerHost />);
    expect(screen.queryByTestId('eimzo-picker-list')).toBeNull();
  });

  it('lists every certificate, the expired one included, with its own name and dates', async () => {
    render(<KeyPickerHost />);
    ask_([MINE_EXPIRED, COLLEAGUE_VALID]);

    await screen.findByTestId('eimzo-picker-list');
    expect(screen.getByText(/YULDASHOV OYBEK/)).toBeTruthy();
    expect(screen.getByText(/XAITMETOV DILSHOD/)).toBeTruthy();
    expect(screen.getByText('B2B SPACE MCHJ')).toBeTruthy();
    // The lapsed one names its own date — the actual thing to act on.
    expect(screen.getByText(/09\.09\.2026/)).toBeTruthy();
  });

  it('puts the usable certificates first, whatever order E-IMZO reported', async () => {
    // Measured 2026-09-23: the provider listed five expired certificates
    // ahead of the only valid one, so the signer scrolled past a wall of
    // grey to reach the single thing they could click.
    render(<KeyPickerHost />);
    ask_([MINE_EXPIRED, COLLEAGUE_VALID]);

    const list = await screen.findByTestId('eimzo-picker-list');
    const order = [...list.querySelectorAll('button')].map((b) => b.getAttribute('data-testid'));
    expect(order).toEqual(['eimzo-picker-key-SN-OTHER', 'eimzo-picker-key-SN-MINE']);
  });

  it('keeps the provider\'s own order inside each group', async () => {
    const secondValid = key({ id: 'pfx-2-SN-Z', serialNumber: 'SN-Z' });
    render(<KeyPickerHost />);
    ask_([COLLEAGUE_VALID, MINE_EXPIRED, secondValid]);

    const list = await screen.findByTestId('eimzo-picker-list');
    const order = [...list.querySelectorAll('button')].map((b) => b.getAttribute('data-testid'));
    expect(order).toEqual([
      'eimzo-picker-key-SN-OTHER',
      'eimzo-picker-key-SN-Z',
      'eimzo-picker-key-SN-MINE',
    ]);
  });

  it('will not let an expired certificate be chosen', async () => {
    render(<KeyPickerHost />);
    ask_([MINE_EXPIRED, COLLEAGUE_VALID]);

    const expired = await screen.findByTestId('eimzo-picker-key-SN-MINE');
    expect((expired as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('eimzo-picker-key-SN-OTHER') as HTMLButtonElement).disabled).toBe(false);
  });

  it('resolves with the certificate that was clicked, and closes', async () => {
    const user = userEvent.setup();
    render(<KeyPickerHost />);
    const choice = ask([MINE_EXPIRED, COLLEAGUE_VALID]);

    await user.click(await screen.findByTestId('eimzo-picker-key-SN-OTHER'));
    await expect(choice).resolves.toMatchObject({ serialNumber: 'SN-OTHER' });
    await waitFor(() => expect(screen.queryByTestId('eimzo-picker-list')).toBeNull());
  });

  it('a single valid certificate is still offered, never auto-signed', async () => {
    render(<KeyPickerHost />);
    ask_([COLLEAGUE_VALID]);
    await screen.findByTestId('eimzo-picker-key-SN-OTHER');
  });

  it('Cancel rejects with EimzoCancelledError — a decision, not a failure', async () => {
    const user = userEvent.setup();
    render(<KeyPickerHost />);
    // `.catch` FIRST: attaching it only after `await user.click(...)` is
    // several ticks too late and Node reports an unhandled rejection.
    const settled = ask([COLLEAGUE_VALID]).catch((e: unknown) => e);

    await user.click(await screen.findByTestId('eimzo-picker-cancel'));
    expect(await settled).toBeInstanceOf(EimzoCancelledError);
  });

  it('unmounting clears the registry, so no later call resolves into a dead tree', () => {
    const { unmount } = render(<KeyPickerHost />);
    expect(getEimzoKeySelector()).not.toBeNull();
    unmount();
    expect(getEimzoKeySelector()).toBeNull();
  });
});
