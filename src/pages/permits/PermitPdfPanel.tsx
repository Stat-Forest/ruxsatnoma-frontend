import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';

// Not imported from `src/api/client.ts`: that module's `BASE_URL` is not
// exported, and this is the one call in Track 4's scope that cannot go
// through `api.GET` (openapi-fetch parses every response as JSON; this route
// answers `application/pdf`). Same fallback default as `client.ts`'s own —
// see that file if the two ever need to move together.
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** No state of its own — a plain fetch that resolves to a `Blob` or throws a
 *  message-bearing `Error`. Kept separate from the component so neither call
 *  site (the mount effect below, and the "Yangilash" button) has to route
 *  through a shared function that itself calls `setState`. */
async function fetchPermitPdf(permitId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/v1/permits/${permitId}/pdf`, { credentials: 'include' });
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
  return res.blob();
}

/**
 * Fact 1 (task brief): the PDF is rendered exactly once at issuance and these
 * are the exact bytes `doc_hash` was frozen over — this panel only ever
 * fetches `GET /permits/{id}/pdf` and shows what came back, never anything
 * that could be read as "regenerate". `credentials: 'include'` is set by
 * hand because this fetch bypasses `src/api/client.ts` entirely (binary
 * response, see above) and so does not inherit its CSRF/session middleware —
 * acceptable here since this is a plain GET, which needs neither.
 */
export function PermitPdfPanel({ permitId, fileName, ready }: { permitId: string; fileName: string; ready: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mirrors `AuthProvider`'s own mount-effect shape: every `setState` call
  // lives inside the async callback, never synchronously in the effect body,
  // and a `cancelled` flag drops a response that resolves after the id
  // (or this panel) has already moved on.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      setState('loading');
      setError(null);
      try {
        const blob = await fetchPermitPdf(permitId);
        if (cancelled) return;
        setUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return URL.createObjectURL(blob);
        });
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Faylni yuklab boʻlmadi');
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permitId, ready]);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  async function reload() {
    setState('loading');
    setError(null);
    try {
      const blob = await fetchPermitPdf(permitId);
      setUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Faylni yuklab boʻlmadi');
      setState('error');
    }
  }

  if (!ready) {
    return (
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs font-sans text-xs text-[#5A646D]">
        Hujjat hali render qilinmagan.
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E4E7EA] pb-3">
        <h3 className="text-sm font-bold text-[#1A1F24] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#2E7D4F]" /> PDF/A-1b hujjat
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            isLoading={state === 'loading'}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            onClick={() => void reload()}
          >
            Yangilash
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!url}
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => url && triggerDownload(url, fileName)}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold"
          >
            Yuklab olish
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-[#B91C1C] font-semibold">{error}</p>}
      {url && (
        <iframe
          title="Ruxsatnoma PDF"
          src={url}
          className="w-full h-[70vh] border border-[#E4E7EA] rounded-xl bg-[#F8F9FA]"
        />
      )}
    </div>
  );
}
