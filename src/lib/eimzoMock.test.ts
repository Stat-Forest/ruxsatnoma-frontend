import { describe, expect, it } from 'vitest';
import { buildMockAttachedSignature, buildMockSignature, buildMockSignedChallenge, PINFL_PATTERN } from './eimzoMock';

function decode(envelope: string): Record<string, unknown> {
  const b64 = envelope.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
}

describe('buildMockSignedChallenge', () => {
  it('carries exactly the fields EimzoIdentity.from_payload reads', async () => {
    const envelope = await buildMockSignedChallenge({
      challenge: 'chal-1',
      pinfl: '30491823410019',
      fullName: 'SAIDOV OTABEK',
    });
    const payload = decode(envelope);
    expect(payload.challenge).toBe('chal-1');
    expect(payload.pinfl).toBe('30491823410019');
    expect(payload.full_name).toBe('SAIDOV OTABEK');
    // Optional on the dataclass, and must be present rather than undefined —
    // `EimzoIdentity(**payload)` rejects an unexpected key and accepts a null.
    expect(payload).toHaveProperty('tin', null);
    expect(payload).toHaveProperty('legal_name', null);
    expect(payload.cert_serial).toBe('MOCK-CERT');
  });

  it('produces base64url, never plain base64', async () => {
    const envelope = await buildMockSignedChallenge({
      challenge: 'chal/with+padding',
      pinfl: '30491823410019',
      fullName: 'TEST USER',
    });
    expect(envelope).not.toMatch(/[+/]/);
  });

  it('carries an org STIR in tin when B4 attaches a legal entity via org_eri', async () => {
    const envelope = await buildMockSignedChallenge({
      challenge: 'chal-2',
      pinfl: '30491823410019',
      fullName: 'SAIDOV OTABEK',
      tin: '123456789',
      legalName: 'OOO Forest LLC',
    });
    const payload = decode(envelope);
    expect(payload.tin).toBe('123456789');
    expect(payload.legal_name).toBe('OOO Forest LLC');
  });
});

describe('buildMockSignature', () => {
  it('uses CN=<fullName> for the subject when a name is given', async () => {
    const envelope = await buildMockSignature({
      pinfl: '30491823410019',
      documentBytes: new TextEncoder().encode('doc').buffer,
      fullName: 'SAIDOV OTABEK',
    });
    const payload = decode(envelope);
    expect(payload.subject).toBe('CN=SAIDOV OTABEK');
  });

  it('falls back to PINFL=<pinfl> for the subject when no name is given', async () => {
    const envelope = await buildMockSignature({
      pinfl: '30491823410019',
      documentBytes: new TextEncoder().encode('doc').buffer,
    });
    const payload = decode(envelope);
    expect(payload.subject).toBe('PINFL=30491823410019');
  });
});

describe('buildMockAttachedSignature', () => {
  it('carries a document_b64 whose sha256 matches document_sha256 (verify_attached can recover it)', async () => {
    const envelope = await buildMockAttachedSignature({ pinfl: '30491823410019' });
    const payload = decode(envelope);
    expect(typeof payload.document_b64).toBe('string');
    const bytes = Uint8Array.from(atob(payload.document_b64 as string), (c) => c.charCodeAt(0));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(payload.document_sha256).toBe(hex);
  });

  it('uses CN=<fullName> for the subject when a name is given, PINFL= otherwise', async () => {
    const named = decode(await buildMockAttachedSignature({ pinfl: '30491823410019', fullName: 'SAIDOV OTABEK' }));
    expect(named.subject).toBe('CN=SAIDOV OTABEK');
    const anon = decode(await buildMockAttachedSignature({ pinfl: '30491823410019' }));
    expect(anon.subject).toBe('PINFL=30491823410019');
  });
});

describe('PINFL_PATTERN', () => {
  it('accepts 14 digits and nothing else', () => {
    expect(PINFL_PATTERN.test('30491823410019')).toBe(true);
    expect(PINFL_PATTERN.test('3049182341001')).toBe(false);
    expect(PINFL_PATTERN.test('3049182341001a')).toBe(false);
  });
});
