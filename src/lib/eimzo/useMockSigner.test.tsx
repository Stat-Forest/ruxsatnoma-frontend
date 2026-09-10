/**
 * `useMockSigner` — the mock envelope's identity comes from `/auth/me`
 * (`user.pinfl`), never from a typed field; `MockSignerNotice` says which
 * PINFL will be used, or why signing is blocked when none is recorded, and
 * renders nothing at all in real mode.
 */
import { afterEach, expect, test, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import type { AuthContextValue } from '../../auth/AuthContext';
import { stubAuthActions } from '../../auth/testAuthActions';
import * as eimzo from './index';
import { MockSignerNotice, useMockSigner } from './index';

afterEach(() => vi.restoreAllMocks());

function auth(pinfl: string | null): AuthContextValue {
  return {
    me: {
      user: { id: 'u1', full_name: 'Test User', login: 'test', phone: null, email: null, must_change_password: false, pinfl, language: 'uz_latn' },
      role: { code: 'executor_head', name: {} },
      permissions: [],
      zone: { region_id: null, district_id: null, organization_id: null },
      csrf_token: 'tok',
      is_superuser: false,
      applicant: null,
      representations: [],
      registration_complete: true,
    },
    loading: false,
    authError: null,
    ...stubAuthActions(),
  };
}

function wrapperFor(pinfl: string | null) {
  return ({ children }: { children: ReactNode }) => <AuthContext.Provider value={auth(pinfl)}>{children}</AuthContext.Provider>;
}

test('mock mode: the signer is the signed-in user, by their own PINFL and name', () => {
  const { result } = renderHook(() => useMockSigner(), { wrapper: wrapperFor('31708860250017') });
  expect(result.current).toEqual({ pinfl: '31708860250017', fullName: 'Test User', blocked: false });
  render(<MockSignerNotice signer={result.current} />, { wrapper: wrapperFor('31708860250017') });
  expect(screen.getByTestId('mock-signer-notice')).toHaveTextContent('31708860250017');
  expect(screen.queryByRole('alert')).toBeNull();
});

test('mock mode with no PINFL on the account: blocked, and the notice says so', () => {
  const { result } = renderHook(() => useMockSigner(), { wrapper: wrapperFor(null) });
  expect(result.current.blocked).toBe(true);
  expect(result.current.pinfl).toBeNull();
  render(<MockSignerNotice signer={result.current} />, { wrapper: wrapperFor(null) });
  expect(screen.getByRole('alert')).toHaveTextContent('Hisobingizda PINFL qayd etilmagan');
});

test('real mode: never blocked (the certificate carries the identity) and the notice renders nothing', () => {
  vi.spyOn(eimzo, 'isEimzoMock').mockReturnValue(false);
  const { result } = renderHook(() => useMockSigner(), { wrapper: wrapperFor(null) });
  expect(result.current).toEqual({ pinfl: null, fullName: 'Test User', blocked: false });
  const { container } = render(<MockSignerNotice signer={result.current} />, { wrapper: wrapperFor(null) });
  expect(container).toBeEmptyDOMElement();
});
