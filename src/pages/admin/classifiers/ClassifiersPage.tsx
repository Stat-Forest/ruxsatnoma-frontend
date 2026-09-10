/**
 * H6 — classifiers and reference data.
 *
 * The screen exists because this reference data is VERSIONED, not editable:
 * `valid_from` / `valid_to` and the `supersede` route are there so a permit
 * issued last year still resolves the code it was issued under. Three
 * consequences run through everything below.
 *
 * 1. **The list is a point in time, and it says so.** `GET
 *    /refs/classifiers/{code}/items` returns what is in force on `on_date`
 *    (omitted = today, and then active rows only). A superseded version is
 *    not deleted — it is closed and archived, and it comes back the moment
 *    the operator asks for a past date. The date control at the top is not a
 *    filter, it is the history.
 *
 * 2. **An item already in force offers no plain edit.** `PATCH` exists and
 *    touches presentation only (`name`, `props`, `valid_to`, `sort_order` —
 *    `ClassifierItemPatch` has no `code` and no `valid_from`), but offering
 *    it on a live row would read as "rewrite this value", which is the one
 *    thing the versioning is designed to prevent. So the edit button appears
 *    only on a row whose window has NOT opened yet — nothing has ever been
 *    issued under it — and every live row offers «voris yaratish» instead.
 *
 * 3. **Supersede is presented as creating the successor.** The dialog is
 *    pre-filled from the version being replaced, its code is locked (the
 *    service refuses a successor with a different code), and the copy states
 *    that the old row is closed the day before and archived rather than
 *    changed.
 *
 * A card list rather than `DataTable`: each row carries a JSON `props` block
 * that no table cell can hold, and cards are the only layout that survives
 * 375px without a horizontal scrollbar across the whole screen.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, GitBranch, Info, Pencil, Plus, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { Modal } from '../../../components/ui/Overlay';
import { Alert } from '../../../components/ui/Feedback';
import { useLanguage } from '../../../i18n/useT';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { formatDate, pickName } from '../../applicant/format';
import {
  addClassifierItem,
  archiveClassifierItem,
  createClassifier,
  listClassifierItems,
  patchClassifierItem,
  supersedeClassifierItem,
  type ClassifierItemIn,
  type ClassifierItemOut,
  type LocalizedName,
} from './api';
import { KNOWN_CLASSIFIER_CODES, LABELS, type ClassifiersLabels } from './labels';
import { CLICKABLE_ROW_CLASS, clickableRowProps } from '../../../lib/rowClick';

// --- plain calendar dates, never re-parsed through a local `Date` -----------

/** Today as `YYYY-MM-DD`, in the viewer's own calendar. Read through
 *  `Date.now()` rather than `new Date()` so a test can pin the day without
 *  fake timers, which do not mix well with `user-event`. */
