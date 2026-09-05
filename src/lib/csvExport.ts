/**
 * A generic CSV export for a register screen — I1's own "export" half
 * (`docs/plans/06-frontend-screens.md`: "read-only registers with
 * export"). No backend export route exists for any list in this app; this
 * builds the file client-side from rows the screen has already fetched.
 *
 * RFC 4180 quoting only (a field containing `,`, `"` or a newline is
 * quoted, with `"` doubled) — no attempt at a fuller CSV dialect, since
 * every column this app exports is a plain id, code, date or amount
 * string, never free text with embedded delimiters in practice.
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string;
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvField(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvField(c.value(row))).join(','));
  // A leading UTF-8 BOM: without it Excel (still the register's most likely
  // reader) mis-decodes any Cyrillic content as if it were the system
  // codepage, showing garbled classifier names — plain text editors and
  // every other spreadsheet tool ignore the BOM harmlessly.
  return '﻿' + [header, ...lines].join('\r\n');
}

/** Every `Page[T]` list route in this app caps `page_size` at 100
 *  server-side (`app/core/schemas.py::PageParams`) — the ceiling this loop
 *  requests per page. `MAX_PAGES * 100` (2000 rows) is the export's own
 *  bound: wide enough for any register this app can realistically hold
 *  today, narrow enough that a runaway filter cannot hang a browser tab
 *  fetching pages forever. `truncated` says whether the cap was hit, so a
 *  caller can warn rather than silently hand back a partial file. */
const MAX_EXPORT_PAGES = 20;
const EXPORT_PAGE_SIZE = 100;

export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  let total = Infinity;
  let page = 1;
  while (rows.length < total && page <= MAX_EXPORT_PAGES) {
    const result = await fetchPage(page, EXPORT_PAGE_SIZE);
    rows.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  return { rows, truncated: rows.length < total };
}

/** Builds the CSV and hands the browser a real file save — never a
 *  server round trip, since the rows are already in hand. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
