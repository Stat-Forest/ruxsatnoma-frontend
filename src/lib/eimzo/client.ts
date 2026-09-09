/**
 * The real E-IMZO browser client: a promise wrapper over the vendor's own
 * callback-based globals, vendored verbatim at `public/e-imzo.js` (defines
 * `CAPIWS`, `Base64`) and `public/e-imzo-client.js` (defines `EIMZOClient`)
 * from `E-IMZO-v6.4.7-release.zip` — see `.superpowers/sdd/05.2-eimzo-real
 * /progress.md` for provenance. Neither file is a module; both attach plain
 * globals, which this file loads on demand (never at import time) and reads
 * off `window`.
 *
 * The vendor's own contract, read from `public/e-imzo-client.js` itself
 * rather than from any doc, since the source is the only accurate copy of
 * it in this project:
 *   EIMZOClient.checkVersion(success, fail)
 *   EIMZOClient.installApiKeys(success, fail)
 *   EIMZOClient.listAllUserKeys(itemIdGen, itemUiGen, success, fail)
 *   EIMZOClient.loadKey(itemObject, success, fail, verifyPassword)
 *   EIMZOClient.createPkcs7(id, data, timestamper, success, fail, detached, isDataBase64Encoded)
 *
 * One finding from reading `createPkcs7`'s BODY, not merely its signature:
 * in this vendored build the `timestamper` parameter is accepted but never
 * invoked anywhere — dead on the vendor's own side (confirmed by reading
 * every line of `public/e-imzo-client.js`; `timestamper` appears nowhere
 * else in the file). Ruling R5's mandatory timestamp is therefore NOT wired
 * through that callback: `signDocument` below calls our own `POST
 * /api/v1/eimzo/timestamp` itself, AFTER `createPkcs7` resolves, and returns
 * THAT result. `null` is passed in the `timestamper` argument position to
 * keep the call shape honest against the vendor's own signature, not
 * because anything reads it.
 *
 * Passwords are never typed into this page: `loadKey`'s native
 * `pfx/load_key` call pops the E-IMZO desktop app's OWN password dialog —
 * this client only ever sees success or failure of that round trip, never
 * the password itself. That is also why a `loadKey` failure maps
 * unconditionally to `EimzoPasswordError` (`errors.ts`'s own docstring):
 * by the time `loadKey` runs, `checkVersion` and `listAllUserKeys` have
 * already succeeded, so the one thing left able to fail natively is that
 * dialog.
 */
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import {
  EimzoChromeBlockedError,
  EimzoError,
  EimzoNotInstalledError,
  EimzoOutdatedVersionError,
  EimzoPasswordError,
} from './errors';

// ---- the vendor surface, typed locally (the vendor ships no .d.ts) -------

/** The raw object `_findPfxs2`/`_findTokens2` build per certificate/token —
 *  `disk/path/name/alias` (pfx) or `cardUID` (ftjc) are what `loadKey` needs
 *  to hand back to `EIMZOClient.loadKey`; the rest is the parsed X.500 name
 *  `listKeys` below turns into an `EimzoKeyInfo`. */
interface VendorKeyVo {
  type: 'pfx' | 'ftjc';
  CN: string;
  PINFL: string;
  TIN: string;
  O: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  [extra: string]: unknown;
}

type VendorFail = (e: unknown, reason: string | null) => void;

interface VendorEimzoClient {
  checkVersion(success: (major: string, minor: string) => void, fail: VendorFail): void;
  installApiKeys(success: () => void, fail: VendorFail): void;
  listAllUserKeys(
    itemIdGen: (vo: VendorKeyVo, index: string) => string,
    itemUiGen: (id: string, vo: VendorKeyVo) => string,
    success: (items: string[], firstId: string | null) => void,
    fail: VendorFail,
  ): void;
  loadKey(vo: VendorKeyVo, success: (keyId: string) => void, fail: VendorFail, verifyPassword: boolean): void;
  createPkcs7(
    id: string,
    data: string,
    timestamper: null,
    success: (pkcs7: string) => void,
    fail: VendorFail,
    detached: boolean,
    isDataBase64Encoded: boolean,
  ): void;
}

