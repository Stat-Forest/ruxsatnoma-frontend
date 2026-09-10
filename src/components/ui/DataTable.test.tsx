import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: number;
  name: string;
  tags: string[];
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
];

const rows: Row[] = [
  { id: 1, name: 'Banana', tags: ['fruit', 'yellow'] },
  { id: 2, name: 'Apple', tags: ['fruit', 'red'] },
];

function nameColumnCells() {
  // Always read the first <td> of each row, which is always the "name"
  // column in every test below regardless of how many other columns exist.
  return screen.getAllByRole('row').slice(1).map((row) => row.querySelectorAll('td')[0]?.textContent);
}

test('sorting a real string column orders rows correctly (type-safe comparator)', async () => {
  const user = userEvent.setup();
  render(<DataTable columns={columns} data={rows} />);

  expect(nameColumnCells()).toEqual(['Banana', 'Apple']);

  await user.click(screen.getByRole('button', { name: /Name/i }));
  expect(nameColumnCells()).toEqual(['Apple', 'Banana']);

  await user.click(screen.getByRole('button', { name: /Name/i }));
  expect(nameColumnCells()).toEqual(['Banana', 'Apple']);
});

test('sorting by a key absent from the row type does not crash and leaves row order unchanged', async () => {
  const user = userEvent.setup();
  const badColumns: Column<Row>[] = [
    { key: 'name', header: 'Name' },
    { key: 'missingField', header: 'Missing', sortable: true },
  ];
  render(<DataTable columns={badColumns} data={rows} />);

  await user.click(screen.getByRole('button', { name: /Missing/i }));

  // Every row's "missingField" value is undefined, so the pre-existing
  // `valA == null` guard (not isSortComparable) short-circuits the
  // comparator before it ever reaches the type-narrowing branch — clicking
  // sort must not throw and must not reorder the rows. This test does not
  // exercise isSortComparable; the next one does.
  expect(nameColumnCells()).toEqual(['Banana', 'Apple']);
});

test('sorting by a non-null, non-primitive value does not reorder rows (isSortComparable rejects it)', async () => {
  const user = userEvent.setup();
  const arrayColumns: Column<Row>[] = [
    { key: 'name', header: 'Name' },
    { key: 'tags', header: 'Tags', sortable: true, accessor: (row) => row.tags },
  ];
  render(<DataTable columns={arrayColumns} data={rows} />);

  // Both rows' "tags" accessor returns a non-null array — it passes the
  // `== null` guard, so this reaches isSortComparable, which must reject a
  // non-string/number/boolean value and leave the rows in their original
  // order. Without the guard, `<`/`>` would coerce the arrays to strings
  // ("fruit,yellow" vs "fruit,red") and swap Banana and Apple.
  await user.click(screen.getByRole('button', { name: /Tags/i }));
  expect(nameColumnCells()).toEqual(['Banana', 'Apple']);
});

test('onRowClick opens the row from any cell but leaves the row\'s own controls alone', async () => {
  const user = userEvent.setup();
  const onRowClick = vi.fn();
  const onAction = vi.fn();
  render(
    <DataTable
      columns={columns}
      data={rows}
      selectable
      onRowClick={onRowClick}
      actions={(row) => (
        <button type="button" onClick={() => onAction(row.id)}>
          act
        </button>
      )}
    />,
  );

  await user.click(screen.getByText('Banana'));
  expect(onRowClick).toHaveBeenCalledWith(rows[0]);

  await user.click(screen.getAllByRole('button', { name: 'act' })[1]);
  expect(onAction).toHaveBeenCalledWith(2);
  await user.click(screen.getAllByRole('checkbox')[2]);
  expect(onRowClick).toHaveBeenCalledTimes(1);
});

test('without onRowClick a row is neither focusable nor a pointer target', () => {
  render(<DataTable columns={columns} data={rows} />);
  const row = screen.getAllByRole('row')[1];
  expect(row).not.toHaveAttribute('tabindex');
  expect(row.className).not.toContain('cursor-pointer');
});

test('rowClickable turns the row click off per row, leaving that row plain', async () => {
  const user = userEvent.setup();
  const onRowClick = vi.fn();
  render(<DataTable columns={columns} data={rows} onRowClick={onRowClick} rowClickable={(row) => row.id === 1} />);

  await user.click(screen.getByText('Apple'));
  expect(onRowClick).not.toHaveBeenCalled();
  expect(screen.getByText('Apple').closest('tr')).not.toHaveAttribute('tabindex');

  await user.click(screen.getByText('Banana'));
  expect(onRowClick).toHaveBeenCalledWith(rows[0]);
});
