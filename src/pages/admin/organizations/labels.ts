/**
 * Copy for H5, local to this screen (the shared `src/i18n/` dictionaries are
 * owned by the shell and carry only navigation-level keys).
 *
 * `ru` is typed `Record<LabelKey, string>` against the keys of `uz_latn`, so a
 * key added to one map and forgotten in the other is a compile error rather
 * than a Latin string leaking into a Russian screen — the same guarantee
 * `src/i18n/context.ts` gives the shared dictionaries.
 *
 * Latin-script Uzbek is primary: `uz_latn` is written first and `ru` is the
 * translation of it.
 */
import { useLanguage } from '../../../i18n/useT';

export const uz_latn = {
  'page.title': 'Tashkilotlar tuzilmasi',
  'page.subtitle':
    'Agentlik, hududiy boshqarmalar va oʻrmon xoʻjaliklari ierarxiyasi. Foydalanuvchining tashkiloti uning koʻrish doirasini belgilaydi.',
  'page.create': 'Tashkilot qoʻshish',

  'summary.total': 'Jami tashkilot',
  'summary.leshoz': 'Oʻrmon xoʻjaligi',

  'search.placeholder': 'Nomi yoki kodi boʻyicha qidirish',
  'search.empty': 'Soʻrovga mos tashkilot topilmadi.',

  'tree.empty': 'Hozircha birorta tashkilot yaratilmagan.',
  'tree.error': 'Tashkilotlar roʻyxati yuklanmadi.',
  'tree.expand': 'Ochish',
  'tree.collapse': 'Yigʻish',
  'tree.addChild': 'Ichki tashkilot qoʻshish',
  'tree.edit': 'Tahrirlash',
  'tree.archive': 'Arxivlash',
  'tree.noStir': 'STIR koʻrsatilmagan',

  'kind.agency': 'Agentlik',
  'kind.territorial': 'Hududiy boshqarma',
  'kind.leshoz': 'Oʻrmon xoʻjaligi',
  'kind.bolim': 'Boʻlim',
  'kind.aylanma': 'Aylanma',
  'kind.bolak': 'Boʻlak',

  'status.active': 'Faol',
  'status.archived': 'Arxivlangan',

  'form.createTitle': 'Yangi tashkilot',
  'form.editTitle': 'Tashkilotni tahrirlash',
  'form.createSubtitle': 'Tuzilmadagi oʻrni va rekvizitlari',
  'form.editSubtitle': 'Turi va kodi yaratilgandan keyin oʻzgarmaydi',
  'form.kind': 'Tashkilot turi',
  'form.parent': 'Yuqori tashkilot',
  'form.parentRoot': 'Agentlik — tuzilmaning ildizi, yuqori tashkiloti yoʻq',
  'form.parentPlaceholder': 'Tanlang',
  'form.code': 'Kod',
  'form.codeHint': 'Lotin harflari, raqamlar va defis; keyinchalik oʻzgartirib boʻlmaydi',
  'form.nameSection': 'Nomi',
  'form.name.uz_cyrl': 'Nomi (kirill)',
  'form.name.uz_latn': 'Nomi (lotin)',
  'form.name.ru': 'Nomi (rus)',
  'form.nameHint': 'Kirill yozuvidagi nom majburiy — u tizimning zaxira tili',
  'form.stir': 'STIR',
  'form.stirHint': '9 ta raqam',
  'form.region': 'Viloyat',
  'form.district': 'Tuman',
  'form.districtLocked': 'Avval viloyatni tanlang',
  'form.notSelected': 'Tanlanmagan',
  'form.submit': 'Saqlash',
  'form.cancel': 'Bekor qilish',
  'form.loading': 'Yuklanmoqda...',

  'error.required': 'Toʻldirilishi shart',
  'error.parentRequired': 'Yuqori tashkilotni tanlang',
  'error.code': 'Faqat lotin harflari, raqamlar va defis',
  'error.stir': 'STIR 9 ta raqamdan iborat boʻlishi kerak',
  'error.save': 'Saqlanmadi',
  'error.codeTaken': 'Bunday kod allaqachon mavjud',
  'error.agencyExists': 'Agentlik allaqachon yaratilgan — u yagona boʻlishi kerak',

  'archive.title': 'Tashkilotni arxivlash',
  'archive.question': 'Ushbu tashkilot arxivga koʻchiriladi va roʻyxatdan yoʻqoladi:',
  'archive.warning':
    'Tashkilotlar oʻchirilmaydi, faqat arxivlanadi. Ichida faol tashkilotlar boʻlsa, avval ularni arxivlash kerak.',
  'archive.confirm': 'Arxivlash',
  'archive.cancel': 'Bekor qilish',
  'archive.error': 'Arxivlanmadi',
  'archive.error.children':
    'Bu tashkilotda faol ichki tashkilotlar bor — avval ularni arxivlang.',
  'archive.done': 'Tashkilot arxivlandi va faol roʻyxatdan chiqarildi.',
};

