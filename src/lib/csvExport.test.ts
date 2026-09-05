/**
 * I1's export helpers. Three things they must not get wrong:
 *   1. a field containing a comma, quote or newline is RFC-4180 quoted;
 *   2. `fetchAllPages` stops at the server's own total, never fetches one
 *      page past it;
 *   3. `fetchAllPages` is BOUNDED — a runaway total does not hang forever,
 *      and says so via `truncated` rather than pretending the file is whole.
 */
import { fetchAllPages, toCsv } from './csvExport';

interface Row {
  id: string;
  name: string;
}

test('a field with a comma, a quote or a newline is quoted per RFC 4180', () => {
  const csv = toCsv<Row>(
    [
      { id: '1', name: 'Karimov, A.' },
      { id: '2', name: 'Has "quotes"' },
      { id: '3', name: 'Two\nlines' },
    ],
    [
      { header: 'id', value: (r) => r.id },
      { header: 'name', value: (r) => r.name },
    ],
  );
  const lines = csv.replace('﻿', '').split('\r\n');
  expect(lines[1]).toBe('1,"Karimov, A."');
  expect(lines[2]).toBe('2,"Has ""quotes"""');
  expect(lines[3]).toBe('3,"Two\nlines"');
});

test('fetchAllPages stops exactly at the reported total, across several pages', async () => {
  const allRows = Array.from({ length: 250 }, (_, i) => ({ id: String(i) }));
  let calls = 0;
  const { rows, truncated } = await fetchAllPages(async (page, pageSize) => {
    calls += 1;
    const start = (page - 1) * pageSize;
    return { items: allRows.slice(start, start + pageSize), total: allRows.length };
  });
  expect(rows).toHaveLength(250);
  expect(truncated).toBe(false);
  expect(calls).toBe(3); // 100 + 100 + 50
});

test('a total past the bound is truncated, not fetched forever', async () => {
  const { rows, truncated } = await fetchAllPages(async (page, pageSize) => ({
    items: Array.from({ length: pageSize }, (_, i) => ({ id: `${page}-${i}` })),
    total: 1_000_000,
  }));
  expect(rows).toHaveLength(2000); // 20 pages * 100
  expect(truncated).toBe(true);
});
