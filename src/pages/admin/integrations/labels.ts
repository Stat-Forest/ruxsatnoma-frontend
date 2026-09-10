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

export const uz_cyrl: Record<keyof typeof uz_latn, string> = {
  title: 'Интеграциялар: навбат ва хатолар',
  subtitle:
    'Чиқувчи хабарлар навбати (outbox) ва қабул қилинмаган кирувчи хабарлар (DLQ). Бу ердаги амаллар ҳақиқий етказиб беришга таъсир қилади.',

  tabOutbox: 'Чиқувчи навбат',
  tabDeadLetters: 'Кирувчи хатолар (DLQ)',

  filterStatus: 'Ҳолати',
  filterStatusAll: 'Барчаси',
  filterDestination: 'Йўналиш (destination)',
  filterDestinationPlaceholder: 'sms_otp',
  filterApply: 'Қўллаш',
  filterReset: 'Тиклаш',

  colDestination: 'Йўналиш',
  colStatus: 'Ҳолати',
  colAttempts: 'Уринишлар',
  colNextAttempt: 'Кейинги уриниш',
  colCreated: 'Яратилган',
  colDelivered: 'Етказилган',
  colCorrelation: 'Correlation ID',
  colLastError: 'Охирги хато',
  colSource: 'Манба',
  colError: 'Хато',
  colReceived: 'Қабул қилинган',
  colProcessedBy: 'Ким кўриб чиқди',
  colProcessedAt: 'Кўриб чиқилган',
  colActions: 'Амаллар',

  outboxStatusPending: 'Навбатда',
  outboxStatusDelivering: 'Юборилмоқда',
  outboxStatusDelivered: 'Етказилди',
  outboxStatusDead: 'Етказилмади',

  letterStatusNew: 'Янги',
  letterStatusReprocessed: 'Қайта ишланган',
  letterStatusDiscarded: 'Рад этилган',

  actionDetails: 'Батафсил',
  actionRequeue: 'Навбатга қайтариш',
  actionDiscard: 'Рад этиш',
  actionCancel: 'Бекор қилиш',
  actionClose: 'Ёпиш',

  requeueOnlyDead: 'Фақат “Етказилмади” ҳолатидаги хабарни қайтариш мумкин',
  discardOnlyNew: 'Фақат “Янги” хат рад этилади',
  requeueNoPermission: 'Навбатга қайтариш учун ҳуқуқ етарли эмас (admin.integrations.manage)',
  discardNoPermission: 'Рад этиш учун ҳуқуқ етарли эмас (admin.integrations.manage)',

  detailsOutboxTitle: 'Чиқувчи хабар',
  detailsLetterTitle: 'Кирувчи хато хати',
  detailsRecord: 'Ёзув (API қайтарган барча майдонлар)',
  detailsError: 'Хато матни',
  detailsNoError: 'Хато қайд этилмаган.',
  detailsPayloadWithheld:
    'Хабар танаси (payload) API орқали берилмайди: у бир марталик SMS-кодларни сақлаши мумкин, шунинг учун backend уни рўйхатдан ҳам, карточкадан ҳам олиб ташлайди. Танани кўриш учун базага мурожаат қилинг.',

  requeueTitle: 'Хабарни навбатга қайтариш',
  requeueLead: 'Қуйидаги хабар қайта юборишга қўйилади, уринишлар ҳисоби нолга тушади:',
  requeueConfirm: 'Ҳа, навбатга қайтарилсин',

  discardTitle: 'Кирувчи хатни рад этиш',
  discardLead: 'Қуйидаги хат “рад этилган” деб белгиланади:',
  discardIrreversible:
    'Бу амални ортга қайтариб бўлмайди: хат қайта ишланмайди ва навбатга қайтмайди. Сизнинг исмингиз ва вақт ёзувда қолади.',
  discardConfirm: 'Ҳа, рад этилсин',

  stateLoading: 'Юкланмоқда...',
  stateEmptyOutbox: 'Фильтр бўйича хабар топилмади.',
  stateEmptyLetters: 'Фильтр бўйича хат топилмади.',
  stateListFailed: 'Рўйхат юкланмади.',
  stateActionFailed: 'Амал бажарилмади.',

  fieldId: 'ID',
  totalRecords: 'ёзув',
};

