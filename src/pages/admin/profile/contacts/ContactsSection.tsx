import { useAuth } from '../../../../auth/useAuth';
import { useT } from '../../../../i18n/useT';
import { ContactField } from './ContactField';

/**
 * B3 — profile contacts. Language is deliberately NOT repeated here: it has
 * been a real, working control in the shell header since stage 6.0
 * (`I18nProvider`/`LanguageMenu`, `PUT /auth/me/language`) — this section
 * covers only the part of B3 that had no screen anywhere, contacts.
 */
export function ContactsSection() {
  const { me, applyMe } = useAuth();
  const t = useT();

  if (!me) return null;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
      <h2 className="text-base font-bold text-[#1A1F24] mb-3">{t('cabinet.profile.contactsTitle')}</h2>
      <dl>
        <ContactField kind="phone" currentValue={me.user.phone} onSaved={applyMe} />
        <ContactField kind="email" currentValue={me.user.email} onSaved={applyMe} />
      </dl>
    </section>
  );
}
