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

import type { UiLanguage } from '../../../i18n/context';

export const LABELS: Record<UiLanguage, Labels> = {
  uz_latn,
  ru,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: uz_latn,
};

export function useLabels(): Labels {
  const { lang } = useLanguage();
  return LABELS[lang] ?? LABELS.uz_latn;
}
