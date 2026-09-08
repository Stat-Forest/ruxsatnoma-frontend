import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import { downloadCsv, fetchAllPages, toCsv } from '../../lib/csvExport';
import { useActivityTypes, useApplicationsList, type ApplicationListFilters, type ApplicationOut } from './queries';
import { formatAmount, formatDate, localizedName, STATUS_LABELS, statusLabel } from './format';
import { WorklistRow } from './components/WorklistRow';

const REVIEW_PERMISSION = 'applications.review';
const PAGE_SIZE = 20;

const APPLICATIONS_LIST_I18N = {
  uz_latn: {
    title: 'Arizalar',
    subtitle: 'Sizga koʻrish huquqi berilgan arizalar — oʻzingizniki yoki (xodim/rahbar boʻlsangiz) tashkilotingiz zonasi boʻyicha',
    status: 'Status',
    activityType: 'Faoliyat turi',
    appNumber: 'Ariza raqami',
    periodFrom: 'Davr — dan',
    periodTo: 'Davr — gacha',
    all: 'Barchasi',
    reset: 'Tiklash',
    apply: 'Qoʻllash',
    exportCsv: 'CSV eksport',
    loading: 'Yuklanmoqda...',
    loadError: 'Arizalar yuklanmadi.',
    notFoundFiltered: 'Filtr boʻyicha ariza topilmadi.',
    colNumber: 'Raqam',
    colStatus: 'Status',
    colContour: 'Kontur',
    colPeriod: 'Davr',
    colArea: 'Maydon, ga',
    colSla: 'SLA muddati',
    colAction: 'Amal',
  },
  uz_cyrl: {
    title: 'Аризалар',
    subtitle: 'Сизга кўриш ҳуқуқи берилган аризалар — ўзингизники ёки (ходим/раҳбар бўлсангиз) ташкилотингиз зонаси бўйича',
    status: 'Статус',
    activityType: 'Фаолият тури',
    appNumber: 'Ариза рақами',
    periodFrom: 'Давр — дан',
    periodTo: 'Давр — гача',
    all: 'Барчаси',
    reset: 'Тиклаш',
    apply: 'Қўллаш',
    exportCsv: 'CSV экспорт',
    loading: 'Юкланмоқда...',
    loadError: 'Аризалар юкланмади.',
    notFoundFiltered: 'Фильтр бўйича ариза топилмади.',
    colNumber: 'Рақам',
    colStatus: 'Статус',
    colContour: 'Контур',
    colPeriod: 'Давр',
    colArea: 'Майдон, га',
    colSla: 'SLA муддати',
    colAction: 'Амал',
  },
  ru: {
    title: 'Заявки',
    subtitle: 'Заявки, доступные вам для просмотра — ваши собственные или (для сотрудников/руководства) по зоне вашей организации',
    status: 'Статус',
    activityType: 'Вид деятельности',
    appNumber: 'Номер заявки',
    periodFrom: 'Период — с',
    periodTo: 'Период — по',
    all: 'Все',
    reset: 'Сбросить',
    apply: 'Применить',
    exportCsv: 'Экспорт CSV',
    loading: 'Загрузка...',
    loadError: 'Не удалось загрузить заявки.',
    notFoundFiltered: 'По фильтру заявок не найдено.',
    colNumber: 'Номер',
    colStatus: 'Статус',
    colContour: 'Контур',
    colPeriod: 'Период',
    colArea: 'Площадь, га',
    colSla: 'Срок SLA',
    colAction: 'Действие',
  },
  en: {
    title: 'Applications',
    subtitle: 'Applications available for you to view — your own or (for staff/head) within your organization zone',
    status: 'Status',
    activityType: 'Activity type',
    appNumber: 'Application number',
    periodFrom: 'Period — from',
    periodTo: 'Period — to',
    all: 'All',
    reset: 'Reset',
    apply: 'Apply',
    exportCsv: 'Export CSV',
    loading: 'Loading...',
    loadError: 'Failed to load applications.',
    notFoundFiltered: 'No applications found matching the filters.',
    colNumber: 'Number',
    colStatus: 'Status',
    colContour: 'Contour',
    colPeriod: 'Period',
    colArea: 'Area, ha',
    colSla: 'SLA deadline',
    colAction: 'Action',
  },
  kaa: {
    title: 'Arzalar',
    subtitle: 'Sizge kóriw huqıqı berilgen arzalar — ózińizdiki yamasa (xızmetker/basshı bolsańız) shólkemińiz zonası boyınsha',
    status: 'Status',
    activityType: 'Xızmet túri',
    appNumber: 'Arza nómeri',
    periodFrom: 'Dáwir — baslap',
    periodTo: 'Dáwir — deyin',
    all: 'Barlıǵı',
    reset: 'Qayta tiklew',
    apply: 'Qollaw',
    exportCsv: 'CSV eksport',
    loading: 'Júklenbekte...',
    loadError: 'Arzalar júklenbedi.',
    notFoundFiltered: 'Filtr boyınsha arza tabılmadı.',
    colNumber: 'Nómer',
    colStatus: 'Status',
    colContour: 'Kontur',
    colPeriod: 'Dáwir',
    colArea: 'Maydan, ga',
    colSla: 'SLA múddeti',
    colAction: 'Hreket',
  },
};

