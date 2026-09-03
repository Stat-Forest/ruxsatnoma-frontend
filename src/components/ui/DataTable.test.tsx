import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: number;
  name: string;
}

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
];

const rows: Row[] = [
  { id: 1, name: 'Banana' },
  { id: 2, name: 'Apple' },
];

function nameColumnCells() {
  // One column ("Name") in the first test, two in the second — always read
  // the first cell of each row, which is always the "name" column here.
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

  // Every row's "missingField" value is undefined, so the comparator has
  // nothing comparable to sort by (isSortComparable rejects it) — clicking
  // sort must not throw and must not reorder the rows.
  expect(nameColumnCells()).toEqual(['Banana', 'Apple']);
});
