/**
 * Copy for H6 (classifiers and reference data), local to this screen rather
 * than added to `src/i18n/uz_latn.ts` / `ru.ts`: those two dictionaries are
 * shared by every track and owned by another worker this sprint, and every
 * string below is vocabulary no other screen says.
 *
 * `ru` is typed as `Record<keyof typeof uz_latn, string>`, so a key added to
 * one map and forgotten in the other is a compile error rather than a Russian
 * screen with an Uzbek sentence in the middle of it — the same guarantee
 * `i18n/context.ts` gives the shared dictionaries.
 *
 * A classifier item's own `name` is NOT here: it is reference data owned by
 * the Agency, arrives from the server as a `dict` of language codes and is
 * read through `pickName`. Translating it here would be inventing meaning.
 */

export const uz_latn = {
  title: 'Klassifikatorlar va maʼlumotnomalar',
  subtitle:
    'Maʼlumotnoma qiymatlari tahrirlanmaydi — ular versiyalanadi. Har bir element oʻz amal qilish muddatiga ega, shuning uchun oʻtgan yili berilgan ruxsatnoma oʻsha paytdagi kodni koʻrsatishda davom etadi.',

  // --- versioning explainer -----------------------------------------------
  versioningTitle: 'Nega tahrirlash oʻrniga «voris» yaratiladi',
  versioningBody:
    'Kuchga kirgan element qayta yozilmaydi: unga voris yaratiladi. Eski element voris kuchga kirgan kundan bir kun oldin yopiladi va arxivga oʻtadi, yangi element esa oʻsha kundan boshlab amal qiladi. Shu tufayli hujjatlar oʻzi berilgan paytdagi qiymatga bogʻliqligicha qoladi.',

  // --- classifier picker ---------------------------------------------------
  pickerTitle: 'Klassifikator',
  pickerHint:
    'Klassifikatorlar roʻyxatini qaytaradigan API yoʻq — quyida tizimda seed qilingan klassifikatorlar, boshqasini kodi boʻyicha qoʻlda kiriting.',
  pickerKnown: 'Maʼlum klassifikatorlar',
  pickerCustom: 'Boshqa kod',
  pickerCustomPlaceholder: 'masalan: violation_types',
  pickerOpen: 'Ochish',
  pickerCreate: 'Yangi klassifikator',

  // --- point-in-time control ----------------------------------------------
  onDateTitle: 'Qaysi sanaga',
  onDateHint:
    'Roʻyxat — tanlangan sanadagi holat. Sana koʻrsatilmasa, bugun amalda boʻlgan elementlar koʻrinadi. Oʻtgan sana koʻrsatilsa, oʻsha kuni kuchda boʻlgan elementlar — shu jumladan hozir arxivlangan versiyalari ham — qaytariladi.',
  onDateLabel: 'Sana',
  onDateApply: 'Koʻrsatish',
  onDateToday: 'Bugunga qaytish',
  onDateActive: 'Koʻrsatilmoqda:',
  onDateTodayValue: 'bugungi holat',

  // --- item list -----------------------------------------------------------
  listTitle: 'Elementlar',
  itemsSuffix: 'ta element',
  loading: 'Yuklanmoqda...',
  loadFailed: 'Elementlar yuklanmadi.',
  empty: 'Bu sanada elementlar topilmadi.',
  emptyHint: 'Boshqa sanani tanlang yoki birinchi elementni qoʻshing.',

  colValidity: 'Amal qilish muddati',
  validFrom: 'Boshlanishi',
  validTo: 'Tugashi',
  validOpenEnded: 'muddatsiz',

  statusActive: 'Amalda',
  statusScheduled: 'Hali kuchga kirmagan',
  statusClosed: 'Muddati tugagan',
  statusArchived: 'Arxivlangan',
  closedNote: 'Muddati tugagan: bu versiya endi yangi hujjatlarda ishlatilmaydi.',
  archivedNote:
    'Bu versiya yopilgan. U oʻchirilmaydi: oʻsha davrda berilgan hujjatlar shu qiymatga tayanadi.',
  scheduledNote: 'Hali kuchga kirmagan — shuning uchun uni bevosita tahrirlash mumkin.',

  propsTitle: 'Qoʻshimcha maydonlar (props)',
  propsEmpty: 'Boʻsh',

  // --- actions -------------------------------------------------------------
  actionAdd: 'Element qoʻshish',
  actionEdit: 'Tahrirlash',
  actionSupersede: 'Voris yaratish',
  actionArchive: 'Arxivlash',
  editLockedHint: 'Kuchga kirgan element tahrirlanmaydi — unga voris yarating.',

  // --- add / edit / supersede form ----------------------------------------
  fieldCode: 'Kod',
  fieldCodeHint: 'Lotin harflari, raqamlar va pastki chiziq. Kod keyin oʻzgarmaydi.',
  fieldNameUz: 'Nomi (oʻzbekcha)',
  fieldNameRu: 'Nomi (ruscha)',
  fieldValidFrom: 'Amal qilish boshlanishi',
  fieldValidTo: 'Amal qilish tugashi',
  fieldValidToHint: 'Boʻsh qoldirilsa — muddatsiz.',
  fieldSortOrder: 'Tartib raqami',
  fieldProps: 'props (JSON)',
  fieldPropsHint: 'JSON obyekt. Saqlashdan oldin tekshiriladi.',

  addTitle: 'Yangi element',
  addSubtitle: 'Element klassifikatorga qoʻshiladi va koʻrsatilgan sanadan amal qila boshlaydi.',
  editTitle: 'Elementni tahrirlash',
  editSubtitle:
    'Faqat nomi, props, tugash sanasi va tartib raqami oʻzgaradi. Kod va boshlanish sanasi — elementning oʻzligi, ular oʻzgarmaydi.',
  supersedeTitle: 'Voris yaratish',
  supersedeSubtitle:
    'Eski element oʻzgarmaydi. U yangi element kuchga kirgan kundan bir kun oldin yopiladi va arxivlanadi.',
  supersedeOriginal: 'Almashtiriladigan versiya',
  supersedeCodeLocked: 'Kod eski elementniki bilan bir xil boʻlishi shart.',
  supersedeValidFromHint: 'Eski versiya tugashidan keyingi sana boʻlishi shart.',

  archiveTitle: 'Elementni arxivlash',
  archiveBody:
    'Element oʻchirilmaydi — u yopiladi va bugungi roʻyxatdan chiqadi. Uni koʻrish uchun yuqorida oʻtgan sanani tanlang.',
  archiveConfirm: 'Ha, arxivlash',

  createClassifierTitle: 'Yangi klassifikator',
  createClassifierSubtitle: 'Faqat klassifikatorning oʻzi yaratiladi; elementlar keyin qoʻshiladi.',

  cancel: 'Bekor qilish',
  save: 'Saqlash',
  create: 'Yaratish',
  saving: 'Saqlanmoqda...',

  // --- validation ----------------------------------------------------------
  errRequired: 'Toʻldirilishi shart',
  errInvalidJson: 'JSON xato:',
  errNotAnObject: 'props JSON obyekt boʻlishi kerak (masalan {"kind": "return"}).',
  errSaveFailed: 'Saqlab boʻlmadi',
};

