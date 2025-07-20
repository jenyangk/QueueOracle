import React, { useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import { cn } from '@/lib/utils';

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  width: number;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

export interface ASCIITableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  virtualizedRows: number;
  onRowSelect?: (row: T, index: number) => void;
  selectedIndex?: number;
  sortable?: boolean;
  className?: string;
  rowHeight?: number;
}

type SortDirection = 'asc' | 'desc' | null;

interface SortState {
  column: string | null;
  direction: SortDirection;
}

export function ASCIITable<T>({
  data,
  columns,
  virtualizedRows,
  onRowSelect,
  selectedIndex,
  sortable = true,
  className,
  rowHeight = 32,
}: ASCIITableProps<T>) {
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  // Calculate total width for horizontal borders
  // const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  // Sort data based on current sort state
  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aValue = (a as any)[sortState.column!];
      const bValue = (b as any)[sortState.column!];
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
      
      return sortState.direction === 'desc' ? -comparison : comparison;
    });
  }, [data, sortState]);

  const handleSort = (columnKey: string) => {
    if (!sortable) return;
    
    setSortState(prev => {
      if (prev.column === columnKey) {
        // Cycle through: asc -> desc -> null
        const newDirection: SortDirection = 
          prev.direction === 'asc' ? 'desc' : 
          prev.direction === 'desc' ? null : 'asc';
        return { column: newDirection ? columnKey : null, direction: newDirection };
      } else {
        return { column: columnKey, direction: 'asc' };
      }
    });
  };

  const getSortIndicator = (columnKey: string) => {
    if (sortState.column !== columnKey) return '';
    return sortState.direction === 'asc' ? ' ↑' : ' ↓';
  };

  // Row renderer for react-window
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const row = sortedData[index];
    const isSelected = selectedIndex === index;
    
    return (
      <div
        style={style}
        className={cn(
          'flex items-center font-mono text-sm border-b border-green-400/30',
          'hover:bg-green-400/5 cursor-pointer transition-colors',
          isSelected && 'bg-green-400/10'
        )}
        onClick={() => row && onRowSelect?.(row, index)}
      >
        {columns.map((column, colIndex) => {
          const value = (row as any)[column.key];
          const content = column.render && row ? column.render(value, row, index) : String(value || '');
          
          return (
            <div
              key={colIndex}
              className="px-2 py-1 truncate"
              style={{ width: column.width }}
              title={String(content)}
            >
              {content}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={cn('border border-green-400 font-mono text-green-400', className)}>
      {/* Table Header */}
      <div className="border-b border-green-400 bg-green-400/5">
        <div className="flex">
          {columns.map((column, index) => (
            <div
              key={index}
              className={cn(
                'px-2 py-2 font-bold text-xs uppercase truncate',
                'border-r border-green-400/30 last:border-r-0',
                sortable && column.sortable !== false && 'cursor-pointer hover:bg-green-400/10'
              )}
              style={{ width: column.width }}
              onClick={() => sortable && column.sortable !== false && handleSort(String(column.key))}
              title={column.header}
            >
              {column.header}{getSortIndicator(String(column.key))}
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="relative">
        {sortedData.length === 0 ? (
          <div className="p-4 text-center text-green-400/60">
            <div className="text-lg">┌─────────────────┐</div>
            <div className="text-lg">│   NO DATA FOUND │</div>
            <div className="text-lg">└─────────────────┘</div>
          </div>
        ) : (
          <List
            height={virtualizedRows * rowHeight}
            itemCount={sortedData.length}
            itemSize={rowHeight}
            width="100%"
          >
            {Row}
          </List>
        )}
      </div>

      {/* Table Footer with ASCII border */}
      <div className="border-t border-green-400 px-2 py-1 text-xs text-green-400/60">
        {sortedData.length} rows {sortState.column && `(sorted by ${sortState.column} ${sortState.direction})`}
      </div>
    </div>
  );
}