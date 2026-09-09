/**
 * H9's own copy. Latin-script Uzbek is primary — `uz_latn` is written first
 * and `ru` is typed against it, so a key present in one map and missing from
 * the other is a compile error rather than a blank on the screen.
 *
 * Local to this screen on purpose: the shared `src/i18n/` dictionaries are
 * owned elsewhere and edited by every parallel track at once.
 */
export const uz_latn = {
  title: 'Bildirishnoma shablonlari',
  subtitle: 'Hodisa, kanal va til boʻyicha xabar matnlari. Har bir tahrir yangi versiya yaratadi.',

  create: 'Yangi shablon',
  filterEventCode: 'Hodisa kodi',
  filterChannel: 'Kanal',
  filterStatus: 'Holati',
  all: 'Barchasi',
  apply: 'Qoʻllash',
  reset: 'Tiklash',

  colEvent: 'Hodisa kodi',
  colChannel: 'Kanal',
  colVersion: 'Versiya',
  colStatus: 'Holati',
  colUpdated: 'Yangilangan',

  emptyTitle: 'Shablon topilmadi',
  emptyDescription: 'Filtrga mos keladigan bildirishnoma shabloni yoʻq',
  loadError: 'Shablonlar roʻyxati yuklanmadi.',

  channelInapp: 'Ilovada',
  channelSms: 'SMS',
  channelEmail: 'Email',

  statusActive: 'Amaldagi',
  statusSuperseded: 'Eskirgan',
  statusArchived: 'Arxivlangan',

  edit: 'Tahrirlash',
  archive: 'Arxivlash',

  editorTitleCreate: 'Yangi shablon',
  editorTitleEdit: 'Shablonning yangi versiyasi',
  editorSubtitleCreate: 'Yaratilgandan soʻng u 1-versiya boʻladi.',
  currentVersion: 'Joriy versiya',
  versionNotice:
    'Shablon almashtirilmaydi. Saqlash yangi versiya yaratadi, joriy versiya oʻzgarishsiz saqlanib qoladi.',

  fieldEventCode: 'Hodisa kodi',
  fieldChannel: 'Kanal',
  eventCodeHint: 'Masalan: application.submitted',
  identityLocked: 'Hodisa kodi va kanal versiyalar boʻylab oʻzgarmaydi.',

  subject: 'Mavzu',
  body: 'Matn',
  placeholderHint: 'Oʻrin egalari jingalak qavsda: {number}, {applicant_name}, {date}.',
  noSubjectForSms: 'SMS uchun mavzu yuborilmaydi.',

  langUzLatn: 'Oʻzbekcha (lotin)',
  langUzCyrl: 'Ўзбекча (кирилл)',
  langRu: 'Ruscha',
  langKaa: 'Qoraqalpoqcha',
  langEn: 'Inglizcha',

  save: 'Saqlash va yangi versiya yaratish',
  saveCreate: 'Yaratish',
  close: 'Yopish',
  cancel: 'Bekor qilish',

  warningTitle: 'Serverning ogohlantirishi',
  savedTitle: 'Saqlandi',
  savedText: 'Yangi versiya yaratildi.',
  saveError: 'Saqlanmadi.',
  bodyRequired: 'Kamida bitta tilda matn kiritilishi shart.',
  eventCodeRequired: 'Hodisa kodi kiritilishi shart.',

  archiveTitle: 'Shablonni arxivlash',
  archiveQuestion: 'Ushbu shablon arxivlansinmi? Undan keyin u yangi bildirishnomalarda ishlatilmaydi.',
  archiveConfirm: 'Arxivlash',
  archiveError: 'Arxivlanmadi.',
} as const;

export type TemplateLabels = Record<keyof typeof uz_latn, string>;

