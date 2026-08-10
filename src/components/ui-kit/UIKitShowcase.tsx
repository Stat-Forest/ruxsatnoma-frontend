import React, { useState } from 'react';
import { Button, ButtonGroup } from '../ui/button';
import { Alert, ProgressBar, Skeleton, EmptyState } from '../ui/Feedback';
import { Input, Select, Textarea, Checkbox, RadioGroup, Switch, FormField } from '../ui/FormControls';
import { Breadcrumbs, Tabs, Pagination, Stepper } from '../ui/Navigation';
import { Modal, Drawer, Tooltip } from '../ui/Overlay';
import { StatusBadge, StatusCard } from '../ui/StatusBadge';
import { DataTable, type Column } from '../ui/DataTable';
import { FoundationsShowcase } from './FoundationsShowcase';
import { LayoutsShowcase } from './LayoutsShowcase';

import {
  Send,
  Plus,
  Trash2,
  Search,
  Filter,
  Eye,
  Edit2,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  Download,
} from 'lucide-react';

interface SamplePermit {
  id: number;
  permitNo: string;
  applicant: string;
  forestZone: string;
  cattleCount: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'warning';
  date: string;
}

const sampleData: SamplePermit[] = [
  { id: 1, permitNo: 'RX-2026-0089', applicant: 'Abdullayev Alisher Nabiyevich', forestZone: 'Burchmulla oʻrmon xoʻjaligi', cattleCount: 45, status: 'approved', date: '10.08.2026' },
  { id: 2, permitNo: 'RX-2026-0090', applicant: 'Qosimov Sardor Rahimovich', forestZone: 'Zomin davlat qoʻriqxonasi', cattleCount: 120, status: 'pending', date: '09.08.2026' },
  { id: 3, permitNo: 'RX-2026-0091', applicant: 'Karimov Jasur Odilovich', forestZone: 'Kitob baland togʻ boʻlimi', cattleCount: 80, status: 'warning', date: '05.08.2026' },
  { id: 4, permitNo: 'RX-2026-0092', applicant: 'Mirzayev Temur Bahromovich', forestZone: 'Pop oʻrmon boʻlimi', cattleCount: 30, status: 'rejected', date: '02.08.2026' },
  { id: 5, permitNo: 'RX-2026-0093', applicant: 'Normatova Gulnora Ergashovna', forestZone: 'Burchmulla oʻrmon xoʻjaligi', cattleCount: 65, status: 'draft', date: '01.08.2026' },
];

const categories = [
  { id: 'foundations', label: '0. Negizlar (Foundations)' },
  { id: 'buttons', label: '1. Tugmalar (Buttons)' },
  { id: 'forms', label: '2. Forma elementlari (Forms)' },
  { id: 'feedback', label: '3. Bildirishnomalar (Feedback)' },
  { id: 'navigation', label: '4. Navigatsiya (Navigation)' },
  { id: 'status', label: '5. Statuslar (Status)' },
  { id: 'overlay', label: '6. Modallar va Panellar (Overlay)' },
  { id: 'table', label: '7. Jadval (DataTable)' },
  { id: 'layouts', label: '8. Karkaslar (Layouts)' },
];

const buttonVariantsData: Array<{
  variant: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger' | 'outline';
  label: string;
  icon?: React.ReactNode;
}> = [
  { variant: 'primary', label: 'Arizani yuborish', icon: <Send className="w-4 h-4" /> },
  { variant: 'secondary', label: 'Filtrlash', icon: <Filter className="w-4 h-4" /> },
  { variant: 'ghost', label: 'Bekor qilish' },
  { variant: 'success', label: 'Tasdiqlash', icon: <CheckCircle className="w-4 h-4" /> },
  { variant: 'danger', label: 'Rad etish', icon: <Trash2 className="w-4 h-4" /> },
  { variant: 'outline', label: 'Yuklab olish (PDF)', icon: <Download className="w-4 h-4" /> },
];

