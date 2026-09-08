import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { listActivityTypes, listApplications, type ApplicationOut, type ApplicationStatus } from './api';
import { formatDate } from './format';
import { pickName } from './format';
import { ALL_STATUSES, STATUS_BADGE_KIND, getStatusLabel } from './statusMeta';
import { useLanguage } from '../../i18n/useT';

const PAGE_SIZE = 20;

const MY_APPS_I18N = {
  uz_latn: {
    title: 'Mening arizalarim',
    subtitle: 'Barcha topshirilgan arizalar va qoralamalar roʻyxati',
    newApp: 'Yangi ariza topshirish',
    colNumber: 'Ariza raqami',
    colActivity: 'Faoliyat turi',
    colPeriod: 'Davr',
    colStatus: 'Holati',
    colCreatedAt: 'Yaratilgan',
    filterNumber: 'Ariza raqami',
    filterStatus: 'Holati',
    filterActivity: 'Faoliyat turi',
    all: 'Barchasi',
    draft: 'qoralama',
    open: 'Ochish →',
    emptyTitle: 'Hozircha arizalar yoʻq',
    emptyDesc: 'Birinchi arizangizni topshirish uchun yuqoridagi tugmani bosing',
  },
  uz_cyrl: {
    title: 'Менинг аризаларим',
    subtitle: 'Барча топширилган аризалар ва қораламалар рўйхати',
    newApp: 'Янги ариза топшириш',
    colNumber: 'Ариза рақами',
    colActivity: 'Фаолият тури',
    colPeriod: 'Давр',
    colStatus: 'Ҳолати',
    colCreatedAt: 'Яратилган',
    filterNumber: 'Ариза рақами',
    filterStatus: 'Ҳолати',
    filterActivity: 'Фаолият тури',
    all: 'Барчаси',
    draft: 'қоралама',
    open: 'Очиш →',
    emptyTitle: 'Ҳозирча аризалар йўқ',
    emptyDesc: 'Биринчи аризангизни топшириш учун юқоридаги тугмани босинг',
  },
  ru: {
    title: 'Мои заявки',
    subtitle: 'Список всех поданных заявок и черновиков',
    newApp: 'Подать новую заявку',
    colNumber: 'Номер заявки',
    colActivity: 'Вид деятельности',
    colPeriod: 'Период',
    colStatus: 'Статус',
    colCreatedAt: 'Создано',
    filterNumber: 'Номер заявки',
    filterStatus: 'Статус',
    filterActivity: 'Вид деятельности',
    all: 'Все',
    draft: 'черновик',
    open: 'Открыть →',
    emptyTitle: 'Заявок пока нет',
    emptyDesc: 'Нажмите кнопку выше, чтобы подать первую заявку',
  },
  en: {
    title: 'My applications',
    subtitle: 'List of all submitted applications and drafts',
    newApp: 'Submit new application',
    colNumber: 'Application number',
    colActivity: 'Activity type',
    colPeriod: 'Period',
    colStatus: 'Status',
    colCreatedAt: 'Created at',
    filterNumber: 'Application number',
    filterStatus: 'Status',
    filterActivity: 'Activity type',
    all: 'All',
    draft: 'draft',
    open: 'Open →',
    emptyTitle: 'No applications yet',
    emptyDesc: 'Click the button above to submit your first application',
  },
  kaa: {
    title: 'Meniń arzalarım',
    subtitle: 'Barlıq tapsırılǵan arzalar hám dáslepki nusqalar dizimi',
    newApp: 'Jańa arza tapsırıw',
    colNumber: 'Arza nómeri',
    colActivity: 'Xızmet túri',
    colPeriod: 'Dáwir',
    colStatus: 'Jaǵdayı',
    colCreatedAt: 'Jaratılǵan',
    filterNumber: 'Arza nómeri',
    filterStatus: 'Jaǵdayı',
    filterActivity: 'Xızmet túri',
    all: 'Barlıǵı',
    draft: 'dáslepki nusqa',
    open: 'Ashıw →',
    emptyTitle: 'Házirshe arzalar joq',
    emptyDesc: 'Dáslepki arzańızdı tapsırıw ushın joqarıdaǵı túymeni basıń',
  },
};

/** B6 — the applicant's own application list, with the filters `GET
 * /applications` already supports server-side (ruling: the service scopes
 * "my own" for an applicant caller, so no `applicant_id` is sent here). */
export function MyApplicationsPage() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const t = MY_APPS_I18N[lang as keyof typeof MY_APPS_I18N] || MY_APPS_I18N.uz_latn;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [number, setNumber] = useState('');

  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const activityTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activityTypesQuery.data ?? []) map.set(a.id, pickName(a.name, lang));
    return map;
  }, [activityTypesQuery.data, lang]);

  const applicationsQuery = useQuery({
    queryKey: ['my-applications', { page, status, activityTypeId, number }],
    queryFn: () =>
      listApplications({
        page,
        page_size: PAGE_SIZE,
        status: status || undefined,
        activity_type_id: activityTypeId || undefined,
        number: number || undefined,
      }),
    placeholderData: (prev) => prev,
  });

  const columns: Column<ApplicationOut>[] = [
    {
      key: 'number',
      header: t.colNumber,
      accessor: (row) => (
        <span className="font-mono font-semibold text-[#1A1F24]">{row.number ?? `${t.draft} (${row.id.slice(0, 8)})`}</span>
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
      accessor: (row) => <StatusBadge status={STATUS_BADGE_KIND[row.status]} label={getStatusLabel(row.status, lang)} size="sm" />,
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
          onClick={() => navigate(`/my/applications/${row.id}`)}
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
    <div className="max-w-6xl mx-auto space-y-6 font-sans pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E4E7EA] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">{t.title}</h1>
          <p className="text-sm text-[#5A646D] mt-1">{t.subtitle}</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/my/applications/new')}
          className="font-bold cursor-pointer"
        >
          {t.newApp}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FormField label={t.filterNumber} htmlFor="filter-number">
          <Input
            id="filter-number"
            leftIcon={<Search className="w-4 h-4" />}
            placeholder="RX-2026-000123"
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <FormField label={t.filterStatus} htmlFor="filter-status">
          <Select
            id="filter-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ApplicationStatus | '');
              setPage(1);
            }}
            options={[{ value: '', label: t.all }, ...ALL_STATUSES.map((s) => ({ value: s, label: getStatusLabel(s, lang) }))]}
          />
        </FormField>
        <FormField label={t.filterActivity} htmlFor="filter-activity">
          <Select
            id="filter-activity"
            value={activityTypeId}
            onChange={(e) => {
              setActivityTypeId(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t.all },
              ...(activityTypesQuery.data ?? []).map((a) => ({ value: a.id, label: pickName(a.name, lang) })),
            ]}
          />
        </FormField>
      </div>

      <DataTable
        columns={columns}
        data={applicationsQuery.data?.items ?? []}
        isLoading={applicationsQuery.isLoading}
        emptyTitle={t.emptyTitle}
        emptyDescription={t.emptyDesc}
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
      />
    </div>
  );
}
