/**
 * Uzbek (Cyrillic) copy for the six E-IMZO messages `src/lib/eimzo/errors.ts`
 * names (task 11; decision #90 — `uz_latn` is the required language,
 * `uz_cyrl` optional).
 *
 * Deliberately NOT a full `uz_latn.ts`/`ru.ts`-shaped dictionary, and NOT
 * wired into `UiLanguage`/`DICTIONARIES` (`src/i18n/context.ts`): that type
 * is `'uz_latn' | 'ru'` today, `resolveLanguage()` folds `uz_cyrl` onto
 * `uz_latn`, and there is no third real dictionary anywhere in this
 * codebase yet — `TranslationKey = keyof typeof uz_latn` alone spans 1700+
 * keys covering the whole app, none of them translated to Cyrillic. Turning
 * `uz_cyrl` into a genuine fourth `UiLanguage` (a full mirror of `ru.ts`,
 * changes to the switcher, `LANGUAGE_MAP`, every other screen) is real work
 * this stage did not ask for and a signing bug-fix task should not smuggle
 * in. This file exists so the six E-IMZO strings are still written, tested,
 * and ready — `client.ts`'s own consumers never read this file today (the
 * app's `t()` only ever resolves `'uz_latn' | 'ru'`), but the day `uz_cyrl`
 * becomes a first-class `UiLanguage`, these are the values to fold in.
 *
 * Keys mirror `EIMZO_ERROR_MESSAGE_KEYS` in `src/lib/eimzo/errors.ts`
 * exactly (duplicated as string literals, not imported, to avoid a
 * dependency from `src/i18n/` back into `src/lib/eimzo/` for six strings) —
 * `errors.test.ts` asserts the two lists match.
 */
export const uz_cyrl_eimzo_errors: Record<string, string> = {
  'eimzo.errors.notInstalled':
    'E-IMZO дастури топилмаган ёки ишга туширилмаган. Дастурни ўрнатинг ёки ишга туширинг: e-imzo.uz',
  'eimzo.errors.outdatedVersion': 'Ўрнатилган E-IMZO версияси эскирган. Уни янгиланг: e-imzo.uz',
  'eimzo.errors.chromeBlocked':
    'Браузерингиз (Chrome 147 ва ундан кейинги версиялар) E-IMZO уланишини текширмоқда — чиққан сўровда «Рухсат бериш»ни танланг. Сўров чиқмаса, манзил қаторига киритинг: chrome://flags/#local-network-access-check ва уни «Disabled» ҳолатига ўтказинг.',
  'eimzo.errors.wrongPassword': "Калит пароли нотўғри киритилди. Қайтадан уриниб кўринг.",
  'eimzo.errors.providerUnreachable':
    'Бу бизнинг хизматимиздаги хато эмас — E-IMZO провайдери ёки унинг VPN алоқаси вақтинча ишламаяпти. Бироздан сўнг қайта уринг.',
  'eimzo.errors.unknown': 'E-IMZO орқали амални бажаришда кутилмаган хатолик юз берди. Қайтадан уриниб кўринг.',
};
