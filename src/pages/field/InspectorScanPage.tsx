import React, { useState } from 'react';
import {
  Search,
  ArrowLeft,
  QrCode,
  WifiOff,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';

export interface InspectorScanPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const InspectorScanPage: React.FC<InspectorScanPageProps> = ({ onNavigate }) => {
  const [manualQuery, setManualQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleSimulateCameraScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onNavigate?.('field_inspection', { permitNo: 'RX-2026-0089' });
    }, 1500);
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualQuery.trim()) {
      onNavigate?.('field_inspection', { permitNo: manualQuery.trim() });
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 font-sans">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate?.('field_tasks')}
        >
          Topshiriqlarga qaytish
        </Button>
        <span className="text-xs font-mono text-[#D97706] flex items-center gap-1">
          <WifiOff className="w-3.5 h-3.5" /> Offlayn Kesh Rejimi
        </span>
      </div>

      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-[#1A1F24]">QR-Kod Skaneri</h1>
        <p className="text-xs text-[#5A646D]">
          Chorvadorning ruxsatnomasidagi QR-kodni kameraga tuting.
        </p>
      </div>

      {/* Camera Viewport Simulation Frame */}
      <div className="relative bg-black rounded-3xl overflow-hidden h-80 flex flex-col items-center justify-between p-6 text-white shadow-2xl border-4 border-[#2E7D4F]">
        <div className="w-full flex justify-between items-center text-xs text-gray-300">
          <span>Kamera: Orqa HD (1080p)</span>
          <span className="font-mono bg-[#2E7D4F] px-2 py-0.5 rounded text-[11px] font-bold">AUTOFOCUS</span>
        </div>

        {/* Reticle Focus Viewfinder */}
        <div className="w-48 h-48 border-2 border-dashed border-[#7FB98A] rounded-2xl flex items-center justify-center relative animate-pulse">
          <QrCode className="w-24 h-24 text-white/40" />
          <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#7FB98A]" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#7FB98A]" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#7FB98A]" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#7FB98A]" />
        </div>

        <Button
          variant="success"
          fullWidth
          size="md"
          isLoading={isScanning}
          onClick={handleSimulateCameraScan}
        >
          Kamera Bilan QRni Tutish
        </Button>
      </div>

      {/* Manual Search Fallback */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#767F87] uppercase">Kamera Ishlamasa — Qoʻlda Qidirish</h3>
        <form onSubmit={handleManualSearch} className="space-y-3">
          <Input
            placeholder="Masalan: RX-2026-0089"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            touchSize
          />
          <Button type="submit" variant="primary" fullWidth size="lg">
            Lokal Keshdan Izlash
          </Button>
        </form>
      </div>
    </div>
  );
};
