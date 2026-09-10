/**
 * Ruling #183 on the applicant's own timeline: a filing signed with the
 * button must not read «E-IMZO bilan imzolangan» — seen on the dev stand the
 * day stage 10 shipped, on the first application ever filed with the button.
 */
import { render, screen } from '@testing-library/react';
import { DICTIONARIES, I18nContext } from '../../../i18n/context';
import { ApplicantTimeline } from './ApplicantTimeline';
import type { ApplicationTimelineOut } from '../api';

function timeline(kind: 'eri' | 'simple'): ApplicationTimelineOut {
  return {
    application_id: 'a0000000-0000-4000-8000-000000000001',
    status_history: [
      {
        id: 'h0000000-0000-4000-8000-000000000001',
        application_id: 'a0000000-0000-4000-8000-000000000001',
        from_status: 'DRAFT',
        to_status: 'SUBMITTED',
        actor_user_id: 'u0000000-0000-4000-8000-000000000001',
        reason_item_id: null,
        reason_text: null,
        legal_basis: null,
        occurred_at: '2026-09-10T11:06:52Z',
        signatures: [
          {
            id: 's0000000-0000-4000-8000-000000000001',
            object_type: 'application_submission',
            object_id: 'h0000000-0000-4000-8000-000000000001',
            purpose: 'application_submission',
            signer_user_id: 'u0000000-0000-4000-8000-000000000001',
            kind,
            certificate_id: kind === 'simple' ? null : 'c0000000-0000-4000-8000-000000000001',
            signed_at: '2026-09-10T11:06:52Z',
            verification_status: 'valid',
          },
        ],
      },
    ],
  } as unknown as ApplicationTimelineOut;
}

function renderTimeline(kind: 'eri' | 'simple') {
  const i18n = {
    lang: 'uz_latn' as const,
    backendLang: 'uz_latn' as const,
    t: (key: string) => DICTIONARIES.uz_latn[key as keyof typeof DICTIONARIES.uz_latn] ?? key,
    setLanguage: async () => {},
  };
  return render(
    <I18nContext.Provider value={i18n}>
      <ApplicantTimeline timeline={timeline(kind)} />
    </I18nContext.Provider>,
  );
}

test('a simple signature is named as such, never as E-IMZO', () => {
  renderTimeline('simple');
  expect(screen.getByText(/Oddiy imzo bilan imzolangan/)).toBeInTheDocument();
  expect(screen.queryByText(/E-IMZO bilan imzolangan/)).not.toBeInTheDocument();
});

test('an ERI signature keeps its wording', () => {
  renderTimeline('eri');
  expect(screen.getByText(/E-IMZO bilan imzolangan/)).toBeInTheDocument();
});
