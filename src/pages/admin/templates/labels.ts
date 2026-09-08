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

import type { UiLanguage } from '../../../i18n/context';

export const labels: Record<UiLanguage, TemplateLabels> = {
  uz_latn,
  ru,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: uz_latn,
};