export const en: Record<keyof typeof uz_latn, string> = {
  title: 'Integrations: Queue and errors',
  subtitle:
    'Outbox message queue and inbound dead letters (DLQ). Actions here affect live deliveries.',

  tabOutbox: 'Outbox queue',
  tabDeadLetters: 'Dead letters (DLQ)',

  filterStatus: 'Status',
  filterStatusAll: 'All',
  filterDestination: 'Destination',
  filterDestinationPlaceholder: 'sms_otp',
  filterApply: 'Apply',
  filterReset: 'Reset',

  colDestination: 'Destination',
  colStatus: 'Status',
  colAttempts: 'Attempts',
  colNextAttempt: 'Next attempt',
  colCreated: 'Created',
  colDelivered: 'Delivered',
  colCorrelation: 'Correlation ID',
  colLastError: 'Last error',
  colSource: 'Source',
  colError: 'Error',
  colReceived: 'Received',
  colProcessedBy: 'Processed by',
  colProcessedAt: 'Processed at',
  colActions: 'Actions',

  outboxStatusPending: 'Pending',
  outboxStatusDelivering: 'Delivering',
  outboxStatusDelivered: 'Delivered',
  outboxStatusDead: 'Dead',

  letterStatusNew: 'New',
  letterStatusReprocessed: 'Reprocessed',
  letterStatusDiscarded: 'Discarded',

  actionDetails: 'Details',
  actionRequeue: 'Requeue',
  actionDiscard: 'Discard',
  actionCancel: 'Cancel',
  actionClose: 'Close',

  requeueOnlyDead: 'Only messages with "Dead" status can be requeued',
  discardOnlyNew: 'Only "New" letters can be discarded',
  requeueNoPermission: 'Insufficient permissions to requeue (admin.integrations.manage)',
  discardNoPermission: 'Insufficient permissions to discard (admin.integrations.manage)',

  detailsOutboxTitle: 'Outbound message',
  detailsLetterTitle: 'Inbound dead letter',
  detailsRecord: 'Record (all fields returned by API)',
  detailsError: 'Error text',
  detailsNoError: 'No error recorded.',
  detailsPayloadWithheld:
    'Message payload is not exposed via API: it may contain one-time SMS codes, so the backend strips it from both list and card. Inspect the database directly to view payload.',

  requeueTitle: 'Requeue message',
  requeueLead: 'The following message will be scheduled for retry with attempt counter reset to zero:',
  requeueConfirm: 'Yes, requeue',

  discardTitle: 'Discard inbound letter',
  discardLead: 'The following letter will be marked as "discarded":',
  discardIrreversible:
    'This action cannot be undone: the letter will not be reprocessed or returned to the queue. Your name and timestamp will remain in the record.',
  discardConfirm: 'Yes, discard',

  stateLoading: 'Loading...',
  stateEmptyOutbox: 'No messages match the filter.',
  stateEmptyLetters: 'No letters match the filter.',
  stateListFailed: 'Failed to load list.',
  stateActionFailed: 'Action failed.',

  fieldId: 'ID',
  totalRecords: 'records',
};

