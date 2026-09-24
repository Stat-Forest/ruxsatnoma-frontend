import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Inbox, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { Pagination } from '../../components/ui/Navigation';
import { listActivityTypes, listApplications, type ApplicationOut, type ApplicationStatus } from './api';
import { useListUrlState } from '../../lib/useListUrlState';
import { useReturnHereState } from '../../lib/returnTo';
import { formatDate } from './format';
import { pickName } from './format';
import { ALL_STATUSES, getStatusLabel } from './statusMeta';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { useLanguage } from '../../i18n/useT';

const PAGE_SIZE = 20;

const MY_APPS_I18N = {
  uz_latn: {
    title: 'Mening arizalarim',
    subtitle: 'Barcha topshirilgan arizalar roʻyxati',
    newApp: 'Yangi ariza topshirish',
    colNumber: 'Ariza raqami',
    colActivity: 'Faoliyat turi',
    colPeriod: 'Davr',
    colStatus: 'Holati',
    colCreatedAt: 'Yaratilgan',
    filterNumber: 'Ariza raqami',
    filterStatus: 'Holati',
    filterActivity: 'Faoliyat turi',
    filterDateBy: 'Sana boʻyicha',
    filterDateFrom: 'Sana — dan',
    filterDateTo: 'Sana — gacha',
    dateReversed: 'Boshlanish sanasi tugash sanasidan keyin boʻlmasligi kerak',
    all: 'Barchasi',
    noNumber: 'raqamsiz',
    open: 'Ochish →',
    emptyTitle: 'Hozircha arizalar yoʻq',
    emptyDesc: 'Birinchi arizangizni topshirish uchun yuqoridagi tugmani bosing',
    loading: 'Yuklanmoqda...',
  },
  uz_cyrl: {
    title: 'Менинг аризаларим',
    subtitle: 'Барча топширилган аризалар рўйхати',
    newApp: 'Янги ариза топшириш',
    colNumber: 'Ариза рақами',
    colActivity: 'Фаолият тури',
    colPeriod: 'Давр',
    colStatus: 'Ҳолати',
    colCreatedAt: 'Яратилган',
    filterNumber: 'Ариза рақами',
    filterStatus: 'Ҳолати',
    filterActivity: 'Фаолият тури',
    filterDateBy: 'Сана бўйича',
    filterDateFrom: 'Сана — дан',
    filterDateTo: 'Сана — гача',
    dateReversed: 'Бошланиш санаси тугаш санасидан кейин бўлмаслиги керак',
    all: 'Барчаси',
    noNumber: 'рақамсиз',
    open: 'Очиш →',
    emptyTitle: 'Ҳозирча аризалар йўқ',
    emptyDesc: 'Биринчи аризангизни топшириш учун юқоридаги тугмани босинг',
    loading: 'Юкланмоқда...',
  },
  ru: {
    title: 'Мои заявки',
    subtitle: 'Список всех поданных заявок',
    newApp: 'Подать новую заявку',
    colNumber: 'Номер заявки',
    colActivity: 'Вид деятельности',
    colPeriod: 'Период',
    colStatus: 'Статус',
    colCreatedAt: 'Создано',
    filterNumber: 'Номер заявки',
    filterStatus: 'Статус',
    filterActivity: 'Вид деятельности',
    filterDateBy: 'Фильтр по дате',
    filterDateFrom: 'Дата — с',
    filterDateTo: 'Дата — по',
    dateReversed: 'Дата «с» не может быть позже даты «по»',
    all: 'Все',
    noNumber: 'без номера',
    open: 'Открыть →',
    emptyTitle: 'Заявок пока нет',
    emptyDesc: 'Нажмите кнопку выше, чтобы подать первую заявку',
    loading: 'Загрузка...',
  },
  en: {
    title: 'My applications',
    subtitle: 'List of all submitted applications',
    newApp: 'Submit new application',
    colNumber: 'Application number',
    colActivity: 'Activity type',
    colPeriod: 'Period',
    colStatus: 'Status',
    colCreatedAt: 'Created at',
    filterNumber: 'Application number',
    filterStatus: 'Status',
    filterActivity: 'Activity type',
    filterDateBy: 'Filter dates by',
    filterDateFrom: 'Date — from',
    filterDateTo: 'Date — to',
    dateReversed: 'The start date cannot be after the end date',
    all: 'All',
    noNumber: 'no number',
    open: 'Open →',
    emptyTitle: 'No applications yet',
    emptyDesc: 'Click the button above to submit your first application',
    loading: 'Loading...',
  },
  kaa: {
    title: 'Meniń arzalarım',
    subtitle: 'Barlıq tapsırılǵan arzalar dizimi',
    newApp: 'Jańa arza tapsırıw',
    colNumber: 'Arza nómeri',
    colActivity: 'Xızmet túri',
    colPeriod: 'Dáwir',
    colStatus: 'Jaǵdayı',
    colCreatedAt: 'Jaratılǵan',
    filterNumber: 'Arza nómeri',
    filterStatus: 'Jaǵdayı',
    filterActivity: 'Xızmet túri',
    filterDateBy: 'Sáne boyınsha',
    filterDateFrom: 'Sáne — baslap',
    filterDateTo: 'Sáne — deyin',
    dateReversed: 'Baslanıw sánesi tamamlanıw sánesinen keyin bolmawı kerek',
    all: 'Barlıǵı',
    noNumber: 'nomersiz',
    open: 'Ashıw →',
    emptyTitle: 'Házirshe arzalar joq',
    emptyDesc: 'Dáslepki arzańızdı tapsırıw ushın joqarıdaǵı túymeni basıń',
    loading: 'Júklenbekte...',
  },
};

