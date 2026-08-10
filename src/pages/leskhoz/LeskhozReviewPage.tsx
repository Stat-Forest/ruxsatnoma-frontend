import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select, Textarea, FormField } from '../../components/ui/FormControls';
import { StatusBadge } from '../../components/ui/StatusBadge';

export interface LeskhozReviewPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const LeskhozReviewPage: React.FC<LeskhozReviewPageProps> = ({ onNavigate }) => {
  const [rejectReasonCode, setRejectReasonCode] = useState('RJ-01');
  const [commentText, setCommentText] = useState('');

  const rejectionCodes = [
    { value: 'RJ-01', label: 'RJ-01: Kontur yaylov sigʻimi (MaxSB) chegarasidan oshgan' },
    { value: 'RJ-02', label: 'RJ-02: Epizootik veterinariya maʼlumotnomasi yaroqsiz' },
    { value: 'RJ-03', label: 'RJ-03: Taqiqlangan muhofaza yoki eroziya zonasiga tushgan' },
    { value: 'RJ-04', label: 'RJ-04: Belgilangan foydalanish muddati qoidaga zid' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => onNavigate?.('leskhoz_inbox')}
        >
          Arizalar stoykasiga qaytish
        </Button>
        <span className="text-xs font-mono font-bold text-[#2E7D4F]">SLA: 18 soat qoldi</span>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-sm space-y-8">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E7EA] pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-mono text-[#1A1F24]">Ariza №RX-2026-0090</h1>
              <StatusBadge status="pending" size="md" />
            </div>
            <p className="text-xs text-[#5A646D] mt-1">Yuborilgan sana: 09.08.2026 10:15</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Toʻlov summasi</span>
            <div className="text-2xl font-bold font-mono text-[#2E7D4F]">2,850,000 UZS</div>
          </div>
        </div>

        {/* Auto Checks Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#123522]">
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
              <span>GIS Topologik Avto-Tekshiruv: PASS (0% Kesishuv)</span>
            </div>
            <p className="text-xs text-[#5A646D]">Kontur №42 (Burchmulla oʻrmon xoʻjaligi, 450 ga)</p>
          </div>

          <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-[#123522]">
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
              <span>Normalar va Sigʻim (MaxSB): PASS</span>
            </div>
            <p className="text-xs text-[#5A646D]">Soʻralgan: 120 bosh. Erkin sigʻim: 380 bosh.</p>
          </div>
        </div>

        {/* Applicant Requisites */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Arizachi F.I.SH.</span>
            <span className="font-bold text-[#1A1F24]">Qosimov Sardor Rahimovich</span>
            <span className="block text-xs font-mono text-[#767F87]">STIR: 302910481</span>
          </div>

          <div className="p-4 bg-[#F8F9FA] rounded-xl border border-[#E4E7EA] space-y-1">
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Faoliyat Turi va Parametr</span>
            <span className="font-bold text-[#1A1F24]">Chorva mollarini boqish</span>
            <span className="block text-xs text-[#5A646D]">120 bosh qoʻy va echkilar (6 oy)</span>
          </div>
        </div>

        {/* Rejection Form Box */}
        <div className="p-6 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-[#991B1B] flex items-center gap-2">
            <XCircle className="w-5 h-5" /> Ariza Rad Etilsa (Majburiy RJ-* Sabab Kodi)
          </h3>

          <FormField label="Rasmiy Rad Etish Kodi (RJ-*)" required>
            <Select
              value={rejectReasonCode}
              onChange={(e) => setRejectReasonCode(e.target.value)}
              options={rejectionCodes}
              touchSize
            />
          </FormField>

          <FormField label="Qoʻshimcha Huquqiy Izoh">
            <Textarea
              placeholder="Arizachiga koʻrsatiladigan huquqiy va meʼyoriy asoslar..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </FormField>
        </div>

        {/* Decision Control Actions Footer */}
        <div className="pt-4 border-t border-[#E4E7EA] flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              alert(`Ariza ${rejectReasonCode} kodi bilan rad etildi!`);
              onNavigate?.('leskhoz_inbox');
            }}
          >
            Rad Etish ({rejectReasonCode})
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => alert('Joyiga chiqish topshirigʻi inspektorga biriktirildi (2 kun SLA)')}
            >
              Inspektor Biriktirish (Joyida Tekshiruv)
            </Button>
            <Button
              variant="success"
              size="lg"
              leftIcon={<Send className="w-4 h-4" />}
              onClick={() => {
                alert('Ariza ijobiy xulosa bilan Tashkilot Rahbariga (Manager) imzolashga yuborildi!');
                onNavigate?.('leskhoz_inbox');
              }}
            >
              Ijobiy Xulosa va Rahbarga Yuborish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
