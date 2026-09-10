/**
 * Create/edit modal for one FAQ entry. Unlike `AnnouncementFormModal`, this
 * needs no separate "load by id" query — `admin_router.py` has no
 * `GET /admin/help/faq/{id}` route at all, only list/create/patch — so the
 * row being edited is the very row `FaqAdminTab` already holds from its own
 * list fetch, passed straight in as a prop.
 *
 * Required language: `uz_cyrl` (Uzbek Cyrillic), NOT `uz_latn` — read
 * directly off `backend/app/core/schemas.py::LocalizedName`'s own validator
 * (`self.root.get("uz_cyrl", "").strip()`) and `docs/decisions.md` #13. The
 * already-merged announcements screen requires `uz_latn` instead; that looks
 * like a bug in a different track's file, not a pattern to copy here.
 */
import { useState } from 'react';
import { Modal } from '../../../components/ui/Overlay';
import { Button } from '../../../components/ui/button';
import { FormField, Input, Select, Textarea } from '../../../components/ui/FormControls';
import { ApiError } from '../../../api/errors';
import { useApiErrorText } from '../../../i18n/useApiErrorText';
import { useT } from '../../../i18n/useT';
import type { FaqOut, FaqStatus } from './api';
import { useCreateFaq, usePatchFaq } from './queries';

/** The five codes the contract enumerates (`LanguageIn.language`), in the
 *  same order `src/i18n/context.ts::LANGUAGES` offers them. `uz_cyrl` leads
 *  here — unlike announcements' own `uz_latn`-first list — because it is the
 *  one language this form actually requires. */
const FAQ_LANGUAGES = ['uz_cyrl', 'uz_latn', 'ru', 'kaa', 'en'] as const;
type FaqLanguage = (typeof FAQ_LANGUAGES)[number];

const LANGUAGE_LABEL_KEY: Record<FaqLanguage, string> = {
  uz_cyrl: 'support.faq.admin.langUzCyrl',
  uz_latn: 'support.faq.admin.langUzLatn',
  ru: 'support.faq.admin.langRu',
  kaa: 'support.faq.admin.langKaa',
  en: 'support.faq.admin.langEn',
};

const FAQ_STATUSES: FaqStatus[] = ['draft', 'published', 'archived'];
const STATUS_LABEL_KEY: Record<FaqStatus, string> = {
  draft: 'support.faq.admin.statusDraft',
  published: 'support.faq.admin.statusPublished',
  archived: 'support.faq.admin.statusArchived',
};

interface FormState {
  category: string;
  question: Record<FaqLanguage, string>;
  answer: Record<FaqLanguage, string>;
  sortOrder: string;
  status: FaqStatus;
}

function emptyLanguages(): Record<FaqLanguage, string> {
  return { uz_cyrl: '', uz_latn: '', ru: '', kaa: '', en: '' };
}

/** A `LocalizedName` off the backend is a validated `{[lang]: string}` map,
 *  but still read defensively here — a non-string value is treated as
 *  absent, never rendered into a textarea as `[object Object]`. */
function readLanguages(source: Record<string, unknown>): Record<FaqLanguage, string> {
  const out = emptyLanguages();
  for (const code of FAQ_LANGUAGES) {
    const value = source[code];
    if (typeof value === 'string') out[code] = value;
  }
  return out;
}

function formFrom(row: FaqOut): FormState {
  return {
    category: row.category ?? '',
    question: readLanguages(row.question),
    answer: readLanguages(row.answer),
    sortOrder: String(row.sort_order),
    status: isFaqStatus(row.status) ? row.status : 'draft',
  };
}

function emptyForm(): FormState {
  return { category: '', question: emptyLanguages(), answer: emptyLanguages(), sortOrder: '0', status: 'draft' };
}

function isFaqStatus(value: string): value is FaqStatus {
  return FAQ_STATUSES.includes(value as FaqStatus);
}

/** Only the languages somebody actually typed into — an empty string sent as
 *  `{"kaa": ""}` would be a Karakalpak answer that is blank, not an absent
 *  translation (same reasoning `AnnouncementFormModal::localized` gives). */
function localized(values: Record<FaqLanguage, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const code of FAQ_LANGUAGES) {
    const value = values[code].trim();
    if (value) out[code] = value;
  }
  return out;
}

export interface FaqFormModalProps {
  /** `null` — a new entry; a row — that entry, editing in place. */
  faq: FaqOut | null;
  onClose: () => void;
}

