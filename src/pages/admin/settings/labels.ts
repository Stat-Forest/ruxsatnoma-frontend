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
  invalidJson: 'JSON notoʻgʻri',
  invalidNumber: 'Raqam kiriting',
  saveFailed: 'Saqlanmadi',
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
  invalidJson: 'Некорректный JSON',
  invalidNumber: 'Введите число',
  saveFailed: 'Не удалось сохранить',
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
  invalidJson: 'JSON нотўғри',
  invalidNumber: 'Рақам киритинг',
  saveFailed: 'Сақланмади',
};

export const en: Record<keyof typeof uz_latn, string> = {
  title: 'System Settings',
  subtitle: 'System parameters, their current values and defaults',
  loading: 'Loading...',
  loadFailed: 'Failed to load settings.',
  empty: 'No settings found.',
  overridden: 'Overridden',
  atDefault: 'Default value',
  overriddenCount: 'settings overridden',
  currentValue: 'Current value',
  defaultValue: 'Default value',
  resetHint: 'There is no separate reset button: enter the default value manually to restore it.',
  save: 'Save',
  saved: 'Saved',
  enabled: 'Enabled',
  disabled: 'Disabled',
  jsonHint: 'Enter value as JSON',
  invalidJson: 'Invalid JSON',
  invalidNumber: 'Enter a number',
  saveFailed: 'Failed to save',
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
  invalidJson: 'JSON nadurıs',
  invalidNumber: 'San kiritiń',
  saveFailed: 'Saqlanbadı',
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
