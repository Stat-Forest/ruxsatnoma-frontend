/**
 * Uzbek (Latin) UI copy (ruling R14). Chosen as the Uzbek map over `uz_cyrl`
 * because the design reference's own UI copy is Latin-script Uzbek, so ported
 * screens stay coherent. A later stage adds `uz_cyrl.ts` and one row in
 * `resolveLanguage` (src/i18n/index.tsx) — nothing else changes shape.
 */
export const uz_latn = {
  'nav.dashboard': 'Bosh sahifa',
  'nav.myApplications': 'Mening arizalarim',
  'nav.myPermits': 'Mening ruxsatnomalarim',
  'nav.applications': 'Arizalar',
  'nav.gis': 'GIS xaritasi',
  'nav.norms': "Me'yorlar",
  'nav.invoices': 'Hisob-fakturalar',
  'nav.permits': 'Ruxsatnomalar',
  'nav.users': 'Foydalanuvchilar',
  'nav.notifications': 'Bildirishnomalar',
  'nav.profile': 'Profil',
  'shell.openMenu': 'Menyu',
  'shell.closeMenu': 'Yopish',
  'shell.refresh': 'Yangilash',
  'shell.logout': 'Chiqish',
  'login.title': 'Tizimga kirish',
  'login.loginLabel': 'Login',
  'login.passwordLabel': 'Parol',
  'login.codeLabel': 'Tasdiqlash kodi',
  'login.codeHelp': 'Autentifikator ilovasidagi 6 xonali kod',
  'login.submitPassword': 'Kirish',
  'login.submitCode': 'Tasdiqlash',
  'login.badCredentials': "Login yoki parol noto'g'ri.",
  'login.blockedAccount': "Hisob bloklangan. Administrator bilan bog'laning.",
  'login.rateLimited': "Urinishlar soni ko'p. Birozdan so'ng qayta urinib ko'ring.",
  'login.connectionError': "Ulanishda xatolik yuz berdi. Internetni tekshirib, qayta urinib ko'ring.",
};
