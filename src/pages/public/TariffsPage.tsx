import React, { useState } from 'react';
import {
  Calculator,
  Download,
  Percent,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input, Select, FormField } from '../../components/ui/FormControls';

export const TariffsPage: React.FC = () => {
  const BHM_CURRENT = 340000; // 340,000 UZS

  // Calculator State
  const [cattleCount, setCattleCount] = useState<number>(50);
  const [sheepCount, setSheepCount] = useState<number>(100);
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [hasPrivilege, setHasPrivilege] = useState(false);

  // Coefficients
  const CATTLE_COEFF = 0.05; // 5% BHM / head / month
  const SHEEP_COEFF = 0.01; // 1% BHM / head / month

  const baseMonthly = Math.round(
    cattleCount * CATTLE_COEFF * BHM_CURRENT + sheepCount * SHEEP_COEFF * BHM_CURRENT
  );
  const discountMultiplier = hasPrivilege ? 0.5 : 1.0; // 50% discount for privileged users
  const totalAmount = baseMonthly * durationMonths * discountMultiplier;

  const tariffTable = [
    { activity: 'Chorva mollarini boqish (Qoramol)', coeff: '0.05 BHM', unit: 'Bosh / Oyiga', pricePerMonth: `${(BHM_CURRENT * 0.05).toLocaleString()} UZS` },
    { activity: 'Chorva mollarini boqish (Qoʻy va echki)', coeff: '0.01 BHM', unit: 'Bosh / Oyiga', pricePerMonth: `${(BHM_CURRENT * 0.01).toLocaleString()} UZS` },
    { activity: 'Chorva mollarini boqish (Otlar)', coeff: '0.06 BHM', unit: 'Bosh / Oyiga', pricePerMonth: `${(BHM_CURRENT * 0.06).toLocaleString()} UZS` },
    { activity: 'Pichan oʻrish (Tabiiy pichangoh)', coeff: '0.10 BHM', unit: 'Gektar / Mavsum', pricePerMonth: `${(BHM_CURRENT * 0.10).toLocaleString()} UZS` },
    { activity: 'Asalarichilik va in qoʻyish', coeff: '0.02 BHM', unit: 'Ari oilasi / Yiliga', pricePerMonth: `${(BHM_CURRENT * 0.02).toLocaleString()} UZS` },
    { activity: 'Yovvoyi oʻsimlik va mevalar yigʻish', coeff: '0.15 BHM', unit: 'Tonna boʻyicha', pricePerMonth: `${(BHM_CURRENT * 0.15).toLocaleString()} UZS` },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-10 font-sans">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#2E7D4F] bg-[#F0F7F1] px-3 py-1 rounded-full border border-[#D9EBDC]">
          Rasmiy Tariflar va Stavkalar
        </span>
        <h1 className="text-2xl sm:text-4xl font-bold text-[#1A1F24]">
          Toʻlov Stavkalari va Kalkulyator
        </h1>
        <p className="text-sm text-[#5A646D] max-w-xl mx-auto">
          Vazirlar Mahkamasi qarorlariga muvofiq belgilangan oʻrmon fondidan foydalanish koeffitsientlari.
        </p>
      </div>

      {/* BHM Current Information Banner */}
      <div className="bg-[#123522] text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold text-[#7FB98A] uppercase">Joriy Bazaviy Hisoblash Miqdori (БҲМ)</span>
          <div className="text-3xl font-bold font-mono text-white">340,000 UZS</div>
          <p className="text-xs text-gray-300">Oʻzbekiston Respublikasi Qonunchiligi boʻyicha tasdiqlangan</p>
        </div>
        <Button variant="success" size="md" leftIcon={<Download className="w-4 h-4" />}>
          Tariflar NHA (PDF)
        </Button>
      </div>

      {/* Interactive Calculator Section */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-[#E4E7EA] pb-4">
          <div className="p-3 bg-[#F0F7F1] text-[#2E7D4F] rounded-xl">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1A1F24]">Onlayn Narx Kalkulyatori</h2>
            <p className="text-xs text-[#5A646D]">Chorva soni va muddatni kiriting, toʻlov summasi real-vaqtda hisoblanadi</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField label="Qoramol soni (Bosh)">
            <Input
              type="number"
              value={cattleCount}
              onChange={(e) => setCattleCount(Number(e.target.value))}
              touchSize
            />
          </FormField>

          <FormField label="Qoʻy va Echkilar (Bosh)">
            <Input
              type="number"
              value={sheepCount}
              onChange={(e) => setSheepCount(Number(e.target.value))}
              touchSize
            />
          </FormField>

          <FormField label="Foydalanish muddati (Oy)">
            <Select
              value={durationMonths.toString()}
              onChange={(e) => setDurationMonths(Number(e.target.value))}
              options={[
                { value: '3', label: '3 oy (Mavsumiy)' },
                { value: '6', label: '6 oy (Yarim yillik)' },
                { value: '12', label: '12 oy (Bir yillik)' },
              ]}
              touchSize
            />
          </FormField>
        </div>

        {/* Privilege Checkbox Option */}
        <label className="flex items-center gap-2 text-xs font-semibold text-[#1A1F24] cursor-pointer bg-[#F8F9FA] p-3 rounded-xl border border-[#E4E7EA]">
          <input
            type="checkbox"
            checked={hasPrivilege}
            onChange={(e) => setHasPrivilege(e.target.checked)}
            className="accent-[#2E7D4F] w-4 h-4"
          />
          <span>50% Imtiyoz (Oʻrmon xoʻjaligi faxriylari va togʻli hudud aholisi uchun)</span>
        </label>

        {/* Dynamic Calculation Result Box */}
        <div className="p-6 bg-[#F0F7F1] border border-[#D9EBDC] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-[#5A646D] uppercase font-semibold block">Hisoblangan umumiy toʻlov summasi:</span>
            <div className="text-3xl font-bold font-mono text-[#2E7D4F]">
              {totalAmount.toLocaleString()} UZS
            </div>
            {hasPrivilege && (
              <span className="text-xs text-[#15803D] font-bold flex items-center gap-1 mt-1">
                <Percent className="w-3.5 h-3.5" /> 50% imtiyoz qoʻllanildi
              </span>
            )}
          </div>
          <Button variant="primary" size="lg">
            Shu boʻyicha ariza topshirish
          </Button>
        </div>
      </section>

      {/* Official Coefficients Table */}
      <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-[#1A1F24]">Rasmiy Koeffitsientlar Jadvali</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
              <tr>
                <th className="p-3 font-semibold text-[#5A646D]">Faoliyat turi</th>
                <th className="p-3 font-semibold text-[#5A646D]">БҲМ Koeffitsienti</th>
                <th className="p-3 font-semibold text-[#5A646D]">Birlik</th>
                <th className="p-3 font-semibold text-[#5A646D]">Bir Birlik Narxi (Oyiga)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {tariffTable.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#F8F9FA]">
                  <td className="p-3 font-bold text-[#1A1F24]">{row.activity}</td>
                  <td className="p-3 font-mono font-semibold text-[#2E7D4F]">{row.coeff}</td>
                  <td className="p-3 text-[#5A646D]">{row.unit}</td>
                  <td className="p-3 font-mono font-bold text-[#1A1F24]">{row.pricePerMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
