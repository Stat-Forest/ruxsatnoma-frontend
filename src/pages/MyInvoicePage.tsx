import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CreditCard, ExternalLink, Gift, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { apiError } from '../api/errors';
import { Button } from '../components/ui/button';
import { Alert } from '../components/ui/Feedback';
import { toApiError } from './permits/apiErrorHelpers';
import { formatDateTime, formatMoney } from './permits/format';
import { INVOICE_STATUS_STYLE, getInvoiceStatusLabel } from './permits/statusMeta';
import { useLanguage, useT } from '../i18n/useT';
import { getApplicationCard, listClassifierItems } from './applicant/api';
import { pickName } from './applicant/format';
import type { UiLanguage } from '../i18n/context';

/** Stage 10, F1 — ruling #185: a benefit-settled invoice is `paid` with
 *  nothing collected, and the citizen sees why rather than a bare "paid"
 *  badge. Local to this page, matching `MyPermitPage.tsx`'s own
 *  `MY_PERMIT_PAGE_I18N` pattern — this file has no shared `useT()` copy of
 *  its own to extend. */
const BENEFIT_SETTLED_I18N: Record<UiLanguage, { title: string; withCategory: string; noCategory: string }> = {
  uz_latn: {
    title: "Toʻlov talab qilinmaydi — imtiyoz",
    withCategory:
      "Ushbu hisob-faktura «{category}» imtiyoz toifasi asosida toʻliq bepul rasmiylashtirildi — toʻlov talab qilinmaydi.",
    noCategory: "Ushbu hisob-faktura imtiyoz asosida toʻliq bepul rasmiylashtirildi — toʻlov talab qilinmaydi.",
  },
  uz_cyrl: {
    title: "Тўлов талаб қилинмайди — имтиёз",
    withCategory:
      "Ушбу ҳисоб-фактура «{category}» имтиёз тоифаси асосида тўлиқ бепул расмийлаштирилди — тўлов талаб қилинмайди.",
    noCategory: "Ушбу ҳисоб-фактура имтиёз асосида тўлиқ бепул расмийлаштирилди — тўлов талаб қилинмайди.",
  },
  ru: {
    title: 'Оплата не требуется — льгота',
    withCategory:
      'Этот счёт полностью оформлен бесплатно по льготной категории «{category}» — оплата не требуется.',
    noCategory: 'Этот счёт полностью оформлен бесплатно по льготе — оплата не требуется.',
  },
  en: {
    title: 'Nothing to pay — benefit',
    withCategory: 'This invoice was issued free of charge under the "{category}" benefit category — no payment is due.',
    noCategory: 'This invoice was issued free of charge under a benefit — no payment is due.',
  },
  kaa: {
    title: "Tólem talap etilmeydi — jeńillik",
    withCategory:
      'Bul invois «{category}» jeńillik kategoriyası tiykarında tolıq biykar tólemli ráwishte rásmiylestirildi — tólem talap etilmeydi.',
    noCategory: 'Bul invois jeńillik tiykarında tolıq biykar tólemli ráwishte rásmiylestirildi — tólem talap etilmeydi.',
  },
};

/** B9 — invoice and payment through Payme.
 *
 * The chain this page wires: `GET /invoices/{id}` to show the bill, then
 * `POST /invoices/{id}/pay-intents` to obtain Payme's own checkout URL.
 * **Payme is a JSON-RPC server on OUR side, not a webhook we call** — the
 * checkout URL this page opens is Payme's REAL hosted page
 * (`checkout.paycom.uz`, `integrations/adapters/payme.py::build_checkout_url`,
 * pure string construction, never `payme_mode`-sensitive); Payme's own
 * server calls back into ours (`POST /webhooks/payme`) once the citizen pays
 * there. **This page never marks an invoice PAID on its own** — the status
 * badge below is redrawn from `GET /invoices/{id}` alone, on load and on the
 * explicit "Holatni yangilash" click, exactly the ruling the task brief
 * states: "An invoice becomes PAID only on the provider's confirmation,
 * never optimistically in the UI."
 */