export type LabelKey = keyof typeof uz_latn;
export type Labels = Record<LabelKey, string>;

export const ru: Labels = {
  'page.title': 'Структура организаций',
  'page.subtitle':
    'Иерархия агентства, территориальных управлений и лесхозов. Организация пользователя определяет его зону видимости.',
  'page.create': 'Добавить организацию',

  'summary.total': 'Всего организаций',
  'summary.leshoz': 'Лесхозов',

  'search.placeholder': 'Поиск по названию или коду',
  'search.empty': 'По запросу ничего не найдено.',

  'tree.empty': 'Пока не создано ни одной организации.',
  'tree.error': 'Не удалось загрузить список организаций.',
  'tree.expand': 'Развернуть',
  'tree.collapse': 'Свернуть',
  'tree.addChild': 'Добавить подчинённую организацию',
  'tree.edit': 'Редактировать',
  'tree.archive': 'Архивировать',
  'tree.noStir': 'ИНН не указан',

  'kind.agency': 'Агентство',
  'kind.territorial': 'Территориальное управление',
  'kind.leshoz': 'Лесхоз',
  'kind.bolim': 'Отделение',
  'kind.aylanma': 'Обход',
  'kind.bolak': 'Участок',

  'status.active': 'Активна',
  'status.archived': 'В архиве',

  'form.createTitle': 'Новая организация',
  'form.editTitle': 'Редактирование организации',
  'form.createSubtitle': 'Место в структуре и реквизиты',
  'form.editSubtitle': 'Тип и код после создания не меняются',
  'form.kind': 'Тип организации',
  'form.parent': 'Вышестоящая организация',
  'form.parentRoot': 'Агентство — корень структуры, вышестоящей организации нет',
  'form.parentPlaceholder': 'Выберите',
  'form.code': 'Код',
  'form.codeHint': 'Латиница, цифры и дефис; изменить позже нельзя',
  'form.nameSection': 'Название',
  'form.name.uz_cyrl': 'Название (кириллица)',
  'form.name.uz_latn': 'Название (латиница)',
  'form.name.ru': 'Название (русский)',
  'form.nameHint': 'Название на кириллице обязательно — это резервный язык системы',
  'form.stir': 'ИНН (СТИР)',
  'form.stirHint': '9 цифр',
  'form.region': 'Область',
  'form.district': 'Район',
  'form.districtLocked': 'Сначала выберите область',
  'form.notSelected': 'Не выбрано',
  'form.submit': 'Сохранить',
  'form.cancel': 'Отмена',
  'form.loading': 'Загрузка...',

  'error.required': 'Обязательное поле',
  'error.parentRequired': 'Выберите вышестоящую организацию',
  'error.code': 'Только латиница, цифры и дефис',
  'error.stir': 'ИНН должен состоять из 9 цифр',
  'error.save': 'Не удалось сохранить',
  'error.codeTaken': 'Организация с таким кодом уже существует',
  'error.agencyExists': 'Агентство уже создано — оно может быть только одно',

  'archive.title': 'Архивирование организации',
  'archive.question': 'Организация будет перенесена в архив и исчезнет из списка:',
  'archive.warning':
    'Организации не удаляются, а только архивируются. Если внутри есть активные организации, сначала архивируйте их.',
  'archive.confirm': 'Архивировать',
  'archive.cancel': 'Отмена',
  'archive.error': 'Не удалось архивировать',
  'archive.error.children':
    'У этой организации есть активные подчинённые — сначала архивируйте их.',
  'archive.done': 'Организация архивирована и убрана из активного списка.',
};

