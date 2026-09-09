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
  fieldNameUz: 'Nomi (oʻzbekcha lotin)',
  fieldNameUzCyrl: 'Nomi (oʻzbekcha kirill)',
  fieldNameRu: 'Nomi (ruscha)',
  fieldNameKaa: 'Nomi (qoraqalpoqcha)',
  fieldNameEn: 'Nomi (inglizcha)',
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
  fieldNameUz: 'Наименование (узб. латиница)',
  fieldNameUzCyrl: 'Наименование (узб. кириллица)',
  fieldNameRu: 'Наименование (рус.)',
  fieldNameKaa: 'Наименование (каракалп.)',
  fieldNameEn: 'Наименование (англ.)',
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

export const uz_cyrl: ClassifiersLabels = {
  title: 'Классификаторлар ва маълумотномалар',
  subtitle:
    'Маълумотнома қийматлари таҳрирланмайди — улар версияланади. Ҳар бир элемент ўз амал қилиш муддатига эга, шунинг учун ўтган йили берилган рухсатнома ўша пайтдаги кодни кўрсатишда давом этади.',

  versioningTitle: 'Нега таҳрирлаш ўрнига «ворис» яратилади',
  versioningBody:
    'Кучга кирган элемент қайта ёзилмайди: унга ворис яратилади. Эски элемент ворис кучга кирган кундан бир кун олдин ёпилади ва архивга ўтади, янги элемент эса ўша кундан бошлаб амал қилади. Шу туфайли ҳужжатлар ўзи берилган пайтдаги қийматга боғлиқлигича қолади.',

  pickerTitle: 'Классификатор',
  pickerHint:
    'Классификаторлар рўйхатини қайтарадиган API йўқ — қуйида тизимда seed қилинган классификаторлар, бошқасини коди бўйича қўлда киритинг.',
  pickerKnown: 'Маълум классификаторлар',
  pickerCustom: 'Бошқа код',
  pickerCustomPlaceholder: 'масалан: violation_types',
  pickerOpen: 'Очиш',
  pickerCreate: 'Янги классификатор',

  onDateTitle: 'Қайси санага',
  onDateHint:
    'Рўйхат — танланган санадаги ҳолат. Сана кўрсатилмаса, бугун амалда бўлган элементлар кўринади. Ўтган сана кўрсатилса, ўша куни кучда бўлган элементлар — шу жумладан ҳозир архивланган версиялари ҳам — қайтарилади.',
  onDateLabel: 'Сана',
  onDateApply: 'Кўрсатиш',
  onDateToday: 'Бугунга қайтиш',
  onDateActive: 'Кўрсатилмоқда:',
  onDateTodayValue: 'бугунги ҳолат',

  listTitle: 'Элементлар',
  itemsSuffix: 'та элемент',
  loading: 'Юкланмоқда...',
  loadFailed: 'Элементлар юкланмади.',
  empty: 'Бу санада элементлар топилмади.',
  emptyHint: 'Бошқа санани танланг ёки биринчи элементни қўшинг.',

  colValidity: 'Амал қилиш муддати',
  validFrom: 'Бошланиши',
  validTo: 'Тугаши',
  validOpenEnded: 'муддатсиз',

  statusActive: 'Амалда',
  statusScheduled: 'Ҳали кучга кирмаган',
  statusClosed: 'Муддати тугаган',
  statusArchived: 'Архивланган',
  closedNote: 'Муддати тугаган: бу версия энди янги ҳужжатларда ишлатилмайди.',
  archivedNote:
    'Бу версия ёпилган. У ўчирилмайди: ўша даврда берилган ҳужжатлар шу қийматга таянади.',
  scheduledNote: 'Ҳали кучга кирмаган — шунинг учун уни бевосита таҳрирлаш мумкин.',

  propsTitle: 'Қўшимча майдонлар (props)',
  propsEmpty: 'Бўш',

  actionAdd: 'Элемент қўшиш',
  actionEdit: 'Таҳрирлаш',
  actionSupersede: 'Ворис яратиш',
  actionArchive: 'Архивлаш',
  editLockedHint: 'Кучга кирган элемент таҳрирланмайди — унга ворис яратинг.',

  fieldCode: 'Код',
  fieldCodeHint: 'Лотин ҳарфлари, рақамлар ва пастки чизиқ. Код кейин ўзгармайди.',
  fieldNameUz: 'Номи (ўзбекча лотин)',
  fieldNameUzCyrl: 'Номи (ўзбекча кирилл)',
  fieldNameRu: 'Номи (русча)',
  fieldNameKaa: 'Номи (қорақалпоқча)',
  fieldNameEn: 'Номи (инглизча)',
  fieldValidFrom: 'Амал қилиш бошланиши',
  fieldValidTo: 'Амал қилиш тугаши',
  fieldValidToHint: 'Бўш қолдирилса — муддатсиз.',
  fieldSortOrder: 'Тартиб рақами',
  fieldProps: 'props (JSON)',
  fieldPropsHint: 'JSON объект. Сақлашдан олдин текширилади.',

  addTitle: 'Янги элемент',
  addSubtitle: 'Элемент классификаторга қўшилади ва кўрсатилган санадан амал қила бошлайди.',
  editTitle: 'Элементни таҳрирлаш',
  editSubtitle:
    'Фақат номи, props, тугаш санаси ва тартиб рақами ўзгаради. Код ва бошланиш санаси — элементнинг ўзлиги, улар ўзгармайди.',
  supersedeTitle: 'Ворис яратиш',
  supersedeSubtitle:
    'Эски элемент ўзгармайди. У янги элемент кучга кирган кундан бир кун олдин ёпилади ва архивланади.',
  supersedeOriginal: 'Алмаштириладиган версия',
  supersedeCodeLocked: 'Код эски элементники билан бир хил бўлиши шарт.',
  supersedeValidFromHint: 'Эски версия тугашидан кейинги сана бўлиши шарт.',

  archiveTitle: 'Элементни архивлаш',
  archiveBody:
    'Элемент ўчирилмайди — у ёпилади ва бугунги рўйхатдан чиқади. Уни кўриш учун юқорида ўтган санани танланг.',
  archiveConfirm: 'Ҳа, архивлаш',

  createClassifierTitle: 'Янги классификатор',
  createClassifierSubtitle: 'Фақат классификаторнинг ўзи яратилади; элементлар кейин қўшилади.',

  cancel: 'Бекор қилиш',
  save: 'Сақлаш',
  create: 'Яратиш',
  saving: 'Сақланмоқда...',

  errRequired: 'Тўлдирилиши шарт',
  errInvalidJson: 'JSON хато:',
  errNotAnObject: 'props JSON объект бўлиши керак (масалан {"kind": "return"}).',
  errSaveFailed: 'Сақлаб бўлмади',
};

