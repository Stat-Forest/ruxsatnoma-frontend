import { useT } from '../../../i18n/useT';

/** Stub for stage 11 task 6 — task 7 replaces this with the real refunds
 * list and the "request a refund" form. Kept here only so `MyPaymentsPage`
 * compiles and its refunds tab renders something meaningful in the meantime. */
export function MyRefundsTab() {
  const t = useT();
  return <p>{t('myPayments.refunds.empty')}</p>;
}
