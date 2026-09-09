/**
 * `client.ts` against a STUBBED `window.EIMZOClient` — never a real
 * WebSocket, never a real E-IMZO install. Every test replaces the global
 * directly and removes it in `afterEach`, matching `ensureVendorLoaded`'s
 * own "already there, do nothing" branch: these tests never touch the DOM
 * script-loading path at all.
 */
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPkcs7, listKeys, loadKey, signAttached, signDocument } from './client';
import {
  EimzoChromeBlockedError,
  EimzoError,
  EimzoMultipleKeysError,
  EimzoNoValidKeyError,
  EimzoNotInstalledError,
  EimzoOutdatedVersionError,
  EimzoPasswordError,
} from './errors';

type SuccessFn = (...args: never[]) => void;
type FailFn = (e: unknown, reason: string | null) => void;

interface VendorStubOptions {
  version?: [string, string] | 'fail-connection';
  keys?: Array<Record<string, unknown>>;
  keysFail?: 'connection' | { reason: string };
  loadKeyFail?: boolean;
  createPkcs7Fail?: 'connection' | { reason: string };
}

function vendorKeyVo(overrides: Record<string, unknown> = {}) {
  return {
    type: 'pfx',
    disk: 'C',
    path: '/keys',
    name: 'key.pfx',
    alias: 'alias',
    CN: 'SAIDOV OTABEK',
    PINFL: '30491823410019',
    TIN: '',
    O: '',
    serialNumber: 'SN-1',
    validFrom: new Date('2026-01-01T00:00:00Z'),
    validTo: new Date('2027-01-01T00:00:00Z'),
    ...overrides,
  };
}

// Minor finding (fix wave): this used to be dropped on the floor by the
// stub's own signature (`createPkcs7: (_id, _data, _timestamper, success,
// fail)` — five params, ignoring the vendor's real sixth/seventh), so no
// test could ever have caught `signDocument`/`signAttached` swapping
// DETACHED and ATTACHED. Reset in `afterEach` below.
let lastCreatePkcs7Detached: boolean | undefined;

/** Installs `window.EIMZOClient` shaped exactly like the vendored
 *  `public/e-imzo-client.js` — same method names, same callback-pair shape —
 *  configured for one scenario at a time. */
function installVendorStub(options: VendorStubOptions = {}) {
  const keys = options.keys ?? [vendorKeyVo()];

  window.EIMZOClient = {
    checkVersion: (success: SuccessFn, fail: FailFn) => {
      if (options.version === 'fail-connection') {
        (fail as FailFn)(new Event('close'), null);
        return;
      }
      const [major, minor] = options.version ?? ['4', '86'];
      (success as (a: string, b: string) => void)(major, minor);
    },
    installApiKeys: (success: SuccessFn) => (success as () => void)(),
    listAllUserKeys: (
      itemIdGen: (vo: Record<string, unknown>, index: string) => string,
      itemUiGen: (id: string, vo: Record<string, unknown>) => string,
      success: SuccessFn,
      fail: FailFn,
    ) => {
      if (options.keysFail === 'connection') {
        fail(new Event('close'), null);
        return;
      }
      if (options.keysFail) {
        fail(null, options.keysFail.reason);
        return;
      }
      const ids = keys.map((vo, i) => itemIdGen(vo, String(i)));
      const items = ids.map((id, i) => itemUiGen(id, keys[i]));
      (success as (items: string[], firstId: string | null) => void)(items, items.length === 1 ? items[0] : null);
    },
    loadKey: (_vo: unknown, success: SuccessFn, fail: FailFn) => {
      if (options.loadKeyFail) {
        fail(null, 'wrong password');
        return;
      }
      (success as (keyId: string) => void)('vendor-key-id-1');
    },
    createPkcs7: (_id: string, _data: string, _timestamper: null, success: SuccessFn, fail: FailFn, detached: boolean) => {
      lastCreatePkcs7Detached = detached;
      if (options.createPkcs7Fail === 'connection') {
        fail(new Event('close'), null);
        return;
      }
      if (options.createPkcs7Fail) {
        fail(null, options.createPkcs7Fail.reason);
        return;
      }
      (success as (pkcs7: string) => void)('RAW-PKCS7');
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function stubUserAgent(ua: string) {
  vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(ua);
}

const CHROME_OLD = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const CHROME_147 = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/147.0.0.0 Safari/537.36';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  delete (window as { EIMZOClient?: unknown }).EIMZOClient;
  document.querySelectorAll('script[data-eimzo-vendor]').forEach((el) => el.remove());
  lastCreatePkcs7Detached = undefined;
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('listKeys', () => {
  it('maps the vendor callback pair to a resolved promise of parsed keys', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ keys: [vendorKeyVo({ CN: 'ALIYEV VALI', PINFL: '31708860250017' })] });
    const keys = await listKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ commonName: 'ALIYEV VALI', pinfl: '31708860250017', type: 'pfx' });
  });

  it('surfaces a missing/stopped E-IMZO as EimzoNotInstalledError on a browser that is not Chrome 147+', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ version: 'fail-connection' });
    await expect(listKeys()).rejects.toBeInstanceOf(EimzoNotInstalledError);
  });

  it('surfaces the SAME connection failure as EimzoChromeBlockedError on Chrome 147+ — a distinct message, not the same one', async () => {
    stubUserAgent(CHROME_147);
    installVendorStub({ version: 'fail-connection' });
    const err = await listKeys().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EimzoChromeBlockedError);
    expect(err).not.toBeInstanceOf(EimzoNotInstalledError);
  });

  it('surfaces a version below the required threshold as EimzoOutdatedVersionError', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ version: ['3', '10'] });
    const err = await listKeys().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EimzoOutdatedVersionError);
    expect((err as InstanceType<typeof EimzoOutdatedVersionError>).installedVersion).toBe('3.10');
  });

  it('a version at or above the threshold is accepted', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ version: ['3', '36'] });
    await expect(listKeys()).resolves.toHaveLength(1);
  });
});

