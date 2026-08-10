import React, { useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  CheckCircle2,
  Camera,
  ShieldCheck,
  Navigation,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, Textarea, FormField, Select } from '../../components/ui/FormControls';
import { StatusBadge } from '../../components/ui/StatusBadge';

export interface InspectorInspectionPageProps {
  permitNo?: string;
  onNavigate?: (page: string, params?: any) => void;
}

export const InspectorInspectionPage: React.FC<InspectorInspectionPageProps> = ({
  permitNo = 'RX-2026-0089',
  onNavigate,
}) => {
  const [actualCattleCount, setActualCattleCount] = useState<number>(48);
  const [inspectionResult, setInspectionResult] = useState<'compliant' | 'warning' | 'violation'>('compliant');
  const [remarks, setRemarks] = useState('');
  const [isPhotoCaptured, setIsPhotoCaptured] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Mock permit details
  const permitData = {
    permitNo: permitNo,
    applicant: 'ABDULLAYEV ALISHER NABIYEVICH',
    permittedCattle: 45,
    contour: 'Kontur №42 (Burchmulla oʻrmon xoʻjaligi)',
    gpsDistanceMeters: 12, // 12 meters inside contour
    gpsCoordinates: '41.6028° N, 70.0245° E',
  };

  const handleCapturePhoto = () => {
    setIsPhotoCaptured(true);
  };

  const handleSubmitAct = () => {
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto py-8 text-center space-y-6 bg-white border border-[#E4E7EA] p-8 rounded-2xl shadow-md font-sans">
        <div className="w-16 h-16 bg-[#F0F7F1] text-[#15803D] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#1A1F24]">Inspeksiya Dalolatnomasi Tuzildi!</h2>
          <p className="text-xs text-[#5A646D]">
            Dalolatnoma №ACT-2026-0412 lokal keshga saqlandi va serverga sinxronizatsiya qilindi.
          </p>
        </div>

        <div className="bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA] text-xs font-mono text-left space-y-1">
          <div>Ruxsatnoma №: <b>{permitData.permitNo}</b></div>
          <div>GPS: <b>{permitData.gpsCoordinates} (12m inside)</b></div>
          <div>Vaqt va Xesh: <b>10.08.2026 14:35 (sha256:d8912...)</b></div>
          <div>Holati: <b className="text-[#15803D]">Muvofiq (Compliant)</b></div>
        </div>

        <Button variant="primary" fullWidth onClick={() => onNavigate?.('field_tasks')}>
          Topshiriqlarga Qaytish
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate?.('field_tasks')}
        >
          Orqaga
        </Button>
        <span className="text-xs font-mono font-bold text-[#2E7D4F] flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5 text-[#0284C7]" /> GPS Aktiv
        </span>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-sm space-y-6">
        {/* Permit Title Banner */}
        <div className="border-b border-[#E4E7EA] pb-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-mono text-[#5A646D]">Inspeksiya Obʼyekti:</span>
            <h1 className="text-xl font-bold font-mono text-[#1A1F24]">{permitData.permitNo}</h1>
            <p className="text-xs text-[#2E7D4F] font-bold mt-0.5">{permitData.applicant}</p>
          </div>
          <StatusBadge status="approved" size="sm" />
        </div>

        {/* GPS Geolocation Distance Check */}
        <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-[#123522] flex items-center gap-1">
              <MapPin className="w-4 h-4 text-[#15803D]" /> GPS Geolokatsiya Aniqlik Rejimi
            </span>
            <p className="text-[#5A646D]">
              Inspektor pozitsiyasi: <b>{permitData.gpsCoordinates}</b>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-white text-[#15803D] font-mono font-bold border border-[#D9EBDC]">
            {permitData.gpsDistanceMeters}m Ruxsat etilgan zonada
          </span>
        </div>

        {/* Headcount Comparison Form */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#767F87] uppercase">Chorva Mollari Soni Solishtiruvi</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-xs space-y-1">
              <span className="text-[#5A646D]">Ruxsat etilgan soni:</span>
              <div className="text-xl font-bold font-mono text-[#1A1F24]">{permitData.permittedCattle} bosh</div>
            </div>

            <FormField label="Haqiqiy sanalgan soni" required>
              <Input
                type="number"
                value={actualCattleCount}
                onChange={(e) => setActualCattleCount(Number(e.target.value))}
                touchSize
              />
            </FormField>
          </div>
        </div>

        {/* Photo & Video Proof Capture with Auto GPS Stamp */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-[#767F87] uppercase">Foto va Video Isbot (Auto GPS Stamp)</h3>

          <div className="border-2 border-dashed border-[#767F87] rounded-2xl p-6 text-center bg-[#F8F9FA] space-y-3">
            {isPhotoCaptured ? (
              <div className="p-3 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl text-xs text-[#123522] space-y-1 font-mono">
                <div className="font-bold flex items-center justify-center gap-1 text-[#15803D]">
                  <CheckCircle2 className="w-4 h-4" /> Surat Saqlandi (GPS Stamp Auto-Applied)
                </div>
                <div>Surat: <b>IMG_20260810_1435.jpg (3.4 MB)</b></div>
                <div>Shtamp: <b>41.6028° N, 70.0245° E | 10.08.2026 14:35</b></div>
              </div>
            ) : (
              <>
                <Camera className="w-10 h-10 text-[#2E7D4F] mx-auto" />
                <span className="text-xs font-bold text-[#1A1F24] block">Chorva surati / videoga olish</span>
                <p className="text-[11px] text-[#767F87]">
                  Suratga avtomatik ravishda GPS va vaqt shtampi hamda xesh kodi uriladi.
                </p>
                <Button variant="outline" size="sm" onClick={handleCapturePhoto}>
                  Suratga Olish
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Inspection Result Selection */}
        <FormField label="Inspeksiya Xulosasi Status" required>
          <Select
            value={inspectionResult}
            onChange={(e) => setInspectionResult(e.target.value as any)}
            options={[
              { value: 'compliant', label: 'Muvofiq (Qoidabuzarlik yoʻq)' },
              { value: 'warning', label: 'Ogohlantirish (Mollar soni 10% gacha koʻp)' },
              { value: 'violation', label: 'Qoidabuzarlik (Konturdan tashqari yoki ruxsatnomasiz)' },
            ]}
            touchSize
          />
        </FormField>

        <FormField label="Inspektor Izohi va Izohlari">
          <Textarea
            placeholder="Dala tekshiruvi tafsilotlari va shart-sharoitlar..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </FormField>

        {/* Submit Act CTA */}
        <Button
          variant="success"
          fullWidth
          size="lg"
          leftIcon={<ShieldCheck className="w-5 h-5" />}
          onClick={handleSubmitAct}
        >
          Dalolatnomani Tasdiqlash va E-IMZO Muhrlash
        </Button>
      </div>
    </div>
  );
};
