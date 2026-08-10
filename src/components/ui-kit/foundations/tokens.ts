// Design System Foundations Tokens
// Complete specifications matching design/design-system.md, design/ui-kit/tokens.css & design/ui-kit/foundations/*.html

export const COLOR_TOKENS = {
  primary: {
    50: '#F0F7F1',
    100: '#D9EBDC',
    300: '#7FB98A',
    600: '#2E7D4F', // Brand Primary Forest Green
    700: '#23653F',
    900: '#123522',
  },
  accent: {
    600: '#B45309',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8F9FA',
    200: '#E4E7EA', // Decorative dividers only
    400: '#9AA3AB',
    500: '#767F87', // 3:1 WCAG 1.4.11 Control Border requirement
    600: '#5A646D',
    900: '#1A1F24',
  },
  semantic: {
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    dangerHover: '#991B1B',
    info: '#0369A1',
  },
};

export const SPACING_TOKENS = [
  { token: '--space-1', value: '4px', usage: 'Minimal ichki ajratish (gap, micro-padding)' },
  { token: '--space-2', value: '8px', usage: 'Tugma va nishon ichidagi ikonkalar orasidagi masofa' },
  { token: '--space-3', value: '12px', usage: 'Kichik kartalar va maydonlar atrofi' },
  { token: '--space-4', value: '16px', usage: 'Standart padding va form maydonlari orasidagi masofa' },
  { token: '--space-6', value: '24px', usage: 'Katta konteynerlar va boʻlimlar ichidagi padding' },
  { token: '--space-8', value: '32px', usage: 'Sahifa boʻlimlari orasidagi masofa' },
  { token: '--space-12', value: '48px', usage: 'Katta modallar va sahifa sarlavhalari marjini' },
  { token: '--space-16', value: '64px', usage: 'Asosiy kontent pastki qismi paddingi' },
];

export const TYPOGRAPHY_TOKENS = [
  { level: 'xs', size: '12px', line: '16px', weight: '400 / 500', usage: 'Yordamchi matnlar, teglar, mikro-izohlar' },
  { level: 'sm', size: '14px', line: '20px', weight: '400 / 600', usage: 'Asosiy jadval matni, tugma yozuvlari, inputlar' },
  { level: 'base', size: '16px', line: '24px', weight: '400', usage: 'Hujjat matni va standart xabarlar' },
  { level: 'lg', size: '18px', line: '28px', weight: '600', usage: 'Kichik sarlavhalar va modal titullari' },
  { level: 'xl', size: '22px', line: '30px', weight: '600', usage: 'Karta va boʻlim sarlavhalari' },
  { level: '2xl', size: '28px', line: '36px', weight: '600', usage: 'Asosiy sahifa sarlavhasi (H1)' },
  { level: '3xl', size: '36px', line: '44px', weight: '600', usage: 'Yirik statistik raqamlar va bannerlar' },
];

export const FONT_WEIGHT_TOKENS = [
  { weight: 400, name: '--weight-regular', usage: 'Asosiy matnlar, xabarlar, maʼlumotlar' },
  { weight: 500, name: '--weight-medium', usage: 'Label, belgilangan matnlar, monospaced kodlar' },
  { weight: 600, name: '--weight-semibold', usage: 'Sarlavhalar, tugma yozuvlari, faol tablar' },
];

export const LAYOUT_SIZES = [
  { token: '--control-height', value: '40px', usage: 'Desktop maydonlar va tugmalar balandligi' },
  { token: '--control-height-touch', value: '48px', usage: 'Mobil va sensorli rejim balandligi' },
  { token: '--touch-target', value: '44px', usage: 'WCAG 2.5.8 minimal bosing maydoni' },
  { token: '--header-height', value: '64px', usage: 'Yuqori navigatsiya paneli balandligi' },
  { token: '--sidebar-width', value: '260px', usage: 'Yon menyu paneli kengligi' },
  { token: '--content-max', value: '1440px', usage: 'Maketning maksimal kengligi' },
];

export const RADIUS_TOKENS = [
  { token: '--radius-sm', value: '4px', usage: 'Mikro-elementlar, teglar, fokus halqalari' },
  { token: '--radius-md', value: '8px', usage: 'Tugmalar, inputlar, kichik bloklar' },
  { token: '--radius-lg', value: '12px', usage: 'Katta kartalar, jadval konteynerlari, modallar' },
];

export const SUPPORTED_LANGUAGES = [
  { code: 'uz-Cyrl', name: 'Oʻzbekcha (Kirill)', sample: 'Ўрмон хўжалиги давлат қўмитаси — Рухсатнома' },
  { code: 'uz-Latn', name: 'Oʻzbekcha (Lotin)', sample: 'Oʻrmon xoʻjaligi davlat qoʻmitasi — Ruxsatnoma' },
  { code: 'kaa-Cyrl', name: 'Qoraqalpoqsha', sample: 'Togʻ hám toǵay xojalıǵı mámleketlik komiteti' },
  { code: 'ru', name: 'Русский', sample: 'Государственный комитет лесного хозяйства' },
  { code: 'en', name: 'English', sample: 'State Forestry Committee Permit System' },
];

export const WCAG_CONTRAST_MATRIX = [
  { pair: 'neutral-900 / neutral-0', ratio: '16.6 : 1', status: 'AAA', usage: 'Oq fonda asosiy matn' },
  { pair: 'neutral-600 / neutral-0', ratio: '6.0 : 1', status: 'AA', usage: 'Oq fonda yordamchi matn' },
  { pair: 'neutral-0 / primary-600', ratio: '5.0 : 1', status: 'AA', usage: 'Yashil tugmada oq matn' },
  { pair: 'neutral-0 / danger-600', ratio: '6.5 : 1', status: 'AA', usage: 'Qizil tugmada oq matn' },
  { pair: 'primary-900 / primary-50', ratio: '12.4 : 1', status: 'AAA', usage: 'Ochiq yashil blokda toʻq yashil matn' },
  { pair: 'neutral-500 / neutral-0', ratio: '4.07 : 1', status: 'AA', usage: 'Inputlar atrofi border (WCAG 1.4.11)' },
];