declare global {
  interface Window {
    EIMZOClient?: VendorEimzoClient;
    // `CAPIWS`/`Base64` are never read by this file directly (EIMZOClient
    // uses them internally) — declared only so TypeScript does not treat
    // assigning them at script-load time as touching an unknown global.
    CAPIWS?: unknown;
    Base64?: unknown;
  }
}

// ---- public shape ----------------------------------------------------

export interface EimzoKeyInfo {
  /** Opaque — round-trips through `loadKey` to look the raw vendor object
   *  back up in `keyRegistry`. Carries no meaning of its own. */
  id: string;
  commonName: string;
  pinfl: string;
  tin: string;
  organization: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  type: 'pfx' | 'ftjc';
}

// ---- vendor script loading ---------------------------------------------

const VENDOR_SCRIPTS = ['/e-imzo.js', '/e-imzo-client.js'];
let vendorLoadPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-eimzo-vendor="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.dataset.eimzoVendor = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`eimzo: failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Loads the two vendored scripts from `public/`, once. A no-op whenever
 * `window.EIMZOClient` already exists — the shape every test in this file
 * relies on: stub the global directly (`vi.stubGlobal('EIMZOClient', ...)`)
 * and this function never touches the DOM, never opens a WebSocket, and
 * needs no running dev server.
 */
async function ensureVendorLoaded(): Promise<void> {
  if (typeof window !== 'undefined' && window.EIMZOClient) return;
  vendorLoadPromise ??= (async () => {
    for (const src of VENDOR_SCRIPTS) await loadScript(src);
  })();
  return vendorLoadPromise;
}

// ---- error classification -----------------------------------------------

/**
 * `NEW_API`'s own threshold in the vendored `e-imzo-client.js`
 * (`installedVersion >= 336`, i.e. major.minor 3.36) — the exact gate
 * `listAllUserKeys` enforces by failing with its own untranslated 'Please
 * install new version of E-IMZO' below it. Checked proactively here so an
 * outdated install gets Task 11's localized, actionable message instead of
 * that raw vendor string reaching a citizen. Deliberately the LOWEST
 * capability tier the vendored client defines (not `NEW_API2`/`NEW_API3`,
 * 4.12/4.86) rather than the vendored release's own "6.4.7" — the two
 * numbering schemes are not the same thing, and this is the one threshold
 * this file can point at in the vendored source itself.
 */
const REQUIRED_VERSION = { major: 3, minor: 36 };

/** Chrome 147 (April 2026) is the version the vendor's own guidance names
 *  for the local-network-access prompt — see `EimzoChromeBlockedError`'s
 *  docstring. Parsed from the UA string rather than feature-testing the
 *  prompt itself, which this page cannot observe either way: a blocked
 *  WebSocket and "E-IMZO is not running" look identical from here. */
function isChromeLocalNetworkGate(): boolean {
  const match = /Chrome\/(\d+)/.exec(navigator.userAgent);
  return match != null && Number(match[1]) >= 147;
}

/** Every connection-level failure (the WebSocket to `wss://127.0.0.1:64443`
 *  never opened, or closed before answering) is the SAME event whether the
 *  cause is "E-IMZO is not installed" or "Chrome silently blocked it" —
 *  `client.ts` never tries to tell them apart from the failure itself, only
 *  from the browser running it. */
function connectionFailure(cause: unknown): EimzoError {
  return isChromeLocalNetworkGate() ? new EimzoChromeBlockedError(cause) : new EimzoNotInstalledError(cause);
}

function classifyFail(e: unknown, reason: string | null): EimzoError {
  return e ? connectionFailure(e) : new EimzoError('unknown', reason ?? 'eimzo: unspecified failure');
}

function requireClient(): VendorEimzoClient {
  const client = window.EIMZOClient;
  if (!client) throw connectionFailure(null);
  return client;
}

// ---- version + api keys --------------------------------------------------

