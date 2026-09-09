import { useState } from 'react';
import type { FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../../../components/ui/Feedback';
import { Button } from '../../../../components/ui/button';
import { FormField, Input } from '../../../../components/ui/FormControls';
import { useAuth } from '../../../../auth/useAuth';
import { useApiErrorText } from '../../../../i18n/useApiErrorText';
import { useT } from '../../../../i18n/useT';
import {
  buildMockAttachedSignature,
  EimzoError,
  eimzoErrorMessageKey,
  isEimzoMock,
  isProviderUnreachable,
  PINFL_PATTERN,
  signAttached,
} from '../../../../lib/eimzo';
import { bindCertificate, listMyCertificates, unbindCertificate } from './api';

const CERTIFICATES_KEY = ['profile', 'certificates'] as const;

function statusLabel(status: string, t: (key: string) => string): string {
  if (status === 'revoked') return t('cabinet.certificates.statusRevoked');
  if (status === 'expired') return t('cabinet.certificates.statusExpired');
  return t('cabinet.certificates.statusActive');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * B5 — my ERI certificates. `GET/POST/DELETE /certificates`
 * (`app/modules/signatures/router.py`) carry no permission code and no
 * role restriction beyond `get_current_user` — unlike B4, this tab is
 * offered to every role, since staff sign decisions with their own bound
 * certificates too.
 *
 * Binding one here is a proof-of-possession exercise, not a real document
 * signature — `buildMockAttachedSignature` (ruling R6) signs a throwaway
 * nonce because `POST /certificates` has no document of its own to sign
 * (`CertificateBindIn`'s own docstring: "this route has no document of its
 * own"). Real mode mirrors that exactly: a random client-side nonce, signed
 * ATTACHED (`signAttached` — `register_certificate` calls `verify_attached`,
 * never `verify_detached`) and never timestamped, same as the ERI login
 * challenge in `AuthProvider.tsx` — see `client.ts`'s own docstring for why
 * neither goes through ruling R5's mandatory-timestamp path. No PINFL/name
 * box in real mode: the certificate the signer picks in E-IMZO carries that
 * identity, the same rule task 10 applies everywhere else.
 */
export function CertificatesSection() {
  const { me } = useAuth();
  const t = useT();
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: CERTIFICATES_KEY, queryFn: listMyCertificates });

  const [pinfl, setPinfl] = useState('');
  const [fullName, setFullName] = useState(me?.user.full_name ?? '');
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);
  const [unbindingId, setUnbindingId] = useState<string | null>(null);
  const [unbindError, setUnbindError] = useState<string | null>(null);

  // Mock mode only — a real certificate carries the signer's identity, no
  // PINFL box to validate.
  const pinflValid = !isEimzoMock() || PINFL_PATTERN.test(pinfl);

  async function handleBind(event: FormEvent) {
    event.preventDefault();
    if (!pinflValid || binding) return;
    setBinding(true);
    setBindError(null);
    try {
      const pkcs7 = isEimzoMock()
        ? await buildMockAttachedSignature({ pinfl, fullName: fullName.trim() || undefined })
        : await signAttached(crypto.getRandomValues(new Uint8Array(16)));
      await bindCertificate(pkcs7);
      setPinfl('');
      await queryClient.invalidateQueries({ queryKey: CERTIFICATES_KEY });
    } catch (err) {
      if (err instanceof EimzoError || isProviderUnreachable(err)) {
        setBindError(t(eimzoErrorMessageKey(err)));
      } else {
        setBindError(errorText(err, t('cabinet.registration.genericError')));
      }
    } finally {
      setBinding(false);
    }
  }

  // No confirmation dialog: this codebase's own precedent for a destructive
  // one-click action (`UsersPage.tsx`'s own delete button) is a direct
  // mutation, and unbinding is the least destructive kind — it only takes a
  // key off THIS list, never deletes the row (`DELETE /certificates/{id}`'s
  // own docstring: "unbind, never delete"), and re-binding it needs nothing
  // more than presenting the same key again.
  async function handleUnbind(certificateId: string) {
    setUnbindingId(certificateId);
    setUnbindError(null);
    try {
      await unbindCertificate(certificateId);
      await queryClient.invalidateQueries({ queryKey: CERTIFICATES_KEY });
    } catch (err) {
      setUnbindError(errorText(err, t('cabinet.registration.genericError')));
    } finally {
      setUnbindingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-[#1A1F24] mb-1">{t('cabinet.certificates.title')}</h2>
        <p className="text-xs text-[#5A646D] mb-4">{t('cabinet.certificates.intro')}</p>

        {query.isLoading && <p className="text-sm text-[#5A646D]">…</p>}

        {!query.isLoading && (query.data?.length ?? 0) === 0 && (
          <p data-testid="certificates-empty" className="text-sm text-[#5A646D]">
            {t('cabinet.certificates.listEmpty')}
          </p>
        )}

        {unbindError && (
          <div data-testid="unbind-error">
            <Alert variant="danger">{unbindError}</Alert>
          </div>
        )}

        {(query.data?.length ?? 0) > 0 && (
          <ul className="divide-y divide-[#E4E7EA]">
            {query.data?.map((cert) => (
              <li key={cert.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#1A1F24] font-mono">{cert.serial_number}</p>
                  <p className="text-xs text-[#5A646D]">
                    {cert.subject} · {cert.pinfl_or_stir}
                  </p>
                  <p className="text-xs text-[#5A646D]">
                    {t('cabinet.certificates.validFrom')} {formatDateTime(cert.valid_from)} —{' '}
                    {t('cabinet.certificates.validTo')} {formatDateTime(cert.valid_to)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#15803D]">{statusLabel(cert.status, t)}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid={`unbind-${cert.id}`}
                    disabled={unbindingId === cert.id}
                    isLoading={unbindingId === cert.id}
                    onClick={() => void handleUnbind(cert.id)}
                  >
                    {t('cabinet.certificates.unbind')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-[#1A1F24] mb-3">{t('cabinet.certificates.bind')}</h2>
        <form onSubmit={(e) => void handleBind(e)} noValidate className="space-y-4">
          {isEimzoMock() ? (
            <>
              <FormField label={t('cabinet.certificates.pinflLabel')} required>
                <Input
                  data-testid="certificate-pinfl"
                  inputMode="numeric"
                  value={pinfl}
                  onChange={(e) => setPinfl(e.target.value.replace(/\D/g, '').slice(0, 14))}
                />
              </FormField>
              <FormField label={t('cabinet.certificates.fullNameLabel')}>
                <Input data-testid="certificate-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </FormField>
            </>
          ) : (
            // Real mode: no PINFL/name box — the certificate the signer
            // picks in E-IMZO carries that identity (task 10's own rule).
            <p className="text-xs text-[#5A646D]">{t('cabinet.certificates.realHint')}</p>
          )}
          {bindError && (
            <div data-testid="bind-error">
              <Alert variant="danger">{bindError}</Alert>
            </div>
          )}
          <Button type="submit" data-testid="bind-submit" disabled={!pinflValid || binding} isLoading={binding}>
            {binding ? t('cabinet.certificates.binding') : t('cabinet.certificates.bind')}
          </Button>
        </form>
      </section>
    </div>
  );
}
