/**
 * Screen copy for H1 (users administration) together with H3 (personal
 * grants) and H4 (sessions), local to this folder — the shared `src/i18n/`
 * dictionaries are owned by the shell and edited by every parallel track at
 * once, so a screen built in its own worktree carries its own strings.
 *
 * `ru` is typed against `uz_latn`'s key set, so a key added to one and
 * forgotten in the other is a compile error rather than a Latin string
 * appearing mid-sentence in the Russian UI.
 */

export const uz_latn = {
  pageTitle: 'Foydalanuvchilar',
  pageSubtitle: 'Tizim xodimlari, ularning koʻrish zonasi va huquqlari',
  create: 'Yangi foydalanuvchi',

  // — counters
  statTotal: 'Jami foydalanuvchi',
  statActive: 'Faol',
  statBlocked: 'Bloklangan',
  statSessions: 'Faol seanslar',
  statsFailed: 'Hisoblagichlar yuklanmadi.',

  // — filters
  filterQuery: 'Qidiruv',
  filterQueryPlaceholder: 'Login, F.I.Sh. yoki JSHSHIR',
  filterQueryHint: 'Bitta maydon — login, F.I.Sh. va JSHSHIR boʻyicha qidiradi',
  filterRole: 'Rol',
  filterStatus: 'Holati',
  filterOrganization: 'Tashkilot',
  filterRegion: 'Hudud',
  filterAll: 'Barchasi',
  apply: 'Qoʻllash',
  reset: 'Tiklash',

  // — table
  colFullName: 'F.I.Sh.',
  colLogin: 'Login',
  colRole: 'Rol',
  colOrganization: 'Tashkilot',
  colStatus: 'Holati',
  colActions: 'Amallar',
  openCard: 'Karta',
  loading: 'Yuklanmoqda...',
  empty: 'Filtr boʻyicha foydalanuvchi topilmadi.',
  loadFailed: 'Foydalanuvchilar roʻyxati yuklanmadi.',
  noValue: '—',
  wholeRepublic: 'Butun respublika',

  // — statuses
  statusActive: 'Faol',
  statusBlocked: 'Bloklangan',
  statusDeleted: 'Oʻchirilgan',

  // — card
  cardTitle: 'Foydalanuvchi kartasi',
  cardLoading: 'Karta yuklanmoqda...',
  cardFailed: 'Foydalanuvchi maʼlumotlari yuklanmadi.',
  tabInfo: 'Maʼlumot',
  tabSessions: 'Seanslar',
  tabGrants: 'Shaxsiy huquqlar',
  close: 'Yopish',

  fieldLogin: 'Login',
  fieldFullName: 'F.I.Sh.',
  fieldPinfl: 'JSHSHIR',
  fieldPosition: 'Lavozimi',
  fieldRole: 'Rol',
  fieldOrganization: 'Tashkilot',
  fieldRegion: 'Hudud',
  fieldDistrict: 'Tuman',
  fieldPhone: 'Telefon',
  fieldEmail: 'Elektron pochta',
  fieldStatus: 'Holati',
  fieldCreatedAt: 'Yaratilgan',
  fieldLastLogin: 'Oxirgi kirish',
  mustChangePassword: 'Parolni almashtirishi shart',

  // — actions
  actionEdit: 'Tahrirlash',
  actionBlock: 'Bloklash',
  actionUnblock: 'Blokdan chiqarish',
  actionDelete: 'Oʻchirish',
  actionResetPassword: 'Parolni tiklash',
  actionResetMfa: 'MFA ni tiklash',
  actionsTitle: 'Amallar',

  // — create / edit form
  createTitle: 'Yangi foydalanuvchi',
  createSubtitle: 'Xodim hisobi. Fuqarolar bu yerda yaratilmaydi.',
  editTitle: 'Foydalanuvchini tahrirlash',
  editSubtitle: 'Faqat oʻzgartirilgan maydonlar yuboriladi.',
  formLogin: 'Login',
  formFullName: 'F.I.Sh.',
  formRole: 'Rol',
  formRoleHint: 'Fuqarolar (applicant) OneID yoki E-IMZO orqali roʻyxatdan oʻtadi — bu yerda yaratilmaydi.',
  formPinfl: 'JSHSHIR',
  formPinflHint: '14 ta raqam',
  formPosition: 'Lavozimi',
  formSelect: 'Tanlang',
  save: 'Saqlash',
  cancel: 'Bekor qilish',
  saving: 'Saqlanmoqda...',
  nothingChanged: 'Hech narsa oʻzgartirilmadi.',
  errRequired: 'Toʻldirilishi shart',
  errPinfl: 'JSHSHIR 14 ta raqamdan iborat boʻlishi kerak',
  saveFailed: 'Saqlab boʻlmadi.',

  // — zone
  zoneTitle: 'Koʻrish zonasi',
  zoneWarning:
    'Zona maydonlari foydalanuvchi NIMANI koʻrishini belgilaydi. Boʻsh qoldirish — betaraf holat emas: tashkilot koʻrsatilmasa, foydalanuvchi tanlangan hududdagi BARCHA oʻrmon xoʻjaliklarini koʻradi; uchala maydon ham boʻsh boʻlsa — butun respublika maʼlumotlarini koʻradi.',
  zoneOrganization: 'Tashkilot',
  zoneRegion: 'Hudud',
  zoneDistrict: 'Tuman',
  zoneDistrictHint: 'Avval hudud tanlanadi — tumanlar shu hudud boʻyicha filtrlanadi.',
  zoneDistrictDisabled: 'Avval hududni tanlang',

  // — block dialog
  blockTitle: 'Foydalanuvchini bloklash',
  blockReason: 'Sabab',
  blockReasonHint: 'Sabab audit jurnaliga yoziladi va oʻchirilmaydi.',
  blockReasonRequired: 'Bloklash sababini koʻrsating — usiz amal bajarilmaydi.',
  blockConfirm: 'Bloklash',
  blockFailed: 'Bloklab boʻlmadi.',

  // — confirmations
  confirmUnblockTitle: 'Blokdan chiqarilsinmi?',
  confirmUnblockBody: 'Foydalanuvchi tizimga qayta kira oladi.',
  confirmDeleteTitle: 'Foydalanuvchi oʻchirilsinmi?',
  confirmDeleteBody:
    'Yozuv saqlanadi, holati «Oʻchirilgan» boʻladi va foydalanuvchi tizimga kira olmaydi.',
  confirmResetPasswordTitle: 'Parol tiklansinmi?',
  confirmResetPasswordBody:
    'Yangi bir martalik parol yaratiladi va faqat bir marta koʻrsatiladi. Eski parol darhol ishlamay qoladi.',
  confirmResetMfaTitle: 'MFA tiklansinmi?',
  confirmResetMfaBody:
    'Yangi TOTP havolasi yaratiladi va faqat bir marta koʻrsatiladi. Eski autentifikator ishlamay qoladi.',
  confirm: 'Tasdiqlash',
  actionFailed: 'Amalni bajarib boʻlmadi.',

  // — one-time secret
  secretTitle: 'Bu maʼlumot faqat BIR MARTA koʻrsatiladi',
  secretIntro:
    'Server bu qiymatlarni boshqa hech qachon koʻrsatmaydi. Hozir nusxa oling va foydalanuvchiga xavfsiz yoʻl bilan yetkazing. Yoʻqotilsa — yagona chora qayta tiklash.',
  secretPassword: 'Bir martalik parol',
  secretPasswordHint: 'Foydalanuvchi birinchi kirishda uni almashtirishi shart.',
  secretTotp: 'TOTP havolasi (autentifikator uchun)',
  secretTotpHint:
    'Havolani autentifikator ilovasiga qoʻlda kiriting yoki nusxalab yuboring — QR kod bu yerda chizilmaydi.',
  copy: 'Nusxalash',
  copied: 'Nusxalandi',
  copyFailed: 'Nusxalab boʻlmadi — matnni qoʻlda belgilang.',
  secretAck: 'Saqlab oldim',
  secretAckHint: 'Panel faqat shu tugma bosilganda yopiladi.',

  // — sessions (H4)
  sessionsTitle: 'Faol seanslar',
  sessionsHint: 'Har bir qator — bitta qurilmadagi ochiq seans.',
  sessionCreated: 'Boshlangan',
  sessionLastSeen: 'Oxirgi faollik',
  sessionExpires: 'Amal qilish muddati',
  sessionIp: 'IP',
  sessionDevice: 'Qurilma',
  sessionRevoke: 'Tugatish',
  sessionRevokeAll: 'Barcha seanslarni tugatish',
  sessionsEmpty: 'Ochiq seans yoʻq.',
  sessionsFailed: 'Seanslar yuklanmadi.',
  sessionsRevoked: 'Seans tugatildi.',
  sessionsRevokeFailed: 'Seansni tugatib boʻlmadi.',

  // — personal grants (H3)
  grantsTitle: 'Shaxsiy huquqlar',
  grantsNotice:
    'Bu roʻyxat — ROL huquqlariga QOʻSHIMCHA ravishda berilgan huquqlar. Bu foydalanuvchining toʻliq huquqlari emas: rol bergan huquqlar bu yerda belgilanmaydi va bu yerdan olib tashlanmaydi.',
  grantsRoleHint: 'Rol huquqlari «Rollar» ekranida boshqariladi.',
  grantsSave: 'Huquqlarni saqlash',
  grantsSaved: 'Shaxsiy huquqlar saqlandi.',
  grantsFailed: 'Huquqlar yuklanmadi.',
  grantsSaveFailed: 'Huquqlarni saqlab boʻlmadi.',
  grantsEmpty: 'Huquqlar roʻyxati boʻsh.',
  grantsSelected: 'Belgilangan',
} as const;