interface FilterFormState {
  status: ApplicationOut['status'] | '';
  activity_type_id: string;
  number: string;
  period_from: string;
  period_to: string;
}

const EMPTY_FILTERS: FilterFormState = {
  status: '',
  activity_type_id: '',
  number: '',
  period_from: '',
  period_to: '',
};

export function ApplicationsListPage() {
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const lt = APPLICATIONS_LIST_I18N[lang as keyof typeof APPLICATIONS_LIST_I18N] || APPLICATIONS_LIST_I18N.uz_latn;
  const errorText = useApiErrorText();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportTruncated, setExportTruncated] = useState(false);

  // Auto-apply text/date filters with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(filters);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.number, filters.period_from, filters.period_to]);

  const statusOptions = useMemo(
    () => [
      { value: '' as ApplicationOut['status'] | '', label: lt.all },
      ...(Object.keys(STATUS_LABELS) as ApplicationOut['status'][]).map((value) => ({
        value,
        label: statusLabel(value, lang),
      })),
    ],
    [lt.all, lang],
  );

  const queryFilters: ApplicationListFilters = {
    status: appliedFilters.status || undefined,
    activity_type_id: appliedFilters.activity_type_id || undefined,
    number: appliedFilters.number || undefined,
    period_from: appliedFilters.period_from || undefined,
    period_to: appliedFilters.period_to || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const activityTypes = useActivityTypes();
  const list = useApplicationsList(queryFilters);

  const canReview = !!me && (me.is_superuser || me.permissions.includes(REVIEW_PERMISSION));

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  async function exportCsv() {
    setExporting(true);
    setExportTruncated(false);
    try {
      const { rows, truncated } = await fetchAllPages<ApplicationOut>(async (p, pageSize) => {
        const { data, error } = await api.GET('/api/v1/applications', {
          params: { query: { ...queryFilters, page: p, page_size: pageSize } },
        });
        if (error) throw apiError(error);
        return data;
      });
      const csv = toCsv(rows, [
        { header: 'number', value: (r) => r.number ?? r.id },
        { header: 'status', value: (r) => statusLabel(r.status, lang) },
        { header: 'contour_id', value: (r) => r.contour_id ?? '' },
        { header: 'period_from', value: (r) => formatDate(r.period_from) },
        { header: 'period_to', value: (r) => formatDate(r.period_to) },
        { header: 'requested_area_ha', value: (r) => formatAmount(r.requested_area_ha) },
        { header: 'sla_deadline_at', value: (r) => r.sla_deadline_at ?? '' },
      ]);
      downloadCsv(`applications-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setExportTruncated(truncated);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="applications-page">
      <div>
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{lt.title}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">
          {lt.subtitle}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <FormField label={lt.status}>
            <Select
              value={filters.status}
              onChange={(e) => {
                const newStatus = e.target.value as FilterFormState['status'];
                setFilters((f) => ({ ...f, status: newStatus }));
                setAppliedFilters((af) => ({ ...af, status: newStatus }));
                setPage(1);
              }}
              options={statusOptions}
            />
          </FormField>
          <FormField label={lt.activityType}>
            <Select
              value={filters.activity_type_id}
              onChange={(e) => {
                const newId = e.target.value;
                setFilters((f) => ({ ...f, activity_type_id: newId }));
                setAppliedFilters((af) => ({ ...af, activity_type_id: newId }));
                setPage(1);
              }}
              options={[
                { value: '', label: lt.all },
                ...(activityTypes.data ?? []).map((a) => ({ value: a.id, label: localizedName(a.name, lang) || a.code })),
              ]}
            />
          </FormField>
          <FormField label={lt.appNumber}>
            <Input
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value }))}
              placeholder="RX-2026-000123"
            />
          </FormField>
          <FormField label={lt.periodFrom}>
            <Input
              type="date"
              value={filters.period_from}
              onChange={(e) => setFilters((f) => ({ ...f, period_from: e.target.value }))}
            />
          </FormField>
          <FormField label={lt.periodTo}>
            <Input
              type="date"
              value={filters.period_to}
              onChange={(e) => setFilters((f) => ({ ...f, period_to: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            isLoading={exporting}
            onClick={() => void exportCsv()}
          >
            {t('prosecutor.exportCsv')}
          </Button>
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {lt.reset}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {lt.apply}
          </Button>
        </div>
      </form>

      {exportTruncated && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]" role="alert">
          {t('prosecutor.exportTruncated')}
        </div>
      )}

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : lt.loadError}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">{lt.colNumber}</th>
                <th className="p-3">{lt.colStatus}</th>
                <th className="p-3">{lt.colContour}</th>
                <th className="p-3">{lt.colPeriod}</th>
                <th className="p-3 text-right">{lt.colArea}</th>
                <th className="p-3">{lt.colSla}</th>
                <th className="p-3 text-right">{lt.colAction}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {lt.loading}
                  </td>
                </tr>
              ) : (list.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    {lt.notFoundFiltered}
                  </td>
                </tr>
              ) : (
                list.data!.items.map((row) => <WorklistRow key={row.id} row={row} canReview={canReview} />)
              )}
            </tbody>
          </table>
        </div>

        {list.data && list.data.total > 0 && (
          <div className="px-4 border-t border-[#E4E7EA]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalRecords={list.data.total}
            />
          </div>
        )}
      </div>
    </div>
  );
}
