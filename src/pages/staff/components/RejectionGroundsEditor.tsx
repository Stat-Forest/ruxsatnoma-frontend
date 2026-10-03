import { Button } from '../../../components/ui/button';
import { FormField, Select, Textarea, Input } from '../../../components/ui/FormControls';
import { useLanguage } from '../../../i18n/useT';
import { localizedName } from '../format';
import { emptyGround, GROUND_LABELS, MAX_GROUNDS, type GroundDraft } from '../groundDraft';
import type { components } from '../../../api/schema';

// `emptyGround`/`groundComplete`/`GroundDraft` live in `../groundDraft.ts`
// (a plain `.ts` file, not `.tsx`) and are NOT re-exported from here: a
// `.tsx` file that exports anything besides components — even a re-export —
// trips `react-refresh/only-export-components` (the same reason
// `applicant/wizard/OccupancyCalendar.tsx` keeps its own helpers in
// `seasonCalendar.ts` instead). Every consumer, including this component's
// own test, imports those three straight from `../groundDraft`.

type Reason = components['schemas']['ClassifierItemOut'];
const REJECTABLE = new Set(['reject', 'both']);

// `ground`/`fact`/`legal_document`/`legal_clause`/`evidence`/`remedy` come
// from `GROUND_LABELS` (`../groundDraft`) — shared with `SignDecisionModal`'s
// G1 unrenderable-character breakdown, so the two can never name the same
// field two different ways. Only the strings unique to this editor
// (`code`/`add`/`remove`/`select`) live here.
const I18N = {
  uz_latn: {
    ...GROUND_LABELS.uz_latn,
    code: 'Rad etish toifasi',
    add: '+ Sabab qoʻshish',
    remove: 'Oʻchirish',
    select: 'Tanlang',
  },
  uz_cyrl: {
    ...GROUND_LABELS.uz_cyrl,
    code: 'Рад этиш тоифаси',
    add: '+ Сабаб қўшиш',
    remove: 'Ўчириш',
    select: 'Танланг',
  },
  ru: {
    ...GROUND_LABELS.ru,
    code: 'Категория отказа',
    add: '+ Добавить причину',
    remove: 'Удалить',
    select: 'Выберите',
  },
  en: {
    ...GROUND_LABELS.en,
    code: 'Rejection category',
    add: '+ Add ground',
    remove: 'Remove',
    select: 'Select',
  },
  kaa: {
    ...GROUND_LABELS.kaa,
    code: 'Biykar etiw túri',
    add: '+ Sebep qosıw',
    remove: 'Óshiriw',
    select: 'Saylań',
  },
};

export function RejectionGroundsEditor({ value, onChange, reasons }: {
  value: GroundDraft[]; onChange: (next: GroundDraft[]) => void; reasons: Reason[];
}) {
  const { lang } = useLanguage();
  const t = I18N[lang as keyof typeof I18N] ?? I18N.uz_latn;
  const options = reasons.filter((r) => REJECTABLE.has(String((r.props as Record<string, unknown>)?.kind)));

  function patch(index: number, change: Partial<GroundDraft>) {
    onChange(value.map((g, i) => (i === index ? { ...g, ...change } : g)));
  }

  // G2 (fix wave): a code change must not strand the PREVIOUS code's own
  // default in a field the head never touched. The field is replaced when
  // it is empty OR still equals the previous code's default; a value the
  // head actually typed — including one that happens to equal neither
  // default — is always kept.
  function pickCode(index: number, id: string) {
    const reason = options.find((r) => r.id === id);
    const basis = String((reason?.props as Record<string, unknown>)?.legal_basis ?? '');
    const current = value[index];
    const previousReason = options.find((r) => r.id === current.reason_item_id);
    const previousBasis = String((previousReason?.props as Record<string, unknown>)?.legal_basis ?? '');
    const shouldReplace = current.legal_document.trim() === '' || current.legal_document === previousBasis;
    patch(index, {
      reason_item_id: id,
      legal_document: shouldReplace ? basis : current.legal_document,
    });
  }

  return (
    <div className="space-y-4">
      {value.map((g, index) => (
        <fieldset key={index} className="border border-[#E4E7EA] rounded-xl p-3 space-y-3">
          <legend className="px-1 text-xs font-bold text-[#1A1F24]">{t.ground.replace('{n}', String(index + 1))}</legend>
          <FormField label={t.code} required>
            <Select
              value={g.reason_item_id}
              onChange={(e) => pickCode(index, e.target.value)}
              options={[
                { value: '', label: t.select },
                ...options.map((r) => ({ value: r.id, label: `${r.code} — ${localizedName(r.name, lang) || r.code}` })),
              ]}
            />
          </FormField>
          <FormField label={t.fact} required>
            <Textarea value={g.fact} maxLength={2000} onChange={(e) => patch(index, { fact: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            <FormField label={t.legal_document} required>
              <Input value={g.legal_document} maxLength={300} onChange={(e) => patch(index, { legal_document: e.target.value })} />
            </FormField>
            <FormField label={t.legal_clause} required>
              <Input value={g.legal_clause} maxLength={100} onChange={(e) => patch(index, { legal_clause: e.target.value })} />
            </FormField>
          </div>
          <FormField label={t.evidence} required>
            <Textarea value={g.evidence} maxLength={2000} onChange={(e) => patch(index, { evidence: e.target.value })} />
          </FormField>
          <FormField label={t.remedy} required>
            <Textarea value={g.remedy} maxLength={2000} onChange={(e) => patch(index, { remedy: e.target.value })} />
          </FormField>
          {value.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              {t.remove}
            </Button>
          )}
        </fieldset>
      ))}
      {value.length < MAX_GROUNDS && (
        <Button variant="outline" size="sm" onClick={() => onChange([...value, emptyGround()])}>
          {t.add}
        </Button>
      )}
    </div>
  );
}
