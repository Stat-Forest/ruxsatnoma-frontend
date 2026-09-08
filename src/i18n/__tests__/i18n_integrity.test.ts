import { describe, expect, it } from 'vitest';
import { DICTIONARIES, type UiLanguage } from '../context';
import { en } from '../en';
import { ru } from '../ru';
import { uz_cyrl } from '../uz_cyrl';
import { uz_latn } from '../uz_latn';
import {
  getInvoiceStatusLabel,
  getMatchStatusLabel,
  getRefundStatusLabel,
} from '../../pages/accountant/statusMeta';
import { getPermitStatusLabel } from '../../pages/permits/statusMeta';
import { statusLabel } from '../../pages/staff/format';

const ALL_LANGS: UiLanguage[] = ['uz_latn', 'uz_cyrl', 'ru', 'en', 'kaa'];

describe('i18n Dictionaries Integrity', () => {
  it('all 5 languages must have identical key count and keys', () => {
    const latnKeys = Object.keys(uz_latn).sort();
    expect(latnKeys.length).toBeGreaterThan(1000);

    for (const lang of ALL_LANGS) {
      const dict = DICTIONARIES[lang];
      const keys = Object.keys(dict).sort();
      expect(keys, `Missing or extra keys in ${lang}`).toEqual(latnKeys);
    }
  });

  it('no key should have empty string value across all 5 languages', () => {
    for (const lang of ALL_LANGS) {
      const dict = DICTIONARIES[lang];
      for (const [key, val] of Object.entries(dict)) {
        expect(val.trim().length, `Empty string at ${lang} [${key}]`).toBeGreaterThan(0);
      }
    }
  });

  it('Russian dictionary contains valid Cyrillic text and no pure Uzbek words', () => {
    const uzbekSpecificWords = ['va', 'bilan', 'yoki', 'uchun', 'hamda', 'bo‘yicha', "bo'yicha", 'barchasi'];
    const failures: string[] = [];

    for (const [key, val] of Object.entries(ru)) {
      const words = val.toLowerCase().split(/\s+/);
      for (const uzWord of uzbekSpecificWords) {
        if (words.includes(uzWord)) {
          failures.push(`${key}: "${val}" contains Uzbek word "${uzWord}"`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('English dictionary contains valid text and no pure Uzbek words', () => {
    const uzbekSpecificWords = ['va', 'bilan', 'uchun', 'hamda', 'bo‘yicha', "bo'yicha", 'barchasi', 'yopish'];
    const failures: string[] = [];

    for (const [key, val] of Object.entries(en)) {
      const words = val.toLowerCase().split(/\s+/);
      for (const uzWord of uzbekSpecificWords) {
        if (words.includes(uzWord)) {
          failures.push(`${key}: "${val}" contains Uzbek word "${uzWord}"`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it('Uzbek Cyrillic dictionary contains Cyrillic script (excluding allowed abbreviations)', () => {
    const allowed = new Set([
      'OneID', 'E-IMZO', 'GEOJSON', 'WGS84', 'norms_publish_scope',
      'UUID', 'PINFL', 'STIR', 'SOATO', 'EPSG', 'HTTPS',
      'XLSX', 'REST', 'HTTP', 'JSON', 'OKED', 'SPIC', 'IFUT', 'true', 'false',
      'PDF', 'CSV', 'SMS', 'GIS', 'ERI', 'SHP', 'URL', 'API', 'RFC', 'INN', 'SLA',
      'QR', 'IP', 'ID', 'TIN'
    ]);

    const allowedSorted = Array.from(allowed).sort((a, b) => b.length - a.length);

    const failures: string[] = [];
    for (const [key, val] of Object.entries(uz_cyrl)) {
      let stripped = val;
      for (const word of allowedSorted) {
        stripped = stripped.split(word).join('');
      }
      const latinLetters = stripped.match(/[a-zA-Z]/g);
      if (latinLetters) {
        failures.push(`${key}: "${val}" has leftover Latin letters: ${latinLetters.join('')}`);
      }
    }

    expect(failures, `Found Cyrillic entries with Latin letters:\n${failures.join('\n')}`).toEqual([]);
  });

  it('all accountant status dictionaries provide labels in all 5 languages', () => {
    const invoiceStatuses = ['pending', 'paid', 'cancelled', 'expired'];
    for (const s of invoiceStatuses) {
      for (const l of ALL_LANGS) {
        const label = getInvoiceStatusLabel(s, l);
        expect(label).toBeTruthy();
        expect(label).not.toBe(s); // Must not fallback to raw code
      }
    }

    const matchStatuses = ['matched', 'unmatched', 'unknown_payment', 'discrepancy', 'provider_settlement'];
    for (const s of matchStatuses) {
      for (const l of ALL_LANGS) {
        const label = getMatchStatusLabel(s, l);
        expect(label).toBeTruthy();
        expect(label).not.toBe(s);
      }
    }

    const refundStatuses = ['requested', 'in_review', 'returned', 'rejected'];
    for (const s of refundStatuses) {
      for (const l of ALL_LANGS) {
        const label = getRefundStatusLabel(s, l);
        expect(label).toBeTruthy();
        expect(label).not.toBe(s);
      }
    }
  });

  it('permit and application statuses provide labels in all 5 languages', () => {
    const permitStatuses = ['pending_signatures', 'active', 'revoked', 'expired', 'suspended', 'archived'];
    for (const s of permitStatuses) {
      for (const l of ALL_LANGS) {
        const label = getPermitStatusLabel(s, l);
        expect(label).toBeTruthy();
        expect(label).not.toBe(s);
      }
    }

    const appStatuses = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
    for (const s of appStatuses) {
      for (const l of ALL_LANGS) {
        const label = statusLabel(s, l);
        expect(label).toBeTruthy();
      }
    }
  });
});
