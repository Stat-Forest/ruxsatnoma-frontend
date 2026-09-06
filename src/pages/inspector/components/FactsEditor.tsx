/**
 * A small dynamic label/value list editor for an act's `facts` — no
 * hardcoded livestock species or coefficients (Global Constraint 7): the
 * inspector names whatever the checklist itself does not already capture
 * (a head count, a species, a note tied to a number), free-form.
 *
 * Rows are tracked as an internal, id-keyed array rather than derived
 * straight from the `Record<string,string>` on every keystroke — two rows
 * mid-edit can carry the same (or an empty) label, which would collide as
 * object keys before the inspector finishes typing either one.
 */
import { useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useT } from '../../../i18n/useT';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/FormControls';

interface FactRow {
  id: string;
  label: string;
  value: string;
}

function factsToRows(facts: Record<string, string>): FactRow[] {
  return Object.entries(facts).map(([label, value], index) => ({ id: `row-${index}`, label, value }));
}

/** Rows with an empty label carry nothing worth sending — dropped here
 *  rather than surfacing as a stray `"": "..."` key on the wire. */
function rowsToFacts(rows: FactRow[]): Record<string, string> {
  const facts: Record<string, string> = {};
  for (const row of rows) {
    const label = row.label.trim();
    if (label) facts[label] = row.value;
  }
  return facts;
}

export interface FactsEditorProps {
  facts: Record<string, string>;
  onChange: (facts: Record<string, string>) => void;
  readOnly?: boolean;
}

export function FactsEditor({ facts, onChange, readOnly = false }: FactsEditorProps) {
  const t = useT();
  const [rows, setRows] = useState<FactRow[]>(() => factsToRows(facts));
  const rowCounter = useRef(rows.length);

  function commit(next: FactRow[]) {
    setRows(next);
    onChange(rowsToFacts(next));
  }

  function addRow() {
    rowCounter.current += 1;
    commit([...rows, { id: `row-new-${rowCounter.current}`, label: '', value: '' }]);
  }

  function removeRow(id: string) {
    commit(rows.filter((row) => row.id !== id));
  }

  function changeLabel(id: string, label: string) {
    commit(rows.map((row) => (row.id === id ? { ...row, label } : row)));
  }

  function changeValue(id: string, value: string) {
    commit(rows.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  return (
    <div className="bg-white border border-[#E4E7EA] rounded-2xl p-4 space-y-3 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#5A646D]">
        {t('inspector.actForm.facts.title')}
      </p>

      {rows.length === 0 && <p className="text-sm text-[#5A646D]">{t('inspector.actForm.facts.empty')}</p>}

      {rows.map((row) => (
        <div key={row.id} className="flex flex-col sm:flex-row gap-2">
          <Input
            touchSize
            value={row.label}
            disabled={readOnly}
            onChange={(e) => changeLabel(row.id, e.target.value)}
            placeholder={t('inspector.actForm.facts.labelPlaceholder')}
            className="sm:flex-1"
          />
          <Input
            touchSize
            value={row.value}
            disabled={readOnly}
            onChange={(e) => changeValue(row.id, e.target.value)}
            placeholder={t('inspector.actForm.facts.valuePlaceholder')}
            className="sm:flex-1"
          />
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="touch"
              aria-label={t('inspector.actForm.facts.removeRow')}
              onClick={() => removeRow(row.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={addRow}>
          {t('inspector.actForm.facts.addRow')}
        </Button>
      )}
    </div>
  );
}
