/**
 * Screen copy for H8, local to this folder — the shared `src/i18n/`
 * dictionaries are owned by the shell and edited by every parallel track at
 * once, so a screen built in its own worktree carries its own strings.
 *
 * `ru` is typed against `uz_latn`'s key set, so a key added to one and
 * forgotten in the other is a compile error rather than a Latin string
 * appearing mid-sentence in the Russian UI.
 */
import type { BackendLanguage } from './api';

export const uz_latn = {
  pageTitle: 'Eʼlonlar',
  pageSubtitle: 'Tizim foydalanuvchilariga koʻrsatiladigan eʼlonlar',
  create: 'Yangi eʼlon',

  filterStatus: 'Holati',
  filterAll: 'Barchasi',

  colTitle: 'Sarlavha',
  colAudience: 'Kimga koʻrinadi',
  colStatus: 'Holati',
  colPeriod: 'Koʻrsatish muddati',
  colCreated: 'Yaratilgan',
  colActions: 'Amallar',

  statusDraft: 'Qoralama',
  statusPublished: 'Chop etilgan',
  statusArchived: 'Arxivlangan',

  audienceEveryone: 'Barcha foydalanuvchilar',
  audienceRoles: 'Rollar',
  audienceRegions: 'Hududlar',
  audienceHint: 'Hech narsa tanlanmasa — eʼlon barcha foydalanuvchilarga koʻrinadi.',

  loading: 'Yuklanmoqda...',
  empty: 'Eʼlon topilmadi.',
  loadFailed: 'Eʼlonlar roʻyxati yuklanmadi.',
  untitled: '(sarlavhasiz)',

  actionEdit: 'Tahrirlash',
  actionPublish: 'Chop etish',
  actionArchive: 'Arxivlash',
  cancel: 'Bekor qilish',
  save: 'Saqlash',

  formCreateTitle: 'Yangi eʼlon',
  formEditTitle: 'Eʼlonni tahrirlash',
  formTitleField: 'Sarlavha',
  formBodyField: 'Matn',
  formPublishFrom: 'Boshlanish sanasi',
  formPublishTo: 'Tugash sanasi',
  formLanguagesHint: 'Toʻldirilgan tillar saqlanadi. Oʻzbekcha (lotin) majburiy.',
  formRequired: 'Oʻzbekcha (lotin) sarlavha va matn toʻldirilishi shart.',
  formLoading: 'Eʼlon yuklanmoqda...',
  formLoadFailed: 'Eʼlonni yuklab boʻlmadi.',

  publishConfirmTitle: 'Eʼlonni chop etish',
  publishConfirmLead: 'Eʼlon quyidagilarga koʻrinadi:',
  publishConfirmTail: 'Chop etilgandan soʻng eʼlonni qaytarib boʻlmaydi — uni faqat arxivlash mumkin.',
  publishConfirmAction: 'Ha, chop etish',

  archiveConfirmTitle: 'Eʼlonni arxivlash',
  archiveConfirmText: 'Eʼlon roʻyxatdan olib tashlanadi va foydalanuvchilarga koʻrinmaydi.',
  archiveConfirmAction: 'Ha, arxivlash',

  langUzLatn: 'Oʻzbekcha (lotin)',
  langUzCyrl: 'Ўзбекча (кирилл)',
  langRu: 'Ruscha',
  langKaa: 'Qoraqalpoqcha',
  langEn: 'Inglizcha',
};

export type AnnouncementLabels = Record<keyof typeof uz_latn, string>;

export const ru: AnnouncementLabels = {
  pageTitle: 'Объявления',
  pageSubtitle: 'Объявления, показываемые пользователям системы',
  create: 'Новое объявление',

  filterStatus: 'Статус',
  filterAll: 'Все',

  colTitle: 'Заголовок',
  colAudience: 'Кому видно',
  colStatus: 'Статус',
  colPeriod: 'Срок показа',
  colCreated: 'Создано',
  colActions: 'Действия',

  statusDraft: 'Черновик',
  statusPublished: 'Опубликовано',
  statusArchived: 'В архиве',

  audienceEveryone: 'Все пользователи',
  audienceRoles: 'Роли',
  audienceRegions: 'Регионы',
  audienceHint: 'Если ничего не выбрано — объявление увидят все пользователи.',

  loading: 'Загрузка...',
  empty: 'Объявления не найдены.',
  loadFailed: 'Не удалось загрузить список объявлений.',
  untitled: '(без заголовка)',

  actionEdit: 'Редактировать',
  actionPublish: 'Опубликовать',
  actionArchive: 'В архив',
  cancel: 'Отмена',
  save: 'Сохранить',

  formCreateTitle: 'Новое объявление',
  formEditTitle: 'Редактирование объявления',
  formTitleField: 'Заголовок',
  formBodyField: 'Текст',
  formPublishFrom: 'Дата начала',
  formPublishTo: 'Дата окончания',
  formLanguagesHint: 'Сохраняются только заполненные языки. Узбекский (латиница) обязателен.',
  formRequired: 'Заголовок и текст на узбекском (латиница) обязательны.',
  formLoading: 'Загрузка объявления...',
  formLoadFailed: 'Не удалось загрузить объявление.',

  publishConfirmTitle: 'Публикация объявления',
  publishConfirmLead: 'Объявление увидят:',
  publishConfirmTail: 'После публикации объявление нельзя вернуть в черновик — только отправить в архив.',
  publishConfirmAction: 'Да, опубликовать',

  archiveConfirmTitle: 'Отправить в архив',
  archiveConfirmText: 'Объявление будет убрано из списка и перестанет показываться пользователям.',
  archiveConfirmAction: 'Да, в архив',

  langUzLatn: 'Узбекский (латиница)',
  langUzCyrl: 'Узбекский (кириллица)',
  langRu: 'Русский',
  langKaa: 'Каракалпакский',
  langEn: 'Английский',
};

import type { UiLanguage } from '../../../i18n/context';

export const LABELS: Record<UiLanguage, AnnouncementLabels> = {
  uz_latn,
  ru,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: uz_latn,
};

/** Which label names each per-language input. Keyed by the schema's own
 *  language codes, so adding a code to `ANNOUNCEMENT_LANGUAGES` without a
 *  caption is a compile error. */
export const LANGUAGE_LABEL_KEY: Record<BackendLanguage, keyof AnnouncementLabels> = {
  uz_latn: 'langUzLatn',
  uz_cyrl: 'langUzCyrl',
  ru: 'langRu',
  kaa: 'langKaa',
  en: 'langEn',
};