export const uz_cyrl: Labels = {
  'page.title': 'Ташкилотлар тузилмаси',
  'page.subtitle':
    'Агентлик, ҳудудий бошқармалар ва ўрмон хўжаликлари иерархияси. Фойдаланувчининг ташкилоти унинг кўриш доирасини белгилайди.',
  'page.create': 'Ташкилот қўшиш',

  'summary.total': 'Жами ташкилот',
  'summary.leshoz': 'Ўрмон хўжалиги',

  'search.placeholder': 'Номи ёки коди бўйича қидириш',
  'search.empty': 'Сўровга мос ташкилот топилмади.',

  'tree.empty': 'Ҳозирча бирорта ташкилот яратилмаган.',
  'tree.error': 'Ташкилотлар рўйхати юкланмади.',
  'tree.expand': 'Очиш',
  'tree.collapse': 'Йиғиш',
  'tree.addChild': 'Ички ташкилот қўшиш',
  'tree.edit': 'Таҳрирлаш',
  'tree.archive': 'Архивлаш',
  'tree.noStir': 'СТИР кўрсатилмаган',

  'kind.agency': 'Агентлик',
  'kind.territorial': 'Ҳудудий бошқарма',
  'kind.leshoz': 'Ўрмон хўжалиги',
  'kind.bolim': 'Бўлим',
  'kind.aylanma': 'Айланма',
  'kind.bolak': 'Бўлак',

  'status.active': 'Фаол',
  'status.archived': 'Архивланган',

  'form.createTitle': 'Янги ташкилот',
  'form.editTitle': 'Ташкилотни таҳрирлаш',
  'form.createSubtitle': 'Тузилмадаги ўрни ва реквизитлари',
  'form.editSubtitle': 'Тури ва коди яратилгандан кейин ўзгармайди',
  'form.kind': 'Ташкилот тури',
  'form.parent': 'Юқори ташкилот',
  'form.parentRoot': 'Агентлик — тузилманинг илдизи, юқори ташкилоти йўқ',
  'form.parentPlaceholder': 'Танланг',
  'form.code': 'Код',
  'form.codeHint': 'Лотин ҳарфлари, рақамлар ва дефис; кейинчалик ўзгартириб бўлмайди',
  'form.nameSection': 'Номи',
  'form.name.uz_cyrl': 'Номи (кирилл)',
  'form.name.uz_latn': 'Номи (лотин)',
  'form.name.ru': 'Номи (рус)',
  'form.nameHint': 'Кирилл ёзувидаги ном мажбурий — у тизимнинг захира тили',
  'form.stir': 'СТИР',
  'form.stirHint': '9 та рақам',
  'form.region': 'Вилоят',
  'form.district': 'Туман',
  'form.districtLocked': 'Аввал вилоятни танланг',
  'form.notSelected': 'Танланмаган',
  'form.submit': 'Сақлаш',
  'form.cancel': 'Бекор қилиш',
  'form.loading': 'Юкланмоқда...',

  'error.required': 'Тўлдирилиши шарт',
  'error.parentRequired': 'Юқори ташкилотни танланг',
  'error.code': 'Фақат лотин ҳарфлари, рақамлар ва дефис',
  'error.stir': 'СТИР 9 та рақамдан иборат бўлиши керак',
  'error.save': 'Сақланмади',
  'error.codeTaken': 'Бундай код аллақачон мавжуд',
  'error.agencyExists': 'Агентлик аллақачон яратилган — у ягона бўлиши керак',

  'archive.title': 'Ташкилотни архивлаш',
  'archive.question': 'Ушбу ташкилот архивга кўчирилади ва рўйхатдан йўқолади:',
  'archive.warning':
    'Ташкилотлар ўчирилмайди, фақат архивланади. Ичида фаол ташкилотлар бўлса, аввал уларни архивлаш керак.',
  'archive.confirm': 'Архивлаш',
  'archive.cancel': 'Бекор қилиш',
  'archive.error': 'Архивланмади',
  'archive.error.children':
    'Бу ташкилотда фаол ички ташкилотлар бор — аввал уларни архивланг.',
  'archive.done': 'Ташкилот архивланди ва фаол рўйхатдан чиқарилди.',
};

