import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../../../../components/ui/Feedback';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, RadioGroup, Select } from '../../../../components/ui/FormControls';
import { useAuth } from '../../../../auth/useAuth';
import { useApiErrorText } from '../../../../i18n/useApiErrorText';
import { useT } from '../../../../i18n/useT';
import { PINFL_PATTERN, buildMockSignedChallenge } from '../../../../lib/eimzoMock';
import { addRepresentation, attachLegal, issueEimzoChallenge, uploadPoaFile } from './api';
import type { AddRepresentationIn, AttachLegalIn } from './api';
import { formatDate } from './format';

type Basis = 'org_eri' | 'director_registry' | 'poa';
const STIR_PATTERN = /^\d{9}$/;

/** The three-basis picker shared by "attach a legal entity" (B4's own
 * `AttachLegalIn.basis`) and "add a colleague" (`AddRepresentationIn.basis`)
 * — same three values, same backend meaning, one place their copy lives. */
function BasisPicker({ value, onChange }: { value: Basis; onChange: (b: Basis) => void }) {
  const t = useT();
  return (
    <RadioGroup
      name="basis"
      selectedValue={value}
      onChange={(v) => onChange(v as Basis)}
      options={[
        { value: 'org_eri', label: t('cabinet.representation.basisOrgEri'), hint: t('cabinet.representation.basisOrgEriHint') },
        {
          value: 'director_registry',
          label: t('cabinet.representation.basisDirector'),
          hint: t('cabinet.representation.basisDirectorHint'),
        },
        { value: 'poa', label: t('cabinet.representation.basisPoa'), hint: t('cabinet.representation.basisPoaHint') },
      ]}
    />
  );
}

