/**
 * What the header advertises for help: the technical-support line and the
 * video guide (Oybek, 2026-09-11). The extension is shown next to the number
 * rather than folded into the `tel:` href — a `;ext=` suffix is dialled by
 * almost no phone app, and a caller who sees "1010" can key it themselves.
 *
 * `VIDEO_GUIDE_URL` is a PLACEHOLDER (YouTube's front page) until the Agency
 * records and sends the real guide — replace the one constant, nothing else
 * knows the address. `SupportPage` carries its own call-centre number, not
 * reconciled with this one yet.
 */
export const SUPPORT_PHONE = '+998 71 207 88 77';
export const SUPPORT_PHONE_HREF = 'tel:+998712078877';
export const SUPPORT_EXTENSION = '1010';
export const VIDEO_GUIDE_URL = 'https://www.youtube.com/';
