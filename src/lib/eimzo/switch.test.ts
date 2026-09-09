/**
 * `src/lib/eimzo` is the ONE import surface task 10's five call sites use —
 * this file checks that surface itself: the mock/real switch reacts to
 * `VITE_EIMZO_MOCK` live (not frozen at first import, see `index.ts`'s own
 * docstring), and every existing mock builder/eligibility helper the app
 * already had is still reachable through it, unchanged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RECIPIENT_PURPOSE,
  buildMockPkcs7,
  buildMockSignature,
  canAttemptPurpose,
  createPkcs7,
  isEimzoMock,
  isPlausiblePinflOrStir,
  listKeys,
  loadKey,
  signAttached,
  signDocument,
} from './index';

afterEach(() => vi.unstubAllEnvs());

describe('isEimzoMock', () => {
  it('is true under this suite\'s own VITE_EIMZO_MOCK=true (vite.config.ts)', () => {
    expect(isEimzoMock()).toBe(true);
  });

  it('reacts to a later override — a module-level constant would not', () => {
    vi.stubEnv('VITE_EIMZO_MOCK', 'false');
    expect(isEimzoMock()).toBe(false);
  });

  it('anything other than the literal string "true" means real mode', () => {
    vi.stubEnv('VITE_EIMZO_MOCK', 'yes');
    expect(isEimzoMock()).toBe(false);
  });
});

describe('re-exports', () => {
  it('exposes every existing mock builder and eligibility helper unchanged', () => {
    expect(typeof buildMockSignature).toBe('function');
    expect(typeof buildMockPkcs7).toBe('function');
    expect(typeof canAttemptPurpose).toBe('function');
    expect(typeof isPlausiblePinflOrStir).toBe('function');
    expect(RECIPIENT_PURPOSE).toBe('permit_recipient');
  });

  it('exposes the real client functions', () => {
    expect(typeof listKeys).toBe('function');
    expect(typeof loadKey).toBe('function');
    expect(typeof createPkcs7).toBe('function');
    expect(typeof signDocument).toBe('function');
    expect(typeof signAttached).toBe('function');
  });
});
