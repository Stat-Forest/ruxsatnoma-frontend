/**
 * Task 11's own taxonomy: every named vendor condition maps to a DISTINCT
 * i18n key, and all three language files actually carry distinct, non-empty
 * text for every one of them — the two things the task brief calls out by
 * name ("no two conditions may collapse into one string").
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/errors';
import { ru } from '../../i18n/ru';
import { uz_cyrl_eimzo_errors } from '../../i18n/uz_cyrl';
import { uz_latn } from '../../i18n/uz_latn';
import {
  EIMZO_ERROR_MESSAGE_KEYS,
  EimzoChromeBlockedError,
  EimzoNotInstalledError,
  EimzoOutdatedVersionError,
  EimzoPasswordError,
  eimzoErrorMessageKey,
  isProviderUnreachable,
} from './errors';

const ALL_KEYS = Object.values(EIMZO_ERROR_MESSAGE_KEYS);

describe('eimzoErrorMessageKey', () => {
  it('maps each of the four EimzoError kinds to its own key', () => {
    const keys = [
      eimzoErrorMessageKey(new EimzoNotInstalledError()),
      eimzoErrorMessageKey(new EimzoChromeBlockedError()),
      eimzoErrorMessageKey(new EimzoOutdatedVersionError('3.10')),
      eimzoErrorMessageKey(new EimzoPasswordError()),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('maps ERR-INT-001/ERR-INT-002 to the provider-unreachable key — condition 5, not one of the four vendor kinds', () => {
    expect(eimzoErrorMessageKey(new ApiError('ERR-INT-001', 'no answer'))).toBe(
      EIMZO_ERROR_MESSAGE_KEYS.provider_unreachable,
    );
    expect(eimzoErrorMessageKey(new ApiError('ERR-INT-002', 'provider error'))).toBe(
      EIMZO_ERROR_MESSAGE_KEYS.provider_unreachable,
    );
  });

  it('anything else falls back to the unknown key, distinct from the five named conditions', () => {
    const fallback = eimzoErrorMessageKey(new Error('something else'));
    expect(fallback).toBe(EIMZO_ERROR_MESSAGE_KEYS.unknown);
    expect(fallback).not.toBe(eimzoErrorMessageKey(new EimzoNotInstalledError()));
  });
});

describe('isProviderUnreachable', () => {
  it('is true only for ERR-INT-001/ERR-INT-002', () => {
    expect(isProviderUnreachable(new ApiError('ERR-INT-001', 'x'))).toBe(true);
    expect(isProviderUnreachable(new ApiError('ERR-INT-002', 'x'))).toBe(true);
    expect(isProviderUnreachable(new ApiError('ERR-SIGN-001', 'x'))).toBe(false);
    expect(isProviderUnreachable(new Error('not an ApiError'))).toBe(false);
    expect(isProviderUnreachable(null)).toBe(false);
  });
});

describe.each([
  ['uz_latn (required, decision #90)', uz_latn as Record<string, string>],
  ['ru', ru as Record<string, string>],
  ['uz_cyrl (task 11, not yet a first-class UiLanguage — see uz_cyrl.ts)', uz_cyrl_eimzo_errors],
])('%s', (_label, dict) => {
  it('defines non-empty text for every one of the six message keys', () => {
    for (const key of ALL_KEYS) {
      expect(dict[key], `missing or empty: ${key}`).toBeTruthy();
    }
  });

  it('never collapses two conditions into the same string', () => {
    const texts = ALL_KEYS.map((key) => dict[key]);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