function RepresentationsList() {
  const { me } = useAuth();
  const t = useT();
  const rows = me?.representations ?? [];

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs">
      <h2 className="text-base font-bold text-[#1A1F24] mb-3">{t('cabinet.representation.listTitle')}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[#5A646D]">{t('cabinet.representation.listEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[#E4E7EA]">
          {rows.map((rep) => (
            <li key={rep.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1F24] break-words">{rep.applicant.name}</p>
                <p className="text-xs text-[#5A646D] break-words">
                  STIR {rep.applicant.stir} · {t(`cabinet.representation.basisShort.${rep.basis}`)}
                  {' · '}
                  {t('cabinet.representation.validFrom')} {formatDate(rep.valid_from)}
                  {' — '}
                  {rep.valid_until ? formatDate(rep.valid_until) : t('cabinet.representation.validUntilNone')}
                </p>
              </div>
              <span className="text-xs font-semibold text-[#15803D] shrink-0 self-start sm:self-auto">
                {t('cabinet.representation.statusActive')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachLegalForm() {
  const { me, refreshMe } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();

  const [stir, setStir] = useState('');
  const [basis, setBasis] = useState<Basis>('org_eri');
  const [signerPinfl, setSignerPinfl] = useState('');
  const [orgName, setOrgName] = useState('');
  const [poaFileId, setPoaFileId] = useState<string | null>(null);
  const [poaFileName, setPoaFileName] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stirValid = STIR_PATTERN.test(stir);
  const signerPinflValid = PINFL_PATTERN.test(signerPinfl);
  const canSubmit =
    stirValid &&
    (basis === 'director_registry' ||
      (basis === 'org_eri' && signerPinflValid) ||
      (basis === 'poa' && poaFileId !== null && validUntil !== '' && orgName.trim() !== ''));

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadPoaFile(file);
      setPoaFileId(uploaded.id);
      setPoaFileName(uploaded.filename);
    } catch (err) {
      setError(errorText(err, t('cabinet.registration.genericError')));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: AttachLegalIn = { stir, basis };
      if (basis === 'org_eri') {
        const challenge = await issueEimzoChallenge();
        body.signed_challenge = await buildMockSignedChallenge({
          challenge,
          pinfl: signerPinfl,
          fullName: me?.user.full_name ?? '',
          tin: stir,
        });
      } else if (basis === 'poa') {
        body.poa_file_id = poaFileId;
        body.valid_until = validUntil;
        body.name = orgName.trim();
      }
      await attachLegal(body);
      await refreshMe();
      setStir('');
      setSignerPinfl('');
      setOrgName('');
      setPoaFileId(null);
      setPoaFileName(null);
      setValidUntil('');
      setTouched(false);
    } catch (err) {
      setError(errorText(err, t('cabinet.registration.genericError')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs">
      <h2 className="text-base font-bold text-[#1A1F24] mb-1">{t('cabinet.representation.attachTitle')}</h2>
      <p className="text-xs text-[#5A646D] mb-4">{t('cabinet.representation.attachIntro')}</p>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
        <FormField
          label={t('cabinet.representation.stirLabel')}
          required
          error={touched && stir !== '' && !stirValid ? t('cabinet.representation.invalidStir') : undefined}
        >
          <Input
            data-testid="attach-stir"
            inputMode="numeric"
            value={stir}
            onChange={(e) => setStir(e.target.value.replace(/\D/g, '').slice(0, 9))}
          />
        </FormField>

        <FormField label={t('cabinet.representation.basisLabel')}>
          <BasisPicker value={basis} onChange={setBasis} />
        </FormField>

        {basis === 'org_eri' && (
          <FormField
            label={t('cabinet.representation.signerPinflLabel')}
            required
            error={
              touched && signerPinfl !== '' && !signerPinflValid
                ? t('cabinet.representation.invalidPinfl')
                : undefined
            }
          >
            <Input
              data-testid="attach-signer-pinfl"
              inputMode="numeric"
              value={signerPinfl}
              onChange={(e) => setSignerPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
            />
          </FormField>
        )}

        {basis === 'poa' && (
          <>
            <FormField label={t('cabinet.representation.orgNameLabel')} required>
              <Input data-testid="attach-org-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            </FormField>
            <FormField label={t('cabinet.representation.poaFileLabel')} required>
              <input
                data-testid="attach-poa-file"
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
                className="block w-full text-sm text-[#1A1F24]"
              />
              {uploading && <p className="text-xs text-[#5A646D] mt-1">{t('cabinet.representation.poaUploading')}</p>}
              {poaFileName && (
                <p data-testid="attach-poa-uploaded" className="text-xs text-[#15803D] mt-1">
                  {t('cabinet.representation.poaUploaded')}: {poaFileName}
                </p>
              )}
            </FormField>
            <FormField label={t('cabinet.representation.validUntilLabel')} required>
              <Input
                data-testid="attach-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormField>
          </>
        )}

        {error && (
          <div data-testid="attach-error">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        <Button type="submit" data-testid="attach-submit" disabled={submitting} isLoading={submitting} className="w-full sm:w-auto">
          {submitting ? t('cabinet.representation.attachSubmitting') : t('cabinet.representation.attachSubmit')}
        </Button>
      </form>
    </section>
  );
}

function AddColleagueForm() {
  const { me, refreshMe } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();

  // Mirrors the backend's own rule (`auth.service.add_representation`): only
  // an `org_eri`/`director_registry` representation may add a second
  // representative — a `poa`-based one is refused with ERR-ACL-001, so it is
  // not offered here at all (house rule: an action the backend would refuse
  // is not offered).
  const eligible = (me?.representations ?? []).filter(
    (rep) => rep.basis === 'org_eri' || rep.basis === 'director_registry',
  );

  const [applicantId, setApplicantId] = useState('');
  const [colleaguePinfl, setColleaguePinfl] = useState('');
  const [basis, setBasis] = useState<Basis>('org_eri');
  const [signerPinfl, setSignerPinfl] = useState('');
  const [poaFileId, setPoaFileId] = useState<string | null>(null);
  const [poaFileName, setPoaFileName] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (eligible.length === 0) {
    return (
      <section className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs">
        <h2 className="text-base font-bold text-[#1A1F24] mb-1">{t('cabinet.representation.addColleagueTitle')}</h2>
        <p className="text-xs text-[#5A646D]">{t('cabinet.representation.needOrgEriOrDirector')}</p>
      </section>
    );
  }

  const selected = eligible.find((rep) => rep.applicant.id === applicantId) ?? eligible[0];
  const colleaguePinflValid = PINFL_PATTERN.test(colleaguePinfl);
  const signerPinflValid = PINFL_PATTERN.test(signerPinfl);
  const canSubmit =
    colleaguePinflValid &&
    (basis === 'director_registry' ||
      (basis === 'org_eri' && signerPinflValid) ||
      (basis === 'poa' && poaFileId !== null && validUntil !== ''));

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadPoaFile(file);
      setPoaFileId(uploaded.id);
      setPoaFileName(uploaded.filename);
    } catch (err) {
      setError(errorText(err, t('cabinet.registration.genericError')));
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const body: AddRepresentationIn = { user_pinfl: colleaguePinfl, basis };
      if (basis === 'org_eri') {
        const challenge = await issueEimzoChallenge();
        body.signed_challenge = await buildMockSignedChallenge({
          challenge,
          pinfl: signerPinfl,
          fullName: me?.user.full_name ?? '',
          tin: selected.applicant.stir ?? undefined,
        });
      } else if (basis === 'poa') {
        body.poa_file_id = poaFileId;
        body.valid_until = validUntil;
      }
      await addRepresentation(selected.applicant.id, body);
      await refreshMe();
      setColleaguePinfl('');
      setSignerPinfl('');
      setPoaFileId(null);
      setPoaFileName(null);
      setValidUntil('');
      setTouched(false);
    } catch (err) {
      setError(errorText(err, t('cabinet.registration.genericError')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-white border border-[#E4E7EA] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs">
      <h2 className="text-base font-bold text-[#1A1F24] mb-1">{t('cabinet.representation.addColleagueTitle')}</h2>
      <p className="text-xs text-[#5A646D] mb-4">{t('cabinet.representation.addColleagueIntro')}</p>
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
        {eligible.length > 1 && (
          <FormField label={t('cabinet.representation.selectOrgLabel')}>
            <Select
              data-testid="colleague-applicant"
              value={selected?.applicant.id}
              onChange={(e) => setApplicantId(e.target.value)}
              options={eligible.map((rep) => ({ value: rep.applicant.id, label: rep.applicant.name }))}
            />
          </FormField>
        )}

        <FormField
          label={t('cabinet.representation.colleaguePinflLabel')}
          required
          error={
            touched && colleaguePinfl !== '' && !colleaguePinflValid
              ? t('cabinet.representation.invalidPinfl')
              : undefined
          }
        >
          <Input
            data-testid="colleague-pinfl"
            inputMode="numeric"
            value={colleaguePinfl}
            onChange={(e) => setColleaguePinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
          />
        </FormField>

        <FormField label={t('cabinet.representation.basisLabel')}>
          <BasisPicker value={basis} onChange={setBasis} />
        </FormField>

        {basis === 'org_eri' && (
          <FormField label={t('cabinet.representation.signerPinflLabel')} required>
            <Input
              data-testid="colleague-signer-pinfl"
              inputMode="numeric"
              value={signerPinfl}
              onChange={(e) => setSignerPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
            />
          </FormField>
        )}

        {basis === 'poa' && (
          <>
            <FormField label={t('cabinet.representation.poaFileLabel')} required>
              <input
                data-testid="colleague-poa-file"
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
                className="block w-full text-sm text-[#1A1F24]"
              />
              {poaFileName && (
                <p data-testid="colleague-poa-uploaded" className="text-xs text-[#15803D] mt-1">
                  {t('cabinet.representation.poaUploaded')}: {poaFileName}
                </p>
              )}
            </FormField>
            <FormField label={t('cabinet.representation.validUntilLabel')} required>
              <Input
                data-testid="colleague-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormField>
          </>
        )}

        {error && (
          <div data-testid="colleague-error">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        <Button type="submit" data-testid="colleague-submit" disabled={submitting} isLoading={submitting} className="w-full sm:w-auto">
          {t('cabinet.representation.addColleagueSubmit')}
        </Button>
      </form>
    </section>
  );
}

/**
 * B4 — legal-entity representation. Covers both routes the backend offers
 * (ruling R5, `docs/plans/06.5-cabinet-tails.md`): `attachLegal`
 * (`POST /auth/applicants`) for becoming a legal entity's first
 * representative, and `addRepresentation`
 * (`POST /auth/applicants/{id}/representations`) for adding a colleague to
 * one the caller already represents through `org_eri`/`director_registry`.
 *
 * `me.representations` (from `GET /auth/me`) is already the EFFECTIVE list
 * — `auth.router._me_out` builds it from `repo.effective_representations`,
 * which filters to `status='active'` and not past `valid_until` server-side
 * — so every row shown here is currently in force; there is no "expired"
 * row to render differently.
 *
 * Rendered only for `role.code === 'applicant'` by `ProfilePage` (every
 * other role's `attach_legal`/`add_representation` call would be refused
 * with `ERR-ACL-001`, and an action the backend would refuse is not offered
 * at all).
 */
export function RepresentationSection() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <RepresentationsList />
      <AttachLegalForm />
      <AddColleagueForm />
    </div>
  );
}
