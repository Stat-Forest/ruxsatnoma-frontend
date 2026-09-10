import { useSearchParams } from 'react-router';
import { Tabs } from '../../../components/ui/Navigation';
import { useT } from '../../../i18n/useT';
import { MyInvoicesTab } from './MyInvoicesTab';
import { MyRefundsTab } from './MyRefundsTab';

type TabId = 'invoices' | 'refunds';

/** Stage 11 — «Mening toʻlovlarim»: the citizen's invoices and refunds in one
 * place (rulings R1–R6). The active tab lives in `?tab=` so a notification
 * or a back link can open the refunds tab directly. */
export function MyPaymentsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'refunds' ? 'refunds' : 'invoices';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">{t('myPayments.title')}</h1>
        <p className="text-sm text-[#5A646D] mt-1">{t('myPayments.subtitle')}</p>
      </header>
      <Tabs
        tabs={[
          { id: 'invoices', label: t('myPayments.tabs.invoices') },
          { id: 'refunds', label: t('myPayments.tabs.refunds') },
        ]}
        activeTabId={tab}
        onChange={(id) => setParams(id === 'refunds' ? { tab: 'refunds' } : {})}
      />
      {tab === 'invoices' ? <MyInvoicesTab /> : <MyRefundsTab />}
    </div>
  );
}
