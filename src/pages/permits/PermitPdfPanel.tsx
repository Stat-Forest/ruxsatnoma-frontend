import { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLanguage } from '../../i18n/useT';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const PDF_PANEL_I18N = {
  uz_latn: {
    title: 'PDF/A-1b hujjat',
    refresh: 'Yangilash',
    download: 'Yuklab olish',
    notReady: 'Hujjat hali render qilinmagan.',
    loadError: 'Faylni yuklab boʻlmadi',
  },
  uz_cyrl: {
    title: 'PDF/A-1b ҳужжат',
    refresh: 'Янгилаш',
    download: 'Юклаб олиш',
    notReady: 'Ҳужжат ҳали рендер қилинмаган.',
    loadError: 'Файлни юклаб бўлмади',
  },
  ru: {
    title: 'PDF/A-1b документ',
    refresh: 'Обновить',
    download: 'Скачать',
    notReady: 'Документ еще не сформирован.',
    loadError: 'Не удалось загрузить файл',
  },
  en: {
    title: 'PDF/A-1b document',
    refresh: 'Refresh',
    download: 'Download',
    notReady: 'Document has not been rendered yet.',
    loadError: 'Failed to download file',
  },
  kaa: {
    title: 'PDF/A-1b hújjet',
    refresh: 'Jańalaw',
    download: 'Júklep alıw',
    notReady: 'Hújjet háli render qılınbaǵan.',
    loadError: 'Fayldı júklep bolmadı',
  },
};

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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

export function PermitPdfPanel({ permitId, fileName, ready }: { permitId: string; fileName: string; ready: boolean }) {
  const { lang } = useLanguage();
  const t = PDF_PANEL_I18N[lang as keyof typeof PDF_PANEL_I18N] || PDF_PANEL_I18N.uz_latn;

  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        setError(e instanceof Error ? e.message : t.loadError);
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permitId, ready, t.loadError]);

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
      setError(e instanceof Error ? e.message : t.loadError);
      setState('error');
    }
  }

  if (!ready) {
    return (
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs font-sans text-xs text-[#5A646D]">
        {t.notReady}
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E7EA] pb-3">
        <h3 className="text-sm font-bold text-[#1A1F24] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#2E7D4F] shrink-0" /> {t.title}
        </h3>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            isLoading={state === 'loading'}
            leftIcon={<RefreshCw className="w-4 h-4 shrink-0" />}
            onClick={() => void reload()}
            className="flex-1 sm:flex-none justify-center"
          >
            {t.refresh}
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!url}
            leftIcon={<Download className="w-4 h-4 shrink-0" />}
            onClick={() => url && triggerDownload(url, fileName)}
            className="bg-[#2E7D4F] hover:bg-[#23653F] text-white font-bold flex-1 sm:flex-none justify-center"
          >
            {t.download}
          </Button>
        </div>
      </div>
      {error && <p className="text-xs text-[#B91C1C] font-semibold">{error}</p>}
      {url && (
        <iframe
          title="Permit PDF"
          src={url}
          className="w-full h-[70vh] border border-[#E4E7EA] rounded-xl bg-[#F8F9FA]"
        />
      )}
    </div>
  );
}

