import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import {
  buildMockSignature,
  eimzoErrorMessageKey,
  isEimzoMock,
  PINFL_PATTERN,
  signDocument,
} from '../../../lib/eimzo';
import { useLanguage, useT } from '../../../i18n/useT';
import { useApplicationPackage, useRejectionReasons } from '../queries';
import { localizedName } from '../format';

export type DecisionMode = 'approve' | 'reject';

interface SignDecisionModalProps {
  mode: DecisionMode;
  applicationId: string;
  isSubmitting: boolean;
  error: unknown;
  onClose: () => void;
  onSubmitApprove: (pkcs7: string) => void;
  onSubmitReject: (input: { pkcs7: string; reason_item_id: string; legal_basis: string }) => void;
}

const SIGN_DECISION_I18N = {
  uz_latn: {
    approveTitle: 'Arizani tasdiqlash',
    rejectTitle: 'Arizani rad etish',
    subtitle: 'ERI (E-IMZO) bilan tasdiqlanadi — demo rejimida mock imzo',
    cancel: 'Bekor qilish',
    approveSubmit: 'Tasdiqlash va imzolash',
    rejectSubmit: 'Rad etish va imzolash',
    loadingPackage: 'Imzolanadigan hujjat yuklanmoqda (GET .../package)...',
    packageErrorFallback: 'Hujjat yuklanmadi.',
    reasonLabel: 'Rad etish sababi',
    selectPlaceholder: 'Tanlang...',
    legalBasisLabel: 'Huquqiy asos (legal_basis)',
    legalBasisPlaceholder: 'Masalan: VMQ 278-son, 12-band',
    pinflLabel: 'ERI sertifikatingiz PINFL (JSHSHIR)',
    pinflHelper: '14 xonali raqam — mock ERI uchun kiritiladi, haqiqiy E-IMZO kalitida bu avtomatik oʻqiladi.',
    pinflRequired: 'PINFL kiritilishi shart — bu maydondagi 14 xonali raqam faqat namuna sifatida koʻrsatilgan.',
    pinflMustBe14: '14 xonali raqam boʻlishi kerak',
  },
  uz_cyrl: {
    approveTitle: 'Аризани тасдиқлаш',
    rejectTitle: 'Аризани рад этиш',
    subtitle: 'ЭРИ (E-IMZO) билан тасдиқланади — демо режимида мок имзо',
    cancel: 'Бекор қилиш',
    approveSubmit: 'Тасдиқлаш ва имзолаш',
    rejectSubmit: 'Рад этиш ва имзолаш',
    loadingPackage: 'Имзоланадиган ҳужжат юкланмоқда (GET .../package)...',
    packageErrorFallback: 'Ҳужжат юкланмади.',
    reasonLabel: 'Рад этиш сабаби',
    selectPlaceholder: 'Танланг...',
    legalBasisLabel: 'Ҳуқуқий асос (legal_basis)',
    legalBasisPlaceholder: 'Масалан: ВМҚ 278-сон, 12-банд',
    pinflLabel: 'ЭРИ сертификатингиз ПИНФЛ (ЖШШИР)',
    pinflHelper: '14 хонали рақам — мок ЭРИ учун киритилади, ҳақиқий E-IMZO калитида бу автоматик ўқилади.',
    pinflRequired: 'ПИНФЛ киритилиши шарт — бу майдондаги 14 хонали рақам фақат намуна сифатида кўрсатилган.',
    pinflMustBe14: '14 хонали рақам бўлиши керак',
  },
  ru: {
    approveTitle: 'Утверждение заявления',
    rejectTitle: 'Отклонение заявления',
    subtitle: 'Подтверждается ЭЦП (E-IMZO) — в демо-режиме тестовая подпись',
    cancel: 'Отмена',
    approveSubmit: 'Утвердить и подписать',
    rejectSubmit: 'Отклонить и подписать',
    loadingPackage: 'Загрузка подписываемого документа (GET .../package)...',
    packageErrorFallback: 'Документ не загружен.',
    reasonLabel: 'Причина отклонения',
    selectPlaceholder: 'Выберите...',
    legalBasisLabel: 'Правовое основание (legal_basis)',
    legalBasisPlaceholder: 'Например: ПКМ № 278, пункт 12',
    pinflLabel: 'ПИНФЛ вашего сертификата ЭЦП',
    pinflHelper: '14-значный номер — вводится для mock ЭЦП, в реальном ключе E-IMZO считывается автоматически.',
    pinflRequired: 'ПИНФЛ обязателен — 14-значное число в поле показано лишь как пример.',
    pinflMustBe14: 'Должен содержать 14 цифр',
  },
  en: {
    approveTitle: 'Approve application',
    rejectTitle: 'Reject application',
    subtitle: 'Confirmed with EDS (E-IMZO) — mock signature in demo mode',
    cancel: 'Cancel',
    approveSubmit: 'Approve and sign',
    rejectSubmit: 'Reject and sign',
    loadingPackage: 'Loading document package to sign (GET .../package)...',
    packageErrorFallback: 'Failed to load document.',
    reasonLabel: 'Rejection reason',
    selectPlaceholder: 'Select...',
    legalBasisLabel: 'Legal basis (legal_basis)',
    legalBasisPlaceholder: 'For example: Resolution No. 278, item 12',
    pinflLabel: 'PINFL of your EDS certificate',
    pinflHelper: '14-digit number — entered for mock EDS, in real E-IMZO key read automatically.',
    pinflRequired: 'PINFL is required — 14-digit number in field is shown only as placeholder.',
    pinflMustBe14: 'Must be a 14-digit number',
  },
  kaa: {
    approveTitle: 'Arzanı tastıyıqlaw',
    rejectTitle: 'Arzanı biykar etiw',
    subtitle: 'ERI (E-IMZO) menen tastıyıqlanadı — demo rejiminde mock imzo',
    cancel: 'Biykar etiw',
    approveSubmit: 'Tastıyıqlaw hám qol qoyıw',
    rejectSubmit: 'Biykar etiw hám qol qoyıw',
    loadingPackage: 'Qol qoyılatuǵın hújjet júklenbekte (GET .../package)...',
    packageErrorFallback: 'Hújjet júklenbedi.',
    reasonLabel: 'Biykar etiw sebebi',
    selectPlaceholder: 'Saylań...',
    legalBasisLabel: 'Huqıqıy tiykar (legal_basis)',
    legalBasisPlaceholder: 'Mısalı: VMQ 278-san, 12-bánt',
    pinflLabel: 'ERI sertifikatıńızdıń PINFL (JSHSHIR)',
    pinflHelper: '14 xanalı san — mock ERI ushın kiritiledi, haqıyqıy E-IMZO giltinde bul avtomatikalıq oqıladı.',
    pinflRequired: 'PINFL kiritiliwi shárt — bul maydandaǵı 14 xanalı san tek úlgi retinde kórsetilgen.',
    pinflMustBe14: '14 xanalı san bolıwı kerek',
  },
};