export const en: Labels = {
  'page.title': 'Organization structure',
  'page.subtitle':
    'Hierarchy of Agency, territorial departments and forestry enterprises. User organization defines their visibility zone.',
  'page.create': 'Add organization',

  'summary.total': 'Total organizations',
  'summary.leshoz': 'Forestry enterprises',

  'search.placeholder': 'Search by name or code',
  'search.empty': 'No organization found matching the query.',

  'tree.empty': 'No organization has been created yet.',
  'tree.error': 'Failed to load organization list.',
  'tree.expand': 'Expand',
  'tree.collapse': 'Collapse',
  'tree.addChild': 'Add subordinate organization',
  'tree.edit': 'Edit',
  'tree.archive': 'Archive',
  'tree.noStir': 'TIN (STIR) not specified',

  'kind.agency': 'Agency',
  'kind.territorial': 'Territorial department',
  'kind.leshoz': 'Forestry enterprise',
  'kind.bolim': 'Division',
  'kind.aylanma': 'Circumscription',
  'kind.bolak': 'Parcel',

  'status.active': 'Active',
  'status.archived': 'Archived',

  'form.createTitle': 'New organization',
  'form.editTitle': 'Edit organization',
  'form.createSubtitle': 'Structure placement and details',
  'form.editSubtitle': 'Kind and code cannot be changed once created',
  'form.kind': 'Organization type',
  'form.parent': 'Parent organization',
  'form.parentRoot': 'Agency — root of structure, has no parent organization',
  'form.parentPlaceholder': 'Select',
  'form.code': 'Code',
  'form.codeHint': 'Latin letters, numbers and hyphens; cannot be changed later',
  'form.nameSection': 'Name',
  'form.name.uz_cyrl': 'Name (Cyrillic)',
  'form.name.uz_latn': 'Name (Latin)',
  'form.name.ru': 'Name (Russian)',
  'form.nameHint': 'Cyrillic name is required — system fallback language',
  'form.stir': 'TIN (STIR)',
  'form.stirHint': '9 digits',
  'form.region': 'Region',
  'form.district': 'District',
  'form.districtLocked': 'Select region first',
  'form.notSelected': 'Not selected',
  'form.submit': 'Save',
  'form.cancel': 'Cancel',
  'form.loading': 'Loading...',

  'error.required': 'Required field',
  'error.parentRequired': 'Select parent organization',
  'error.code': 'Only Latin letters, numbers and hyphens',
  'error.stir': 'TIN must consist of 9 digits',
  'error.save': 'Failed to save',
  'error.codeTaken': 'Organization with this code already exists',
  'error.agencyExists': 'Agency already exists — only one is allowed',

  'archive.title': 'Archive organization',
  'archive.question': 'This organization will be moved to archive and removed from active list:',
  'archive.warning':
    'Organizations are never deleted, only archived. If it has active child organizations, archive them first.',
  'archive.confirm': 'Archive',
  'archive.cancel': 'Cancel',
  'archive.error': 'Failed to archive',
  'archive.error.children':
    'This organization has active children — archive them first.',
  'archive.done': 'Organization archived and removed from active list.',
};

