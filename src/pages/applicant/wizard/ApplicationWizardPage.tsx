import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useBlocker, useNavigate, type BlockerFunction } from 'react-router';
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
  fileApplication,
  getSiteSettings,
  listActivityTypes,
  listClassifierItems,
  listLivestockTypes,
  packageFiling,
  precheckFiling,
  uploadFile,
  type ApplicationFilingIn,
  type ApplicationItemIn,
  type CalculationIn,
  type PrecheckOut,
} from '../api';
import { formatMoney, formatUnit, pickName } from '../format';
import { fromPrecheckChecks } from '../checkTypeLabels';
import { CalculationBreakdown } from '../components/CalculationBreakdown';
import { ChecksList } from './ChecksList';
import { ContourPicker, type PickedContour } from './ContourPicker';
import { PricePreviewPanel } from './PricePreviewPanel';
import { OccupancyCalendar } from './OccupancyCalendar';
import { isIsoDateInWindows, type SeasonWindow } from './seasonCalendar';
import {
  buildMockSignature,
  EimzoError,
  eimzoErrorMessageKey,
  isEimzoCancelled,
  isEimzoMock,
  isProviderUnreachable,
  signDocument,
} from '../../../lib/eimzo';

const GRAZING_CODE = 'grazing';
// Decision #215 R6: the two activities whose blanks carry lines of their
// own — asked on step 3 for that activity alone, required before it lets go.
const DEADWOOD_CODE = 'deadwood';
const RECREATION_CODE = 'recreation';
type DeadwoodProduct = NonNullable<ApplicationFilingIn['deadwood_product']>;
type RecreationPurpose = NonNullable<ApplicationFilingIn['recreation_purpose']>;
const DEADWOOD_PRODUCTS: readonly DeadwoodProduct[] = ['firewood', 'branches', 'both'];
const RECREATION_PURPOSES: readonly RecreationPurpose[] = ['cultural_educational', 'upbringing', 'health', 'recreational', 'aesthetic'];

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
 *  wizard alone, so it stays local rather than growing the shared maps.
 *
 *  Plan 12, R10: the wizard writes nothing to the server before «Yuborish»,
 *  so leaving mid-way genuinely loses everything entered — the old copy
 *  («qoralama saqlanadi») promised a draft that no longer exists. */
const LEAVE_CONFIRM_COPY: Record<UiLanguage, { title: string; body: string; stay: string; leave: string }> = {
  uz_latn: {
    title: 'Ariza yuborilmadi',
    body: 'Ariza saqlanmaydi — kiritilgan maʼlumotlar yoʻqoladi. Chiqishni xohlaysizmi?',
    stay: 'Davom etish',
    leave: 'Chiqish',
  },
  uz_cyrl: {
    title: 'Ариза юборилмади',
    body: 'Ариза сақланмайди — киритилган маълумотлар йўқолади. Чиқишни хоҳлайсизми?',
    stay: 'Давом этиш',
    leave: 'Чиқиш',
  },
  ru: {
    title: 'Заявка не отправлена',
    body: 'Заявка не сохранится — всё введённое пропадёт. Выйти?',
    stay: 'Продолжить',
    leave: 'Выйти',
  },
  en: {
    title: 'Application not submitted',
    body: 'The application is not saved — everything you entered will be lost. Leave anyway?',
    stay: 'Continue',
    leave: 'Leave',
  },
  kaa: {
    title: 'Ariza jiberilmedi',
    body: 'Ariza saqlanbaydı — kiritilgen maǵlıwmatlar joǵaladı. Shıǵıwdı qáleysiz be?',
    stay: 'Dawam etiw',
    leave: 'Shıǵıw',
  },
};

interface LivestockRow {
  key: string;
  livestockTypeId: string;
  headCount: string;
}

// Mirrors the backend's `MAX_HEAD_COUNT` (`norms/schemas.py`, moved there by
// stage 17 R4) — a livestock row's head count is refused above this, so the
// wizard holds the input to the same bound rather than letting the applicant
// type past it and learn about it from a 422.
export const LIVESTOCK_HEAD_COUNT_MAX = 1_000_000;
// Mirrors the backend's quantity `Decimal` column: 12 digits, 4 decimal
// places (`10**(12-4) - 10**-4`, stage 17 R7) — the single quantity field a
// non-livestock activity fills on step 3.
export const QUANTITY_MAX = 99_999_999.9999;
// Mirrors `ApplicantAddressIn.address` (stage 17 C1) — a bound of its own,
// not one of the shared `CodeStr`/`NameStr`/`TextStr` types — the address
// this step collects when the applicant's own profile has none yet.
export const APPLICANT_ADDRESS_MAX_LENGTH = 500;
// Mirrors the backend's `MAX_LIVESTOCK_ITEMS` (`norms/schemas.py`, stage 17
// R3) — the add-row button additionally stops here even if more livestock
// types than this exist (ten are seeded today).
export const LIVESTOCK_ITEMS_MAX = 20;

/**
 * Fix round 1 (stage 17 QA-01 review, Important — this was the QA trigger):
 * `max={LIVESTOCK_HEAD_COUNT_MAX}` on the input does nothing without a
 * `<form>`, and a row with a species but no head count (or the reverse) used
 * to be silently dropped by `buildFiling`/`calculationRequest` rather than
 * named. A fully empty row (freshly added, neither field touched) is not an
 * error — it simply does not count as complete yet; `null` from both means
 * "nothing to say about this row".
 */
function livestockRowIssue(
  row: LivestockRow,
  t: (key: string) => string,
): { typeError: string | null; countError: string | null } {
  const hasType = row.livestockTypeId !== '';
  const hasCount = row.headCount !== '';
  if (!hasType && !hasCount) return { typeError: null, countError: null };
  if (!hasType) return { typeError: t('wizard.step3.typeRequired'), countError: null };
  if (!hasCount) return { typeError: null, countError: t('wizard.step3.headCountRequired') };
  const n = Number(row.headCount);
  const valid = Number.isInteger(n) && n >= 1 && n <= LIVESTOCK_HEAD_COUNT_MAX;
  return { typeError: null, countError: valid ? null : t('wizard.step3.headCountInvalid') };
}

/** Same QA trigger, the non-livestock side: `max={QUANTITY_MAX}` on the
 *  input does nothing without a `<form>` either, so a value outside
 *  0..`QUANTITY_MAX` or with more than 4 decimal places must be named IN THE
 *  FIELD, not learned from a 422 after Next. */
function quantityIssue(quantity: string, t: (key: string) => string): string | null {
  if (!quantity) return null;
  const n = Number(quantity);
  if (!Number.isFinite(n) || n < 0 || n > QUANTITY_MAX) return t('wizard.step3.quantityInvalid');
  const decimals = quantity.split('.')[1];
  if (decimals && decimals.length > 4) return t('wizard.step3.quantityInvalid');
  return null;
}

