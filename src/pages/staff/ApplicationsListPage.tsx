import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useActivityTypes, useApplicationsList, type ApplicationListFilters, type ApplicationOut } from './queries';
import { localizedName, STATUS_LABELS } from './format';
import { WorklistRow } from './components/WorklistRow';

const REVIEW_PERMISSION = 'applications.review';
const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: ApplicationOut['status'] | ''; label: string }[] = [
  { value: '', label: 'Barchasi' },
  ...(Object.entries(STATUS_LABELS) as [ApplicationOut['status'], string][]).map(([value, label]) => ({
    value,
    label,
  })),
];

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

/**
 * B6/D1's worklist (`docs/plans/06-frontend-screens.md`) — `GET
 * /applications` with exactly the filters that route accepts
 * (`status`, `activity_type_id`, `number`, `period_from`, `period_to`, plus
 * paging). `contour_id`/`applicant_id` are real query parameters too, but
 * dropped here: nothing resolves either to a name a staff member could
 * search by, and a raw-UUID text box is not a filter worth shipping. Region,
 * SLA-bucket and preset chips from `.reference`'s own `WorklistFiltersPanel`
 * are dropped for the same reason the task brief asks for — the API has no
 * such parameters, and zone scoping already narrows the list to this
 * caller's own organisation server-side.
 */
export function ApplicationsListPage() {
  const { me } = useAuth();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

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

  return (
    <div className="space-y-6" data-testid="applications-page">
      <div>
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">Arizalar</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">
          Sizga koʻrish huquqi berilgan arizalar — oʻzingizniki yoki (xodim/rahbar boʻlsangiz) tashkilotingiz zonasi
          boʻyicha
        </p>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <FormField label="Status">
            <Select
              value={filters.status}
              onChange={(e) =>
                setFilters((f) => ({ ...f, status: e.target.value as FilterFormState['status'] }))
              }
              options={STATUS_OPTIONS}
            />
          </FormField>
          <FormField label="Faoliyat turi">
            <Select
              value={filters.activity_type_id}
              onChange={(e) => setFilters((f) => ({ ...f, activity_type_id: e.target.value }))}
              options={[
                { value: '', label: 'Barchasi' },
                ...(activityTypes.data ?? []).map((a) => ({ value: a.id, label: localizedName(a.name) || a.code })),
              ]}
            />
          </FormField>
          <FormField label="Ariza raqami">
            <Input
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value }))}
              placeholder="RX-2026-000123"
            />
          </FormField>
          <FormField label="Davr — dan">
            <Input
              type="date"
              value={filters.period_from}
              onChange={(e) => setFilters((f) => ({ ...f, period_from: e.target.value }))}
            />
          </FormField>
          <FormField label="Davr — gacha">
            <Input
              type="date"
              value={filters.period_to}
              onChange={(e) => setFilters((f) => ({ ...f, period_to: e.target.value }))}
            />
          </FormField>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" leftIcon={<RotateCcw className="w-3.5 h-3.5" />} onClick={resetFilters}>
            Tiklash
          </Button>
          <Button variant="primary" size="sm" onClick={applyFilters}>
            Qoʻllash
          </Button>
        </div>
      </div>

      {list.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : 'Arizalar yuklanmadi.'}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                <th className="p-3">Raqam</th>
                <th className="p-3">Status</th>
                <th className="p-3">Kontur</th>
                <th className="p-3">Davr</th>
                <th className="p-3 text-right">Maydon, ga</th>
                <th className="p-3">SLA muddati</th>
                <th className="p-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7EA]">
              {list.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Yuklanmoqda...
                  </td>
                </tr>
              ) : (list.data?.items.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#5A646D]">
                    Filtr boʻyicha ariza topilmadi.
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
