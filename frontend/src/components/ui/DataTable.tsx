import React from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface Column<T> {
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  keyExtractor: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria.',
  onRowClick,
  keyExtractor,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState message="Fetching Legal Metrology records..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-700/80 shadow-md bg-slate-900/60">
      <table className="w-full text-left text-sm text-slate-200 border-collapse">
        <thead className="bg-slate-800/90 text-xs font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-700">
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={`px-4 py-3.5 ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick && onRowClick(item)}
              className={`transition-colors hover:bg-slate-800/50 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col, idx) => {
                let cellContent: React.ReactNode = null;
                if (typeof col.accessor === 'function') {
                  cellContent = col.accessor(item);
                } else if (col.accessor) {
                  cellContent = (item[col.accessor] as unknown) as React.ReactNode;
                }
                return (
                  <td key={idx} className={`px-4 py-3.5 font-medium ${col.className || ''}`}>
                    {cellContent}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
