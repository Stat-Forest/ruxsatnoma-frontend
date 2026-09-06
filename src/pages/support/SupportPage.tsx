import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { satisfies } from '../../shell/navigation';
import { Tabs } from '../../components/ui/Navigation';
import { useT } from '../../i18n/useT';
import { FaqAdminTab } from './faq/FaqAdminTab';
import { FaqReaderTab } from './faq/FaqReaderTab';
import { TicketsTab } from './tickets/TicketsTab';

export type TabId = 'faq' | 'faq-admin' | 'tickets' | 'appeals';

function ComingSoon() {
  return <div className="py-12 text-center text-sm text-[#5A646D]">…</div>;
}

/**
 * The support area's whole workplace (FAQ, support tickets, citizens'
 * appeals) — one route (`/support`, no permission on the nav entry itself,
 * see `shell/navigation.ts`), tabs kept in component state the same way
 * `AccountantWorkspace` does it. Tab VISIBILITY is real: `faq` and `tickets`
 * are open to everyone who reaches this page, `faq-admin` needs
 * `help.faq.manage` and `appeals` needs `public.appeals.manage` — each
 * checked with `satisfies()`, the same any-of-these-codes helper
 * `visibleNav` itself uses.
 *
 * Every tab body here is a placeholder — Tasks 2-4 replace each
 * `ComingSoon` branch below with their own real component, a two-line diff
 * to this file (one import, one JSX line) each time.
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
        {tab === 'appeals' && <ComingSoon />}
      </div>
    </div>
  );
}
