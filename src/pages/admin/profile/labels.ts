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

const uz_cyrl: Record<keyof typeof uz_latn, string> = {
  title: 'Паролни алмаштириш',
  forced: 'Давом этиш учун паролни алмаштиринг. Администратор берган вақтинчалик пароль бир марталик.',
  oldPassword: 'Жорий пароль',
  newPassword: 'Янги пароль',
  confirmPassword: 'Янги паролни такрорланг',
  submit: 'Сақлаш',
  saving: 'Сақланмоқда…',
  mismatch: 'Пароллар мос келмади.',
  serverError: 'Паролни алмаштириб бўлмади. Жорий паролни текширинг ва қайта уриниб кўринг.',
  requirements: 'Пароль талаблари:',
  ruleLength: 'камида 8 та белги',
  ruleUppercase: 'бош ҳарф',
  ruleLowercase: 'кичик ҳарф',
  ruleDigit: 'рақам',
  ruleSpecial: 'махсус белги',
  logout: 'Чиқиш',
};

const en: Record<keyof typeof uz_latn, string> = {
  title: 'Change password',
  forced: 'To continue, please change your password. The temporary password from the administrator is single-use.',
  oldPassword: 'Current password',
  newPassword: 'New password',
  confirmPassword: 'Confirm new password',
  submit: 'Save',
  saving: 'Saving…',
  mismatch: 'Passwords do not match.',
  serverError: 'Failed to change password. Check your current password and try again.',
  requirements: 'Password requirements:',
  ruleLength: 'at least 8 characters',
  ruleUppercase: 'uppercase letter',
  ruleLowercase: 'lowercase letter',
  ruleDigit: 'number',
  ruleSpecial: 'special character',
  logout: 'Log out',
};

const kaa: Record<keyof typeof uz_latn, string> = {
  title: 'Paroldi ózgertiw',
  forced: 'Dawam etiw ushın paroldi ózgertiń. Administratordan berilgen waqtınshalıq parol bir martalıq.',
  oldPassword: 'Házirgi parol',
  newPassword: 'Jańa parol',
  confirmPassword: 'Jańa paroldi tákirarlań',
  submit: 'Saqlaw',
  saving: 'Saqlanbaqta…',
  mismatch: 'Parollar sáykes kelmedi.',
  serverError: 'Paroldi ózgertiw múmkin bolmadı. Házirgi paroldi tekserip qaytadan urınıń.',
  requirements: 'Parol talapları:',
  ruleLength: 'keminde 8 belgi',
  ruleUppercase: 'bas hárip',
  ruleLowercase: 'kishi hárip',
  ruleDigit: 'san',
  ruleSpecial: 'arnawlı belgi',
  logout: 'Chiqish',
};

export const LABELS: Record<string, ProfileLabels> = { uz_latn, uz_cyrl, ru, kaa, en };
export type ProfileLabels = typeof uz_latn;

