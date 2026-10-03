/** Pure data shape and helpers for one rejection ground (stage 16, ruling
 *  R3) — kept out of `components/RejectionGroundsEditor.tsx` on purpose: a
 *  `.tsx` file exporting anything besides components trips
 *  `react-refresh/only-export-components` (the same reason
 *  `applicant/wizard/seasonCalendar.ts` exists beside `OccupancyCalendar.tsx`). */
import type { UiLanguage } from '../../i18n/context';

export type GroundDraft = {
  reason_item_id: string;
  fact: string;
  legal_document: string;
  legal_clause: string;
  evidence: string;
  remedy: string;
};

export const MAX_GROUNDS = 10;

export function emptyGround(fact = ''): GroundDraft {
  return { reason_item_id: '', fact, legal_document: '', legal_clause: '', evidence: '', remedy: '' };
}

export function groundComplete(g: GroundDraft): boolean {
  return Object.values(g).every((v) => v.trim().length > 0);
}

/** A ground's five free-text fields — everything but `reason_item_id`,
 *  which is a classifier id rather than text a head types. Named to match
 *  the wire path a backend refusal names a field by
 *  (`grounds.{i}.{field}`, G1 below), not `GroundDraft`'s camelCase-free
 *  key order. */
export type GroundTextField = 'fact' | 'legal_document' | 'legal_clause' | 'evidence' | 'remedy';

/** Localized labels for a ground's own template (`{n}` is the 1-based
 *  index) and its five text fields — shared between `RejectionGroundsEditor`
 *  (the form itself) and `SignDecisionModal`'s G1 unrenderable-character
 *  breakdown, so the two names for "the same field" can never drift apart. */
export const GROUND_LABELS: Record<UiLanguage, Record<'ground' | GroundTextField, string>> = {
  uz_latn: {
    ground: 'Sabab {n}',
    fact: 'Aniqlangan holat',
    legal_document: 'Hujjat nomi',
    legal_clause: 'Band yoki modda',
    evidence: 'Dalil va manba',
    remedy: 'Bartaraf etish tartibi',
  },
  uz_cyrl: {
    ground: 'Сабаб {n}',
    fact: 'Аниқланган ҳолат',
    legal_document: 'Ҳужжат номи',
    legal_clause: 'Банд ёки модда',
    evidence: 'Далил ва манба',
    remedy: 'Бартараф этиш тартиби',
  },
  ru: {
    ground: 'Причина {n}',
    fact: 'Установленное обстоятельство',
    legal_document: 'Нормативный документ',
    legal_clause: 'Пункт или статья',
    evidence: 'Доказательство и источник',
    remedy: 'Порядок устранения',
  },
  en: {
    ground: 'Ground {n}',
    fact: 'Fact established',
    legal_document: 'Legal document',
    legal_clause: 'Clause or article',
    evidence: 'Evidence and source',
    remedy: 'How to remedy',
  },
  kaa: {
    ground: 'Sebep {n}',
    fact: 'Anıqlanǵan jaǵday',
    legal_document: 'Hújjet atı',
    legal_clause: 'Bánt yamasa statya',
    evidence: 'Dálil hám derek',
    remedy: 'Saplastırıw tártibi',
  },
};
