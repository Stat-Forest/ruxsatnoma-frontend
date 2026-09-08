/**
 * H-services — the `activity_types` catalog screen (rulings #138, #139, #139a;
 * `plans/07.7-services-catalog-and-ratings.md`, task 7).
 *
 * **The catalog is fixed by law: `PATCH` only, no add, no delete (#139).**
 * The six forest-use activities are set by statute and their `code`s are what
 * the tariffs and the price calculator resolve by
 * (`norms.service._resolve_activity_code`) — a seventh row with no tariff
 * would break the calculator for everyone, silently. So this screen offers
 * exactly two actions per row: edit its presentation (name, description,
 * processing term), or switch it off. Nothing here can create or remove a
 * row.
 *
 * **`GET /refs/activity-types` returns ACTIVE rows only** (`admin/repo.py`'s
 * `list_activity_types`) — the very same filter that feeds the public
 * landing (`GET /public/refs/activity-types`) and the application wizard
 * (this same route, called with a citizen's session). Archiving a row here
 * does not delete it; it just stops matching that filter, so it vanishes
 * from THIS screen's own list on the next refetch too — never shown here as
 * a greyed-out "archived" row, because the read this screen uses cannot see
 * one. That is why the confirm dialog (`archiveBody` below) says plainly
 * that the service closes everywhere — the landing, the calculator AND new
 * applications — rather than letting the switch read as "hide from the
 * landing only".
 *
 * **`description` may be `null`** (`deadwood`/`science` — the landing never
 * had copy for them, decision behind ruling #138). Rendered as an explicit
 * "not filled in" placeholder, never a crash and never an invented sentence.
 *
 * **Every `LocalizedName`-shaped field the backend accepts requires a
 * non-blank `uz_latn`** (decision #90; `app/core/schemas.py::LocalizedName`).
 * The backend's own 422 for this renders through `useApiErrorText` as the
 * generic `ERR-VAL-001` sentence ("data validation failed"), which does not
 * name the offending field — so this screen checks `uz_latn` itself before
 * ever sending the request (the same pattern
 * `AnnouncementFormModal.tsx::submit` already uses for its own title/body).
 *
 * **Card list, not `DataTable`**: a description can run to a full sentence
 * (see the fixtures in the test file) that no table cell holds gracefully —
 * the same reasoning `ClassifiersPage.tsx` gives for its own layout.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Switch, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useLanguage, useT } from '../../../i18n/useT';
import { pickName } from '../../applicant/format';
import { listActivityTypes, updateActivityType, type ActivityTypeOut, type ActivityTypePatch } from './api';

const QUERY_KEY = ['admin', 'activity-types'];

interface EditForm {
  nameUz: string;
  nameRu: string;
  descUz: string;
  descRu: string;
  processingDays: string;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function formFromRow(row: ActivityTypeOut): EditForm {
  const name = row.name as Record<string, unknown>;
  const description = (row.description ?? {}) as Record<string, unknown>;
  return {
    nameUz: asString(name.uz_latn),
    nameRu: asString(name.ru),
    descUz: asString(description.uz_latn),
    descRu: asString(description.ru),
    processingDays: String(row.processing_days),
  };
}

/**
 * The dialog's Save button turns a form into a `PATCH` body, or refuses with
 * a translated message when a `LocalizedName` field would be sent without
 * `uz_latn` (decision #90) or the term is not a positive integer.
 * `sort_order` is never touched: `ActivityTypeOut` does not even expose it to
 * read back, so this dialog has no correct value to resend.
 *
 * **`name`/`description` are MERGED over the row's existing object, never
 * rebuilt from the dialog's two fields.** The backend replaces the JSONB
 * column whole (`activity_type.name = patch.name.root`) — it does not merge —
 * and the seeded rows carry `uz_cyrl`/`en` alongside `uz_latn`, with no `ru`
 * at all. Rebuilding `{uz_latn, ru}` from scratch, as this used to do, sent
 * that `uz_cyrl`/`en` to oblivion on the very first save of any field, even
 * just the term. That is severe rather than cosmetic: the permit DOCUMENT
 * prints in `uz_cyrl` (`permits/service.py`'s `DOCUMENT_LANGUAGE`) with no
 * fallback, so the next citizen issued a permit for that activity gets a
 * bare `ERR-VAL-001 missing_requisite` pointing nowhere near the catalog
 * edit that caused it. `ru` distinguishes three states rather than a bare
 * truthiness check on the dialog's field: non-blank writes it; blank AND the
 * row never had one leaves the spread-in absence alone (no key, same as
 * before); but blank where the row DID have a `ru` value means the
 * administrator just cleared it, and the key is deleted from the merged
 * object rather than left at the old value the spread put there — a
 * truthiness guard alone cannot tell "cleared" from "was never set", and
 * silently kept the stale value in the former case.
 *
 * `description` is genuinely nullable and the one field this dialog can
 * explicitly clear: both description fields left blank sends `null` when
 * the row had a description, so a clear actually reaches the backend rather
 * than silently doing nothing while the toast still says success. A row that
 * already had no description (deadwood, science) and stays untouched omits
 * the key rather than patching to `null` for no reason.
 */
