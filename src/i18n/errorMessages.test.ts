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

// Stage 9, T3 — the exact bug behind the demo screenshot: a reversed date
// range reached the applicant as the generic "data failed validation"
// because this map dropped `details.reason` for ERR-VAL-001 entirely
// (`norms/checks.py::run_checks` and `service.py` both raise it this way).
test('ERR-VAL-001 names the real cause for each reason the backend sends', () => {
  const reversed = { code: 'ERR-VAL-001', message: 'x', details: { reason: 'period_reversed' } };
  const tooLong = { code: 'ERR-VAL-001', message: 'x', details: { reason: 'period_too_long' } };
  const qtyRequired = { code: 'ERR-VAL-001', message: 'x', details: { reason: 'quantity_required' } };

  expect(apiErrorMessage(reversed, 'ru')).toBe('Дата окончания периода не может быть раньше даты начала.');
  expect(apiErrorMessage(tooLong, 'ru')).toBe('Запрошенный период превышает допустимый максимум (5 лет).');
  expect(apiErrorMessage(qtyRequired, 'ru')).toBe('Не указано количество (объём) для выбранного вида деятельности.');

  expect(apiErrorMessage(reversed, 'uz_latn')).toBe(
    "Davr tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.",
  );
  expect(apiErrorMessage(tooLong, 'uz_latn')).toBe(
    "So'ralgan davr ruxsat etilgan maksimal muddatdan (5 yil) oshib ketdi.",
  );
  expect(apiErrorMessage(qtyRequired, 'uz_latn')).toBe(
    "Tanlangan faoliyat turi uchun miqdor (hajm) ko'rsatilmagan.",
  );
});

test('ERR-VAL-001 keeps the generic sentence for a reason this map does not recognise', () => {
  const unknown = { code: 'ERR-VAL-001', message: 'x', details: { reason: 'something_new' } };
  const noDetails = { code: 'ERR-VAL-001', message: 'x' };
  expect(apiErrorMessage(unknown, 'ru')).toBe('Ошибка проверки введённых данных.');
  expect(apiErrorMessage(noDetails, 'ru')).toBe('Ошибка проверки введённых данных.');
  expect(apiErrorMessage(noDetails, 'uz_latn')).toBe("Kiritilgan ma'lumotlarni tekshirishda xatolik.");
});

// `norms.checks.first_blocking_error` wraps the WHOLE check list under
// `details.checks` — this is the actual shape ERR-NORM-002 is thrown with
// today (`checks.py`'s `_limit_check` puts the numbers on the failing
// entry's own `details`, not at the top level).
test('ERR-NORM-002 names the numbers from the failing check nested under details.checks', () => {
  const error = {
    code: 'ERR-NORM-002',
    message: 'x',
    details: {
      checks: [
        { check: 'norm', result: 'pass', details: {} },
        {
          check: 'limit',
          result: 'fail',
          details: { used_sb: '160.0', max_sb: 147, committed_sb: '0', remaining_sb: '147', load_source: 'permits' },
        },
      ],
    },
  };
  expect(apiErrorMessage(error, 'ru')).toBe(
    'Запрошено 160 — превышает доступный лимит 147 (свободный остаток — 147).',
  );
  expect(apiErrorMessage(error, 'uz_latn')).toBe(
    "So'ralgan 160 — ruxsat etilgan 147 chegaradan oshib ketmoqda (erkin qoldiq — 147).",
  );
});

// The general shape stage 9's T4 is introducing (#176) — requested/capacity/
// remaining in the activity's own unit, straight at the top level.
test('ERR-NORM-002 names requested/capacity/remaining with their unit for a general (non-grazing) activity', () => {
  const error = {
    code: 'ERR-NORM-002',
    message: 'x',
    details: { requested: '12.5', capacity: '10', remaining: '2', unit: 'ha' },
  };
  expect(apiErrorMessage(error, 'ru')).toBe(
    'Запрошено 12,5 ha — превышает доступный лимит 10 ha (свободный остаток — 2 ha).',
  );
});

test('ERR-NORM-002 names the date a contour with no capacity frees up', () => {
  const dated = {
    code: 'ERR-NORM-002',
    message: 'x',
    details: { reason: 'exclusive_occupied', free_from: '2026-12-01' },
  };
  const undated = { code: 'ERR-NORM-002', message: 'x', details: { reason: 'exclusive_occupied' } };
  expect(apiErrorMessage(dated, 'ru')).toBe(
    'Контур занят до 01.12.2026. Новое разрешение возможно только после этой даты.',
  );
  expect(apiErrorMessage(undated, 'ru')).toBe('Контур занят на весь запрошенный период.');
});

test('ERR-NORM-002 keeps the generic sentence when it recognises none of these shapes', () => {
  const error = { code: 'ERR-NORM-002', message: 'x', details: { checks: [] } };
  const noDetails = { code: 'ERR-NORM-002', message: 'x' };
  expect(apiErrorMessage(error, 'ru')).toBe('Превышен остаток лимита.');
  expect(apiErrorMessage(noDetails, 'uz_latn')).toBe("Limit qoldig'i oshib ketdi.");
});