/**
 * One not-yet-uploaded row of step 4. `typeValue` is a `doc_types` item id,
 * or `''` while nothing is chosen. A row LEAVES this list the moment its
 * file lands on the server (the card's `documents` list is what shows it
 * from then on), and a benefit option chosen in its select turns it into
 * the benefit row instead (`benefitCategoryItemId`), so a pending row is
 * never a benefit.
 */
interface PendingDocRow {
  key: string;
  typeValue: string;
}

// The `<option value>` a benefit category takes in step 4's shared
// "document type" select, so one `<select>` can carry both `doc_types` items
// and `benefit_categories` items without their uuids ever colliding.
const BENEFIT_OPTION_PREFIX = 'benefit:';

/** `norms._check_benefit_claim`'s refusal of a category the chosen activity's
 *  tariffs do not carry (ruling #181's activity scoping). Step 4 no longer
 *  offers such a category, so this is the safety net for what the list could
 *  not know — a category re-scoped after it was loaded — named as what it is
 *  and pointed at step 4, rather than the generic «check failed». */
function isUnknownBenefitCode(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.code === 'ERR-VAL-001' &&
    (error.details as { reason?: string } | undefined)?.reason === 'unknown_benefit_code'
  );
}

/** The backend's refusals of the benefit claim itself (`ERR-APP-003`): the
 *  number missing (#181), the scan missing or its type not configured
 *  (#220), or — for the Beekeeping Union member — a number unknown to the
 *  Union's register, someone else's, or expired (#219). Each belongs to the
 *  benefit row: the wizard keeps or sends the applicant back to step 4 and
 *  shows it there, rather than a banner about a field they cannot see. */
const BENEFIT_CLAIM_REASONS = new Set([
  'benefit_certificate_required',
  'benefit_claim_needs_a_document',
  'benefit_doc_type_not_configured',
  'benefit_certificate_unknown',
  'benefit_certificate_not_yours',
  'benefit_certificate_expired',
]);

function isBenefitClaimRefusal(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.code !== 'ERR-APP-003') return false;
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  return reason !== undefined && BENEFIT_CLAIM_REASONS.has(reason);
}

/**
 * B7 — the application wizard, the core of the system. Rewritten in stage 12
 * (plan 12, R10 — filing without a draft): steps 1-4 write NOTHING, and the
 * whole filing lives only in this component's own state. Step 5 posts that
 * state to `POST /applications/precheck` for the checks and the price;
 * pressing «Yuborish» posts the SAME filing to `POST /applications`, which
 * creates the application already SUBMITTED, numbered, priced, signed and
 * assigned, in one request. A legal applicant's filing first calls
 * `POST /applications/package` to mint the id and get the bytes to sign,
 * then posts that id and the signature alongside the filing (ERI is the
 * only signing method for a legal applicant, ruling #226); an individual
 * signing for themselves (ruling #183) skips the package call entirely.
 * There is no DRAFT anywhere in this flow any more — a
 * `?draft=<id>` in the URL is simply never read, and leaving before the
 * final POST loses everything entered (the leave guard below says so).
 */
