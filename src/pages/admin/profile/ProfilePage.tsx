import { useAuth } from '../../../auth/useAuth';
import { useLanguage } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import { ChangePasswordForm } from './ChangePasswordForm';
import { LABELS } from './labels';

/**
 * `/profile` — who the caller is, and the one action this stage ships for
 * them: changing their own password (screen C5).
 *
 * The rest of the profile (contacts, language) is `06-frontend-screens.md` B3
 * and is not in this batch; the language switch already lives in the shell.
 */
export function ProfilePage() {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = LABELS[lang];

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

      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-[#1A1F24] mb-4">{t.title}</h2>
        {/* A full reload rather than a local state update: `AuthProvider` reads
            `/auth/me` once on mount and exposes no refresh, and after a
            password change the `must_change_password` flag must be re-read
            from the server before the shell will let the user anywhere. */}
        <ChangePasswordForm onChanged={() => window.location.assign('/')} />
      </section>
    </div>
  );
}
