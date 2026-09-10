/**
 * Copy for H7 (system settings), local to this screen rather than added to
 * `src/i18n/uz_latn.ts` / `ru.ts`: those dictionaries are shared by the whole
 * app and edited by every track at once, and a screen whose strings live next
 * to it can be read, reviewed and deleted as one unit.
 *
 * `ru` is typed against `uz_latn`'s keys, so a string added to one map and
 * forgotten in the other is a compile error rather than a Russian screen with
 * an Uzbek sentence in the middle of it — the same guarantee
 * `i18n/context.ts` gets from `Record<TranslationKey, string>`.
 *
 * A setting's own `description` is NOT here. It arrives from the server in
 * English (`SettingOut.description`) and is rendered verbatim: inventing a
 * translation for a key this screen has never seen would be inventing
 * meaning, and the operators who reach this screen are the ones who read the
 * backend's own vocabulary.
 */
export const uz_latn = {
  title: 'Tizim sozlamalari',
  subtitle: 'Tizim parametrlari, ularning joriy va standart qiymatlari',
  loading: 'Yuklanmoqda...',
  loadFailed: 'Sozlamalar yuklanmadi.',
  empty: 'Sozlamalar topilmadi.',
  overridden: 'Oʻzgartirilgan',
  atDefault: 'Standart qiymatda',
  overriddenCount: 'ta sozlama oʻzgartirilgan',
  currentValue: 'Joriy qiymat',
  defaultValue: 'Standart qiymat',
  resetHint: 'Alohida «tiklash» tugmasi yoʻq: standart qiymatga qaytarish uchun uni qoʻlda kiriting.',
  save: 'Saqlash',
  saved: 'Saqlandi',
  enabled: 'Yoqilgan',
  disabled: 'Oʻchirilgan',
  jsonHint: 'JSON koʻrinishida kiriting',
  seasonWindowsHint:
    'Format: faoliyat kodi → oy raqamlari roʻyxati (1–12). Masalan: {"grazing": [4, 5, 6]}',
  invalidJson: 'JSON notoʻgʻri',
  invalidNumber: 'Raqam kiriting',
  saveFailed: 'Saqlanmadi',
  // Stage 10, F3 (ruling #184): `site_rules_url`'s label and hint, and the
  // client-side check for every URL-shaped setting.
  siteRulesUrlLabel: 'Ariza berishda qabul qilinadigan qoidalar (havola)',
  siteRulesUrlHint:
    'Arizachining «Qoidalar bilan tanishdim» katakchasi shu havolaga olib boradi.',
  invalidUrl: 'Toʻliq havola kiriting: http:// yoki https:// bilan boshlanishi kerak.',
} as const;

export const ru: Record<keyof typeof uz_latn, string> = {
  title: 'Системные настройки',
  subtitle: 'Параметры системы, их текущие значения и значения по умолчанию',
  loading: 'Загрузка...',
  loadFailed: 'Не удалось загрузить настройки.',
  empty: 'Настройки не найдены.',
  overridden: 'Изменено',
  atDefault: 'Значение по умолчанию',
  overriddenCount: 'настроек изменено',
  currentValue: 'Текущее значение',
  defaultValue: 'По умолчанию',
  resetHint: 'Отдельной кнопки «сбросить» нет: чтобы вернуть значение по умолчанию, введите его вручную.',
  save: 'Сохранить',
  saved: 'Сохранено',
  enabled: 'Включено',
  disabled: 'Выключено',
  jsonHint: 'Введите значение в формате JSON',
  seasonWindowsHint:
    'Формат: код деятельности → список номеров месяцев (1–12). Например: {"grazing": [4, 5, 6]}',
  invalidJson: 'Некорректный JSON',
  invalidNumber: 'Введите число',
  saveFailed: 'Не удалось сохранить',
  siteRulesUrlLabel: 'Правила, принимаемые при подаче заявления (ссылка)',
  siteRulesUrlHint: 'Чекбокс заявителя «Я ознакомился с правилами» ведёт на эту ссылку.',
  invalidUrl: 'Введите полную ссылку: она должна начинаться с http:// или https://.',
};

