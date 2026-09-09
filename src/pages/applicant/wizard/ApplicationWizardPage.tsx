import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useNavigate, useSearchParams, type BlockerFunction } from 'react-router';
import { ArrowLeft, ArrowRight, Loader2, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { Stepper } from '../../../components/ui/Navigation';
import { Modal } from '../../../components/ui/Overlay';
import { ApiError } from '../../../api/errors';
import { saveApplicantAddress } from '../../../api/address';
import { useAuth } from '../../../auth/useAuth';
import type { UiLanguage } from '../../../i18n/context';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import {
  addApplicationDocument,
  createApplicationDraft,
  getApplicationCard,
  getApplicationPackage,
  listActivityTypes,
  listClassifierItems,
  listLivestockTypes,
  patchApplication,
  precheckApplication,
  removeApplicationDocument,
  submitApplication,
  uploadFile,
  type ApplicationItemIn,
  type CalculationIn,
  type PrecheckOut,
} from '../api';
import { formatMoney, formatUnit, pickName } from '../format';
import { fromApplicationChecks } from '../checkTypeLabels';
import { ChecksList } from './ChecksList';
import { ContourPicker, type PickedContour } from './ContourPicker';
import { PricePreviewPanel } from './PricePreviewPanel';
import {
  buildMockSignature,
  EimzoError,
  eimzoErrorMessageKey,
  isEimzoMock,
  isProviderUnreachable,
  signDocument,
} from '../../../lib/eimzo';

const GRAZING_CODE = 'grazing';

// Mirrors the backend's own ceiling (`backend/app/modules/norms/checks.py`,
// `MAX_PERIOD_DAYS = 5 * 366`) so a reversed or overlong period is named IN
// THE FIELD before the request ever reaches the server — decision #177's
// own worked example is exactly this miss: `ERR-VAL-001` with
// `details.reason = "period_reversed"` reached the applicant as the
// generic "data failed validation" sentence, because this screen dropped
// `details` for that code entirely.
const MAX_PERIOD_DAYS = 5 * 366;

/** `iso` + `days` calendar days, in UTC so a local-timezone DST shift can
 *  never shave a day off the span — the same reason `date-only` values are
 *  compared as UTC midnight everywhere else this ceiling is enforced. */
function addIsoDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days between two `YYYY-MM-DD` values — the same quantity
 *  `(period_to - period_from).days` computes server-side. */
function isoDaySpan(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

/**
 * Local copy, not `i18n/errorMessages.ts` (T3's file this stage) and not
 * the shared `DICTIONARIES` either — a client-side check has no backend
 * error code to key `errorMessages.ts` on, and a key added to `uz_latn.ts`
 * would have to be added to all five dictionaries just for two sentences
 * this one screen uses. Same idiom `Navigation.tsx`'s own `PAGINATION_I18N`
 * already uses for copy that belongs to a single component.
 */
const DATE_ERROR_COPY: Record<UiLanguage, { reversed: string; tooLong: string }> = {
  uz_latn: {
    reversed: 'Tugash sanasi boshlanish sanasidan oldin boʻlishi mumkin emas.',
    tooLong: `Davr muddati ${MAX_PERIOD_DAYS} kundan (5 yildan) oshmasligi kerak.`,
  },
  uz_cyrl: {
    reversed: 'Тугаш санаси бошланиш санасидан олдин бўлиши мумкин эмас.',
    tooLong: `Давр муддати ${MAX_PERIOD_DAYS} кундан (5 йилдан) ошмаслиги керак.`,
  },
  ru: {
    reversed: 'Дата окончания не может быть раньше даты начала.',
    tooLong: `Срок периода не может превышать ${MAX_PERIOD_DAYS} дней (5 лет).`,
  },
  en: {
    reversed: 'End date cannot be earlier than the start date.',
    tooLong: `The period cannot exceed ${MAX_PERIOD_DAYS} days (5 years).`,
  },
  kaa: {
    reversed: 'Tamamlanıw sánesi baslanıw sánesinen aldın bolıwı múmkin emes.',
    tooLong: `Dáwir múddeti ${MAX_PERIOD_DAYS} kúnnen (5 jıldan) aspawı kerek.`,
  },
};

/** Same reasoning as `DATE_ERROR_COPY` — this confirmation belongs to the
 *  wizard alone, so it stays local rather than growing the shared maps. */
const LEAVE_CONFIRM_COPY: Record<UiLanguage, { title: string; body: string; stay: string; leave: string }> = {
  uz_latn: {
    title: 'Vizarddan chiqasizmi?',
    body: 'Qoralama saqlanadi — arizalar roʻyxatidan istalgan vaqtda davom ettirishingiz mumkin.',
    stay: 'Davom etish',
    leave: 'Chiqish',
  },
  uz_cyrl: {
    title: 'Визарддан чиқасизми?',
    body: 'Қоралама сақланади — аризалар рўйхатидан исталган вақтда давом эттиришингиз мумкин.',
    stay: 'Давом этиш',
    leave: 'Чиқиш',
  },
  ru: {
    title: 'Выйти из мастера?',
    body: 'Черновик сохранён — вы можете продолжить в любой момент из списка заявок.',
    stay: 'Продолжить',
    leave: 'Выйти',
  },
  en: {
    title: 'Leave the wizard?',
    body: 'Your draft is saved — you can resume it any time from the applications list.',
    stay: 'Continue',
    leave: 'Leave',
  },
  kaa: {
    title: 'Vizarddan shıgasız ba?',
    body: 'Qoralama saqlanadı — arizalar dizıminen qálegen waqıtta dawam ettire alasız.',
    stay: 'Dawam etiw',
    leave: 'Shıgıw',
  },
};

interface LivestockRow {
  key: string;
  livestockTypeId: string;
  headCount: string;
}

/**
 * B7 — the application wizard, the core of the system. Drives the real API
 * chain end to end: `POST /applications` (DRAFT) -> `PATCH` (contour, period,
 * activity, quantity) -> `POST .../documents` -> `POST .../precheck` ->
 * `POST .../submit`. Every field is PATCHed as soon as a step is confirmed
 * (ruling 7 — a draft is autosaved field by field), so leaving the wizard
 * after step 1 never loses work: `MyApplicationsPage` lists the DRAFT and
 * `MyApplicationCardPage` links back here with `?draft=<id>` to resume.
 */
export function ApplicationWizardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me, refreshMe } = useAuth();
  const errorText = useApiErrorText();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('draft');
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  // The furthest step ever reached, distinct from `step` (where the
  // applicant currently stands). T1's stepper contract: clicking a
  // COMPLETED step returns to it, and that must survive going back further
  // still — reaching step 4 then returning to step 2 must not re-lock
  // steps 3 and 4 (`Stepper`'s own `maxStepReached` prop docstring).
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(resumeId);
  const [onBehalf, setOnBehalf] = useState<'self' | 'legal'>('self');
  const [representationApplicantId, setRepresentationApplicantId] = useState('');
  const [activityTypeId, setActivityTypeId] = useState('');
  const [contour, setContour] = useState<PickedContour | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [items, setItems] = useState<LivestockRow[]>([]);
  const [benefitCategoryItemId, setBenefitCategoryItemId] = useState('');
  const [precheckResult, setPrecheckResult] = useState<PrecheckOut | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  // Ruling #113: the address requisite is gated at SUBMIT, not at
  // registration. It belongs to the applicant the filing is FOR — the
  // signed-in citizen when filing for themselves, the represented legal
  // entity when filing on its behalf — because requisite 11 of form
  // 1-ilova prints the holder's address, and the holder is whoever the
  // permit will name. Asking about `MeOut.applicant` in both cases would
  // leave a representative unable to file for an entity that has no
  // address: the backend refuses the submission and the wizard never asks.
  // An applicant that already has one is never asked again.
  const [address, setAddress] = useState('');
  const [addressTouched, setAddressTouched] = useState(false);
  // Saving the address is its OWN step, not a silent prelude to signing:
  // `checks.missing_for_pricing` counts a blank address as missing, so the
  // pre-check that runs on entering step 5 reports every norm check as
  // `skipped` and computes NO price at all. Signing straight through would
  // have the citizen put an ERI signature on a package whose cost they were
  // never shown. So the first press saves the address and re-runs the
  // pre-check, the price appears, and the second press signs.
  const [addressSaved, setAddressSaved] = useState(false);
  const filingApplicant =
    onBehalf === 'legal'
      ? (me?.representations.find((r) => r.applicant.id === representationApplicantId)?.applicant ??
        null)
      : (me?.applicant ?? null);
  const needsAddress = filingApplicant !== null && !filingApplicant.address;

  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const livestockTypesQuery = useQuery({ queryKey: ['livestock-types'], queryFn: listLivestockTypes });
  const benefitCategoriesQuery = useQuery({
    queryKey: ['classifier-items', 'benefit_categories'],
    queryFn: () => listClassifierItems('benefit_categories'),
  });
  const docTypesQuery = useQuery({ queryKey: ['classifier-items', 'doc_types'], queryFn: () => listClassifierItems('doc_types') });

  const cardQuery = useQuery({
    queryKey: ['wizard-card', applicationId],
    queryFn: () => getApplicationCard(applicationId!),
    enabled: !!applicationId,
  });

  // Resuming a draft (`?draft=<id>`): populate the form ONCE from the card
  // the server already holds. Set during RENDER, guarded by a ref, rather
  // than in a `useEffect` — the same idiom `I18nProvider` uses to reset
  // state when an identity changes, which avoids the extra effect-then-
  // setState render pass `react-hooks/set-state-in-effect` warns about.
  //
  // The ref's own initializer MUST read the same expression it is later
  // compared against (`cardQuery.data?.id` both times) — that is the one
  // shape `eslint-plugin-react-hooks`'s `refs` rule recognises as the
  // "track the previous identity, then sync" idiom (matching `I18nProvider`'s
  // `useRef(me?.user.id)`); a ref seeded with a plain `null`/boolean flag and
  // compared against a nested property trips the same rule as reading a ref
  // in render at all. Keying on the card's own id rather than a boolean is
  // also what keeps a later refetch (after a PATCH invalidates the query)
  // from ever clobbering what the applicant is now typing.
  const hydratedForId = useRef(cardQuery.data?.id);
  if (hydratedForId.current !== cardQuery.data?.id) {
    hydratedForId.current = cardQuery.data?.id;
    const card = cardQuery.data;
    if (card?.activity_type_id) setActivityTypeId(card.activity_type_id);
    if (card?.contour_id) setContour({ id: card.contour_id, number: card.contour_id, areaHa: card.requested_area_ha });
    if (card?.period_from) setPeriodFrom(card.period_from);
    if (card?.period_to) setPeriodTo(card.period_to);
    if (card?.quantity) setQuantity(card.quantity);
    if (card && card.items.length > 0) {
      setItems(card.items.map((i) => ({ key: i.id, livestockTypeId: i.livestock_type_id, headCount: String(i.head_count) })));
    }
    if (card?.benefit_category_item_id) setBenefitCategoryItemId(card.benefit_category_item_id);
  }

  const activityCode = activityTypesQuery.data?.find((a) => a.id === activityTypeId)?.code;
  const isGrazing = activityCode === GRAZING_CODE;
  const quantityUnit = activityTypesQuery.data?.find((a) => a.id === activityTypeId)?.quantity_unit;

  function invalidateCard() {
    if (applicationId) void queryClient.invalidateQueries({ queryKey: ['wizard-card', applicationId] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createApplicationDraft({
        on_behalf: onBehalf,
        applicant_id: onBehalf === 'legal' ? representationApplicantId : undefined,
      }),
  });
  const patchMutation = useMutation({
    mutationFn: (body: Parameters<typeof patchApplication>[1]) => patchApplication(applicationId!, body),
    onSuccess: invalidateCard,
  });
  const addDocMutation = useMutation({
    mutationFn: (body: Parameters<typeof addApplicationDocument>[1]) => addApplicationDocument(applicationId!, body),
    onSuccess: invalidateCard,
  });
  const removeDocMutation = useMutation({
    mutationFn: (documentId: string) => removeApplicationDocument(applicationId!, documentId),
    onSuccess: invalidateCard,
  });
  const precheckMutation = useMutation({
    mutationFn: () => precheckApplication(applicationId!),
    onSuccess: (data) => setPrecheckResult(data),
  });

  // Advances AND remembers the furthest point reached, so the stepper can
  // later tell "completed" (clickable) apart from "never visited yet"
  // (inert) regardless of where `step` itself currently sits.
  function goToStep(next: number) {
    setStep(next);
    setMaxStepReached((m) => Math.max(m, next));
  }

  // The stepper's own click handler: only a step already reached is a valid
  // destination — `Stepper` itself also gates this, so the check here is
  // belt-and-braces, not the only guard.
  function goToCompletedStep(stepId: number) {
    if (stepId <= maxStepReached) setStep(stepId);
  }

  async function ensureDraftAndPatchActivity(overrideActivityTypeId?: string) {
    let id = applicationId;
    if (!id) {
      const created = await createMutation.mutateAsync();
      id = created.id;
      setApplicationId(id);
    }
    await patchApplication(id, { activity_type_id: overrideActivityTypeId ?? activityTypeId });
    invalidateCard();
  }

  // T1's contract: choosing the activity type advances to step 2 BY
  // ITSELF — the footer's "Next" button stays in place (Oybek: not
  // removed, merely no longer the only way forward). `id` is passed
  // explicitly rather than read back from `activityTypeId` state: the
  // `setActivityTypeId` call just above it has not re-rendered yet when
  // `ensureDraftAndPatchActivity` runs, so the state would still read the
  // PREVIOUS selection.
  async function selectActivityType(id: string) {
    setSubmitError(null);
    setActivityTypeId(id);
    await ensureDraftAndPatchActivity(id);
    goToStep(2);
  }

  async function goNext() {
    setSubmitError(null);
    if (step === 1) {
      // Reachable mainly when the applicant returns to step 1 through the
      // stepper (activity already chosen) and presses "Next" again without
      // reselecting — `selectActivityType` above is what normally leaves
      // step 1 now.
      await ensureDraftAndPatchActivity();
      goToStep(2);
      return;
    }
    if (step === 2 && contour) {
      await patchMutation.mutateAsync({ contour_id: contour.id, period_from: periodFrom, period_to: periodTo });
      goToStep(3);
      return;
    }
    if (step === 3) {
      const body: Parameters<typeof patchApplication>[1] = {};
      if (isGrazing) {
        body.items = items
          .filter((i) => i.livestockTypeId && i.headCount)
          .map((i): ApplicationItemIn => ({ livestock_type_id: i.livestockTypeId, head_count: Number(i.headCount) }));
      } else {
        body.quantity = quantity;
      }
      body.benefit_category_item_id = benefitCategoryItemId || null;
      await patchMutation.mutateAsync(body);
      goToStep(4);
      return;
    }
    if (step === 4) {
      goToStep(5);
      setPrecheckResult(null);
      await precheckMutation.mutateAsync();
      return;
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  const calculationRequest: CalculationIn | null = useMemo(() => {
    if (!activityTypeId || !contour || !periodFrom || !periodTo) return null;
    if (isGrazing) {
      const validItems = items.filter((i) => i.livestockTypeId && i.headCount);
      if (validItems.length === 0) return null;
      return {
        contour_id: contour.id,
        activity_type_id: activityTypeId,
        period_from: periodFrom,
        period_to: periodTo,
        items: validItems.map((i) => ({
          livestock_code: livestockTypesQuery.data?.find((l) => l.id === i.livestockTypeId)?.code ?? '',
          count: Number(i.headCount),
        })),
        benefit_code: undefined,
      };
    }
    if (!quantity) return null;
    return {
      contour_id: contour.id,
      activity_type_id: activityTypeId,
      period_from: periodFrom,
      period_to: periodTo,
      quantity,
      items: [],
      benefit_code: undefined,
    };
  }, [activityTypeId, contour, periodFrom, periodTo, isGrazing, items, quantity, livestockTypesQuery.data]);

  async function handleSignAndSubmit() {
    if (!applicationId) return;
    setSubmitError(null);
    setSigning(true);
    try {
      const applicant = me?.applicant;
      if (!applicant?.pinfl) {
        setSubmitError(t('wizard.step5.noPinfl'));
        return;
      }
      if (filingApplicant && !filingApplicant.address && !addressSaved) {
        if (!address.trim()) {
          setAddressTouched(true);
          return;
        }
        // Save before signing: requisite 11 of form 1-ilova is printed from
        // `applicants.address`, so the applicant the permit will name must
        // carry it before the package is fetched and signed. The signature
        // itself stays the citizen's own (`applicant.pinfl` above) — a legal
        // entity has a STIR, not a PINFL, and never signs for itself.
        // `refreshMe` adopts the result — this route hands back an
        // `ApplicantOut`, not a whole `MeOut`
        // (`AuthContextValue.refreshMe`'s own docstring).
        await saveApplicantAddress(filingApplicant.id, address.trim());
        setAddressSaved(true);
        await refreshMe();
        // The pre-check ran without an address and therefore without a price.
        // Re-run it now that the application is complete, and stop here — the
        // citizen sees the amount before the next press signs for it.
        setPrecheckResult(null);
        await precheckMutation.mutateAsync();
        return;
      }
      const packageBytes = await getApplicationPackage(applicationId);
      // Fix wave, finding 2: real mode DETACHED, over the exact bytes
      // `GET .../package` just served — `POST .../submit` verifies through
      // `signatures.service.sign()` -> `verify_detached` against them
      // (`applications/router.py::get_application_package`'s own docstring:
      // "the client signs exactly these"). No PINFL to type in beyond the
      // identity check above; the certificate the citizen picks in E-IMZO
      // carries it.
      const pkcs7 = isEimzoMock()
        ? await buildMockSignature({ documentBytes: packageBytes, pinfl: applicant.pinfl, fullName: applicant.name })
        : await signDocument(new Uint8Array(packageBytes));
      await submitApplication(applicationId, pkcs7);
      // The one navigation the leave-guard below must let through without
      // asking — it fires right after a successful submit, when there is
      // nothing left to lose. A ref, not state: `navigate()` runs in the
      // same tick, before a `setState` would have re-rendered the guard.
      skipLeaveGuardRef.current = true;
      navigate(`/my/applications/${applicationId}`);
    } catch (err) {
      setSubmitError(
        err instanceof EimzoError || isProviderUnreachable(err)
          ? t(eimzoErrorMessageKey(err))
          : errorText(err, 'Kutilmagan xatolik yuz berdi.'),
      );
    } finally {
      setSigning(false);
    }
  }

  const hasBlockingCheck = precheckResult?.checks.some((c) => c.result === 'fail') ?? false;

  // T1's contract, item 1: named IN THE FIELD before the request ever
  // leaves the browser — mirrors `norms/checks.py::_validate_period`
  // exactly (`period_to < period_from`, then the `MAX_PERIOD_DAYS` span),
  // so a pair this rejects is a pair the backend would also reject with
  // `ERR-VAL-001`.
  const periodError = useMemo(() => {
    if (!periodFrom || !periodTo) return null;
    const copy = DATE_ERROR_COPY[lang];
    if (periodTo < periodFrom) return copy.reversed;
    if (isoDaySpan(periodFrom, periodTo) > MAX_PERIOD_DAYS) return copy.tooLong;
    return null;
  }, [periodFrom, periodTo, lang]);

  // Each input constrains the other via native `min`/`max`, so most invalid
  // pairs are impossible to pick in the first place rather than merely
  // flagged after the fact.
  const periodFromMin = periodTo ? addIsoDays(periodTo, -MAX_PERIOD_DAYS) : undefined;
  const periodFromMax = periodTo || undefined;
  const periodToMin = periodFrom || undefined;
  const periodToMax = periodFrom ? addIsoDays(periodFrom, MAX_PERIOD_DAYS) : undefined;

  // T1's contract, item 3: leaving mid-draft asks first. The draft is
  // already autosaved field by field (this file's own docstring above), so
  // this is never "discard your work" — only "you'll need to come back for
  // it". `applicationId` is the signal: step 1 sets it the moment a draft
  // exists (`ensureDraftAndPatchActivity`/`selectActivityType`) and it is
  // never cleared again in this component, so it tracks "is there
  // something on the server to resume" for the page's whole lifetime.
  const hasUnsavedDraft = applicationId !== null;
  const skipLeaveGuardRef = useRef(false);

  const shouldBlockLeaving = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      !skipLeaveGuardRef.current && hasUnsavedDraft && currentLocation.pathname !== nextLocation.pathname,
    [hasUnsavedDraft],
  );
  // Covers BOTH the in-app "back to list" navigation and the browser's back
  // button: a data router's `useBlocker` intercepts every in-SPA
  // navigation attempt alike, `historyAction` included, so one guard is
  // enough for both triggers T1's contract names separately.
  const blocker = useBlocker(shouldBlockLeaving);
  const leaveCopy = LEAVE_CONFIRM_COPY[lang];

  // `useBlocker` explicitly does not cover a hard reload or tab close
  // (react-router's own docs) — that is what this effect is for.
  useEffect(() => {
    if (!hasUnsavedDraft) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (skipLeaveGuardRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedDraft]);

  const wizardSteps = [
    { id: 1, title: t('wizard.step1.title'), description: t('wizard.step1.desc') },
    { id: 2, title: t('wizard.step2.title'), description: t('wizard.step2.desc') },
    { id: 3, title: t('wizard.step3.title'), description: t('wizard.step3.desc') },
    { id: 4, title: t('wizard.step4.title'), description: t('wizard.step4.desc') },
    { id: 5, title: t('wizard.step5.title'), description: t('wizard.step5.desc') },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4E7EA] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">{t('wizard.title')}</h1>
          <p className="text-xs text-[#5A646D] mt-1">{t('wizard.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/my/applications')}
          className="cursor-pointer font-bold"
        >
          {t('wizard.backToList')}
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <Stepper steps={wizardSteps} currentStep={step} maxStepReached={maxStepReached} onStepClick={goToCompletedStep} />
      </div>

      {/* Step 1 — activity type */}
      {step === 1 && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step1.heading')}</h2>
          {me && me.representations.length > 0 && (
            <FormField label={t('wizard.step1.onBehalfLabel')}>
              <Select
                value={onBehalf === 'legal' ? representationApplicantId : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    setOnBehalf('self');
                    setRepresentationApplicantId('');
                  } else {
                    setOnBehalf('legal');
                    setRepresentationApplicantId(e.target.value);
                  }
                }}
                options={[
                  { value: '', label: t('wizard.step1.onBehalfSelf') },
                  ...me.representations.map((r) => ({ value: r.applicant.id, label: r.applicant.name })),
                ]}
              />
            </FormField>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activityTypesQuery.data ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => void selectActivityType(a.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  activityTypeId === a.id
                    ? 'border-[#2E7D4F] bg-[#F0F7F1] ring-2 ring-[#2E7D4F]/30'
                    : 'border-[#E4E7EA] hover:border-[#2E7D4F]'
                }`}
              >
                <span className="font-bold text-sm text-[#1A1F24] block">{pickName(a.name, lang)}</span>
                <span className="text-[11px] text-[#5A646D]">{t('wizard.step1.unit')} {formatUnit(a.quantity_unit, t, lang)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — plot + period */}
      {step === 2 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step2.heading')}</h2>
            <ContourPicker value={contour} onChange={setContour} />
            {contour && (
              <Alert variant="success">
                {t('wizard.step2.selectedContour')} <strong className="font-mono">{contour.number}</strong> ({contour.areaHa ?? '—'} {formatUnit('ha', t, lang)})
              </Alert>
            )}
          </div>
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('wizard.step2.periodFrom')} required htmlFor="period-from">
              <Input
                id="period-from"
                type="date"
                value={periodFrom}
                min={periodFromMin}
                max={periodFromMax}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </FormField>
            <FormField
              label={t('wizard.step2.periodTo')}
              required
              htmlFor="period-to"
              error={periodError ?? undefined}
            >
              <Input
                id="period-to"
                type="date"
                value={periodTo}
                min={periodToMin}
                max={periodToMax}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </FormField>
          </div>
        </section>
      )}

      {/* Step 3 — parameters + live price */}
      {step === 3 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step3.heading')}</h2>
            {isGrazing ? (
              <div className="space-y-3">
                {items.map((row, idx) => (
                  <div key={row.key} className="flex items-end gap-3">
                    <FormField label={t('wizard.step3.livestockType')} className="flex-1">
                      <Select
                        value={row.livestockTypeId}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...row, livestockTypeId: e.target.value };
                          setItems(next);
                        }}
                        options={[
                          { value: '', label: t('wizard.step3.selectPrompt') },
                          ...(livestockTypesQuery.data ?? []).map((l) => ({ value: l.id, label: pickName(l.name, lang) })),
                        ]}
                      />
                    </FormField>
                    <FormField label={t('wizard.step3.headCount')} className="w-32">
                      <Input
                        type="number"
                        min={1}
                        value={row.headCount}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...row, headCount: e.target.value };
                          setItems(next);
                        }}
                      />
                    </FormField>
                    <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="cursor-pointer">
                      <Trash2 className="w-4 h-4 text-[#B91C1C]" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setItems([...items, { key: crypto.randomUUID(), livestockTypeId: '', headCount: '' }])}
                  className="cursor-pointer"
                >
                  {t('wizard.step3.addLivestock')}
                </Button>
              </div>
            ) : (
              <FormField label={quantityUnit ? `${t('wizard.step3.quantity')} (${formatUnit(quantityUnit, t, lang)})` : t('wizard.step3.quantity')} required htmlFor="quantity">
                <Input id="quantity" type="number" min={0} step="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </FormField>
            )}

            {benefitCategoriesQuery.data && benefitCategoriesQuery.data.length > 0 && (
              <FormField label={t('wizard.step3.benefitCategory')} htmlFor="benefit">
                <Select
                  id="benefit"
                  value={benefitCategoryItemId}
                  onChange={(e) => setBenefitCategoryItemId(e.target.value)}
                  options={[
                    { value: '', label: t('wizard.step3.noBenefit') },
                    ...benefitCategoriesQuery.data.map((b) => ({ value: b.id, label: pickName(b.name, lang) })),
                  ]}
                />
              </FormField>
            )}
          </div>

          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#0369A1] uppercase tracking-wider">{t('wizard.step3.estimatedPrice')}</h3>
            <PricePreviewPanel request={calculationRequest} />
          </div>
        </section>
      )}

      {/* Step 4 — documents */}
      {step === 4 && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step4.heading')}</h2>
          <DocumentsStep
            docTypes={docTypesQuery.data ?? []}
            documents={cardQuery.data?.documents ?? []}
            onUpload={async (file, docTypeItemId) => {
              const uploaded = await uploadFile(file);
              await addDocMutation.mutateAsync({ doc_type_item_id: docTypeItemId, file_id: uploaded.id });
            }}
            onRemove={(documentId) => removeDocMutation.mutate(documentId)}
          />
        </section>
      )}

      {/* Step 5 — precheck + sign + submit */}
      {step === 5 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step5.heading')}</h2>
            {precheckMutation.isPending && (
              <p className="text-xs text-[#5A646D] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.step5.checking')}
              </p>
            )}
            {precheckMutation.isError && (
              <Alert variant="danger">
                {errorText(precheckMutation.error, t('wizard.step5.checkError'))}
              </Alert>
            )}
            {precheckResult && (
              <>
                <ChecksList checks={fromApplicationChecks(precheckResult.checks)} />
                {precheckResult.calculation ? (
                  <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 font-mono text-lg font-bold text-[#123522]">
                    {formatMoney(precheckResult.calculation.amount)} {t('wizard.step3.currency')}
                  </div>
                ) : (
                  <Alert variant="warning">{t('wizard.step5.incompleteWarning')}</Alert>
                )}
                {hasBlockingCheck && (
                  <Alert variant="danger" title={t('wizard.step5.cannotSubmitTitle')}>
                    {t('wizard.step5.cannotSubmitDesc')}
                  </Alert>
                )}
              </>
            )}
          </div>

          {needsAddress && (
            <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
              <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step5.addressTitle')}</h2>
              <p className="text-xs text-[#5A646D]">
                {t('wizard.step5.addressDesc')}
              </p>
              <FormField
                label={t('wizard.step5.addressLabel')}
                required
                htmlFor="applicant-address"
                error={addressTouched && !address.trim() ? t('wizard.step5.addressRequired') : undefined}
              >
                <Input
                  id="applicant-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => setAddressTouched(true)}
                />
              </FormField>
            </div>
          )}

          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step5.eriTitle')}</h2>
            <p className="text-xs text-[#5A646D]">
              {t('wizard.step5.eriDesc')}
            </p>
            {submitError && (
              <Alert variant="danger" title={t('wizard.step5.notSubmittedTitle')}>
                {submitError}
              </Alert>
            )}
            <Button
              variant="primary"
              size="lg"
              leftIcon={<ShieldCheck className="w-5 h-5" />}
              isLoading={signing}
              disabled={
                hasBlockingCheck ||
                !precheckResult ||
                (needsAddress && !addressSaved && !address.trim())
              }
              onClick={handleSignAndSubmit}
              className="cursor-pointer font-bold"
            >
              {needsAddress && !addressSaved
                ? t('wizard.step5.saveAddressAndCalc')
                : t('wizard.step5.signAndSubmit')}
            </Button>
          </div>
        </section>
      )}

      {/* Footer navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E4E7EA] p-4 shadow-lg z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />} disabled={step <= 1} onClick={goBack} className="cursor-pointer font-bold">
            {t('wizard.nav.back')}
          </Button>
          {step < 5 && (
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              isLoading={createMutation.isPending || patchMutation.isPending}
              disabled={
                (step === 1 && !activityTypeId) ||
                (step === 2 && (!contour || !periodFrom || !periodTo || !!periodError)) ||
                (step === 3 && !isGrazing && !quantity) ||
                (step === 3 && isGrazing && items.filter((i) => i.livestockTypeId && i.headCount).length === 0)
              }
              onClick={goNext}
              className="cursor-pointer font-bold"
            >
              {t('wizard.nav.next')}
            </Button>
          )}
        </div>
      </div>

      {/* T1's contract, item 3: leaving mid-draft asks first — the browser
          back button and any in-app navigation away from the wizard both
          go through the same `useBlocker` above. */}
      {blocker.state === 'blocked' && (
        <Modal
          isOpen
          onClose={() => blocker.reset()}
          title={leaveCopy.title}
          footer={
            <>
              <Button variant="outline" onClick={() => blocker.reset()} className="cursor-pointer font-bold">
                {leaveCopy.stay}
              </Button>
              <Button variant="danger" onClick={() => blocker.proceed()} className="cursor-pointer font-bold">
                {leaveCopy.leave}
              </Button>
            </>
          }
        >
          <p>{leaveCopy.body}</p>
        </Modal>
      )}
    </div>
  );
}

function DocumentsStep({
  docTypes,
  documents,
  onUpload,
  onRemove,
}: {
  docTypes: { id: string; name: Record<string, unknown> }[];
  documents: { id: string; doc_type_item_id: string; file_id: string }[];
  onUpload: (file: File, docTypeItemId: string) => Promise<void>;
  onRemove: (documentId: string) => void;
}) {
  const t = useT();
  const { lang } = useLanguage();
  const [docTypeItemId, setDocTypeItemId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!docTypeItemId) {
      setError(t('wizard.step4.selectDocTypeFirst'));
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUpload(file, docTypeItemId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('wizard.step4.uploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (docTypes.length === 0) {
    return <Alert variant="warning">{t('wizard.step4.notConfigured')}</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label={t('wizard.step4.docType')} className="flex-1 min-w-[220px]">
          <Select
            value={docTypeItemId}
            onChange={(e) => setDocTypeItemId(e.target.value)}
            options={[{ value: '', label: t('wizard.step4.selectDocType') }, ...docTypes.map((d) => ({ value: d.id, label: pickName(d.name, lang) }))]}
          />
        </FormField>
        <Button
          variant="outline"
          leftIcon={<Upload className="w-4 h-4" />}
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer font-bold"
        >
          {t('wizard.step4.chooseFile')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between p-3 border border-[#E4E7EA] rounded-xl text-xs">
              <span className="font-semibold">{pickName(docTypes.find((d) => d.id === doc.doc_type_item_id)?.name, lang) || t('wizard.step4.defaultDocName')}</span>
              <button onClick={() => onRemove(doc.id)} className="text-[#B91C1C] font-bold hover:underline cursor-pointer">
                {t('wizard.step4.deleteDoc')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
