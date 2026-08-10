import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Calculator,
  UploadCloud,
  ShieldCheck,
  MapPin,
  Trees,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, Select, FormField, Checkbox } from '../../components/ui/FormControls';
import { Stepper } from '../../components/ui/Navigation';

export interface PermitWizardPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const PermitWizardPage: React.FC<PermitWizardPageProps> = ({ onNavigate }) => {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Activity
  const [activityType, setActivityType] = useState('grazing');

  // Step 2: Territory
  const [region, setRegion] = useState('tashkent');
  const [district, setDistrict] = useState('bostonliq');
  const [leskhoz, setLeskhoz] = useState('burchmulla');
  const [lesnichestvo, setLesnichestvo] = useState('section4');

  // Step 3: Parameters & Livestock (12 groups)
  const [cattleCount, setCattleCount] = useState<number>(45); // Qoramol
  const [sheepCount, setSheepCount] = useState<number>(100); // Qo'y-echki
  const [horseCount, setHorseCount] = useState<number>(5); // Otlar
  const [durationMonths, setDurationMonths] = useState<number>(6); // 6 oy

  // Step 5 & 6
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Formula Calculation Constants
  const BHM_VAL = 340000; // 340,000 UZS
  const CATTLE_COEFF = 0.05; // 5% BHM per cattle head per month
  const SHEEP_COEFF = 0.01; // 1% BHM per sheep head per month
  const HORSE_COEFF = 0.06; // 6% BHM per horse head per month

  const monthlyPrice = Math.round(
    cattleCount * CATTLE_COEFF * BHM_VAL +
      sheepCount * SHEEP_COEFF * BHM_VAL +
      horseCount * HORSE_COEFF * BHM_VAL
  );
  const totalPrice = monthlyPrice * durationMonths;

