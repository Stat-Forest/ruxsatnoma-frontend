import { useMemo, useState } from 'react';
import { CheckCircle2, PenTool } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, ApiError } from '../../api/errors';
import type { components } from '../../api/schema';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/button';
import { useLanguage, useT } from '../../i18n/useT';
import {
  EimzoError,
  buildMockPkcs7,
  canAttemptPurpose,
  eimzoErrorMessageKey,
  getPurposeLabel,
  isEimzoMock,
  isPlausiblePinflOrStir,
  isProviderUnreachable,
  RECIPIENT_PURPOSE,
  signDocument,
  SIGNATURE_ORDER,
} from '../../lib/eimzo';
import { toApiError } from './apiErrorHelpers';
import { formatDateTime } from './format';

type PermitCardOut = components['schemas']['PermitCardOut'];
type SignatureOut = components['schemas']['SignatureOut'];

// Not imported from `../../api/client`: that module's `BASE_URL` is not
// exported, and `openapi-fetch` parses every response as JSON, which this
// route (`application/pdf`) is not — the same reason `PermitPdfPanel.tsx`
// bypasses it too. Real-mode signing needs the exact bytes E-IMZO must sign
// DETACHED (`signatures.service.sign()` hashes the document it already
// stores, `doc_hash` alone is not enough to hand a real key) — mock mode
// never calls this, it only ever needs the hash `permit.doc_hash` already
// carries.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/** Fix wave, minor finding: distinguishes a fetch failure from any other
 *  `Error` this component might see, so `handleSign`'s catch block can give
 *  it its own localized message instead of `err.message` — the raw text
 *  used to reach the citizen VERBATIM, in English, regardless of interface
 *  language. */
