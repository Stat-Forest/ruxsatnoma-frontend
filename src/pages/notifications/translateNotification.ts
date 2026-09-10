import { translateTerm } from '../../i18n/terms';

export function translateNotification(text: string | null | undefined, lang: string = 'uz_latn'): string {
  if (!text || typeof text !== 'string') return text ?? '';
  const trimmed = text.trim();
  const normalized = trimmed.replace(/[\u2018\u2019\u0060\u00B4\u02BC\u02BB\u02BD\u02B9]/g, "'");

  // 1. Application approved
  // Examples:
  // "Ariza RX-2026-000010 ma'qullandi."
  // "Ариза RX-2026-000010 маъқулланди."
  // "Заявка RX-2026-000010 одобрена."
  // "Application RX-2026-000010 approved."
  // "Arza RX-2026-000010 maqullandı."
  const mApproved = trimmed.match(
    /^(?:Ariza|Ариза|Application|Заявка|Arza)\s+([A-Z0-9_-]+)\s+(?:ma['ʼʻ`]qullandi|маъқулланди|approved|одобрена|maqullandı)\.?$/i,
  );
  if (mApproved) {
    const num = mApproved[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Ариза ${num} маъқулланди.`;
      case 'ru':
        return `Заявка ${num} одобрена.`;
      case 'en':
        return `Application ${num} approved.`;
      case 'kaa':
        return `Arza ${num} maqullandı.`;
      case 'uz_latn':
      default:
        return `Ariza ${num} ma'qullandi.`;
    }
  }

  // 2. Billed / payment announced with deadline
  // Example: "RX-2026-000010 arizasi bo'yicha 924000.00 so'm to'lov e'lon qilindi. Muddat: 2026-09-19."
  // "RX-2026-000010 аризаси бўйича 924000.00 сўм тўлов эълон қилинди. Муддат: 2026-09-19."
  // "По заявке RX-2026-000010 выставлен счет на оплату 924000.00 сум. Срок: 2026-09-19."
  // "Payment of 924000.00 UZS billed for application RX-2026-000010. Deadline: 2026-09-19."
  const mBilled =
    trimmed.match(
      /^([A-Z0-9_-]+)\s+(?:arizasi|аризаси|arzası)\s+(?:bo['ʼʻ`]yicha|бўйича|boyınsha)\s+([0-9.,\s]+)\s+(?:so['ʼʻ`]m|сўм|som|sum|UZS)\s+(?:to['ʼʻ`]lov\s+e['ʼʻ`]lon\s+qilindi|тўлов\s+эълон\s+қилинди|tólem\s+daǵaza\s+etildi)(?:[.,:;]?\s*|\s*)(?:Muddat|Муддат|Múddeti|Deadline|Срок):\s*([0-9.-]+)\.?$/i,
    ) ||
    trimmed.match(
      /^По заявке\s+([A-Z0-9_-]+)\s+выставлен счет(?: на оплату)?\s+([0-9.,\s]+)\s+сум\.(?:[.,:;]?\s*|\s*)Срок:\s*([0-9.-]+)\.?$/i,
    ) ||
    trimmed.match(
      /^Payment of\s+([0-9.,\s]+)\s+UZS billed for application\s+([A-Z0-9_-]+)\.(?:[.,:;]?\s*|\s*)Deadline:\s*([0-9.-]+)\.?$/i,
    );

  if (mBilled) {
    let num: string;
    let amt: string;
    let date: string;
    if (trimmed.startsWith('Payment of')) {
      amt = mBilled[1].trim();
      num = mBilled[2].trim();
      date = mBilled[3].replace(/\.+$/, '');
    } else {
      num = mBilled[1].trim();
      amt = mBilled[2].trim();
      date = mBilled[3].replace(/\.+$/, '');
    }
    switch (lang) {
      case 'uz_cyrl':
        return `${num} аризаси бўйича ${amt} сўм тўлов эълон қилинди. Муддат: ${date}.`;
      case 'ru':
        return `По заявке ${num} выставлен счет на оплату ${amt} сум. Срок: ${date}.`;
      case 'en':
        return `Payment of ${amt} UZS billed for application ${num}. Deadline: ${date}.`;
      case 'kaa':
        return `${num} arzası boyınsha ${amt} sum tólem daǵaza etildi. Múddeti: ${date}.`;
      case 'uz_latn':
      default:
        return `${num} arizasi bo'yicha ${amt} so'm to'lov e'lon qilindi. Muddat: ${date}.`;
    }
  }

  // 3. Application accepted + track in cabinet
  // Example: "Ariza RX-2026-000010 qabul qilindi. Holatini shaxsiy kabinetda kuzating."
  // "Ариза RX-2026-000009 қабул қилинди. Ҳолатини шахсий кабинетда кузатинг."
  const mCabinet = trimmed.match(
    /^(?:Ariza|Ариза|Arza|Заявка|Application)\s+([A-Z0-9_-]+)\s+(?:qabul qilindi|қабул қилинди|qabıllandı|принята|accepted)[.,:;]?(?:\s+)(?:[HhXx]olatini shaxsiy kabinet(?:i)?da kuzating|[ХхҲҳ]олатини шахсий кабинет(?:и)?да кузатинг|Jaǵdayın jeke kabinet(?:i)?n?en baqlap barıń|Следите за статусом в личном кабинете|Track status in personal cabinet)\.?$/i,
  );
  if (mCabinet) {
    const num = mCabinet[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Ариза ${num} қабул қилинди. Ҳолатини шахсий кабинетда кузатинг.`;
      case 'ru':
        return `Заявка ${num} принята. Следите за статусом в личном кабинете.`;
      case 'en':
        return `Application ${num} accepted. Track status in personal cabinet.`;
      case 'kaa':
        return `Arza ${num} qabıllandı. Jaǵdayın jeke kabinetten baqlap barıń.`;
      case 'uz_latn':
      default:
        return `Ariza ${num} qabul qilindi. Holatini shaxsiy kabinetda kuzating.`;
    }
  }

  // 4. Permit cancelled / revoked + accounting contact
  // Example: "Рухсатнома А № 000003 бекор қилинди. Тўлов бўйича қайтарим учун бухгалтерияга мурожаат қилишингиз мумкин."
  // "Ruxsatnoma A № 000003 bekor qilindi. To'lov bo'yicha qaytarim uchun buxgalteriyaga murojaat qilishingiz mumkin."
  const mCancel = trimmed.match(
    /^(?:Рухсатнома|Ruxsatnoma|Ruxsatnama|Разрешение|Permit)\s+([АA]\s*№\s*[0-9]+|[A-Z0-9_-]+)\s+(?:бекор қилинди|bekor qilindi|biykarlap taslandı|аннулировано|cancelled)\.(?:\s+)(?:Тўлов бўйича қайтарим учун бухгалтерияга мурожаат қилишингиз мумкин|To['ʼʻ`]lov bo['ʼʻ`]yicha qaytarim uchun buxgalteriyaga murojaat qilishingiz mumkin|Tólem boyınsha qaytarıw ushın buxgalteriyaǵa múrájat etiwińiz múmkin|Для возврата оплаты вы можете обратиться в бухгалтерию|For payment refund you may contact the accounting department)\.?$/i,
  );
  if (mCancel) {
    const num = mCancel[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Рухсатнома ${num} бекор қилинди. Тўлов бўйича қайтарим учун бухгалтерияга мурожаат қилишингиз мумкин.`;
      case 'ru':
        return `Разрешение ${num} аннулировано. Для возврата оплаты вы можете обратиться в бухгалтерию.`;
      case 'en':
        return `Permit ${num} cancelled. For payment refund you may contact the accounting department.`;
      case 'kaa':
        return `Ruxsatnama ${num} biykarlap taslandı. Tólem boyınsha qaytarıw ushın buxgalteriyaǵa múrájat etiwińiz múmkin.`;
      case 'uz_latn':
      default:
        return `Ruxsatnoma ${num} bekor qilindi. To'lov bo'yicha qaytarim uchun buxgalteriyaga murojaat qilishingiz mumkin.`;
    }
  }

  // 5. Permit reinstated
  // Example: "Рухсатнома А № 000003 қайта тикланди."
  // "Ruxsatnoma A № 000003 qayta tiklandi."
  const mReinstated = trimmed.match(
    /^(?:Рухсатнома|Ruxsatnoma|Ruxsatnama|Разрешение|Permit)\s+([АA]\s*№\s*[0-9]+|[A-Z0-9_-]+)\s+(?:қайта тикланди|qayta tiklandi|qayta tiklendi|восстановлено|reinstated)\.?$/i,
  );
  if (mReinstated) {
    const num = mReinstated[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Рухсатнома ${num} қайта тикланди.`;
      case 'ru':
        return `Разрешение ${num} восстановлено.`;
      case 'en':
        return `Permit ${num} reinstated.`;
      case 'kaa':
        return `Ruxsatnama ${num} qayta tiklendi.`;
      case 'uz_latn':
      default:
        return `Ruxsatnoma ${num} qayta tiklandi.`;
    }
  }

  // 6. Permit suspended
  // Example: "Рухсатнома А № 000003 вақтинча тўхтатилди."
  // "Ruxsatnoma A № 000003 vaqtincha to'xtatildi."
  const mSuspended = trimmed.match(
    /^(?:Рухсатнома|Ruxsatnoma|Ruxsatnama|Разрешение|Permit)\s+([АA]\s*№\s*[0-9]+|[A-Z0-9_-]+)\s+(?:вақтинча тўхтатилди|vaqtincha to['ʼʻ`]xtatildi|waqıtsha toqtatıldı|временно приостановлено|suspended temporarily)\.?$/i,
  );
  if (mSuspended) {
    const num = mSuspended[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Рухсатнома ${num} вақтинча тўхтатилди.`;
      case 'ru':
        return `Разрешение ${num} временно приостановлено.`;
      case 'en':
        return `Permit ${num} suspended temporarily.`;
      case 'kaa':
        return `Ruxsatnama ${num} waqıtsha toqtatıldı.`;
      case 'uz_latn':
      default:
        return `Ruxsatnoma ${num} vaqtincha to'xtatildi.`;
    }
  }

  // 7. Generic application accepted ("Arizangiz qabul qilindi", "Ariza RX-123 qabul qilindi")
  const mAccepted = trimmed.match(
    /^(?:Ariza(?:ngiz)?|Ариза(?:нгиз)?|Arza(?:ńız)?|Ваша заявка|Заявка|Your application|Application)\s*(?:([A-Z0-9_-]+)\s+)?(?:qabul qilindi|қабул қилинди|qabıllandı|принята|accepted)\.?$/i,
  );
  if (mAccepted) {
    const num = mAccepted[1] ? ` ${mAccepted[1]}` : '';
    switch (lang) {
      case 'uz_cyrl':
        return `Аризангиз${num} қабул қилинди`;
      case 'ru':
        return `Ваша заявка${num} принята`;
      case 'en':
        return `Your application${num} accepted`;
      case 'kaa':
        return `Arzańız${num} qabıllandı`;
      case 'uz_latn':
      default:
        return `Arizangiz${num} qabul qilindi`;
    }
  }

  // 8. Payment received
  if (
    /^(?:To['ʼʻ`]lov qabul qilindi|Тўлов қабул қилинди|Tólem qabıllandı|Оплата принята|Payment received)\.?$/i.test(
      trimmed,
    )
  ) {
    switch (lang) {
      case 'uz_cyrl':
        return 'Тўлов қабул қилинди';
      case 'ru':
        return 'Оплата принята';
      case 'en':
        return 'Payment received';
      case 'kaa':
        return 'Tólem qabıllandı';
      case 'uz_latn':
      default:
        return 'Toʻlov qabul qilindi';
    }
  }

  // 9. Application rejected
  const mRejected = trimmed.match(
    /^(?:Ariza|Ариза|Arza|Заявка|Application)\s+([A-Z0-9_-]+)\s+(?:rad etildi|рад этилди|biykar etildi|отклонена|rejected)\.?$/i,
  );
  if (mRejected) {
    const num = mRejected[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Ариза ${num} рад этилди.`;
      case 'ru':
        return `Заявка ${num} отклонена.`;
      case 'en':
        return `Application ${num} rejected.`;
      case 'kaa':
        return `Arza ${num} biykar etildi.`;
      case 'uz_latn':
      default:
        return `Ariza ${num} rad etildi.`;
    }
  }

  // 10. Permit issued
  const mIssued = trimmed.match(
    /^(?:Ruxsatnoma|Рухсатнома|Ruxsatnama|Разрешение|Permit)\s+([АA]\s*№\s*[0-9]+|[A-Z0-9_-]+)\s+(?:rasmiylashtirildi|расмийлаштирилди|rásmiylestirildi|оформлено|issued)\.?$/i,
  );
  if (mIssued) {
    const num = mIssued[1];
    switch (lang) {
      case 'uz_cyrl':
        return `Рухсатнома ${num} расмийлаштирилди.`;
      case 'ru':
        return `Разрешение ${num} оформлено.`;
      case 'en':
        return `Permit ${num} issued.`;
      case 'kaa':
        return `Ruxsatnama ${num} rásmiylestirildi.`;
      case 'uz_latn':
      default:
        return `Ruxsatnoma ${num} rasmiylashtirildi.`;
    }
  }

  // 11. Payment confirmed for application (with optional manual confirmation, amount and permit issuance notice)
  // Examples:
  // "RX-2026-000005 аризаси бўйича 2200000.00 сўм тўлов қўлда тасдиқланди."
  // "RX-2026-000005 аризаси бўйича 2200000.00 сўм тўлов тасдиқланди. Рухсатномани расмийлаштиринг."
  // "RX-2026-000005 arizasi bo'yicha 2200000.00 so'm to'lov qo'lda tasdiqlandi."
  // "RX-2026-000005 arizasi bo'yicha 2200000.00 so'm to'lov tasdiqlandi. Ruxsatnomani rasmiylashtiring."
  // "Ариза RX-2026-000005 бўйича 2200000.00 сўм тўлов тасдиқланди. Рухсатномани расмийлаштиринг."
  // "По заявке RX-2026-000005 подтверждена оплата 2200000.00 сум вручную."
  // "По заявке RX-2026-000005 подтверждена оплата 2200000.00 сум. Оформите разрешение."
  // "Payment of 2200000.00 UZS confirmed manually for application RX-2026-000005."
  // "Payment of 2200000.00 UZS confirmed for application RX-2026-000005. Issue the permit."
  const mConfirmedUz =
    normalized.match(
      /^(?:(?:Ariza|Ариза|Arza)\s+)?([A-Z0-9_-]+)\s*(?:arizasi|аризаси|arzası)?\s*(?:bo['ʼʻ`]yicha|б[ўу]йича|boy[ıi]nsha)\s+(?:([0-9.,\s]+)\s+(?:so['ʼʻ`]m|с[ўу]м|som|sum|UZS)\s+)?(?:(?:to['ʼʻ`]lov|т[ўу]лов|t[oó]lem)\s+)?(?:qo['ʼʻ`]?lda\s+|қ[ўу]лда\s+|qolda\s+|qol\s+menen\s+)?(?:to['ʼʻ`]lov\s+|т[ўу]лов\s+|t[oó]lem\s+)?(?:tasdiqlandi|тасди[қк]ланди|tast[ıi]y[ıi]qland[ıi])(?:\s+(?:qo['ʼʻ`]?lda|қ[ўу]лда|qolda|qol\s+menen))?\.?(?:\s+(?:Ruxsatnomani\s+rasmiylashtiring|Ру[хҳ]сатномани\s+расмийлаштиринг|Ruxsatnaman[ıi]\s+r[aá]smiylestiri[ńn]|Оформите\s+разрешение|Issue\s+the\s+permit)\.?)?$/i,
    ) ||
    trimmed.match(
      /^(?:(?:Ariza|Ариза|Arza)\s+)?([A-Z0-9_-]+)\s*(?:arizasi|аризаси|arzası)?\s*(?:bo['ʼʻ`]yicha|б[ўу]йича|boy[ıi]nsha)\s+(?:([0-9.,\s]+)\s+(?:so['ʼʻ`]m|с[ўу]м|som|sum|UZS)\s+)?(?:(?:to['ʼʻ`]lov|т[ўу]лов|t[oó]lem)\s+)?(?:qo['ʼʻ`]?lda\s+|қ[ўу]лда\s+|qolda\s+|qol\s+menen\s+)?(?:to['ʼʻ`]lov\s+|т[ўу]лов\s+|t[oó]lem\s+)?(?:tasdiqlandi|тасди[қк]ланди|tast[ıi]y[ıi]qland[ıi])(?:\s+(?:qo['ʼʻ`]?lda|қ[ўу]лда|qolda|qol\s+menen))?\.?(?:\s+(?:Ruxsatnomani\s+rasmiylashtiring|Ру[хҳ]сатномани\s+расмийлаштиринг|Ruxsatnaman[ıi]\s+r[aá]smiylestiri[ńn]|Оформите\s+разрешение|Issue\s+the\s+permit)\.?)?$/i,
    );
  const mConfirmedRu =
    normalized.match(
      /^(?:По\s+заявке\s+([A-Z0-9_-]+)\s+(?:(?:вручную\s+)?подтверждена\s+(?:ручная\s+)?оплата|подтверждена\s+оплата(?:\s+вручную)?)|Оплата\s+по\s+заявке\s+([A-Z0-9_-]+)\s+подтверждена(?:\s+вручную)?|Подтверждена\s+(?:ручная\s+)?оплата\s+по\s+заявке\s+([A-Z0-9_-]+)(?:\s+вручную)?)(?: на сумму)?(?:\s+([0-9.,\s]+)\s+сум)?(?:\s+вручную)?\.?(?:\s+(?:Оформите\s+разрешение|Ру[хҳ]сатномани\s+расмийлаштиринг|Ruxsatnomani\s+rasmiylashtiring|Issue\s+the\s+permit)\.?)?$/i,
    );
  const mConfirmedEn =
    normalized.match(
      /^(?:Manual\s+payment|Payment)(?:\s+of\s+([0-9.,\s]+)\s+UZS)?\s+(?:manually\s+confirmed|confirmed(?:\s+manually)?)\s+for\s+application\s+([A-Z0-9_-]+)\.?(?:\s+(?:Issue\s+the\s+permit|Оформите\s+разрешение|Ру[хҳ]сатномани\s+расмийлаштиринг|Ruxsatnomani\s+rasmiylashtiring)\.?)?$/i,
    );

  const mConfirmed = mConfirmedUz || mConfirmedRu || mConfirmedEn;
  if (mConfirmed) {
    let num = '';
    let amt = '';
    if (mConfirmedEn) {
      amt = mConfirmedEn[1]?.trim() || '';
      num = mConfirmedEn[2].trim();
    } else if (mConfirmedRu) {
      num = (mConfirmedRu[1] || mConfirmedRu[2] || mConfirmedRu[3] || '').trim();
      amt = mConfirmedRu[4]?.trim() || '';
    } else if (mConfirmedUz) {
      num = mConfirmedUz[1].trim();
      amt = mConfirmedUz[2]?.trim() || '';
    }
    const hasNotice = /(?:rasmiylashti|расмийлашти|r[aá]smiylesti|разрешени|permit)/i.test(trimmed);
    const isManual = /(?:qo'?lda|қ[ўу]лда|qolda|qol\s+menen|вручную|ручн\w+|manuall?y?)/i.test(normalized);

    if (isManual) {
      switch (lang) {
        case 'uz_cyrl':
          return `${num} аризаси бўйича ${amt ? `${amt} сўм ` : ''}тўлов қўлда тасдиқланди.${hasNotice ? ' Рухсатномани расмийлаштиринг.' : ''}`;
        case 'ru':
          return `По заявке ${num} подтверждена оплата${amt ? ` ${amt} сум` : ''} вручную.${hasNotice ? ' Оформите разрешение.' : ''}`;
        case 'en':
          return `Payment${amt ? ` of ${amt} UZS` : ''} confirmed manually for application ${num}.${hasNotice ? ' Issue the permit.' : ''}`;
        case 'kaa':
        case 'kk':
          return `${num} arzası boyınsha ${amt ? `${amt} sum ` : ''}tólem qolda tastıyıqlandı.${hasNotice ? ' Ruxsatnamanı rásmiylestiriń.' : ''}`;
        case 'uz_latn':
        default:
          return `${num} arizasi bo'yicha ${amt ? `${amt} so'm ` : ''}to'lov qo'lda tasdiqlandi.${hasNotice ? ' Ruxsatnomani rasmiylashtiring.' : ''}`;
      }
    }

    switch (lang) {
      case 'uz_cyrl':
        return `${num} аризаси бўйича ${amt ? `${amt} сўм ` : ''}тўлов тасдиқланди.${hasNotice ? ' Рухсатномани расмийлаштиринг.' : ''}`;
      case 'ru':
        return `По заявке ${num} подтверждена оплата${amt ? ` ${amt} сум` : ''}.${hasNotice ? ' Оформите разрешение.' : ''}`;
      case 'en':
        return `Payment${amt ? ` of ${amt} UZS` : ''} confirmed for application ${num}.${hasNotice ? ' Issue the permit.' : ''}`;
      case 'kaa':
      case 'kk':
        return `${num} arzası boyınsha ${amt ? `${amt} sum ` : ''}tólem tastıyıqlandı.${hasNotice ? ' Ruxsatnamanı rásmiylestiriń.' : ''}`;
      case 'uz_latn':
      default:
        return `${num} arizasi bo'yicha ${amt ? `${amt} so'm ` : ''}to'lov tasdiqlandi.${hasNotice ? ' Ruxsatnomani rasmiylashtiring.' : ''}`;
    }
  }

  // 12. Generic payment confirmed
  if (
    /^(?:To['ʼʻ`]lov\s+(?:qo['ʼʻ`]?lda\s+)?tasdiqlandi|Т[ўу]лов\s+(?:қ[ўу]лда\s+)?тасди[қк]ланди|T[oó]lem\s+(?:qolda\s+|qol\s+menen\s+)?tast[ıi]y[ıi]qland[ıi]|(?:qo['ʼʻ`]?lda|қ[ўу]лда|qolda|qol\s+menen)\s+(?:to['ʼʻ`]lov|т[ўу]лов|t[oó]lem)\s+(?:tasdiqlandi|тасди[қк]ланди|tast[ıi]y[ıi]qland[ıi])|Оплата\s+подтверждена(?:\s+вручную)?|Подтверждена\s+(?:ручная\s+)?оплата(?:\s+вручную)?|Payment\s+(?:manually\s+)?confirmed(?:\s+manually)?)\.?$/i.test(
      normalized,
    ) ||
    /^(?:To['ʼʻ`]lov\s+(?:qo['ʼʻ`]?lda\s+)?tasdiqlandi|Т[ўу]лов\s+(?:қ[ўу]лда\s+)?тасди[қк]ланди|T[oó]lem\s+(?:qolda\s+|qol\s+menen\s+)?tast[ıi]y[ıi]qland[ıi]|(?:qo['ʼʻ`]?lda|қ[ўу]лда|qolda|qol\s+menen)\s+(?:to['ʼʻ`]lov|т[ўу]лов|t[oó]lem)\s+(?:tasdiqlandi|тасди[қк]ланди|tast[ıi]y[ıi]qland[ıi])|Оплата\s+подтверждена(?:\s+вручную)?|Подтверждена\s+(?:ручная\s+)?оплата(?:\s+вручную)?|Payment\s+(?:manually\s+)?confirmed(?:\s+manually)?)\.?$/i.test(
      trimmed,
    )
  ) {
    const isManualGeneric = /(?:qo'?lda|қ[ўу]лда|qolda|qol\s+menen|вручную|ручн\w+|manuall?y?)/i.test(normalized);
    if (isManualGeneric) {
      switch (lang) {
        case 'uz_cyrl':
          return 'Тўлов қўлда тасдиқланди';
        case 'ru':
          return 'Оплата подтверждена вручную';
        case 'en':
          return 'Payment confirmed manually';
        case 'kaa':
        case 'kk':
          return 'Tólem qolda tastıyıqlandı';
        case 'uz_latn':
        default:
          return 'Toʻlov qoʻlda tasdiqlandi';
      }
    }
    switch (lang) {
      case 'uz_cyrl':
        return 'Тўлов тасдиқланди';
      case 'ru':
        return 'Оплата подтверждена';
      case 'en':
        return 'Payment confirmed';
      case 'kaa':
      case 'kk':
        return 'Tólem tastıyıqlandı';
      case 'uz_latn':
      default:
        return 'Toʻlov tasdiqlandi';
    }
  }

  // Fallback to translateTerm or original text
  const translated = translateTerm(trimmed, lang);
  return translated || trimmed;
}

export function translateNotificationSubject(
  subject: string | null | undefined,
  lang: string = 'uz_latn',
): string {
  if (!subject || typeof subject !== 'string') return subject ?? '';
  const trimmed = subject.trim();
  const translated = translateTerm(trimmed, lang);
  if (translated && translated.toLowerCase() !== trimmed.toLowerCase()) {
    return translated;
  }
  const bodyTranslated = translateNotification(trimmed, lang);
  if (bodyTranslated && bodyTranslated.toLowerCase() !== trimmed.toLowerCase()) {
    return bodyTranslated;
  }
  return translated || trimmed;
}
