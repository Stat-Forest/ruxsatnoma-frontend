/**
 * Screen copy for the legal-documents register, local to this folder — the
 * same convention `announcements/labels.ts` follows, and for the same reason:
 * the shared `src/i18n/` dictionaries are owned by the shell and edited by
 * every parallel track at once.
 *
 * `ru` is typed against `uz_latn`'s key set, so a key added to one and
 * forgotten in the other is a compile error rather than a Latin string
 * appearing mid-sentence in the Russian UI.
 */
import type { BackendLanguage } from './api';

export const uz_latn = {
  pageTitle: 'Normativ-huquqiy hujjatlar',
  pageSubtitle: 'Ommaviy saytning "Hujjatlar" sahifasida koʻrsatiladigan reyestr',
  create: 'Yangi hujjat',

  filterStatus: 'Holati',
  filterAll: 'Barchasi',

  colNumber: 'Hujjat raqami',
  colTitle: 'Nomi',
  colAdopted: 'Qabul qilingan',
  colSource: 'Manba',
  colStatus: 'Holati',
  colActions: 'Amallar',

  statusDraft: 'Qoralama',
  statusPublished: 'Chop etilgan',
  statusArchived: 'Arxivlangan',

  sourceFile: 'PDF fayl',
  sourceLink: 'lex.uz havolasi',
  sourceNone: 'Yoʻq',

  edit: 'Tahrirlash',
  publish: 'Chop etish',
  archive: 'Arxivlash',

  publishTitle: 'Hujjatni chop etish',
  publishBody:
    'Hujjat ommaviy saytda darhol koʻrinadi. Chop etilgan hujjatni faqat arxivlash mumkin.',
  archiveTitle: 'Hujjatni arxivlash',
  archiveBody: 'Hujjat saytdan olib tashlanadi. Arxivlangan hujjatni tahrirlab boʻlmaydi.',
  confirm: 'Tasdiqlash',
  cancel: 'Bekor qilish',

  formCreateTitle: 'Yangi hujjat',
  formEditTitle: 'Hujjatni tahrirlash',
  fieldNumber: 'Hujjat raqami',
  fieldNumberHint: 'Masalan: OʻRQ-475, VMQ-342',
  fieldAdopted: 'Qabul qilingan sana',
  fieldSortOrder: 'Tartib raqami',
  fieldSortOrderHint: 'Kichik raqam yuqorida turadi. Bir xil boʻlsa — yangi sana yuqorida.',
  fieldTitle: 'Nomi',
  fieldSummary: 'Qisqacha izoh',
  fieldSourceUrl: 'lex.uz havolasi',
  fieldFile: 'PDF fayl',
  fileAttached: 'Biriktirilgan fayl',
  fileReplace: 'Faylni almashtirish',
  fileChoose: 'Fayl tanlash',
  fileRemove: 'Faylni olib tashlash',
  save: 'Saqlash',

  errTitleRequired: 'Nomi (uz_latn) toʻldirilishi shart.',
  errNumberRequired: 'Hujjat raqami toʻldirilishi shart.',
  errAdoptedRequired: 'Qabul qilingan sana koʻrsatilishi shart.',
  errNothingToOpen: 'Chop etish uchun PDF fayl yoki lex.uz havolasi kerak.',
  empty: 'Hujjatlar hali qoʻshilmagan.',
  loadFailed: 'Roʻyxatni yuklab boʻlmadi.',
};

export type LegalDocumentLabels = typeof uz_latn;

export const ru: LegalDocumentLabels = {
  pageTitle: 'Нормативно-правовые документы',
  pageSubtitle: 'Реестр, который показывается на странице «Документы» публичного сайта',
  create: 'Новый документ',

  filterStatus: 'Статус',
  filterAll: 'Все',

  colNumber: 'Номер акта',
  colTitle: 'Название',
  colAdopted: 'Дата принятия',
  colSource: 'Источник',
  colStatus: 'Статус',
  colActions: 'Действия',

  statusDraft: 'Черновик',
  statusPublished: 'Опубликован',
  statusArchived: 'В архиве',

  sourceFile: 'PDF-файл',
  sourceLink: 'Ссылка на lex.uz',
  sourceNone: 'Нет',

  edit: 'Редактировать',
  publish: 'Опубликовать',
  archive: 'В архив',

  publishTitle: 'Опубликовать документ',
  publishBody:
    'Документ сразу появится на публичном сайте. Опубликованный документ можно только архивировать.',
  archiveTitle: 'Архивировать документ',
  archiveBody: 'Документ исчезнет с сайта. Архивный документ нельзя редактировать.',
  confirm: 'Подтвердить',
  cancel: 'Отмена',

  formCreateTitle: 'Новый документ',
  formEditTitle: 'Редактирование документа',
  fieldNumber: 'Номер акта',
  fieldNumberHint: 'Например: ЗРУ-475, ВМҚ-342',
  fieldAdopted: 'Дата принятия',
  fieldSortOrder: 'Порядок',
  fieldSortOrderHint: 'Меньшее число — выше в списке. При равенстве выше более новая дата.',
  fieldTitle: 'Название',
  fieldSummary: 'Краткое описание',
  fieldSourceUrl: 'Ссылка на lex.uz',
  fieldFile: 'PDF-файл',
  fileAttached: 'Прикреплённый файл',
  fileReplace: 'Заменить файл',
  fileChoose: 'Выбрать файл',
  fileRemove: 'Убрать файл',
  save: 'Сохранить',

  errTitleRequired: 'Название (uz_latn) обязательно.',
  errNumberRequired: 'Номер акта обязателен.',
  errAdoptedRequired: 'Дата принятия обязательна.',
  errNothingToOpen: 'Для публикации нужен PDF-файл или ссылка на lex.uz.',
  empty: 'Документы ещё не добавлены.',
  loadFailed: 'Не удалось загрузить список.',
};

export const LABELS: Record<string, LegalDocumentLabels> = {
  uz_latn,
  uz_cyrl: uz_latn,
  ru,
  kaa: uz_latn,
  en: ru,
};

export const LANGUAGE_LABEL: Record<BackendLanguage, string> = {
  uz_latn: "Oʻzbekcha (lotin)",
  uz_cyrl: 'Ўзбекча (кирилл)',
  ru: 'Русский',
  kaa: 'Qaraqalpaqsha',
  en: 'English',
};
