import { apiErrorMessage, KNOWN_ERROR_CODES } from './errorMessages';

/**
 * The 63 codes `backend/app/core/errors.py`'s `ERRORS` dict defines as of
 * this writing (F4, `docs/plans/07.3-findings.md`). Pinned as a literal list
 * rather than read from the backend at test time — the two repos are
 * separate git histories with no shared build step — so a new backend code
 * shows up here as a failing test, not a silent gap.
 */
const BACKEND_ERROR_CODES = [
  'ERR-AUTH-001',
  'ERR-AUTH-002',
  'ERR-AUTH-003',
  'ERR-AUTH-004',
  'ERR-AUTH-005',
  'ERR-AUTH-006',
  'ERR-AUTH-007',
  'ERR-AUTH-008',
  'ERR-AUTH-009',
  'ERR-AUTH-010',
  'ERR-AUTH-011',
  'ERR-AUTH-012',
  'ERR-ACL-001',
  'ERR-ACL-002',
  'ERR-ACL-003',
  'ERR-APP-001',
  'ERR-APP-002',
  'ERR-APP-003',
  'ERR-APP-004',
  'ERR-GIS-001',
  'ERR-GIS-002',
  'ERR-GIS-003',
  'ERR-GIS-004',
  'ERR-GIS-005',
  'ERR-GIS-006',
  'ERR-NORM-001',
  'ERR-NORM-002',
  'ERR-NORM-003',
  'ERR-NORM-004',
  'ERR-NORM-005',
  'ERR-NORM-006',
  'ERR-PAY-001',
  'ERR-PAY-002',
  'ERR-PAY-003',
  'ERR-PAY-004',
  'ERR-PAY-005',
  'ERR-PAY-006',
  'ERR-PERM-001',
  'ERR-PERM-002',
  'ERR-PERM-003',
  'ERR-REP-001',
  'ERR-REP-002',
  'ERR-REP-003',
  'ERR-SIGN-001',
  'ERR-SIGN-002',
  'ERR-SIGN-003',
  'ERR-SIGN-004',
  'ERR-INSP-001',
  'ERR-INSP-002',
  'ERR-INT-001',
  'ERR-INT-002',
  'ERR-SYS-001',
  'ERR-SYS-002',
  'ERR-SYS-003',
  'ERR-SYS-004',
  'ERR-SYS-005',
  'ERR-SYS-006',
  'ERR-VAL-001',
  'ERR-PUB-001',
  'ERR-HELP-001',
  'ERR-SRCH-001',
  'ERR-ARCH-001',
  'ERR-ARCH-002',
] as const;

test('every one of the 63 backend error codes has copy in both UI languages', () => {
  expect(BACKEND_ERROR_CODES.length).toBe(63);
  for (const code of BACKEND_ERROR_CODES) {
    expect(KNOWN_ERROR_CODES).toContain(code);
    expect(apiErrorMessage({ code, message: 'server fallback text' }, 'ru')).not.toBe(
      'server fallback text',
    );
    expect(apiErrorMessage({ code, message: 'server fallback text' }, 'uz_latn')).not.toBe(
      'server fallback text',
    );
  }
});

test('a known code renders different, non-empty copy in each supported language', () => {
  const ru = apiErrorMessage({ code: 'ERR-APP-002', message: 'server text' }, 'ru');
  const uz = apiErrorMessage({ code: 'ERR-APP-002', message: 'server text' }, 'uz_latn');
  expect(ru).toBe('Активная заявка на пересекающийся период уже существует.');
  expect(uz).toBe('Kesishuvchi davr uchun faol ariza allaqachon mavjud.');
  expect(ru).not.toBe(uz);
});

test('an unknown code falls back to the server-provided message, not a blank', () => {
  const error = { code: 'ERR-FUTURE-999', message: 'a message only the backend knows yet' };
  expect(apiErrorMessage(error, 'ru')).toBe('a message only the backend knows yet');
  expect(apiErrorMessage(error, 'uz_latn')).toBe('a message only the backend knows yet');
});

test('something that is not even a coded error renders a generic sentence, never a blank', () => {
  expect(apiErrorMessage(new Error('network down'), 'ru')).toBe(
    'Произошла непредвиденная ошибка. Повторите попытку.',
  );
  expect(apiErrorMessage(undefined, 'uz_latn')).toBe('Kutilmagan xatolik yuz berdi. Qaytadan urining.');
});

test('ERR-APP-001 names the missing field when the backend sends one', () => {
  const withField = { code: 'ERR-APP-001', message: 'x', details: { missing: ['contour_id'] } };
  const withoutField = { code: 'ERR-APP-001', message: 'x' };
  expect(apiErrorMessage(withField, 'ru')).toBe('Не заполнено обязательное поле: contour_id.');
  expect(apiErrorMessage(withoutField, 'ru')).toBe('Не заполнено обязательное поле.');
});

test('ERR-GIS-004 names the unsupported format when the backend sends one', () => {
  const error = { code: 'ERR-GIS-004', message: 'x', details: { format: 'shp' } };
  expect(apiErrorMessage(error, 'uz_latn')).toBe("Fayl formati qo'llab-quvvatlanmaydi: shp.");
});

test('ERR-SYS-006 names the retry delay when the backend sends one', () => {
  const error = { code: 'ERR-SYS-006', message: 'x', details: { retry_after_seconds: 30 } };
  expect(apiErrorMessage(error, 'ru')).toBe('Слишком много запросов. Повторите через 30 с.');
});

test('a plain {code, message} object (not an ApiError instance) still resolves — e.g. a GIS import row error', () => {
  const rowError = { row: 3, code: 'ERR-GIS-005', message: 'server detail' };
  expect(apiErrorMessage(rowError, 'ru')).toBe('Конфликт состояния GIS-объекта. Обновите страницу.');
});
