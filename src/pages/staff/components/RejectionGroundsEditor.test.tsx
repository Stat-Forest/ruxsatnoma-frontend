import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { RejectionGroundsEditor } from './RejectionGroundsEditor';
import { emptyGround, groundComplete, type GroundDraft } from '../groundDraft';

const reasons = [
  { id: 'r1', code: 'R01', name: { uz_latn: 'Maʼlumot toʻliq emas' }, props: { kind: 'reject', legal_basis: '' }, valid_from: '2026-09-24', valid_to: null, status: 'active' },
  { id: 'r4', code: 'R04', name: { uz_latn: 'Yaylov normasi' }, props: { kind: 'reject', legal_basis: 'VMQ 689 (19.08.2019), 1-ilova' }, valid_from: '2026-09-24', valid_to: null, status: 'active' },
  { id: 'rj1', code: 'RJ-01', name: { uz_latn: 'Qaytarish' }, props: { kind: 'return' }, valid_from: '2026-01-01', valid_to: null, status: 'active' },
];

function Harness({ onChange }: { onChange?: (g: GroundDraft[]) => void }) {
  const [value, setValue] = useState<GroundDraft[]>([emptyGround()]);
  return (
    <RejectionGroundsEditor
      value={value}
      reasons={reasons}
      onChange={(next) => { setValue(next); onChange?.(next); }}
    />
  );
}

describe('RejectionGroundsEditor', () => {
  it('offers refusal codes only', () => {
    render(<Harness />);
    const select = screen.getAllByRole('combobox')[0];
    const labels = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
    expect(labels.some((l) => l?.includes('R04'))).toBe(true);
    expect(labels.some((l) => l?.includes('RJ-01'))).toBe(false);
  });

  it('prefills the legal document from the code when the field is empty', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'r4' } });
    expect(onChange.mock.lastCall![0][0].legal_document).toBe('VMQ 689 (19.08.2019), 1-ilova');
  });

  it('adds and removes grounds but never removes the last one', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: /oʻchirish|удалить|remove/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /sabab qoʻshish|добавить|add/i }));
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: /oʻchirish|удалить|remove/i })[0]);
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('calls a ground complete only when every field has text', () => {
    const g = { reason_item_id: 'r1', fact: 'a', legal_document: 'b', legal_clause: 'c', evidence: 'd', remedy: 'e' };
    expect(groundComplete(g)).toBe(true);
    expect(groundComplete({ ...g, remedy: '   ' })).toBe(false);
  });
});