export function MyInvoicePage() {
  const { lang } = useLanguage();
  // Stage 11 — only the back link is translated (`myPayments.backToPayments`);
  // the rest of this page stays hard-coded uz_latn, as it already was.
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/invoices/{invoice_id}', {
        params: { path: { invoice_id: id! } },
      });
      if (error) throw apiError(error);
      return data;
    },
    enabled: !!id,
    retry: false,
  });

  // Ruling #185: only fetched when actually needed — a benefit-settled
  // invoice, to name the category it was granted under. Everyone else's
  // invoice page never makes either of these two extra requests.
  const applicationQuery = useQuery({
    queryKey: ['application-for-invoice', invoiceQuery.data?.application_id],
    queryFn: () => getApplicationCard(invoiceQuery.data!.application_id),
    enabled: !!invoiceQuery.data?.settled_by_benefit,
  });
  const benefitCategoriesQuery = useQuery({
    queryKey: ['classifier-items', 'benefit_categories'],
    queryFn: () => listClassifierItems('benefit_categories'),
    enabled: !!invoiceQuery.data?.settled_by_benefit,
  });

  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  async function handlePay() {
    if (!id) return;
    setPaying(true);
    setPayError(null);
    try {
      const { data, error } = await api.POST('/api/v1/invoices/{invoice_id}/pay-intents', {
        params: { path: { invoice_id: id } },
        body: { provider: 'payme' },
        headers: { 'Idempotency-Key': idempotencyKeyRef.current },
      });
      if (error) throw apiError(error);
      setPaymentUrl(data.payment_url);
    } catch (err) {
      const e = toApiError(err);
      if (e.code === 'ERR-PAY-004') {
        setPayError("Bu hisob-faktura endi toʻlanishi mumkin emas — u allaqachon toʻlangan, bekor qilingan yoki muddati tugagan.");
      } else if (e.code === 'ERR-PAY-002') {
        setPayError("Toʻlov muddati tugagan.");
      } else {
        setPayError(e.message);
      }
      // A failed attempt keeps the SAME idempotency key so a retry replays
      // it rather than opening a second `payment_intents` row; only a
      // successful one (a fresh "pay again" after settling) rotates it.
    } finally {
      setPaying(false);
    }
  }

  if (invoiceQuery.isLoading) {
    return <div className="text-sm text-[#5A646D]">Yuklanmoqda…</div>;
  }
  if (invoiceQuery.isError) {
    const e = toApiError(invoiceQuery.error);
    return (
      <Alert variant="danger" title="Hisob-faktura topilmadi">
        {e.code === 'ERR-SYS-003'
          ? "Bunday hisob-faktura mavjud emas yoki sizga tegishli emas."
          : e.message}
      </Alert>
    );
  }

  const invoice = invoiceQuery.data!;
  const canPay = invoice.status === 'pending';
  const benefitCopy = BENEFIT_SETTLED_I18N[lang] ?? BENEFIT_SETTLED_I18N.uz_latn;
  const benefitCategoryName = applicationQuery.data?.benefit_category_item_id
    ? pickName(
        benefitCategoriesQuery.data?.find((b) => b.id === applicationQuery.data!.benefit_category_item_id)?.name,
        lang,
      )
    : '';

  return (
    <div className="max-w-3xl mx-auto space-y-6 font-sans pb-16">
      <div className="border-b border-[#E4E7EA] pb-4">
        <Link
          to="/my/payments"
          className="text-xs text-[#5A646D] hover:underline hover:text-[#2E7D4F] flex items-center gap-1 mb-1 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t('myPayments.backToPayments')}
        </Link>
        <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">
          Hisob-faktura {invoice.number}
        </h1>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs uppercase tracking-wider font-bold text-[#5A646D]">Holati</span>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
              INVOICE_STATUS_STYLE[invoice.status] ?? INVOICE_STATUS_STYLE.pending
            }`}
          >
            {getInvoiceStatusLabel(invoice.status, lang)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#1A1F24]">
          <div className="space-y-1">
            <span className="text-[#5A646D] font-medium block">Summa</span>
            <strong className="font-mono text-lg font-bold text-[#123522]">
              {formatMoney(invoice.amount)} soʻm
            </strong>
          </div>
          <div className="space-y-1">
            <span className="text-[#5A646D] font-medium block">Chiqarilgan sana</span>
            <strong className="font-mono">{formatDateTime(invoice.issued_at)}</strong>
          </div>
          <div className="space-y-1">
            <span className="text-[#5A646D] font-medium block">Toʻlov muddati</span>
            <strong className="font-mono">{formatDateTime(invoice.due_at)}</strong>
          </div>
          <div className="space-y-1">
            <span className="text-[#5A646D] font-medium block">Toʻlangan sana</span>
            <strong className="font-mono">{invoice.paid_at ? formatDateTime(invoice.paid_at) : '—'}</strong>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EA]">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => void invoiceQuery.refetch()}
            isLoading={invoiceQuery.isFetching}
          >
            Holatni yangilash
          </Button>
        </div>
      </div>

      {invoice.settled_by_benefit ? (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-2">
          <h2 className="text-base font-bold text-[#1A1F24] flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#2E7D4F]" /> {benefitCopy.title}
          </h2>
          <p className="text-xs text-[#5A646D]">
            {benefitCategoryName
              ? benefitCopy.withCategory.replace('{category}', benefitCategoryName)
              : benefitCopy.noCategory}
          </p>
        </div>
      ) : (
        canPay && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-[#1A1F24] flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-[#2E7D4F]" /> Payme orqali toʻlash
          </h2>

          {payError && (
            <Alert variant="danger">
              {payError}
            </Alert>
          )}

          {!paymentUrl ? (
            <Button
              variant="primary"
              size="touch"
              fullWidth
              isLoading={paying}
              onClick={() => void handlePay()}
              className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
            >
              Toʻlov havolasini olish
            </Button>
          ) : (
            <div className="space-y-3">
              <Alert variant="info" title="Toʻlov havolasi tayyor">
                Quyidagi tugma sizni Payme toʻlov sahifasiga oʻtkazadi. Toʻlov Payme tomonidan tasdiqlangach,
                bu sahifadagi holat avtomatik emas — &quot;Holatni yangilash&quot;ni bosib tekshiring.
              </Alert>
              <Button
                variant="primary"
                size="touch"
                fullWidth
                leftIcon={<ExternalLink className="w-4 h-4" />}
                onClick={() => window.open(paymentUrl, '_blank', 'noopener,noreferrer')}
                className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
              >
                Payme sahifasiga oʻtish
              </Button>
              <div className="flex items-start gap-2 p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[11px] text-[#92400E]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Bu muhitda Payme mock rejimida ishlaydi — havola haqiqiy checkout.paycom.uz sahifasiga
                  olib boradi, lekin bu yerda haqiqiy toʻlov integratsiyasi ulanmagan.
                </span>
              </div>
            </div>
          )}
        </div>
        )
      )}
    </div>
  );
}