describe('loadKey', () => {
  it('rejects a wrong password as EimzoPasswordError, never a generic error', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ loadKeyFail: true });
    const [key] = await listKeys();
    await expect(loadKey(key)).rejects.toBeInstanceOf(EimzoPasswordError);
  });

  it('resolves to the vendor keyId on success', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub();
    const [key] = await listKeys();
    await expect(loadKey(key)).resolves.toBe('vendor-key-id-1');
  });
});

describe('createPkcs7', () => {
  it('wraps the vendor callback pair and resolves to its pkcs7', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub();
    await expect(createPkcs7('vendor-key-id-1', new TextEncoder().encode('hello'), { detached: true })).resolves.toBe(
      'RAW-PKCS7',
    );
  });

  // Minor finding (fix wave): the stub used to ignore this argument
  // entirely, so nothing could tell a detached call from an attached one —
  // the exact mistake that produces a server refusal with no clue why.
  it.each([
    [true, true],
    [false, false],
  ])('passes options.detached=%s through to the vendor call as-is', async (detached, expected) => {
    stubUserAgent(CHROME_OLD);
    installVendorStub();
    await createPkcs7('vendor-key-id-1', new TextEncoder().encode('hello'), { detached });
    expect(lastCreatePkcs7Detached).toBe(expected);
  });
});

describe('signDocument', () => {
  it('signs DETACHED, then calls POST /eimzo/timestamp and returns ITS pkcs7 (ruling R5)', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub();
    let sawBody: { pkcs7: string } | undefined;
    server.use(
      http.post('*/api/v1/eimzo/timestamp', async ({ request }) => {
        sawBody = (await request.json()) as { pkcs7: string };
        return HttpResponse.json({ pkcs7: 'TIMESTAMPED-PKCS7' });
      }),
    );
    const result = await signDocument(new TextEncoder().encode('document bytes'));
    expect(sawBody?.pkcs7).toBe('RAW-PKCS7');
    expect(result).toBe('TIMESTAMPED-PKCS7');
    // Minor finding (fix wave): pinned so a future change cannot silently
    // swap DETACHED for ATTACHED here without a test noticing.
    expect(lastCreatePkcs7Detached).toBe(true);
  });

  it('propagates a not-installed failure without ever reaching the timestamp route', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ version: 'fail-connection' });
    let called = false;
    server.use(
      http.post('*/api/v1/eimzo/timestamp', () => {
        called = true;
        return HttpResponse.json({ pkcs7: 'x' });
      }),
    );
    await expect(signDocument(new TextEncoder().encode('doc'))).rejects.toBeInstanceOf(EimzoNotInstalledError);
    expect(called).toBe(false);
  });
});

describe('signAttached', () => {
  it('signs ATTACHED and returns the raw pkcs7 — NO timestamp call', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub();
    let called = false;
    server.use(
      http.post('*/api/v1/eimzo/timestamp', () => {
        called = true;
        return HttpResponse.json({ pkcs7: 'should-not-be-used' });
      }),
    );
    const result = await signAttached(new TextEncoder().encode('challenge-or-nonce'));
    expect(result).toBe('RAW-PKCS7');
    expect(called).toBe(false);
    // Minor finding (fix wave): pinned so a future change cannot silently
    // swap ATTACHED for DETACHED here without a test noticing.
    expect(lastCreatePkcs7Detached).toBe(false);
  });
});

