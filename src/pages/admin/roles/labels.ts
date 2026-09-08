/**
 * Screen H2's own copy, in the two UI languages the app ships.
 *
 * Local to this folder rather than in `src/i18n/uz_latn.ts` / `ru.ts`: those
 * two dictionaries are shared by every screen and edited by every parallel
 * session, and a screen's private strings do not need to be a merge conflict.
 * The shape below gives the same compile-time parity the shared dictionaries
 * get — `ru` is typed as `typeof uz_latn`, so a key present in one map and
 * missing (or misspelt) in the other is a build error, not a blank label.
 */

const uz_latn = {
  title: 'Rollar va huquqlar',
  subtitle: 'Har bir rol tizimda qaysi amallarni bajara olishini shu yerda belgilanadi',
  listTitle: 'Rollar',
  listHint: 'Huquqlarini koʻrish uchun rolni tanlang',
  matrixTitle: 'Huquqlar matritsasi',
  emptySelection: 'Rol tanlanmagan',
  emptySelectionHint: 'Roʻyxatdan rolni tanlang — uning huquqlari shu yerda ochiladi',
  systemBadge: 'Tizim roli',
  statusActive: 'Faol',
  statusArchived: 'Arxivlangan',
  permissionsSuffix: 'ta huquq',
  holdersSuffix: 'ta foydalanuvchi',
  selectedOf: 'tanlangan',
  save: 'Saqlash',
  saving: 'Saqlanmoqda...',
  saved: 'Huquqlar saqlandi',
  reset: 'Tiklash',
  loading: 'Yuklanmoqda...',
  loadError: 'Rollar roʻyxati yuklanmadi.',
  saveError: 'Huquqlarni saqlab boʻlmadi.',
  systemNote: 'Tizim rolining kodi va nomi bu yerda oʻzgartirilmaydi — faqat huquqlar tahrirlanadi.',
  applicantNote:
    'Ariza beruvchi roliga xodim huquqlari berilmaydi — server bunday saqlashni rad etadi (ERR-VAL-001).',
  emptyRoles: 'Rollar topilmadi.',
  emptyPermissions: 'Huquqlar registri boʻsh.',
  groups: {
    applications: 'Arizalar',
    permits: 'Ruxsatnomalar',
    payments: 'Toʻlovlar',
    norms: 'Hisob-kitob va normalar',
    gis: 'Xaritalar va konturlar',
    signatures: 'Elektron imzo',
    notifications: 'Xabarnomalar',
    auth: 'Foydalanuvchilar va rollar',
    admin: 'Maʼmuriyat',
  },
};

export type RoleScreenLabels = typeof uz_latn;

const ru: RoleScreenLabels = {
  title: 'Роли и права',
  subtitle: 'Здесь задаётся, какие действия в системе может выполнять каждая роль',
  listTitle: 'Роли',
  listHint: 'Выберите роль, чтобы увидеть её права',
  matrixTitle: 'Матрица прав',
  emptySelection: 'Роль не выбрана',
  emptySelectionHint: 'Выберите роль в списке — её права откроются здесь',
  systemBadge: 'Системная роль',
  statusActive: 'Активна',
  statusArchived: 'В архиве',
  permissionsSuffix: 'прав',
  holdersSuffix: 'пользователей',
  selectedOf: 'выбрано',
  save: 'Сохранить',
  saving: 'Сохранение...',
  saved: 'Права сохранены',
  reset: 'Сбросить',
  loading: 'Загрузка...',
  loadError: 'Не удалось загрузить список ролей.',
  saveError: 'Не удалось сохранить права.',
  systemNote: 'Код и название системной роли здесь не меняются — редактируются только права.',
  applicantNote:
    'Роли заявителя нельзя выдать права сотрудника — сервер отклонит такое сохранение (ERR-VAL-001).',
  emptyRoles: 'Роли не найдены.',
  emptyPermissions: 'Реестр прав пуст.',
  groups: {
    applications: 'Заявки',
    permits: 'Разрешения',
    payments: 'Платежи',
    norms: 'Расчёт и нормативы',
    gis: 'Карты и контуры',
    signatures: 'Электронная подпись',
    notifications: 'Уведомления',
    auth: 'Пользователи и роли',
    admin: 'Администрирование',
  },
};

import type { UiLanguage } from '../../../i18n/context';

export const labels: Record<UiLanguage, RoleScreenLabels> = {
  uz_latn,
  ru,
  uz_cyrl: uz_latn,
  kaa: uz_latn,
  en: uz_latn,
};

/** The order the modules are shown in — the citizen-facing flow first, the
 *  administrative modules last. A prefix this list does not name (a module
 *  landing after this screen was written) is appended alphabetically rather
 *  than dropped: the registry, not this constant, decides what exists. */
export const GROUP_ORDER: readonly string[] = [
  'applications',
  'permits',
  'payments',
  'norms',
  'gis',
  'signatures',
  'notifications',
  'auth',
  'admin',
];

export function groupTitle(prefix: string, lang: UiLanguage | string): string {
  const map = labels[lang as UiLanguage] ?? labels.uz_latn;
  const known = map.groups as Record<string, string | undefined>;
  return known[prefix] ?? prefix;
}
