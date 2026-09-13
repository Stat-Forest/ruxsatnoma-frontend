import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { useLanguage } from '../../i18n/useT';
import { useListUrlState } from '../../lib/useListUrlState';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { toPermitsQuery, usePermitsList, type PermitListFilters, type PermitStatus } from './queries';
import { useLeshozOrganizations } from './useRefsLookup';
import { pickLocalizedName } from './format';
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
    search: 'Qidiruv',
    searchHint: 'Arizachining F.I.Sh.',
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
    search: 'Қидирув',
    searchHint: 'Аризачининг Ф.И.Ш.',
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
    search: 'Поиск',
    searchHint: 'ФИО заявителя',
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
    search: 'Search',
    searchHint: 'Applicant name',
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
    search: 'Izlew',
    searchHint: 'Arza beriwshiniń F.A.Á.',
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
  q: string;
  series: string;
  number: string;
  organization_id: string;
}

const EMPTY_FILTERS: FilterFormState = { status: '', q: '', series: '', number: '', organization_id: '' };

/** The URL owns `status`; the form types it more narrowly than a string. */
function asStatus(value: string): FilterFormState['status'] {
  return value as FilterFormState['status'];
}

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
  const lt = PERMITS_LIST_I18N[lang as keyof typeof PERMITS_LIST_I18N] || PERMITS_LIST_I18N.uz_latn;
  const errorText = useApiErrorText();
  const isStaff = variant === 'staff';
  // The applied filters and the page live in the URL (`useListUrlState`), so
  // opening a permit and coming back shows the same filtered page;
  // `filters` is the form's draft.
  const { filters: appliedFilters, page, setFilters: applyPatch, setPage, reset } = useListUrlState(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterFormState>(appliedFilters);

  // Auto-apply text filters with debounce so typing immediately filters
  useEffect(() => {
    const timer = setTimeout(() => {
      applyPatch({ q: filters.q, series: filters.series, number: filters.number });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.series, filters.number]);

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
    q: appliedFilters.q || undefined,
    series: appliedFilters.series || undefined,
    number: appliedFilters.number || undefined,
    organization_id: isStaff ? appliedFilters.organization_id || undefined : undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const list = usePermitsList(queryFilters);
  const organizations = useLeshozOrganizations();

  function applyFilters() {
    applyPatch(filters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    reset();
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
                const newStatus = asStatus(e.target.value);
                setFilters((f) => ({ ...f, status: newStatus }));
                applyPatch({ status: newStatus });
              }}
              options={statusOptions}
            />
          </FormField>
          <FormField label={lt.search}>
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder={lt.searchHint}
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
                  applyPatch({ organization_id: newOrg });
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
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {lt.reset}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {lt.apply}
          </Button>
          {/* Same route for both variants: `GET /permits` is already scoped to the
              caller server-side (the applicant's own permits, or — holding
              `permits.view_any` — their zone's, `permits/service.py::list_permits`),
              so the citizen's own list gets the export with no new backend work
              (stage 13, Track B). */}
          <ExportXlsxButton className="ml-auto" path="/api/v1/permits" query={toPermitsQuery(queryFilters)} />
        </div>
      </form>

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