export const en: ClassifiersLabels = {
  title: 'Classifiers and reference data',
  subtitle:
    'Reference values are not edited — they are versioned. Each item has its own validity period, so a permit issued last year continues to show the code under which it was issued.',

  versioningTitle: 'Why a successor is created instead of editing',
  versioningBody:
    'An item in force is never overwritten: a successor is created. The old item is closed the day before the new one takes effect and archived; the new one is valid from that date. This keeps documents linked to the value under which they were issued.',

  pickerTitle: 'Classifier',
  pickerHint:
    'There is no API returning a list of classifiers — system seed classifiers are listed below; open any other by typing its code.',
  pickerKnown: 'Known classifiers',
  pickerCustom: 'Custom code',
  pickerCustomPlaceholder: 'e.g.: violation_types',
  pickerOpen: 'Open',
  pickerCreate: 'New classifier',

  onDateTitle: 'As of date',
  onDateHint:
    'The list is the state on the selected date. Omitted date shows items currently in force. A past date returns items in force on that day — including archived versions.',
  onDateLabel: 'Date',
  onDateApply: 'Show',
  onDateToday: 'Back to today',
  onDateActive: 'Showing:',
  onDateTodayValue: 'current state',

  listTitle: 'Items',
  itemsSuffix: 'items',
  loading: 'Loading...',
  loadFailed: 'Failed to load items.',
  empty: 'No items found on this date.',
  emptyHint: 'Select another date or add the first item.',

  colValidity: 'Validity period',
  validFrom: 'Start',
  validTo: 'End',
  validOpenEnded: 'open-ended',

  statusActive: 'Active',
  statusScheduled: 'Not yet in force',
  statusClosed: 'Expired',
  statusArchived: 'Archived',
  closedNote: 'Expired: this version is no longer used for new documents.',
  archivedNote:
    'This version is closed. It is not deleted: documents from that period rely on this value.',
  scheduledNote: 'Not yet in force — it can therefore be edited directly.',

  propsTitle: 'Additional properties (props)',
  propsEmpty: 'Empty',

  actionAdd: 'Add item',
  actionEdit: 'Edit',
  actionSupersede: 'Create successor',
  actionArchive: 'Archive',
  editLockedHint: 'An active item cannot be edited directly — create a successor.',

  fieldCode: 'Code',
  fieldCodeHint: 'Latin letters, numbers and underscores. Code cannot be changed later.',
  fieldNameUz: 'Name (Uzbek Latin)',
  fieldNameUzCyrl: 'Name (Uzbek Cyrillic)',
  fieldNameRu: 'Name (Russian)',
  fieldNameKaa: 'Name (Karakalpak)',
  fieldNameEn: 'Name (English)',
  fieldValidFrom: 'Valid from',
  fieldValidTo: 'Valid to',
  fieldValidToHint: 'Leave empty for open-ended.',
  fieldSortOrder: 'Sort order',
  fieldProps: 'props (JSON)',
  fieldPropsHint: 'JSON object. Validated before saving.',

  addTitle: 'New item',
  addSubtitle: 'The item will be added to the classifier and will be in force from the specified date.',
  editTitle: 'Edit item',
  editSubtitle:
    'Only name, props, end date, and sort order change. Code and start date are item identity and cannot change.',
  supersedeTitle: 'Create successor',
  supersedeSubtitle:
    'The old item is not changed. It is closed the day before the new item takes effect and archived.',
  supersedeOriginal: 'Version being replaced',
  supersedeCodeLocked: 'Code must match the code of the old item.',
  supersedeValidFromHint: 'Date must be after the end of the old version.',

  archiveTitle: 'Archive item',
  archiveBody:
    'The item is not deleted — it is closed and removed from today’s list. To view it, select a past date above.',
  archiveConfirm: 'Yes, archive',

  createClassifierTitle: 'New classifier',
  createClassifierSubtitle: 'Only the classifier itself is created; items can be added later.',

  cancel: 'Cancel',
  save: 'Save',
  create: 'Create',
  saving: 'Saving...',

  errRequired: 'Required field',
  errInvalidJson: 'Invalid JSON:',
  errNotAnObject: 'props must be a JSON object (e.g. {"kind": "return"}).',
  errSaveFailed: 'Failed to save',
};

