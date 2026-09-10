import { useAuth } from '../../auth/useAuth';
// Through `./index`, not `./switch`, on purpose: the call sites' real-mode
// tests flip the switch with `vi.spyOn(eimzo, 'isEimzoMock')` on the index
// namespace, and a direct import here would not see that spy — this hook
// would still think "mock", find no PINFL, and disable the button the test
// is about to click. The cycle is harmless: the binding is only read at
// render time, never while `index.ts` is still evaluating.
import { isEimzoMock } from './index';

export interface MockSigner {
  /** The signed-in user's own `users.pinfl` (`GET /auth/me`), `null` when
   * none is recorded — or in real mode, where the certificate itself carries
   * the identity and nothing here is consulted. */
  pinfl: string | null;
  /** Name for the mock certificate's `subject` (see `MockSignatureInput`). */
  fullName: string | undefined;
  /** Mock mode with no PINFL on the account: signing cannot proceed. The
   * backend would refuse the attempt anyway (`signatures.service.
   * _ownership_reason` -> `signer_pinfl_unknown`); refusing here, before
   * the button, says so up front instead of after a failed round trip. */
  blocked: boolean;
}

/**
 * Who the mock E-IMZO envelope is signed as. A real client reads the
 * signer's identity off their inserted key; the mock used to ask the staff
 * operator to TYPE the PINFL their certificate would carry, and a typo came
 * back as `certificate_pinfl_mismatch` — indistinguishable from a
 * stranger's key, and pointless to ask for once `/auth/me` carries
 * `user.pinfl`. Now the envelope is built from the signed-in user's own
 * identity, the same way the applicant wizard already builds it from
 * `applicant.pinfl`. Ownership is still proven server-side on every call;
 * nothing here fakes that verdict.
 */
export function useMockSigner(): MockSigner {
  const { me } = useAuth();
  const mock = isEimzoMock();
  const pinfl = mock ? (me?.user.pinfl ?? null) : null;
  return { pinfl, fullName: me?.user.full_name, blocked: mock && pinfl === null };
}
