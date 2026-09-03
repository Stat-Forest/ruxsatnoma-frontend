import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Inbox, Loader2 } from 'lucide-react';
import { Pagination } from './Navigation';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps<T extends { id: string | number }> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  actions?: (row: T) => React.ReactNode;
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
  emptyTitle = 'Maʼlumot topilmadi',
  emptyDescription = 'Hozircha jadvalda koʻrsatish uchun hech qanday yozuv yoʻq',
  selectable = false,
  onSelectionChange,
  actions,
  pagination,
  className = '',
}: DataTableProps<T>) {
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

      let valA: any = col.accessor && typeof col.accessor === 'function' ? col.accessor(a) : (a as any)[sortKey];
      let valB: any = col.accessor && typeof col.accessor === 'function' ? col.accessor(b) : (b as any)[sortKey];

      if (valA == null) return 1;
      if (valB == null) return -1;

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
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
              {actions && <th className="p-3.5 text-right w-16">Harakatlar</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E7EA]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}
                  className="py-12 text-center text-[#5A646D]"
                >
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#2E7D4F]" />
                    <span>Yuklanmoqda...</span>
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
                    <span className="font-semibold text-[#1A1F24]">{emptyTitle}</span>
                    <span className="text-xs text-[#5A646D] mt-0.5">{emptyDescription}</span>
                  </div>
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-[#F0F7F1]/50' : 'hover:bg-[#F8F9FA]'
                    }`}
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
                      let content: React.ReactNode = null;
                      if (typeof col.accessor === 'function') {
                        content = col.accessor(row);
                      } else if (col.accessor) {
                        content = (row[col.accessor] as unknown) as React.ReactNode;
                      } else {
                        content = (row as any)[col.key];
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