export const kaa: ClassifiersLabels = {
  title: 'Klassifikatorlar hám maǵlıwmatnamalar',
  subtitle:
    'Maǵlıwmatnama mánisleri ózgertilmeydi — olar versiyalanadı. Hár bir element óz ámel etiw múddetine iye, sonlıqtan ótken jılı berilgen ruxsatnama sol waqıttaǵı kodtı kórsetiwdi dawam etedi.',

  versioningTitle: 'Ne ushın ózgertiw ornına «miyrasxor» jaratıladı',
  versioningBody:
    'Kúshke kirgen element qayta jazılmaydı: oǵan miyrasxor jaratıladı. Eski element miyrasxor kúshke kirgen kúnnen bir kún aldın jabıladı hám arxivke ótedi, jańa element bolsa sol kúnnen baslap ámel etedi. Usı sebepli hújjetler ózi berilgen waqıttaǵı mániske baylanıslı bolıp qaladı.',

  pickerTitle: 'Klassifikator',
  pickerHint:
    'Klassifikatorlar dizimin qaytaratuǵın API joq — tómende sistemada seed qılınǵan klassifikatorlar, basqasın kodı boyınsha qolda kiritiń.',
  pickerKnown: 'Málum klassifikatorlar',
  pickerCustom: 'Basqa kod',
  pickerCustomPlaceholder: 'mısalı: violation_types',
  pickerOpen: 'Ashıw',
  pickerCreate: 'Jańa klassifikator',

  onDateTitle: 'Qaysı sánege',
  onDateHint:
    'Dizim — saylanǵan sánedegi jaǵday. Sáne kórsetilmese, búgin ámellerde bolǵan elementler kórinedi. Ótken sáne kórsetilse, sol kúni kúshke iye bolǵan elementler — sonıń ishinde házir arxivlengen versiyaları da — qaytarıladı.',
  onDateLabel: 'Sáne',
  onDateApply: 'Kórsetiw',
  onDateToday: 'Búginge qaytıw',
  onDateActive: 'Kórsetilmekte:',
  onDateTodayValue: 'búgingi jaǵday',

  listTitle: 'Elementler',
  itemsSuffix: 'element',
  loading: 'Júklenbekte...',
  loadFailed: 'Elementler júklenbedi.',
  empty: 'Bul sánede elementler tabılmadı.',
  emptyHint: 'Basqa sáneni saylań yamasa birinshi elementti qosıń.',

  colValidity: 'Ámel etiw múddeti',
  validFrom: 'Baslanıwı',
  validTo: 'Tamamlanıwı',
  validOpenEnded: 'múddetsiz',

  statusActive: 'Ámelde',
  statusScheduled: 'Ele kúshke kirmegen',
  statusClosed: 'Múddeti pitken',
  statusArchived: 'Arxivlengen',
  closedNote: 'Múddeti pitken: bul versiya endi jańa hújjetlerde qollanılmaydı.',
  archivedNote:
    'Bul versiya jabılǵan. Ol óshirilmeydi: sol dáwirde berilgen hújjetler usı mániske súyenedi.',
  scheduledNote: 'Ele kúshke kirmegen — sonlıqtan onı tikkeley ózgertiwge boladı.',

  propsTitle: 'Qosımsha maydanlar (props)',
  propsEmpty: 'Bos',

  actionAdd: 'Element qosıw',
  actionEdit: 'Ózgertiw',
  actionSupersede: 'Miyrasxor jaratıw',
  actionArchive: 'Arxivlew',
  editLockedHint: 'Kúshke kirgen element ózgertilmeydi — oǵan miyrasxor jaratıń.',

  fieldCode: 'Kod',
  fieldCodeHint: 'Latın háripleri, sanlar hám tómengi sızıqsha. Kod keyin ózgermeydi.',
  fieldNameUz: 'Atı (ózbekshe latın)',
  fieldNameUzCyrl: 'Atı (ózbekshe kirill)',
  fieldNameRu: 'Atı (orıssha)',
  fieldNameKaa: 'Atı (qaraqalpaqsha)',
  fieldNameEn: 'Atı (inglishe)',
  fieldValidFrom: 'Ámel etiw baslanıwı',
  fieldValidTo: 'Ámel etiw tamamlanıwı',
  fieldValidToHint: 'Bos qaldırılsa — múddetsiz.',
  fieldSortOrder: 'Tártip nomeri',
  fieldProps: 'props (JSON)',
  fieldPropsHint: 'JSON obyekt. Saqlawdan aldın tekseriledi.',

  addTitle: 'Jańa element',
  addSubtitle: 'Element klassifikatorǵa qosıladı hám kórsetilgen sáneden ámel ete baslaydı.',
  editTitle: 'Elementti ózgertiw',
  editSubtitle:
    'Tek atı, props, tamamlanıw sánesi hám tártip nomeri ózgeredi. Kod hám baslanıw sánesi — elementtiń ózligi, olar ózgermeydi.',
  supersedeTitle: 'Miyrasxor jaratıw',
  supersedeSubtitle:
    'Eski element ózgermeydi. Ol jańa element kúshke kirgen kúnnen bir kún aldın jabıladı hám arxivlenedi.',
  supersedeOriginal: 'Almastırılatuǵın versiya',
  supersedeCodeLocked: 'Kod eski elementniki menen birdey bolıwı shárt.',
  supersedeValidFromHint: 'Eski versiya tamamlanıwınan keyingi sáne bolıwı shárt.',

  archiveTitle: 'Elementti arxivlew',
  archiveBody:
    'Element óshirilmeydi — ol jabıladı hám búgingi dizimnen shıǵadı. Onı kóriw ushın joqarıda ótken sáneni saylań.',
  archiveConfirm: 'Awa, arxivlew',

  createClassifierTitle: 'Jańa klassifikator',
  createClassifierSubtitle: 'Tek klassifikatordıń ózi jaratıladı; elementler keyin qosıladı.',

  cancel: 'Biykar etiw',
  save: 'Saqlaw',
  create: 'Jaratıw',
  saving: 'Saqlanbaqta...',

  errRequired: 'Toltırılıwı shárt',
  errInvalidJson: 'JSON qátelik:',
  errNotAnObject: 'props JSON obyekt bolıwı kerek (mısalı {"kind": "return"}).',
  errSaveFailed: 'Saqlap bolmadı',
};

import type { UiLanguage } from '../../../i18n/context';

export type ClassifiersLabels = typeof uz_latn;

export const LABELS: Record<UiLanguage, ClassifiersLabels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
};

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