export const ru: TemplateLabels = {
  title: 'Шаблоны уведомлений',
  subtitle: 'Тексты сообщений по событию, каналу и языку. Каждое изменение создаёт новую версию.',

  create: 'Новый шаблон',
  filterEventCode: 'Код события',
  filterChannel: 'Канал',
  filterStatus: 'Статус',
  all: 'Все',
  apply: 'Применить',
  reset: 'Сбросить',

  colEvent: 'Код события',
  colChannel: 'Канал',
  colVersion: 'Версия',
  colStatus: 'Статус',
  colUpdated: 'Обновлён',

  emptyTitle: 'Шаблоны не найдены',
  emptyDescription: 'Нет шаблонов уведомлений, подходящих под фильтр',
  loadError: 'Не удалось загрузить список шаблонов.',

  channelInapp: 'В приложении',
  channelSms: 'SMS',
  channelEmail: 'Email',

  statusActive: 'Действующий',
  statusSuperseded: 'Устаревший',
  statusArchived: 'В архиве',

  edit: 'Редактировать',
  archive: 'В архив',

  editorTitleCreate: 'Новый шаблон',
  editorTitleEdit: 'Новая версия шаблона',
  editorSubtitleCreate: 'После создания это будет версия 1.',
  currentVersion: 'Текущая версия',
  versionNotice:
    'Шаблон не заменяется. Сохранение создаёт новую версию, текущая остаётся без изменений.',

  fieldEventCode: 'Код события',
  fieldChannel: 'Канал',
  eventCodeHint: 'Например: application.submitted',
  identityLocked: 'Код события и канал не меняются от версии к версии.',

  subject: 'Тема',
  body: 'Текст',
  placeholderHint: 'Подстановки в фигурных скобках: {number}, {applicant_name}, {date}.',
  noSubjectForSms: 'Для SMS тема не отправляется.',

  langUzLatn: 'Узбекский (латиница)',
  langUzCyrl: 'Узбекский (кириллица)',
  langRu: 'Русский',
  langKaa: 'Каракалпакский',
  langEn: 'Английский',

  save: 'Сохранить как новую версию',
  saveCreate: 'Создать',
  close: 'Закрыть',
  cancel: 'Отмена',

  warningTitle: 'Предупреждение сервера',
  savedTitle: 'Сохранено',
  savedText: 'Создана новая версия.',
  saveError: 'Не удалось сохранить.',
  bodyRequired: 'Текст нужно заполнить хотя бы на одном языке.',
  eventCodeRequired: 'Укажите код события.',

  archiveTitle: 'Архивирование шаблона',
  archiveQuestion: 'Отправить этот шаблон в архив? После этого он не будет использоваться в новых уведомлениях.',
  archiveConfirm: 'В архив',
  archiveError: 'Не удалось архивировать.',
};