export function FaqFormModal({ faq, onClose }: FaqFormModalProps) {
  const t = useT();
  const toErrorText = useApiErrorText();
  const isEdit = faq !== null;
  const create = useCreateFaq();
  const patch = usePatchFaq();

  const [form, setForm] = useState<FormState>(faq ? formFrom(faq) : emptyForm());
  const [validationError, setValidationError] = useState<string | null>(null);

  const pending = create.isPending || patch.isPending;
  const failure = create.error ?? patch.error;
  const errorText =
    validationError ??
    (failure instanceof ApiError
      ? toErrorText(failure)
      : failure
        ? (failure as Error).message
        : null);

  function setQuestion(code: FaqLanguage, value: string) {
    setForm((f) => ({ ...f, question: { ...f.question, [code]: value } }));
  }

  function setAnswer(code: FaqLanguage, value: string) {
    setForm((f) => ({ ...f, answer: { ...f.answer, [code]: value } }));
  }

  function submit() {
    const question = localized(form.question);
    const answer = localized(form.answer);
    // Mirrors the backend's own `LocalizedName` validator (`uz_cyrl`
    // non-blank) so the operator gets an immediate message instead of a raw
    // 422 from the server.
    if (!question.uz_cyrl || !answer.uz_cyrl) {
      setValidationError(t('support.faq.admin.formRequired'));
      return;
    }
    setValidationError(null);
    const sortOrder = Number.parseInt(form.sortOrder, 10) || 0;

    if (isEdit) {
      patch.mutate(
        {
          faqId: faq.id,
          body: {
            category: form.category.trim() || null,
            question,
            answer,
            sort_order: sortOrder,
            status: form.status,
          },
        },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(
        {
          category: form.category.trim() || null,
          question,
          answer,
          sort_order: sortOrder,
        },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? t('support.faq.admin.formEditTitle') : t('support.faq.admin.formCreateTitle')}
      subtitle={t('support.faq.admin.formLangHint')}
      maxWidth="2xl"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            {t('support.common.cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={submit} isLoading={pending} className="w-full sm:w-auto">
            {t('support.common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {errorText && (
          <div
            data-testid="faq-form-error"
            role="alert"
            className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]"
          >
            {errorText}
          </div>
        )}

        <FormField
          label={t('support.faq.admin.formCategory')}
          htmlFor="faq-form-category"
          helperText={t('support.faq.admin.formCategoryHint')}
        >
          <Input
            id="faq-form-category"
            data-testid="faq-form-category"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            maxLength={100}
          />
        </FormField>

        {FAQ_LANGUAGES.map((code) => {
          const languageName = t(LANGUAGE_LABEL_KEY[code]);
          const required = code === 'uz_cyrl';
          return (
            <div
              key={code}
              className={`rounded-2xl border p-4 space-y-3 ${
                required ? 'border-[#2E7D4F]/40 bg-[#F0F7F1]' : 'border-[#E4E7EA] bg-white'
              }`}
            >
              <FormField label={`${t('support.faq.admin.formQuestion')} — ${languageName}`} htmlFor={`faq-question-${code}`} required={required}>
                <Textarea
                  id={`faq-question-${code}`}
                  data-testid={`faq-question-${code}`}
                  value={form.question[code]}
                  onChange={(e) => setQuestion(code, e.target.value)}
                />
              </FormField>
              <FormField label={`${t('support.faq.admin.formAnswer')} — ${languageName}`} htmlFor={`faq-answer-${code}`} required={required}>
                <Textarea
                  id={`faq-answer-${code}`}
                  data-testid={`faq-answer-${code}`}
                  value={form.answer[code]}
                  onChange={(e) => setAnswer(code, e.target.value)}
                />
              </FormField>
            </div>
          );
        })}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label={t('support.faq.admin.formSortOrder')} htmlFor="faq-form-sort-order">
            <Input
              id="faq-form-sort-order"
              data-testid="faq-form-sort-order"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
          </FormField>

          {isEdit && (
            <FormField label={t('support.faq.admin.formStatus')} htmlFor="faq-form-status">
              <Select
                id="faq-form-status"
                data-testid="faq-form-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FaqStatus }))}
                options={FAQ_STATUSES.map((status) => ({ value: status, label: t(STATUS_LABEL_KEY[status]) }))}
              />
            </FormField>
          )}
        </div>
      </div>
    </Modal>
  );
}
