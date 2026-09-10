import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Loader2 } from 'lucide-react';
import { Pagination } from './Navigation';
import { clickableRowProps } from '../../lib/rowClick';
import { useLanguage } from '../../i18n/useT';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
}

type SortComparable = string | number | boolean;

/** Narrows a sort value to something `<`/`>` can honestly compare. */
function isSortComparable(value: unknown): value is SortComparable {
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'boolean';
}

const DATA_TABLE_I18N = {
  uz_latn: { loading: 'Yuklanmoqda...', emptyTitle: 'Maʼlumot topilmadi', emptyDescription: 'Hozircha jadvalda koʻrsatish uchun hech qanday yozuv yoʻq', actions: 'Harakatlar' },
  uz_cyrl: { loading: 'Юкланмоқда...', emptyTitle: 'Маълумот топилмади', emptyDescription: 'Ҳозирча жадвалда кўрсатиш учун ҳеч қандай ёзув йўқ', actions: 'Ҳаракатлар' },
  ru: { loading: 'Загрузка...', emptyTitle: 'Данные не найдены', emptyDescription: 'Пока в таблице нет записей для отображения', actions: 'Действия' },
  en: { loading: 'Loading...', emptyTitle: 'No data found', emptyDescription: 'No records to display in the table yet', actions: 'Actions' },
  kaa: { loading: 'Júklenbekte...', emptyTitle: 'Maǵlıwmat tabılmadı', emptyDescription: 'Házirshe kestedegi kórsetiw ushın jazıwlar joq', actions: 'Háreketler' },
};

export interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  loadingText?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  actions?: (row: T) => React.ReactNode;
  /** Opens the row's record from a click anywhere on it (see `lib/rowClick`);
   * the row's own links, buttons and checkboxes keep their own clicks. */
  onRowClick?: (row: T) => void;
  /** With `onRowClick`: which rows actually open (default all). A row this
   * refuses is plain — no pointer, no focus stop — rather than one that
   * swallows the click. */
  rowClickable?: (row: T) => boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalRecords?: number;
  };
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading = false,
  loadingText,
  emptyTitle,
  emptyDescription,
  selectable = false,
  onSelectionChange,
  actions,
  onRowClick,
  rowClickable,
  pagination,
  className = '',
}: DataTableProps<T>) {
  const { lang } = useLanguage();
  const dt = DATA_TABLE_I18N[lang as keyof typeof DATA_TABLE_I18N] || DATA_TABLE_I18N.uz_latn;
  const currentLoadingText = loadingText ?? dt.loading;
  const currentEmptyTitle = emptyTitle ?? dt.emptyTitle;
  const currentEmptyDescription = emptyDescription !== undefined ? emptyDescription : dt.emptyDescription;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = data.map((row) => row.id);
      setSelectedIds(allIds);
      onSelectionChange?.(allIds);
    } else {
      setSelectedIds([]);
      onSelectionChange?.([]);
    }
  };

  const handleSelectRow = (id: string | number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((item) => item !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    onSelectionChange?.(next);
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const col = columns.find((c) => c.key === sortKey);
      if (!col) return 0;

      const valA: unknown = col.accessor && typeof col.accessor === 'function' ? col.accessor(a) : (a as Record<string, unknown>)[sortKey];
      const valB: unknown = col.accessor && typeof col.accessor === 'function' ? col.accessor(b) : (b as Record<string, unknown>)[sortKey];

      if (valA == null) return 1;
      if (valB == null) return -1;

      // A column whose `key` isn't a real property of T (or whose accessor
      // returns something exotic) yields values we cannot safely order —
      // treat them as equal (stable, unchanged order) instead of comparing
      // `unknown` values, which `any` used to do silently and unsoundly.
      if (isSortComparable(valA) && isSortComparable(valB)) {
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [data, sortKey, sortDirection, columns]);

  return (
    <div className={`w-full bg-white border border-[#E4E7EA] rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#F8F9FA] border-b border-[#E4E7EA]">
              {selectable && (
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 accent-[#2E7D4F] border-[#767F87] rounded"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  className="p-3.5 text-xs font-semibold text-[#5A646D] uppercase tracking-wider select-none"
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1.5 hover:text-[#1A1F24] transition-colors"
                    >
                      <span>{col.header}</span>
                      {sortKey === col.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-[#2E7D4F]" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-[#2E7D4F]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#9AA3AB]" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {actions && <th className="p-3.5 text-right w-16">{dt.actions}</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EA]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="py-12 text-center text-[#5A646D]"
                >
                  <div className="inline-flex items-center gap-2" data-testid="table-loading">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2E7D4F]" />
                    <span>{currentLoadingText}</span>
                    <span className="sr-only">Yuklanmoqda...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="py-12 text-center"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="w-8 h-8 text-[#9AA3AB] mb-2" />
                    <span className="font-semibold text-[#1A1F24]">{currentEmptyTitle}</span>
                    <span className="text-xs text-[#5A646D] mt-0.5">{currentEmptyDescription}</span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                const rowProps =
                  onRowClick && (rowClickable?.(row) ?? true) ? clickableRowProps(() => onRowClick(row)) : undefined;
                return (
                  <tr
                    key={row.id}
                    {...rowProps}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#F0F7F1]/50' : 'hover:bg-[#F8F9FA]'
                    } ${rowProps?.className ?? ''}`}
                  >
                    {selectable && (
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(row.id)}
                          className="w-4 h-4 accent-[#2E7D4F] border-[#767F87] rounded"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      let content: React.ReactNode;
                      if (typeof col.accessor === 'function') {
                        content = col.accessor(row);
                      } else if (col.accessor) {
                        content = row[col.accessor] as React.ReactNode;
                      } else {
                        content = (row as Record<string, unknown>)[col.key] as React.ReactNode;
                      }

                      return (
                        <td key={col.key} className="p-3.5 text-[#1A1F24] align-middle">
                          {content}
                        </td>
                      );
                    })}
                    {actions && (
                      <td className="p-3.5 text-right align-middle">
                        <div className="flex justify-end">{actions(row)}</div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="px-4 border-t border-[#E4E7EA] bg-white">
          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
            totalRecords={pagination.totalRecords}
          />
        </div>
      )}
    </div>
  );
}
