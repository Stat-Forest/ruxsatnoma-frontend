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
    createPkcs7: (_id: string, _data: string, _timestamper: null, success: SuccessFn, fail: FailFn) => {
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
