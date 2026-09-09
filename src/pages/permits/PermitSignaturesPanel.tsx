import { useState } from 'react';
import { CheckCircle2, PenTool } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/client';
import { apiError, ApiError } from '../../api/errors';
import type { components } from '../../api/schema';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/button';
import { useT } from '../../i18n/useT';
import {
  EimzoError,
  buildMockPkcs7,
  canAttemptPurpose,
  eimzoErrorMessageKey,
  isEimzoMock,
  isPlausiblePinflOrStir,
  isProviderUnreachable,
  PURPOSE_LABEL,
  RECIPIENT_PURPOSE,
  signDocument,
  SIGNATURE_ORDER,
} from '../../lib/eimzo';
import { toApiError } from './apiErrorHelpers';
import { formatDateTime } from './format';

type PermitCardOut = components['schemas']['PermitCardOut'];

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
 * specifically so a client can do this instead of guessing.
 */
const SIGN_ERROR_REASON_KEYS: Record<string, string> = {
  purpose_not_required: 'permits.signatures.errors.purposeNotRequired',
  signature_invalid: 'permits.signatures.errors.signatureInvalid',
  certificate_pinfl_mismatch: 'permits.signatures.errors.certificatePinflMismatch',
  signer_pinfl_unknown: 'permits.signatures.errors.signerPinflUnknown',
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
function signErrorMessage(t: (key: string) => string, err: ApiError): string {
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
  if (err.code === 'ERR-SIGN-001') {
    const key = reason ? SIGN_ERROR_REASON_KEYS[reason] : undefined;
    return t(key ?? 'permits.signatures.errors.signRefusedGeneric');
  }
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
  const t = useT();
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
      setFormError(signErrorMessage(t, apiErr));
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
      setFormError("PINFL 14 ta, tashkilot STIR 9 ta raqamdan iborat boʻlishi kerak.");
      return;
    }
    if (!permit.doc_hash) {
      setFormError("Hujjat hali render qilinmagan — imzolab boʻlmaydi.");
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
    return (
      <div className="border border-[#86EFAC] bg-[#F0F7F1] rounded-xl p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-[#DCFCE7] border border-[#86EFAC] text-[#15803D] font-bold flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </span>
          <span className="text-[10px] uppercase font-bold text-[#5A646D]">{PURPOSE_LABEL[purpose] ?? purpose}</span>
        </div>
        <div className="space-y-1 font-mono text-[#5A646D] pt-2 border-t border-[#86EFAC]/50">
          <div className="flex justify-between">
            <span>Imzolangan:</span>
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
        <span className="text-[10px] uppercase font-bold text-[#5A646D]">{PURPOSE_LABEL[purpose] ?? purpose}</span>
      </div>

      {!isMissing ? (
        <p className="text-[#5A646D]">Bu qator hozircha talab qilinmagan roʻyxatda emas.</p>
      ) : !eligible ? (
        <p className="text-[#B45309]">Imzo kutilmoqda — bu qatorni faqat tegishli mansabdor imzolashi mumkin.</p>
      ) : (
        <div className="space-y-2">
          {isEimzoMock() && (
            <label className="block">
              <span className="block text-[11px] font-semibold text-[#5A646D] mb-1">
                PINFL (14 ta) yoki tashkilot STIR (9 ta raqam)
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
            E-IMZO bilan imzolash
          </Button>
        </div>
      )}
      {invalidAttempts > 0 && (
        <p className="text-[10px] text-[#B91C1C]">
          {invalidAttempts} ta muvaffaqiyatsiz urinish qayd etilgan (audit jurnalida saqlanadi).
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
  const signedCount = SIGNATURE_ORDER.length - permit.missing_signatures.length;
  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs font-sans space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <h2 className="text-base font-bold text-[#1A1F24]">Elektron raqamli imzolar</h2>
        <span className="text-xs font-bold text-[#15803D] bg-[#DCFCE7] px-3 py-1 rounded-full border border-[#86EFAC]">
          Imzolangan {signedCount} dan {SIGNATURE_ORDER.length}
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