  const handleNext = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmitEImzo = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1500);
  };

  if (isSubmitted) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-6 bg-white border border-[#E4E7EA] p-8 rounded-2xl shadow-md font-sans">
        <div className="w-16 h-16 bg-[#F0F7F1] text-[#15803D] rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[#1A1F24]">Ariza Muvaffaqiyatli Yuborildi!</h2>
          <p className="text-sm text-[#5A646D]">
            Arizangizga <b className="text-[#1A1F24] font-mono">№RX-2026-0094</b> raqami berildi va koʻrib chiqish uchun oʻrmon xoʻjaligiga yuborildi.
          </p>
        </div>

        <div className="bg-[#F8F9FA] p-4 rounded-xl border border-[#E4E7EA] text-xs space-y-1 font-mono text-left">
          <div>Ruxsatnoma raqami: <b>RX-2026-0094</b></div>
          <div>E-IMZO Muhr: <b>OʻzDSt 1135 (Tasdiqlangan)</b></div>
          <div>Yuborilgan sana: <b>10.08.2026 14:30</b></div>
          <div>SLA koʻrib chiqish muddati: <b>3 ish kuni</b></div>
        </div>

        <div className="flex justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => onNavigate?.('applicant_dashboard')}>
            Kabinetga qaytish
          </Button>
          <Button variant="primary" onClick={() => onNavigate?.('applicant_application_detail', { id: 94 })}>
            Arizani koʻrish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      {/* Wizard Title */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Elektron Ruxsatnoma Vizardi
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F24]">
          Oʻrmon Fondidan Foydalanish Arizasi
        </h1>
        <p className="text-sm text-[#5A646D]">
          6 ta oddiy bosqichda arizani rasmiylashtirish va E-IMZO bilan imzolash.
        </p>
      </div>

      {/* Stepper Navigation Bar */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs overflow-x-auto">
        <Stepper
          steps={[
            { id: 1, title: 'Faoliyat Turi', description: 'Turlardan birini tanlash' },
            { id: 2, title: 'Oʻrmon Hududi', description: 'Tuman va Kontur' },
            { id: 3, title: 'Chorva va Parametr', description: 'Soni va Muddat' },
            { id: 4, title: 'Hujjatlar', description: 'Vet maʼlumotnoma' },
            { id: 5, title: 'Hisob-Kitob', description: 'Formulalar yoyilmasi' },
            { id: 6, title: 'E-IMZO Imzo', description: 'Raqamli muhrlash' },
          ]}
          currentStep={currentStep}
          onStepClick={(step) => step < currentStep && setCurrentStep(step)}
        />
      </div>

      {/* Main Wizard Form Steps */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* STEP 1: Activity Selection */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#1A1F24]">1. Faoliyat Turini Tanlang</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'grazing', name: 'Chorva mollarini boqish', desc: 'Qoramol, qoʻy va echkilarni yaylovda boqish', icon: <Trees className="w-6 h-6 text-[#2E7D4F]" /> },
                { id: 'haymaking', name: 'Pichan oʻrish va somon yigʻish', desc: 'Mavsumiy pichan maydonlaridan foydalanish', icon: <FileCheck2 className="w-6 h-6 text-[#2E7D4F]" /> },
                { id: 'beekeeping', name: 'Asalarichilik va in qoʻyish', desc: 'Asalari oilalarini joylashtirish', icon: <ShieldCheck className="w-6 h-6 text-[#2E7D4F]" /> },
                { id: 'wild_plants', name: 'Yovvoyi oʻsimliklar yigʻish', desc: 'Mevalar va oziq-ovqat xomashyosi', icon: <Trees className="w-6 h-6 text-[#2E7D4F]" /> },
              ].map((act) => (
                <div
                  key={act.id}
                  onClick={() => setActivityType(act.id)}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                    activityType === act.id
                      ? 'border-[#2E7D4F] bg-[#F0F7F1]'
                      : 'border-[#E4E7EA] hover:border-[#7FB98A]'
                  }`}
                >
                  <div className="p-2 bg-white rounded-xl shadow-xs shrink-0">{act.icon}</div>
                  <div>
                    <h3 className="font-bold text-[#1A1F24] text-base">{act.name}</h3>
                    <p className="text-xs text-[#5A646D] mt-1">{act.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Territory Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#1A1F24]">2. Oʻrmon Hududi va GIS Konturini Tanlang</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Viloyat" required>
                <Select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  options={[{ value: 'tashkent', label: 'Toshkent viloyati' }]}
                />
              </FormField>

              <FormField label="Tuman" required>
                <Select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  options={[{ value: 'bostonliq', label: 'Boʻstonliq tumani' }]}
                />
              </FormField>

              <FormField label="Oʻrmon xoʻjaligi" required>
                <Select
                  value={leskhoz}
                  onChange={(e) => setLeskhoz(e.target.value)}
                  options={[{ value: 'burchmulla', label: 'Burchmulla oʻrmon xoʻjaligi' }]}
                />
              </FormField>

              <FormField label="Boʻlim / Kvartal" required>
                <Select
                  value={lesnichestvo}
                  onChange={(e) => setLesnichestvo(e.target.value)}
                  options={[{ value: 'section4', label: '4-boʻlim, 12-kvartal' }]}
                />
              </FormField>
            </div>

            {/* GIS Contour Availability Box */}
            <div className="p-4 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#1A1F24] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#2E7D4F]" /> GIS Kontur №42 (Yaylov zonasi)
                </span>
                <span className="text-[#15803D] bg-[#F0F7F1] px-2 py-0.5 rounded border border-[#D9EBDC]">
                  Boʻsh maydon: 450 gektar
                </span>
              </div>
              <p className="text-xs text-[#5A646D]">
                Qonuniy yaylov sigʻimi (MaxSB): <b>500 bosh usta birlik</b>. Hozirda band qilingan: <b>120 bosh</b>.
              </p>
            </div>
          </div>
        )}

        {/* STEP 3: Parameters & Livestock */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#1A1F24]">3. Chorva Mollari va Muddat</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField label="Qoramol (Bosh)" helperText="Yirik shoxli mollar">
                <Input
                  type="number"
                  value={cattleCount}
                  onChange={(e) => setCattleCount(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Qoʻy va Echkilar (Bosh)" helperText="Kichik shoxli mollar">
                <Input
                  type="number"
                  value={sheepCount}
                  onChange={(e) => setSheepCount(Number(e.target.value))}
                />
              </FormField>

              <FormField label="Otlar (Bosh)">
                <Input
                  type="number"
                  value={horseCount}
                  onChange={(e) => setHorseCount(Number(e.target.value))}
                />
              </FormField>
            </div>

            <FormField label="Foydalanish muddati (Oylar)" required>
              <Select
                value={durationMonths.toString()}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                options={[
                  { value: '3', label: '3 oy (Mavsumiy)' },
                  { value: '6', label: '6 oy (Yarim yillik)' },
                  { value: '12', label: '12 oy (Bir yillik)' },
                ]}
              />
            </FormField>

            {/* Live Calculation Preview Box */}
            <div className="p-5 bg-[#F0F7F1] border border-[#D9EBDC] rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs text-[#5A646D] uppercase font-semibold block">Real-vaqt hisoblangan toʻlov summasi:</span>
                <div className="text-2xl font-bold text-[#2E7D4F] font-mono">
                  {totalPrice.toLocaleString()} UZS
                </div>
              </div>
              <Calculator className="w-8 h-8 text-[#2E7D4F]" />
            </div>
          </div>
        )}

        {/* STEP 4: Documents */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#1A1F24]">4. Hujjatlarni Yuklash</h2>

            <div className="space-y-4">
              <FormField label="Veterinariya Maʼlumotnomasi (Vet-Spravka)" required helperText="PDF, PNG yoki JPG fayl (maks. 10MB)">
                <div className="border-2 border-dashed border-[#767F87] rounded-xl p-6 text-center bg-[#F8F9FA] hover:bg-white transition-colors cursor-pointer">
                  <UploadCloud className="w-8 h-8 text-[#2E7D4F] mx-auto mb-2" />
                  <span className="text-xs font-semibold text-[#1A1F24] block">Faylni yuklash uchun bosing</span>
                  <span className="text-[11px] text-[#767F87]">Veterinariya boʻlimi tomonidan berilgan epizootik maʼlumotnoma</span>
                </div>
              </FormField>

              <FormField label="Imtiyoz yoki Ishonchnoma Hujjati (Mavjud boʻlsa)">
                <Input type="file" />
              </FormField>
            </div>
          </div>
        )}

        {/* STEP 5: Verification & Formula Summary */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-[#1A1F24]">5. Hisob-Kitob va Formulalar Yoyilmasi</h2>

            <div className="border border-[#E4E7EA] rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
                  <tr>
                    <th className="p-3 font-semibold">Parametr kodi</th>
                    <th className="p-3 font-semibold">Qiymat</th>
                    <th className="p-3 font-semibold">Tushuntirish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7EA]">
                  <tr>
                    <td className="p-3 font-mono">BHM (БҲМ)</td>
                    <td className="p-3 font-bold font-mono">340,000 UZS</td>
                    <td className="p-3 text-[#5A646D]">Bazaviy hisoblash miqdori</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">Yaylov Sigʻimi (MaxSB)</td>
                    <td className="p-3 font-bold font-mono">500 bosh</td>
                    <td className="p-3 text-[#5A646D]">Konturning geobotanik normasi</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">Qoramol Koeffitsienti</td>
                    <td className="p-3 font-bold font-mono">45 bosh × 0.05</td>
                    <td className="p-3 text-[#5A646D]">765,000 UZS / oyiga</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono">Qoʻy-Echki Koeffitsienti</td>
                    <td className="p-3 font-bold font-mono">100 bosh × 0.01</td>
                    <td className="p-3 text-[#5A646D]">340,000 UZS / oyiga</td>
                  </tr>
                  <tr className="bg-[#F0F7F1]">
                    <td className="p-3 font-bold">JAMI SUMMA (6 oy)</td>
                    <td className="p-3 font-bold font-mono text-base text-[#2E7D4F]" colSpan={2}>
                      {totalPrice.toLocaleString()} UZS
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Checkbox
              label="Kiritilgan maʼlumotlar toʻgʻriligini va Oʻrmon qonunchiligi shartlarini tasdiqlayman."
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />
          </div>
        )}

        {/* STEP 6: E-IMZO Digital Signature */}
        {currentStep === 6 && (
          <div className="space-y-6 text-center py-4">
            <div className="w-16 h-16 bg-[#F0F7F1] text-[#2E7D4F] rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#1A1F24]">E-IMZO Kaliti Bilan Tasdiqlash</h2>
              <p className="text-xs text-[#5A646D] max-w-md mx-auto">
                Arizani rasmiylashtirish uchun E-IMZO elektron raqamli imzo kalitidan foydalanib arizani muhrlang.
              </p>
            </div>

            <div className="p-4 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-xs font-mono max-w-md mx-auto text-left space-y-1">
              <div>Arizachi: <b>ABDULLAYEV ALISHER NABIYEVICH</b></div>
              <div>STIR: <b>304918234</b></div>
              <div>Jami toʻlov summasi: <b>{totalPrice.toLocaleString()} UZS</b></div>
            </div>

            <Button
              variant="success"
              size="lg"
              className="w-full sm:w-auto px-8"
              isLoading={isSubmitting}
              disabled={!agreeTerms}
              onClick={handleSubmitEImzo}
            >
              E-IMZO Bilan Imzolash va Yuborish
            </Button>
          </div>
        )}

        {/* Wizard Controls Footer Buttons */}
        <div className="pt-6 border-t border-[#E4E7EA] flex items-center justify-between">
          <Button
            variant="ghost"
            size="md"
            onClick={handlePrev}
            disabled={currentStep === 1}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Orqaga
          </Button>

          {currentStep < 6 && (
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Keyingi Bosqich
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
