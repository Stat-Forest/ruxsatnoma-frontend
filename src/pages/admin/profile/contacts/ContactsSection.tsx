import { useAuth } from '../../../../auth/useAuth';
import { useT } from '../../../../i18n/useT';
import { ContactField } from './ContactField';
import { Phone } from 'lucide-react';

export function ContactsSection() {
  const { me, applyMe } = useAuth();
  const t = useT();

  if (!me) return null;

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-7 shadow-xs space-y-6">
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4E7EA]">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#1A1F24] flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#2E7D4F]" />
            {t('cabinet.profile.contactsTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-[#5A646D] mt-1">
            {t('cabinet.profile.contactsSubtitle')}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ContactField kind="phone" currentValue={me.user.phone} onSaved={applyMe} />
        <ContactField kind="email" currentValue={me.user.email} onSaved={applyMe} />
      </dl>
    </section>
  );
}