export function ApplicationWizardPage() {
  const t = useT();
  const { lang } = useLanguage();
  const { me, refreshMe } = useAuth();
  const errorText = useApiErrorText();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  // The furthest step ever reached, distinct from `step` (where the
  // applicant currently stands). T1's stepper contract: clicking a
  // COMPLETED step returns to it, and that must survive going back further
  // still — reaching step 4 then returning to step 2 must not re-lock
  // steps 3 and 4 (`Stepper`'s own `maxStepReached` prop docstring).
  const [maxStepReached, setMaxStepReached] = useState(1);
  const [activityTypeId, setActivityTypeId] = useState('');
  const [contour, setContour] = useState<PickedContour | null>(null);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [quantity, setQuantity] = useState('');
  // Decision #215 R6 — the deadwood and recreation blanks' own lines, asked
  // only when that activity is chosen and required before step 3 lets go.
  const [deadwoodProduct, setDeadwoodProduct] = useState<DeadwoodProduct | ''>('');
  const [removalDeadline, setRemovalDeadline] = useState('');
  const [recreationPurpose, setRecreationPurpose] = useState<RecreationPurpose | ''>('');
  const [eventAt, setEventAt] = useState('');
  const [items, setItems] = useState<LivestockRow[]>([]);
  // Step 4's local documents (plan 12, R9): each is uploaded through
  // `POST /files` the moment it is chosen, exactly as before, but there is
  // no application row to attach it to until the filing itself is posted —
  // so the association lives only here, and rides along inside the filing
  // body's own `documents` array.
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  // The benefit claim lives on step 4 with the documents, not on step 3 with
  // the quantities: a category is chosen as one more "document type" in the
  // same select as the attachments, because to the citizen the claim IS the
  // certificate they attach — one row, its number, its file.
  // The RAW claim — what the citizen picked; `benefitCategoryItemId` below
  // is the one every consumer reads.
  const [claimedBenefitCategoryItemId, setClaimedBenefitCategoryItemId] = useState('');
  // Ruling #181: the certificate number is mandatory for EVERY benefit
  // category now — there is no per-item `requires_certificate` switch any
  // more — required before the request ever leaves the browser, the same
  // reason as before: the backend's own refusal (`ERR-APP-003`,
  // `details.reason = "benefit_certificate_required"`) must never be how the
  // applicant first learns of it.
  const [benefitCertificateNo, setBenefitCertificateNo] = useState('');
  const [certificateTouched, setCertificateTouched] = useState(false);
  // Set only from a backend refusal of the claim (`isBenefitClaimRefusal`)
  // — step 4's own pre-check (#219: the Union's register answers
  // on "Next") or a filing refusal in `handleSignAndSubmit`, which sends the
  // applicant back to step 4. Shown right at this field, never only as a
  // step-5 banner.
  const [benefitCertificateServerError, setBenefitCertificateServerError] = useState<string | null>(null);
  // Step 4's rows that have no file yet. One empty row from the start, so
  // the step opens on a select rather than on a lone "add" button; every
  // further row is the citizen's own "add document".
  const [docRows, setDocRows] = useState<PendingDocRow[]>(() => [{ key: crypto.randomUUID(), typeValue: '' }]);
  // #177: the effective season windows and minimum term, read by
  // `OccupancyCalendar` (through `GET /activity-seasons/effective`, the SAME
  // resolution the blocking check itself uses) and handed back here so the
  // native date inputs below can be constrained by the identical numbers
  // rather than a second, possibly-drifted reading of the same dictionary.
  const [seasonInfo, setSeasonInfo] = useState<{ windows: SeasonWindow[]; minTermDays: number | null }>({
    windows: [],
    minTermDays: null,
  });
  const [precheckResult, setPrecheckResult] = useState<PrecheckOut | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  // The id of the application a successful filing produced — set instead of
  // navigating away at once, so the citizen first sees which phone the
  // status SMS will reach (Oybek, 2026-09-13). Every way out of that dialog
  // is a navigation, and all of them land somewhere safe.
  const [filedId, setFiledId] = useState<string | null>(null);
  // Ruling #184: mandatory before ANY signature, self or legal alike — the
  // sign button stays disabled until this is ticked. Never persisted: the
  // applicant accepts it fresh at the moment of signing, not once and
  // forever — the same reading `applications.rules_accepted_at` records.
  const [rulesAccepted, setRulesAccepted] = useState(false);

  // Ruling #113: the address requisite is gated at SUBMIT, not at
  // registration — requisite 11 of form 1-ilova prints the holder's
  // address, and the holder is always the caller's own applicant (stage 18,
  // decision #226: no more filing "on behalf" of someone else's entity).
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
  const filingApplicant = me?.applicant ?? null;
  const needsAddress = filingApplicant !== null && !filingApplicant.address;
  // Ruling #226: an organisation's ERI already proves authority, so a legal
  // applicant always signs with ERI — there is no plain-button path for it,
  // the way ruling #183 still gives an individual applicant.
  const isLegalApplicant = filingApplicant?.kind === 'legal';

  const activityTypesQuery = useQuery({ queryKey: ['activity-types'], queryFn: listActivityTypes });
  const livestockTypesQuery = useQuery({ queryKey: ['livestock-types'], queryFn: listLivestockTypes });
  const benefitCategoriesQuery = useQuery({
    queryKey: ['classifier-items', 'benefit_categories'],
    queryFn: () => listClassifierItems('benefit_categories'),
  });
  const docTypesQuery = useQuery({ queryKey: ['classifier-items', 'doc_types'], queryFn: () => listClassifierItems('doc_types') });
  // Ruling #184: anonymous, the same read the landing footer already makes —
  // `rules_url` is what the step-5 checkbox links to.
  const siteSettingsQuery = useQuery({ queryKey: ['site-settings'], queryFn: getSiteSettings });

  const activityCode = activityTypesQuery.data?.find((a) => a.id === activityTypeId)?.code;
  const isGrazing = activityCode === GRAZING_CODE;
  const isDeadwood = activityCode === DEADWOOD_CODE;
  const isRecreation = activityCode === RECREATION_CODE;
  const quantityUnit = activityTypesQuery.data?.find((a) => a.id === activityTypeId)?.quantity_unit;

  // Ruling #181 scopes every benefit category to ONE activity — the item's
  // own `props.activity` (`apiary` for the Union member, `recreation` for
  // the six VMQ 278 ¶12 categories) — and `norms._check_benefit_claim`
  // refuses a category claimed on any other activity as `ERR-VAL-001`/
  // `unknown_benefit_code`. Met on the dev stand: a haymaking draft with
  // `persons_with_disabilities` claimed, and step 5's pre-check answering
  // only «check failed», with nothing for the citizen to point at. So step
  // 4 offers the chosen activity's categories alone; an item with no
  // `props.activity` is offered everywhere (nothing scopes it).
  const applicableBenefitCategories = useMemo(
    () =>
      (benefitCategoriesQuery.data ?? []).filter((b) => {
        const activity = (b.props as { activity?: unknown } | undefined)?.activity;
        return typeof activity !== 'string' || activity === activityCode;
      }),
    [benefitCategoriesQuery.data, activityCode],
  );
  // A claim that no longer fits — the activity changed on step 1 after it
  // was picked — reads as NO claim: the certificate is not asked, and the
  // filing sends null rather than carrying it into a pre-check that can
  // only refuse it. Derived, never synced: while the list is still loading
  // there is nothing to judge the claim against, so it is kept as is.
  const benefitCategoryItemId =
    benefitCategoriesQuery.data === undefined ||
    applicableBenefitCategories.some((b) => b.id === claimedBenefitCategoryItemId)
      ? claimedBenefitCategoryItemId
      : '';

  // Ruling #181 and decision #220: every one of the seven benefit categories
  // needs a certificate number AND its scan — there is no
  // `props.requires_certificate` switch to read. Simply: a category is
  // chosen, or it isn't.
  const requiresCertificate = benefitCategoryItemId !== '';
  // The `doc_types` item the scan is filed under (`benefit_proof`,
  // migration `0024`) — looked up by CODE, never by list position (the exact
  // bug `respond_info`'s own fix wave, docs/status.md, exists to avoid
  // repeating here). Undefined while the list loads or if the item is
  // archived — then the benefit row offers no file button.
  const benefitProofDocTypeId = docTypesQuery.data?.find((d) => d.code === 'benefit_proof')?.id;
  // FAIL-CLOSED, like the backend's own check (#220): while the doc-type list
  // has not loaded, or `benefit_proof` is not in it, the gate stays SHUT —
  // never a green "attached" over an empty list.
  const hasBenefitProofDoc =
    !requiresCertificate ||
    (!!benefitProofDocTypeId && documents.some((d) => d.doc_type_item_id === benefitProofDocTypeId));

  // Plan 12: the whole filing, assembled from this component's own state —
  // never a server-side draft. Shared by the pre-check, the package and the
  // final POST, so the three cannot disagree about what a filing is.
  const buildFiling = useCallback((): ApplicationFilingIn => {
    const filingItems: ApplicationItemIn[] = isGrazing
      ? items
          .filter((i) => i.livestockTypeId && i.headCount)
          .map((i) => ({ livestock_type_id: i.livestockTypeId, head_count: Number(i.headCount) }))
      : [];
    return {
      activity_type_id: activityTypeId || undefined,
      contour_id: contour?.id,
      period_from: periodFrom || undefined,
      period_to: periodTo || undefined,
      quantity: isGrazing ? undefined : quantity || undefined,
      deadwood_product: isDeadwood ? deadwoodProduct || undefined : undefined,
      removal_deadline: isDeadwood ? removalDeadline || undefined : undefined,
      recreation_purpose: isRecreation ? recreationPurpose || undefined : undefined,
      // <input type="datetime-local"> yields `YYYY-MM-DDTHH:MM` with no zone;
      // sent as-is — the backend reads a naive value as Tashkent wall-clock time
      // (the only zone this system serves) and stores it aware.
      event_at: isRecreation ? eventAt || undefined : undefined,
      items: filingItems,
      benefit_category_item_id: benefitCategoryItemId || null,
      benefit_certificate_no: requiresCertificate ? benefitCertificateNo.trim() || null : null,
      documents: documents.map((d) => ({ doc_type_item_id: d.doc_type_item_id, file_id: d.file_id })),
    };
  }, [
    activityTypeId,
    contour,
    periodFrom,
    periodTo,
    isGrazing,
    quantity,
    isDeadwood,
    deadwoodProduct,
    removalDeadline,
    isRecreation,
    recreationPurpose,
    eventAt,
    items,
    benefitCategoryItemId,
    requiresCertificate,
    benefitCertificateNo,
    documents,
  ]);

  const precheckMutation = useMutation({
    mutationFn: () => precheckFiling(buildFiling()),
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
  // belt-and-braces, not the only guard. A second guard, `step3Blocked`
  // (below), refuses a jump PAST step 3 while its own data is unfinished or
  // out of range — the exact round trip this closes: reach step 5 once,
  // come back to step 3, break a row, then skip it again through the
  // stepper instead of step 3's own (already-guarded) Next. Going back to
  // step 3 or earlier is always allowed, whatever state step 3 is in.
  function goToCompletedStep(stepId: number) {
    if (stepId > maxStepReached) return;
    if (stepId > 3 && step3Blocked) return;
    setStep(stepId);
  }

  // T1's contract: choosing the activity type advances to step 2 BY
  // ITSELF — the footer's "Next" button stays in place (Oybek: not
  // removed, merely no longer the only way forward). Plan 12: this writes
  // nothing — `activityTypeId` is the only thing that changes.
  function selectActivityType(id: string) {
    setSubmitError(null);
    setActivityTypeId(id);
    // TWO clicks, not one (Oybek, 2026-09-10, after trying the one-click
    // version on the stand): the first click SELECTS and stays put, a second
    // click on the SAME card moves on. A single click that both chose and
    // navigated gave no moment to see what had been chosen, and misreading
    // one card for its neighbour cost a step back every time. Clicking a
    // DIFFERENT card selects that one instead of advancing — otherwise
    // correcting a misclick would carry the applicant forward on the wrong
    // activity, which is the very thing this change exists to prevent.
    // The footer's "Next" button still works, and always did.
    if (activityTypeId === id) goToStep(2);
  }

  // Plan 12, R10: steps 1-4 write NOTHING — every "Next" here only advances
  // the stepper. Step 4 is the one exception: leaving it fires the
  // stateless pre-check over the filing assembled so far.
  function goNext() {
    setSubmitError(null);
    if (step === 1) {
      goToStep(2);
      return;
    }
    if (step === 2 && contour) {
      goToStep(3);
      return;
    }
    if (step === 3) {
      goToStep(4);
      return;
    }
    if (step === 4) {
      setPrecheckResult(null);
      // Ruling #219: with a benefit claimed, the pre-check runs while the
      // applicant is STILL on step 4 — the Beekeeping Union's register
      // answers there, and a number it refuses keeps them where the number
      // is typed (Odilxon's own words: "returns"), never on step 5 with a
      // banner. Any other outcome moves on as before: the result, or a
      // refusal of something else, is shown on step 5.
      if (requiresCertificate) {
        precheckMutation.mutate(undefined, {
          onSuccess: () => goToStep(5),
          onError: (err) => {
            if (isBenefitClaimRefusal(err)) {
              setBenefitCertificateServerError(errorText(err));
              return;
            }
            goToStep(5);
          },
        });
        return;
      }
      goToStep(5);
      // `mutate`, not `mutateAsync`: nothing here awaits the result, and a
      // refused pre-check (a 400 on the input, `precheckFiling`'s own
      // docstring) is shown from the mutation's state on step 5 — as an
      // unhandled rejection out of the button's click handler it was only
      // noise.
      precheckMutation.mutate();
      return;
    }
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  // Fix round 1 (stage 17 QA-01 review, Important): one entry per row,
  // `null`/`null` for a row with nothing to say (fully empty, or complete
  // and valid) — read by both the row's own fields (below) and the Next
  // button's `disabled` (further down) so the two never disagree about
  // which row is blocking.
  const grazingRowIssues = useMemo(
    () => items.map((row) => livestockRowIssue(row, t)),
    [items, t],
  );
  const grazingHasBlockingRow = grazingRowIssues.some((issue) => issue.typeError || issue.countError);
  const quantityError = useMemo(() => quantityIssue(quantity, t), [quantity, t]);

  // The exact rule step 3's own Next button disables on (below, in the
  // footer) — pulled out so `goToCompletedStep` above and step 4/5's own
  // guards can all ask "is step 3's data actually complete" without
  // repeating (or drifting from) the same four conditions.
  const step3Blocked =
    (!isGrazing && (!quantity || !!quantityError)) ||
    (isGrazing &&
      (items.filter((i) => i.livestockTypeId && i.headCount).length === 0 || grazingHasBlockingRow)) ||
    (isDeadwood && (!deadwoodProduct || !removalDeadline)) ||
    (isRecreation && (!recreationPurpose || !eventAt));

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
    setSubmitError(null);
    setSigning(true);
    try {
      const applicant = me?.applicant;
      if (!isLegalApplicant && !applicant?.pinfl) {
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
        // carry it before the package is fetched and signed.
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
      let created;
      // Ruling #183/#226: an individual applicant filing for themselves
      // signs with a plain button — no envelope, no E-IMZO dialog at all.
      // The applicant session already identifies them by PINFL (OneID/
      // E-IMZO login, #32), so there is nothing left for this browser to
      // produce; `file()` mints the application id itself (plan 12, R2). A
      // legal applicant has no such plain path — its ERI already proves
      // authority, so it always signs, ruling #226.
      if (!isLegalApplicant) {
        created = await fileApplication({ ...buildFiling(), rules_accepted: true });
      } else {
        // Plan 12, R2: the package mints the id the application WILL carry
        // and answers the bytes to sign; the client posts both back with
        // the filing. Fix wave, finding 2 (kept): real mode signs DETACHED,
        // over the exact bytes the package just served.
        const { applicationId, packageBytes } = await packageFiling(buildFiling());
        const pkcs7 = isEimzoMock()
          ? await buildMockSignature({
              documentBytes: packageBytes.buffer as ArrayBuffer,
              // A legal applicant's certificate carries a STIR, not a
              // PINFL (`_ownership_reason` matches on the STIR).
              pinfl: applicant?.stir ?? '',
              fullName: applicant?.name,
            })
          : await signDocument(packageBytes);
        created = await fileApplication({
          ...buildFiling(),
          rules_accepted: true,
          application_id: applicationId,
          pkcs7,
        });
      }
      // The filing is in the database — from here on every navigation
      // (the card, the profile, a dismissed dialog) must pass the
      // leave-guard below without asking: there is nothing left to lose.
      skipLeaveGuardRef.current = true;
      setFiledId(created.id);
    } catch (err) {
      // Cancel in the certificate picker is a decision, not a failure: an
      // error banner here would claim the filing failed when nobody tried.
      if (isEimzoCancelled(err)) return;
      // Rulings #181/#219: a refusal of the certificate number is a FIELD
      // error, not a banner — the register may have changed since step 4's
      // pre-check, so the filing can still refuse it, and the wizard sends
      // the applicant back to step 4, where the number actually lives.
      if (isBenefitClaimRefusal(err)) {
        setBenefitCertificateServerError(errorText(err));
        setStep(4);
        return;
      }
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

  // #177: the effective season windows and minimum term — read through
  // `OccupancyCalendar` (`onSeasonInfo`, this file's own `seasonInfo` state)
  // rather than a second query here, so there is exactly one reading of
  // "what season applies" to ever disagree with the check. A date outside
  // every window is refused IN THE FIELD, same as the reversed/too-long
  // pair above, rather than surfacing only from the calendar's disabled
  // day cells — a value typed directly into the native input, bypassing the
  // calendar entirely, still gets caught here.
  const seasonError = useMemo(() => {
    if (!periodFrom || !periodTo) return null;
    if (seasonInfo.windows.length === 0) return null;
    const bothInSeason =
      isIsoDateInWindows(periodFrom, seasonInfo.windows) && isIsoDateInWindows(periodTo, seasonInfo.windows);
    return bothInSeason ? null : t('wizard.step2.seasonOutOfRange');
  }, [periodFrom, periodTo, seasonInfo.windows, t]);

  const minTermError = useMemo(() => {
    if (!periodFrom || !periodTo || !seasonInfo.minTermDays) return null;
    if (isoDaySpan(periodFrom, periodTo) < seasonInfo.minTermDays) {
      return t('wizard.step2.minTermNotice').replace('{days}', String(seasonInfo.minTermDays));
    }
    return null;
  }, [periodFrom, periodTo, seasonInfo.minTermDays, t]);

  const combinedPeriodError = periodError ?? seasonError ?? minTermError;
  const minTermNotice = seasonInfo.minTermDays
    ? t('wizard.step2.minTermNotice').replace('{days}', String(seasonInfo.minTermDays))
    : null;

  // Each input constrains the other via native `min`/`max`, so most invalid
  // pairs are impossible to pick in the first place rather than merely
  // flagged after the fact.
  const periodFromMin = periodTo ? addIsoDays(periodTo, -MAX_PERIOD_DAYS) : undefined;
  const periodFromMax = periodTo || undefined;
  const periodToMin = periodFrom || undefined;
  const periodToMax = periodFrom ? addIsoDays(periodFrom, MAX_PERIOD_DAYS) : undefined;

  // T1's contract, item 3: leaving mid-way asks first. Plan 12, R10: the
  // wizard writes nothing before «Yuborish», so this is never "resume it
  // later" — everything entered so far is genuinely lost. `hasProgress` is
  // the signal: true from the moment an activity is chosen (or any later
  // step is reached), and stays true for the page's whole lifetime.
  const hasProgress = activityTypeId !== '' || maxStepReached > 1;
  const skipLeaveGuardRef = useRef(false);

  const shouldBlockLeaving = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      !skipLeaveGuardRef.current && hasProgress && currentLocation.pathname !== nextLocation.pathname,
    [hasProgress],
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
    if (!hasProgress) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (skipLeaveGuardRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasProgress]);

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
              error={combinedPeriodError ?? undefined}
              helperText={!combinedPeriodError && minTermNotice ? minTermNotice : undefined}
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

          {/* T10 (#177): the three-colour occupancy calendar, constrained
              to the effective season and showing the minimum term — the
              same numbers the two `FormField`s above validate against. */}
          {contour && activityTypeId && (
            <OccupancyCalendar
              contourId={contour.id}
              activityTypeId={activityTypeId}
              periodFrom={periodFrom}
              periodTo={periodTo}
              onSelectRange={(from, to) => {
                setPeriodFrom(from);
                setPeriodTo(to);
              }}
              onSeasonInfo={setSeasonInfo}
            />
          )}
        </section>
      )}

      {/* Step 3 — parameters + live price */}
      {step === 3 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step3.heading')}</h2>
            {isGrazing ? (
              <div className="space-y-3">
                {items.map((row, idx) => {
                  const rowIssue = grazingRowIssues[idx] ?? { typeError: null, countError: null };
                  return (
                    // Top-aligned, not bottom: a field's error line grows its
                    // column, and `items-end` then pushed that column's label
                    // and input above the neighbour's.
                    <div key={row.key} className="flex items-start gap-3">
                      <FormField
                        label={t('wizard.step3.livestockType')}
                        className="flex-1"
                        error={rowIssue.typeError ?? undefined}
                      >
                        <Select
                          value={row.livestockTypeId}
                          error={!!rowIssue.typeError}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...row, livestockTypeId: e.target.value };
                            setItems(next);
                          }}
                          options={[
                            { value: '', label: t('wizard.step3.selectPrompt') },
                            // A type another row already carries is dropped
                            // from THIS row's own options — except the one
                            // this row itself currently holds, or picking it
                            // again would look chosen and then vanish from
                            // its own select. Backend: `duplicate_livestock_type`.
                            ...(livestockTypesQuery.data ?? [])
                              .filter(
                                (l) =>
                                  l.id === row.livestockTypeId ||
                                  !items.some((i) => i.livestockTypeId === l.id),
                              )
                              .map((l) => ({ value: l.id, label: pickName(l.name, lang) })),
                          ]}
                        />
                      </FormField>
                      <FormField
                        label={t('wizard.step3.headCount')}
                        className="w-32"
                        error={rowIssue.countError ?? undefined}
                      >
                        <Input
                          type="number"
                          min={1}
                          max={LIVESTOCK_HEAD_COUNT_MAX}
                          error={!!rowIssue.countError}
                          value={row.headCount}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...row, headCount: e.target.value };
                            setItems(next);
                          }}
                        />
                      </FormField>
                      {/* Skips the label line (16px + the 6px gap) and centres
                          on the 40px input, whatever the error lines do. */}
                      <div className="mt-[22px] h-[40px] flex items-center">
                        <Button variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="cursor-pointer">
                          <Trash2 className="w-4 h-4 text-[#B91C1C]" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {/* Fix round 1 (stage 17 QA-01 review): this project's own
                    defects keep failing in the HIDING direction, and a
                    button that vanishes whenever the query is loading,
                    errored, or simply not answered yet would be exactly
                    that — a grazing applicant left with no row, no button
                    and no message. So every branch below renders SOMETHING:
                    a spinner-disabled button while loading; a danger Alert
                    plus a disabled button on error (never hidden, so the
                    applicant sees WHY nothing can be added); a "not
                    configured" Alert with no button when the list loaded but
                    is genuinely empty (nothing to add — the Alert IS the
                    message, not a silent gap); and — the only case with no
                    Alert, because it is the intended end state — no button
                    once every known type already has its own row. */}
                {livestockTypesQuery.isError && (
                  <Alert variant="danger">
                    {errorText(livestockTypesQuery.error, t('wizard.step3.livestockTypesLoadError'))}
                  </Alert>
                )}
                {livestockTypesQuery.isSuccess && livestockTypesQuery.data.length === 0 && (
                  <Alert variant="warning">{t('wizard.step3.livestockNotConfigured')}</Alert>
                )}
                {/* One row per known type at most, and never more than
                    `LIVESTOCK_ITEMS_MAX` (stage 17 R3/M2) — a row with no
                    type left to offer would only duplicate an existing one,
                    which is exactly the refusal this caps client-side.
                    Hidden only once the cap is actually known and reached
                    (including the trivial "0 types, 0 rows" case, covered by
                    the Alert above); loading and error keep the button
                    visible instead of hiding it (see the Alert/disabled
                    handling above). */}
                {!(
                  livestockTypesQuery.isSuccess &&
                  items.length >= Math.min(livestockTypesQuery.data.length, LIVESTOCK_ITEMS_MAX)
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    isLoading={livestockTypesQuery.isLoading}
                    disabled={livestockTypesQuery.isError}
                    onClick={() => setItems([...items, { key: crypto.randomUUID(), livestockTypeId: '', headCount: '' }])}
                    className="cursor-pointer"
                  >
                    {t('wizard.step3.addLivestock')}
                  </Button>
                )}
              </div>
            ) : (
              <>
                <FormField
                  label={quantityUnit ? `${t('wizard.step3.quantity')} (${formatUnit(quantityUnit, t, lang)})` : t('wizard.step3.quantity')}
                  required
                  htmlFor="quantity"
                  error={quantityError ?? undefined}
                >
                  <Input
                    id="quantity"
                    type="number"
                    min={0}
                    max={QUANTITY_MAX}
                    step="0.0001"
                    error={!!quantityError}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </FormField>
                {/* Decision #215 R6: the deadwood blank's own lines, for
                    that activity alone; the backend refuses a pre-check
                    without them (`checks.missing_for_pricing`), so Next
                    holds until both are filled. */}
                {isDeadwood && (
                  <>
                    <FormField label={t('wizard.step3.deadwoodProduct')} required htmlFor="deadwood-product">
                      <Select
                        id="deadwood-product"
                        value={deadwoodProduct}
                        onChange={(e) => setDeadwoodProduct(e.target.value as DeadwoodProduct | '')}
                        options={[
                          { value: '', label: t('wizard.step3.selectPrompt') },
                          ...DEADWOOD_PRODUCTS.map((code) => ({ value: code, label: t(`wizard.step3.deadwoodProduct.${code}`) })),
                        ]}
                      />
                    </FormField>
                    <FormField label={t('wizard.step3.removalDeadline')} required htmlFor="removal-deadline">
                      <Input id="removal-deadline" type="date" value={removalDeadline} onChange={(e) => setRemovalDeadline(e.target.value)} />
                    </FormField>
                  </>
                )}
                {/* The recreation blank's lines, the same way (#215 R6). */}
                {isRecreation && (
                  <>
                    <FormField label={t('wizard.step3.recreationPurpose')} required htmlFor="recreation-purpose">
                      <Select
                        id="recreation-purpose"
                        value={recreationPurpose}
                        onChange={(e) => setRecreationPurpose(e.target.value as RecreationPurpose | '')}
                        options={[
                          { value: '', label: t('wizard.step3.selectPrompt') },
                          ...RECREATION_PURPOSES.map((code) => ({ value: code, label: t(`wizard.step3.recreationPurpose.${code}`) })),
                        ]}
                      />
                    </FormField>
                    <FormField label={t('wizard.step3.eventAt')} required htmlFor="event-at">
                      <Input id="event-at" type="datetime-local" value={eventAt} onChange={(e) => setEventAt(e.target.value)} />
                    </FormField>
                  </>
                )}
              </>
            )}
          </div>

          <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-2xl p-6 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-[#0369A1] uppercase tracking-wider">{t('wizard.step3.estimatedPrice')}</h3>
            <PricePreviewPanel request={calculationRequest} />
          </div>
        </section>
      )}

      {/* Step 4 — documents, the benefit claim among them */}
      {step === 4 && (
        <section className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step4.heading')}</h2>
          {/* Second line of defence, visible: normally unreachable (step 3's
              own Next and the stepper both already refuse to leave it
              broken), but named here too rather than just disabling Next
              with no explanation. */}
          {step3Blocked && <Alert variant="warning">{t('wizard.nav.step3Incomplete')}</Alert>}
          {(docTypesQuery.data ?? []).length === 0 ? (
            <Alert variant="warning">{t('wizard.step4.notConfigured')}</Alert>
          ) : (
            <DocumentsStep
              docTypes={docTypesQuery.data ?? []}
              benefitCategories={applicableBenefitCategories}
              benefitProofDocTypeId={benefitProofDocTypeId}
              documents={documents}
              rows={docRows}
              onRowsChange={setDocRows}
              benefitCategoryItemId={benefitCategoryItemId}
              onBenefitCategoryChange={(id) => {
                setClaimedBenefitCategoryItemId(id);
                if (!id) {
                  setBenefitCertificateNo('');
                  setCertificateTouched(false);
                }
                setBenefitCertificateServerError(null);
              }}
              benefitCertificateNo={benefitCertificateNo}
              onBenefitCertificateNoChange={(value) => {
                setBenefitCertificateNo(value);
                setBenefitCertificateServerError(null);
              }}
              certificateError={
                (certificateTouched && !benefitCertificateNo.trim()
                  ? t('wizard.step4.certificateNumberRequired')
                  : undefined) ?? benefitCertificateServerError ?? undefined
              }
              onCertificateBlur={() => setCertificateTouched(true)}
              onUpload={async (file, docTypeItemId) => {
                const uploaded = await uploadFile(file);
                setDocuments((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), doc_type_item_id: docTypeItemId, file_id: uploaded.id },
                ]);
              }}
              onRemove={(documentId) => setDocuments((prev) => prev.filter((d) => d.id !== documentId))}
            />
          )}
        </section>
      )}

      {/* Step 5 — precheck + sign + submit */}
      {step === 5 && (
        <section className="space-y-4">
          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">{t('wizard.step5.heading')}</h2>
            {/* Same second line of defence as step 4's own, above. */}
            {step3Blocked && <Alert variant="warning">{t('wizard.nav.step3Incomplete')}</Alert>}
            {precheckMutation.isPending && (
              <p className="text-xs text-[#5A646D] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> {t('wizard.step5.checking')}
              </p>
            )}
            {precheckMutation.isError && (
              <Alert variant="danger">
                {isUnknownBenefitCode(precheckMutation.error)
                  ? t('wizard.step5.benefitNotForActivity')
                  : errorText(precheckMutation.error, t('wizard.step5.checkError'))}
              </Alert>
            )}
            {precheckResult && (
              <>
                <ChecksList checks={fromPrecheckChecks(precheckResult.checks)} />
                {precheckResult.calculation ? (
                  <div className="bg-[#F0F9FF] border border-[#BAE6FD] rounded-xl p-4 space-y-2">
                    <div className="font-mono text-lg font-bold text-[#123522]">
                      {formatMoney(precheckResult.calculation.amount)} {t('wizard.step3.currency')}
                    </div>
                    {/* The citizen signs over this figure, so they see how it
                        came about here, before the signature — not only on
                        the card afterwards. */}
                    <CalculationBreakdown
                      lines={precheckResult.calculation.lines}
                      bhm={precheckResult.calculation.bhm}
                      amount={precheckResult.calculation.amount}
                      livestockName={(code) =>
                        pickName(livestockTypesQuery.data?.find((l) => l.code === code)?.name, lang)
                      }
                      activityName={(code) =>
                        pickName(activityTypesQuery.data?.find((a) => a.code === code)?.name, lang)
                      }
                      benefitName={(code) =>
                        pickName(benefitCategoriesQuery.data?.find((b) => b.code === code)?.name, lang)
                      }
                    />
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
                  maxLength={APPLICANT_ADDRESS_MAX_LENGTH}
                />
              </FormField>
            </div>
          )}

          <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-[#1A1F24] uppercase tracking-wider">
              {isLegalApplicant ? t('wizard.step5.eriTitle') : t('wizard.step5.signTitle')}
            </h2>
            <p className="text-xs text-[#5A646D]">
              {isLegalApplicant ? t('wizard.step5.eriDesc') : t('wizard.step5.signDesc')}
            </p>

            {/* Ruling #184: mandatory before ANY signature — self or legal
                alike. `rules_url` comes from the same anonymous read the
                landing footer uses; the link opens in a new tab so ticking
                the box never loses the wizard's own state. */}
            <div className="flex items-start gap-2.5">
              <input
                id="rules-accepted"
                type="checkbox"
                checked={rulesAccepted}
                onChange={(e) => setRulesAccepted(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-[#2E7D4F] border-[#767F87] rounded cursor-pointer"
              />
              <label htmlFor="rules-accepted" className="text-xs text-[#1A1F24] cursor-pointer select-none">
                {(() => {
                  const [before, after] = t('wizard.step5.rulesCheckboxLabel').split('{rules}');
                  const rulesUrl = siteSettingsQuery.data?.rules_url;
                  return (
                    <>
                      {before}
                      {rulesUrl ? (
                        <a
                          href={rulesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="underline text-[#2E7D4F] font-semibold"
                        >
                          {t('wizard.step5.rulesLinkText')}
                        </a>
                      ) : (
                        t('wizard.step5.rulesLinkText')
                      )}
                      {after}
                    </>
                  );
                })()}
              </label>
            </div>

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
                (needsAddress && !addressSaved && !address.trim()) ||
                !rulesAccepted ||
                // Second line of defence, same reasoning as step 4's Next
                // above: never sign over a filing whose `buildFiling` would
                // silently drop a half-filled step 3 row.
                step3Blocked
              }
              onClick={handleSignAndSubmit}
              className="cursor-pointer font-bold"
            >
              {needsAddress && !addressSaved
                ? t('wizard.step5.saveAddressAndCalc')
                : isLegalApplicant
                  ? t('wizard.step5.signAndSubmit')
                  : t('wizard.step5.signApplication')}
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
              disabled={
                (step === 1 && !activityTypeId) ||
                (step === 2 && (!contour || !periodFrom || !periodTo || !!combinedPeriodError)) ||
                // Fix round 1 (QA-01 review, Important — the QA trigger):
                // `step3Blocked` covers a quantity out of range, a grazing
                // row that is half-filled or out of range (or no complete
                // row at all), and the deadwood/recreation lines ruling
                // #215 R6 requires — one condition, also read by
                // `goToCompletedStep` above so the stepper cannot skip past
                // step 3 by a rule this button does not also enforce.
                (step === 3 && step3Blocked) ||
                // Ruling #181 and decision #220: the certificate number and
                // its scan must both be there before the wizard moves on — the
                // backend's own refusal (`ERR-APP-003`) must never be how the
                // applicant first learns they were needed.
                (step === 4 && requiresCertificate && !benefitCertificateNo.trim()) ||
                (step === 4 && !hasBenefitProofDoc) ||
                // A row with a type chosen and no file is a document the
                // citizen meant to attach: moving on would drop it without
                // a word (the hiding direction), so the row is finished or
                // removed first — the hint under it says which.
                (step === 4 && docRows.some((r) => r.typeValue !== '')) ||
                // Second line of defence: step 3's own Next and the
                // stepper's `goToCompletedStep` both already refuse to leave
                // step 3 broken, which makes this normally unreachable — but
                // this project's own defects keep failing by HIDING data
                // rather than leaking it, so this never trusts a single gate
                // against a row reaching `buildFiling` half-filled.
                (step === 4 && step3Blocked)
              }
              // #219: step 4's own pre-check (a benefit claimed) — one press,
              // one request; a second one while the register answers would
              // race the first.
              isLoading={step === 4 && precheckMutation.isPending}
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

      {/* A successful filing: which phone the status SMS will reach
          (`me.user.phone` — the field the profile's contacts section edits
          and the backend's `get_notification_contact` reads), with a way to
          the profile if it is stale. The cross, the backdrop and Esc all
          count as «open the card»: the filing is done, and any exit from
          this dialog has to lead somewhere sensible. */}
      {filedId && (
        <Modal
          isOpen
          onClose={() => navigate(`/my/applications/${filedId}`)}
          title={t('wizard.filed.title')}
          footer={
            <>
              <Button variant="outline" onClick={() => navigate('/profile')} className="cursor-pointer font-bold">
                {t('wizard.filed.changePhone')}
              </Button>
              <Button
                variant="primary"
                onClick={() => navigate(`/my/applications/${filedId}`)}
                className="cursor-pointer font-bold"
              >
                {t('wizard.filed.openCard')}
              </Button>
            </>
          }
        >
          {me?.user.phone ? (
            (() => {
              const [before, after] = t('wizard.filed.phoneNotice').split('{phone}');
              return (
                <p>
                  {before}
                  <strong className="font-mono">{me.user.phone}</strong>
                  {after}
                </p>
              );
            })()
          ) : (
            <p>{t('wizard.filed.noPhone')}</p>
          )}
        </Modal>
      )}
    </div>
  );
}

type DocTypeRef = { id: string; code: string; name: Record<string, unknown> };
type BenefitCategoryRef = { id: string; name: Record<string, unknown> };
type UploadedDocument = { id: string; doc_type_item_id: string; file_id: string };

/**
 * Step 4 as rows. The "document type" select of every row carries BOTH the
 * `doc_types` items and, under a divider, the `benefit_categories` items:
 * picking a category turns that row into THE benefit row — category, its
 * certificate number (ruling #181) and its scan (#220) — because
 * an application claims at most one benefit (`applications.benefit_category_
 * item_id` is one column), so the categories disappear from every other
 * row's select while one is chosen. `benefit_proof` itself is not offered
 * as a plain type while categories exist: it is what a chosen category is
 * filed under, never a type to pick by hand.
 *
 * A pending row leaves `rows` the moment its file is on the server — the
 * card's own `documents` list shows it from then on — so "add document" is
 * how the citizen attaches a second, third, … file.
 */
function DocumentsStep({
  docTypes,
  benefitCategories,
  benefitProofDocTypeId,
  documents,
  rows,
  onRowsChange,
  benefitCategoryItemId,
  onBenefitCategoryChange,
  benefitCertificateNo,
  onBenefitCertificateNoChange,
  certificateError,
  onCertificateBlur,
  onUpload,
  onRemove,
}: {
  docTypes: DocTypeRef[];
  benefitCategories: BenefitCategoryRef[];
  benefitProofDocTypeId: string | undefined;
  documents: UploadedDocument[];
  rows: PendingDocRow[];
  onRowsChange: (rows: PendingDocRow[]) => void;
  benefitCategoryItemId: string;
  onBenefitCategoryChange: (id: string) => void;
  benefitCertificateNo: string;
  onBenefitCertificateNoChange: (value: string) => void;
  certificateError: string | undefined;
  onCertificateBlur: () => void;
  onUpload: (file: File, docTypeItemId: string) => Promise<void>;
  onRemove: (documentId: string) => void;
}) {
  const t = useT();
  const { lang } = useLanguage();

  const benefitClaimed = benefitCategoryItemId !== '';
  const plainDocTypeOptions = docTypes
    .filter((d) => benefitCategories.length === 0 || d.code !== 'benefit_proof')
    .map((d) => ({ value: d.id, label: pickName(d.name, lang) }));
  const benefitOptions =
    benefitCategories.length > 0
      ? [
          { value: '__benefits', label: `— ${t('wizard.step4.benefitsGroup')} —`, disabled: true },
          ...benefitCategories.map((b) => ({ value: BENEFIT_OPTION_PREFIX + b.id, label: pickName(b.name, lang) })),
        ]
      : [];
  // The proof file(s) of a claimed benefit are shown IN the benefit row;
  // every other attachment is a plain uploaded row.
  const isBenefitProof = (doc: UploadedDocument) =>
    benefitClaimed && !!benefitProofDocTypeId && doc.doc_type_item_id === benefitProofDocTypeId;
  const plainDocuments = documents.filter((doc) => !isBenefitProof(doc));
  const proofDocuments = documents.filter(isBenefitProof);

  function setRowType(key: string, typeValue: string) {
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, typeValue } : r)));
  }
  function removeRow(key: string) {
    onRowsChange(rows.filter((r) => r.key !== key));
  }
  // One handler for every row's select, the benefit row included: a benefit
  // value claims (or re-claims) the category and the row that chose it
  // dissolves into the benefit row; a plain value on the benefit row drops
  // the claim and opens a pending row of that type in its place.
  function handleTypeChange(rowKey: string | null, value: string) {
    if (value.startsWith(BENEFIT_OPTION_PREFIX)) {
      onBenefitCategoryChange(value.slice(BENEFIT_OPTION_PREFIX.length));
      if (rowKey !== null) removeRow(rowKey);
      return;
    }
    if (rowKey === null) {
      onBenefitCategoryChange('');
      if (value) onRowsChange([...rows, { key: crypto.randomUUID(), typeValue: value }]);
      return;
    }
    setRowType(rowKey, value);
  }

  return (
    <div className="space-y-4">
      {plainDocuments.length > 0 && (
        <ul className="space-y-2">
          {plainDocuments.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between p-3 border border-[#E4E7EA] rounded-xl text-xs">
              <span className="font-semibold">{pickName(docTypes.find((d) => d.id === doc.doc_type_item_id)?.name, lang) || t('wizard.step4.defaultDocName')}</span>
              <button onClick={() => onRemove(doc.id)} className="text-[#B91C1C] font-bold hover:underline cursor-pointer">
                {t('wizard.step4.deleteDoc')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {benefitClaimed && (
        <div className="border border-[#E4E7EA] rounded-xl p-3 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label={t('wizard.step4.docType')} htmlFor="benefit" className="flex-1 min-w-[220px]">
              <Select
                id="benefit"
                value={BENEFIT_OPTION_PREFIX + benefitCategoryItemId}
                onChange={(e) => handleTypeChange(null, e.target.value)}
                options={[{ value: '', label: t('wizard.step4.noBenefit') }, ...plainDocTypeOptions, ...benefitOptions]}
              />
            </FormField>
            {/* Ruling #181: shown for EVERY chosen category, no per-item
                switch — filled in here, before the backend's own refusal
                (`ERR-APP-003`, `benefit_certificate_required`) ever has a
                chance to fire. The server error (`unknown`/`not_yours`) is
                a submit-time refusal the wizard cannot catch client-side —
                shown at this same field rather than only in the step-5
                banner. */}
            <FormField
              label={t('wizard.step4.certificateNumber')}
              required
              htmlFor="benefit-certificate-no"
              error={certificateError}
              className="flex-1 min-w-[200px]"
            >
              <Input
                id="benefit-certificate-no"
                value={benefitCertificateNo}
                onChange={(e) => onBenefitCertificateNoChange(e.target.value)}
                onBlur={onCertificateBlur}
              />
            </FormField>
            {proofDocuments.length === 0 && benefitProofDocTypeId && (
              <FileButton onFile={(file) => onUpload(file, benefitProofDocTypeId)} />
            )}
            <Button variant="ghost" size="sm" onClick={() => handleTypeChange(null, '')} className="cursor-pointer" aria-label={t('wizard.step4.deleteDoc')}>
              <Trash2 className="w-4 h-4 text-[#B91C1C]" />
            </Button>
          </div>
          {/* Decision #220: the scan is mandatory exactly like the number —
              said so under the row until it is attached, then listed with
              its own delete (filed under `benefit_proof`). */}
          {proofDocuments.length === 0 ? (
            <Alert variant="warning">{t('wizard.step4.benefitProofRequired')}</Alert>
          ) : (
            <Alert variant="success">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>{t('wizard.step4.benefitProofOk')}</span>
                {proofDocuments.map((doc) => (
                  <button key={doc.id} onClick={() => onRemove(doc.id)} className="text-[#B91C1C] font-bold hover:underline cursor-pointer">
                    {t('wizard.step4.deleteDoc')}
                  </button>
                ))}
              </span>
            </Alert>
          )}
        </div>
      )}

      {rows.map((row) => (
        <div key={row.key} className="space-y-1">
          <div className="flex flex-wrap items-end gap-3">
            <FormField label={t('wizard.step4.docType')} className="flex-1 min-w-[220px]">
              <Select
                value={row.typeValue}
                onChange={(e) => handleTypeChange(row.key, e.target.value)}
                options={[
                  { value: '', label: t('wizard.step4.selectDocType') },
                  ...plainDocTypeOptions,
                  ...(benefitClaimed ? [] : benefitOptions),
                ]}
              />
            </FormField>
            <FileButton
              disabled={!row.typeValue}
              onFile={async (file) => {
                await onUpload(file, row.typeValue);
                removeRow(row.key);
              }}
            />
            <Button variant="ghost" size="sm" onClick={() => removeRow(row.key)} className="cursor-pointer" aria-label={t('wizard.step4.deleteDoc')}>
              <Trash2 className="w-4 h-4 text-[#B91C1C]" />
            </Button>
          </div>
          {row.typeValue && <p className="text-[11px] text-[#5A646D]">{t('wizard.step4.pendingRowHint')}</p>}
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        leftIcon={<Plus className="w-4 h-4" />}
        onClick={() => onRowsChange([...rows, { key: crypto.randomUUID(), typeValue: '' }])}
        className="cursor-pointer"
      >
        {t('wizard.step4.addDoc')}
      </Button>
    </div>
  );
}

/** "Choose file" with its hidden `<input type="file">`, one upload at a time. */
function FileButton({ onFile, disabled }: { onFile: (file: File) => Promise<void>; disabled?: boolean }) {
  const t = useT();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      await onFile(file);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('wizard.step4.uploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        leftIcon={<Upload className="w-4 h-4" />}
        isLoading={uploading}
        disabled={disabled}
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
      {error && <p className="text-[11px] text-[#B91C1C]">{error}</p>}
    </div>
  );
}
