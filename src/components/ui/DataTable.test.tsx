import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
