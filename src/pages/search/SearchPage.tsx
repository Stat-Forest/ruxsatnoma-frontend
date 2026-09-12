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
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Save, Search as SearchIcon, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/errors';
import { Button } from '../../components/ui/button';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ExportXlsxButton } from '../../components/ui/ExportXlsxButton';
import { FormField, Input, Select } from '../../components/ui/FormControls';
import { Drawer } from '../../components/ui/Overlay';
import { useLanguage, useT } from '../../i18n/useT';
import { pickLocalizedName } from '../permits/format';
import { statusLabel, STATUS_LABELS_I18N, type ApplicationStatus } from '../staff/format';
import { getPermitStatusLabel, PERMIT_STATUS_LABEL_I18N } from '../permits/statusMeta';
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
  const navigate = useNavigate();
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

  const statusOptions = useMemo(() => {
    if (kind === 'applications') {
      return [
        { value: '', label: t('search.filters.allStatuses') },
        ...(Object.keys(STATUS_LABELS_I18N.uz_latn) as ApplicationStatus[]).map((value) => ({
          value,
          label: statusLabel(value, lang),
        })),
      ];
    }
    return [
      { value: '', label: t('search.filters.allStatuses') },
      ...Object.keys(PERMIT_STATUS_LABEL_I18N.uz_latn).map((value) => ({
        value,
        label: getPermitStatusLabel(value, lang),
      })),
    ];
  }, [kind, lang, t]);

  const currentStatusValue = useMemo(() => {
    const s = draft.status.trim();
    if (!s) return '';
    if (kind === 'applications') {
      const match = (Object.keys(STATUS_LABELS_I18N.uz_latn) as ApplicationStatus[]).find(
        (k) => k.toLowerCase() === s.toLowerCase(),
      );
      return match ?? draft.status;
    }
    const match = Object.keys(PERMIT_STATUS_LABEL_I18N.uz_latn).find(
      (k) => k.toLowerCase() === s.toLowerCase(),
    );
    return match ?? draft.status;
  }, [draft.status, kind]);

  // Auto-apply text filters with debounce so typing immediately filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setApplied((prev) => {
        if (prev.q === draft.q && prev.series === draft.series) return prev;
        setPage(1);
        return { ...prev, q: draft.q, series: draft.series };
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draft.q, draft.series]);

  const normalizedStatus = applied.status.trim()
    ? kind === 'applications'
      ? applied.status.trim().toUpperCase()
      : applied.status.trim().toLowerCase()
    : undefined;

  const results = useSearchResults({
    kind,
    q: applied.q.trim() || undefined,
    status: normalizedStatus,
    organization_id: applied.organization_id || undefined,
    activity_type_id: kind === 'applications' ? applied.activity_type_id || undefined : undefined,
    series: kind === 'permits' ? applied.series.trim() || undefined : undefined,
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
      {
        name,
        kind,
        params: {
          ...applied,
          q: applied.q.trim(),
          series: applied.series.trim(),
          status: normalizedStatus ?? '',
        },
      },
      {
        onSuccess: () => {
          setSavingName('');
          setIsSaving(false);
        },
      },
    );
  }

  const [selectedRow, setSelectedRow] = useState<SearchResultOut | null>(null);

  /** An application no organisation has picked up yet has no card of its own
   * to navigate to — the number opens the drawer instead. Plan 12 (R1): a
   * `DRAFT` application can no longer exist, so this is the one remaining
   * reason. */
  const opensInDrawer = (row: SearchResultOut) => row.kind === 'applications' && !row.organization_id;
  const openRow = (row: SearchResultOut) => {
    if (opensInDrawer(row)) setSelectedRow(row);
    else navigate(row.kind === 'applications' ? `/applications/${row.id}` : `/permits/${row.id}`);
  };

  const columns: Column<SearchResultOut>[] = [
    {
      key: 'number',
      header: t('search.col.number'),
      accessor: (row) => {
        if (opensInDrawer(row)) {
          return (
            <button
              type="button"
              onClick={() => setSelectedRow(row)}
              className="font-mono font-semibold text-[#2E7D4F] hover:underline text-left cursor-pointer"
            >
              {row.number || row.id.slice(0, 8)}
            </button>
          );
        }
        return (
          <Link
            to={row.kind === 'applications' ? `/applications/${row.id}` : `/permits/${row.id}`}
            className="font-mono font-semibold text-[#2E7D4F] hover:underline"
          >
            {row.number || row.id.slice(0, 8)}
          </Link>
        );
      },
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
        const org = row.organization_id
          ? organizations.data?.items.find((o) => o.id === row.organization_id)
          : undefined;
        return org
          ? pickLocalizedName(org.name, lang)
          : (row.organization_id ? row.organization_id.slice(0, 8) : '—');
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
              if (kind !== k) {
                setKind(k);
                setDraft(EMPTY_DRAFT);
                setApplied(EMPTY_DRAFT);
                setPage(1);
              }
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="bg-white border border-[#E4E7EA] rounded-2xl p-5 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <FormField label={t('search.filters.query')}>
            <Input
              value={draft.q}
              onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
              placeholder={t('search.filters.queryPlaceholder')}
            />
          </FormField>
          <FormField label={t('search.filters.status')}>
            <Select
              value={currentStatusValue}
              onChange={(e) => {
                const val = e.target.value;
                setDraft((d) => ({ ...d, status: val }));
                setApplied((a) => ({ ...a, status: val }));
                setPage(1);
              }}
              options={statusOptions}
            />
          </FormField>
          <FormField label={t('search.filters.organization')}>
            <Select
              value={draft.organization_id}
              onChange={(e) => {
                const val = e.target.value;
                setDraft((d) => ({ ...d, organization_id: val }));
                setApplied((a) => ({ ...a, organization_id: val }));
                setPage(1);
              }}
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
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft((d) => ({ ...d, activity_type_id: val }));
                  setApplied((a) => ({ ...a, activity_type_id: val }));
                  setPage(1);
                }}
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
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Save className="w-3.5 h-3.5" />}
            onClick={() => setIsSaving((v) => !v)}
          >
            {t('search.profiles.saveCurrent')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            {t('search.actions.reset')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<SearchIcon className="w-3.5 h-3.5" />}
          >
            {t('search.actions.search')}
          </Button>
        </div>
        {isSaving && (
          <div className="flex items-end gap-2 border-t border-[#E4E7EA] pt-3" data-testid="save-profile-row">
            <FormField label={t('search.profiles.namePlaceholder')} className="flex-1">
              <Input
                value={savingName}
                onChange={(e) => setSavingName(e.target.value)}
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    saveCurrentAsProfile();
                  }
                }}
              />
            </FormField>
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={createProfile.isPending}
              disabled={!savingName.trim()}
              onClick={saveCurrentAsProfile}
              data-testid="save-profile-confirm"
            >
              {t('search.profiles.saveConfirm')}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSaving(false)}>
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
      </form>

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

      <div className="flex justify-end">
        <ExportXlsxButton className="ml-auto"
          path="/api/v1/search"
          query={{
            kind,
            q: applied.q.trim() || undefined,
            status: normalizedStatus,
            organization_id: applied.organization_id || undefined,
            activity_type_id: kind === 'applications' ? applied.activity_type_id || undefined : undefined,
            series: kind === 'permits' ? applied.series.trim() || undefined : undefined,
          }}
        />
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl overflow-hidden shadow-xs">
        <DataTable
          columns={columns}
          data={results.data?.items ?? []}
          isLoading={results.isLoading}
          emptyTitle={t('search.empty')}
          emptyDescription=""
          pagination={{ currentPage: page, totalPages, onPageChange: setPage, totalRecords: total }}
          onRowClick={openRow}
        />
      </div>

      <SearchExportPanel
        kind={kind}
        filters={{
          q: applied.q.trim() || undefined,
          status: normalizedStatus,
          organization_id: applied.organization_id || undefined,
          activity_type_id: kind === 'applications' ? applied.activity_type_id || undefined : undefined,
          series: kind === 'permits' ? applied.series.trim() || undefined : undefined,
        }}
      />

      <Drawer
        isOpen={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        title={t('search.detail.title')}
      >
        {selectedRow && (
          <div className="space-y-4 text-sm" data-testid="search-detail-drawer">
            {!selectedRow.organization_id && (
              <div className="p-3.5 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] leading-relaxed">
                {t('search.detail.noOrgDraftNotice')}
              </div>
            )}

            <div className="divide-y divide-[#E4E7EA] rounded-xl border border-[#E4E7EA] bg-[#F8F9FA] px-4">
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.col.number')}</span>
                <span className="font-mono font-semibold text-[#1A1F24]">
                  {selectedRow.number || selectedRow.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.detail.kind')}</span>
                <span className="font-medium text-[#1A1F24]">
                  {selectedRow.kind === 'applications' ? t('archive.typeApplication') : t('archive.typePermit')}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.col.status')}</span>
                <span>
                  {selectedRow.kind === 'applications'
                    ? statusLabel(selectedRow.status as ApplicationStatus, lang)
                    : getPermitStatusLabel(selectedRow.status, lang)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.col.organization')}</span>
                <span className="font-medium text-[#1A1F24]">
                  {(() => {
                    const org = selectedRow.organization_id
                      ? organizations.data?.items.find((o) => o.id === selectedRow.organization_id)
                      : undefined;
                    return org
                      ? pickLocalizedName(org.name, lang)
                      : (selectedRow.organization_id ? selectedRow.organization_id.slice(0, 8) : t('search.detail.noOrg'));
                  })()}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.col.applicant')}</span>
                <span className="font-medium text-[#1A1F24]">{selectedRow.applicant_name ?? '—'}</span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-xs text-[#5A646D]">{t('search.col.createdAt')}</span>
                <span className="text-xs text-[#5A646D]">
                  {selectedRow.created_at ? new Date(selectedRow.created_at).toLocaleString() : '—'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              {selectedRow.organization_id && (
                <Link
                  to={selectedRow.kind === 'applications' ? `/applications/${selectedRow.id}` : `/permits/${selectedRow.id}`}
                  className="inline-flex items-center justify-center rounded-lg font-medium text-xs px-3 py-2 bg-[#2E7D4F] text-white hover:bg-[#23653F] transition-colors"
                >
                  {t('search.detail.openCard')}
                </Link>
              )}
              <Button variant="secondary" onClick={() => setSelectedRow(null)}>
                {t('search.detail.close')}
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
