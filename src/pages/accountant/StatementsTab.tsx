import { useT } from '../../i18n/useT';

/** G3 placeholder — replaced by the real screen in the next commit. */
export function StatementsTab() {
  const t = useT();
  return <div data-testid="statements-tab-placeholder">{t('accountant.common.loading')}</div>;
}
