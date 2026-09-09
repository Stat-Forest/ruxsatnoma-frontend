/**
 * Typed wrappers around the three `/payments/recipients` routes (stage 7.9,
 * decisions #154, #157), in the shape `admin/legalDocuments/api.ts`
 * established: one thin `async` function per route, every type read out of
 * the generated `src/api/schema.d.ts`, never hand-written.
 *
 * There is no `deleteRecipient` — the backend exposes no DELETE at all. A
 * receiver is deactivated through `PATCH .../{id}` with `active: false`,
 * never removed: a deleted row would break every report over a period in
 * which it was still being paid.
 */
import { api } from '../../../api/client';
import { apiError } from '../../../api/errors';
import type { components } from '../../../api/schema';

export type PaymentRecipientOut = components['schemas']['PaymentRecipientOut'];
export type PaymentRecipientIn = components['schemas']['PaymentRecipientIn'];
export type PaymentRecipientPatch = components['schemas']['PaymentRecipientPatch'];
export type PaymentRecipientPage = components['schemas']['Page_PaymentRecipientOut_'];
export type LocalizedName = components['schemas']['LocalizedName'];
export type RecipientKind = PaymentRecipientIn['kind'];

/**
 * `GET /payments/recipients` takes no `active` filter — an administrator has
 * to see a deactivated row too, in order to reactivate it, so this reads the
 * whole directory every time. `page_size: 100` is generous on purpose: this
 * is a small, centrally-configured directory, not a growing register, so a
 * second page is not a real case this screen needs to handle.
 */
export async function listRecipients(): Promise<PaymentRecipientPage> {
  const { data, error } = await api.GET('/api/v1/payments/recipients', {
    params: { query: { page: 1, page_size: 100 } },
  });
  if (error) throw apiError(error);
  return data;
}

/**
 * `POST /payments/recipients`. `active` is deliberately absent from
 * `PaymentRecipientIn` (every new row starts active) and so is not a
 * parameter here either — see that schema's own docstring.
 */
export async function createRecipient(body: PaymentRecipientIn): Promise<PaymentRecipientOut> {
  const { data, error } = await api.POST('/api/v1/payments/recipients', { body });
  if (error) throw apiError(error);
  return data;
}

/** `PATCH /payments/recipients/{id}` — `exclude_unset=True` on the backend
 *  (the same convention `patchLegalDocument` documents): only the keys this
 *  form actually sends are touched. `kind` never changes after creation, so
 *  it is not part of `PaymentRecipientPatch` at all. */
export async function patchRecipient(
  recipientId: string,
  body: PaymentRecipientPatch,
): Promise<PaymentRecipientOut> {
  const { data, error } = await api.PATCH('/api/v1/payments/recipients/{recipient_id}', {
    params: { path: { recipient_id: recipientId } },
    body,
  });
  if (error) throw apiError(error);
  return data;
}
