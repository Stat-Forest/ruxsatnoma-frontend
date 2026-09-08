/**
 * Cross-entity search (stage 4.5, `docs/plans/04.5-4.7-search-archive.md`) —
 * `GET /api/v1/search?kind=applications|permits`, one kind per call (ruling 2),
 * plus CRUD for the caller's own saved filter profiles
 * (`/search/profiles*`). Gated on `search.use` alone (`shell/navigation.ts`,
 * `routes.tsx`) — the same single-code shape `/oversight` and `/reports` use.
 *
 * A result row is a POINTER, never the full record (`SearchResultOut`'s own
 * docstring): it links to that domain's own card route
 * (`/applications/{id}`, `/permits/{id}`), which independently re-checks
 * what this endpoint's zone filter already narrowed — this screen renders no
 * write action of its own over an application or a permit.
 *
 * `number` is already the PRINTED form for a permit (`search/repo.py`:
 * `"<series> № <000000>"`, built in SQL) — rendered as-is, never
 * reformatted here.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { Save, Search as SearchIcon, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { useLanguage, useT } from '../../i18n/useT';
import { pickLocalizedName } from '../permits/format';
import { statusLabel, type ApplicationStatus } from '../staff/format';
import { getPermitStatusLabel } from '../permits/statusMeta';
import { useActivityTypes, useLeshozOrganizations } from './refs';
import { SearchExportPanel } from './SearchExportPanel';
import { useCreateSavedFilter, useDeleteSavedFilter, useSavedFilters, useSearchResults } from './queries';
import type { SavedFilterOut, SearchKind, SearchResultOut } from './api';

const PAGE_SIZE = 20;

interface Draft {
  q: string;
  status: string;
  organization_id: string;
  activity_type_id: string;
  series: string;
}

const EMPTY_DRAFT: Draft = { q: '', status: '', organization_id: '', activity_type_id: '', series: '' };

export function SearchPage() {
  const t = useT();
  const { lang } = useLanguage();
  const [kind, setKind] = useState<SearchKind>('applications');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [applied, setApplied] = useState<Draft>(EMPTY_DRAFT);
  const [page, setPage] = useState(1);
  const [savingName, setSavingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const activityTypes = useActivityTypes();
  const organizations = useLeshozOrganizations();
  const profiles = useSavedFilters();
  const createProfile = useCreateSavedFilter();
  const deleteProfile = useDeleteSavedFilter();

  const results = useSearchResults({
    kind,
    q: applied.q || undefined,
    status: applied.status || undefined,
    organization_id: applied.organization_id || undefined,
    activity_type_id: kind === 'applications' ? applied.activity_type_id || undefined : undefined,
    series: kind === 'permits' ? applied.series || undefined : undefined,
    page,
    page_size: PAGE_SIZE,
  });
  const total = results.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyFilters() {
    setApplied(draft);
    setPage(1);
  }

  function resetFilters() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setPage(1);
  }

  function applyProfile(profile: SavedFilterOut) {
    const params = profile.params as Partial<Draft>;
    const next: Draft = {
      q: typeof params.q === 'string' ? params.q : '',
      status: typeof params.status === 'string' ? params.status : '',
      organization_id: typeof params.organization_id === 'string' ? params.organization_id : '',
      activity_type_id: typeof params.activity_type_id === 'string' ? params.activity_type_id : '',
      series: typeof params.series === 'string' ? params.series : '',
    };
    setKind(profile.kind);
    setDraft(next);
    setApplied(next);
    setPage(1);
  }

  function saveCurrentAsProfile() {
    const name = savingName.trim();
    if (!name) return;
    createProfile.mutate(
      { name, kind, params: { ...applied } },
      {
        onSuccess: () => {
          setSavingName('');
          setIsSaving(false);
        },
      },
    );
  }

  const columns: Column<SearchResultOut>[] = [
    {
      key: 'number',
      header: t('search.col.number'),
      accessor: (row) => (
        <Link
          to={row.kind === 'applications' ? `/applications/${row.id}` : `/permits/${row.id}`}
          className="font-mono font-semibold text-[#2E7D4F] hover:underline"
        >
          {row.number ?? row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: 'status',
      header: t('search.col.status'),
      accessor: (row) =>
        row.kind === 'applications'
          ? statusLabel(row.status as ApplicationStatus, lang)
          : getPermitStatusLabel(row.status, lang),
    },
    {
      key: 'organization',
      header: t('search.col.organization'),
      accessor: (row) => {
        const org = organizations.data?.items.find((o) => o.id === row.organization_id);
        return org ? pickLocalizedName(org.name, lang) : (row.organization_id?.slice(0, 8) ?? '—');
      },
    },
    { key: 'applicant', header: t('search.col.applicant'), accessor: (row) => row.applicant_name ?? '—' },
    {
      key: 'created_at',
      header: t('search.col.createdAt'),
      accessor: (row) => new Date(row.created_at).toLocaleString(),
    },
  ];

  return (
    <div className="space-y-5 pb-16" data-testid="search-page">
      <header>
        <h1 className="text-lg font-bold text-[#1A1F24] md:text-xl">{t('search.title')}</h1>
      </header>

      <div className="flex gap-2" role="tablist" aria-label={t('search.title')}>
        {(['applications', 'permits'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            data-testid={`search-kind-${k}`}
            onClick={() => {
              setKind(k);
              setPage(1);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              kind === k
                ? 'border-[#2E7D4F] bg-[#F0F7F1] text-[#2E7D4F]'
                : 'border-[#E4E7EA] bg-white text-[#5A646D] hover:bg-[#F8F9FA]'
            }`}
          >
            {k === 'applications' ? t('search.kindApplications') : t('search.kindPermits')}
          </button>
        ))}
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <FormField label={t('search.filters.query')}>
            <Input
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder={t('search.filters.queryPlaceholder')}
            />
          </FormField>
          <FormField label={t('search.filters.status')}>
            <Input value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))} />
          </FormField>
          <FormField label={t('search.filters.organization')}>
            <Select
              value={draft.organization_id}
              onChange={(e) => setDraft((d) => ({ ...d, organization_id: e.target.value }))}
              options={[
                { value: '', label: t('search.filters.allOrganizations') },
                ...(organizations.data?.items ?? []).map((org) => ({
                  value: org.id,
                  label: pickLocalizedName(org.name, lang),
                })),
              ]}
            />
          </FormField>
          {kind === 'applications' ? (
            <FormField label={t('search.filters.activityType')}>
              <Select
                value={draft.activity_type_id}
                onChange={(e) => setDraft((d) => ({ ...d, activity_type_id: e.target.value }))}
                options={[
                  { value: '', label: t('search.filters.allActivityTypes') },
                  ...(activityTypes.data ?? []).map((a) => ({ value: a.id, label: pickLocalizedName(a.name, lang) })),
                ]}
              />
            </FormField>
          ) : (
            <FormField label={t('search.filters.series')}>
              <Input
                value={draft.series}
                maxLength={10}
                onChange={(e) => setDraft((d) => ({ ...d, series: e.target.value }))}
              />
            </FormField>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Save className="w-3.5 h-3.5" />}
            onClick={() => setIsSaving((v) => !v)}
          >
            {t('search.profiles.saveCurrent')}
          </Button>
          <Button variant="outline" size="sm" onClick={resetFilters}>
            {t('search.actions.reset')}
          </Button>
          <Button variant="primary" size="sm" leftIcon={<SearchIcon className="w-3.5 h-3.5" />} onClick={applyFilters}>
            {t('search.actions.search')}
          </Button>
        </div>
        {isSaving && (
          <div className="flex items-end gap-2 border-t border-[#E4E7EA] pt-3" data-testid="save-profile-row">
            <FormField label={t('search.profiles.namePlaceholder')} className="flex-1">
              <Input value={savingName} onChange={(e) => setSavingName(e.target.value)} maxLength={200} />
            </FormField>
            <Button
              variant="primary"
              size="sm"
              isLoading={createProfile.isPending}
              disabled={!savingName.trim()}
              onClick={saveCurrentAsProfile}
              data-testid="save-profile-confirm"
            >
              {t('search.profiles.saveConfirm')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSaving(false)}>
              {t('search.profiles.saveCancel')}
            </Button>
          </div>
        )}
        {createProfile.error && (
          <p className="text-xs text-[#B91C1C]" role="alert">
            {createProfile.error instanceof ApiError
              ? `${createProfile.error.code}: ${createProfile.error.message}`
              : t('search.error')}
          </p>
        )}
      </div>

      {(profiles.data?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="saved-profiles">
          <span className="text-xs font-bold uppercase tracking-wider text-[#5A646D]">
            {t('search.profiles.title')}
          </span>
          {profiles.data!.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-1 rounded-full border border-[#E4E7EA] bg-white px-3 py-1 text-xs"
              data-testid={`saved-profile-${profile.id}`}
            >
              <button className="font-semibold text-[#1A1F24] hover:underline" onClick={() => applyProfile(profile)}>
                {profile.name}
              </button>
              <button
                aria-label={t('search.profiles.delete')}
                className="text-[#767F87] hover:text-[#B91C1C]"
                onClick={() => deleteProfile.mutate(profile.id)}
                data-testid={`saved-profile-delete-${profile.id}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {results.error && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-2xl text-sm text-[#991B1B]" role="alert">
          {results.error instanceof ApiError ? `${results.error.code}: ${results.error.message}` : t('search.error')}
        </div>
      )}

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={results.data?.items ?? []}
          isLoading={results.isLoading}
          emptyTitle={t('search.empty')}
          emptyDescription=""
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
        />
      </div>

      <SearchExportPanel
        kind={kind}
        filters={{
          q: applied.q || undefined,
          status: applied.status || undefined,
          organization_id: applied.organization_id || undefined,
          activity_type_id: kind === 'applications' ? applied.activity_type_id || undefined : undefined,
          series: kind === 'permits' ? applied.series || undefined : undefined,
        }}
      />
    </div>
  );
}