function buildPatch(
  row: ActivityTypeOut,
  form: EditForm,
  t: (key: string) => string,
): { patch: ActivityTypePatch } | { error: string } {
  const nameUz = form.nameUz.trim();
  const nameRu = form.nameRu.trim();
  const descUz = form.descUz.trim();
  const descRu = form.descRu.trim();

  if (!nameUz) return { error: t('activityTypes.errNameRequiresUzLatn') };
  if ((descUz || descRu) && !descUz) return { error: t('activityTypes.errDescriptionRequiresUzLatn') };

  const days = Number(form.processingDays);
  if (!Number.isInteger(days) || days <= 0) return { error: t('activityTypes.errProcessingDays') };

  const existingName = row.name as Record<string, string>;
  const name: Record<string, string> = { ...existingName, uz_latn: nameUz };
  if (nameRu) {
    name.ru = nameRu;
  } else if (existingName.ru) {
    // The field was pre-filled and the administrator blanked it — remove
    // the key rather than leave the spread-in old value standing (never
    // write `ru: ''`, which would satisfy a "key present" check while
    // being blank).
    delete name.ru;
  }

  const patch: ActivityTypePatch = {
    name,
    processing_days: days,
  };

  const existingDescription = (row.description ?? {}) as Record<string, string>;
  if (descUz) {
    const description: Record<string, string> = { ...existingDescription, uz_latn: descUz };
    if (descRu) {
      description.ru = descRu;
    } else if (existingDescription.ru) {
      // Same "cleared vs. never set" distinction as `name.ru` above.
      delete description.ru;
    }
    patch.description = description;
  } else if (row.description) {
    // Both fields were cleared and the row did have a description before —
    // send an explicit `null` so the clear actually takes effect.
    patch.description = null;
  }
  return { patch };
}

