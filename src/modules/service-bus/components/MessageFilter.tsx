import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { MessageFilter as MessageFilterType } from '@/stores/messageStore';
import { Filter, X, Plus, Calendar, SortAsc, SortDesc } from 'lucide-react';

export interface MessageFilterProps {
  filter: MessageFilterType;
  onFilterChange: (filter: Partial<MessageFilterType>) => void;
  sortBy: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber', sortOrder: 'asc' | 'desc') => void;
  className?: string;
}

export const MessageFilter: React.FC<MessageFilterProps> = ({
  filter,
  onFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newFieldFilter, setNewFieldFilter] = useState<{
    fieldPath: string;
    operator: 'equals' | 'contains' | 'regex' | 'exists';
    value: string;
  }>({
    fieldPath: '',
    operator: 'equals',
    value: '',
  });

  const handleDateRangeChange = useCallback((field: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    onFilterChange({
      dateRange: {
        ...filter.dateRange,
        [field]: date,
      },
    });
  }, [filter.dateRange, onFilterChange]);

  const handleAddFieldFilter = useCallback(() => {
    if (newFieldFilter.fieldPath.trim()) {
      const newFilter = {
        ...newFieldFilter,
        value: newFieldFilter.operator === 'exists' ? true : newFieldFilter.value,
      };
      
      onFilterChange({
        fieldFilters: [...filter.fieldFilters, newFilter],
      });
      
      setNewFieldFilter({
        fieldPath: '',
        operator: 'equals',
        value: '',
      });
    }
  }, [newFieldFilter, filter.fieldFilters, onFilterChange]);

  const handleRemoveFieldFilter = useCallback((index: number) => {
    const newFilters = filter.fieldFilters.filter((_, i) => i !== index);
    onFilterChange({ fieldFilters: newFilters });
  }, [filter.fieldFilters, onFilterChange]);

  const handleClearAllFilters = useCallback(() => {
    onFilterChange({
      dateRange: { start: null, end: null },
      fieldFilters: [],
      messageTypes: [],
    });
  }, [onFilterChange]);

  const handleSortToggle = useCallback((field: 'enqueuedTimeUtc' | 'messageId' | 'sequenceNumber') => {
    if (sortBy === field) {
      onSortChange(field, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(field, 'desc');
    }
  }, [sortBy, sortOrder, onSortChange]);

  const formatDateForInput = (date: Date | null) => {
    if (!date) return '';
    return date.toISOString().slice(0, 16);
  };

  const hasActiveFilters = 
    filter.dateRange.start || 
    filter.dateRange.end || 
    filter.fieldFilters.length > 0 || 
    filter.messageTypes.length > 0;

  return (
    <div className={cn('border border-green-400/30 bg-black', className)}>
      {/* Filter Header */}
      <div className="flex items-center justify-between p-2 border-b border-green-400/30">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
        >
          <Filter className="w-4 h-4" />
          <span className="font-mono text-sm">
            FILTERS {hasActiveFilters && `(${filter.fieldFilters.length + (filter.dateRange.start || filter.dateRange.end ? 1 : 0)})`}
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* Sort Controls */}
          <div className="flex items-center gap-1 text-xs font-mono">
            <span className="text-green-400/60">SORT:</span>
            {(['enqueuedTimeUtc', 'messageId', 'sequenceNumber'] as const).map((field) => (
              <button
                key={field}
                onClick={() => handleSortToggle(field)}
                className={cn(
                  'px-2 py-1 border transition-colors',
                  sortBy === field
                    ? 'border-green-400 text-green-400 bg-green-400/10'
                    : 'border-green-400/30 text-green-400/60 hover:text-green-400'
                )}
              >
                {field === 'enqueuedTimeUtc' ? 'TIME' : field === 'messageId' ? 'ID' : 'SEQ'}
                {sortBy === field && (
                  sortOrder === 'asc' ? <SortAsc className="w-3 h-3 inline ml-1" /> : <SortDesc className="w-3 h-3 inline ml-1" />
                )}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="text-xs px-2 py-1 border border-red-400/30 text-red-400/60 hover:text-red-400 hover:border-red-400 transition-colors"
            >
              CLEAR ALL
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Date Range Filter */}
          <div>
            <div className="text-green-400 font-mono text-sm mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>DATE RANGE</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-green-400/60 font-mono mb-1">FROM</label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(filter.dateRange.start)}
                  onChange={(e) => handleDateRangeChange('start', e.target.value)}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-xs text-green-400/60 font-mono mb-1">TO</label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(filter.dateRange.end)}
                  onChange={(e) => handleDateRangeChange('end', e.target.value)}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                />
              </div>
            </div>
          </div>

          {/* Field Filters */}
          <div>
            <div className="text-green-400 font-mono text-sm mb-2">FIELD FILTERS</div>
            
            {/* Existing Field Filters */}
            {filter.fieldFilters.map((fieldFilter, index) => (
              <div key={index} className="flex items-center gap-2 mb-2 p-2 border border-green-400/20 bg-green-400/5">
                <span className="text-xs text-green-400 font-mono flex-1">
                  {fieldFilter.fieldPath} {fieldFilter.operator} {String(fieldFilter.value)}
                </span>
                <button
                  onClick={() => handleRemoveFieldFilter(index)}
                  className="text-red-400/60 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Add New Field Filter */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-4">
                <input
                  type="text"
                  placeholder="Field path (e.g., user.id)"
                  value={newFieldFilter.fieldPath}
                  onChange={(e) => setNewFieldFilter(prev => ({ ...prev, fieldPath: e.target.value }))}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                />
              </div>
              <div className="col-span-3">
                <select
                  value={newFieldFilter.operator}
                  onChange={(e) => setNewFieldFilter(prev => ({ 
                    ...prev, 
                    operator: e.target.value as any 
                  }))}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400"
                >
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  <option value="regex">regex</option>
                  <option value="exists">exists</option>
                </select>
              </div>
              <div className="col-span-4">
                <input
                  type="text"
                  placeholder="Value"
                  value={newFieldFilter.value}
                  onChange={(e) => setNewFieldFilter(prev => ({ ...prev, value: e.target.value }))}
                  disabled={newFieldFilter.operator === 'exists'}
                  className="w-full px-2 py-1 bg-black border border-green-400/30 text-green-400 font-mono text-xs focus:outline-none focus:border-green-400 disabled:opacity-50"
                />
              </div>
              <div className="col-span-1">
                <button
                  onClick={handleAddFieldFilter}
                  disabled={!newFieldFilter.fieldPath.trim()}
                  className="w-full px-2 py-1 border border-green-400/30 text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};