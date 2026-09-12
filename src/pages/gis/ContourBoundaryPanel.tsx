import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, MapPinOff } from 'lucide-react';
import { useLanguage } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { API_BASE, downloadAttachment, exportLang } from '../../lib/xlsxExport';
import { ContourMapPreview } from '../applicant/wizard/ContourMapPreview';
import { getContourCard } from './api';

const I18N = {
  uz_latn: {
    title: 'Kontur chegarasi',
    loading: 'Xarita yuklanmoqda…',
    loadError: 'Kontur chegarasini yuklab boʻlmadi.',
    notDrawn: 'Bu kontur uchun chegara chizilmagan — xarita mavjud emas.',
    contour: 'Kontur',
    area: 'Maydon',
    download: 'KMZ yuklab olish',
    downloadHint: 'Google Earth va GPS uchun fayl',
    downloadError: 'Faylni yuklab boʻlmadi',
  },
  uz_cyrl: {
    title: 'Контур чегараси',
    loading: 'Харита юкланмоқда…',
    loadError: 'Контур чегарасини юклаб бўлмади.',
    notDrawn: 'Бу контур учун чегара чизилмаган — харита мавжуд эмас.',
    contour: 'Контур',
    area: 'Майдон',
    download: 'KMZ юклаб олиш',
    downloadHint: 'Google Earth ва GPS учун файл',
    downloadError: 'Файлни юклаб бўлмади',
  },
  ru: {
    title: 'Граница контура',
    loading: 'Карта загружается…',
    loadError: 'Не удалось загрузить границу контура.',
    notDrawn: 'Для этого контура граница не нарисована — карты нет.',
    contour: 'Контур',
    area: 'Площадь',
    download: 'Скачать KMZ',
    downloadHint: 'Файл для Google Earth и GPS',
    downloadError: 'Не удалось скачать файл',
  },
  en: {
    title: 'Contour boundary',
    loading: 'Loading the map…',
    loadError: 'Could not load the contour boundary.',
    notDrawn: 'No boundary has been drawn for this contour — there is no map.',
    contour: 'Contour',
    area: 'Area',
    download: 'Download KMZ',
    downloadHint: 'A file for Google Earth and GPS',
    downloadError: 'Could not download the file',
  },
  kaa: {
    title: 'Kontur shegarası',
    loading: 'Karta júklenbekte…',
    loadError: 'Kontur shegarasın júklep bolmadı.',
    notDrawn: 'Bul kontur ushın shegara sızılmaǵan — karta joq.',
    contour: 'Kontur',
    area: 'Maydan',
    download: 'KMZ júklep alıw',
    downloadHint: 'Google Earth hám GPS ushın fayl',
    downloadError: 'Fayldı júklep bolmadı',
  },
};

/** The plot an application or permit is about, drawn on a map, with the
 * boundary downloadable as KMZ (Odilxon, 2026-09-13 — the format the
 * Agency's own geodata arrived in, decision #45, and what a forester's
 * Google Earth or handheld GPS opens). Mounted on all four cards: the
 * citizen's and staff's application card, the citizen's and staff's permit
 * page.
 *
 * Read-only on purpose: `ContourMapPreview` with `selectedId` set never
 * fetches the browsable layer of neighbours, and with no `onPick` a click
 * on the parcel changes nothing — this is the wizard's picker used as a
 * viewer, not a second map.
 *
 * Decision #178 is the case to get right: `geometry` is `null` for a contour
 * filed by requisites alone or under a leshoz whose `gis_enabled` switch is
 * off. Then the panel says so in words and shows NO button — the server
 * answers that download with a 404 (`ERR-GIS-007`), and a button that leads
 * to an error is the hiding kind of defect this project keeps finding. */
export function ContourBoundaryPanel({ contourId }: { contourId: string | null | undefined }) {
  const { lang } = useLanguage();
  const tr = I18N[lang] ?? I18N.uz_latn;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Same key as `staff/queries.ts::useContour`, so the general-info panel
  // and this one share a single fetch of the card.
  const cardQuery = useQuery({
    queryKey: ['gis', 'contour', contourId],
    queryFn: () => getContourCard(contourId!),
    enabled: !!contourId,
    staleTime: 60_000,
  });

  if (!contourId) return null;

  const card = cardQuery.data;
  const geometry = card?.geometry ?? null;

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadAttachment(
        `${API_BASE}/api/v1/gis/contours/${encodeURIComponent(contourId)}/export.kmz?lang=${exportLang(lang)}`,
        `kontur-${card?.number ?? contourId}.kmz`,
      );
    } catch (e) {
      setDownloadError(e instanceof Error && e.message ? e.message : tr.downloadError);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section
      className="bg-white border border-[#E4E7EA] rounded-2xl shadow-xs font-sans overflow-hidden"
      data-testid="contour-boundary-panel"
    >
      <div className="p-4 sm:p-6 border-b border-[#E4E7EA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{tr.title}</h2>
          {card && (
            <p className="text-xs text-[#5A646D] mt-1">
              {tr.contour} № {card.number} · {tr.area} {card.area_ha} ga
            </p>
          )}
        </div>
        {geometry && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void download()}
              disabled={downloading}
              data-testid="contour-kmz-download"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {tr.download}
            </Button>
            <span className="text-[11px] text-[#5A646D]">{tr.downloadHint}</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6">
        {cardQuery.isLoading && (
          <p className="text-xs text-[#5A646D] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {tr.loading}
          </p>
        )}
        {cardQuery.isError && (
          <p className="text-xs text-[#B91C1C]" role="alert">
            {tr.loadError}
          </p>
        )}
        {card && !geometry && (
          <p className="text-sm text-[#5A646D] flex items-center gap-2" data-testid="contour-boundary-empty">
            <MapPinOff className="w-4 h-4 shrink-0" /> {tr.notDrawn}
          </p>
        )}
        {card && geometry && <ContourMapPreview geometry={geometry} selectedId={card.id} />}
        {downloadError && (
          <p className="text-xs text-[#B91C1C] mt-3" role="alert">
            {downloadError}
          </p>
        )}
      </div>
    </section>
  );
}
