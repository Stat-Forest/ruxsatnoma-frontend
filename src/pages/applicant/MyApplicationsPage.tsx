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
import { ALL_STATUSES, STATUS_BADGE_KIND, STATUS_LABELS } from './statusMeta';

const PAGE_SIZE = 20;

/** B6 — the applicant's own application list, with the filters `GET
 * /applications` already supports server-side (ruling: the service scopes
 * "my own" for an applicant caller, so no `applicant_id` is sent here). */
export function MyApplicationsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApplicationStatus | ''>('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [number, setNumber] = useState('');

  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const activityTypeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of activityTypesQuery.data ?? []) map.set(a.id, pickName(a.name));
    return map;
  }, [activityTypesQuery.data]);

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
      header: 'Ariza raqami',
      accessor: (row) => (
        <span className="font-mono font-semibold text-[#1A1F24]">{row.number ?? `qoralama (${row.id.slice(0, 8)})`}</span>
      ),
    },
    {
      key: 'activity',
      header: 'Faoliyat turi',
      accessor: (row) => (row.activity_type_id ? activityTypeById.get(row.activity_type_id) ?? '—' : '—'),
    },
    {
      key: 'period',
      header: 'Davr',
      accessor: (row) =>
        row.period_from && row.period_to ? `${formatDate(row.period_from)} — ${formatDate(row.period_to)}` : '—',
    },
    {
      key: 'status',
      header: 'Holati',
      accessor: (row) => <StatusBadge status={STATUS_BADGE_KIND[row.status]} label={STATUS_LABELS[row.status]} size="sm" />,
    },
    {
      key: 'created_at',
      header: 'Yaratilgan',
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
          Ochish →
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
          <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">Mening arizalarim</h1>
          <p className="text-sm text-[#5A646D] mt-1">Barcha topshirilgan arizalar va qoralamalar roʻyxati</p>
        </div>
        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => navigate('/my/applications/new')}
          className="font-bold cursor-pointer"
        >
          Yangi ariza topshirish
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FormField label="Ariza raqami" htmlFor="filter-number">
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
        <FormField label="Holati" htmlFor="filter-status">
          <Select
            id="filter-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ApplicationStatus | '');
              setPage(1);
            }}
            options={[{ value: '', label: 'Barchasi' }, ...ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          />
        </FormField>
        <FormField label="Faoliyat turi" htmlFor="filter-activity">
          <Select
            id="filter-activity"
            value={activityTypeId}
            onChange={(e) => {
              setActivityTypeId(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Barchasi' },
              ...(activityTypesQuery.data ?? []).map((a) => ({ value: a.id, label: pickName(a.name) })),
            ]}
          />
        </FormField>
      </div>

      <DataTable
        columns={columns}
        data={applicationsQuery.data?.items ?? []}
        isLoading={applicationsQuery.isLoading}
        emptyTitle="Hozircha arizalar yoʻq"
        emptyDescription="Birinchi arizangizni topshirish uchun yuqoridagi tugmani bosing"
        pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
      />
    </div>
  );
}
