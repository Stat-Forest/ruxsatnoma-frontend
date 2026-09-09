/**
 * Copy for the receivers directory, local to this screen — the same
 * convention `admin/legalDocuments/labels.ts` and `admin/organizations/labels.ts`
 * follow: the shared `src/i18n/` dictionaries are owned by the shell and
 * edited by every parallel track at once.
 *
 * `ru` is typed against `uz_latn`'s key set, so a key added to one and
 * forgotten in the other is a compile error rather than a Latin string
 * appearing mid-sentence in the Russian UI. Latin-script Uzbek is primary,
 * matching decision #90: `LocalizedName` requires `uz_latn`, not `uz_cyrl`.
 */
import { useLanguage } from '../../../i18n/useT';

export const uz_latn = {
  pageTitle: "Toʻlovlarni boʻlish — qabul qiluvchilar",
  pageSubtitle:
    'Har bir toʻlovdan ulush oladigan qabul qiluvchilar reyestri. Kontur tegishli oʻrmon xoʻjaligi hech qayerda sozlanmaydi — u qolgan qismni oladi.',
  create: "Qabul qiluvchi qoʻshish",

  colName: 'Nomi',
  colRule: 'Qoidasi',
  colPaymeId: 'Payme hisobi',
  colStatus: 'Holati',
  colSortOrder: 'Tartib',
  colActions: 'Amallar',

  statusActive: 'Faol',
  statusInactive: 'Faol emas',

  edit: 'Tahrirlash',
  deactivate: "Oʻchirish",
  reactivate: 'Qayta faollashtirish',

  leshozRow: "Kontur tegishli oʻrmon xoʻjaligi",
  leshozRowHint: "Sozlanmaydi — qolgan barcha qabul qiluvchilardan keyingi ulush avtomatik hisoblanadi",
  leshozFixedNotePrefix: "Bundan tashqari, qatʼiy summali qabul qiluvchilar toʻlov hajmidan qatʼi nazar avval jami",
  leshozFixedNoteSuffix:
    "soʻm olib qoladi — shuning uchun yuqoridagi foiz oʻrmon xoʻjaligining haqiqiy ulushini toʻliq bildirmaydi.",
  leshozExamplePrefix: "Masalan, toʻlov",
  leshozExampleMiddle: "soʻm boʻlsa, oʻrmon xoʻjaligi",
  leshozExampleSuffix: "soʻm oladi.",

  paymeNotSet: "Koʻrsatilmagan",

  empty: "Qabul qiluvchilar hali qoʻshilmagan.",
  loadFailed: "Roʻyxatni yuklab boʻlmadi.",

  formCreateTitle: "Yangi qabul qiluvchi",
  formEditTitle: "Qabul qiluvchini tahrirlash",
  fieldName: 'Nomi (lotin)',
  fieldNameRu: 'Nomi (rus, ixtiyoriy)',
  fieldKind: 'Qoidasi turi',
  kindPercent: 'Foiz',
  kindFixed: "Qat'iy summa",
  fieldPercent: 'Foiz miqdori',
  fieldFixedAmount: "Qat'iy summa (soʻm)",
  fieldPaymeAccountId: 'Payme hisob raqami',
  fieldPaymeAccountIdHint: "Boʻlmasa, Payme orqali boʻlish imkonsiz boʻladi va toʻlov rad etiladi",
  fieldSortOrder: 'Tartib raqami',
  fieldNote: 'Izoh',
  fieldActive: 'Faol',
  save: 'Saqlash',
  cancel: 'Bekor qilish',

  errNameRequired: 'Nomi (lotin) toʻldirilishi shart.',
  errPercentRequired: 'Foiz miqdorini kiriting.',
  errFixedRequired: "Qat'iy summani kiriting.",
  errPercentExceeds100:
    'Faol qabul qiluvchilarning foizlari jami 100%dan oshmasligi kerak.',
  errSaveFailed: 'Saqlanmadi.',

  missingPaymeWarning:
    "Quyidagi faol qabul qiluvchilarda Payme hisob raqami koʻrsatilmagan — bunday holatda Payme toʻlovni boʻla olmaydi va toʻlov butunlay rad etiladi (qaror #160):",
};

export type RecipientLabels = typeof uz_latn;

export const ru: RecipientLabels = {
  pageTitle: 'Разделение платежей — получатели',
  pageSubtitle:
    'Реестр получателей, забирающих долю с каждого платежа. Лесхоз, которому принадлежит контур, нигде не настраивается — он получает то, что не забрали остальные.',
  create: 'Добавить получателя',

  colName: 'Название',
  colRule: 'Правило',
  colPaymeId: 'Счёт Payme',
  colStatus: 'Статус',
  colSortOrder: 'Порядок',
  colActions: 'Действия',

  statusActive: 'Активен',
  statusInactive: 'Неактивен',

  edit: 'Редактировать',
  deactivate: 'Деактивировать',
  reactivate: 'Активировать снова',

  leshozRow: 'Лесхоз, которому принадлежит контур',
  leshozRowHint:
    'Не настраивается — получает остаток после всех остальных получателей, рассчитывается автоматически',
  leshozFixedNotePrefix: 'Кроме того, получатели с фиксированной суммой забирают в сумме',
  leshozFixedNoteSuffix:
    'сум независимо от размера платежа — поэтому процент выше не отражает полностью настоящую долю лесхоза.',
  leshozExamplePrefix: 'Например, при платеже',
  leshozExampleMiddle: 'сум лесхоз получит',
  leshozExampleSuffix: 'сум.',

  paymeNotSet: 'Не указан',

  empty: 'Получатели пока не добавлены.',
  loadFailed: 'Не удалось загрузить список.',

  formCreateTitle: 'Новый получатель',
  formEditTitle: 'Редактирование получателя',
  fieldName: 'Название (латиница)',
  fieldNameRu: 'Название (рус., необязательно)',
  fieldKind: 'Тип правила',
  kindPercent: 'Процент',
  kindFixed: 'Фиксированная сумма',
  fieldPercent: 'Процент',
  fieldFixedAmount: 'Фиксированная сумма (сум)',
  fieldPaymeAccountId: 'Счёт Payme',
  fieldPaymeAccountIdHint: 'Если не указан, разделение через Payme невозможно и платёж будет отклонён',
  fieldSortOrder: 'Порядок',
  fieldNote: 'Примечание',
  fieldActive: 'Активен',
  save: 'Сохранить',
  cancel: 'Отмена',

  errNameRequired: 'Название (латиница) обязательно.',
  errPercentRequired: 'Укажите процент.',
  errFixedRequired: 'Укажите фиксированную сумму.',
  errPercentExceeds100: 'Сумма процентов активных получателей не должна превышать 100%.',
  errSaveFailed: 'Не удалось сохранить.',

  missingPaymeWarning:
    'У следующих активных получателей не указан счёт Payme — в этом случае Payme не может разделить платёж, и он будет отклонён полностью (решение №160):',
};

export const LABELS: Record<'uz_latn' | 'ru', RecipientLabels> = { uz_latn, ru };

export function useLabels(): RecipientLabels {
  const { lang } = useLanguage();
  return LABELS[lang];
}