export const uz_cyrl: Record<keyof typeof uz_latn, string> = {
  title: 'Тизим созламалари',
  subtitle: 'Тизим параметрлари, уларнинг жорий ва стандарт қийматлари',
  loading: 'Юкланмоқда...',
  loadFailed: 'Созламалар юкланмади.',
  empty: 'Созламалар топилмади.',
  overridden: 'Ўзгартирилган',
  atDefault: 'Стандарт қийматда',
  overriddenCount: 'та созлама ўзгартирилган',
  currentValue: 'Жорий қиймат',
  defaultValue: 'Стандарт қиймат',
  resetHint: 'Алоҳида «тиклаш» тугмаси йўқ: стандарт қийматга қайтариш учун уни қўлда киритинг.',
  save: 'Сақлаш',
  saved: 'Сақланди',
  enabled: 'Ёқилган',
  disabled: 'Ўчирилган',
  jsonHint: 'JSON кўринишида киритинг',
  seasonWindowsHint:
    'Формат: фаолият коди → ой рақамлари рўйхати (1–12). Масалан: {"grazing": [4, 5, 6]}',
  invalidJson: 'JSON нотўғри',
  invalidNumber: 'Рақам киритинг',
  saveFailed: 'Сақланмади',
  siteRulesUrlLabel: 'Ариза беришда қабул қилинадиган қоидалар (ҳавола)',
  siteRulesUrlHint: 'Аризачининг «Қоидалар билан танишдим» катакчаси шу ҳаволага олиб боради.',
  invalidUrl: 'Тўлиқ ҳавола киритинг: http:// ёки https:// билан бошланиши керак.',
};

export const en: Record<keyof typeof uz_latn, string> = {
  title: 'System Settings',
  subtitle: 'System parameters, their current values and defaults',
  loading: 'Loading...',
  loadFailed: 'Failed to load settings.',
  empty: 'No settings found.',
  overridden: 'Overridden',
  atDefault: 'At default',
  overriddenCount: 'settings overridden',
  currentValue: 'Current value',
  defaultValue: 'Default value',
  resetHint: 'There is no separate reset button: enter the default value manually to restore it.',
  save: 'Save',
  saved: 'Saved',
  enabled: 'Enabled',
  disabled: 'Disabled',
  jsonHint: 'Enter value as JSON',
  seasonWindowsHint:
    'Format: activity code → list of month numbers (1-12). Example: {"grazing": [4, 5, 6]}',
  invalidJson: 'Invalid JSON',
  invalidNumber: 'Enter a number',
  saveFailed: 'Failed to save',
  siteRulesUrlLabel: 'Rules accepted when filing an application (link)',
  siteRulesUrlHint: 'The applicant’s “I have read the rules” checkbox links to this URL.',
  invalidUrl: 'Enter a full URL starting with http:// or https://.',
};

export const kaa: Record<keyof typeof uz_latn, string> = {
  title: 'Sistema sazlawları',
  subtitle: 'Sistema parametrleri, olardıń házirgi hám standart mánisleri',
  loading: 'Júklenbekte...',
  loadFailed: 'Sazlawlar júklenbedi.',
  empty: 'Sazlawlar tabılmadı.',
  overridden: 'Ózgertilgen',
  atDefault: 'Standart mániste',
  overriddenCount: 'sazlaw ózgertilgen',
  currentValue: 'Házirgi mánis',
  defaultValue: 'Standart mánis',
  resetHint: 'Bólak «qayta tiklew» túymesi joq: standart mániske qaytarıw ushın onı qolda kiritiń.',
  save: 'Saqlaw',
  saved: 'Saqlandı',
  enabled: 'Qosılǵan',
  disabled: 'Óshirilgen',
  jsonHint: 'JSON kórinisinde kiritiń',
  seasonWindowsHint:
    'Format: iskerlik kodı → aylar sanları dizimi (1-12). Mısalı: {"grazing": [4, 5, 6]}',
  invalidJson: 'JSON nadurıs',
  invalidNumber: 'San kiritiń',
  saveFailed: 'Saqlanbadı',
  siteRulesUrlLabel: 'Ariza beriwde qabıl etilgen qaǵıydalar (siltewi)',
  siteRulesUrlHint: 'Arzashınıń «Qaǵıydalar menen tanıstım» katakshesi usı siltewge alıp baradı.',
  invalidUrl: 'Tolıq siltewdi kiritiń: http:// yamasa https:// menen baslanıwı kerek.',
};

import type { UiLanguage } from '../../../i18n/context';

export type SettingsLabels = Record<keyof typeof uz_latn, string>;

export const LABELS: Record<UiLanguage, SettingsLabels> = {
  uz_latn,
  ru,
  uz_cyrl,
  kaa,
  en,
};
