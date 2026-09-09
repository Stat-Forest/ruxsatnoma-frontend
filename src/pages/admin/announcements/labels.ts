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

export const uz_cyrl: AnnouncementLabels = {
  pageTitle: 'Эълонлар',
  pageSubtitle: 'Тизим фойдаланувчиларига кўрсатиладиган эълонлар',
  create: 'Янги эълон',

  filterStatus: 'Ҳолати',
  filterAll: 'Барчаси',

  colTitle: 'Сарлавҳа',
  colAudience: 'Кимга кўринади',
  colStatus: 'Ҳолати',
  colPeriod: 'Кўрсатиш муддати',
  colCreated: 'Яратилган',
  colActions: 'Амаллар',

  statusDraft: 'Қоралама',
  statusPublished: 'Чоп этилган',
  statusArchived: 'Архивланган',

  audienceEveryone: 'Барча фойдаланувчилар',
  audienceRoles: 'Роллар',
  audienceRegions: 'Ҳудудлар',
  audienceHint: 'Ҳеч нарса танланмаса — эълон барча фойдаланувчиларга кўринади.',

  loading: 'Юкланмоқда...',
  empty: 'Эълон топилмади.',
  loadFailed: 'Эълонлар рўйхати юкланмади.',
  untitled: '(сарлавҳасиз)',

  actionEdit: 'Таҳрирлаш',
  actionPublish: 'Чоп этиш',
  actionArchive: 'Архивлаш',
  cancel: 'Бекор қилиш',
  save: 'Сақлаш',

  formCreateTitle: 'Янги эълон',
  formEditTitle: 'Эълонни таҳрирлаш',
  formTitleField: 'Сарлавҳа',
  formBodyField: 'Матн',
  formPublishFrom: 'Бошланиш санаси',
  formPublishTo: 'Тугаш санаси',
  formLanguagesHint: 'Тўлдирилган тиллар сақланади. Ўзбекча (лотин) мажбурий.',
  formRequired: 'Ўзбекча (лотин) сарлавҳа ва матн тўлдирилиши шарт.',
  formLoading: 'Эълон юкланмоқда...',
  formLoadFailed: 'Эълонни юклаб бўлмади.',

  publishConfirmTitle: 'Эълонни чоп этиш',
  publishConfirmLead: 'Эълон қуйидагиларга кўринади:',
  publishConfirmTail: 'Чоп этилгандан сўнг эълонни қайтариб бўлмайди — уни фақат архивлаш мумкин.',
  publishConfirmAction: 'Ҳа, чоп этиш',

  archiveConfirmTitle: 'Эълонни архивлаш',
  archiveConfirmText: 'Эълон рўйхатдан олиб ташланади ва фойдаланувчиларга кўринмайди.',
  archiveConfirmAction: 'Ҳа, архивлаш',

  langUzLatn: 'Ўзбекча (лотин)',
  langUzCyrl: 'Ўзбекча (кирилл)',
  langRu: 'Русча',
  langKaa: 'Қорақалпоқча',
  langEn: 'Инглизча',
};

export const en: AnnouncementLabels = {
  pageTitle: 'Announcements',
  pageSubtitle: 'Announcements displayed to system users',
  create: 'New announcement',

  filterStatus: 'Status',
  filterAll: 'All',

  colTitle: 'Title',
  colAudience: 'Audience',
  colStatus: 'Status',
  colPeriod: 'Display period',
  colCreated: 'Created at',
  colActions: 'Actions',

  statusDraft: 'Draft',
  statusPublished: 'Published',
  statusArchived: 'Archived',

  audienceEveryone: 'All users',
  audienceRoles: 'Roles',
  audienceRegions: 'Regions',
  audienceHint: 'If nothing is selected — announcement is visible to all users.',

  loading: 'Loading...',
  empty: 'No announcements found.',
  loadFailed: 'Failed to load announcements list.',
  untitled: '(untitled)',

  actionEdit: 'Edit',
  actionPublish: 'Publish',
  actionArchive: 'Archive',
  cancel: 'Cancel',
  save: 'Save',

  formCreateTitle: 'New announcement',
  formEditTitle: 'Edit announcement',
  formTitleField: 'Title',
  formBodyField: 'Body',
  formPublishFrom: 'Start date',
  formPublishTo: 'End date',
  formLanguagesHint: 'Only filled languages are saved. Uzbek (Latin) is required.',
  formRequired: 'Uzbek (Latin) title and body are required.',
  formLoading: 'Loading announcement...',
  formLoadFailed: 'Failed to load announcement.',

  publishConfirmTitle: 'Publish announcement',
  publishConfirmLead: 'Announcement will be visible to:',
  publishConfirmTail: 'Once published, it cannot be reverted to draft — only archived.',
  publishConfirmAction: 'Yes, publish',

  archiveConfirmTitle: 'Archive announcement',
  archiveConfirmText: 'The announcement will be removed from list and hidden from users.',
  archiveConfirmAction: 'Yes, archive',

  langUzLatn: 'Uzbek (Latin)',
  langUzCyrl: 'Uzbek (Cyrillic)',
  langRu: 'Russian',
  langKaa: 'Karakalpak',
  langEn: 'English',
};

