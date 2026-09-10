/**
 * The ERI sign action for an inspection act (task 5) — an inline card, not
 * a full-screen dialog: `PermitSignaturesPanel.tsx`'s `SignatureSlot` inline
 * layout fits a long phone-scroll form better than
 * `SignDecisionModal.tsx`'s modal. Only ever mounted by `ActFormPage` while
 * `act.status === 'draft' && act.inspector_id === me.user.id` (`POST
 * .../sign` hard-refuses anyone else, `ERR-ACL-001`) — nothing here repeats
 * that check, and there is no read-only variant to render: once signed, the
 * act carries no signature detail of its own to show (`ActOut`/`ActCardOut`
 * have no `signatures` field, only `status`), so `ActFormPage`'s own
 * `readOnlyNotice` already says everything there is to say.
 */
import { useState } from 'react';
import { PenTool } from 'lucide-react';
import { useAuth } from '../../../auth/useAuth';
import { useLanguage, useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { buildMockSignature, eimzoErrorMessageKey, isEimzoMock, PINFL_PATTERN, signDocument } from '../../../lib/eimzo';
import { pickLocalizedName } from '../format';
import { actPackageBytes } from '../actPackage';
import { useSignAct, useViolationTypes, type ActCardOut, type ActOut } from '../queries';

export interface ActSignCardProps {
  act: ActCardOut;
  /** Fired with the freshly-signed `ActOut` — `ActFormPage` owns what
   *  happens next (finding and routing to the violation case a
   *  `result: 'violation'` sign just opened is page-level orchestration,
   *  not this card's job). */
  onSigned: (signed: ActOut) => void;
}

export function ActSignCard({ act, onSigned }: ActSignCardProps) {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const { me } = useAuth();
  const [violationTypeId, setViolationTypeId] = useState('');
  const [pinfl, setPinfl] = useState('');
  const [pinflTouched, setPinflTouched] = useState(false);
  // Real mode only: `signDocument` runs BEFORE `signAct.mutate`, so its own
  // failure never reaches `signAct.error`/`apiError` below — the same split
  // `PermitSignaturesPanel.tsx`/`PermitLifecyclePanel.tsx` make.
  const [eimzoErrorKey, setEimzoErrorKey] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const violationTypesQuery = useViolationTypes();
  const signAct = useSignAct(act.id);

  // `service.py::sign_act` — mandatory exactly when the act's own `result`
  // is `'violation'`, never otherwise (`ERR-VAL-001 violation_type_required`).
  const requiresViolationType = act.result === 'violation';
  // Mock mode only — a real certificate carries the signer's identity, no
  // PINFL box to validate (task 10's own rule, `ActSignCard`'s equivalent
  // named in the brief).
  const pinflValid = !isEimzoMock() || PINFL_PATTERN.test(pinfl);
  // `pinflValid` is deliberately NOT part of `canSubmit` — the same choice
  // `SignDecisionModal.tsx`/`PermitLifecyclePanel.tsx` make: with it here, a
  // blank PINFL would simply disable the button with no explanation. It
  // stays clickable so `handleSign` runs its own check and says why.
  const canSubmit = (!requiresViolationType || violationTypeId !== '') && !signAct.isPending && !signing;

  async function handleSign() {
    if (isEimzoMock() && !PINFL_PATTERN.test(pinfl)) {
      setPinflTouched(true);
      return;
    }
    setEimzoErrorKey(null);
    const documentBytes = actPackageBytes({
      id: act.id,
      inspectorId: act.inspector_id,
      occurredAtIso: act.occurred_at,
      checklistId: act.checklist_id,
      answers: act.answers,
      facts: act.facts,
      result: act.result,
    });
    let pkcs7: string;
    if (isEimzoMock()) {
      pkcs7 = await buildMockSignature({ pinfl, documentBytes, fullName: me?.user.full_name });
    } else {
      // Real mode: DETACHED — `sign_act` verifies against the exact
      // canonical bytes above (`actPackage.ts`'s own docstring), no PINFL
      // to type in, the signer's certificate carries that identity.
      setSigning(true);
      try {
        pkcs7 = await signDocument(new Uint8Array(documentBytes));
      } catch (err) {
        // Important 3 (review of stage 5.2): this used to render a message
        // only for `EimzoError`/`isProviderUnreachable` and otherwise
        // `return` bare, so anything else (the timestamp route's own rate
        // limit, ERR-AUTH-002, a network blip) vanished — the button
        // stopped spinning and nothing appeared. `eimzoErrorMessageKey`
        // already has a generic fallback for anything it does not
        // recognize, so the guard bought nothing but a silent failure.
        setEimzoErrorKey(eimzoErrorMessageKey(err));
        return;
      } finally {
        setSigning(false);
      }
    }
    signAct.mutate(
      { pkcs7, violation_type_item_id: requiresViolationType ? violationTypeId : undefined },
      { onSuccess: onSigned },
    );
  }

  const apiError = signAct.error instanceof ApiError ? signAct.error : null;

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">{t('inspector.actForm.sign.title')}</p>

      {requiresViolationType && (
        <FormField label={t('inspector.actForm.sign.violationTypeLabel')} required>
          <Select
            touchSize
            value={violationTypeId}
            onChange={(e) => setViolationTypeId(e.target.value)}
            options={[
              { value: '', label: t('inspector.actForm.sign.violationTypePlaceholder') },
              ...(violationTypesQuery.data ?? []).map((item) => ({
                value: item.id,
                label: pickLocalizedName(item.name, lang) || item.code,
              })),
            ]}
          />
        </FormField>
      )}

      {isEimzoMock() && (
        <FormField
          label={t('inspector.actForm.sign.pinflLabel')}
          required
          error={pinflTouched && !pinflValid ? t('inspector.actForm.sign.pinflError') : undefined}
        >
          <Input
            touchSize
            inputMode="numeric"
            value={pinfl}
            onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
            onBlur={() => setPinflTouched(true)}
            placeholder="31708860250017"
          />
        </FormField>
      )}

      {eimzoErrorKey && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          <p>{t(eimzoErrorKey)}</p>
        </div>
      )}

      {apiError && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          <p>{errorText(apiError)}</p>
        </div>
      )}

      <Button
        type="button"
        size="touch"
        variant="primary"
        fullWidth
        disabled={!canSubmit}
        isLoading={signAct.isPending || signing}
        leftIcon={<PenTool className="w-4 h-4" />}
        onClick={() => void handleSign()}
      >
        {t('inspector.actForm.sign.signButton')}
      </Button>
    </div>
  );
}
