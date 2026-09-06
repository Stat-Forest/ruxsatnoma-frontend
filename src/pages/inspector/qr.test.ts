import { parseQrInput } from './qr';

test('a full check URL extracts its qr param', () => {
  expect(parseQrInput('https://ruxsatnoma.uz/check?qr=ABC123')).toEqual({ qr: 'ABC123' });
});

test('a URL with unrelated params and no qr falls back to the whole trimmed input', () => {
  const input = 'https://ruxsatnoma.uz/check?foo=bar';
  expect(parseQrInput(input)).toEqual({ qr: input });
});

test('a bare token string returns itself, trimmed', () => {
  expect(parseQrInput('  QR-TOKEN-42  ')).toEqual({ qr: 'QR-TOKEN-42' });
});

test('empty or whitespace-only input returns null', () => {
  expect(parseQrInput('')).toBeNull();
  expect(parseQrInput('   ')).toBeNull();
});