async function checkVersion(): Promise<void> {
  await ensureVendorLoaded();
  const client = requireClient();
  await new Promise<void>((resolve, reject) => {
    client.checkVersion(
      (major, minor) => {
        const installed = Number(major) * 100 + Number(minor);
        const required = REQUIRED_VERSION.major * 100 + REQUIRED_VERSION.minor;
        if (installed < required) {
          reject(new EimzoOutdatedVersionError(`${major}.${minor}`));
          return;
        }
        resolve();
      },
      (e, reason) => reject(classifyFail(e, reason)),
    );
  });
}

/**
 * Best-effort: the vendored `EIMZOClient.API_KEYS` are the vendor's own
 * localhost/127.0.0.1 demo keys (`public/e-imzo-client.js`), not a key
 * issued for our production domains — `dev-admin.ruxsatnoma-urmon.uz` and
 * whatever domain prod ends up on have no key of their own registered with
 * the vendor yet (a business step, not something this task can complete).
 * A failure here is therefore NOT proof that E-IMZO itself is unusable —
 * many installs do not enforce the api-key check at all — so it is logged
 * and swallowed rather than raised: `listKeys`/`loadKey`/`createPkcs7`
 * below each fail on their own, with their own diagnosable reason, if the
 * missing key really does matter for a given install.
 */
async function ensureApiKeysInstalled(): Promise<void> {
  const client = requireClient();
  await new Promise<void>((resolve) => {
    client.installApiKeys(
      () => resolve(),
      (_e, reason) => {
        console.warn('eimzo: installApiKeys failed, continuing without it —', reason);
        resolve();
      },
    );
  });
}

// ---- key listing / loading ------------------------------------------------

/** Repopulated on every `listKeys()` call; `loadKey` reads it back by the id
 *  `listKeys` just handed out. Module-scoped rather than per-call because
 *  `loadKey` is a separate exported function a caller invokes with an
 *  `EimzoKeyInfo` some time after the `listKeys()` call that produced it. */
const keyRegistry = new Map<string, VendorKeyVo>();

function toKeyInfo(id: string, vo: VendorKeyVo): EimzoKeyInfo {
  return {
    id,
    commonName: vo.CN,
    pinfl: vo.PINFL,
    tin: vo.TIN,
    organization: vo.O,
    serialNumber: vo.serialNumber,
    validFrom: vo.validFrom,
    validTo: vo.validTo,
    type: vo.type,
  };
}

/** `EIMZOClient.listAllUserKeys(itemIdGen, itemUiGen, success, fail)` — the
 *  vendor calls `itemIdGen(vo, index)` once per certificate/token to mint an
 *  id, then `itemUiGen(id, vo)` for what it pushes into its own `items`
 *  array (a `<select>` option's HTML in the vendor's own demo; here, simply
 *  the same id, since the registry above already has everything else). */
export async function listKeys(): Promise<EimzoKeyInfo[]> {
  await checkVersion();
  await ensureApiKeysInstalled();
  const client = requireClient();
  keyRegistry.clear();
  return new Promise((resolve, reject) => {
    client.listAllUserKeys(
      (vo, index) => {
        const id = `${vo.type}-${index}-${vo.serialNumber || index}`;
        keyRegistry.set(id, vo);
        return id;
      },
      (id) => id,
      (items) => resolve(items.map((id) => toKeyInfo(id, keyRegistry.get(id)!))),
      (e, reason) => reject(classifyFail(e, reason)),
    );
  });
}

/** Triggers the E-IMZO app's OWN password dialog (`pfx/load_key`, then
 *  `verify_password` since this always asks with `verifyPassword: true`)
 *  and resolves to the vendor's own `keyId` — the id `createPkcs7` below
 *  takes, NOT the same as `EimzoKeyInfo.id` (that one is this module's own
 *  registry key). */
export async function loadKey(key: EimzoKeyInfo): Promise<string> {
  const vo = keyRegistry.get(key.id);
  if (!vo) throw new Error(`eimzo: loadKey called with an id listKeys() did not just produce (${key.id})`);
  const client = requireClient();
  return new Promise((resolve, reject) => {
    client.loadKey(
      vo,
      (keyId) => resolve(keyId),
      (e, reason) => reject(new EimzoPasswordError(e ?? reason)),
      true,
    );
  });
}

