import { useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useListUrlState } from '../../lib/useListUrlState';
import { useLanguage } from '../../i18n/useT';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useApiErrorText } from '../../i18n/useApiErrorText';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { useActivityTypes, useApplicationsList, type ApplicationListFilters, type ApplicationOut } from './queries';
import { localizedName, STATUS_LABELS, statusLabel } from './format';
import { translateTerm } from '../../i18n/terms';
import { WorklistRow } from './components/WorklistRow';
import { StartReviewConfirmModal } from './components/StartReviewConfirmModal';

const REVIEW_PERMISSION = 'applications.review';
const PAGE_SIZE = 20;

const APPLICATIONS_LIST_I18N = {
  uz_latn: {
    title: 'Arizalar',
    subtitle: 'Sizga koʻrish huquqi berilgan arizalar — oʻzingizniki yoki (xodim/rahbar boʻlsangiz) tashkilotingiz zonasi boʻyicha',
    status: 'Status',
    activityType: 'Faoliyat turi',
    search: 'Qidiruv',
    searchHint: 'Ariza raqami yoki arizachining F.I.Sh.',
    periodFrom: 'Davr — dan',
    periodTo: 'Davr — gacha',
    all: 'Barchasi',
    reset: 'Tiklash',
    apply: 'Qoʻllash',
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
    search: 'Қидирув',
    searchHint: 'Ариза рақами ёки аризачининг Ф.И.Ш.',
    periodFrom: 'Давр — дан',
    periodTo: 'Давр — гача',
    all: 'Барчаси',
    reset: 'Тиклаш',
    apply: 'Қўллаш',
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
    search: 'Поиск',
    searchHint: 'Номер заявки или ФИО заявителя',
    periodFrom: 'Период — с',
    periodTo: 'Период — по',
    all: 'Все',
    reset: 'Сбросить',
    apply: 'Применить',
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
    search: 'Search',
    searchHint: 'Application number or applicant name',
    periodFrom: 'Period — from',
    periodTo: 'Period — to',
    all: 'All',
    reset: 'Reset',
    apply: 'Apply',
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
    search: 'Izlew',
    searchHint: 'Arza nómeri yamasa arza beriwshiniń F.A.Á.',
    periodFrom: 'Dáwir — baslap',
    periodTo: 'Dáwir — deyin',
    all: 'Barlıǵı',
    reset: 'Qayta tiklew',
    apply: 'Qollaw',
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
  q: string;
  period_from: string;
  period_to: string;
}

const EMPTY_FILTERS: FilterFormState = {
  status: '',
  activity_type_id: '',
  q: '',
  period_from: '',
  period_to: '',
};

/** The URL owns `status`; the form types it more narrowly than a string. */
function asStatus(value: string): FilterFormState['status'] {
  return value as FilterFormState['status'];
}

export function ApplicationsListPage() {
  const { me } = useAuth();
  const { lang } = useLanguage();
  const lt = APPLICATIONS_LIST_I18N[lang as keyof typeof APPLICATIONS_LIST_I18N] || APPLICATIONS_LIST_I18N.uz_latn;
  const errorText = useApiErrorText();
  // The applied filters and the page live in the URL (`useListUrlState`), so
  // opening a card and coming back — Back, or the card's own link — shows
  // the same page of the same filtered list; `filters` is the form's draft.
  const { filters: appliedFilters, page, setFilters: applyPatch, setPage, reset } = useListUrlState(EMPTY_FILTERS);
  const [filters, setFilters] = useState<FilterFormState>(appliedFilters);
  // The row whose "Ishga olish" is awaiting confirmation; the modal is
  // rendered here, outside the clickable rows (see `StartReviewConfirmModal`).
  const [confirmRow, setConfirmRow] = useState<ApplicationOut | null>(null);

  // Auto-apply text/date filters with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      applyPatch({ q: filters.q, period_from: filters.period_from, period_to: filters.period_to });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.period_from, filters.period_to]);

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
    q: appliedFilters.q || undefined,
    period_from: appliedFilters.period_from || undefined,
    period_to: appliedFilters.period_to || undefined,
    page,
    page_size: PAGE_SIZE,
  };

  const activityTypes = useActivityTypes();
  const list = useApplicationsList(queryFilters);

  const canReview = !!me && (me.is_superuser || me.permissions.includes(REVIEW_PERMISSION));

  function applyFilters() {
    applyPatch(filters);
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS);
    reset();
  }

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

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
                const newStatus = asStatus(e.target.value);
                setFilters((f) => ({ ...f, status: newStatus }));
                applyPatch({ status: newStatus });
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
                applyPatch({ activity_type_id: newId });
              }}
              options={[
                { value: '', label: lt.all },
                ...(activityTypes.data ?? []).map((a) => {
                  const rawName = localizedName(a.name, lang);
                  const translated = translateTerm(rawName, lang);
                  const byCode = translateTerm(a.code, lang);
                  const label =
                    (a.name && typeof a.name[lang] === 'string' && (a.name[lang] as string).trim())
                      ? (a.name[lang] as string)
                      : (translated && translated !== rawName)
                      ? translated
                      : (byCode && byCode !== a.code)
                      ? byCode
                      : rawName || a.code;
                  return { value: a.id, label };
                }),
              ]}
            />
          </FormField>
          <FormField label={lt.search}>
            <Input
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              placeholder={lt.searchHint}
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
          <Button type="button" variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            {lt.reset}
          </Button>
          <Button type="submit" variant="primary" size="sm" onClick={applyFilters}>
            {lt.apply}
          </Button>
          <ExportXlsxButton className="ml-auto" path="/api/v1/applications" query={queryFilters} />
        </div>
      </form>

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
                list.data!.items.map((row) => (
                  <WorklistRow key={row.id} row={row} canReview={canReview} onTakeReview={setConfirmRow} />
                ))
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

      {confirmRow && <StartReviewConfirmModal application={confirmRow} onClose={() => setConfirmRow(null)} />}
    </div>
  );
}