export const uz_cyrl: TemplateLabels = {
  title: 'Билдиришнома шаблонлари',
  subtitle: 'Ҳодиса, канал ва тил бўйича хабар матнлари. Ҳар бир таҳрир янги версия яратади.',

  create: 'Янги шаблон',
  filterEventCode: 'Ҳодиса коди',
  filterChannel: 'Канал',
  filterStatus: 'Ҳолати',
  all: 'Барчаси',
  apply: 'Қўллаш',
  reset: 'Тиклаш',

  colEvent: 'Ҳодиса коди',
  colChannel: 'Канал',
  colVersion: 'Версия',
  colStatus: 'Ҳолати',
  colUpdated: 'Янгиланган',

  emptyTitle: 'Шаблон топилмади',
  emptyDescription: 'Фильтрга мос келадиган билдиришнома шаблони йўқ',
  loadError: 'Шаблонлар рўйхати юкланмади.',

  channelInapp: 'Иловада',
  channelSms: 'SMS',
  channelEmail: 'Email',

  statusActive: 'Амал қилувчи',
  statusSuperseded: 'Эскирган',
  statusArchived: 'Архивланган',

  edit: 'Таҳрирлаш',
  archive: 'Архивлаш',

  editorTitleCreate: 'Янги шаблон',
  editorTitleEdit: 'Шаблоннинг янги версияси',
  editorSubtitleCreate: 'Яратилгандан сўнг у 1-версия бўлади.',
  currentVersion: 'Жорий версия',
  versionNotice:
    'Шаблон алмаштирилмайди. Сақлаш янги версия яратади, жорий версия ўзгаришсиз сақланиб қолади.',

  fieldEventCode: 'Ҳодиса коди',
  fieldChannel: 'Канал',
  eventCodeHint: 'Масалан: application.submitted',
  identityLocked: 'Ҳодиса коди ва канал версиялар бўйлаб ўзгармайди.',

  subject: 'Мавзу',
  body: 'Матн',
  placeholderHint: 'Ўрин эгалари жингалак қавсда: {number}, {applicant_name}, {date}.',
  noSubjectForSms: 'SMS учун мавзу юборилмайди.',

  langUzLatn: 'Ўзбекча (лотин)',
  langUzCyrl: 'Ўзбекча (кирилл)',
  langRu: 'Русча',
  langKaa: 'Қорақалпоқча',
  langEn: 'Инглизча',

  save: 'Сақлаш ва янги версия яратиш',
  saveCreate: 'Яратиш',
  close: 'Ёпиш',
  cancel: 'Бекор қилиш',

  warningTitle: 'Сервернинг огоҳлантириши',
  savedTitle: 'Сақланди',
  savedText: 'Янги версия яратилди.',
  saveError: 'Сақланмади.',
  bodyRequired: 'Камида битта тилда матн киритилиши шарт.',
  eventCodeRequired: 'Ҳодиса коди киритилиши шарт.',

  archiveTitle: 'Шаблонни архивлаш',
  archiveQuestion: 'Ушбу шаблон архивлансинми? Ундан кейин у янги билдиришномаларда ишлатилмайди.',
  archiveConfirm: 'Архивлаш',
  archiveError: 'Архивланмади.',
};

export const en: TemplateLabels = {
  title: 'Notification templates',
  subtitle: 'Message texts by event, channel, and language. Each edit creates a new version.',

  create: 'New template',
  filterEventCode: 'Event code',
  filterChannel: 'Channel',
  filterStatus: 'Status',
  all: 'All',
  apply: 'Apply',
  reset: 'Reset',

  colEvent: 'Event code',
  colChannel: 'Channel',
  colVersion: 'Version',
  colStatus: 'Status',
  colUpdated: 'Updated',

  emptyTitle: 'No templates found',
  emptyDescription: 'No notification templates match the filter',
  loadError: 'Failed to load templates list.',

  channelInapp: 'In-app',
  channelSms: 'SMS',
  channelEmail: 'Email',

  statusActive: 'Active',
  statusSuperseded: 'Superseded',
  statusArchived: 'Archived',

  edit: 'Edit',
  archive: 'Archive',

  editorTitleCreate: 'New template',
  editorTitleEdit: 'New template version',
  editorSubtitleCreate: 'After creation, this will be version 1.',
  currentVersion: 'Current version',
  versionNotice:
    'Template is not replaced. Saving creates a new version, current version remains unchanged.',

  fieldEventCode: 'Event code',
  fieldChannel: 'Channel',
  eventCodeHint: 'e.g.: application.submitted',
  identityLocked: 'Event code and channel do not change between versions.',

  subject: 'Subject',
  body: 'Body',
  placeholderHint: 'Placeholders in curly braces: {number}, {applicant_name}, {date}.',
  noSubjectForSms: 'SMS does not use a subject.',

  langUzLatn: 'Uzbek (Latin)',
  langUzCyrl: 'Uzbek (Cyrillic)',
  langRu: 'Russian',
  langKaa: 'Karakalpak',
  langEn: 'English',

  save: 'Save and create new version',
  saveCreate: 'Create',
  close: 'Close',
  cancel: 'Cancel',

  warningTitle: 'Server warning',
  savedTitle: 'Saved',
  savedText: 'New version created.',
  saveError: 'Failed to save.',
  bodyRequired: 'Body must be filled in at least one language.',
  eventCodeRequired: 'Event code is required.',

  archiveTitle: 'Archive template',
  archiveQuestion: 'Archive this template? It will no longer be used for new notifications.',
  archiveConfirm: 'Archive',
  archiveError: 'Failed to archive.',
};

