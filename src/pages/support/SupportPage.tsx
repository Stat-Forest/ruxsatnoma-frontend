import { useState } from 'react';
import { Mail, Phone, Send } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { satisfies } from '../../shell/navigation';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { AppealsTab } from './appeals/AppealsTab';
import { FaqAdminTab } from './faq/FaqAdminTab';
import { FaqReaderTab } from './faq/FaqReaderTab';
import { TicketsTab } from './tickets/TicketsTab';

export type TabId = 'faq' | 'faq-admin' | 'tickets' | 'appeals';

/**
 * The support area's whole workplace (FAQ, support tickets, citizens'
 * appeals) — one route (`/support`, no permission on the nav entry itself,
 * see `shell/navigation.ts`), tabs kept in component state the same way
 * `AccountantWorkspace` does it. Tab VISIBILITY is real: `faq` and `tickets`
 * are open to everyone who reaches this page, `faq-admin` needs
 * `help.faq.manage` and `appeals` needs `public.appeals.manage` — each
 * checked with `satisfies()`, the same any-of-these-codes helper
 * `visibleNav` itself uses.
 */
export function SupportPage() {
  const t = useT();
  const { me } = useAuth();
  const canManageFaq = me != null && satisfies('help.faq.manage', me);
  const canManageAppeals = me != null && satisfies('public.appeals.manage', me);
  const [tab, setTab] = useState<TabId>('faq');

  return (
    <div className="space-y-5 pb-16 font-sans" data-testid="support-page">
      <header className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('support.page.title')}</h1>
        <p className="mt-1 text-xs text-[#5A646D] md:text-sm">{t('support.page.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="support-contact-cards">
        <div className="flex items-start gap-3 rounded-xl border border-[#E4E7EA] bg-white p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0FDF4] text-[#2E7D4F]">
            <Phone className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('support.contact.phoneTitle')}</h3>
            <a href="tel:+998712001100" className="mt-0.5 block text-sm font-semibold text-[#1A1F24] hover:text-[#2E7D4F]">
              +998 71 200 11 00
            </a>
            <p className="mt-0.5 text-xs text-[#767F87]">{t('support.contact.phoneHours')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#E4E7EA] bg-white p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
            <Mail className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('support.contact.emailTitle')}</h3>
            <a href="mailto:support@ruxsatnoma.uz" className="mt-0.5 block truncate text-sm font-semibold text-[#1A1F24] hover:text-[#2563EB]">
              support@ruxsatnoma.uz
            </a>
            <p className="mt-0.5 text-xs text-[#767F87]">{t('support.contact.emailHint')}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-[#E4E7EA] bg-white p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F0F9FF] text-[#0284C7]">
            <Send className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('support.contact.telegramTitle')}</h3>
            <a href="https://t.me/ruxsatnoma_support" target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-sm font-semibold text-[#1A1F24] hover:text-[#0284C7]">
              @ruxsatnoma_support
            </a>
            <p className="mt-0.5 text-xs text-[#767F87]">{t('support.contact.telegramHint')}</p>
          </div>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'faq', label: t('support.tabs.faq') },
          ...(canManageFaq ? [{ id: 'faq-admin', label: t('support.tabs.faqAdmin') }] : []),
          { id: 'tickets', label: t('support.tabs.tickets') },
          ...(canManageAppeals ? [{ id: 'appeals', label: t('support.tabs.appeals') }] : []),
        ]}
        activeTabId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      <div>
        {tab === 'faq' && <FaqReaderTab />}
        {tab === 'faq-admin' && <FaqAdminTab />}
        {tab === 'tickets' && <TicketsTab />}
        {tab === 'appeals' && <AppealsTab />}
      </div>
    </div>
  );
}