const buttonSizesData: Array<{ size: 'sm' | 'md' | 'lg' | 'touch'; label: string }> = [
  { size: 'sm', label: 'Kichik (32px)' },
  { size: 'md', label: 'Standart (40px)' },
  { size: 'lg', label: 'Katta (48px)' },
  { size: 'touch', label: 'Sensorli mobil (48px Touch Target)' },
];

const buttonGroupItems = [
  { label: 'Kunlik', variant: 'secondary' as const },
  { label: 'Haftalik', variant: 'secondary' as const },
  { label: 'Oylik', variant: 'primary' as const },
  { label: 'Yillik', variant: 'secondary' as const },
];

const alertsData = [
  { variant: 'info' as const, title: 'Tizim maʼlumoti', content: 'Arizalarni qabul qilish har kuni soat 09:00 dan 18:00 gacha amalga oshiriladi.' },
  { variant: 'success' as const, title: 'Muvaffaqiyatli saqlandi', content: 'Ruxsatnoma №RX-2026-0089 tizimda muvaffaqiyatli tasdiqlandi.' },
  { variant: 'warning' as const, title: 'Muddati tugamoqda', content: 'Ushbu ruxsatnoma amal qilish muddati 3 kundan keyin tugaydi.', actionText: 'Muddati uzaytirish', onAction: () => alert('Muddati uzaytirish soʻrovi yuborildi') },
  { variant: 'danger' as const, title: 'Ariza rad etildi', content: 'Taqdim etilgan hujjatlarda kamchiliklar aniqlandi. Qaytadan ariza topshiring.' },
];

const statusBadgesData: ('approved' | 'pending' | 'warning' | 'rejected' | 'draft')[] = [
  'approved',
  'pending',
  'warning',
  'rejected',
  'draft',
];

const statusCardsData = [
  { title: 'Jami arizalar', count: 124, status: 'info' as const, subtitle: 'Ushbu oy boʻyicha' },
  { title: 'Tasdiqlangan', count: 98, status: 'approved' as const, subtitle: 'Faol ruxsatnomalar' },
  { title: 'Koʻrib chiqilmoqda', count: 18, status: 'pending' as const, subtitle: 'Kutish jarayonida' },
  { title: 'Muddati tugamoqda', count: 8, status: 'warning' as const, subtitle: '7 kun qoldi' },
];

const modalDetails = [
  { label: 'Arizachi', value: 'Abdullayev A.N.' },
  { label: 'Mollar soni', value: '45 bosh' },
  { label: 'Hudud', value: 'Burchmulla oʻrmon xoʻjaligi' },
];

const tableColumns: Column<SamplePermit>[] = [
  { key: 'permitNo', header: 'Ruxsatnoma №', sortable: true, width: '140px' },
  { key: 'applicant', header: 'Arizachi F.I.SH.', sortable: true },
  { key: 'forestZone', header: 'Oʻrmon hududi', sortable: true },
  { key: 'cattleCount', header: 'Mollar soni', sortable: true, width: '110px' },
  { key: 'status', header: 'Holati', sortable: true, width: '180px', accessor: (row) => <StatusBadge status={row.status} size="sm" /> },
  { key: 'date', header: 'Sana', sortable: true, width: '110px' },
];