function todayIso(): string {
  const now = new Date(Date.now());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

/** The day after a `YYYY-MM-DD`, computed in UTC so a DST boundary in the
 *  viewer's zone cannot move a plain calendar date. */
function nextDayIso(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

// --- where an item sits in its own lifetime --------------------------------

type Phase = 'archived' | 'scheduled' | 'closed' | 'active';

/** ISO dates compare correctly as strings, which is why nothing here builds a
 *  `Date` out of a `valid_from`. */
function phaseOf(item: ClassifierItemOut, today: string): Phase {
  if (item.status !== 'active') return 'archived';
  if (item.valid_from > today) return 'scheduled';
  if (item.valid_to !== null && item.valid_to < today) return 'closed';
  return 'active';
}

/** History — shown, never offered as something to rewrite. */
function isHistory(phase: Phase): boolean {
  return phase === 'archived';
}

// --- the one form behind add / edit / supersede ----------------------------

type FormMode = 'add' | 'edit' | 'supersede';

interface ItemForm {
  code: string;
  nameUz: string;
  nameUzCyrl: string;
  nameRu: string;
  nameKaa: string;
  nameEn: string;
  validFrom: string;
  validTo: string;
  sortOrder: string;
  props: string;
}

function emptyForm(today: string): ItemForm {
  return {
    code: '',
    nameUz: '',
    nameUzCyrl: '',
    nameRu: '',
    nameKaa: '',
    nameEn: '',
    validFrom: today,
    validTo: '',
    sortOrder: '0',
    props: '{}',
  };
}

function formFromItem(item: ClassifierItemOut, mode: FormMode, today: string): ItemForm {
  const name = (item.name ?? {}) as Record<string, unknown>;
  const asString = (value: unknown) => (typeof value === 'string' ? value : '');
  // A successor must start strictly after the predecessor's close — the
  // service refuses anything earlier — so the default is the day after it,
  // never earlier than today.
  const earliest = nextDayIso(item.valid_to ?? item.valid_from);
  return {
    code: item.code,
    nameUz: asString(name.uz_latn),
    nameUzCyrl: asString(name.uz_cyrl),
    nameRu: asString(name.ru),
    nameKaa: asString(name.kaa),
    nameEn: asString(name.en),
    validFrom: mode === 'supersede' ? (earliest > today ? earliest : today) : item.valid_from,
    validTo: mode === 'supersede' ? '' : (item.valid_to ?? ''),
    sortOrder: '0',
    props: JSON.stringify(item.props ?? {}, null, 2),
  };
}

function buildName(form: ItemForm): LocalizedName {
  const name: LocalizedName = {};
  if (form.nameUz.trim()) name.uz_latn = form.nameUz.trim();
  if (form.nameUzCyrl.trim()) name.uz_cyrl = form.nameUzCyrl.trim();
  if (form.nameRu.trim()) name.ru = form.nameRu.trim();
  if (form.nameKaa.trim()) name.kaa = form.nameKaa.trim();
  if (form.nameEn.trim()) name.en = form.nameEn.trim();
  return name;
}

interface ParsedProps {
  value?: Record<string, unknown>;
  error?: string;
}

/** The `props` textarea is free-form JSON, so it is parsed — never trusted —
 *  and the parser's own message is what the operator is shown. A value that
 *  parses but is not an object would reach the API as `props: [1,2]` and be
 *  refused there; it is caught here instead. */
function parseProps(raw: string, L: ClassifiersLabels): ParsedProps {
  const text = raw.trim();
  if (!text) return { value: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { error: `${L.errInvalidJson} ${(error as Error).message}` };
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: L.errNotAnObject };
  }
  return { value: parsed as Record<string, unknown> };
}

// --- status pill -----------------------------------------------------------

const PHASE_STYLE: Record<Phase, string> = {
  active: 'bg-[#F0F7F1] border-[#D9EBDC] text-[#123522]',
  scheduled: 'bg-[#E0F2FE] border-[#BAE6FD] text-[#0369A1]',
  closed: 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]',
  archived: 'bg-[#F8F9FA] border-[#E4E7EA] text-[#5A646D]',
};