export const kaa: TemplateLabels = {
  title: 'Bildiriw shablonları',
  subtitle: 'Waqıya, kanal hám til boyınsha xabar tekstleri. Hár bir ózgertiw jańa versiya jaratadı.',

  create: 'Jańa shablon',
  filterEventCode: 'Waqıya kodı',
  filterChannel: 'Kanal',
  filterStatus: 'Jaǵdayı',
  all: 'Barlıǵı',
  apply: 'Qollaw',
  reset: 'Qayta tiklew',

  colEvent: 'Waqıya kodı',
  colChannel: 'Kanal',
  colVersion: 'Versiya',
  colStatus: 'Jaǵdayı',
  colUpdated: 'Jańalanǵan',

  emptyTitle: 'Shablon tabılmadı',
  emptyDescription: 'Filtrge sáykes keletuǵın bildiriw shablonı joq',
  loadError: 'Shablonlar dizimi júklenbedi.',

  channelInapp: 'Qosımshada',
  channelSms: 'SMS',
  channelEmail: 'Email',

  statusActive: 'Ámeldegi',
  statusSuperseded: 'Eskirgen',
  statusArchived: 'Arxivlengen',

  edit: 'Ózgertiw',
  archive: 'Arxivlew',

  editorTitleCreate: 'Jańa shablon',
  editorTitleEdit: 'Shablondıń jańa versiyası',
  editorSubtitleCreate: 'Jaratılǵannan soń ol 1-versiya boladı.',
  currentVersion: 'Házirgi versiya',
  versionNotice:
    'Shablon almastırılmaydı. Saqlaw jańa versiya jaratadı, házirgi versiya ózgerissiz saqlanıp qaladı.',

  fieldEventCode: 'Waqıya kodı',
  fieldChannel: 'Kanal',
  eventCodeHint: 'Mısalı: application.submitted',
  identityLocked: 'Waqıya kodı hám kanal versiyalar boyınsha ózgermeydi.',

  subject: 'Tema',
  body: 'Tekst',
  placeholderHint: 'Orın iyelewshiler qawsırmalarda: {number}, {applicant_name}, {date}.',
  noSubjectForSms: 'SMS ushın tema jiberilmeydi.',

  langUzLatn: 'Ózbekshe (latın)',
  langUzCyrl: 'Ózbekshe (kirill)',
  langRu: 'Orıssha',
  langKaa: 'Qaraqalpaqsha',
  langEn: 'Inglishe',

  save: 'Saqlaw hám jańa versiya jaratıw',
  saveCreate: 'Jaratıw',
  close: 'Jabıw',
  cancel: 'Biykar etiw',

  warningTitle: 'Serverdiń eskertpesi',
  savedTitle: 'Saqlandı',
  savedText: 'Jańa versiya jaratıldı.',
  saveError: 'Saqlanbadı.',
  bodyRequired: 'Keminde bir tilde tekst kiritiliwi shárt.',
  eventCodeRequired: 'Waqıya kodı kiritiliwi shárt.',

  archiveTitle: 'Shablondı arxivlew',
  archiveQuestion: 'Bul shablon arxivlensin be? Onnan keyin ol jańa bildiriwlerde qollanılmaydı.',
  archiveConfirm: 'Arxivlew',
  archiveError: 'Arxivlenbedi.',
};

import type { UiLanguage } from '../../../i18n/context';

export const labels: Record<UiLanguage, TemplateLabels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
};