/**
 * The one place both decision routes get their `pkcs7` from. Under the
 * mock, a real E-IMZO client's certificate is stood in for by asking the
 * operator for the PINFL it would carry (see `lib/eimzoMock.ts`'s own
 * docstring for why `GET /auth/me` cannot supply it); in real mode
 * (fix wave, finding 2) there is no PINFL box at all — the certificate the
 * signer picks in E-IMZO carries that identity, task 10's own rule applied
 * here. Nothing about the DECISION itself is faked either way: the bytes
 * signed are the real `GET /applications/{id}/package` response, fetched
 * fresh on open (ruling 23 — the package is priced afresh on every call),
 * DETACHED (`signatures.service.sign()` -> `verify_detached`), and the
 * signature is verified for real by that same call.
 */
export function SignDecisionModal({
  mode,
  applicationId,
  isSubmitting,
  error,
  onClose,
  onSubmitApprove,
  onSubmitReject,
}: SignDecisionModalProps) {
  const { lang } = useLanguage();
  // `tr` carries this modal's own strings; `t` resolves the shared E-IMZO
  // failure keys, which live in the app-wide catalogue rather than here.
  const t = useT();
  const tr = SIGN_DECISION_I18N[lang] ?? SIGN_DECISION_I18N.uz_latn;
  const errorText = useApiErrorText();
  const [pinfl, setPinfl] = useState('');
  const [reasonItemId, setReasonItemId] = useState('');
  const [legalBasis, setLegalBasis] = useState('');
  // Set only once the operator has actually tried to submit with the PINFL
  // field empty — an empty field is normal before that point and should not
  // shout at someone who has not touched the form yet.
  const [pinflTouched, setPinflTouched] = useState(false);
  // Real mode only: `signDocument` runs BEFORE `onSubmitApprove`/
  // `onSubmitReject` ever fire, so its own failure never reaches the
  // mutation's `error` prop — kept apart, same reason
  // `PermitLifecyclePanel.tsx`'s own `eimzoErrorKey` is.
  const [eimzoErrorKey, setEimzoErrorKey] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const rejectionReasons = useRejectionReasons();
  const packageQuery = useApplicationPackage(applicationId);
  const loadingPackage = packageQuery.isLoading;
  const packageError = packageQuery.error
    ? packageQuery.error instanceof ApiError
      ? errorText(packageQuery.error)
      : tr.packageErrorFallback
    : null;

  // Mock mode only — a real certificate carries the signer's identity, no
  // PINFL box to validate (task 10's own rule, applied here per fix wave
  // finding 2).
  const pinflValid = !isEimzoMock() || PINFL_PATTERN.test(pinfl);
  // `pinflValid` is deliberately NOT part of `canSubmit`: with it there, an
  // empty field simply disabled the button and a click did nothing at all —
  // no error, no feedback (the defect this task fixes). The button stays
  // clickable so `handleSubmit` below can run its own check and say why it
  // refused, the same way `PermitSignaturesPanel.tsx::handleSign` already
  // does for the permit's own signature slots.
  const canSubmit =
    packageQuery.data !== undefined &&
    !isSubmitting &&
    !signing &&
    (mode === 'approve' || (reasonItemId !== '' && legalBasis.trim().length > 0));

  async function handleSubmit() {
    if (isEimzoMock() && !PINFL_PATTERN.test(pinfl)) {
      setPinflTouched(true);
      return;
    }
    if (!packageQuery.data) return;
    setEimzoErrorKey(null);
    let pkcs7: string;
    if (isEimzoMock()) {
      pkcs7 = await buildMockSignature({ pinfl, documentBytes: packageQuery.data });
    } else {
      // Real mode: DETACHED — `signatures.service.sign()` hashes the exact
      // `GET /applications/{id}/package` bytes fetched above and calls
      // `adapter.verify_detached(document, pkcs7)`; no PINFL to type in,
      // the signer's own certificate carries that identity.
      setSigning(true);
      try {
        pkcs7 = await signDocument(new Uint8Array(packageQuery.data));
      } catch (err) {
        setEimzoErrorKey(eimzoErrorMessageKey(err));
        return;
      } finally {
        setSigning(false);
      }
    }
    if (mode === 'approve') {
      onSubmitApprove(pkcs7);
    } else {
      onSubmitReject({ pkcs7, reason_item_id: reasonItemId, legal_basis: legalBasis });
    }
  }

  const apiError = error instanceof ApiError ? error : null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={mode === 'approve' ? tr.approveTitle : tr.rejectTitle}
      subtitle={tr.subtitle}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {tr.cancel}
          </Button>
          <Button
            variant={mode === 'approve' ? 'primary' : 'danger'}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            isLoading={isSubmitting || signing}
          >
            {mode === 'approve' ? tr.approveSubmit : tr.rejectSubmit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loadingPackage && (
          <div className="flex items-center gap-2 text-xs text-[#5A646D]">
            <Loader2 className="w-4 h-4 animate-spin" /> {tr.loadingPackage}
          </div>
        )}
        {packageError && (
          <p className="text-xs text-[#B91C1C] flex items-center gap-1.5" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" /> {packageError}
          </p>
        )}

        {mode === 'reject' && (
          <>
            <FormField label={tr.reasonLabel} required>
              <Select
                value={reasonItemId}
                onChange={(e) => setReasonItemId(e.target.value)}
                options={[
                  { value: '', label: tr.selectPlaceholder },
                  ...(rejectionReasons.data ?? []).map((r) => ({ value: r.id, label: localizedName(r.name, lang) || r.code })),
                ]}
              />
            </FormField>
            <FormField label={tr.legalBasisLabel} required>
              <Textarea
                value={legalBasis}
                onChange={(e) => setLegalBasis(e.target.value)}
                placeholder={tr.legalBasisPlaceholder}
                maxLength={2000}
              />
            </FormField>
          </>
        )}

        {/* Mock mode only: a real E-IMZO key carries the signer's identity,
            so there is nothing for the operator to type. */}
        {isEimzoMock() && (
          <FormField
            label={tr.pinflLabel}
            required
            helperText={tr.pinflHelper}
            error={
              (pinflTouched || pinfl !== '') && !pinflValid
                ? pinfl === ''
                  ? tr.pinflRequired
                  : tr.pinflMustBe14
                : undefined
            }
          >
            <Input
              inputMode="numeric"
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
              onBlur={() => setPinflTouched(true)}
              placeholder="31207854315218"
            />
          </FormField>
        )}

        {eimzoErrorKey && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{t(eimzoErrorKey)}</p>
          </div>
        )}

        {apiError && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B] space-y-1">
            <p>{errorText(apiError)}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
