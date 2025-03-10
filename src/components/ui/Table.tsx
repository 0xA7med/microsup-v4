import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import Button from './Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18nStore } from '../../store/i18nStore';

interface TableProps {
  data: any[];
  columns: any[];
  searchValue: string;
  onSearchChange: (value: string) => void;
}

export default function Table({ data, columns, searchValue, onSearchChange }: TableProps) {
  const { translations: t } = useI18nStore();

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: searchValue },
    onGlobalFilterChange: onSearchChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronRight}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {t.common.back}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={ChevronLeft}
            iconPosition="right"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {t.common.next}
          </Button>
        </div>
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {t.common.page} {table.getState().pagination.pageIndex + 1} {t.common.of}{' '}
          {table.getPageCount()}
        </span>
      </div>
    </div>
  );
}