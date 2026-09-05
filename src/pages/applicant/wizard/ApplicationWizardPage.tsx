import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Loader2, Plus, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select } from '../../../components/ui/FormControls';
import { Alert } from '../../../components/ui/Feedback';
import { Stepper } from '../../../components/ui/Navigation';
import { ApiError } from '../../../api/errors';
import { useAuth } from '../../../auth/useAuth';
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
import { formatMoney, pickName } from '../format';
import { fromApplicationChecks } from '../checkTypeLabels';
import { ChecksList } from './ChecksList';
import { ContourPicker, type PickedContour } from './ContourPicker';
import { PricePreviewPanel } from './PricePreviewPanel';
import { buildMockSignature } from '../../../lib/eimzoMock';

const GRAZING_CODE = 'grazing';

const WIZARD_STEPS = [
  { id: 1, title: 'Faoliyat turi', description: 'Foydalanish turi' },
  { id: 2, title: 'Uchastka', description: 'Kontur va davr' },
  { id: 3, title: 'Parametrlar', description: 'Miqdor va narx' },
  { id: 4, title: 'Hujjatlar', description: 'Ilova fayllar' },
  { id: 5, title: 'Yuborish', description: 'Tekshiruv va ERI' },
];

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
  const { me } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get('draft');
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
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

  async function ensureDraftAndPatchActivity() {
    let id = applicationId;
    if (!id) {
      const created = await createMutation.mutateAsync();
      id = created.id;
      setApplicationId(id);
    }
    await patchApplication(id, { activity_type_id: activityTypeId });
    invalidateCard();
  }

  async function goNext() {
    setSubmitError(null);
    if (step === 1) {
      await ensureDraftAndPatchActivity();
      setStep(2);
      return;
    }
    if (step === 2 && contour) {
      await patchMutation.mutateAsync({ contour_id: contour.id, period_from: periodFrom, period_to: periodTo });
      setStep(3);
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
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
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
      const pinfl = me?.applicant?.pinfl;
      if (!pinfl) {
        setSubmitError("ERI bilan imzolash uchun shaxsingizni tasdiqlovchi PINFL topilmadi. Profilni tekshiring.");
        return;
      }
      const packageBytes = await getApplicationPackage(applicationId);
      const pkcs7 = await buildMockSignature({ documentBytes: packageBytes, pinfl });
      await submitApplication(applicationId, pkcs7);
      navigate(`/my/applications/${applicationId}`);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? `${err.code}: ${err.message}` : 'Kutilmagan xatolik yuz berdi.');
    } finally {
      setSigning(false);
    }
  }

  const hasBlockingCheck = precheckResult?.checks.some((c) => c.result === 'fail') ?? false;

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans pb-24">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4E7EA] pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1F24] tracking-tight">Yangi ariza topshirish</h1>
          <p className="text-xs text-[#5A646D] mt-1">Bosqichlarni ketma-ket toʻldiring — qoralama har bosqichda saqlanadi</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/my/applications')}
          className="cursor-pointer font-bold"
        >
          Roʻyxatga qaytish
        </Button>
      </div>

      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 shadow-xs">
        <Stepper steps={WIZARD_STEPS.map((s) => ({ id: s.id, title: s.title, description: s.description }))} currentStep={step} />
      </div>

      {/* Step 1 — activity type */}
      {step === 1 && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">1. Faoliyat turini tanlang</h2>
          {me && me.representations.length > 0 && (
            <FormField label="Kim nomidan topshirilmoqda">
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
                  { value: '', label: "Oʻzim uchun (jismoniy shaxs)" },
                  ...me.representations.map((r) => ({ value: r.applicant.id, label: r.applicant.name })),
                ]}
              />
            </FormField>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(activityTypesQuery.data ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => setActivityTypeId(a.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  activityTypeId === a.id
                    ? 'border-[#2E7D4F] bg-[#F0F7F1] ring-2 ring-[#2E7D4F]/30'
                    : 'border-[#E4E7EA] hover:border-[#2E7D4F]'
                }`}
              >
                <span className="font-bold text-sm text-[#1A1F24] block">{pickName(a.name)}</span>
                <span className="text-[11px] text-[#5A646D]">Birlik: {a.quantity_unit}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Step 2 — plot + period */}
      {step === 2 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">2. Uchastkani tanlang</h2>
            <ContourPicker value={contour} onChange={setContour} />
            {contour && (
              <Alert variant="success">
                Tanlangan kontur: <strong className="font-mono">{contour.number}</strong> ({contour.areaHa ?? '—'} ga)
              </Alert>
            )}
          </div>
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Boshlanish sanasi" required htmlFor="period-from">
              <Input id="period-from" type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
            </FormField>
            <FormField label="Tugash sanasi" required htmlFor="period-to">
              <Input id="period-to" type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </FormField>
          </div>
        </section>
      )}

      {/* Step 3 — parameters + live price */}
      {step === 3 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">3. Parametrlar</h2>
            {isGrazing ? (
              <div className="space-y-3">
                {items.map((row, idx) => (
                  <div key={row.key} className="flex items-end gap-3">
                    <FormField label="Chorva turi" className="flex-1">
                      <Select
                        value={row.livestockTypeId}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = { ...row, livestockTypeId: e.target.value };
                          setItems(next);
                        }}
                        options={[
                          { value: '', label: 'Tanlang...' },
                          ...(livestockTypesQuery.data ?? []).map((l) => ({ value: l.id, label: pickName(l.name) })),
                        ]}
                      />
                    </FormField>
                    <FormField label="Bosh soni" className="w-32">
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
                  Chorva turini qoʻshish
                </Button>
              </div>
            ) : (
              <FormField label={`Miqdor (${quantityUnit ?? ''})`} required htmlFor="quantity">
                <Input id="quantity" type="number" min={0} step="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </FormField>
            )}

            {benefitCategoriesQuery.data && benefitCategoriesQuery.data.length > 0 && (
              <FormField label="Imtiyoz toifasi (agar mavjud boʻlsa)" htmlFor="benefit">
                <Select
                  id="benefit"
                  value={benefitCategoryItemId}
                  onChange={(e) => setBenefitCategoryItemId(e.target.value)}
                  options={[
                    { value: '', label: 'Imtiyozsiz' },
                    ...benefitCategoriesQuery.data.map((b) => ({ value: b.id, label: pickName(b.name) })),
                  ]}
                />
              </FormField>
            )}
          </div>

          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#0369A1] uppercase tracking-wider">Taxminiy narx</h3>
            <PricePreviewPanel request={calculationRequest} />
          </div>
        </section>
      )}

      {/* Step 4 — documents */}
      {step === 4 && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">4. Hujjatlarni biriktiring</h2>
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
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">5. Yakuniy tekshiruv</h2>
            {precheckMutation.isPending && (
              <p className="text-xs text-[#5A646D] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Tekshirilmoqda...
              </p>
            )}
            {precheckMutation.isError && (
              <Alert variant="danger">
                {precheckMutation.error instanceof ApiError
                  ? `${precheckMutation.error.code}: ${precheckMutation.error.message}`
                  : 'Tekshiruvda xatolik yuz berdi.'}
              </Alert>
            )}
            {precheckResult && (
              <>
                <ChecksList checks={fromApplicationChecks(precheckResult.checks)} />
                {precheckResult.calculation ? (
                  <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 font-mono text-lg font-bold text-[#123522]">
                    {formatMoney(precheckResult.calculation.amount)} soʻm
                  </div>
                ) : (
                  <Alert variant="warning">Ariza hali toʻliq emas — narx hisoblanmadi.</Alert>
                )}
                {hasBlockingCheck && (
                  <Alert variant="danger" title="Yuborib boʻlmaydi">
                    Bloklovchi tekshiruv aniqlandi. Avvalgi bosqichlarga qaytib maʼlumotlarni tuzating.
                  </Alert>
                )}
              </>
            )}
          </div>

          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">ERI bilan imzolash va yuborish</h2>
            <p className="text-xs text-[#5A646D]">
              Arizani yuborish uchun elektron raqamli imzo (ERI) bilan tasdiqlashingiz kerak. Ushbu muhitda ERI mock
              (demo) rejimida ishlaydi.
            </p>
            {submitError && (
              <Alert variant="danger" title="Yuborilmadi">
                {submitError}
              </Alert>
            )}
            <Button
              variant="primary"
              size="lg"
              leftIcon={<ShieldCheck className="w-5 h-5" />}
              isLoading={signing}
              disabled={hasBlockingCheck || !precheckResult}
              onClick={handleSignAndSubmit}
              className="cursor-pointer font-bold"
            >
              ERI bilan imzolash va yuborish
            </Button>
          </div>
        </section>
      )}

      {/* Footer navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E4E7EA] p-4 shadow-lg z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />} disabled={step <= 1} onClick={goBack} className="cursor-pointer font-bold">
            Orqaga
          </Button>
          {step < 5 && (
            <Button
              variant="primary"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              isLoading={createMutation.isPending || patchMutation.isPending}
              disabled={
                (step === 1 && !activityTypeId) ||
                (step === 2 && (!contour || !periodFrom || !periodTo)) ||
                (step === 3 && !isGrazing && !quantity) ||
                (step === 3 && isGrazing && items.filter((i) => i.livestockTypeId && i.headCount).length === 0)
              }
              onClick={goNext}
              className="cursor-pointer font-bold"
            >
              Keyingisi
            </Button>
          )}
        </div>
      </div>
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
  const [docTypeItemId, setDocTypeItemId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!docTypeItemId) {
      setError('Avval hujjat turini tanlang.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUpload(file, docTypeItemId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Hujjatni yuklashda xatolik yuz berdi.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (docTypes.length === 0) {
    return <Alert variant="warning">Hujjat turlari hali sozlanmagan — hozircha fayl biriktirish mumkin emas.</Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Hujjat turi" className="flex-1 min-w-[220px]">
          <Select
            value={docTypeItemId}
            onChange={(e) => setDocTypeItemId(e.target.value)}
            options={[{ value: '', label: 'Tanlang...' }, ...docTypes.map((d) => ({ value: d.id, label: pickName(d.name) }))]}
          />
        </FormField>
        <Button
          variant="outline"
          leftIcon={<Upload className="w-4 h-4" />}
          isLoading={uploading}
          onClick={() => inputRef.current?.click()}
          className="cursor-pointer font-bold"
        >
          Fayl tanlash
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
              <span className="font-semibold">{pickName(docTypes.find((d) => d.id === doc.doc_type_item_id)?.name) || 'Hujjat'}</span>
              <button onClick={() => onRemove(doc.id)} className="text-[#B91C1C] font-bold hover:underline cursor-pointer">
                Oʻchirish
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