export function ActivityTypesPage() {
  const t = useT();
  const { lang } = useLanguage();
  const errorText = useApiErrorText();
  const queryClient = useQueryClient();

  const [archiving, setArchiving] = useState<ActivityTypeOut | null>(null);
  const [editing, setEditing] = useState<ActivityTypeOut | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const list = useQuery({ queryKey: QUERY_KEY, queryFn: listActivityTypes });

  const archive = useMutation({
    mutationFn: (id: string) => updateActivityType(id, { status: 'archived' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setArchiving(null);
    },
  });

  const save = useMutation({
    mutationFn: (vars: { id: string; patch: ActivityTypePatch }) => updateActivityType(vars.id, vars.patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      closeEdit();
    },
  });

  function openEdit(row: ActivityTypeOut) {
    setEditing(row);
    setForm(formFromRow(row));
    setValidationError(null);
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
    setValidationError(null);
    save.reset();
  }

  function submitEdit() {
    if (!editing || !form) return;
    const result = buildPatch(editing, form, t);
    if ('error' in result) {
      setValidationError(result.error);
      return;
    }
    setValidationError(null);
    save.mutate({ id: editing.id, patch: result.patch });
  }

  const rows = list.data ?? [];

  return (
    <div className="space-y-6 font-sans pb-16" data-testid="activity-types-page">
      <div className="border-b border-[#E4E7EA] pb-4">
        <h1 className="text-lg md:text-xl font-bold text-[#1A1F24] tracking-tight">
          {t('activityTypes.title')}
        </h1>
        <p className="text-xs md:text-sm text-[#5A646D] mt-1 max-w-2xl">{t('activityTypes.subtitle')}</p>
      </div>

      {list.error && (
        <div
          role="alert"
          data-testid="activity-types-error"
          className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl text-sm text-[#991B1B]"
        >
          {errorText(list.error, t('activityTypes.loadError'))}
        </div>
      )}

      {list.isLoading ? (
        <p className="py-10 text-center text-sm text-[#5A646D]">{t('activityTypes.loading')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const name = pickName(row.name, lang);
            const description = row.description ? pickName(row.description, lang) : '';
            return (
              <li
                key={row.id}
                data-testid={`activity-row-${row.code}`}
                className="rounded-2xl border border-[#E4E7EA] bg-white p-4 flex flex-wrap items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-[220px]">
                  <Switch
                    checked
                    onChange={(checked) => {
                      // The list only ever contains active rows, so `checked`
                      // is always true on arrival — the only real transition
                      // this handler ever sees is a click turning it off.
                      if (!checked) setArchiving(row);
                    }}
                    label={name}
                    data-testid={`activity-switch-${row.code}`}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <p className={`text-sm ${description ? 'text-[#1A1F24]' : 'text-[#9AA3AB] italic'}`}>
                    {description || t('activityTypes.descriptionEmpty')}
                  </p>
                  <p className="text-xs text-[#5A646D] mt-1">
                    {t('activityTypes.termLabel')}: {row.processing_days} {t('activityTypes.termDays')}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Pencil className="w-3.5 h-3.5" />}
                  onClick={() => openEdit(row)}
                  aria-label={`${t('activityTypes.actionEdit')}: ${name}`}
                  data-testid={`activity-edit-${row.code}`}
                >
                  {t('activityTypes.actionEdit')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {archiving && (
        <Modal
          isOpen
          onClose={() => setArchiving(null)}
          title={t('activityTypes.archiveTitle')}
          subtitle={pickName(archiving.name, lang)}
          footer={
            <>
              <Button variant="secondary" size="sm" onClick={() => setArchiving(null)} data-testid="archive-cancel">
                {t('activityTypes.archiveCancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={archive.isPending}
                onClick={() => archive.mutate(archiving.id)}
                data-testid="archive-confirm"
              >
                {t('activityTypes.archiveConfirm')}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p>{t('activityTypes.archiveBody')}</p>
            {archive.error && (
              <p role="alert" className="text-xs text-[#B91C1C]" data-testid="archive-error">
                {archive.error instanceof ApiError ? errorText(archive.error) : t('activityTypes.archiveError')}
              </p>
            )}
          </div>
        </Modal>
      )}

      {editing && form && (
        <Modal isOpen onClose={closeEdit} title={t('activityTypes.editTitle')} maxWidth="lg">
          <div className="space-y-4">
            {(validationError || save.error) && (
              <p
                role="alert"
                data-testid="activity-edit-error"
                className="text-xs text-[#B91C1C] p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5]"
              >
                {validationError ??
                  (save.error instanceof ApiError ? errorText(save.error) : t('activityTypes.saveError'))}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('activityTypes.fieldNameUz')} htmlFor="activity-name-uz" required>
                <Input
                  id="activity-name-uz"
                  value={form.nameUz}
                  onChange={(e) => setForm((f) => (f ? { ...f, nameUz: e.target.value } : f))}
                />
              </FormField>
              <FormField label={t('activityTypes.fieldNameRu')} htmlFor="activity-name-ru">
                <Input
                  id="activity-name-ru"
                  value={form.nameRu}
                  onChange={(e) => setForm((f) => (f ? { ...f, nameRu: e.target.value } : f))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label={t('activityTypes.fieldDescriptionUz')} htmlFor="activity-desc-uz">
                <Textarea
                  id="activity-desc-uz"
                  value={form.descUz}
                  onChange={(e) => setForm((f) => (f ? { ...f, descUz: e.target.value } : f))}
                />
              </FormField>
              <FormField label={t('activityTypes.fieldDescriptionRu')} htmlFor="activity-desc-ru">
                <Textarea
                  id="activity-desc-ru"
                  value={form.descRu}
                  onChange={(e) => setForm((f) => (f ? { ...f, descRu: e.target.value } : f))}
                />
              </FormField>
            </div>

            <FormField label={t('activityTypes.fieldProcessingDays')} htmlFor="activity-days">
              <Input
                id="activity-days"
                type="number"
                min={1}
                value={form.processingDays}
                onChange={(e) => setForm((f) => (f ? { ...f, processingDays: e.target.value } : f))}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={closeEdit} data-testid="edit-cancel">
                {t('activityTypes.cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={save.isPending}
                onClick={submitEdit}
                data-testid="edit-save"
              >
                {t('activityTypes.save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