class PermitPdfFetchError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Failed to fetch the permit PDF (${status})`);
    this.name = 'PermitPdfFetchError';
    this.status = status;
  }
}

async function fetchPermitPdfBytes(permitId: string): Promise<Uint8Array> {
  const res = await fetch(`${API_BASE}/api/v1/permits/${permitId}/pdf`, { credentials: 'include' });
  if (!res.ok) throw new PermitPdfFetchError(res.status);
  return new Uint8Array(await res.arrayBuffer());
}

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
    // Stage 10, F3 (ruling #183): a holder's simple signature.
    simpleSignatureBadge: 'Oddiy imzo',
    pinflValueLabel: 'PINFL',
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
    // Stage 10, F3 (ruling #183): a holder's simple signature.
    simpleSignatureBadge: 'Оддий имзо',
    pinflValueLabel: 'ЖШШИР',
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
    // Stage 10, F3 (ruling #183): a holder's simple signature.
    simpleSignatureBadge: 'Простая подпись',
    pinflValueLabel: 'ПИНФЛ',
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
    // Stage 10, F3 (ruling #183): a holder's simple signature.
    simpleSignatureBadge: 'Simple signature',
    pinflValueLabel: 'PINFL',
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
    // Stage 10, F3 (ruling #183): a holder's simple signature.
    simpleSignatureBadge: 'Ápiwayı qol qoyıw',
    pinflValueLabel: 'JShShIR',
  },
};

const SIGN_ERROR_I18N = {
  uz_latn: {
    wrong_organization: 'Siz boshqa tashkilot xodimisiz — bu ruxsatnomani imzolay olmaysiz.',
    not_the_holder: 'Siz ushbu ruxsatnoma egasi (arizachisi) emassiz.',
    no_permission: 'Sizda ushbu qatorni imzolash huquqi yoʻq — rol yoki PINFL/STIR mos kelmadi.',
    already_signed: 'Bu qator allaqachon imzolangan.',
    cert_conflict: 'Sertifikat holati ziddiyatli — qaytadan urining.',
    not_pending: 'Ruxsatnoma endi imzo kutish holatida emas.',
  },
  uz_cyrl: {
    wrong_organization: 'Сиз бошқа ташкилот ходимисиз — бу рухсатномани имзолай олмайсиз.',
    not_the_holder: 'Сиз ушбу рухсатнома эгаси (аризачиси) эмассиз.',
    no_permission: 'Сизда ушбу қаторни имзолаш ҳуқуқи йўқ — роль ёки ЖШШИР/СТИР мос келмади.',
    already_signed: 'Бу қатор аллақачон имзоланган.',
    cert_conflict: 'Сертификат ҳолати зиддиятли — қайтадан урининг.',
    not_pending: 'Рухсатнома энди имзо кутиш ҳолатида эмас.',
  },
  ru: {
    wrong_organization: 'Вы сотрудник другой организации — вы не можете подписать это разрешение.',
    not_the_holder: 'Вы не являетесь владельцем (заявителем) этого разрешения.',
    no_permission: 'У вас нет права подписывать эту строку — роль или ПИНФЛ/ИНН не совпали.',
    already_signed: 'Эта строка уже подписана.',
    cert_conflict: 'Конфликт статуса сертификата — попробуйте снова.',
    not_pending: 'Разрешение больше не ожидает подписания.',
  },
  en: {
    wrong_organization: 'You are an employee of another organization — you cannot sign this permit.',
    not_the_holder: 'You are not the holder (applicant) of this permit.',
    no_permission: 'You do not have permission to sign this row — role or PINFL/TIN mismatch.',
    already_signed: 'This row is already signed.',
    cert_conflict: 'Conflicting certificate status — please try again.',
    not_pending: 'Permit is no longer in pending signature status.',
  },
  kaa: {
    wrong_organization: 'Siz basqa shólkem xızmetkerisiz — bul ruxsatnamanı qol qoya almaysız.',
    not_the_holder: 'Siz bul ruxsatnama iyesi (arzashısı) emessiz.',
    no_permission: 'Sizde bul qatardı qol qoyıw huqıqı joq — rol yamasa JShShIR/STIR sáykes kelmedi.',
    already_signed: 'Bul qatar álleqashan qol qoyılǵan.',
    cert_conflict: 'Sertifikat jaǵdayı qarama-qarsı — qaytadan urınıń.',
    not_pending: 'Ruxsatnama endi qol qoyıw kútiliwinde emes.',
  },
};

/**
 * Fix wave, finding 4: `ERR-SIGN-001` is not one condition — it is every
 * refusal `signatures.service.sign()`/`register_certificate` can raise
 * before or instead of writing a `signatures` row
 * (`app/modules/signatures/service.py`), told apart only by
 * `details.reason`. Under the mock, the ONLY reason this screen ever
 * actually saw was `purpose_not_required` (a real E-IMZO client is the only
 * way to reach `signature_invalid`/`certificate_revoked`/etc.), so ignoring
 * `details.reason` and hard-coding "not required" text went unnoticed until
 * a real backend started answering with the same code for a revoked
 * certificate, a PINFL mismatch, or a broken signature. The backend
 * deliberately keeps these reasons machine-readable (stage 3.8 ruling 9)
 * specifically so a client can do this instead of guessing. These keys
 * resolve through the shared `useT()` translator (`t`) rather than the
 * component-local `SIGN_ERROR_I18N` map below, which only covers the
 * handful of error codes that never carry a `reason`.
 */
const SIGN_ERROR_REASON_KEYS: Record<string, string> = {
  purpose_not_required: 'permits.signatures.errors.purposeNotRequired',
  signature_invalid: 'permits.signatures.errors.signatureInvalid',
  certificate_pinfl_mismatch: 'permits.signatures.errors.certificatePinflMismatch',
  signer_pinfl_unknown: 'permits.signatures.errors.signerPinflUnknown',
  simple_signature_not_allowed: 'permits.signatures.errors.simpleSignatureNotAllowed',
  certificate_revoked: 'permits.signatures.errors.certificateRevoked',
  certificate_expired: 'permits.signatures.errors.certificateExpired',
  certificate_missing: 'permits.signatures.errors.certificateMissing',
  certificate_invalid_at_signing: 'permits.signatures.errors.certificateInvalidAtSigning',
  timestamp_missing: 'permits.signatures.errors.timestampMissing',
  certificate_owned_by_another_user: 'permits.signatures.errors.certificateOwnedByAnother',
};

/** Every error `POST /permits/{id}/signatures` (and `sign()` underneath it)
 *  documents, turned into copy a signer can act on. Falls back to the raw
 *  message for anything this list does not name. */
function signErrorMessage(t: (key: string) => string, lang: string, err: ApiError): string {
  const tr = SIGN_ERROR_I18N[lang as keyof typeof SIGN_ERROR_I18N] || SIGN_ERROR_I18N.uz_latn;
  const reason = (err.details as { reason?: string } | undefined)?.reason;
  if (err.code === 'ERR-ACL-001') {
    if (reason === 'wrong_organization') {
      return tr.wrong_organization;
    }
    if (reason === 'not_the_holder') {
      return tr.not_the_holder;
    }
    return tr.no_permission;
  }
  if (err.code === 'ERR-SIGN-001') {
    const key = reason ? SIGN_ERROR_REASON_KEYS[reason] : undefined;
    return t(key ?? 'permits.signatures.errors.signRefusedGeneric');
  }
  if (err.code === 'ERR-SIGN-002') return tr.already_signed;
  if (err.code === 'ERR-SIGN-004') return tr.cert_conflict;
  if (err.code === 'ERR-PERM-001') return tr.not_pending;
  return err.message;
}

/**
 * `PermitCardOut.signatures` rows carry `kind` since the stage 10
 * integration (the backend review found the card answering 500 on a simple
 * row, and widened `PermitSignatureRow` with `kind` + a nullable
 * `certificate_id`) — so the «Oddiy imzo» badge reads the card row and is
 * visible to every viewer of the card. What the card still does NOT carry
 * is `verification`, where a simple row keeps the signer's PINFL; for the
 * masked PINFL line this panel fetches the full list once per permit and
 * matches rows back to `permit.signatures` by `id`.
 *
 * Best-effort, not required: `GET /signatures` gates on the caller already
 * holding a VALID row of their OWN on this object, or `signatures.view_any`
 * (`signatures/service.py::list_signatures_page`) — a staff signer who has
 * not signed anything on this permit yet gets `ERR-ACL-001` here even
 * though `_readable_permit` already let them open the card. `useQuery`'s
 * default retry/error handling is left alone; a failed or still-loading
 * fetch simply leaves `fullSignatures` empty and every row renders exactly
 * as it did before ruling #183 — a viewer this route refuses was never
 * shown the PINFL in the first place, so nothing is hidden that they used
 * to see.
 */
function useFullSignatures(permitId: string) {
  return useQuery({
    queryKey: ['permits', permitId, 'signatures'],
    // A 403 for a viewer who has not signed yet is the expected answer, not
    // a transient one — four attempts of it per page is stand-log noise.
    retry: false,
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/signatures', {
        params: { query: { object_type: 'permit', object_id: permitId } },
      });
      if (error) throw apiError(error);
      return data.items;
    },
  });
}

/** `SignatureOut.verification` is `{[key: string]: unknown}` on the wire
 *  (module docstring: the raw provider payload) — a `simple` row's shape is
 *  `{kind:'simple', pinfl, auth_method, ip}` (ruling #183), but nothing
 *  types that narrower shape, so this reads `pinfl` defensively. */
function extractPinfl(verification: SignatureOut['verification']): string | null {
  const value = verification.pinfl;
  return typeof value === 'string' ? value : null;
}

/** First 3 and last 2 digits visible, the middle masked — a signer never
 *  typed this PINFL into a box on this screen (ruling #183: no E-IMZO
 *  dialog at all for a citizen signing themselves), so showing it in full
 *  here would be the first time this UI ever displayed it whole. */
function maskPinfl(pinfl: string): string {
  if (pinfl.length <= 5) return pinfl;
  return `${pinfl.slice(0, 3)}${'•'.repeat(pinfl.length - 5)}${pinfl.slice(-2)}`;
}

function SignatureSlot({
  purpose,
  permit,
  onSigned,
  fullSignatures,
}: {
  purpose: string;
  permit: PermitCardOut;
  onSigned: () => void;
  fullSignatures: Map<string, SignatureOut>;
}) {
  const { me } = useAuth();
  const { lang } = useLanguage();
  // `t` resolves the shared `permits.signatures.errors.*`/E-IMZO failure
  // keys (also used outside this component); `tr` carries this panel's own
  // copy, keyed by `lang` the same way `SignDecisionModal.tsx` splits them.
  const t = useT();
  const tr = SIG_I18N[lang as keyof typeof SIG_I18N] ?? SIG_I18N.uz_latn;

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
  // Real mode only: fetching the PDF and running the whole E-IMZO flow
  // (`signDocument`) happens BEFORE `mutation.mutate` — `mutation.isPending`
  // alone would leave the button looking idle during that entire stretch.
  const [signing, setSigning] = useState(false);

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
    // `err` here is ALREADY the `ApiError` `mutationFn` threw above (react
    // query hands `onError` the exact rejection reason, not the raw response
    // body) — running it through `apiError()` a second time treats a real,
    // typed error as an untyped body, finds no nested `.error` on it and
    // falls back to the generic `ERR-SYS-000` "Unexpected error", discarding
    // whatever specific code/message the server actually sent (this is the
    // false "Unexpected error" over a signature that had, in truth, just
    // been correctly refused as a duplicate). `toApiError` is idempotent —
    // it recognizes an `ApiError` instance and passes it through unchanged.
    onError: (err: unknown) => {
      const apiErr = toApiError(err);
      setFormError(signErrorMessage(t, lang, apiErr));
      // `ERR-SIGN-002` (already signed) proves the permit's signatures moved
      // since this screen last read them — refresh instead of leaving the
      // count frozen until the next unrelated reload.
      if (apiErr.code === 'ERR-SIGN-002') onSigned();
    },
  });

  async function handleSign() {
    setFormError(null);
    // Minor finding (fix wave): PINFL/STIR validity (mock mode only) is
    // checked BEFORE the doc_hash precondition — restored to the original
    // order (mock mode had no real-mode branch to interleave with when this
    // was first written). With both wrong, a mock-mode signer now sees the
    // PINFL error again, not a hash message unrelated to what they typed.
    if (isEimzoMock() && !isPlausiblePinflOrStir(pinfl)) {
      setFormError(tr.pinflError);
      return;
    }
    if (!permit.doc_hash) {
      setFormError(tr.notRenderedError);
      return;
    }
    if (isEimzoMock()) {
      const pkcs7 = buildMockPkcs7({
        pinflOrStir: pinfl,
        documentSha256: permit.doc_hash,
        subject: `PINFL=${pinfl}, CN=${me?.user.full_name ?? ''}`,
      });
      mutation.mutate(pkcs7);
      return;
    }
    // Real mode: DETACHED — `signatures.service.sign()` hashes the exact
    // bytes `GET /permits/{id}/pdf` serves and calls
    // `adapter.verify_detached(document, pkcs7)`; no pinfl/STIR to type in,
    // the certificate the signer picks in E-IMZO carries that identity.
    setSigning(true);
    try {
      const bytes = await fetchPermitPdfBytes(permit.id);
      const pkcs7 = await signDocument(bytes);
      mutation.mutate(pkcs7);
    } catch (err) {
      if (err instanceof EimzoError || isProviderUnreachable(err)) {
        setFormError(t(eimzoErrorMessageKey(err)));
      } else if (err instanceof PermitPdfFetchError) {
        // Minor finding (fix wave): this used to be `err.message` verbatim —
        // an English sentence reaching a citizen regardless of interface
        // language.
        setFormError(t('permits.signatures.errors.pdfFetchFailed'));
      } else {
        // Minor finding (fix wave): the fallback was a hardcoded Uzbek
        // literal, bypassing i18n for `ru`/other-language signers.
        setFormError(t('permits.signatures.errors.genericSigningError'));
      }
    } finally {
      setSigning(false);
    }
  }

  if (validRow) {
    // Stage 10, F3 (ruling #183): the full row, if this viewer's `GET
    // /signatures` call could see it — `undefined` (still loading, or
    // refused) renders exactly as an `eri` row always has.
    const full = fullSignatures.get(validRow.id);
    const isSimple = validRow.kind === 'simple' || full?.kind === 'simple';
    const simplePinfl = full && isSimple ? extractPinfl(full.verification) : null;
    return (
      <div className="border border-[#86EFAC] bg-[#F0F7F1] rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] font-bold flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <span className="text-[10px] uppercase font-bold text-[#5A646D]">{getPurposeLabel(purpose, lang)}</span>
          {isSimple && (
            <span
              data-testid="signature-simple-badge"
              className="ml-auto rounded-full border border-[#93C5FD] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]"
            >
              {tr.simpleSignatureBadge}
            </span>
          )}
        </div>
        <div className="space-y-1 font-mono text-[#5A646D] pt-2 border-t border-[#86EFAC]/50">
          {simplePinfl && (
            <div className="flex justify-between">
              <span>{tr.pinflValueLabel}</span>
              <strong className="text-[#1A1F24]">{maskPinfl(simplePinfl)}</strong>
            </div>
          )}
          <div className="flex justify-between">
            <span>{tr.signedAt}</span>
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
        <p className="text-[#5A646D]">{tr.notRequired}</p>
      ) : !eligible ? (
        <p className="text-[#B45309]">{tr.waitingSignature}</p>
      ) : (
        <div className="space-y-2">
          {/* Mock mode only: a real E-IMZO key carries the signer's identity,
              so there is nothing for the operator to type. */}
          {isEimzoMock() && (
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#5A646D] mb-1">{tr.pinflLabel}</span>
              <input
                value={pinfl}
                onChange={(e) => setPinfl(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                maxLength={14}
                className="w-full h-9 rounded-md border border-[#767F87] px-2 font-mono text-xs"
                placeholder="31708860250017"
              />
            </label>
          )}
          {formError && <p className="text-[#B91C1C] font-semibold">{formError}</p>}
          <Button
            variant="primary"
            size="sm"
            fullWidth
            isLoading={mutation.isPending || signing}
            leftIcon={<PenTool className="w-4 h-4" />}
            onClick={() => void handleSign()}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold h-9 text-xs"
          >
            {tr.signButton}
          </Button>
        </div>
      )}
      {invalidAttempts > 0 && <p className="text-[10px] text-[#B91C1C]">{tr.invalidAttempts(invalidAttempts)}</p>}
    </div>
  );
}

