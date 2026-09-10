import type { UiLanguage } from './context';

/**
 * User-facing copy for every domain error code the backend defines
 * (`backend/app/core/errors.py`, `ERRORS` dict — 63 codes as of this
 * writing), keyed by the two UI dictionaries that actually exist
 * (`UiLanguage`, `src/i18n/context.ts`). `uz_cyrl`/`kaa`/`en` reach this
 * through `resolveLanguage()` the same way the rest of the UI falls back —
 * this map only needs the two real dictionaries.
 *
 * Before this map, every refusal reached the user as the server's own
 * Russian string, `${code}: ${message}`, regardless of the interface
 * language (F4, `docs/plans/07.3-findings.md`). `apiErrorMessage` below is
 * the one place that renders an `ApiError`; a code missing from this map — a
 * backend addition this map has not caught up with yet — still renders the
 * server's own message rather than a blank line, exactly the same fallback
 * `PermitDocumentPage.tsx` and `reports/errors.ts` already use for the codes
 * they don't special-case.
 *
 * `ERR-SYS-000` is not a backend code — it's this frontend's own sentinel
 * for "not really an ApiError" (`api/errors.ts::apiError`'s parse fallback,
 * and every `catch` block that normalises a thrown non-`ApiError` into one).
 * It gets a real translation here too, since it is what a dropped
 * connection or an unparseable response actually renders as.
 */

/** A field worth showing without printing the whole `details` object at
 *  anyone (F3, the sibling finding — never raw JSON). Only a handful of
 *  codes carry a detail specific enough to improve on the generic sentence;
 *  everything else ignores `details` and returns the same text every time. */
type ErrorDetails = Record<string, unknown> | null | undefined;
type ErrorCopy = string | ((details: ErrorDetails) => string);

