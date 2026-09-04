import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Pagination } from '../../components/ui/Navigation';
import { ApiError } from '../../api/errors';
import { useLanguage } from '../../i18n/useT';
import { usePermitsList, type PermitListFilters, type PermitStatus } from './queries';
import { useLeshozOrganizations } from './useRefsLookup';
import { pickLocalizedName } from './format';
import { PERMIT_STATUS_LABEL } from './statusMeta';
import { PermitRow } from './components/PermitRow';
import { PermitCard } from './components/PermitCard';

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: PermitStatus | ''; label: string }[] = [
  { value: '', label: 'Barchasi' },
  ...(Object.entries(PERMIT_STATUS_LABEL) as [PermitStatus, string][]).map(([value, label]) => ({ value, label })),
];

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
 *
 * No `organization_id` filter for the applicant: `list_permits` already
 * scopes their view to their own permits server-side
 * (`auth_service.own_applicant_ids`), so a leshoz picker there would filter
 * a list that is already theirs alone.
 */
export function PermitsListPage({ variant }: { variant: 'staff' | 'applicant' }) {
  const { lang } = useLanguage();
  const isStaff = variant === 'staff';
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

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

  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6 font-sans pb-16" data-testid={isStaff ? 'permits-page' : 'my-permits-page'}>
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">
          {isStaff ? 'Ruxsatnomalar reyestri' : 'Mening ruxsatnomalarim'}
        </h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1">
          {isStaff
            ? 'Sizga koʻrish huquqi berilgan zonada berilgan barcha elektron ruxsatnomalar'
            : 'Sizga berilgan elektron ruxsatnomalar roʻyxati'}
        </p>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3">
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 items-end ${isStaff ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <FormField label="Status">
            <Select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as FilterFormState['status'] }))}
              options={STATUS_OPTIONS}
            />
          </FormField>
          <FormField label="Seriya">
            <Input
              value={filters.series}
              onChange={(e) => setFilters((f) => ({ ...f, series: e.target.value }))}
              placeholder="А"
              maxLength={8}
            />
          </FormField>
          <FormField label="Raqami">
            <Input
              value={filters.number}
              onChange={(e) => setFilters((f) => ({ ...f, number: e.target.value.replace(/\D/g, '') }))}
              placeholder="000002"
              inputMode="numeric"
            />
          </FormField>
          {isStaff && (
            <FormField label="Oʻrmon xoʻjaligi">
              <Select
                value={filters.organization_id}
                onChange={(e) => setFilters((f) => ({ ...f, organization_id: e.target.value }))}
                options={[
                  { value: '', label: 'Barchasi' },
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
          {list.error instanceof ApiError ? `${list.error.code}: ${list.error.message}` : 'Ruxsatnomalar yuklanmadi.'}
        </div>
      )}

      {isStaff ? (
        <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA] text-[#5A646D] uppercase font-bold text-[11px]">
                  <th className="p-3">Ruxsatnoma №</th>
                  <th className="p-3">Holati</th>
                  <th className="p-3">Faoliyat turi</th>
                  <th className="p-3">Oʻrmon xoʻjaligi</th>
                  <th className="p-3">Davr</th>
                  <th className="p-3 text-right">Maydon, ga</th>
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
                      Filtr boʻyicha ruxsatnoma topilmadi.
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
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Yuklanmoqda...
        </div>
      ) : (list.data?.items.length ?? 0) === 0 ? (
        <div className="py-16 text-center text-sm text-[#5A646D]">Hozircha ruxsatnomalar yoʻq.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {list.data!.items.map((permit) => (
              <PermitCard key={permit.id} permit={permit} />
            ))}
          </div>
          {list.data && list.data.total > 0 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalRecords={list.data.total} />
          )}
        </>
      )}
    </div>
  );
}
