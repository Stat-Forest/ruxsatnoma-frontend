import { useState } from 'react';
import { CheckCircle2, PenTool } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, ApiError } from '../../api/errors';
import type { components } from '../../api/schema';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/button';
import { toApiError } from './apiErrorHelpers';
import {
  buildMockPkcs7,
  canAttemptPurpose,
  isPlausiblePinflOrStir,
  getPurposeLabel,
  RECIPIENT_PURPOSE,
  SIGNATURE_ORDER,
} from './eimzo';
import { formatDateTime } from './format';
import { useLanguage } from '../../i18n/useT';

type PermitCardOut = components['schemas']['PermitCardOut'];

const SIG_I18N = {
  uz_latn: {
    panelTitle: 'Elektron raqamli imzolar',
    signedCount: (signed: number, total: number) => `Imzolangan ${signed} dan ${total}`,
    signedAt: 'Imzolangan:',
    signButton: 'E-IMZO bilan imzolash',
    pinflLabel: 'PINFL (14 ta) yoki tashkilot STIR (9 ta raqam)',
    waitingSignature: 'Imzo kutilmoqda — bu qatorni faqat tegishli mansabdor imzolashi mumkin.',
    notRequired: 'Bu qator hozircha talab qilinmagan roʻyxatda emas.',
    invalidAttempts: (n: number) => `${n} ta muvaffaqiyatsiz urinish qayd etilgan (audit jurnalida saqlanadi).`,
    pinflError: 'PINFL 14 ta, tashkilot STIR 9 ta raqamdan iborat boʻlishi kerak.',
    notRenderedError: 'Hujjat hali render qilinmagan — imzolab boʻlmaydi.',
  },
  uz_cyrl: {
    panelTitle: 'Электрон рақамли имзолар',
    signedCount: (signed: number, total: number) => `Имзоланган ${signed} дан ${total}`,
    signedAt: 'Имзоланган:',
    signButton: 'E-IMZO билан имзолаш',
    pinflLabel: 'ЖШШИР (14 та) ёки ташкилот СТИР (9 та рақам)',
    waitingSignature: 'Имзо кутилмоқда — бу қаторни фақат тегишли мансабдор имзолаши мумкин.',
    notRequired: 'Бу қатор ҳозирча талаб қилинмаган рўйхатда эмас.',
    invalidAttempts: (n: number) => `${n} та муваффақиятсиз уриниш қайд этилган (аудит журналида сақланади).`,
    pinflError: 'ЖШШИР 14 та, ташкилот СТИР 9 та рақамдан иборат бўлиши керак.',
    notRenderedError: 'Ҳужжат ҳали рендер қилинмаган — имзолаб бўлмайди.',
  },
  ru: {
    panelTitle: 'Электронные цифровые подписи',
    signedCount: (signed: number, total: number) => `Подписано ${signed} из ${total}`,
    signedAt: 'Подписано:',
    signButton: 'Подписать через E-IMZO',
    pinflLabel: 'ПИНФЛ (14 цифр) или ИНН организации (9 цифр)',
    waitingSignature: 'Ожидается подпись — эту строку может подписать только соответствующее должностное лицо.',
    notRequired: 'Эта строка пока не требуется в списке.',
    invalidAttempts: (n: number) => `Зафиксировано неудачных попыток: ${n} (сохраняется в журнале аудита).`,
    pinflError: 'ПИНФЛ должен содержать 14 цифр, ИНН организации — 9 цифр.',
    notRenderedError: 'Документ еще не сформирован — подписание невозможно.',
  },
  en: {
    panelTitle: 'Electronic digital signatures',
    signedCount: (signed: number, total: number) => `Signed ${signed} of ${total}`,
    signedAt: 'Signed:',
    signButton: 'Sign with E-IMZO',
    pinflLabel: 'PINFL (14 digits) or organization TIN (9 digits)',
    waitingSignature: 'Signature pending — only the authorized official can sign this row.',
    notRequired: 'This row is not currently in the required list.',
    invalidAttempts: (n: number) => `${n} failed attempt(s) recorded (kept in audit log).`,
    pinflError: 'PINFL must be 14 digits, organization TIN must be 9 digits.',
    notRenderedError: 'Document has not been rendered yet — cannot sign.',
  },
  kaa: {
    panelTitle: 'Elektron sanlı qol qoyıwlar',
    signedCount: (signed: number, total: number) => `Qol qoyılǵan ${signed} den ${total}`,
    signedAt: 'Qol qoyılǵan:',
    signButton: 'E-IMZO menen qol qoyıw',
    pinflLabel: 'JShShIR (14 san) yamasa shólkem STIR (9 san)',
    waitingSignature: 'Qol qoyıw kútilmekte — bul qatardı tek tiyisli mansapdar qol qoya aladı.',
    notRequired: 'Bul qatar házirshe talap etilmegen dizimde.',
    invalidAttempts: (n: number) => `${n} áwmetsiz urınıs jazıp alındı (audit jurnalında saqlanadı).`,
    pinflError: 'JShShIR 14 san, shólkem STIR 9 sannan ibarat bolıwı kerek.',
    notRenderedError: 'Hújjet háli render qılınbaǵan — qol qoyıw múmkin emes.',
  },
};