/** Which date the `dateFrom`/`dateTo` window reads: the day the application
 * was filed (`created_from`/`created_to`, a Tashkent calendar day on the
 * server), or its own period (`period_from`/`period_to`, which the server
 * matches by OVERLAP — a window of September finds an application for
 * 25 August – 5 September). One pair of inputs and a switch rather than four
 * inputs: a citizen asks one of the two questions at a time. */
type DateBy = 'created' | 'period';

/** B6 — the applicant's own application list, with the filters `GET
 * /applications` already supports server-side (ruling: the service scopes
 * "my own" for an applicant caller, so no `applicant_id` is sent here). */
interface Filters {
  status: ApplicationStatus | '';
  activityTypeId: string;
  number: string;
  dateBy: DateBy;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = { status: '', activityTypeId: '', number: '', dateBy: 'created', dateFrom: '', dateTo: '' };

export function MyApplicationsPage() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const t = MY_APPS_I18N[lang as keyof typeof MY_APPS_I18N] || MY_APPS_I18N.uz_latn;

  // The filters and the page live in the URL (`useListUrlState`), so opening
  // a card and coming back shows the same filtered page. The number box
  // keeps its own draft and reaches the URL debounced — the router applies
  // a URL change asynchronously, too late for a controlled input's cursor.
  const { filters, page, setFilters, setPage } = useListUrlState(EMPTY_FILTERS);
  const { status, activityTypeId, number, dateFrom, dateTo } = filters;
  // A hand-edited `?dateBy=` reads as the default rather than as a third mode.
  const dateBy: DateBy = filters.dateBy === 'period' ? 'period' : 'created';
  // A reversed window is refused on the form, not sent: the server would
  // answer it with an empty page that reads as "you have no applications".
  const datesReversed = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const windowFrom = datesReversed ? undefined : dateFrom || undefined;
  const windowTo = datesReversed ? undefined : dateTo || undefined;
  const [numberDraft, setNumberDraft] = useState(number);
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ number: numberDraft }), 400);
    return () => clearTimeout(timer);
  }, [numberDraft, setFilters]);
  const returnHere = useReturnHereState();

  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const activityTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activityTypesQuery.data ?? []) map.set(a.id, pickName(a.name, lang));
    return map;
  }, [activityTypesQuery.data, lang]);

  // The one query object both the list and the Excel export send (stage 13):
  // the export is `/api/v1/applications/export.xlsx` in the owner's own scope,
  // and `ExportXlsxButton` strips the paging keys itself.
  const listQuery = {
    page,
    page_size: PAGE_SIZE,
    status: status || undefined,
    activity_type_id: activityTypeId || undefined,
    number: number || undefined,
    created_from: dateBy === 'created' ? windowFrom : undefined,
    created_to: dateBy === 'created' ? windowTo : undefined,
    period_from: dateBy === 'period' ? windowFrom : undefined,
    period_to: dateBy === 'period' ? windowTo : undefined,
  };
  const applicationsQuery = useQuery({
    queryKey: ['my-applications', { page, status, activityTypeId, number, dateBy, windowFrom, windowTo }],
    queryFn: () => listApplications(listQuery),
    placeholderData: (prev) => prev,
  });

  const columns: Column<ApplicationOut>[] = [
    {
      key: 'number',
      header: t.colNumber,
      accessor: (row) => (
        <span className="font-mono font-semibold text-[#1A1F24]">{row.number ?? `${t.noNumber} (${row.id.slice(0, 8)})`}</span>
      ),
    },
    {
      key: 'activity',
      header: t.colActivity,
      accessor: (row) => (row.activity_type_id ? activityTypeById.get(row.activity_type_id) ?? '—' : '—'),
    },
    {
      key: 'period',
      header: t.colPeriod,
      accessor: (row) =>
        row.period_from && row.period_to ? `${formatDate(row.period_from)} — ${formatDate(row.period_to)}` : '—',
    },
    {
      key: 'status',
      header: t.colStatus,
      accessor: (row) => <ApplicationStatusBadge status={row.status} label={getStatusLabel(row.status, lang)} />,
    },
    {
      key: 'created_at',
      header: t.colCreatedAt,
      accessor: (row) => formatDate(row.created_at),
    },
    {
      key: 'actions',
      header: '',
      accessor: (row) => (
        <button
          onClick={() => navigate(`/my/applications/${row.id}`, { state: returnHere })}
          className="text-xs font-bold text-[#2E7D4F] hover:underline cursor-pointer"
        >
          {t.open}
        </button>
      ),
    },
  ];

  const total = applicationsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6 font-sans pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-[#E4E7EA] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1A1F24] tracking-tight">{t.title}</h1>
          <p className="text-xs sm:text-sm text-[#5A646D] mt-1">{t.subtitle}</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4 shrink-0" />}
          onClick={() => navigate('/my/applications/new')}
          className="font-bold cursor-pointer w-full sm:w-auto shrink-0 justify-center"
        >
          {t.newApp}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <FormField label={t.filterNumber} htmlFor="filter-number">
          <Input
            id="filter-number"
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="RX-2026-000123"
            value={numberDraft}
            onChange={(e) => setNumberDraft(e.target.value)}
          />
        </FormField>
        <FormField label={t.filterStatus} htmlFor="filter-status">
          <Select
            id="filter-status"
            value={status}
            onChange={(e) => setFilters({ status: e.target.value as ApplicationStatus | '' })}
            options={[{ value: '', label: t.all }, ...ALL_STATUSES.map((s) => ({ value: s, label: getStatusLabel(s, lang) }))]}
          />
        </FormField>
        <FormField label={t.filterActivity} htmlFor="filter-activity">
          <Select
            id="filter-activity"
            value={activityTypeId}
            onChange={(e) => setFilters({ activityTypeId: e.target.value })}
            options={[
              { value: '', label: t.all },
              ...(activityTypesQuery.data ?? []).map((a) => ({ value: a.id, label: pickName(a.name, lang) })),
            ]}
          />
        </FormField>
        <FormField label={t.filterDateBy}>
          <div
            role="group"
            aria-label={t.filterDateBy}
            className="flex h-10 rounded-lg border border-[#E4E7EA] overflow-hidden bg-white"
          >
            {(
              [
                ['created', t.colCreatedAt],
                ['period', t.colPeriod],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={dateBy === value}
                onClick={() => setFilters({ dateBy: value })}
                className={`flex-1 px-3 text-sm font-semibold cursor-pointer transition-colors ${
                  dateBy === value ? 'bg-[#2E7D4F] text-white' : 'text-[#5A646D] hover:bg-[#F0F7F1]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </FormField>
        <FormField label={t.filterDateFrom} htmlFor="filter-date-from">
          <Input
            id="filter-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setFilters({ dateFrom: e.target.value })}
          />
        </FormField>
        <FormField label={t.filterDateTo} htmlFor="filter-date-to" error={datesReversed ? t.dateReversed : undefined}>
          <Input
            id="filter-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            error={datesReversed}
            onChange={(e) => setFilters({ dateTo: e.target.value })}
          />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <ExportXlsxButton className="ml-auto" path="/api/v1/applications" query={listQuery} />
        </div>
      </div>

      {/* Mobile card view (< md) */}
      <div className="md:hidden space-y-3">
        {applicationsQuery.isLoading ? (
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-8 text-center text-sm text-[#5A646D]">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-[#2E7D4F]" />
            <span>{t.loading}</span>
          </div>
        ) : (applicationsQuery.data?.items ?? []).length === 0 ? (
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-8 text-center space-y-2">
            <Inbox className="w-8 h-8 text-[#9AA3AB] mx-auto" />
            <h3 className="font-semibold text-sm text-[#1A1F24]">{t.emptyTitle}</h3>
            <p className="text-xs text-[#5A646D]">{t.emptyDesc}</p>
          </div>
        ) : (
          applicationsQuery.data!.items.map((row) => (
            <div
              key={row.id}
              onClick={() => navigate(`/my/applications/${row.id}`, { state: returnHere })}
              className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs hover:border-[#2E7D4F] transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="font-mono font-bold text-sm text-[#1A1F24] block break-all">
                    {row.number ?? `${t.noNumber} (${row.id.slice(0, 8)})`}
                  </span>
                  <span className="text-xs text-[#5A646D] mt-0.5 block break-words">
                    {row.activity_type_id ? activityTypeById.get(row.activity_type_id) ?? '—' : '—'}
                  </span>
                </div>
                <div className="shrink-0">
                  <ApplicationStatusBadge status={row.status} label={getStatusLabel(row.status, lang)} />
                </div>
              </div>

              <div className="pt-2 border-t border-[#F1F3F5] grid grid-cols-1 gap-1 text-xs text-[#5A646D]">
                <div className="flex items-center justify-between gap-2">
                  <span>{t.colPeriod}:</span>
                  <span className="font-medium text-[#1A1F24] text-right">
                    {row.period_from && row.period_to ? `${formatDate(row.period_from)} — ${formatDate(row.period_to)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>{t.colCreatedAt}:</span>
                  <span className="font-medium text-[#1A1F24] text-right">{formatDate(row.created_at)}</span>
                </div>
              </div>

              <div className="pt-1.5 flex justify-end border-t border-[#F1F3F5]">
                <span className="text-xs font-bold text-[#2E7D4F] hover:underline">
                  {t.open}
                </span>
              </div>
            </div>
          ))
        )}

        {total > 0 && (
          <div className="bg-white border border-[#E4E7EA] rounded-2xl px-4 py-2">
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={total} />
          </div>
        )}
      </div>

      {/* Desktop table view (>= md) */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={applicationsQuery.data?.items ?? []}
          isLoading={applicationsQuery.isLoading}
          emptyTitle={t.emptyTitle}
          emptyDescription={t.emptyDesc}
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
          onRowClick={(row) => navigate(`/my/applications/${row.id}`, { state: returnHere })}
        />
      </div>
    </div>
  );
}
