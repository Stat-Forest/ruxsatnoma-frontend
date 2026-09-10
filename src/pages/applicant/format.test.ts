import { describe, expect, it } from 'vitest';
import { formatUnit, pickName } from './format';
import { DICTIONARIES, type UiLanguage } from '../../i18n/context';

describe('applicant format helpers', () => {
  describe('pickName with 5 languages', () => {
    const activityGrazing = {
      uz_latn: 'Chorva mollarini boqish',
    };
    const activityApiary = {
      uz_latn: 'Asalarichilik',
    };
    const activityScience = {
      uz_latn: 'Ilmiy tadqiqot',
    };
    const activityRecreation = {
      uz_latn: 'Dam olish va turizm',
    };
    const activityDeadwood = {
      uz_latn: 'Quruq shox-shabba yigʻish',
    };
    const activityHaymaking = {
      uz_latn: 'Pichan tayyorlash',
    };

    it('translates Chorva mollarini boqish to all 5 languages', () => {
      expect(pickName(activityGrazing, 'uz_latn')).toBe('Chorva mollarini boqish');
      expect(pickName(activityGrazing, 'uz_cyrl')).toBe('Чорва молларини боқиш');
      expect(pickName(activityGrazing, 'ru')).toBe('Выпас скота');
      expect(pickName(activityGrazing, 'en')).toBe('Livestock grazing');
      expect(pickName(activityGrazing, 'kaa')).toBe('Sharwa malların baǵıw');
    });

    it('translates Asalarichilik to all 5 languages', () => {
      expect(pickName(activityApiary, 'uz_latn')).toBe('Asalarichilik');
      expect(pickName(activityApiary, 'uz_cyrl')).toBe('Асаларичилик');
      expect(pickName(activityApiary, 'ru')).toBe('Пчеловодство');
      expect(pickName(activityApiary, 'en')).toBe('Beekeeping');
      expect(pickName(activityApiary, 'kaa')).toBe('Palhárreshilik');
    });

    it('translates Ilmiy tadqiqot to all 5 languages', () => {
      expect(pickName(activityScience, 'uz_latn')).toBe('Ilmiy tadqiqot');
      expect(pickName(activityScience, 'uz_cyrl')).toBe('Илмий тадқиқот');
      expect(pickName(activityScience, 'ru')).toBe('Научные исследования');
      expect(pickName(activityScience, 'en')).toBe('Scientific research');
      expect(pickName(activityScience, 'kaa')).toBe('Ilimiy izertlew');
    });

    it('translates Dam olish va turizm to all 5 languages', () => {
      expect(pickName(activityRecreation, 'uz_latn')).toBe('Dam olish va turizm');
      expect(pickName(activityRecreation, 'uz_cyrl')).toBe('Дам олиш ва туризм');
      expect(pickName(activityRecreation, 'ru')).toBe('Отдых и туризм');
      expect(pickName(activityRecreation, 'en')).toBe('Recreation and tourism');
      expect(pickName(activityRecreation, 'kaa')).toBe('Dem alıw hám turizm');
    });

    it('translates Quruq shox-shabba yigʻish to all 5 languages', () => {
      expect(pickName(activityDeadwood, 'uz_latn')).toBe('Quruq shox-shabba yigʻish');
      expect(pickName(activityDeadwood, 'uz_cyrl')).toBe('Қуруқ шох-шабба йиғиш');
      expect(pickName(activityDeadwood, 'ru')).toBe('Сбор сухостоя и хвороста');
      expect(pickName(activityDeadwood, 'en')).toBe('Gathering dry brushwood');
      expect(pickName(activityDeadwood, 'kaa')).toBe('Qurǵaq shaq-shabba jıynaw');
    });

    it('translates Pichan tayyorlash to all 5 languages', () => {
      expect(pickName(activityHaymaking, 'uz_latn')).toBe('Pichan tayyorlash');
      expect(pickName(activityHaymaking, 'uz_cyrl')).toBe('Пичан тайёрлаш');
      expect(pickName(activityHaymaking, 'ru')).toBe('Заготовка сена');
      expect(pickName(activityHaymaking, 'en')).toBe('Haymaking');
      expect(pickName(activityHaymaking, 'kaa')).toBe('Pishan tayarlaw');
    });

    it('handles dash variations in Quruq shox–shabba yigʻish', () => {
      const enDashName = { uz_latn: 'Quruq shox–shabba yigʻish' };
      expect(pickName(enDashName, 'en')).toBe('Gathering dry brushwood');
      expect(pickName(enDashName, 'ru')).toBe('Сбор сухостоя и хвороста');
    });
  });

  describe('formatUnit with 5 languages', () => {
    const makeT = (lang: UiLanguage) => {
      const dict = DICTIONARIES[lang];
      return (k: string) => dict[k as keyof typeof dict] ?? k;
    };

    it('translates quantity units across all 5 languages', () => {
      // head
      expect(formatUnit('head', makeT('uz_latn'), 'uz_latn')).toBe('bosh');
      expect(formatUnit('head', makeT('uz_cyrl'), 'uz_cyrl')).toBe('бош');
      expect(formatUnit('head', makeT('ru'), 'ru')).toBe('голова');
      expect(formatUnit('head', makeT('en'), 'en')).toBe('head');
      expect(formatUnit('head', makeT('kaa'), 'kaa')).toBe('bas');

      // hive
      expect(formatUnit('hive', makeT('uz_latn'), 'uz_latn')).toBe('ari uyasi');
      expect(formatUnit('hive', makeT('uz_cyrl'), 'uz_cyrl')).toBe('ари уяси');
      expect(formatUnit('hive', makeT('ru'), 'ru')).toBe('улей');
      expect(formatUnit('hive', makeT('en'), 'en')).toBe('hive');
      expect(formatUnit('hive', makeT('kaa'), 'kaa')).toBe('pal hárresi uyası');

      // person_day
      expect(formatUnit('person_day', makeT('uz_latn'), 'uz_latn')).toBe('kishi-kun');
      expect(formatUnit('person_day', makeT('uz_cyrl'), 'uz_cyrl')).toBe('киши-кун');
      expect(formatUnit('person_day', makeT('ru'), 'ru')).toBe('человеко-день');
      expect(formatUnit('person_day', makeT('en'), 'en')).toBe('person-day');
      expect(formatUnit('person_day', makeT('kaa'), 'kaa')).toBe('adam-kún');

      // ha
      expect(formatUnit('ha', makeT('uz_latn'), 'uz_latn')).toBe('ga');
      expect(formatUnit('ha', makeT('uz_cyrl'), 'uz_cyrl')).toBe('га');
      expect(formatUnit('ha', makeT('ru'), 'ru')).toBe('га');
      expect(formatUnit('ha', makeT('en'), 'en')).toBe('ha');
      expect(formatUnit('ha', makeT('kaa'), 'kaa')).toBe('ga');

      // m3
      expect(formatUnit('m3', makeT('uz_latn'), 'uz_latn')).toBe('m³');
      expect(formatUnit('m3', makeT('ru'), 'ru')).toBe('м³');
      expect(formatUnit('m3', makeT('en'), 'en')).toBe('m³');

      // ton
      expect(formatUnit('ton', makeT('uz_latn'), 'uz_latn')).toBe('tonna');
      expect(formatUnit('ton', makeT('ru'), 'ru')).toBe('тонна');
      expect(formatUnit('ton', makeT('en'), 'en')).toBe('ton');
    });
  });
});