function str(details: ErrorDetails, key: string): string | undefined {
  const value = details?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function num(details: ErrorDetails, key: string): number | undefined {
  const value = details?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function strList(details: ErrorDetails, key: string): string[] {
  const value = details?.[key];
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** A `Decimal` quantity the backend serializes as a numeric STRING
 *  (`norms.calculator.jsonable`: `Decimal` -> `str`, never `float`, so money
 *  and norm quantities round-trip exactly) — read as that string or as a
 *  plain JSON number, and trimmed of a trailing-zero tail the way every
 *  other quantity display in this app already is (`ChecksList.tsx`'s own
 *  `trimSbNumber`, duplicated here rather than imported across the module
 *  boundary between `i18n/` and `pages/applicant/`). */
function decimal(details: ErrorDetails, key: string): string | undefined {
  const value = details?.[key];
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const raw = String(value);
  if (raw.length === 0) return undefined;
  const trimmed = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  return (trimmed || '0').replace('.', ',');
}

/** `norms.checks.first_blocking_error` wraps the WHOLE check list under
 *  `details.checks` (one shape shared by every `ERR-NORM-00x` code, not
 *  specific to the limit check), so the numbers a capacity refusal carries —
 *  `requested`/`capacity`/`remaining` (or grazing's own `used_sb`/`max_sb`/
 *  `remaining_sb`), and `reason: "exclusive_occupied"` — live on the failing
 *  entry's OWN `details`, not at the top level. Falls back to `details`
 *  itself in case a future caller raises `ERR-NORM-002` directly with the
 *  numbers already at the top level. */
function limitDetails(details: ErrorDetails): ErrorDetails {
  const checks = details?.checks;
  if (Array.isArray(checks)) {
    const failing = checks.find(
      (c) =>
        c &&
        typeof c === 'object' &&
        (c as Record<string, unknown>).check === 'limit' &&
        (c as Record<string, unknown>).result === 'fail',
    ) as Record<string, unknown> | undefined;
    const nested = failing?.details;
    if (nested && typeof nested === 'object') return nested as ErrorDetails;
  }
  return details;
}

function formatIsoDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-');
  return y && m && d ? `${d}.${m}.${y}` : value;
}

const ru: Record<string, ErrorCopy> = {
  'ERR-AUTH-001': 'Неверный логин или пароль.',
  'ERR-AUTH-002': 'Сессия истекла. Войдите снова.',
  'ERR-AUTH-003': 'Слишком много попыток входа. Аккаунт временно заблокирован.',
  'ERR-AUTH-004': 'Сертификат электронной подписи истёк или отозван.',
  'ERR-AUTH-005': 'Верификация «Raqamli nazorat» не пройдена.',
  'ERR-AUTH-006': 'Не удалось подтвердить запрос (CSRF). Обновите страницу и повторите попытку.',
  'ERR-AUTH-007': 'Требуется смена пароля.',
  'ERR-AUTH-008': 'Регистрация не завершена.',
  'ERR-AUTH-009': 'Слишком много запросов кода подтверждения. Повторите позже.',
  'ERR-AUTH-010': 'Неверный или истёкший код подтверждения.',
  'ERR-AUTH-011': 'Представительство уже действует.',
  'ERR-AUTH-012': 'Регистрация уже завершена.',
  'ERR-ACL-001': 'У вас нет прав на это действие.',
  'ERR-ACL-002': 'Запрос вне вашей территориальной зоны ответственности.',
  'ERR-ACL-003': 'Изменение недоступно для роли «только чтение».',
  'ERR-APP-001': (details) => {
    const missing = strList(details, 'missing');
    return missing.length
      ? `Не заполнено обязательное поле: ${missing.join(', ')}.`
      : 'Не заполнено обязательное поле.';
  },
  'ERR-APP-002': (details) => {
    const number = str(details, 'existing_number');
    return number
      ? `Активная заявка №${number} на пересекающийся период уже существует.`
      : 'Активная заявка на пересекающийся период уже существует.';
  },
  'ERR-APP-003': 'Неполный комплект документов.',
  'ERR-APP-004': 'Недопустимый переход статуса заявки. Обновите страницу.',
  'ERR-GIS-001': 'Невалидная геометрия участка.',
  'ERR-GIS-002': 'Геометрия вне границ лесного фонда.',
  'ERR-GIS-003': 'Пересечение с зоной ограничений или охраны.',
  'ERR-GIS-004': (details) => {
    const format = str(details, 'format');
    return format ? `Неподдерживаемый формат файла: ${format}.` : 'Неподдерживаемый формат файла.';
  },
  'ERR-GIS-005': 'Конфликт состояния GIS-объекта. Обновите страницу.',
  'ERR-GIS-006': 'Части не образуют точное разделение исходного контура.',
  'ERR-NORM-001': 'На контуре нет утверждённой нормы.',
  'ERR-NORM-002': (details) => {
    const limit = limitDetails(details);
    if (str(limit, 'reason') === 'exclusive_occupied') {
      const until = str(limit, 'free_from') ?? str(limit, 'until') ?? str(limit, 'occupied_until') ?? str(limit, 'available_from');
      return until
        ? `Контур занят до ${formatIsoDate(until)}. Новое разрешение возможно только после этой даты.`
        : 'Контур занят на весь запрошенный период.';
    }
    const unit = str(limit, 'unit');
    const suffix = (value: string) => (unit ? `${value} ${unit}` : value);
    const requested = decimal(limit, 'requested') ?? decimal(limit, 'used_sb');
    const capacity = decimal(limit, 'capacity') ?? decimal(limit, 'max_sb');
    const remaining = decimal(limit, 'remaining') ?? decimal(limit, 'remaining_sb');
    if (requested === undefined || capacity === undefined) return 'Превышен остаток лимита.';
    return remaining !== undefined
      ? `Запрошено ${suffix(requested)} — превышает доступный лимит ${suffix(capacity)} (свободный остаток — ${suffix(remaining)}).`
      : `Запрошено ${suffix(requested)} — превышает доступный лимит ${suffix(capacity)}.`;
  },
  'ERR-NORM-003': 'Период не соответствует сезону или ротации.',
  'ERR-NORM-004': 'Не задан параметр расчёта.',
  'ERR-NORM-005': 'Конфликт состояния или периода нормы. Обновите страницу.',
  'ERR-NORM-006': 'Действует пожарный запрет.',
  'ERR-PAY-001': 'Подтверждение оплаты не поступило.',
  'ERR-PAY-002': 'Срок оплаты истёк.',
  'ERR-PAY-003': 'Сумма оплаты не совпадает с суммой счёта.',
  'ERR-PAY-004': 'Счёт не может быть оплачен в текущем статусе.',
  'ERR-PAY-005': 'Расхождение уже закрыто.',
  'ERR-PAY-006': 'Запрос на возврат нельзя изменить в текущем статусе.',
  'ERR-PERM-001': 'Недопустимый переход статуса разрешения. Обновите страницу.',
  'ERR-PERM-002': 'Документ уже подписан и не может быть перевыпущен.',
  'ERR-PERM-003': 'Конфликт состояния лесного билета. Обновите страницу.',
  'ERR-REP-001': 'Конфликт состояния отчёта. Обновите страницу.',
  'ERR-REP-002': 'Отчёт не проходит логические проверки.',
  'ERR-REP-003': 'Форма отчёта не может быть использована.',
  'ERR-SIGN-001': 'Ошибка подписания.',
  'ERR-SIGN-002': 'Эта подпись уже проставлена.',
  'ERR-SIGN-003': 'Не хватает подписей.',
  'ERR-SIGN-004': 'Конфликт состояния сертификата или подписи. Повторите попытку.',
  'ERR-INSP-001': 'Недопустимый переход статуса проверки. Обновите страницу.',
  'ERR-INSP-002': 'Чек-лист заполнен не полностью.',
  'ERR-INT-001': 'Внешний сервис не ответил. Повторите попытку позже.',
  'ERR-INT-002': 'Внешний сервис вернул ошибку. Повторите попытку позже.',
  'ERR-SYS-001': 'Внутренняя ошибка сервера. Попробуйте позже.',
  'ERR-SYS-002': 'Сервис временно недоступен. Попробуйте позже.',
  'ERR-SYS-003': 'Ресурс не найден.',
  'ERR-SYS-004': 'Метод не поддерживается.',
  'ERR-SYS-005': 'Повторный запрос отклонён (конфликт ключа идемпотентности).',
  'ERR-SYS-006': (details) => {
    const retry = num(details, 'retry_after_seconds');
    return retry
      ? `Слишком много запросов. Повторите через ${retry} с.`
      : 'Слишком много запросов. Повторите попытку позже.';
  },
  'ERR-VAL-001': (details) => {
    switch (str(details, 'reason')) {
      case 'period_reversed':
        return 'Дата окончания периода не может быть раньше даты начала.';
      case 'period_too_long':
        return 'Запрошенный период превышает допустимый максимум (5 лет).';
      case 'quantity_required':
        return 'Не указано количество (объём) для выбранного вида деятельности.';
      default:
        return 'Ошибка проверки введённых данных.';
    }
  },
  'ERR-PUB-001': 'Недопустимый переход статуса обращения. Обновите страницу.',
  'ERR-HELP-001': 'Действие недоступно для текущего статуса обращения в поддержку.',
  'ERR-SRCH-001': 'Профиль поиска с таким именем уже существует.',
  'ERR-ARCH-001': 'Объект не может быть архивирован в текущем статусе.',
  'ERR-ARCH-002': 'Нарушена целостность архивной копии.',
  'ERR-SYS-000': 'Произошла непредвиденная ошибка. Повторите попытку.',
};

const uz_latn: Record<string, ErrorCopy> = {
  'ERR-AUTH-001': "Login yoki parol noto'g'ri.",
  'ERR-AUTH-002': 'Sessiya muddati tugadi. Qaytadan tizimga kiring.',
  'ERR-AUTH-003': "Kirish urinishlari soni oshib ketdi. Hisob vaqtincha bloklandi.",
  'ERR-AUTH-004': "Elektron raqamli imzo sertifikatining muddati tugagan yoki bekor qilingan.",
  'ERR-AUTH-005': "«Raqamli nazorat» orqali tekshiruvdan o'tilmadi.",
  'ERR-AUTH-006': "So'rovni tasdiqlab bo'lmadi (CSRF). Sahifani yangilab, qaytadan urining.",
  'ERR-AUTH-007': 'Parolni almashtirish talab qilinadi.',
  'ERR-AUTH-008': "Ro'yxatdan o'tish yakunlanmagan.",
  'ERR-AUTH-009': "Tasdiqlash kodi so'rovlari soni oshib ketdi. Birozdan so'ng qayta urining.",
  'ERR-AUTH-010': "Tasdiqlash kodi noto'g'ri yoki muddati o'tgan.",
  'ERR-AUTH-011': 'Vakolat allaqachon amal qilmoqda.',
  'ERR-AUTH-012': "Ro'yxatdan o'tish allaqachon yakunlangan.",
  'ERR-ACL-001': "Bu amal uchun sizda huquq yo'q.",
  'ERR-ACL-002': 'So\'rov sizning hududiy javobgarlik zonangizdan tashqarida.',
  'ERR-ACL-003': "«Faqat o'qish» roli uchun o'zgartirish mumkin emas.",
  'ERR-APP-001': (details) => {
    const missing = strList(details, 'missing');
    return missing.length
      ? `Majburiy maydon to'ldirilmagan: ${missing.join(', ')}.`
      : "Majburiy maydon to'ldirilmagan.";
  },
  'ERR-APP-002': (details) => {
    const number = str(details, 'existing_number');
    return number
      ? `${number}-sonli faol ariza kesishuvchi davr uchun allaqachon mavjud.`
      : 'Kesishuvchi davr uchun faol ariza allaqachon mavjud.';
  },
  'ERR-APP-003': "Hujjatlar to'plami to'liq emas.",
  'ERR-APP-004': "Ariza holatini bunday o'zgartirib bo'lmaydi. Sahifani yangilang.",
  'ERR-GIS-001': "Uchastka geometriyasi noto'g'ri.",
  'ERR-GIS-002': "Geometriya o'rmon fondi chegaralaridan tashqarida.",
  'ERR-GIS-003': 'Cheklov yoki muhofaza zonasi bilan kesishish mavjud.',
  'ERR-GIS-004': (details) => {
    const format = str(details, 'format');
    return format
      ? `Fayl formati qo'llab-quvvatlanmaydi: ${format}.`
      : "Fayl formati qo'llab-quvvatlanmaydi.";
  },
  'ERR-GIS-005': "GIS obyekti holati bo'yicha ziddiyat. Sahifani yangilang.",
  'ERR-GIS-006': "Bo'laklar boshlang'ich konturni aniq ajratib bermaydi.",
  'ERR-NORM-001': "Konturda tasdiqlangan me'yor yo'q.",
  'ERR-NORM-002': (details) => {
    const limit = limitDetails(details);
    if (str(limit, 'reason') === 'exclusive_occupied') {
      const until = str(limit, 'free_from') ?? str(limit, 'until') ?? str(limit, 'occupied_until') ?? str(limit, 'available_from');
      return until
        ? `Kontur ${formatIsoDate(until)} sanasigacha band. Yangi ruxsatnoma faqat shu sanadan keyin mumkin.`
        : "Kontur so'ralgan davr uchun band.";
    }
    const unit = str(limit, 'unit');
    const suffix = (value: string) => (unit ? `${value} ${unit}` : value);
    const requested = decimal(limit, 'requested') ?? decimal(limit, 'used_sb');
    const capacity = decimal(limit, 'capacity') ?? decimal(limit, 'max_sb');
    const remaining = decimal(limit, 'remaining') ?? decimal(limit, 'remaining_sb');
    if (requested === undefined || capacity === undefined) return "Limit qoldig'i oshib ketdi.";
    return remaining !== undefined
      ? `So'ralgan ${suffix(requested)} — ruxsat etilgan ${suffix(capacity)} chegaradan oshib ketmoqda (erkin qoldiq — ${suffix(remaining)}).`
      : `So'ralgan ${suffix(requested)} — ruxsat etilgan ${suffix(capacity)} chegaradan oshib ketmoqda.`;
  },
  'ERR-NORM-003': 'Davr mavsum yoki rotatsiyaga mos kelmaydi.',
  'ERR-NORM-004': 'Hisoblash parametri belgilanmagan.',
  'ERR-NORM-005': "Me'yor holati yoki davri bo'yicha ziddiyat. Sahifani yangilang.",
  'ERR-NORM-006': "Yong'in xavfsizligi taqiqi amalda.",
  'ERR-PAY-001': "To'lov tasdiqlanmagan.",
  'ERR-PAY-002': "To'lov muddati o'tgan.",
  'ERR-PAY-003': "To'lov summasi hisob-fakturaga mos kelmaydi.",
  'ERR-PAY-004': "Hisob-faktura joriy holatda to'lanishi mumkin emas.",
  'ERR-PAY-005': 'Nomuvofiqlik allaqachon yopilgan.',
  'ERR-PAY-006': "Qaytarish so'rovini joriy holatda o'zgartirib bo'lmaydi.",
  'ERR-PERM-001': "Ruxsatnoma holatini bunday o'zgartirib bo'lmaydi. Sahifani yangilang.",
  'ERR-PERM-002': 'Hujjat allaqachon imzolangan va qayta chiqarilishi mumkin emas.',
  'ERR-PERM-003': "O'rmon bileti holati bo'yicha ziddiyat. Sahifani yangilang.",
  'ERR-REP-001': "Hisobot holati bo'yicha ziddiyat. Sahifani yangilang.",
  'ERR-REP-002': "Hisobot mantiqiy tekshiruvlardan o'tmadi.",
  'ERR-REP-003': "Hisobot shakli ishlatib bo'lmaydi.",
  'ERR-SIGN-001': 'Imzolashda xatolik yuz berdi.',
  'ERR-SIGN-002': "Bu imzo allaqachon qo'yilgan.",
  'ERR-SIGN-003': 'Imzolar yetarli emas.',
  'ERR-SIGN-004': "Sertifikat yoki imzo holati bo'yicha ziddiyat. Qaytadan urining.",
  'ERR-INSP-001': "Tekshiruv holatini bunday o'zgartirib bo'lmaydi. Sahifani yangilang.",
  'ERR-INSP-002': "Nazorat varag'i to'liq to'ldirilmagan.",
  'ERR-INT-001': "Tashqi xizmat javob bermadi. Birozdan so'ng qayta urining.",
  'ERR-INT-002': "Tashqi xizmat xatolik qaytardi. Birozdan so'ng qayta urining.",
  'ERR-SYS-001': "Serverning ichki xatosi. Keyinroq urinib ko'ring.",
  'ERR-SYS-002': "Xizmat vaqtincha ishlamayapti. Keyinroq urinib ko'ring.",
  'ERR-SYS-003': 'Manba topilmadi.',
  'ERR-SYS-004': "Bu amal qo'llab-quvvatlanmaydi.",
  'ERR-SYS-005': "Takroriy so'rov rad etildi (idempotentlik kaliti to'qnashuvi).",
  'ERR-SYS-006': (details) => {
    const retry = num(details, 'retry_after_seconds');
    return retry
      ? `So'rovlar soni juda ko'p. ${retry} soniyadan so'ng qayta urining.`
      : "So'rovlar soni juda ko'p. Birozdan so'ng qayta urining.";
  },
  'ERR-VAL-001': (details) => {
    switch (str(details, 'reason')) {
      case 'period_reversed':
        return 'Davr tugash sanasi boshlanish sanasidan oldin bo\'lishi mumkin emas.';
      case 'period_too_long':
        return "So'ralgan davr ruxsat etilgan maksimal muddatdan (5 yil) oshib ketdi.";
      case 'quantity_required':
        return "Tanlangan faoliyat turi uchun miqdor (hajm) ko'rsatilmagan.";
      default:
        return "Kiritilgan ma'lumotlarni tekshirishda xatolik.";
    }
  },
  'ERR-PUB-001': "Murojaat holatini bunday o'zgartirib bo'lmaydi. Sahifani yangilang.",
  'ERR-HELP-001': "Qo'llab-quvvatlash murojaatining joriy holati uchun bu amal mavjud emas.",
  'ERR-SRCH-001': 'Bunday nomli qidiruv profili allaqachon mavjud.',
  'ERR-ARCH-001': 'Obyekt joriy holatda arxivlanishi mumkin emas.',
  'ERR-ARCH-002': 'Arxiv nusxasining yaxlitligi buzilgan.',
  'ERR-SYS-000': 'Kutilmagan xatolik yuz berdi. Qaytadan urining.',
};

const MESSAGES: Record<UiLanguage, Record<string, ErrorCopy>> = {
  ru,
  uz_latn,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: ru,
};

/** Every code this map knows about, for tests that enumerate coverage
 *  against the backend's own `ERRORS` dict. Both language maps carry the
 *  exact same key set — enforced by the coverage test, not by the type
 *  system (the values differ in shape too much for a shared literal key
 *  union to buy much). */
export const KNOWN_ERROR_CODES: readonly string[] = Object.keys(ru);

const GENERIC_MESSAGE: Record<UiLanguage, string> = {
  ru: 'Произошла непредвиденная ошибка. Повторите попытку.',
  uz_latn: 'Kutilmagan xatolik yuz berdi. Qaytadan urining.',
  uz_cyrl: 'Кутилмаган хатолик юз берди. Қайтадан урининг.',
  kaa: 'Kútilmegen qátelik júz berdi. Qaytadan urınıp kóriń.',
  en: 'An unexpected error occurred. Please try again.',
};

/** Duck-typed rather than `instanceof ApiError`: a handful of call sites
 *  (e.g. `gis/imports/ImportsTab.tsx`'s per-row `error_report` entries)
 *  carry the same `{code, message}` shape without ever being wrapped in the
 *  `ApiError` class — they deserve the same localized copy. */
export interface CodedError {
  code: string;
  message: string;
  details?: unknown;
}

export function isCodedError(value: unknown): value is CodedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/**
 * The one place an `ApiError` (or any `{code, message}`-shaped error) turns
 * into text a user reads. A code this map knows renders localized copy; a
 * code it doesn't know renders the server's own message — never a blank,
 * and never the raw `${code}: ${message}` this replaces (F4). Anything that
 * isn't even a coded error (a dropped connection, `undefined`) gets a short
 * generic sentence, since there is no server string to fall back to.
 */
export function apiErrorMessage(error: unknown, lang: UiLanguage): string {
  if (!isCodedError(error)) return GENERIC_MESSAGE[lang];
  const copy = MESSAGES[lang][error.code];
  if (copy === undefined) return error.message;
  return typeof copy === 'function' ? copy(error.details as ErrorDetails) : copy;
}