// ---- signing --------------------------------------------------------------

/** Plain (non-URL-safe) base64 of raw bytes, built the same way
 *  `eimzoMock.ts`'s own `base64EncodeBytes` does — NOT the vendor's own
 *  `Base64.encode`, which treats its input as a UTF-8 STRING (`utob` then
 *  `btoa`) and would corrupt arbitrary binary document bytes (a PDF) fed
 *  through it. Pre-encoding ourselves and calling `createPkcs7` with
 *  `isDataBase64Encoded: true` sidesteps that entirely. */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * `EIMZOClient.createPkcs7(id, data, timestamper, success, fail, detached,
 * isDataBase64Encoded)` — `data` is always pre-encoded here (see `toBase64`
 * above), and `timestamper` is always `null` (see this module's own
 * docstring for why: the vendored build never calls it).
 */
export async function createPkcs7(keyId: string, bytes: Uint8Array, options: { detached: boolean }): Promise<string> {
  const client = requireClient();
  return new Promise((resolve, reject) => {
    client.createPkcs7(
      keyId,
      toBase64(bytes),
      null,
      (pkcs7) => resolve(pkcs7),
      (e, reason) => reject(classifyFail(e, reason)),
      options.detached,
      true,
    );
  });
}

/**
 * Picks which certificate to sign with when `listKeys()` returns more than
 * one. This stage builds no picker UI — task 9-11's scope is the client and
 * the five call sites, not a certificate chooser — so the first key E-IMZO
 * reports is used, deterministically (the vendor's own enumeration order is
 * stable within a session). Flagged in the task report as a real, known gap
 * for whoever picks up a multi-certificate signer next.
 */
async function signWithFirstKey(bytes: Uint8Array, options: { detached: boolean }): Promise<string> {
  const keys = await listKeys();
  if (keys.length === 0) throw new EimzoNotInstalledError(null);
  if (keys.length > 1) {
    console.warn(
      `eimzo: ${keys.length} certificates found, signing with the first (${keys[0].serialNumber}) — no picker UI yet`,
    );
  }
  const keyId = await loadKey(keys[0]);
  return createPkcs7(keyId, bytes, options);
}

async function timestamp(pkcs7: string): Promise<string> {
  // Thrown as a plain `ApiError` — `isProviderUnreachable` (from `errors.ts`)
  // is how a CALL SITE recognises `ERR-INT-001`/`ERR-INT-002` later; nothing
  // here needs to branch on it, only pass the error through unwrapped.
  const { data, error } = await api.POST('/api/v1/eimzo/timestamp', { body: { pkcs7 } });
  if (error) throw apiError(error);
  return data.pkcs7;
}

/**
 * The whole DETACHED document-signing flow: pick a key, load it (the
 * native password dialog), sign, then hand the result to our own `POST
 * /eimzo/timestamp` (ruling R5 — a signature with no timestamp is refused
 * server-side, `timestamp_missing`) and return ITS pkcs7. Used by the three
 * document-signing call sites (`PermitSignaturesPanel`,
 * `PermitLifecyclePanel`, `ActSignCard`) — never for a login challenge or a
 * certificate registration, which are ATTACHED and never timestamped; see
 * `signAttached` below and the task report for why the split.
 */
export async function signDocument(bytes: Uint8Array): Promise<string> {
  const pkcs7 = await signWithFirstKey(bytes, { detached: true });
  return timestamp(pkcs7);
}

/**
 * The ATTACHED flow, with NO timestamp step — `register_certificate`
 * (`CertificatesSection`) and `login_via_eimzo` (`AuthProvider`) both
 * verify attached PKCS7 (`verify_attached`), and neither goes through
 * `signatures.service.sign()`, the one flow ruling R5's mandatory timestamp
 * actually gates (`build_verdict`/`timestamp_missing`). A timestamp on a
 * 120-second login challenge, or on a proof-of-possession nonce with no
 * document of its own, would assert something neither call needs.
 */
export async function signAttached(bytes: Uint8Array): Promise<string> {
  return signWithFirstKey(bytes, { detached: false });
}