function PhasePill({ phase, L }: { phase: Phase; L: ClassifiersLabels }) {
  const text = {
    active: L.statusActive,
    scheduled: L.statusScheduled,
    closed: L.statusClosed,
    archived: L.statusArchived,
  }[phase];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PHASE_STYLE[phase]}`}
    >
      {text}
    </span>
  );
}

// --- the screen ------------------------------------------------------------

export function ClassifiersPage() {
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const L = LABELS[lang];
  const queryClient = useQueryClient();
  const today = todayIso();

  const [code, setCode] = useState<string>(KNOWN_CLASSIFIER_CODES[0]);
  const [customCode, setCustomCode] = useState('');
  /** Applied date. Empty means "today", which is also what the API means by
   *  an omitted `on_date` — and, unlike a past date, hides archived rows. */
  const [onDate, setOnDate] = useState('');
  const [dateDraft, setDateDraft] = useState('');

  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formTarget, setFormTarget] = useState<ClassifierItemOut | null>(null);
  const [form, setForm] = useState<ItemForm>(() => emptyForm(today));
  const [propsError, setPropsError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<ClassifierItemOut | null>(null);
  const [creatingClassifier, setCreatingClassifier] = useState(false);
  const [newClassifier, setNewClassifier] = useState({
    code: '',
    nameUz: '',
    nameUzCyrl: '',
    nameRu: '',
    nameKaa: '',
    nameEn: '',
  });

  const items = useQuery({
    queryKey: ['admin', 'classifiers', code, onDate],
    queryFn: () => listClassifierItems(code, onDate || undefined),
  });

  function refresh() {
    return queryClient.invalidateQueries({ queryKey: ['admin', 'classifiers'] });
  }

  const saveItem = useMutation({
    mutationFn: async (body: ClassifierItemIn) => {
      if (formMode === 'supersede' && formTarget) return supersedeClassifierItem(formTarget.id, body);
      if (formMode === 'edit' && formTarget) {
        // `code` and `valid_from` are identity, and `ClassifierItemPatch` has
        // no room for them — an edit changes presentation, nothing else.
        return patchClassifierItem(formTarget.id, {
          name: body.name,
          props: body.props,
          valid_to: body.valid_to ?? null,
          sort_order: body.sort_order,
        });
      }
      return addClassifierItem(code, body);
    },
    onSuccess: async () => {
      await refresh();
      closeForm();
    },
  });

  const archive = useMutation({
    mutationFn: (itemId: string) => archiveClassifierItem(itemId),
    onSuccess: async () => {
      await refresh();
      setArchiveTarget(null);
    },
  });

  const addClassifier = useMutation({
    mutationFn: async () => {
      const name: LocalizedName = {};
      if (newClassifier.nameUz.trim()) name.uz_latn = newClassifier.nameUz.trim();
      if (newClassifier.nameUzCyrl.trim()) name.uz_cyrl = newClassifier.nameUzCyrl.trim();
      if (newClassifier.nameRu.trim()) name.ru = newClassifier.nameRu.trim();
      if (newClassifier.nameKaa.trim()) name.kaa = newClassifier.nameKaa.trim();
      if (newClassifier.nameEn.trim()) name.en = newClassifier.nameEn.trim();
      await createClassifier({ code: newClassifier.code.trim(), name });
    },
    onSuccess: () => {
      setCode(newClassifier.code.trim());
      setCreatingClassifier(false);
      setNewClassifier({ code: '', nameUz: '', nameUzCyrl: '', nameRu: '', nameKaa: '', nameEn: '' });
    },
  });

  function openForm(mode: FormMode, item?: ClassifierItemOut) {
    setFormMode(mode);
    setFormTarget(item ?? null);
    setForm(item ? formFromItem(item, mode, today) : emptyForm(today));
    setPropsError(null);
    setFieldError(null);
    saveItem.reset();
  }

  function closeForm() {
    setFormMode(null);
    setFormTarget(null);
    setPropsError(null);
    setFieldError(null);
  }

  function submitForm() {
    setFieldError(null);
    const parsed = parseProps(form.props, L);
    if (parsed.error) {
      setPropsError(parsed.error);
      return;
    }
    setPropsError(null);
    if (!form.code.trim() || !form.nameUz.trim() || !form.validFrom) {
      setFieldError(L.errRequired);
      return;
    }
    saveItem.mutate({
      code: form.code.trim(),
      name: buildName(form),
      props: parsed.value ?? {},
      valid_from: form.validFrom,
      valid_to: form.validTo || null,
      sort_order: Number(form.sortOrder) || 0,
    });
  }

  const known = useMemo(() => [...KNOWN_CLASSIFIER_CODES] as string[], []);
  const list = items.data ?? [];

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="classifiers-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">{L.title}</h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-3xl">{L.subtitle}</p>
      </div>

      <Alert variant="info" title={L.versioningTitle}>
        {L.versioningBody}
      </Alert>

      {/* --- which classifier, and as of when ------------------------------ */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[#1A1F24]">{L.pickerTitle}</h2>
              <p className="text-xs text-[#5A646D] mt-1">{L.pickerHint}</p>
            </div>
            <FormField label={L.pickerKnown} htmlFor="classifier-code">
              <Select
                id="classifier-code"
                data-testid="classifier-select"
                value={known.includes(code) ? code : ''}
                onChange={(e) => {
                  if (e.target.value) setCode(e.target.value);
                }}
                options={[
                  ...(known.includes(code) ? [] : [{ value: '', label: code }]),
                  ...known.map((value) => ({ value, label: value })),
                ]}
              />
            </FormField>
            <FormField label={L.pickerCustom} htmlFor="classifier-custom">
              <div className="flex gap-2">
                <Input
                  id="classifier-custom"
                  data-testid="custom-code-input"
                  value={customCode}
                  placeholder={L.pickerCustomPlaceholder}
                  onChange={(e) => setCustomCode(e.target.value)}
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (customCode.trim()) setCode(customCode.trim());
                  }}
                >
                  {L.pickerOpen}
                </Button>
              </div>
            </FormField>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setCreatingClassifier(true)}
            >
              {L.pickerCreate}
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-[#1A1F24]">{L.onDateTitle}</h2>
              <p className="text-xs text-[#5A646D] mt-1">{L.onDateHint}</p>
            </div>
            <FormField label={L.onDateLabel} htmlFor="on-date">
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-44">
                  <Input
                    id="on-date"
                    data-testid="on-date-input"
                    type="date"
                    value={dateDraft}
                    max={today}
                    onChange={(e) => setDateDraft(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={() => setOnDate(dateDraft)}>
                  {L.onDateApply}
                </Button>
                {onDate && (
                  <Button
                    variant="ghost"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setOnDate('');
                      setDateDraft('');
                    }}
                  >
                    {L.onDateToday}
                  </Button>
                )}
              </div>
            </FormField>
            <p className="text-xs text-[#5A646D]" data-testid="on-date-active">
              {L.onDateActive}{' '}
              <strong className="text-[#1A1F24]">
                {onDate ? formatDate(onDate) : L.onDateTodayValue}
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* --- items -------------------------------------------------------- */}
      <div className="bg-white border border-[#E4E7EA] rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#1A1F24]">
              {L.listTitle} · <span className="font-mono">{code}</span>
            </h2>
            {!items.isLoading && !items.error && (
              <p className="text-xs text-[#5A646D] mt-0.5">
                {list.length} {L.itemsSuffix}
              </p>
            )}
          </div>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => openForm('add')}
          >
            {L.actionAdd}
          </Button>
        </div>

        {items.error && (
          <div
            className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#991B1B]"
            role="alert"
            data-testid="classifiers-error"
          >
            {errorText(items.error, L.loadFailed)}
          </div>
        )}

        {items.isLoading ? (
          <p className="py-10 text-center text-sm text-[#5A646D]">{L.loading}</p>
        ) : !items.error && list.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold text-[#1A1F24]">{L.empty}</p>
            <p className="text-xs text-[#5A646D] mt-1">{L.emptyHint}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((item) => {
              const phase = phaseOf(item, today);
              const history = isHistory(phase);
              return (
                <li
                  key={item.id}
                  {...(phase === 'scheduled' ? clickableRowProps(() => openForm('edit', item)) : {})}
                  data-testid={`item-${item.id}`}
                  data-archived={item.status !== 'active' ? 'true' : 'false'}
                  className={`rounded-xl border p-4 ${
                    history
                      ? 'border-dashed border-[#9AA3AB] bg-[#F8F9FA]'
                      : 'border-[#E4E7EA] bg-white'
                  } ${phase === 'scheduled' ? `hover:bg-[#F8F9FA] ${CLICKABLE_ROW_CLASS}` : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-[#1A1F24] bg-[#F8F9FA] border border-[#E4E7EA] rounded px-1.5 py-0.5">
                          {item.code}
                        </span>
                        <PhasePill phase={phase} L={L} />
                      </div>
                      <p
                        className={`text-sm font-medium mt-1.5 break-words ${
                          history ? 'text-[#5A646D]' : 'text-[#1A1F24]'
                        }`}
                      >
                        {pickName(item.name, lang)}
                      </p>
                      <p className="text-xs text-[#5A646D] mt-1">
                        <span className="uppercase tracking-wider font-semibold mr-1.5">
                          {L.colValidity}:
                        </span>
                        <span title={L.validFrom}>{formatDate(item.valid_from)}</span>
                        <span className="mx-1" aria-hidden="true">
                          &rarr;
                        </span>
                        <span title={L.validTo}>
                          {item.valid_to ? formatDate(item.valid_to) : L.validOpenEnded}
                        </span>
                      </p>
                    </div>

                    {/* Wraps onto its own line below 375px rather than
                        squeezing the code and name column. */}
                    <div className="flex flex-wrap gap-2">
                      {phase === 'scheduled' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Pencil className="w-3.5 h-3.5" />}
                          onClick={() => openForm('edit', item)}
                        >
                          {L.actionEdit}
                        </Button>
                      )}
                      {!history && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<GitBranch className="w-3.5 h-3.5" />}
                            onClick={() => openForm('supersede', item)}
                          >
                            {L.actionSupersede}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Archive className="w-3.5 h-3.5" />}
                            onClick={() => setArchiveTarget(item)}
                          >
                            {L.actionArchive}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {phase === 'archived' && (
                    <p className="text-xs text-[#5A646D] mt-2.5 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{L.archivedNote}</span>
                    </p>
                  )}
                  {phase === 'closed' && (
                    <p className="text-xs text-[#92400E] mt-2.5">{L.closedNote}</p>
                  )}
                  {phase === 'scheduled' && (
                    <p className="text-xs text-[#0369A1] mt-2.5">{L.scheduledNote}</p>
                  )}
                  {phase === 'active' && (
                    <p className="text-xs text-[#5A646D] mt-2.5">{L.editLockedHint}</p>
                  )}

                  <details className="mt-3 group">
                    <summary className="text-xs font-semibold uppercase tracking-wider text-[#5A646D] cursor-pointer select-none">
                      {L.propsTitle}
                    </summary>
                    <pre
                      data-testid={`props-${item.id}`}
                      className="mt-2 overflow-x-auto rounded-lg bg-[#F8F9FA] border border-[#E4E7EA] p-3 text-xs font-mono text-[#1A1F24]"
                    >
                      {Object.keys(item.props ?? {}).length === 0
                        ? L.propsEmpty
                        : JSON.stringify(item.props, null, 2)}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* --- add / edit / supersede --------------------------------------- */}
      <Modal
        isOpen={formMode !== null}
        onClose={closeForm}
        maxWidth="lg"
        title={
          formMode === 'supersede'
            ? L.supersedeTitle
            : formMode === 'edit'
              ? L.editTitle
              : L.addTitle
        }
        subtitle={
          formMode === 'supersede'
            ? L.supersedeSubtitle
            : formMode === 'edit'
              ? L.editSubtitle
              : L.addSubtitle
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              {L.cancel}
            </Button>
            <Button variant="primary" onClick={submitForm} isLoading={saveItem.isPending}>
              {saveItem.isPending ? L.saving : L.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formMode === 'supersede' && formTarget && (
            <div className="rounded-xl border border-dashed border-[#9AA3AB] bg-[#F8F9FA] p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
                {L.supersedeOriginal}
              </p>
              <p className="text-sm text-[#1A1F24] mt-1">
                <span className="font-mono">{formTarget.code}</span> ·{' '}
                {pickName(formTarget.name, lang)}
              </p>
              <p className="text-xs text-[#5A646D] mt-0.5">
                {formatDate(formTarget.valid_from)} &rarr;{' '}
                {formTarget.valid_to ? formatDate(formTarget.valid_to) : L.validOpenEnded}
              </p>
            </div>
          )}

          <FormField
            label={L.fieldCode}
            required
            htmlFor="field-code"
            helperText={formMode === 'supersede' ? L.supersedeCodeLocked : L.fieldCodeHint}
          >
            <Input
              id="field-code"
              data-testid="field-code"
              value={form.code}
              // Locked on both: a successor must carry the predecessor's code
              // (the service refuses otherwise), and an edit cannot move a
              // code at all — `ClassifierItemPatch` has no such field.
              disabled={formMode !== 'add'}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormField label={L.fieldNameUz} required htmlFor="field-name-uz">
              <Input
                id="field-name-uz"
                data-testid="field-name-uz"
                value={form.nameUz}
                onChange={(e) => setForm((f) => ({ ...f, nameUz: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldNameUzCyrl} htmlFor="field-name-uz-cyrl">
              <Input
                id="field-name-uz-cyrl"
                data-testid="field-name-uz-cyrl"
                value={form.nameUzCyrl}
                onChange={(e) => setForm((f) => ({ ...f, nameUzCyrl: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldNameRu} htmlFor="field-name-ru">
              <Input
                id="field-name-ru"
                data-testid="field-name-ru"
                value={form.nameRu}
                onChange={(e) => setForm((f) => ({ ...f, nameRu: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldNameKaa} htmlFor="field-name-kaa">
              <Input
                id="field-name-kaa"
                data-testid="field-name-kaa"
                value={form.nameKaa}
                onChange={(e) => setForm((f) => ({ ...f, nameKaa: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldNameEn} htmlFor="field-name-en">
              <Input
                id="field-name-en"
                data-testid="field-name-en"
                value={form.nameEn}
                onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label={L.fieldValidFrom}
              required
              htmlFor="field-valid-from"
              helperText={formMode === 'supersede' ? L.supersedeValidFromHint : undefined}
            >
              <Input
                id="field-valid-from"
                data-testid="field-valid-from"
                type="date"
                value={form.validFrom}
                // Identity, not presentation: an existing item's start date is
                // what its history hangs off, so only `add` and `supersede`
                // (which creates a NEW row) may set it.
                disabled={formMode === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldValidTo} htmlFor="field-valid-to" helperText={L.fieldValidToHint}>
              <Input
                id="field-valid-to"
                data-testid="field-valid-to"
                type="date"
                value={form.validTo}
                onChange={(e) => setForm((f) => ({ ...f, validTo: e.target.value }))}
              />
            </FormField>
            <FormField label={L.fieldSortOrder} htmlFor="field-sort-order">
              <Input
                id="field-sort-order"
                data-testid="field-sort-order"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField
            label={L.fieldProps}
            htmlFor="field-props"
            helperText={L.fieldPropsHint}
            error={propsError ?? undefined}
          >
            <Textarea
              id="field-props"
              data-testid="field-props"
              value={form.props}
              error={Boolean(propsError)}
              spellCheck={false}
              className="font-mono text-xs"
              onChange={(e) => setForm((f) => ({ ...f, props: e.target.value }))}
            />
          </FormField>
          {propsError && (
            <p className="text-xs text-[#B91C1C]" role="alert" data-testid="props-error">
              {propsError}
            </p>
          )}
          {fieldError && (
            <p className="text-xs text-[#B91C1C]" role="alert" data-testid="field-error">
              {fieldError}
            </p>
          )}
          {saveItem.error != null && (
            <p className="text-xs text-[#B91C1C]" role="alert" data-testid="save-error">
              {errorText(saveItem.error, L.errSaveFailed)}
            </p>
          )}
        </div>
      </Modal>

      {/* --- archive ------------------------------------------------------- */}
      <Modal
        isOpen={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        title={L.archiveTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiveTarget(null)}>
              {L.cancel}
            </Button>
            <Button
              variant="danger"
              isLoading={archive.isPending}
              onClick={() => archiveTarget && archive.mutate(archiveTarget.id)}
            >
              {L.archiveConfirm}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {archiveTarget && (
            <p className="text-sm text-[#1A1F24]">
              <span className="font-mono">{archiveTarget.code}</span> ·{' '}
              {pickName(archiveTarget.name, lang)}
            </p>
          )}
          <p className="text-sm text-[#5A646D]">{L.archiveBody}</p>
          {archive.error != null && (
            <p className="text-xs text-[#B91C1C]" role="alert" data-testid="archive-error">
              {errorText(archive.error, L.errSaveFailed)}
            </p>
          )}
        </div>
      </Modal>

      {/* --- new classifier ------------------------------------------------ */}
      <Modal
        isOpen={creatingClassifier}
        onClose={() => setCreatingClassifier(false)}
        title={L.createClassifierTitle}
        subtitle={L.createClassifierSubtitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreatingClassifier(false)}>
              {L.cancel}
            </Button>
            <Button
              variant="primary"
              isLoading={addClassifier.isPending}
              onClick={() => addClassifier.mutate()}
            >
              {L.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={L.fieldCode} required htmlFor="new-classifier-code" helperText={L.fieldCodeHint}>
            <Input
              id="new-classifier-code"
              data-testid="new-classifier-code"
              value={newClassifier.code}
              onChange={(e) => setNewClassifier((c) => ({ ...c, code: e.target.value }))}
            />
          </FormField>
          <FormField label={L.fieldNameUz} required htmlFor="new-classifier-name-uz">
            <Input
              id="new-classifier-name-uz"
              data-testid="new-classifier-name-uz"
              value={newClassifier.nameUz}
              onChange={(e) => setNewClassifier((c) => ({ ...c, nameUz: e.target.value }))}
            />
          </FormField>
          <FormField label={L.fieldNameUzCyrl} htmlFor="new-classifier-name-uz-cyrl">
            <Input
              id="new-classifier-name-uz-cyrl"
              data-testid="new-classifier-name-uz-cyrl"
              value={newClassifier.nameUzCyrl}
              onChange={(e) => setNewClassifier((c) => ({ ...c, nameUzCyrl: e.target.value }))}
            />
          </FormField>
          <FormField label={L.fieldNameRu} htmlFor="new-classifier-name-ru">
            <Input
              id="new-classifier-name-ru"
              data-testid="new-classifier-name-ru"
              value={newClassifier.nameRu}
              onChange={(e) => setNewClassifier((c) => ({ ...c, nameRu: e.target.value }))}
            />
          </FormField>
          <FormField label={L.fieldNameKaa} htmlFor="new-classifier-name-kaa">
            <Input
              id="new-classifier-name-kaa"
              data-testid="new-classifier-name-kaa"
              value={newClassifier.nameKaa}
              onChange={(e) => setNewClassifier((c) => ({ ...c, nameKaa: e.target.value }))}
            />
          </FormField>
          <FormField label={L.fieldNameEn} htmlFor="new-classifier-name-en">
            <Input
              id="new-classifier-name-en"
              data-testid="new-classifier-name-en"
              value={newClassifier.nameEn}
              onChange={(e) => setNewClassifier((c) => ({ ...c, nameEn: e.target.value }))}
            />
          </FormField>
          {addClassifier.error != null && (
            <p className="text-xs text-[#B91C1C]" role="alert" data-testid="create-classifier-error">
              {errorText(addClassifier.error, L.errSaveFailed)}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
