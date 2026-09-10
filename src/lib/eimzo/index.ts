/**
 * The single import surface for everything E-IMZO — the mock/real switch
 * (task 9), plus every existing mock builder and pure eligibility/label
 * helper this app already had before this stage (`src/lib/eimzoMock.ts`,
 * `src/pages/permits/eimzo.ts`), re-exported here so a call site needs one
 * import path regardless of which it needs. Nothing about THOSE mock
 * builders changes — they stay mock-only, used only when `isEimzoMock` is
 * true, and every test exercising them (the whole suite, since
 * `vite.config.ts` sets `VITE_EIMZO_MOCK=true` for the test run) keeps
 * passing untouched.
 *
 * **FE-1 (fix wave, critical 1):** `isEimzoMock()` is the switch itself, and
 * it now defaults SAFE: `VITE_EIMZO_MOCK` unset, or anything other than the
 * literal string `'false'`, means MOCK. Real mode is an explicit opt-in per
 * environment (`'false'`), never an unset variable's accidental default —
 * `.github/workflows/checks.yml`/`deploy.yml` pass it explicitly for exactly
 * this reason, so a build that forgets to set it fails toward mock (a dev
 * stand's backend still running `eimzo_mode=mock`) rather than toward real
 * (a citizen's browser asked for a key the backend cannot verify). Every
 * call site (`LoginPage.tsx` and the nine signing call sites) reads this one
 * function — nothing duplicates the comparison. Deliberately a FUNCTION, not
 * a module-level constant: `import.meta.env` is a live object Vite/vitest
 * mutate in place (`vi.stubEnv`), but a top-level `const` would capture
 * whatever value was current at first import and never see a later
 * override — exactly what `LoginPage.test.tsx`'s existing "mock flag is off"
 * test does mid-suite, after every module in this file is already loaded.
 *
 * The real client (`./client`) is exported unconditionally — importing this
 * module never touches `window`/`document`/a WebSocket by itself; only
 * actually CALLING `listKeys`/`signDocument`/etc. does. A mock-mode call
 * site simply never calls them, so mock-mode tests need not stub the vendor
 * globals at all (only `client.test.ts`, which calls them directly, does).
 */
export * from '../eimzoMock';
export {
  PURPOSE_ROLE,
  RECIPIENT_PURPOSE,
  SIGNATURE_ORDER,
  PURPOSE_LABEL,
  getPurposeLabel,
  canAttemptPurpose,
  buildMockPkcs7,
  isPlausiblePinflOrStir,
} from '../../pages/permits/eimzo';
export type { MockEnvelopeInput } from '../../pages/permits/eimzo';

export function isEimzoMock(): boolean {
  return import.meta.env.VITE_EIMZO_MOCK !== 'false';
}

export { listKeys, loadKey, createPkcs7, signDocument, signAttached } from './client';
export type { EimzoKeyInfo } from './client';
export * from './errors';
