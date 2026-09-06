/**
 * Turns whatever the inspector's "Check" field holds into the token
 * `usePublicPermitCheck` sends as `qr` — a pasted `{public_base_url}/check
 * ?qr=TOKEN` URL (the shape the printed QR itself encodes, `tz/03`), or the
 * bare token typed by hand or pasted from a plain-text scanner app. There is
 * no real camera-based QR scanning in this app: `package.json` carries no
 * barcode-reading dependency, and adding one is an architecture decision
 * outside this track's authority (see the final report).
 */
export function parseQrInput(raw: string): { qr: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const qr = url.searchParams.get('qr');
    if (qr) return { qr };
  } catch {
    // Not a parseable absolute URL — falls through to the bare-token case.
  }

  // Either not a URL at all, or a URL with no `qr` param (nothing to
  // extract) — the whole trimmed input IS the token in both cases.
  return { qr: trimmed };
}
