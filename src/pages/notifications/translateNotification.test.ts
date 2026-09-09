import { describe, expect, it } from 'vitest';
import { translateNotification, translateNotificationSubject } from './translateNotification';

describe('translateNotification', () => {
  describe('Application approved', () => {
    const raw = "Ariza RX-2026-000010 ma'qullandi.";
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe("Ariza RX-2026-000010 ma'qullandi.");
    });
    it('translates to uz_cyrl', () => {
      expect(translateNotification(raw, 'uz_cyrl')).toBe('Ариза RX-2026-000010 маъқулланди.');
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe('Заявка RX-2026-000010 одобрена.');
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe('Application RX-2026-000010 approved.');
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe('Arza RX-2026-000010 maqullandı.');
    });
  });

  describe('Payment billed / announced', () => {
    const raw = "RX-2026-000010 arizasi bo'yicha 924000.00 so'm to'lov e'lon qilindi. Muddat: 2026-09-19.";
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe(
        "RX-2026-000010 arizasi bo'yicha 924000.00 so'm to'lov e'lon qilindi. Muddat: 2026-09-19.",
      );
    });
    it('translates to uz_cyrl', () => {
      expect(translateNotification(raw, 'uz_cyrl')).toBe(
        'RX-2026-000010 аризаси бўйича 924000.00 сўм тўлов эълон қилинди. Муддат: 2026-09-19.',
      );
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe(
        'По заявке RX-2026-000010 выставлен счет на оплату 924000.00 сум. Срок: 2026-09-19.',
      );
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe(
        'Payment of 924000.00 UZS billed for application RX-2026-000010. Deadline: 2026-09-19.',
      );
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe(
        'RX-2026-000010 arzası boyınsha 924000.00 sum tólem daǵaza etildi. Múddeti: 2026-09-19.',
      );
    });
  });

  describe('Application accepted, track in cabinet', () => {
    const raw = 'Ariza RX-2026-000010 qabul qilindi. Holatini shaxsiy kabinetda kuzating.';
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe(
        'Ariza RX-2026-000010 qabul qilindi. Holatini shaxsiy kabinetda kuzating.',
      );
    });
    it('translates to uz_cyrl', () => {
      expect(translateNotification(raw, 'uz_cyrl')).toBe(
        'Ариза RX-2026-000010 қабул қилинди. Ҳолатини шахсий кабинетда кузатинг.',
      );
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe(
        'Заявка RX-2026-000010 принята. Следите за статусом в личном кабинете.',
      );
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe(
        'Application RX-2026-000010 accepted. Track status in personal cabinet.',
      );
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe(
        'Arza RX-2026-000010 qabıllandı. Jaǵdayın jeke kabinetten baqlap barıń.',
      );
    });
  });

  describe('Permit cancelled + accounting refund', () => {
    const raw =
      'Рухсатнома А № 000003 бекор қилинди. Тўлов бўйича қайтарим учун бухгалтерияга мурожаат қилишингиз мумкин.';
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe(
        "Ruxsatnoma А № 000003 bekor qilindi. To'lov bo'yicha qaytarim uchun buxgalteriyaga murojaat qilishingiz mumkin.",
      );
    });
    it('translates to uz_cyrl', () => {
      expect(translateNotification(raw, 'uz_cyrl')).toBe(
        'Рухсатнома А № 000003 бекор қилинди. Тўлов бўйича қайтарим учун бухгалтерияга мурожаат қилишингиз мумкин.',
      );
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe(
        'Разрешение А № 000003 аннулировано. Для возврата оплаты вы можете обратиться в бухгалтерию.',
      );
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe(
        'Permit А № 000003 cancelled. For payment refund you may contact the accounting department.',
      );
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe(
        'Ruxsatnama А № 000003 biykarlap taslandı. Tólem boyınsha qaytarıw ushın buxgalteriyaǵa múrájat etiwińiz múmkin.',
      );
    });
  });

  describe('Permit reinstated', () => {
    const raw = 'Рухсатнома А № 000003 қайта тикланди.';
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe('Ruxsatnoma А № 000003 qayta tiklandi.');
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe('Разрешение А № 000003 восстановлено.');
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe('Permit А № 000003 reinstated.');
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe('Ruxsatnama А № 000003 qayta tiklendi.');
    });
  });

  describe('Permit suspended', () => {
    const raw = 'Рухсатнома А № 000003 вақтинча тўхтатилди.';
    it('translates to uz_latn', () => {
      expect(translateNotification(raw, 'uz_latn')).toBe("Ruxsatnoma А № 000003 vaqtincha to'xtatildi.");
    });
    it('translates to ru', () => {
      expect(translateNotification(raw, 'ru')).toBe('Разрешение А № 000003 временно приостановлено.');
    });
    it('translates to en', () => {
      expect(translateNotification(raw, 'en')).toBe('Permit А № 000003 suspended temporarily.');
    });
    it('translates to kaa', () => {
      expect(translateNotification(raw, 'kaa')).toBe('Ruxsatnama А № 000003 waqıtsha toqtatıldı.');
    });
  });

  describe('Generic notifications', () => {
    it('handles Arizangiz qabul qilindi', () => {
      expect(translateNotification('Arizangiz qabul qilindi', 'en')).toBe('Your application accepted');
      expect(translateNotification('Arizangiz qabul qilindi', 'ru')).toBe('Ваша заявка принята');
      expect(translateNotification('Arizangiz qabul qilindi', 'uz_latn')).toBe('Arizangiz qabul qilindi');
    });

    it('handles Toʻlov qabul qilindi', () => {
      expect(translateNotification('Toʻlov qabul qilindi', 'en')).toBe('Payment received');
      expect(translateNotification('Toʻlov qabul qilindi', 'ru')).toBe('Оплата принята');
    });
  });

  describe('translateNotificationSubject', () => {
    it('translates known subject terms', () => {
      expect(translateNotificationSubject('Ariza beruvchi', 'en')).toBe('Applicant');
      expect(translateNotificationSubject('Ariza beruvchi', 'ru')).toBe('Заявитель');
    });

    it('translates notification status subjects across all 5 languages', () => {
      expect(translateNotificationSubject('Ariza maʼqullandi', 'en')).toBe('Application approved');
      expect(translateNotificationSubject('Ariza maʼqullandi', 'ru')).toBe('Заявка одобрена');
      expect(translateNotificationSubject('Ariza maʼqullandi', 'uz_cyrl')).toBe('Ариза маъқулланди');
      expect(translateNotificationSubject('Ariza maʼqullandi', 'kaa')).toBe('Arza maqullandı');

      expect(translateNotificationSubject('Toʻlov eʼlon qilindi', 'en')).toBe('Payment billed');
      expect(translateNotificationSubject('Toʻlov eʼlon qilindi', 'ru')).toBe('Выставлен счет на оплату');
      expect(translateNotificationSubject('Toʻlov eʼlon qilindi', 'uz_cyrl')).toBe('Тўлов эълон қилинди');
      expect(translateNotificationSubject('Toʻlov eʼlon qilindi', 'kaa')).toBe('Tólem daǵaza etildi');

      expect(translateNotificationSubject('Ariza qabul qilindi', 'en')).toBe('Application accepted');
      expect(translateNotificationSubject('Ruxsatnoma bekor qilindi', 'en')).toBe('Permit cancelled');
      expect(translateNotificationSubject('Ruxsatnoma rasmiylashtirildi', 'en')).toBe('Permit issued');
    });
  });
});