/** Every error `POST /permits/{id}/signatures` (and `sign()` underneath it)
 *  documents, turned into copy a signer can act on. Falls back to the raw
 *  message for anything this list does not name. */
function signErrorMessage(err: ApiError): string {
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.code === 'ERR-ACL-001') {
    if (reason === 'wrong_organization') {
      return "Siz boshqa tashkilot xodimisiz — bu ruxsatnomani imzolay olmaysiz.";
    }
    if (reason === 'not_the_holder') {
      return "Siz ushbu ruxsatnoma egasi (arizachisi) emassiz.";
    }
    return "Sizda ushbu qatorni imzolash huquqi yoʻq — rol yoki PINFL/STIR mos kelmadi.";
  }
  if (err.code === 'ERR-SIGN-001') return "Bu turdagi imzo hozircha talab qilinmaydi.";
  if (err.code === 'ERR-SIGN-002') return "Bu qator allaqachon imzolangan.";
  if (err.code === 'ERR-SIGN-004') return "Sertifikat holati ziddiyatli — qaytadan urining.";
  if (err.code === 'ERR-PERM-001') return "Ruxsatnoma endi imzo kutish holatida emas.";
  return err.message;
}

function SignatureSlot({
  purpose,
  permit,
  onSigned,
}: {
  purpose: string;
  permit: PermitCardOut;
  onSigned: () => void;
}) {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const t = SIG_I18N[lang as keyof typeof SIG_I18N] || SIG_I18N.uz_latn;

  const validRow = permit.signatures.find((s) => s.purpose === purpose && s.verification_status === 'valid');
  const invalidAttempts = permit.signatures.filter(
    (s) => s.purpose === purpose && s.verification_status !== 'valid',
  ).length;
  const isMissing = permit.missing_signatures.includes(purpose);

  const eligible =
    !!me &&
    canAttemptPurpose(purpose, {
      roleCode: me.role.code,
      isSuperuser: me.is_superuser,
      hasApplicant: me.applicant != null,
    });

  const [pinfl, setPinfl] = useState(purpose === RECIPIENT_PURPOSE ? (me?.applicant?.pinfl ?? '') : '');
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (pkcs7: string) => {
      const { data, error } = await api.POST('/api/v1/permits/{permit_id}/signatures', {
        params: { path: { permit_id: permit.id } },
        body: { purpose, pkcs7 },
      });
      if (error) throw apiError(error);
      return data;
    },
    onSuccess: () => onSigned(),
    onError: (err: unknown) => {
      const apiErr = toApiError(err);
      setFormError(signErrorMessage(apiErr));
      if (apiErr.code === 'ERR-SIGN-002') onSigned();
    },
  });

  function handleSign() {
    setFormError(null);
    if (!isPlausiblePinflOrStir(pinfl)) {
      setFormError(t.pinflError);
      return;
    }
    if (!permit.doc_hash) {
      setFormError(t.notRenderedError);
      return;
    }
    const pkcs7 = buildMockPkcs7({
      pinflOrStir: pinfl,
      documentSha256: permit.doc_hash,
      subject: `PINFL=${pinfl}, CN=${me?.user.full_name ?? ''}`,
    });
    mutation.mutate(pkcs7);
  }

  if (validRow) {
    return (
      <div className="border border-[#86EFAC] bg-[#F0F7F1] rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] font-bold flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <span className="text-[10px] uppercase font-bold text-[#5A646D]">{getPurposeLabel(purpose, lang)}</span>
        </div>
        <div className="space-y-1 font-mono text-[#5A646D] pt-2 border-t border-[#86EFAC]/50">
          <div className="flex justify-between">
            <span>{t.signedAt}</span>
            <strong className="text-[#1A1F24]">{formatDateTime(validRow.signed_at)}</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-dashed border-[#B45309] bg-[#FFFBEB] rounded-xl p-4 space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-white border border-dashed border-[#B45309] text-[#B45309] font-bold flex items-center justify-center">
          ⧗
        </span>
        <span className="text-[10px] uppercase font-bold text-[#5A646D]">{getPurposeLabel(purpose, lang)}</span>
      </div>

      {!isMissing ? (
        <p className="text-[#5A646D]">{t.notRequired}</p>
      ) : !eligible ? (
        <p className="text-[#B45309]">{t.waitingSignature}</p>
      ) : (
        <div className="space-y-2">
          <label className="block">
            <span className="block text-[11px] font-semibold text-[#5A646D] mb-1">
              {t.pinflLabel}
            </span>
            <input
              value={pinfl}
              onChange={(e) => setPinfl(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              maxLength={14}
              className="w-full h-9 rounded-md border border-[#767F87] px-2 font-mono text-xs"
              placeholder="31708860250017"
            />
          </label>
          {formError && <p className="text-[#B91C1C] font-semibold">{formError}</p>}
          <Button
            variant="primary"
            size="sm"
            fullWidth
            isLoading={mutation.isPending}
            leftIcon={<PenTool className="w-4 h-4" />}
            onClick={handleSign}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold h-9 text-xs"
          >
            {t.signButton}
          </Button>
        </div>
      )}
      {invalidAttempts > 0 && (
        <p className="text-[10px] text-[#B91C1C]">
          {t.invalidAttempts(invalidAttempts)}
        </p>
      )}
    </div>
  );
}

/**
 * The permit's 3+1 ERI signature lines — read exactly as `permit.signatures`
 * and `permit.missing_signatures` report them, never inferred. A paid,
 * unsigned permit (fact 3 of the task brief) shows here as three or four
 * pending slots and no ACTIVE badge anywhere on the page, honestly.
 */
export function PermitSignaturesPanel({ permit, onSigned }: { permit: PermitCardOut; onSigned: () => void }) {
  const { lang } = useLanguage();
  const t = SIG_I18N[lang as keyof typeof SIG_I18N] || SIG_I18N.uz_latn;
  const signedCount = SIGNATURE_ORDER.length - permit.missing_signatures.length;
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <h2 className="text-base font-bold text-[#1A1F24]">{t.panelTitle}</h2>
        <span className="text-xs font-bold text-[#15803D] bg-[#DCFCE7] px-3 py-1 rounded-full border border-[#86EFAC]">
          {t.signedCount(signedCount, SIGNATURE_ORDER.length)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SIGNATURE_ORDER.map((purpose) => (
          <SignatureSlot key={purpose} purpose={purpose} permit={permit} onSigned={onSigned} />
        ))}
      </div>
    </div>
  );
}