describe('key selection (fix wave, finding 5)', () => {
  it('filters out an expired key and signs with the remaining valid one', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({
      keys: [
        vendorKeyVo({ serialNumber: 'SN-EXPIRED', validTo: new Date('2020-01-01T00:00:00Z') }),
        vendorKeyVo({ serialNumber: 'SN-VALID', validTo: new Date('2099-01-01T00:00:00Z') }),
      ],
    });
    await expect(signAttached(new TextEncoder().encode('nonce'))).resolves.toBe('RAW-PKCS7');
  });

  it('every key expired reports EimzoNoValidKeyError, never "not installed"', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ keys: [vendorKeyVo({ validTo: new Date('2020-01-01T00:00:00Z') })] });
    const err = await signAttached(new TextEncoder().encode('nonce')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EimzoNoValidKeyError);
    expect(err).not.toBeInstanceOf(EimzoNotInstalledError);
  });

  // Minor finding (fix wave): an empty key list (E-IMZO running, no key
  // present) used to report `EimzoNotInstalledError` — "install E-IMZO" is
  // the wrong instruction when the program answered with an empty list.
  it('an empty key list reports EimzoNoValidKeyError, never "not installed"', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ keys: [] });
    const err = await signAttached(new TextEncoder().encode('nonce')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EimzoNoValidKeyError);
    expect(err).not.toBeInstanceOf(EimzoNotInstalledError);
  });

  it('more than one valid key refuses to guess, naming the count and logging the candidates', async () => {
    stubUserAgent(CHROME_OLD);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    installVendorStub({
      keys: [
        vendorKeyVo({ commonName: 'PERSONAL CERT', serialNumber: 'SN-A' }),
        vendorKeyVo({ commonName: 'ORG CERT', serialNumber: 'SN-B' }),
      ],
    });
    const err = await signAttached(new TextEncoder().encode('nonce')).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(EimzoMultipleKeysError);
    expect((err as InstanceType<typeof EimzoMultipleKeysError>).count).toBe(2);
    // The specific certificates are named to the console, not guessed past.
    expect(warn.mock.calls.some((call) => call.some((arg) => String(arg).includes('SN-A')))).toBe(true);
    expect(warn.mock.calls.some((call) => call.some((arg) => String(arg).includes('SN-B')))).toBe(true);
  });

  it('retrying after a multiple-keys refusal with only one certificate left succeeds', async () => {
    // Deterministic-but-wrong was the whole bug: retrying used to reach the
    // exact same guess every time. Proves a retry CAN now succeed once the
    // set of connected certificates actually narrows to one.
    stubUserAgent(CHROME_OLD);
    installVendorStub({
      keys: [vendorKeyVo({ serialNumber: 'SN-A' }), vendorKeyVo({ serialNumber: 'SN-B' })],
    });
    await expect(signAttached(new TextEncoder().encode('nonce'))).rejects.toBeInstanceOf(EimzoMultipleKeysError);

    installVendorStub({ keys: [vendorKeyVo({ serialNumber: 'SN-A' })] });
    await expect(signAttached(new TextEncoder().encode('nonce'))).resolves.toBe('RAW-PKCS7');
  });
});

describe('generic vendor failures', () => {
  it('an unrecognised createPkcs7 failure with no connection-level cause becomes a plain EimzoError, not mis-labelled as one of the four named conditions', async () => {
    stubUserAgent(CHROME_OLD);
    installVendorStub({ createPkcs7Fail: { reason: 'something else entirely' } });
    const err = await createPkcs7('vendor-key-id-1', new TextEncoder().encode('x'), { detached: true }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(EimzoError);
    expect(err).not.toBeInstanceOf(EimzoNotInstalledError);
    expect(err).not.toBeInstanceOf(EimzoChromeBlockedError);
    expect(err).not.toBeInstanceOf(EimzoPasswordError);
    expect(err).not.toBeInstanceOf(EimzoOutdatedVersionError);
  });
});

describe('vendor script loading (minor finding, fix wave)', () => {
  // `window.EIMZOClient` is never installed in this suite — these tests
  // exercise the real `ensureVendorLoaded()`/`loadScript()` DOM path on
  // purpose, the one thing every other test in this file avoids.
  it('a failed script load does not poison later calls once it can succeed', async () => {
    stubUserAgent(CHROME_OLD);
    const originalCreateElement = document.createElement.bind(document);
    let attempt = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(document, 'createElement').mockImplementation((tag: any) => {
      const el = originalCreateElement(tag);
      if (tag === 'script') {
        queueMicrotask(() => {
          attempt += 1;
          if (attempt === 1) {
            // The vendor's own script load fails the first time — a network
            // blip, not proof E-IMZO is uninstalled.
            (el as HTMLScriptElement).onerror?.(new Event('error'));
          } else {
            if (attempt === 2) {
              // Once a script actually executes, it is what would define
              // the vendor global for real — reproduced here by installing
              // the stub right as the (retried) load "succeeds".
              installVendorStub();
            }
            (el as HTMLScriptElement).onload?.(new Event('load'));
          }
        });
      }
      return el;
    });

    // The script-load failure itself surfaces as the plain `Error`
    // `loadScript` throws (classification into an `EimzoError` kind is
    // `requireClient()`'s job, one level up, for when the vendor script DID
    // load but never defined the global) — what this test pins is that the
    // failure does not poison every later call.
    await expect(listKeys()).rejects.toThrow('failed to load');
    // The failed tag must not be left behind to short-circuit a real retry
    // (`loadScript`'s own `querySelector` guard would otherwise "succeed"
    // immediately over a global that was never actually defined).
    expect(document.querySelectorAll('script[data-eimzo-vendor]')).toHaveLength(0);

    await expect(listKeys()).resolves.toHaveLength(1);
  });
});