// Stage 10, F2 (rulings #181/#182) — `decision.approve` refuses with these
// two `reason`s while the leshoz's own benefit-claim verify/reject has not
// cleared the application; `DecisionPanel`'s disabled Approve button is the
// proactive guard, this map is the backstop for the race it cannot see.
test('ERR-APP-004 names the benefit-claim cause when the backend sends one', () => {
  const unverified = { code: 'ERR-APP-004', message: 'x', details: { reason: 'benefit_unverified' } };
  const rejectedWithReason = {
    code: 'ERR-APP-004',
    message: 'x',
    details: { reason: 'benefit_rejected', benefit_rejection_reason: 'Sertifikat muddati oʻtgan' },
  };
  const rejectedNoReason = { code: 'ERR-APP-004', message: 'x', details: { reason: 'benefit_rejected' } };

  expect(apiErrorMessage(unverified, 'ru')).toBe('Заявка на льготу ещё не проверена.');
  expect(apiErrorMessage(rejectedWithReason, 'ru')).toBe('Льгота отклонена: Sertifikat muddati oʻtgan');
  expect(apiErrorMessage(rejectedNoReason, 'ru')).toBe('Льгота отклонена.');

  expect(apiErrorMessage(unverified, 'uz_latn')).toBe("Imtiyoz da'vosi hali tekshirilmagan.");
  expect(apiErrorMessage(rejectedNoReason, 'uz_latn')).toBe('Imtiyoz rad etilgan.');
});

test('ERR-APP-004 keeps the generic sentence for every other reason', () => {
  const badTransition = { code: 'ERR-APP-004', message: 'x', details: { reason: 'bad_transition' } };
  const noDetails = { code: 'ERR-APP-004', message: 'x' };
  expect(apiErrorMessage(badTransition, 'ru')).toBe('Недопустимый переход статуса заявки. Обновите страницу.');
  expect(apiErrorMessage(noDetails, 'uz_latn')).toBe("Ariza holatini bunday o'zgartirib bo'lmaydi. Sahifani yangilang.");
});

// Stage 10, F1 — ruling #181: the mandatory benefit-certificate number,
// named by `details.reason` the same way `ERR-VAL-001` already is. Ruling
// #206 removed the register check, so `required` is the only reason left.
test('ERR-APP-003 names the benefit-certificate reason the backend sends', () => {
  const required = { code: 'ERR-APP-003', message: 'x', details: { reason: 'benefit_certificate_required' } };
  const noReason = { code: 'ERR-APP-003', message: 'x' };

  expect(apiErrorMessage(required, 'ru')).toBe(
    'Не указан номер справки/свидетельства для выбранной льготной категории.',
  );
  expect(apiErrorMessage(noReason, 'ru')).toBe('Неполный комплект документов.');

  expect(apiErrorMessage(required, 'uz_latn')).toBe(
    "Tanlangan imtiyoz toifasi uchun guvohnoma/ma'lumotnoma raqami ko'rsatilmagan.",
  );
});

// Ruling #183: a simple signature's own refusal reasons, plus the real-mode
// envelope ones — all told apart only by `details.reason`, same as above.
test('ERR-SIGN-001 names the reason the backend sends', () => {
  const notAllowed = { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'simple_signature_not_allowed' } };
  const pinflUnknown = { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'signer_pinfl_unknown' } };
  const invalid = { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'signature_invalid' } };
  const changed = { code: 'ERR-SIGN-001', message: 'x', details: { reason: 'package_changed' } };
  const noReason = { code: 'ERR-SIGN-001', message: 'x' };

  expect(apiErrorMessage(notAllowed, 'ru')).toBe(
    'Простая подпись без ключа допустима только для гражданина, подающего заявку от своего имени — для этой заявки нужна электронная цифровая подпись (ЭЦП).',
  );
  expect(apiErrorMessage(pinflUnknown, 'ru')).toBe('Не удалось определить ПИНФЛ подписанта — обратитесь в поддержку.');
  expect(apiErrorMessage(invalid, 'ru')).toBe('Электронная подпись не прошла проверку.');
  expect(apiErrorMessage(changed, 'ru')).toBe(
    'Данные заявки изменились после формирования пакета — обновите страницу и попробуйте снова.',
  );
  expect(apiErrorMessage(noReason, 'ru')).toBe('Ошибка подписания.');

  expect(apiErrorMessage(notAllowed, 'uz_latn')).toBe(
    "Kalitsiz oddiy imzo faqat o'zi uchun ariza topshirayotgan fuqaroga ruxsat etilgan — bu ariza uchun elektron raqamli imzo (ERI) kerak.",
  );
  expect(apiErrorMessage(pinflUnknown, 'uz_latn')).toBe(
    "Imzolovchining JSHSHIR raqami aniqlanmadi — qo'llab-quvvatlash xizmatiga murojaat qiling.",
  );
});

// Ruling #184: normally unreachable through the UI (the sign button stays
// disabled until the checkbox is ticked), but a defensive server refusal
// must still read as a sentence, not the raw field name.
test('ERR-APP-001 gives rules_accepted a human label instead of the raw field name', () => {
  const error = { code: 'ERR-APP-001', message: 'x', details: { missing: ['rules_accepted'] } };
  expect(apiErrorMessage(error, 'ru')).toBe('Не заполнено обязательное поле: «Согласен с правилами».');
  expect(apiErrorMessage(error, 'uz_latn')).toBe(
    "Majburiy maydon to'ldirilmagan: «Qoidalar bilan tanishdim».",
  );
});
