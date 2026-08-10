import React, { useState } from 'react';
import {
  UploadCloud,
  FileCheck2,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

export interface GisImportPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export interface ImportErrorItem {
  lineNo: number;
  featureId: string;
  errorType: string;
  message: string;
  status: 'error' | 'warning' | 'valid';
}

export const GisImportPage: React.FC<GisImportPageProps> = ({ onNavigate }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);

  const mockErrorReports: ImportErrorItem[] = [
    { lineNo: 1, featureId: 'FT-001', errorType: 'VALID', message: 'Geometriya va atributlar toʻliq toʻgʻri', status: 'valid' },
    { lineNo: 14, featureId: 'FT-014', errorType: 'ERR_SELF_INTERSECT', message: 'Topologik xato: Poligon oʻz-oʻzi bilan kesishgan vertex aniqlandi', status: 'error' },
    { lineNo: 28, featureId: 'FT-028', errorType: 'ERR_MISSING_ATTR', message: 'Majburiy atribut yetishmaydi: `contour_id` kiritilmagan', status: 'error' },
    { lineNo: 42, featureId: 'FT-042', errorType: 'WARN_CRS_MISMATCH', message: 'Ogohlantirish: Proyeksiyalar mosligi (EPSG:4326 auto-convert qilindi)', status: 'warning' },
  ];

  const handleSimulateUpload = () => {
    setSelectedFile('Burchmulla_Forest_Contours_2026.geojson');
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setHasProcessed(true);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate?.('gis_editor')}
        >
          GIS Xarita muharririga qaytish
        </Button>
        <span className="text-xs font-mono text-[#767F87]">GIS Fayl Formatlari: SHP, GeoJSON, KML, GPKG</span>
      </div>

      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          GIS Qatlam Fayllarini Import Qilish
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F24]">
          Geo-Maʼlumotlarni Tahlil va Tekshirish (Error Report)
        </h1>
        <p className="text-sm text-[#5A646D] max-w-lg mx-auto">
          Fayl tarkibidagi poligonlar topologik va atributiv qatʼiy avto-tekshiruvdan oʻtkaziladi.
        </p>
      </div>

      {/* Upload Dropzone Container */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-8 shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-[#F0F7F1] text-[#2E7D4F] rounded-2xl flex items-center justify-center mx-auto">
          <UploadCloud className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <h3 className="font-bold text-base text-[#1A1F24]">GIS Faylini Tanlang yoki Suvrib Oling</h3>
          <p className="text-xs text-[#5A646D]">Maksimal fayl hajmi: 50MB (.zip SHP, .geojson, .kml)</p>
        </div>

        <Button
          variant="primary"
          size="lg"
          isLoading={isProcessing}
          onClick={handleSimulateUpload}
        >
          {selectedFile ? `Fayl Qayta Yuklash (${selectedFile})` : 'Kompyuterdan Fayl Tanlash'}
        </Button>
      </div>

      {/* Line-by-Line Error Report Results Table */}
      {hasProcessed && (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-md space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7EA] pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1A1F24]">Import Tahlili va Xatolar Hisoboti</h2>
              <p className="text-xs text-[#5A646D]">
                Jami topilgan obʼyektlar: <b>42 ta</b> | Valid: <b>40 ta</b> | Xatolar: <b>2 ta</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-4 h-4" />}>
                Bekor qilish (Rollback)
              </Button>
              <Button variant="success" size="sm" leftIcon={<FileCheck2 className="w-4 h-4" />}>
                Valid Qismlarni Saqlash
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
                <tr>
                  <th className="p-3 font-semibold text-[#5A646D]">Qator №</th>
                  <th className="p-3 font-semibold text-[#5A646D]">Feature ID</th>
                  <th className="p-3 font-semibold text-[#5A646D]">Xato Kodi</th>
                  <th className="p-3 font-semibold text-[#5A646D]">Batafsil Xabar</th>
                  <th className="p-3 font-semibold text-[#5A646D]">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7EA]">
                {mockErrorReports.map((row) => (
                  <tr key={row.lineNo} className="hover:bg-[#F8F9FA]">
                    <td className="p-3 font-mono font-bold">{row.lineNo}</td>
                    <td className="p-3 font-mono">{row.featureId}</td>
                    <td className="p-3 font-mono font-semibold text-[#B91C1C]">{row.errorType}</td>
                    <td className="p-3 text-[#1A1F24]">{row.message}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.status === 'valid'
                            ? 'bg-[#F0F7F1] text-[#2E7D4F] border border-[#D9EBDC]'
                            : row.status === 'warning'
                            ? 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'
                            : 'bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]'
                        }`}
                      >
                        {row.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
