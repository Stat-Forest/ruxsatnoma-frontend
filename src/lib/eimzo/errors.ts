import { ApiError } from '../../api/errors';

/**
 * The five conditions a citizen actually hits with the real E-IMZO client
 * (task-11-brief.md), plus `unknown` for anything `client.ts` cannot place
 * more precisely. Kept as a closed set on purpose — a `switch` over this
 * type without a `default` is a compile error the moment a sixth kind is
 * added, so a new failure mode cannot silently fall back to `unknown`
 * without someone deciding that on purpose.
 *
 * `provider_unreachable` (condition 5, `ERR-INT-001`/`ERR-INT-002`) is
 * deliberately NOT a member here — that condition is not something
 * `EIMZOClient`'s own callbacks ever report; it is our OWN backend's answer
 * to a call `client.ts` makes (`POST /eimzo/timestamp`, and in real mode
 * `POST /auth/eimzo/challenge`/`login`), already an `ApiError` with a code.
 * `isProviderUnreachable` below recognises it from that shape directly,
 * rather than this module wrapping it into a matching `EimzoError` kind
 * only to unwrap it again at the one call site that already branches on
 * `ApiError.code` for every other backend refusal.
 */
export type EimzoErrorKind =
  | 'not_installed'
  | 'chrome_blocked'
  | 'outdated_version'
  | 'wrong_password'
  | 'unknown';

/** i18n keys — see `src/i18n/uz_latn.ts`/`ru.ts` for the required two, and
 *  `src/i18n/uz_cyrl.ts` for the third (decision #90: `uz_latn` mandatory,
 *  `uz_cyrl` optional — that file is NOT wired into `UiLanguage`/`DICTIONARIES`,
 *  see its own docstring for why). Also used for `provider_unreachable`
 *  itself, even though that is not an `EimzoErrorKind` member — see above. */
export const EIMZO_ERROR_MESSAGE_KEYS = {
  not_installed: 'eimzo.errors.notInstalled',
  chrome_blocked: 'eimzo.errors.chromeBlocked',
  outdated_version: 'eimzo.errors.outdatedVersion',
  wrong_password: 'eimzo.errors.wrongPassword',
  provider_unreachable: 'eimzo.errors.providerUnreachable',
  unknown: 'eimzo.errors.unknown',
} as const satisfies Record<EimzoErrorKind | 'provider_unreachable', string>;

export type EimzoErrorMessageKey = (typeof EIMZO_ERROR_MESSAGE_KEYS)[keyof typeof EIMZO_ERROR_MESSAGE_KEYS];

/**
 * Everything `client.ts` throws that is not a plain `ApiError` from one of
 * our own routes. `cause` carries whatever the vendor's `fail(e, reason)`
 * callback handed back (a WebSocket close code, or the library's own
 * `reason` string) — never shown to the user, kept only so a console log or
 * a bug report has the raw signal `client.ts` decided from.
 */
export class EimzoError extends Error {
  readonly kind: EimzoErrorKind;

  constructor(kind: EimzoErrorKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'EimzoError';
    this.kind = kind;
  }
}

/** Condition 1 — E-IMZO is not installed, or the desktop app is not running
 *  (nothing answers `wss://127.0.0.1:64443`). Also the fallback `client.ts`
 *  uses for a connection failure on a browser this session cannot identify
 *  as Chrome 147+ (see `EimzoChromeBlockedError`'s own docstring — the two
 *  are the same underlying WebSocket failure, disambiguated by user agent,
 *  never by guessing). */
export class EimzoNotInstalledError extends EimzoError {
  constructor(cause?: unknown) {
    super('not_installed', 'E-IMZO is not installed or not running', cause);
    this.name = 'EimzoNotInstalledError';
  }
}

/** Condition 2 — `EIMZOClient.checkVersion` answered, but with a version
 *  older than `client.ts`'s own `REQUIRED_VERSION`. */
export class EimzoOutdatedVersionError extends EimzoError {
  readonly installedVersion: string;

  constructor(installedVersion: string, cause?: unknown) {
    super('outdated_version', `Installed E-IMZO version ${installedVersion} is older than required`, cause);
    this.name = 'EimzoOutdatedVersionError';
    this.installedVersion = installedVersion;
  }
}

/**
 * Condition 3 — since Chrome 147 (April 2026), a page reaching the user's
 * own machine sits behind a permission prompt ("Allow access to devices on
 * your local network?"); if the citizen never sees it, or the site lacks
 * enough reputation, the WebSocket to `wss://127.0.0.1:64443` is refused
 * with NO event this page can tell apart from "E-IMZO is not installed" by
 * itself — `client.ts` tells the two apart by user agent
 * (`isChromeLocalNetworkGate`), not by guessing from the failure shape,
 * which is identical either way. The vendor's own guidance for the
 * fallback, when the prompt itself never appears, is the flag
 * `chrome://flags/#local-network-access-check = Disabled`.
 */
export class EimzoChromeBlockedError extends EimzoError {
  constructor(cause?: unknown) {
    super('chrome_blocked', "Chrome's local-network-access check blocked the connection to E-IMZO", cause);
    this.name = 'EimzoChromeBlockedError';
  }
}

/** Condition 4 — wrong key password. `client.ts` raises this specifically
 *  from `loadKey`'s own `fail` callback, never from any earlier step: by
 *  the time `loadKey` runs, `checkVersion` and `listAllUserKeys` have
 *  already succeeded, so the one thing left in that native flow able to
 *  fail is the password the E-IMZO app's own dialog just asked for (or the
 *  signer cancelling that dialog, which reads the same to a citizen: try
 *  again). Never surfaced as a generic "signature error". */
export class EimzoPasswordError extends EimzoError {
  constructor(cause?: unknown) {
    super('wrong_password', 'The E-IMZO key password was rejected', cause);
    this.name = 'EimzoPasswordError';
  }
}

/**
 * Condition 5 — the E-IMZO provider itself (or the VPN in front of it) did
 * not answer. This never comes from `EIMZOClient`'s callbacks — it is our
 * OWN backend refusing a call `client.ts` makes to it (`POST
 * /eimzo/timestamp` always; in real mode also `POST /auth/eimzo/challenge`
 * and `POST /auth/eimzo/login`, both of which now reach the real provider
 * server-side) with `ERR-INT-001` (no answer) or `ERR-INT-002` (the
 * provider answered with an error). Not the citizen's fault and not ours —
 * `/eimzo/health` is where an administrator sees it, per the top-level task.
 */
export function isProviderUnreachable(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'ERR-INT-001' || error.code === 'ERR-INT-002');
}

/** The i18n key a call site should render for a given failure — an
 *  `EimzoError` maps by its own `kind`; an `ApiError` carrying one of the
 *  two integration codes maps to `provider_unreachable`; anything else
 *  falls back to `unknown`. Never two conditions sharing a key: each arm
 *  below returns a DIFFERENT constant from `EIMZO_ERROR_MESSAGE_KEYS`. */
export function eimzoErrorMessageKey(error: unknown): EimzoErrorMessageKey {
  if (error instanceof EimzoError) return EIMZO_ERROR_MESSAGE_KEYS[error.kind];
  if (isProviderUnreachable(error)) return EIMZO_ERROR_MESSAGE_KEYS.provider_unreachable;
  return EIMZO_ERROR_MESSAGE_KEYS.unknown;
}
