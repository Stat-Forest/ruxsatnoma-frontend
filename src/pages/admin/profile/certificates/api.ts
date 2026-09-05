import { api } from '../../../../api/client';
import { apiError } from '../../../../api/errors';
import type { components } from '../../../../api/schema';

export type CertificateOut = components['schemas']['CertificateOut'];

/** `GET /certificates` — the caller's own BOUND certificates only
 * (`unbound_at IS NULL`, `signatures/router.py`). One page is enough here:
 * a person binds a handful of keys at most, never enough to paginate. */
export async function listMyCertificates(): Promise<CertificateOut[]> {
  const { data, error } = await api.GET('/api/v1/certificates', {
    params: { query: { page: 1, page_size: 100 } },
  });
  if (error) throw apiError(error);
  return data.items;
}

/** `POST /certificates` — bind ahead of any real signing, from a
 * self-contained ATTACHED envelope (`CertificateBindIn.pkcs7`). */
export async function bindCertificate(pkcs7: string): Promise<CertificateOut> {
  const { data, error } = await api.POST('/api/v1/certificates', { body: { pkcs7 } });
  if (error) throw apiError(error);
  return data;
}

/** `DELETE /certificates/{id}` — unbind (never delete): the owner only. */
export async function unbindCertificate(certificateId: string): Promise<void> {
  const { error } = await api.DELETE('/api/v1/certificates/{certificate_id}', {
    params: { path: { certificate_id: certificateId } },
  });
  if (error) throw apiError(error);
}
