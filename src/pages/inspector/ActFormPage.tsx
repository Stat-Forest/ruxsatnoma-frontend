/**
 * С15/С16 — an inspection act, draft and read-only branches (task 4).
 * Serves BOTH `/inspections/acts/new` (optional `task_id`/`permit_id`/
 * `application_id` query params from `TaskDetailPage`'s "start inspection
 * act" button, or none at all — the "activity without a permit" entry point,
 * `ActsTab`'s own "New inspection" button, task 6) and `/inspections/acts/:id`
 * (an existing act) — the same component, branching on whether `id` is
 * present (`routes.tsx` gives `new` its own literal path, so `useParams`
 * never confuses the two).
 *
 * Task 5's photo gallery (`ActPhotosCard`) and ERI sign card (`ActSignCard`)
 * mount here too, plus the post-sign routing to the violation case a
 * `result: 'violation'` sign opens.
 */
import { useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { useLanguage, useT } from '../../i18n/useT';
import { api } from '../../api/client';
import { Button } from '../../components/ui/button';
import { FormField, Select, Textarea } from '../../components/ui/FormControls';
import { apiError, ApiError } from '../../api/errors';
import { pickLocalizedName } from './format';
import {
  useAct,
  useChecklists,
  useCreateAct,
  useUpdateAct,
  type ActCreateIn,
  type ActOut,
  type ActUpdateIn,
} from './queries';
import { ChecklistFields } from './components/ChecklistFields';
import { FactsEditor } from './components/FactsEditor';
import { ActGpsCard } from './components/ActGpsCard';
import { ActPhotosCard } from './components/ActPhotosCard';
import { ActSignCard } from './components/ActSignCard';
import type { GeoFix } from './geo';

type ResultValue = 'compliant' | 'warning' | 'violation' | '';

/** `ERR-INSP-002`'s `details.missing: string[]` — the checklist question
 *  codes a create/update was refused over. Anything else (a different
 *  error code, no `details` at all) yields an empty list, which the caller
 *  renders as a top-level banner instead. */
function missingChecklistCodes(err: unknown): string[] {
  if (!(err instanceof ApiError) || err.code !== 'ERR-INSP-002') return [];
  const missing = (err.details as { missing?: unknown } | undefined)?.missing;
  return Array.isArray(missing) ? missing.filter((code): code is string => typeof code === 'string') : [];
}

function factsRecordToStrings(facts: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(facts).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
}

export function ActFormPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { me } = useAuth();
  const t = useT();
  const { lang } = useLanguage();

  const isNew = !id;
  const actQuery = useAct(id);
  const checklistsQuery = useChecklists();
  const createAct = useCreateAct();
  const updateAct = useUpdateAct(id ?? '');

  const [checklistId, setChecklistId] = useState('');
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<ResultValue>('');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString());
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  // Set once a signed `result: 'violation'` act's own case could not be
  // found on the first, generously-sized page of `GET /inspections/cases`
  // (the documented backend gap — no `act_id` filter on that route, see the
  // task report) — the fallback banner below, never a silent dead end.
  const [caseLookupFallback, setCaseLookupFallback] = useState(false);

  // Copies the loaded act into local editable state exactly ONCE per act
  // identity — set during RENDER, guarded by a ref keyed on the act's own
  // id (the `ApplicationWizardPage.tsx::hydratedForId` idiom), not inside a
  // `useEffect`: after the first copy this component owns the fields (they
  // are editable), so a later background refetch must never clobber an
  // in-progress edit, and this shape is what `eslint-plugin-react-hooks`'s
  // `set-state-in-effect` rule recognises as the sanctioned way to derive
  // initial local state from an async load.
  const hydratedForId = useRef(actQuery.data?.id);
  if (hydratedForId.current !== actQuery.data?.id) {
    hydratedForId.current = actQuery.data?.id;
    const act = actQuery.data;
    if (act) {
      setChecklistId(act.checklist_id);
      setAnswers(act.answers ?? {});
      setFacts(factsRecordToStrings(act.facts ?? {}));
      setNotes(act.notes ?? '');
      setResult((act.result as ResultValue) ?? '');
      setOccurredAt(act.occurred_at);
      if (act.gps) {
        setFix({
          lon: act.gps.lon,
          lat: act.gps.lat,
          accuracyM: act.gps_accuracy_m != null ? Number(act.gps_accuracy_m) : null,
        });
      }
    }
  }

  const checklists = checklistsQuery.data ?? [];
  const activeChecklists = checklists.filter((c) => c.status === 'active');
  const selectedChecklist = checklists.find((c) => c.id === checklistId) ?? null;

  const taskIdParam = searchParams.get('task_id') || undefined;
  const permitIdParam = searchParams.get('permit_id') || undefined;
  const applicationIdParam = searchParams.get('application_id') || undefined;
  const hasContext = !!(taskIdParam || permitIdParam || applicationIdParam);

  // Only a DRAFT act belonging to the viewer is editable — a signed act, or
  // a draft belonging to someone else (only reachable at all by a
  // `view_any` holder such as `executor_head`), is frozen: `PATCH`/`sign`
  // both hard-refuse a non-owner regardless of permissions (`ERR-ACL-001`).
  const readOnly = !isNew && !!actQuery.data && !(actQuery.data.status === 'draft' && actQuery.data.inspector_id === me?.user.id);

  function updateAnswer(code: string, value: unknown) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined) delete next[code];
      else next[code] = value;
      return next;
    });
  }

  async function handleSaveDraft() {
    if (!checklistId) return;
    setMissing([]);
    const body: ActCreateIn = {
      task_id: taskIdParam,
      permit_id: permitIdParam,
      application_id: applicationIdParam,
      occurred_at: occurredAt,
      gps: fix ? { lon: fix.lon, lat: fix.lat } : undefined,
      gps_accuracy_m: fix?.accuracyM ?? undefined,
      checklist_id: checklistId,
      answers,
      facts,
      notes: notes.trim() || undefined,
      result: result === '' ? undefined : result,
    };
    try {
      const created = await createAct.mutateAsync(body);
      navigate(`/inspections/acts/${created.id}`, { replace: true });
    } catch (err) {
      setMissing(missingChecklistCodes(err));
    }
  }

  async function handleSaveChanges() {
    if (!id) return;
    setMissing([]);
    const body: ActUpdateIn = {
      occurred_at: occurredAt,
      gps: fix ? { lon: fix.lon, lat: fix.lat } : undefined,
      gps_accuracy_m: fix?.accuracyM ?? undefined,
      answers,
      facts,
      notes: notes.trim() || null,
      result: result === '' ? null : result,
    };
    try {
      await updateAct.mutateAsync(body);
    } catch (err) {
      setMissing(missingChecklistCodes(err));
    }
  }

  /** `ActSignCard`'s `onSigned` — a `result: 'violation'` sign opens a
   *  violation case server-side (`service.py::sign_act`) with no id link
   *  surfaced anywhere this API exposes: `CaseOut.act_id` exists but `GET
   *  /inspections/cases` has no `act_id` filter (the plan's own documented
   *  gap). Fetches one generously-sized page and matches client-side;
   *  not found there (or the lookup itself fails) falls back to a banner
   *  pointing at the Cases tab rather than a silent dead end — this lookup
   *  is a courtesy, never a blocker, the act is already signed regardless
   *  of whether it succeeds. `result !== 'violation'` needs none of this:
   *  the page just re-renders read-only once the sign invalidates the act
   *  query. */
  async function handleSigned(signed: ActOut) {
    if (signed.result !== 'violation') return;
    try {
      const { data, error } = await api.GET('/api/v1/inspections/cases', {
        params: { query: { page: 1, page_size: 100 } },
      });
      if (error) throw apiError(error);
      const found = data.items.find((c) => c.act_id === signed.id);
      if (found) {
        navigate(`/inspections/cases/${found.id}`);
        return;
      }
    } catch {
      // fall through to the fallback banner below
    }
    setCaseLookupFallback(true);
  }

  if (!isNew && actQuery.isLoading) {
    return (
      <div className="py-16 text-center text-sm text-[#5A646D]" data-testid="act-form-page">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> {t('inspector.actForm.loading')}
      </div>
    );
  }

  if (!isNew && (actQuery.error || !actQuery.data)) {
    return (
      <div className="py-16 text-center text-sm text-[#991B1B]" data-testid="act-form-page" role="alert">
        {actQuery.error instanceof ApiError ? `${actQuery.error.code}: ${actQuery.error.message}` : t('inspector.actForm.notFound')}
      </div>
    );
  }

  const mutation = isNew ? createAct : updateAct;
  const mutationError = mutation.error instanceof ApiError && missing.length === 0 ? mutation.error : null;
  // A create with neither task/permit/application context needs a captured
  // GPS fix (the backend's own "at least one of task_id/permit_id
  // /application_id/gps" rule) — disabled here rather than left to a
  // request the backend would refuse.
  const canSaveDraft = !!checklistId && (hasContext || !!fix);

  return (
    <div className="space-y-6 font-sans pb-24" data-testid="act-form-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">
          {isNew ? t('inspector.actForm.newTitle') : t('inspector.actForm.title')}
        </h1>
      </div>

      {readOnly && (
        <div className="p-3 bg-[#F8F9FA] border border-[#E4E7EA] rounded-xl text-xs text-[#5A646D]">
          {t('inspector.actForm.readOnlyNotice')}
        </div>
      )}

      {checklistsQuery.error && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          {t('inspector.actForm.checklistsLoadError')}
        </div>
      )}

      {isNew ? (
        <FormField label={t('inspector.actForm.checklistLabel')} required>
          <Select
            touchSize
            value={checklistId}
            onChange={(e) => setChecklistId(e.target.value)}
            options={[
              { value: '', label: t('inspector.actForm.checklistPlaceholder') },
              ...activeChecklists.map((c) => ({ value: c.id, label: pickLocalizedName(c.name, lang) || c.code })),
            ]}
          />
        </FormField>
      ) : (
        selectedChecklist && (
          <p className="text-sm text-[#5A646D]">
            {t('inspector.actForm.checklistLabel')}{' '}
            <strong className="text-[#1A1F24]">{pickLocalizedName(selectedChecklist.name, lang) || selectedChecklist.code}</strong>
          </p>
        )
      )}

      {selectedChecklist && (
        <ChecklistFields
          checklist={selectedChecklist}
          answers={answers}
          onChange={updateAnswer}
          errors={missing}
          readOnly={readOnly}
        />
      )}

      <FactsEditor facts={facts} onChange={setFacts} readOnly={readOnly} />

      <ActGpsCard
        fix={fix}
        onCapture={setFix}
        distanceToContourM={!isNew ? actQuery.data?.distance_to_contour_m : undefined}
        readOnly={readOnly}
      />

      <FormField label={t('inspector.actForm.resultLabel')}>
        <Select
          touchSize
          disabled={readOnly}
          value={result}
          onChange={(e) => setResult(e.target.value as ResultValue)}
          options={[
            { value: '', label: t('inspector.actForm.result.placeholder') },
            { value: 'compliant', label: t('inspector.actForm.result.compliant') },
            { value: 'warning', label: t('inspector.actForm.result.warning') },
            { value: 'violation', label: t('inspector.actForm.result.violation') },
          ]}
        />
      </FormField>

      <FormField label={t('inspector.actForm.notesLabel')}>
        <Textarea disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
      </FormField>

      {missing.length > 0 && (
        <p className="text-xs text-[#B91C1C]" role="alert">
          {t('inspector.actForm.missingAnswers')}
        </p>
      )}

      {mutationError && (
        <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-xs text-[#991B1B]" role="alert">
          <p className="font-bold">{mutationError.code}</p>
          <p>{mutationError.message}</p>
        </div>
      )}

      {!readOnly &&
        (isNew ? (
          <Button
            size="touch"
            variant="primary"
            fullWidth
            disabled={!canSaveDraft}
            isLoading={createAct.isPending}
            onClick={() => void handleSaveDraft()}
          >
            {t('inspector.actForm.saveDraftButton')}
          </Button>
        ) : (
          <Button size="touch" variant="primary" fullWidth isLoading={updateAct.isPending} onClick={() => void handleSaveChanges()}>
            {t('inspector.actForm.saveChangesButton')}
          </Button>
        ))}

      {actQuery.data && (
        <ActPhotosCard actId={actQuery.data.id} files={actQuery.data.files} currentFix={fix} readOnly={readOnly} />
      )}

      {actQuery.data && !readOnly && (
        <ActSignCard act={actQuery.data} onSigned={(signed) => void handleSigned(signed)} />
      )}

      {caseLookupFallback && (
        <div className="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-xs text-[#92400E] space-y-2" role="status">
          <p>{t('inspector.actForm.sign.violationCaseOpenedFallback')}</p>
          <Button size="sm" variant="outline" onClick={() => navigate('/inspections')}>
            {t('inspector.actForm.sign.goToCasesTab')}
          </Button>
        </div>
      )}
    </div>
  );
}
