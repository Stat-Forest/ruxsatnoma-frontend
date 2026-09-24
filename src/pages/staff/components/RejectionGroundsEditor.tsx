import { Button } from '../../../components/ui/button';
import { FormField, Select, Textarea, Input } from '../../../components/ui/FormControls';
import { useLanguage } from '../../../i18n/useT';
import { localizedName } from '../format';
import { emptyGround, MAX_GROUNDS, type GroundDraft } from '../groundDraft';
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

const I18N = {
  uz_latn: {
    ground: 'Sabab {n}',
    code: 'Rad etish toifasi',
    fact: 'Aniqlangan holat',
    legalDocument: 'Hujjat nomi',
    legalClause: 'Band yoki modda',
    evidence: 'Dalil va manba',
    remedy: 'Bartaraf etish tartibi',
    add: '+ Sabab qoʻshish',
    remove: 'Oʻchirish',
    select: 'Tanlang',
  },
  uz_cyrl: {
    ground: 'Сабаб {n}',
    code: 'Рад этиш тоифаси',
    fact: 'Аниқланган ҳолат',
    legalDocument: 'Ҳужжат номи',
    legalClause: 'Банд ёки модда',
    evidence: 'Далил ва манба',
    remedy: 'Бартараф этиш тартиби',
    add: '+ Сабаб қўшиш',
    remove: 'Ўчириш',
    select: 'Танланг',
  },
  ru: {
    ground: 'Причина {n}',
    code: 'Категория отказа',
    fact: 'Установленное обстоятельство',
    legalDocument: 'Нормативный документ',
    legalClause: 'Пункт или статья',
    evidence: 'Доказательство и источник',
    remedy: 'Порядок устранения',
    add: '+ Добавить причину',
    remove: 'Удалить',
    select: 'Выберите',
  },
  en: {
    ground: 'Ground {n}',
    code: 'Rejection category',
    fact: 'Fact established',
    legalDocument: 'Legal document',
    legalClause: 'Clause or article',
    evidence: 'Evidence and source',
    remedy: 'How to remedy',
    add: '+ Add ground',
    remove: 'Remove',
    select: 'Select',
  },
  kaa: {
    ground: 'Sebep {n}',
    code: 'Biykar etiw túri',
    fact: 'Anıqlanǵan jaǵday',
    legalDocument: 'Hújjet atı',
    legalClause: 'Bánt yamasa statya',
    evidence: 'Dálil hám derek',
    remedy: 'Saplastırıw tártibi',
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

  function pickCode(index: number, id: string) {
    const reason = options.find((r) => r.id === id);
    const basis = String((reason?.props as Record<string, unknown>)?.legal_basis ?? '');
    const current = value[index];
    patch(index, {
      reason_item_id: id,
      legal_document: current.legal_document.trim() === '' ? basis : current.legal_document,
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
            <FormField label={t.legalDocument} required>
              <Input value={g.legal_document} maxLength={300} onChange={(e) => patch(index, { legal_document: e.target.value })} />
            </FormField>
            <FormField label={t.legalClause} required>
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
