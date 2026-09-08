/**
 * Copy for H10 (the outbox and the inbound dead-letter queue), local to this
 * screen rather than added to `src/i18n/uz_latn.ts` / `ru.ts`: the shared
 * dictionaries are owned by another worker this sprint, and every string
 * below is operator vocabulary that no other screen says.
 *
 * `ru` is typed as `Record<keyof typeof uz_latn, string>`, so a key added to
 * one map and forgotten in the other is a compile error rather than a
 * Russian screen with an Uzbek word in the middle of it — the same guarantee
 * `i18n/context.ts` gives the shared dictionaries.
 */
import type { UiLanguage } from '../../../i18n/context';

export const uz_latn = {
  title: 'Integratsiyalar: navbat va xatolar',
  subtitle:
    'Chiquvchi xabarlar navbati (outbox) va qabul qilinmagan kiruvchi xabarlar (DLQ). Bu yerdagi amallar haqiqiy yetkazib berishga taʼsir qiladi.',

  tabOutbox: 'Chiquvchi navbat',
  tabDeadLetters: 'Kiruvchi xatolar (DLQ)',

  filterStatus: 'Holati',
  filterStatusAll: 'Barchasi',
  filterDestination: 'Yoʻnalish (destination)',
  filterDestinationPlaceholder: 'sms_otp',
  filterApply: 'Qoʻllash',
  filterReset: 'Tiklash',

  colDestination: 'Yoʻnalish',
  colStatus: 'Holati',
  colAttempts: 'Urinishlar',
  colNextAttempt: 'Keyingi urinish',
  colCreated: 'Yaratilgan',
  colDelivered: 'Yetkazilgan',
  colCorrelation: 'Correlation ID',
  colLastError: 'Oxirgi xato',
  colSource: 'Manba',
  colError: 'Xato',
  colReceived: 'Qabul qilingan',
  colProcessedBy: 'Kim koʻrib chiqdi',
  colProcessedAt: 'Koʻrib chiqilgan',
  colActions: 'Amallar',

  outboxStatusPending: 'Navbatda',
  outboxStatusDelivering: 'Yuborilmoqda',
  outboxStatusDelivered: 'Yetkazildi',
  outboxStatusDead: 'Yetkazilmadi',

  letterStatusNew: 'Yangi',
  letterStatusReprocessed: 'Qayta ishlangan',
  letterStatusDiscarded: 'Rad etilgan',

  actionDetails: 'Batafsil',
  actionRequeue: 'Navbatga qaytarish',
  actionDiscard: 'Rad etish',
  actionCancel: 'Bekor qilish',
  actionClose: 'Yopish',

  requeueOnlyDead: 'Faqat “Yetkazilmadi” holatidagi xabarni qaytarish mumkin',
  discardOnlyNew: 'Faqat “Yangi” xat rad etiladi',
  requeueNoPermission: 'Navbatga qaytarish uchun huquq yetarli emas (admin.integrations.manage)',
  discardNoPermission: 'Rad etish uchun huquq yetarli emas (admin.integrations.manage)',

  detailsOutboxTitle: 'Chiquvchi xabar',
  detailsLetterTitle: 'Kiruvchi xato xati',
  detailsRecord: 'Yozuv (API qaytargan barcha maydonlar)',
  detailsError: 'Xato matni',
  detailsNoError: 'Xato qayd etilmagan.',
  detailsPayloadWithheld:
    'Xabar tanasi (payload) API orqali berilmaydi: u bir martalik SMS-kodlarni saqlashi mumkin, shuning uchun backend uni roʻyxatdan ham, kartochkadan ham olib tashlaydi. Tanani koʻrish uchun bazaga murojaat qiling.',

  requeueTitle: 'Xabarni navbatga qaytarish',
  requeueLead: 'Quyidagi xabar qayta yuborishga qoʻyiladi, urinishlar hisobi nolga tushadi:',
  requeueConfirm: 'Ha, navbatga qaytarilsin',

  discardTitle: 'Kiruvchi xatni rad etish',
  discardLead: 'Quyidagi xat “rad etilgan” deb belgilanadi:',
  discardIrreversible:
    'Bu amalni ortga qaytarib boʻlmaydi: xat qayta ishlanmaydi va navbatga qaytmaydi. Sizning ismingiz va vaqt yozuvda qoladi.',
  discardConfirm: 'Ha, rad etilsin',

  stateLoading: 'Yuklanmoqda...',
  stateEmptyOutbox: 'Filtr boʻyicha xabar topilmadi.',
  stateEmptyLetters: 'Filtr boʻyicha xat topilmadi.',
  stateListFailed: 'Roʻyxat yuklanmadi.',
  stateActionFailed: 'Amal bajarilmadi.',

  fieldId: 'ID',
  totalRecords: 'yozuv',
};