export const UIKitShowcase: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('foundations');
  const [isBtnLoading, setIsBtnLoading] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [currentTab, setCurrentTab] = useState('all');
  const [currentStep, setCurrentStep] = useState(2);
  const [currentPage, setCurrentPage] = useState(1);

  const [inputText, setInputText] = useState('Abdullayev Alisher');
  const [inputError, setInputError] = useState('');
  const [selectVal, setSelectVal] = useState('burchmulla');
  const [textareaVal, setTextareaVal] = useState('Chorva mollarini boqish uchun ruxsatnoma ariza matni...');
  const [switchChecked, setSwitchChecked] = useState(true);
  const [radioVal, setRadioVal] = useState('individual');

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 font-sans">
      {/* Header Banner */}
      <header className="bg-white border-b border-[#E4E7EA] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#2E7D4F] text-white text-xs font-bold px-2 py-0.5 rounded">REACT TSX</span>
              <h1 className="text-xl font-bold text-[#1A1F24]">Ruxsatnoma UI Kit — Komponentlar Kutubxonasi</h1>
            </div>
            <p className="text-xs text-[#5A646D] mt-1">Oʻzbekiston Respublikasi Oʻrmon xoʻjaligi ruxsatnomalar tizimi dizayn-sistemasi (WCAG AA muvofiq)</p>
          </div>
          <Switch checked={touchMode} onChange={setTouchMode} label="Sensorli rejim (Touch Mode 48px)" />
        </div>

        {/* Categories Tab navigation */}
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
          <div className="flex space-x-6 border-t border-[#E4E7EA] pt-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === cat.id ? 'border-[#2E7D4F] text-[#2E7D4F]' : 'border-transparent text-[#5A646D] hover:text-[#1A1F24]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="max-w-7xl mx-auto px-6 mt-8">
        {/* SECTION 0: FOUNDATIONS */}
        {activeCategory === 'foundations' && <FoundationsShowcase />}

        {/* SECTION 1: BUTTONS */}
        {activeCategory === 'buttons' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-[#1A1F24]">Tugma variantlari va holatlari</h2>
            <Button variant="secondary" size="sm" onClick={() => setIsBtnLoading(!isBtnLoading)}>
              {isBtnLoading ? 'Yuklanishni oʻchirish' : 'Yuklanish simulyatsiyasi'}
            </Button>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">1. Asosiy tugmalar (Variants)</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {buttonVariantsData.map((btn) => (
                    <Button
                      key={btn.variant}
                      variant={btn.variant}
                      size={touchMode ? 'touch' : 'md'}
                      isLoading={isBtnLoading && (btn.variant === 'primary' || btn.variant === 'secondary')}
                      leftIcon={btn.icon}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">2. Tugma oʻlchamlari (Sizes)</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {buttonSizesData.map((b) => (
                    <Button key={b.size} size={b.size}>{b.label}</Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">3. Tugmalar guruhi (Button Group)</h3>
                <ButtonGroup>
                  {buttonGroupItems.map((item, idx) => (
                    <Button key={idx} variant={item.variant} size="sm">{item.label}</Button>
                  ))}
                </ButtonGroup>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 2: FORMS */}
        {activeCategory === 'forms' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-[#1A1F24]">Forma elementlari (Input, Select, Switch, Checkbox)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField label="Arizachi F.I.SH." required error={inputError} helperText="Pasport boʻyicha toʻliq kiriting">
                <Input
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    setInputError(!e.target.value ? 'Maydonni toʻldirish majburiy!' : '');
                  }}
                  leftIcon={<Search className="w-4 h-4" />}
                  touchSize={touchMode}
                />
              </FormField>

              <FormField label="Oʻrmon xoʻjaligi hududi" required helperText="Ruxsat beriladigan oʻrmon zonalari">
                <Select
                  value={selectVal}
                  onChange={(e) => setSelectVal(e.target.value)}
                  touchSize={touchMode}
                  options={[
                    { value: 'burchmulla', label: 'Burchmulla oʻrmon xoʻjaligi' },
                    { value: 'zomin', label: 'Zomin davlat qoʻriqxonasi' },
                    { value: 'kitob', label: 'Kitob baland togʻ boʻlimi' },
                  ]}
                />
              </FormField>

              <div className="col-span-1 md:col-span-2">
                <FormField label="Qoʻshimcha izoh va maqsadi" helperText="Mollar soni va boqilish muddati">
                  <Textarea value={textareaVal} onChange={(e) => setTextareaVal(e.target.value)} maxLength={250} />
                </FormField>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-[#767F87] uppercase">Arizachi turi (Radio)</h3>
                <RadioGroup
                  name="applicantType"
                  selectedValue={radioVal}
                  onChange={setRadioVal}
                  options={[
                    { value: 'individual', label: 'Jismoniy shaxs (Fuqaro)', hint: 'Shaxsiy chorva mollari uchun' },
                    { value: 'business', label: 'Yuridik shaxs (Fermer xoʻjaligi)', hint: 'Tadbirkorlik faoliyati boʻyicha' },
                  ]}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-[#767F87] uppercase">Sozlamalar va Tasdiqlar</h3>
                <Checkbox label="Oʻrmon qoidalariga rioya qilishga roziman" hint="Oʻrmon xoʻjaligi toʻgʻrisidagi qonunchilik shartlari" defaultChecked />
                <div className="pt-2">
                  <Switch checked={switchChecked} onChange={setSwitchChecked} label="SMS xabarnomaga obuna boʻlish" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: FEEDBACK */}
        {activeCategory === 'feedback' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-[#1A1F24]">Bildirishnomalar va Ogohlantirishlar</h2>

            <div className="space-y-3">
              {alertsData.map((a, idx) => (
                <Alert key={idx} variant={a.variant} title={a.title} actionText={a.actionText} onAction={a.onAction}>
                  {a.content}
                </Alert>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E4E7EA] space-y-4">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase">Jarayon va Yuklanish indicatorlari</h3>
              <ProgressBar value={65} label="Arizalarni koʻrib chiqish jarayoni" />
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-[#767F87]">Skeleton (Yuklanish simulyatsiyasi):</div>
                <Skeleton width="w-3/4" height="h-5" />
                <Skeleton width="w-1/2" height="h-4" />
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E7EA]">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-4">Boʻsh holat (Empty State)</h3>
              <EmptyState
                title="Arizalar topilmadi"
                description="Hozircha sizda barcha ruxsatnomalar rasmiylashtirilgan. Yangi ariza yuborish uchun quyidagi tugmani bosing."
                actionText="Yangi ariza yaratish"
                onAction={() => alert('Yangi ariza yaratish oynasi')}
              />
            </div>
          </section>
        )}

        {/* SECTION 4: NAVIGATION */}
        {activeCategory === 'navigation' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-[#1A1F24] mb-4">Breadcrumbs va Navigatsiya Tabs</h2>
              <Breadcrumbs items={[{ label: 'Bosh sahifa', href: '#' }, { label: 'Oʻrmon boʻlimi', href: '#' }, { label: 'Ruxsatnomalar roʻyxati' }]} />
            </div>

            <div className="pt-4 border-t border-[#E4E7EA]">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Tab bar</h3>
              <Tabs
                tabs={[
                  { id: 'all', label: 'Barcha arizalar', count: 42 },
                  { id: 'pending', label: 'Kutilayotganlar', count: 7 },
                  { id: 'approved', label: 'Tasdiqlanganlar', count: 31 },
                  { id: 'rejected', label: 'Rad etilganlar', count: 4 },
                ]}
                activeTabId={currentTab}
                onChange={setCurrentTab}
              />
            </div>

            <div className="pt-4 border-t border-[#E4E7EA]">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Koʻp bosqichli jarayon (Stepper Wizard)</h3>
              <Stepper
                steps={[
                  { id: 1, title: 'Arizachi maʼlumotlari', description: 'Pasport va STIR' },
                  { id: 2, title: 'Oʻrmon hududini tanlash', description: 'Boʻlim va yer maydoni' },
                  { id: 3, title: 'Chorva mollari', description: 'Sonini va turini koʻrsatish' },
                  { id: 4, title: 'Tasdiqlash', description: 'EDS imzo bilan' },
                ]}
                currentStep={currentStep}
                onStepClick={setCurrentStep}
              />
            </div>

            <div className="pt-4 border-t border-[#E4E7EA]">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-3">Paginatsiya (Pagination)</h3>
              <Pagination currentPage={currentPage} totalPages={5} onPageChange={setCurrentPage} totalRecords={42} pageSize={10} />
            </div>
          </section>
        )}

        {/* SECTION 5: STATUS */}
        {activeCategory === 'status' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-[#1A1F24]">Status Nishonlari va Summary Kartalari</h2>
            <div>
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-4">Status Badges</h3>
              <div className="flex flex-wrap items-center gap-4">
                {statusBadgesData.map((st) => (
                  <StatusBadge key={st} status={st} />
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E7EA]">
              <h3 className="text-xs font-semibold text-[#767F87] uppercase mb-4">Status Cards Grid</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statusCardsData.map((c, idx) => (
                  <StatusCard key={idx} title={c.title} count={c.count} status={c.status} subtitle={c.subtitle} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* SECTION 6: OVERLAY */}
        {activeCategory === 'overlay' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <h2 className="text-lg font-semibold text-[#1A1F24]">Overlays (Modal dialog, Drawer, Tooltip)</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={() => setIsModalOpen(true)}>Modal oynani ochish</Button>
              <Button variant="secondary" onClick={() => setIsDrawerOpen(true)}>Yon panelni (Drawer) ochish</Button>
              <Tooltip content="WCAG AA muvofiq maslahat xabari">
                <Button variant="outline" leftIcon={<HelpCircle className="w-4 h-4" />}>Tooltip hover sinovi</Button>
              </Tooltip>
            </div>

            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Ruxsatnomani tasdiqlash"
              subtitle="Ruxsatnoma №RX-2026-0089"
              footer={
                <>
                  <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Bekor qilish</Button>
                  <Button variant="success" onClick={() => setIsModalOpen(false)}>Tasdiqlayman</Button>
                </>
              }
            >
              <p className="mb-3">Ushbu arizani tasdiqlash orqali chorva mollarini belgilangan oʻrmon zonasida boqish uchun rasmiy ruxsatnoma beriladi.</p>
              <div className="bg-[#F8F9FA] p-3 rounded border border-[#E4E7EA] text-xs font-mono space-y-1">
                {modalDetails.map((d, idx) => (
                  <div key={idx}>{d.label}: {d.value}</div>
                ))}
              </div>
            </Modal>

            <Drawer
              isOpen={isDrawerOpen}
              onClose={() => setIsDrawerOpen(false)}
              title="Filtrlash paneli"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>Tozalash</Button>
                  <Button variant="primary" size="sm" onClick={() => setIsDrawerOpen(false)}>Qoʻllash</Button>
                </div>
              }
            >
              <div className="space-y-4">
                <FormField label="Sana oraligʻi">
                  <Input type="date" />
                </FormField>
                <FormField label="Holati boʻyicha filtrlash">
                  <Select
                    options={[
                      { value: 'all', label: 'Barcha holatlar' },
                      { value: 'approved', label: 'Tasdiqlangan' },
                      { value: 'pending', label: 'Kutilayotgan' },
                    ]}
                  />
                </FormField>
              </div>
            </Drawer>
          </section>
        )}

        {/* SECTION 7: DATA TABLE */}
        {activeCategory === 'table' && (
          <section className="bg-white border border-[#E4E7EA] rounded-xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-[#1A1F24]">Ruxsatnomalar Maʼlumotlar Jadvali (DataTable)</h2>
                <p className="text-sm text-[#5A646D]">Ustunlarni saralash, qatorlarni tanlash va paginatsiyaga ega toʻliq jadval</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" leftIcon={<FileSpreadsheet className="w-4 h-4" />}>Excel eksport</Button>
                <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>Yangi ariza</Button>
              </div>
            </div>

            <DataTable
              columns={tableColumns}
              data={sampleData}
              selectable
              actions={() => (
                <div className="flex items-center gap-1">
                  <button className="p-1 rounded text-[#767F87] hover:text-[#2E7D4F] hover:bg-[#F0F7F1]"><Eye className="w-4 h-4" /></button>
                  <button className="p-1 rounded text-[#767F87] hover:text-[#0369A1] hover:bg-[#E0F2FE]"><Edit2 className="w-4 h-4" /></button>
                </div>
              )}
              pagination={{ currentPage: 1, totalPages: 3, onPageChange: (p) => console.log('Page change:', p), totalRecords: 15 }}
            />
          </section>
        )}

        {/* SECTION 8: LAYOUTS */}
        {activeCategory === 'layouts' && <LayoutsShowcase />}
      </main>
    </div>
  );
};
