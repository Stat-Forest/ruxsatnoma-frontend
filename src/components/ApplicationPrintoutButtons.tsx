/**
 * Stage 16 (ruling R2): «Ariza xati» and «Rad etish xati» — the application's
 * two printed documents, on both the citizen's and the staff card. A button
 * exists only for a printout the card lists (`card.printouts`), so an
 * application filed before stage 16 shows none rather than a broken one.
 * One download path for every file in the app: `downloadAttachment`.
 */
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { useLanguage } from '../i18n/useT';
import { API_BASE, downloadAttachment } from '../lib/xlsxExport';
import type { components } from '../api/schema';

type Printout = components['schemas']['ApplicationPrintoutOut'];

const I18N = {
  uz_latn: { letter: 'Ariza xati', notice: 'Rad etish xati', failed: 'Faylni yuklab boʻlmadi' },
  uz_cyrl: { letter: 'Ариза хати', notice: 'Рад этиш хати', failed: 'Файлни юклаб бўлмади' },
  ru: { letter: 'Заявление', notice: 'Отказ', failed: 'Не удалось скачать файл' },
  kaa: { letter: 'Arza xatı', notice: 'Biykar etiw xatı', failed: 'Fayldı júklep bolmadı' },
  en: { letter: 'Application letter', notice: 'Rejection letter', failed: 'Download failed' },
};

export function ApplicationPrintoutButtons({
  applicationId,
  printouts,
}: {
  applicationId: string;
  printouts: Printout[];
}) {
  const { lang } = useLanguage();
  const t = I18N[lang as keyof typeof I18N] ?? I18N.uz_latn;
  const [busy, setBusy] = useState<Printout['kind'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (printouts.length === 0) return null;

  async function download(p: Printout) {
    setBusy(p.kind);
    setError(null);
    const route = p.kind === 'letter' ? 'letter.pdf' : 'rejection-notice.pdf';
    const fallback = p.kind === 'letter' ? `ariza-xati-${applicationId}.pdf` : `rad-etish-xati-${p.number}.pdf`;
    try {
      await downloadAttachment(`${API_BASE}/api/v1/applications/${applicationId}/${route}`, fallback);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(null);
    }
  }

  const ordered = [...printouts].sort((a, b) => (a.kind === 'letter' ? -1 : b.kind === 'letter' ? 1 : 0));
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="application-printouts">
      {ordered.map((p) => (
        <Button
          key={p.kind}
          variant="outline"
          size="sm"
          leftIcon={<Download className="w-4 h-4" />}
          onClick={() => void download(p)}
          isLoading={busy === p.kind}
          disabled={busy !== null}
        >
          {p.kind === 'letter' ? t.letter : t.notice}
        </Button>
      ))}
      {error && (
        <p role="alert" className="w-full text-xs text-[#B91C1C]">
          {error}
        </p>
      )}
    </div>
  );
}