export const kaa: AnnouncementLabels = {
  pageTitle: 'Xabarlandırıwlar',
  pageSubtitle: 'Sistema paydalanıwshılarına kórsetiletuǵın xabarlandırıwlar',
  create: 'Jańa xabarlandırıw',

  filterStatus: 'Jaǵdayı',
  filterAll: 'Barlıǵı',

  colTitle: 'Sarlawha',
  colAudience: 'Kimge kórinedi',
  colStatus: 'Jaǵdayı',
  colPeriod: 'Kórsetiw múddeti',
  colCreated: 'Jaratılǵan',
  colActions: 'Ámeller',

  statusDraft: 'Dáslepki nusqa',
  statusPublished: 'Baspada shıǵarılǵan',
  statusArchived: 'Arxivlengen',

  audienceEveryone: 'Barlıq paydalanıwshılar',
  audienceRoles: 'Rollar',
  audienceRegions: 'Aymaqlar',
  audienceHint: 'Hesh nárse saylanbasa — xabarlandırıw barlıq paydalanıwshılarǵa kórinedi.',

  loading: 'Júklenbekte...',
  empty: 'Xabarlandırıw tabılmadı.',
  loadFailed: 'Xabarlandırıwlar dizimi júklenbedi.',
  untitled: '(sarlawhasız)',

  actionEdit: 'Ózgertiw',
  actionPublish: 'Baspada shıǵarıw',
  actionArchive: 'Arxivlew',
  cancel: 'Biykar etiw',
  save: 'Saqlaw',

  formCreateTitle: 'Jańa xabarlandırıw',
  formEditTitle: 'Xabarlandırıwdı ózgertiw',
  formTitleField: 'Sarlawha',
  formBodyField: 'Tekst',
  formPublishFrom: 'Baslanıw sánesi',
  formPublishTo: 'Tamamlanıw sánesi',
  formLanguagesHint: 'Toltırılǵan tiller saqlanadı. Ózbekshe (latın) májbúriy.',
  formRequired: 'Ózbekshe (latın) sarlawha hám tekst toltırılıwı shárt.',
  formLoading: 'Xabarlandırıw júklenbekte...',
  formLoadFailed: 'Xabarlandırıwdı júklep bolmadı.',

  publishConfirmTitle: 'Xabarlandırıwdı baspaǵa shıǵarıw',
  publishConfirmLead: 'Xabarlandırıw tómendegilerge kórinedi:',
  publishConfirmTail: 'Baspada shıqqannan soń xabarlandırıwdı qaytarıp bolmaydı — onı tek arxivlew múmkin.',
  publishConfirmAction: 'Awa, baspada shıǵarıw',

  archiveConfirmTitle: 'Xabarlandırıwdı arxivlew',
  archiveConfirmText: 'Xabarlandırıw dizimnen alıp taslanadı hám paydalanıwshılarǵa kórinbeydi.',
  archiveConfirmAction: 'Awa, arxivlew',

  langUzLatn: 'Ózbekshe (latın)',
  langUzCyrl: 'Ózbekshe (kirill)',
  langRu: 'Orıssha',
  langKaa: 'Qaraqalpaqsha',
  langEn: 'Inglishe',
};

import type { UiLanguage } from '../../../i18n/context';

export const LABELS: Record<UiLanguage, AnnouncementLabels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
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
