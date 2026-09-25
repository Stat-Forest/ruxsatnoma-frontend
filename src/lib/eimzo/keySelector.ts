import type { EimzoKeyInfo } from './client';

/**
 * The seam between `client.ts` (plain TypeScript, no React) and the picker
 * UI that asks the signer WHICH certificate to sign with.
 *
 * Why a module-level registry rather than a parameter: `signDocument`/
 * `signAttached` are called from seven places (`PermitSignaturesPanel`,
 * `PermitLifecyclePanel`, `ActSignCard`, `ApplicationWizardPage`,
 * `SignDecisionModal`, `ReportLifecyclePanel`, `AuthProvider`), none of
 * which has anything to say about key choice. Threading a picker through
 * all seven — and through
 * `AuthProvider`, which is mounted ABOVE the router and has no dialog of
 * its own — would put a React concern into every signing call site. A
 * single host component registers itself once (`KeyPickerHost`), and
 * `client.ts` asks for a decision when it needs one.
 *
 * `select` receives EVERY certificate E-IMZO reported, expired ones
 * included: the signer must be able to SEE that their own certificate is
 * the one that lapsed (2026-09-23 — Oybek's own had expired two weeks
 * earlier, and with it hidden the screen would have shown one unfamiliar
 * name and no explanation). Filtering is the picker's presentation job;
 * `client.ts` still refuses an expired choice on its own (`pickSigningKey`).
 */
export type EimzoKeySelector = (keys: readonly EimzoKeyInfo[]) => Promise<EimzoKeyInfo>;

let selector: EimzoKeySelector | null = null;

/** Called by `KeyPickerHost` on mount, and with `null` on unmount — so a
 *  torn-down host never leaves `client.ts` holding a `setState` into an
 *  unmounted tree. */
export function setEimzoKeySelector(next: EimzoKeySelector | null): void {
  selector = next;
}

export function getEimzoKeySelector(): EimzoKeySelector | null {
  return selector;
}