/**
 * The permit's ERI signature lines — read exactly as `permit.signatures` and
 * `permit.missing_signatures` report them, never inferred. A paid, unsigned
 * permit (fact 3 of the task brief) shows here as three pending slots and no
 * ACTIVE badge anywhere on the page, honestly.
 *
 * WHICH lines exist is the backend's to say (`permit_required_signatures` is
 * an admin-editable setting; ruling #210 took the recipient's line out of its
 * default): a line is rendered when the permit still misses it or already
 * carries a signature for it, in `SIGNATURE_ORDER`'s print order. So a permit
 * signed under the old four-line rule still shows all four, and a new one
 * shows three — never "3 of 4" on a permit that is in force.
 */
export function PermitSignaturesPanel({ permit, onSigned }: { permit: PermitCardOut; onSigned: () => void }) {
  const { lang } = useLanguage();
  const tr = SIG_I18N[lang as keyof typeof SIG_I18N] ?? SIG_I18N.uz_latn;
  const lines = useMemo(() => {
    const present = new Set<string>(permit.missing_signatures);
    for (const row of permit.signatures) present.add(row.purpose);
    const known = SIGNATURE_ORDER.filter((purpose) => present.has(purpose));
    const extra = [...present].filter((purpose) => !(SIGNATURE_ORDER as readonly string[]).includes(purpose));
    return [...known, ...extra];
  }, [permit.missing_signatures, permit.signatures]);
  const signedCount = lines.length - permit.missing_signatures.length;
  const fullSignaturesQuery = useFullSignatures(permit.id);
  const fullSignatures = useMemo(() => {
    const map = new Map<string, SignatureOut>();
    for (const row of fullSignaturesQuery.data ?? []) map.set(row.id, row);
    return map;
  }, [fullSignaturesQuery.data]);
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <h2 className="text-base font-bold text-[#1A1F24]">{tr.panelTitle}</h2>
        <span className="text-xs font-bold text-[#15803D] bg-[#DCFCE7] px-3 py-1 rounded-full border border-[#86EFAC]">
          {tr.signedCount(signedCount, lines.length)}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lines.map((purpose) => (
          <SignatureSlot
            key={purpose}
            purpose={purpose}
            permit={permit}
            onSigned={onSigned}
            fullSignatures={fullSignatures}
          />
        ))}
      </div>
    </div>
  );
}