export const kaa: Record<keyof typeof uz_latn, string> = {
  title: 'Integraciyalar: gezek hám qátelikler',
  subtitle:
    'Shıǵıwshı xabarlar gezegi (outbox) hám qabıl etilmegen kirisiwshi xabarlar (DLQ). Bul jerdegi ámeller haqıyqıy jetkerip beriwge tásir etedi.',

  tabOutbox: 'Shıǵıwshı gezek',
  tabDeadLetters: 'Kirisiwshi qátelikler (DLQ)',

  filterStatus: 'Jaǵdayı',
  filterStatusAll: 'Barlıǵı',
  filterDestination: 'Baǵdar (destination)',
  filterDestinationPlaceholder: 'sms_otp',
  filterApply: 'Qollaw',
  filterReset: 'Qayta tiklew',

  colDestination: 'Baǵdar',
  colStatus: 'Jaǵdayı',
  colAttempts: 'Umtılıslar',
  colNextAttempt: 'Keyingi umtılıs',
  colCreated: 'Jaratılǵan',
  colDelivered: 'Jetkerilgen',
  colCorrelation: 'Correlation ID',
  colLastError: 'Aqırǵı qátelik',
  colSource: 'Derek',
  colError: 'Qátelik',
  colReceived: 'Qabıl etilgen',
  colProcessedBy: 'Kim kórip shıqtı',
  colProcessedAt: 'Kórip shıǵılǵan',
  colActions: 'Amallar',

  outboxStatusPending: 'Gezekte',
  outboxStatusDelivering: 'Jiberilmekte',
  outboxStatusDelivered: 'Jetkerildi',
  outboxStatusDead: 'Jetkerilmedi',

  letterStatusNew: 'Jańa',
  letterStatusReprocessed: 'Qayta islengen',
  letterStatusDiscarded: 'Biykar etilgen',

  actionDetails: 'Tolıq',
  actionRequeue: 'Gezekke qaytarıw',
  actionDiscard: 'Biykar etiw',
  actionCancel: 'Biykar etiw',
  actionClose: 'Jabıw',

  requeueOnlyDead: 'Tek “Jetkerilmedi” jaǵdayındaǵı xabardı qaytarıw múmkin',
  discardOnlyNew: 'Tek “Jańa” xat biykar etiledi',
  requeueNoPermission: 'Gezekke qaytarıw ushın huqıq jetkiliksiz (admin.integrations.manage)',
  discardNoPermission: 'Biykar etiw ushın huqıq jetkiliksiz (admin.integrations.manage)',

  detailsOutboxTitle: 'Shıǵıwshı xabar',
  detailsLetterTitle: 'Kirisiwshi qátelik xatı',
  detailsRecord: 'Jazba (API qaytarǵan barlıq maydanlar)',
  detailsError: 'Qátelik teksti',
  detailsNoError: 'Qátelik dizimge alınbaǵan.',
  detailsPayloadWithheld:
    'Xabar denesi (payload) API arqalı berilmeydi: ol bir mártelik SMS-kodlardı saqlawı múmkin, sonlıqtan backend onı dizimnen de, kartochkadan da alıp taslaydı. Deneni kóriw ushın bazaǵa múrájat etiń.',

  requeueTitle: 'Xabardı gezekke qaytarıw',
  requeueLead: 'Tómendegi xabar qayta jiberiwge qoyıladı, umtılıslar esabı nolge túsedi:',
  requeueConfirm: 'Awa, gezekke qaytarılsın',

  discardTitle: 'Kirisiwshi xattı biykar etiw',
  discardLead: 'Tómendegi xat “biykar etilgen” dep belgilenedi:',
  discardIrreversible:
    'Bul ámeldi artqa qaytarıp bolmaydı: xat qayta islenbeydi hám gezekke qaytpaydı. Sizdiń atıńız hám waqıt jazbada qaladı.',
  discardConfirm: 'Awa, biykar etilsin',

  stateLoading: 'Júklenbekte...',
  stateEmptyOutbox: 'Filtr boyınsha xabar tabılmadı.',
  stateEmptyLetters: 'Filtr boyınsha xat tabılmadı.',
  stateListFailed: 'Dizim júklenbedi.',
  stateActionFailed: 'Ámel orınlanbadı.',

  fieldId: 'ID',
  totalRecords: 'jazba',
};

export type IntegrationsLabels = typeof uz_latn;

export const LABELS: Record<UiLanguage, IntegrationsLabels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
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
