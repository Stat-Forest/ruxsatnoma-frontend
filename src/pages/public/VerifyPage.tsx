import React, { useState } from 'react';
import {
  Search,
  QrCode,
  CheckCircle2,
  Download,
  MapPin,
  Calendar,
  UserCheck,
  Building,
  FileCheck,
  Lock,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/FormControls';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Alert } from '../../components/ui/Feedback';

export interface VerifyPageProps {
  initialQuery?: string;
}

export interface VerificationResult {
  isValid: boolean;
  permitNo: string;
  applicantMasked: string; // e.g. "Abdullayev A. N."
  forestZone: string;
  activityType: string;
  livestockCount: string;
  issueDate: string;
  expiryDate: string;
  status: 'approved' | 'warning' | 'rejected';
  eImzoStatus: string;
  certSerialNumber: string;
  qrHash: string;
}

export const VerifyPage: React.FC<VerifyPageProps> = ({ initialQuery = 'RX-2026-0089' }) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [hasSearched, setHasSearched] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Mock lookup database
  const mockDatabase: Record<string, VerificationResult> = {
    'RX-2026-0089': {
      isValid: true,
      permitNo: 'RX-2026-0089',
      applicantMasked: 'Abdullayev A. N.',
      forestZone: 'Burchmulla oʻrmon xoʻjaligi, 4-boʻlim, 12-kvartal (Kontur #42)',
      activityType: 'Chorva mollarini boqish',
      livestockCount: '45 bosh qoramol',
      issueDate: '10.08.2026',
      expiryDate: '10.08.2027',
      status: 'approved',
      eImzoStatus: 'Raqamli muhr haqiqiy (E-IMZO OʻzDSt 1135)',
      certSerialNumber: '7A-89-FC-12-00-99',
      qrHash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    'RX-2026-0091': {
      isValid: true,
      permitNo: 'RX-2026-0091',
      applicantMasked: 'Karimov J. O.',
      forestZone: 'Kitob baland togʻ boʻlimi',
      activityType: 'Chorva mollarini boqish',
      livestockCount: '80 bosh qoʻy-echki',
      issueDate: '05.08.2025',
      expiryDate: '15.08.2026',
      status: 'warning',
      eImzoStatus: 'Raqamli muhr haqiqiy (Muddati 5 kun qoldi)',
      certSerialNumber: '3F-11-AA-44-00-12',
      qrHash: 'sha256:d853e301297e2f2e5429188e7b952b1e',
    },
  };

  const result = mockDatabase[searchQuery.trim().toUpperCase()] || null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setSearchQuery('RX-2026-0089');
      setHasSearched(true);
      setIsScanning(false);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Page Header */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Rasmiy Tekshiruv Xizmati
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F24]">
          Ruxsatnoma Haqiqiyligini Tekshirish
        </h1>
        <p className="text-sm text-[#5A646D] max-w-lg mx-auto">
          Ruxsatnoma seriyasi va raqamini kiriting yoki QR-kod skaneridan foydalaning.
        </p>
      </div>

      {/* Search Input Card */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Masalan: RX-2026-0089"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              touchSize
            />
          </div>
          <Button type="submit" variant="primary" size="lg" className="whitespace-nowrap">
            Tekshirish
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            leftIcon={<QrCode className="w-4 h-4" />}
            onClick={handleSimulateScan}
            isLoading={isScanning}
            className="whitespace-nowrap"
          >
            QR Skaner
          </Button>
        </form>

        <div className="flex items-center gap-2 text-xs text-[#767F87] bg-[#F8F9FA] p-3 rounded-lg border border-[#E4E7EA]">
          <Lock className="w-4 h-4 text-[#2E7D4F] shrink-0" />
          <span>
            <b>Shaxsiy maʼlumotlar daxlsizligi (PII Masking):</b> Qonunchilikka muvofiq arizachining F.I.SH. va shaxsiy maʼlumotlari ochiq qidiruvda qisqartirilgan shaklda koʻrsatiladi.
          </span>
        </div>
      </div>

      {/* Verification Result Section */}
      {hasSearched && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {result ? (
            <div className="bg-white border border-[#E4E7EA] rounded-2xl shadow-md overflow-hidden">
              {/* Top Banner Result Status */}
              <div
                className={`p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  result.status === 'approved'
                    ? 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]'
                    : result.status === 'warning'
                    ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
                    : 'bg-[#FEF2F2] border-[#FCA5A5] text-[#991B1B]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white rounded-xl shadow-xs shrink-0">
                    <CheckCircle2 className="w-8 h-8 text-[#15803D]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold font-mono">{result.permitNo}</span>
                      <StatusBadge status={result.status} size="sm" />
                    </div>
                    <p className="text-xs mt-0.5 font-medium opacity-90">
                      Ushbu ruxsatnoma davlat reyestridan muvaffaqiyatli oʻtdi va haqiqiy hisoblanadi.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Download className="w-4 h-4" />}
                  className="bg-white text-[#1A1F24] border-gray-300 shadow-xs hover:bg-gray-50 self-start sm:self-center"
                >
                  PDF Koʻrish
                </Button>
              </div>

              {/* Detail Breakdown Grid */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {/* Field 1 */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8F9FA] border border-[#E4E7EA]">
                    <UserCheck className="w-5 h-5 text-[#2E7D4F] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-[#5A646D] uppercase font-semibold block">Arizachi (Maskalangan)</span>
                      <span className="font-bold text-[#1A1F24] text-base">{result.applicantMasked}</span>
                    </div>
                  </div>

                  {/* Field 2 */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8F9FA] border border-[#E4E7EA]">
                    <Building className="w-5 h-5 text-[#2E7D4F] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-[#5A646D] uppercase font-semibold block">Faoliyat Turi va Qamrov</span>
                      <span className="font-bold text-[#1A1F24] text-base">{result.activityType} ({result.livestockCount})</span>
                    </div>
                  </div>

                  {/* Field 3 */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8F9FA] border border-[#E4E7EA]">
                    <MapPin className="w-5 h-5 text-[#2E7D4F] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-[#5A646D] uppercase font-semibold block">Oʻrmon Hududi</span>
                      <span className="font-bold text-[#1A1F24]">{result.forestZone}</span>
                    </div>
                  </div>

                  {/* Field 4 */}
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[#F8F9FA] border border-[#E4E7EA]">
                    <Calendar className="w-5 h-5 text-[#2E7D4F] shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-[#5A646D] uppercase font-semibold block">Amal Qilish Muddati</span>
                      <span className="font-bold text-[#1A1F24] font-mono">{result.issueDate} — {result.expiryDate}</span>
                    </div>
                  </div>
                </div>

                {/* E-IMZO Security Certificate Block */}
                <div className="p-4 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#123522]">
                    <FileCheck className="w-4 h-4 text-[#15803D]" />
                    <span>{result.eImzoStatus}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-[#5A646D]">
                    <div>Sertifikat №: <b className="text-[#1A1F24]">{result.certSerialNumber}</b></div>
                    <div className="truncate">Hash: <b className="text-[#1A1F24]">{result.qrHash}</b></div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Alert variant="danger" title="Ruxsatnoma Topilmadi">
              Kiritilgan seriya yoki raqam ({searchQuery}) boʻyicha tizimda faol ruxsatnoma mavjud emas. Maʼlumotlarni qaytadan tekshiring.
            </Alert>
          )}
        </div>
      )}
    </div>
  );
};