export const ru: Record<keyof typeof uz_latn, string> = {
  title: 'Классификаторы и справочники',
  subtitle:
    'Значения справочников не редактируются — они версионируются. У каждого элемента свой срок действия, поэтому разрешение, выданное в прошлом году, по-прежнему показывает тот код, по которому оно было выдано.',

  versioningTitle: 'Почему вместо правки создаётся «преемник»',
  versioningBody:
    'Вступивший в силу элемент не переписывается: у него появляется преемник. Старый элемент закрывается днём раньше начала действия нового и уходит в архив, новый действует с этой даты. Благодаря этому документы остаются привязанными к тому значению, по которому были выданы.',

  pickerTitle: 'Классификатор',
  pickerHint:
    'API, возвращающего список классификаторов, нет — ниже перечислены засеянные в системе, остальные откройте по коду вручную.',
  pickerKnown: 'Известные классификаторы',
  pickerCustom: 'Другой код',
  pickerCustomPlaceholder: 'например: violation_types',
  pickerOpen: 'Открыть',
  pickerCreate: 'Новый классификатор',

  onDateTitle: 'На какую дату',
  onDateHint:
    'Список — это состояние на выбранную дату. Без даты видны элементы, действующие сегодня. Если указать прошедшую дату, вернутся элементы, действовавшие в тот день, — включая версии, которые сейчас в архиве.',
  onDateLabel: 'Дата',
  onDateApply: 'Показать',
  onDateToday: 'Вернуться к сегодня',
  onDateActive: 'Показано:',
  onDateTodayValue: 'состояние на сегодня',

  listTitle: 'Элементы',
  itemsSuffix: 'элементов',
  loading: 'Загрузка...',
  loadFailed: 'Не удалось загрузить элементы.',
  empty: 'На эту дату элементов нет.',
  emptyHint: 'Выберите другую дату или добавьте первый элемент.',

  colValidity: 'Срок действия',
  validFrom: 'Начало',
  validTo: 'Окончание',
  validOpenEnded: 'бессрочно',

  statusActive: 'Действует',
  statusScheduled: 'Ещё не вступил в силу',
  statusClosed: 'Срок истёк',
  statusArchived: 'В архиве',
  closedNote: 'Срок действия истёк: эта версия больше не применяется в новых документах.',
  archivedNote:
    'Эта версия закрыта. Она не удаляется: документы того периода опираются именно на неё.',
  scheduledNote: 'Ещё не вступил в силу — поэтому его можно править напрямую.',

  propsTitle: 'Дополнительные поля (props)',
  propsEmpty: 'Пусто',

  actionAdd: 'Добавить элемент',
  actionEdit: 'Редактировать',
  actionSupersede: 'Создать преемника',
  actionArchive: 'В архив',
  editLockedHint: 'Действующий элемент не редактируется — создайте преемника.',

  fieldCode: 'Код',
  fieldCodeHint: 'Латиница, цифры и подчёркивание. Код потом не меняется.',
  fieldNameUz: 'Наименование (узб.)',
  fieldNameRu: 'Наименование (рус.)',
  fieldValidFrom: 'Действует с',
  fieldValidTo: 'Действует по',
  fieldValidToHint: 'Пусто — бессрочно.',
  fieldSortOrder: 'Порядок сортировки',
  fieldProps: 'props (JSON)',
  fieldPropsHint: 'JSON-объект. Проверяется перед сохранением.',

  addTitle: 'Новый элемент',
  addSubtitle: 'Элемент добавится в классификатор и начнёт действовать с указанной даты.',
  editTitle: 'Редактирование элемента',
  editSubtitle:
    'Меняются только наименование, props, дата окончания и порядок. Код и дата начала — это идентичность элемента, они не меняются.',
  supersedeTitle: 'Создание преемника',
  supersedeSubtitle:
    'Старый элемент не меняется. Он будет закрыт днём раньше начала действия нового и уйдёт в архив.',
  supersedeOriginal: 'Заменяемая версия',
  supersedeCodeLocked: 'Код должен совпадать с кодом старого элемента.',
  supersedeValidFromHint: 'Дата должна быть позже окончания старой версии.',

  archiveTitle: 'Отправить элемент в архив',
  archiveBody:
    'Элемент не удаляется — он закрывается и уходит из сегодняшнего списка. Чтобы увидеть его, выберите прошедшую дату выше.',
  archiveConfirm: 'Да, в архив',

  createClassifierTitle: 'Новый классификатор',
  createClassifierSubtitle: 'Создаётся только сам классификатор; элементы добавляются потом.',

  cancel: 'Отмена',
  save: 'Сохранить',
  create: 'Создать',
  saving: 'Сохранение...',

  errRequired: 'Обязательное поле',
  errInvalidJson: 'Ошибка JSON:',
  errNotAnObject: 'props должен быть JSON-объектом (например {"kind": "return"}).',
  errSaveFailed: 'Не удалось сохранить',
};

export const LABELS = { uz_latn, ru };

export type ClassifiersLabels = typeof uz_latn;

/**
 * The six classifiers the backend seeds (`migrations/versions/0005_admin_seeds.py`
 * and `0022_payments_backoffice.py`). They are a convenience list, NOT a
 * contract: no route enumerates classifiers, so an operator who created a
 * seventh one opens it by typing its code.
 */
export const KNOWN_CLASSIFIER_CODES = [
  'rejection_reasons',
  'doc_types',
  'benefit_categories',
  'violation_types',
  'appeal_subjects',
  'refund_reasons',
] as const;
