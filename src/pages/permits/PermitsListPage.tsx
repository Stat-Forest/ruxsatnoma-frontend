import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { api } from '../../api/client';
import { apiError } from '../../api/errors';
import { useLanguage, useT } from '../../i18n/useT';
import { downloadCsv, fetchAllPages, toCsv } from '../../lib/csvExport';
import { toPermitsQuery, usePermitsList, type PermitListFilters, type PermitOut, type PermitStatus } from './queries';
import { useLeshozOrganizations } from './useRefsLookup';
import { formatDate, formatMoney, formatPermitNumber, pickLocalizedName } from './format';
import { PERMIT_STATUS_LABEL, getPermitStatusLabel } from './statusMeta';
import { PermitRow } from './components/PermitRow';
import { PermitCard } from './components/PermitCard';

const PAGE_SIZE = 20;

const PERMITS_LIST_I18N = {
  uz_latn: {
    staffTitle: 'Ruxsatnomalar reyestri',
    applicantTitle: 'Mening ruxsatnomalarim',
    staffSubtitle: 'Sizga koʻrish huquqi berilgan zonada berilgan barcha elektron ruxsatnomalar',
    applicantSubtitle: 'Sizga berilgan elektron ruxsatnomalar roʻyxati',
    status: 'Status',
    series: 'Seriya',
    number: 'Raqami',
    organization: 'Oʻrmon xoʻjaligi',
    all: 'Barchasi',
    reset: 'Tiklash',
    apply: 'Qoʻllash',
    loading: 'Yuklanmoqda...',
    loadError: 'Ruxsatnomalar yuklanmadi.',
    notFoundFiltered: 'Filtr boʻyicha ruxsatnoma topilmadi.',
    noPermitsApplicant: 'Hozircha ruxsatnomalar yoʻq.',
    colPermitNo: 'Ruxsatnoma №',
    colStatus: 'Holati',
    colActivity: 'Faoliyat turi',
    colOrg: 'Oʻrmon xoʻjaligi',
    colPeriod: 'Davr',
    colArea: 'Maydon, ga',
    colAction: 'Amal',
  },
  uz_cyrl: {
    staffTitle: 'Рухсатномалар реестри',
    applicantTitle: 'Менинг рухсатномаларим',
    staffSubtitle: 'Сизга кўриш ҳуқуқи берилган зонада берилган барча электрон рухсатномалар',
    applicantSubtitle: 'Сизга берилган электрон рухсатномалар рўйхати',
    status: 'Статус',
    series: 'Серия',
    number: 'Рақами',
    organization: 'Ўрмон хўжалиги',
    all: 'Барчаси',
    reset: 'Тиклаш',
    apply: 'Қўллаш',
    loading: 'Юкланмоқда...',
    loadError: 'Рухсатномалар юкланмади.',
    notFoundFiltered: 'Фильтр бўйича рухсатнома топилмади.',
    noPermitsApplicant: 'Ҳозирча рухсатномалар йўқ.',
    colPermitNo: 'Рухсатнома №',
    colStatus: 'Ҳолати',
    colActivity: 'Фаолият тури',
    colOrg: 'Ўрмон хўжалиги',
    colPeriod: 'Давр',
    colArea: 'Майдон, га',
    colAction: 'Амал',
  },
  ru: {
    staffTitle: 'Реестр разрешений',
    applicantTitle: 'Мои разрешения',
    staffSubtitle: 'Все электронные разрешения, выданные в доступной вам зоне',
    applicantSubtitle: 'Список выданных вам электронных разрешений',
    status: 'Статус',
    series: 'Серия',
    number: 'Номер',
    organization: 'Лесхоз',
    all: 'Все',
    reset: 'Сбросить',
    apply: 'Применить',
    loading: 'Загрузка...',
    loadError: 'Не удалось загрузить разрешения.',
    notFoundFiltered: 'По фильтру разрешений не найдено.',
    noPermitsApplicant: 'Разрешений пока нет.',
    colPermitNo: 'Разрешение №',
    colStatus: 'Статус',
    colActivity: 'Вид деятельности',
    colOrg: 'Лесхоз',
    colPeriod: 'Период',
    colArea: 'Площадь, га',
    colAction: 'Действие',
  },
  en: {
    staffTitle: 'Permits registry',
    applicantTitle: 'My permits',
    staffSubtitle: 'All electronic permits issued in your authorized zone',
    applicantSubtitle: 'List of electronic permits issued to you',
    status: 'Status',
    series: 'Series',
    number: 'Number',
    organization: 'Forestry',
    all: 'All',
    reset: 'Reset',
    apply: 'Apply',
    loading: 'Loading...',
    loadError: 'Failed to load permits.',
    notFoundFiltered: 'No permits found matching the filters.',
    noPermitsApplicant: 'No permits yet.',
    colPermitNo: 'Permit №',
    colStatus: 'Status',
    colActivity: 'Activity type',
    colOrg: 'Forestry',
    colPeriod: 'Period',
    colArea: 'Area, ha',
    colAction: 'Action',
  },
  kaa: {
    staffTitle: 'Ruxsatnamalar reyestri',
    applicantTitle: 'Meniń ruxsatnamalarım',
    staffSubtitle: 'Sizge kóriw huqıqı berilgen zonada berilgen barlıq elektron ruxsatnamalar',
    applicantSubtitle: 'Sizge berilgen elektron ruxsatnamalar dizimi',
    status: 'Status',
    series: 'Seriya',
    number: 'Nómeri',
    organization: 'Tokaý xojalıǵı',
    all: 'Barlıǵı',
    reset: 'Qayta tiklew',
    apply: 'Qollaw',
    loading: 'Júklenbekte...',
    loadError: 'Ruxsatnamalar júklenbedi.',
    notFoundFiltered: 'Filtr boyınsha ruxsatnama tabılmadı.',
    noPermitsApplicant: 'Házirshe ruxsatnamalar joq.',
    colPermitNo: 'Ruxsatnama №',
    colStatus: 'Jaǵdayı',
    colActivity: 'Xızmet túri',
    colOrg: 'Tokaý xojalıǵı',
    colPeriod: 'Dáwir',
    colArea: 'Maydan, ga',
    colAction: 'Hreket',
  },
};