export const ru: Record<keyof typeof uz_latn, string> = {
  pageTitle: 'Пользователи',
  pageSubtitle: 'Сотрудники системы, их зона видимости и права',
  create: 'Новый пользователь',

  statTotal: 'Всего пользователей',
  statActive: 'Активные',
  statBlocked: 'Заблокированные',
  statSessions: 'Активные сессии',
  statsFailed: 'Счётчики не загрузились.',

  filterQuery: 'Поиск',
  filterQueryPlaceholder: 'Логин, Ф.И.О. или ПИНФЛ',
  filterQueryHint: 'Одно поле — ищет по логину, Ф.И.О. и ПИНФЛ',
  filterRole: 'Роль',
  filterStatus: 'Статус',
  filterOrganization: 'Организация',
  filterRegion: 'Регион',
  filterAll: 'Все',
  apply: 'Применить',
  reset: 'Сбросить',

  colFullName: 'Ф.И.О.',
  colLogin: 'Логин',
  colRole: 'Роль',
  colOrganization: 'Организация',
  colStatus: 'Статус',
  colActions: 'Действия',
  openCard: 'Карточка',
  loading: 'Загрузка...',
  empty: 'По фильтру пользователи не найдены.',
  loadFailed: 'Список пользователей не загрузился.',
  noValue: '—',
  wholeRepublic: 'Вся республика',

  statusActive: 'Активен',
  statusBlocked: 'Заблокирован',
  statusDeleted: 'Удалён',

  cardTitle: 'Карточка пользователя',
  cardLoading: 'Карточка загружается...',
  cardFailed: 'Данные пользователя не загрузились.',
  tabInfo: 'Данные',
  tabSessions: 'Сессии',
  tabGrants: 'Личные права',
  close: 'Закрыть',

  fieldLogin: 'Логин',
  fieldFullName: 'Ф.И.О.',
  fieldPinfl: 'ПИНФЛ',
  fieldPosition: 'Должность',
  fieldRole: 'Роль',
  fieldOrganization: 'Организация',
  fieldRegion: 'Регион',
  fieldDistrict: 'Район',
  fieldPhone: 'Телефон',
  fieldEmail: 'Электронная почта',
  fieldStatus: 'Статус',
  fieldCreatedAt: 'Создан',
  fieldLastLogin: 'Последний вход',
  mustChangePassword: 'Обязан сменить пароль',

  actionEdit: 'Редактировать',
  actionBlock: 'Заблокировать',
  actionUnblock: 'Разблокировать',
  actionDelete: 'Удалить',
  actionResetPassword: 'Сбросить пароль',
  actionResetMfa: 'Сбросить MFA',
  actionsTitle: 'Действия',

  createTitle: 'Новый пользователь',
  createSubtitle: 'Учётная запись сотрудника. Граждане здесь не создаются.',
  editTitle: 'Редактирование пользователя',
  editSubtitle: 'Отправляются только изменённые поля.',
  formLogin: 'Логин',
  formFullName: 'Ф.И.О.',
  formRole: 'Роль',
  formRoleHint:
    'Граждане (applicant) регистрируются через OneID или E-IMZO — здесь они не создаются.',
  formPinfl: 'ПИНФЛ',
  formPinflHint: '14 цифр',
  formPosition: 'Должность',
  formSelect: 'Выберите',
  save: 'Сохранить',
  cancel: 'Отмена',
  saving: 'Сохранение...',
  nothingChanged: 'Ничего не изменено.',
  errRequired: 'Обязательное поле',
  errPinfl: 'ПИНФЛ состоит из 14 цифр',
  saveFailed: 'Не удалось сохранить.',

  zoneTitle: 'Зона видимости',
  zoneWarning:
    'Поля зоны определяют, ЧТО пользователь видит. Пустое значение — не нейтральный вариант: без организации пользователь видит ВСЕ лесхозы выбранного региона, а если пусты все три поля — данные всей республики.',
  zoneOrganization: 'Организация',
  zoneRegion: 'Регион',
  zoneDistrict: 'Район',
  zoneDistrictHint: 'Сначала выбирается регион — районы фильтруются по нему.',
  zoneDistrictDisabled: 'Сначала выберите регион',

  blockTitle: 'Блокировка пользователя',
  blockReason: 'Причина',
  blockReasonHint: 'Причина попадает в журнал аудита и не удаляется.',
  blockReasonRequired: 'Укажите причину блокировки — без неё действие не выполняется.',
  blockConfirm: 'Заблокировать',
  blockFailed: 'Не удалось заблокировать.',

  confirmUnblockTitle: 'Разблокировать?',
  confirmUnblockBody: 'Пользователь снова сможет войти в систему.',
  confirmDeleteTitle: 'Удалить пользователя?',
  confirmDeleteBody:
    'Запись сохраняется, статус становится «Удалён», вход в систему закрывается.',
  confirmResetPasswordTitle: 'Сбросить пароль?',
  confirmResetPasswordBody:
    'Будет создан новый одноразовый пароль и показан только один раз. Старый пароль перестанет работать сразу.',
  confirmResetMfaTitle: 'Сбросить MFA?',
  confirmResetMfaBody:
    'Будет создана новая TOTP-ссылка и показана только один раз. Старый аутентификатор перестанет работать.',
  confirm: 'Подтвердить',
  actionFailed: 'Не удалось выполнить действие.',

  secretTitle: 'Эти данные показываются ТОЛЬКО ОДИН РАЗ',
  secretIntro:
    'Сервер больше никогда их не покажет. Скопируйте сейчас и передайте пользователю безопасным способом. Если потеряете — останется только повторный сброс.',
  secretPassword: 'Одноразовый пароль',
  secretPasswordHint: 'При первом входе пользователь обязан его сменить.',
  secretTotp: 'TOTP-ссылка (для аутентификатора)',
  secretTotpHint:
    'Введите ссылку в приложение-аутентификатор вручную или скопируйте её — QR-код здесь не рисуется.',
  copy: 'Копировать',
  copied: 'Скопировано',
  copyFailed: 'Не удалось скопировать — выделите текст вручную.',
  secretAck: 'Я сохранил(а) эти данные',
  secretAckHint: 'Панель закрывается только по этой кнопке.',

  sessionsTitle: 'Активные сессии',
  sessionsHint: 'Каждая строка — открытая сессия на одном устройстве.',
  sessionCreated: 'Начата',
  sessionLastSeen: 'Последняя активность',
  sessionExpires: 'Действует до',
  sessionIp: 'IP',
  sessionDevice: 'Устройство',
  sessionRevoke: 'Завершить',
  sessionRevokeAll: 'Завершить все сессии',
  sessionsEmpty: 'Открытых сессий нет.',
  sessionsFailed: 'Сессии не загрузились.',
  sessionsRevoked: 'Сессия завершена.',
  sessionsRevokeFailed: 'Не удалось завершить сессию.',

  grantsTitle: 'Личные права',
  grantsNotice:
    'Этот список — права, выданные ДОПОЛНИТЕЛЬНО к правам РОЛИ. Это не полный набор прав пользователя: права от роли здесь не отмечаются и отсюда не снимаются.',
  grantsRoleHint: 'Права роли настраиваются на экране «Роли».',
  grantsSave: 'Сохранить права',
  grantsSaved: 'Личные права сохранены.',
  grantsFailed: 'Права не загрузились.',
  grantsSaveFailed: 'Не удалось сохранить права.',
  grantsEmpty: 'Список прав пуст.',
  grantsSelected: 'Отмечено',
};

export type UsersLabels = typeof uz_latn;

export function labelsFor(lang: 'uz_latn' | 'ru'): Record<keyof typeof uz_latn, string> {
  return lang === 'ru' ? ru : uz_latn;
}