export const ru: Record<keyof typeof uz_latn, string> = {
  title: 'Интеграции: очередь и ошибки',
  subtitle:
    'Очередь исходящих сообщений (outbox) и непринятые входящие сообщения (DLQ). Действия на этом экране влияют на реальную доставку.',

  tabOutbox: 'Очередь отправки',
  tabDeadLetters: 'Входящие ошибки (DLQ)',

  filterStatus: 'Статус',
  filterStatusAll: 'Все',
  filterDestination: 'Направление (destination)',
  filterDestinationPlaceholder: 'sms_otp',
  filterApply: 'Применить',
  filterReset: 'Сбросить',

  colDestination: 'Направление',
  colStatus: 'Статус',
  colAttempts: 'Попытки',
  colNextAttempt: 'Следующая попытка',
  colCreated: 'Создано',
  colDelivered: 'Доставлено',
  colCorrelation: 'Correlation ID',
  colLastError: 'Последняя ошибка',
  colSource: 'Источник',
  colError: 'Ошибка',
  colReceived: 'Получено',
  colProcessedBy: 'Кто обработал',
  colProcessedAt: 'Обработано',
  colActions: 'Действия',

  outboxStatusPending: 'В очереди',
  outboxStatusDelivering: 'Отправляется',
  outboxStatusDelivered: 'Доставлено',
  outboxStatusDead: 'Не доставлено',

  letterStatusNew: 'Новое',
  letterStatusReprocessed: 'Переобработано',
  letterStatusDiscarded: 'Отброшено',

  actionDetails: 'Подробно',
  actionRequeue: 'Вернуть в очередь',
  actionDiscard: 'Отбросить',
  actionCancel: 'Отмена',
  actionClose: 'Закрыть',

  requeueOnlyDead: 'Вернуть можно только сообщение со статусом «Не доставлено»',
  discardOnlyNew: 'Отбросить можно только «новое» письмо',
  requeueNoPermission: 'Недостаточно прав для возврата в очередь (admin.integrations.manage)',
  discardNoPermission: 'Недостаточно прав для отбрасывания (admin.integrations.manage)',

  detailsOutboxTitle: 'Исходящее сообщение',
  detailsLetterTitle: 'Входящее письмо с ошибкой',
  detailsRecord: 'Запись (все поля, которые вернул API)',
  detailsError: 'Текст ошибки',
  detailsNoError: 'Ошибка не зафиксирована.',
  detailsPayloadWithheld:
    'Тело сообщения (payload) через API не отдаётся: оно может содержать одноразовые SMS-коды, поэтому backend убирает его и из списка, и из карточки. Чтобы увидеть тело, обратитесь к базе.',

  requeueTitle: 'Вернуть сообщение в очередь',
  requeueLead: 'Сообщение ниже будет поставлено на повторную отправку, счётчик попыток обнулится:',
  requeueConfirm: 'Да, вернуть в очередь',

  discardTitle: 'Отбросить входящее письмо',
  discardLead: 'Письмо ниже будет помечено как «отброшено»:',
  discardIrreversible:
    'Действие необратимо: письмо не будет обработано и не вернётся в очередь. Ваше имя и время останутся в записи.',
  discardConfirm: 'Да, отбросить',

  stateLoading: 'Загрузка...',
  stateEmptyOutbox: 'По фильтру сообщений не найдено.',
  stateEmptyLetters: 'По фильтру писем не найдено.',
  stateListFailed: 'Список не загружен.',
  stateActionFailed: 'Действие не выполнено.',

  fieldId: 'ID',
  totalRecords: 'записей',
};

export type IntegrationsLabels = typeof uz_latn;

export const LABELS: Record<UiLanguage, IntegrationsLabels> = {
  uz_latn,
  ru,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: uz_latn,
};

/**
 * `outbox_messages.status` — the four values the table's own CHECK constraint
 * allows (`integrations/models.py::OutboxMessage.__table_args__`). Typed as a
 * plain `string` in the OpenAPI schema, so an unexpected value must still
 * render as itself rather than as a blank cell; `statusLabel` below falls
 * back to the raw code.
 */
export const OUTBOX_STATUSES = ['pending', 'delivering', 'delivered', 'dead'] as const;

/** `inbound_dead_letters.status` — likewise, from that table's CHECK. */
export const LETTER_STATUSES = ['new', 'reprocessed', 'discarded'] as const;

export function outboxStatusLabel(status: string, L: IntegrationsLabels): string {
  const map: Record<string, string> = {
    pending: L.outboxStatusPending,
    delivering: L.outboxStatusDelivering,
    delivered: L.outboxStatusDelivered,
    dead: L.outboxStatusDead,
  };
  return map[status] ?? status;
}

export function letterStatusLabel(status: string, L: IntegrationsLabels): string {
  const map: Record<string, string> = {
    new: L.letterStatusNew,
    reprocessed: L.letterStatusReprocessed,
    discarded: L.letterStatusDiscarded,
  };
  return map[status] ?? status;
}