export const kaa: Labels = {
  'page.title': 'Shólkemler dúzilisi',
  'page.subtitle':
    'Agentlik, aymaqlıq basqarmalar hám toǵay xojalıqları ierarxiyası. Paydalanıwshınıń shólkemi onıń kóriw sheńberin belgileydi.',
  'page.create': 'Shólkem qosıw',

  'summary.total': 'Jámi shólkem',
  'summary.leshoz': 'Toǵay xojalıǵı',

  'search.placeholder': 'Atı yamasa kodı boyınsha izlew',
  'search.empty': 'Sorawǵa sáykes shólkem tabılmadı.',

  'tree.empty': 'Házirshe bir de bir shólkem jaratılmaǵan.',
  'tree.error': 'Shólkemler dizimi júklenbedi.',
  'tree.expand': 'Ashıw',
  'tree.collapse': 'Jıyıw',
  'tree.addChild': 'İshki shólkem qosıw',
  'tree.edit': 'Ózgertiw',
  'tree.archive': 'Arxivlew',
  'tree.noStir': 'STIR kórsetilmegen',

  'kind.agency': 'Agentlik',
  'kind.territorial': 'Aymaqlıq basqarma',
  'kind.leshoz': 'Toǵay xojalıǵı',
  'kind.bolim': 'Bólim',
  'kind.aylanma': 'Aylanba',
  'kind.bolak': 'Bólek',

  'status.active': 'Belsendi',
  'status.archived': 'Arxivlengen',

  'form.createTitle': 'Jańa shólkem',
  'form.editTitle': 'Shólkemdi ózgertiw',
  'form.createSubtitle': 'Dúzilistegi ornı hám rekvizitleri',
  'form.editSubtitle': 'Túri hám kodı jaratılǵannan keyin ózgermeydi',
  'form.kind': 'Shólkem túri',
  'form.parent': 'Joqarı shólkem',
  'form.parentRoot': 'Agentlik — dúzilis tamırı, joqarı shólkemi joq',
  'form.parentPlaceholder': 'Saylań',
  'form.code': 'Kod',
  'form.codeHint': 'Latın háripleri, sanlar hám defis; keyinirek ózgertip bolmaydı',
  'form.nameSection': 'Atı',
  'form.name.uz_cyrl': 'Atı (kirill)',
  'form.name.uz_latn': 'Atı (latın)',
  'form.name.ru': 'Atı (orıs)',
  'form.nameHint': 'Kirill jazıwındaǵı at májbúriy — ol sistemanıń rezerv tili',
  'form.stir': 'STIR',
  'form.stirHint': '9 san',
  'form.region': 'Wálayat',
  'form.district': 'Rayon',
  'form.districtLocked': 'Dáslep wálayattı saylań',
  'form.notSelected': 'Saylanbaǵan',
  'form.submit': 'Saqlaw',
  'form.cancel': 'Biykar etiw',
  'form.loading': 'Júklenbekte...',

  'error.required': 'Toltırılıwı shárt',
  'error.parentRequired': 'Joqarı shólkemdi saylań',
  'error.code': 'Tek latın háripleri, sanlar hám defis',
  'error.stir': 'STIR 9 sannan ibarat bolıwı kerek',
  'error.save': 'Saqlanbadı',
  'error.codeTaken': 'Bunday kod aldınnan bar',
  'error.agencyExists': 'Agentlik aldınnan jaratılǵan — ol birden-bir bolıwı kerek',

  'archive.title': 'Shólkemdi arxivlew',
  'archive.question': 'Bul shólkem arxivke kóshiriledi hám dizimnen joǵaladı:',
  'archive.warning':
    'Shólkemler óshirilmeydi, tek arxivlenedi. İshinde belsendi shólkemler bolsa, dáslep olardı arxivlew kerek.',
  'archive.confirm': 'Arxivlew',
  'archive.cancel': 'Biykar etiw',
  'archive.error': 'Arxivlenbedi',
  'archive.error.children':
    'Bul shólkemde belsendi ishki shólkemler bar — dáslep olardı arxivleń.',
  'archive.done': 'Shólkem arxivlendi hám belsendi dizimnen shıǵarıldı.',
};

import type { UiLanguage } from '../../../i18n/context';

export const LABELS: Record<UiLanguage, Labels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
};

export function useLabels(): Labels {
  const { lang } = useLanguage();
  return LABELS[lang] ?? LABELS.uz_latn;
}
