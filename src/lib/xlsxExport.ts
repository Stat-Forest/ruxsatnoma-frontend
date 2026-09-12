/**
 * Stage 13 (ruling #204): the one download path behind every register's
 * «Excel» button. The file is built on the SERVER — `GET <list>/export.xlsx`
 * with the list's own filters, the same service function, the same zone —
 * so this module never pages a list itself (the client-side CSV loop it
 * replaces did, and 10 000 rows meant 100 requests; Oybek: «ne pravilno»).
 *
 * Bypasses the typed `openapi-fetch` client on purpose, the way
 * `reports/api.ts::fetchExport` does: the response is a binary body, and a
 * plain `fetch` with `credentials: 'include'` is the whole contract.
 */
import type { UiLanguage } from '../i18n/context';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/** The two header languages the server renders (ruling R5). */
export type ExportLang = 'uz_latn' | 'ru';

/** A screen's list query, passed verbatim — the typed filter interfaces the
 *  pages build (`ApplicationListFilters`, `RiskIndicatorFilters`, …) have no
 *  index signature, so this is `object`: primitive values become query
 *  parameters, paging keys and empties are stripped, anything else is
 *  skipped rather than stringified. */
export type ExportQuery = object;

export interface ExportResult {
  /** The server cut the file at its cap (`register_export_max_rows`). */
  truncated: boolean;
  /** Rows matching the filter, cap or no cap. */
  total: number;
  /** Rows actually written to the file. */
  rows: number;
}

const PAGING_KEYS = new Set(['page', 'page_size', 'limit', 'offset']);

/** `ru` reads `ru`; every other UI language reads `uz_latn` — the one
 *  language decision #90 guarantees on every localized name. */
export function exportLang(lang: UiLanguage): ExportLang {
  return lang === 'ru' ? 'ru' : 'uz_latn';
}

export function buildExportUrl(path: string, query: ExportQuery, lang: ExportLang): string {
  const url = new URL(`${API_BASE}${path}/export.xlsx`);
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (PAGING_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('lang', lang);
  return url.toString();
}

/** The name the server put in `Content-Disposition` — the RFC 5987
 *  `filename*=` first (it carries the exact, possibly non-ASCII name), the
 *  legacy `filename=` next, a generated name if neither is there. */
function filenameFrom(disposition: string | null, path: string): string {
  const star = disposition?.match(/filename\*=UTF-8''([^;]+)/i);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      // A malformed percent-encoding falls through to the plain name.
    }
  }
  const plain = disposition?.match(/filename="([^"]+)"/i);
  if (plain) return plain[1];
  const last = path.split('/').filter(Boolean).pop() ?? 'export';
  return `${last}-${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadXlsx(
  path: string,
  query: ExportQuery,
  lang: ExportLang,
): Promise<ExportResult> {
  const res = await fetch(buildExportUrl(path, query, lang), { credentials: 'include' });
  if (!res.ok) {
    let message = `Faylni yuklab boʻlmadi (${res.status})`;
    try {
      const body = (await res.clone().json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      // The body was not JSON — the fallback message above stays.
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  triggerDownload(blob, filenameFrom(res.headers.get('Content-Disposition'), path));
  const total = Number(res.headers.get('X-Export-Total') ?? 0);
  const rows = Number(res.headers.get('X-Export-Rows') ?? total);
  return {
    truncated: res.headers.get('X-Export-Truncated') === 'true',
    total,
    rows,
  };
}
