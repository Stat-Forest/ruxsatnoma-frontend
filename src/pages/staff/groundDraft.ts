/** Pure data shape and helpers for one rejection ground (stage 16, ruling
 *  R3) — kept out of `components/RejectionGroundsEditor.tsx` on purpose: a
 *  `.tsx` file exporting anything besides components trips
 *  `react-refresh/only-export-components` (the same reason
 *  `applicant/wizard/seasonCalendar.ts` exists beside `OccupancyCalendar.tsx`). */
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