interface FilterFormState {
  status: PermitStatus | '';
  series: string;
  number: string;
  organization_id: string;
}

const EMPTY_FILTERS: FilterFormState = { status: '', series: '', number: '', organization_id: '' };

/**
 * The two permit list screens the task brief calls a "blocking gap" — ported
 * from `.reference/src/pages/shared/PermitsRegistryPage.tsx`'s own dual-mode
 * design (a table for the staff registry, a card grid for the applicant's
 * own permits), rebuilt against the real `GET /permits`
 * (`app/modules/permits/router.py::list_permits`) instead of that file's
 * hard-coded mock rows. `MyPermitsPage`/`PermitsPage` are thin wrappers
 * around this one component so the two tracks never re-implement the same
 * list twice.
 */
export function PermitsListPage({ variant }: { variant: 'staff' | 'applicant' }) {
  const { lang } = useLanguage();
  const t = useT();
  const lt = PERMITS_LIST_I18N[lang as keyof typeof PERMITS_LIST_I18N] || PERMITS_LIST_I18N.uz_latn;
  const errorText = useApiErrorText();
  const isStaff = variant === 'staff';
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [exportTruncated, setExportTruncated] = useState(false);

  // Auto-apply text filters with debounce so typing immediately filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilters(filters);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.series, filters.number]);

  const statusOptions = useMemo(
    () => [
      { value: '' as PermitStatus | '', label: lt.all },
      ...(Object.keys(PERMIT_STATUS_LABEL) as PermitStatus[]).map((value) => ({
        value,
        label: getPermitStatusLabel(value, lang),
      })),
    ],
    [lt.all, lang],
  );

  const queryFilters: PermitListFilters = {
    status: appliedFilters.status || undefined,
    series: appliedFilters.series || undefined,
    number: appliedFilters.number || undefined,
    organization_id: isStaff ? appliedFilters.organization_id || undefined : undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const list = usePermitsList(queryFilters);
  const organizations = useLeshozOrganizations();

  function applyFilters() {
    setAppliedFilters(filters);
    setPage(1);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    setExportTruncated(false);
    try {
      const { rows, truncated } = await fetchAllPages<PermitOut>(async (p, pageSize) => {
        const { data, error } = await api.GET('/api/v1/permits', {
          params: { query: { ...toPermitsQuery(queryFilters), page: p, page_size: pageSize } },
        });
        if (error) throw apiError(error);
        return data;
      });
      const csv = toCsv(rows, [
        { header: 'number', value: (r) => formatPermitNumber(r.series, r.number) },
        { header: 'status', value: (r) => getPermitStatusLabel(r.status, lang) },
        { header: 'organization_id', value: (r) => r.organization_id },
        { header: 'period_from', value: (r) => formatDate(r.period_from) },
        { header: 'period_to', value: (r) => formatDate(r.period_to) },
        { header: 'area_ha', value: (r) => r.area_ha ?? '' },
        { header: 'amount', value: (r) => formatMoney(r.amount) },
      ]);
      downloadCsv(`permits-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      setExportTruncated(truncated);
    } finally {
      setExporting(false);
    }
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6 font-sans pb-16" data-testid={isStaff ? 'permits-page' : 'my-permits-page'}>
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">
          {isStaff ? lt.staffTitle : lt.applicantTitle}
        </h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">
          {isStaff ? lt.staffSubtitle : lt.applicantSubtitle}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 items-end ${isStaff ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
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
          <FormField label={lt.series}>
            <Input
              value={filters.series}
              onChange={(e) => setFilters((f) => ({ ...f, series: e.target.value }))}
              placeholder="А"
              maxLength={8}
            />
          </FormField>
          <FormField label={lt.number}>
            <Input
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value.replace(/\D/g, '') }))}
              placeholder="000002"
              inputMode="numeric"
            />
          </FormField>
          {isStaff && (
            <FormField label={lt.organization}>
              <Select
                value={filters.organization_id}
                onChange={(e) => {
                  const newOrg = e.target.value;
                  setFilters((f) => ({ ...f, organization_id: newOrg }));
                  setAppliedFilters((af) => ({ ...af, organization_id: newOrg }));
                  setPage(1);
                }}
                options={[
                  { value: '', label: lt.all },
                  ...(organizations.data?.items ?? []).map((o) => ({
                    value: o.id,
                    label: pickLocalizedName(o.name, lang) || o.code,
                  })),
                ]}
              />
            </FormField>
          )}
        </div>
        <div className="flex justify-end gap-2">
          {isStaff && (
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
          )}
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {lt.reset}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {lt.apply}
          </Button>
        </div>
      </form>

      {isStaff && exportTruncated && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E]" role="alert">
          {t('prosecutor.exportTruncated')}
        </div>
      )}

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? errorText(list.error) : lt.loadError}
        </div>
      )}

      {isStaff ? (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                  <th className="p-3">{lt.colPermitNo}</th>
                  <th className="p-3">{lt.colStatus}</th>
                  <th className="p-3">{lt.colActivity}</th>
                  <th className="p-3">{lt.colOrg}</th>
                  <th className="p-3">{lt.colPeriod}</th>
                  <th className="p-3 text-right">{lt.colArea}</th>
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
                  list.data!.items.map((permit) => <PermitRow key={permit.id} permit={permit} />)
                )}
              </tbody>
            </table>
          </div>

          {list.data && list.data.total > 0 && (
            <div className="px-4 border-t border-[#E4E7EA]">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
            </div>
          )}
        </div>
      ) : list.isLoading ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {lt.loading}
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">{lt.noPermitsApplicant}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {list.data!.items.map((permit) => (
              <PermitCard key={permit.id} permit={permit} />
            ))}
          </div>
          {list.data && list.data.total > 0 && (
            <div className="mt-4 bg-white border border-[#E4E7EA] rounded-2xl px-4 py-2">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
