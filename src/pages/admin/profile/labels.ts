/**
 * Copy for the profile screens, local to this folder rather than in the shared
 * dictionaries: seven administration screens were built in parallel, and one
 * shared file edited by all of them is the merge conflict none of them can
 * resolve alone. `nav.*` labels stay shared, because the shell owns the menu.
 */
const uz_latn = {
  title: 'Parolni almashtirish',
  forced: "Davom etish uchun parolni almashtiring. Administrator bergan vaqtinchalik parol bir martalik.",
  oldPassword: 'Joriy parol',
  newPassword: 'Yangi parol',
  confirmPassword: 'Yangi parolni takrorlang',
  submit: 'Saqlash',
  saving: 'Saqlanmoqda…',
  mismatch: 'Parollar mos kelmadi.',
  serverError: "Parolni almashtirib bo'lmadi. Joriy parolni tekshiring va qayta urinib ko'ring.",
  requirements: "Parol talablari:",
  ruleLength: "kamida 8 ta belgi",
  ruleUppercase: 'bosh harf',
  ruleLowercase: 'kichik harf',
  ruleDigit: 'raqam',
  ruleSpecial: 'maxsus belgi',
  logout: 'Chiqish',
};

const ru: Record<keyof typeof uz_latn, string> = {
  title: 'Смена пароля',
  forced: 'Чтобы продолжить, смените пароль. Временный пароль от администратора действует один раз.',
  oldPassword: 'Текущий пароль',
  newPassword: 'Новый пароль',
  confirmPassword: 'Повторите новый пароль',
  submit: 'Сохранить',
  saving: 'Сохраняем…',
  mismatch: 'Пароли не совпадают.',
  serverError: 'Не удалось сменить пароль. Проверьте текущий пароль и попробуйте ещё раз.',
  requirements: 'Требования к паролю:',
  ruleLength: 'не менее 8 символов',
  ruleUppercase: 'заглавная буква',
  ruleLowercase: 'строчная буква',
  ruleDigit: 'цифра',
  ruleSpecial: 'специальный символ',
  logout: 'Выйти',
};

export const LABELS = { uz_latn, ru };
export type ProfileLabels = typeof uz_latn;
