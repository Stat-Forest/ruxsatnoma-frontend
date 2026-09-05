import { useState } from 'react';
import { Tabs } from '../../../components/ui/Navigation';
import { useAuth } from '../../../auth/useAuth';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import { ChangePasswordForm } from './ChangePasswordForm';
import { ContactsSection } from './contacts/ContactsSection';
import { LABELS } from './labels';

type TabId = 'profile' | 'password';

/**
 * `/profile` — shared shell for every role (C5, shipped earlier: changing
 * one's own password). This stage (06.5, track F4) extends it rather than
 * replacing it, per that track's own brief:
 *
 *  - B3 (contacts) lives in the "Profil" tab, alongside the identity card.
 *    Language is deliberately not repeated here — it has had a real control
 *    in the shell header since stage 6.0 (`LanguageMenu`).
 *  - B4 (legal-entity representation) and B5 (my certificates) will each add
 *    their own tab in a later commit of this same track — no route exists
 *    for either (`src/routes.tsx` and `NAVIGATION` are both off limits to
 *    this track; `/profile` is the only screen every role already reaches
 *    with no permission gate), and both are natural profile sub-screens
 *    once they exist.
 */
export function ProfilePage() {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = useT();
  const passwordLabels = LABELS[lang];
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="max-w-xl space-y-5 pb-8">
      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <h1 className="text-lg font-bold text-[#1A1F24]">{me?.user.full_name}</h1>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-[#5A646D]">Login:</dt>
            <dd className="font-mono text-[#1A1F24]">{me?.user.login ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#5A646D]">Rol:</dt>
            <dd className="text-[#1A1F24]">{me ? pickName(me.role.name, lang) : '—'}</dd>
          </div>
        </dl>
      </section>

      <Tabs
        tabs={[
          { id: 'profile', label: t('cabinet.profile.tabProfile') },
          { id: 'password', label: t('cabinet.profile.tabPassword') },
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === 'profile' && <ContactsSection />}

      {tab === 'password' && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
          <h2 className="text-base font-bold text-[#1A1F24] mb-4">{passwordLabels.title}</h2>
          {/* A full reload, not `applyMe`: unlike every other write in this
              track, `POST /auth/password/change` answers 204 with no body
              (`app/modules/auth/router.py`), so there is no fresh `MeOut` to
              adopt — and `must_change_password` must be re-read from the
              server before the shell lets the user anywhere else. */}
          <ChangePasswordForm onChanged={() => window.location.assign('/')} />
        </section>
      )}
    </div>
  );
}
