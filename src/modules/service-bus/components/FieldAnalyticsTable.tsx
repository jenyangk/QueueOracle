/**
 * Field Analytics Table - Displays field statistics in a sortable table
 */

import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Search, Filter } from 'lucide-react';
import type { FieldAnalytics } from '../../../services/storage/types';

interface FieldAnalyticsTableProps {
  fieldAnalytics: FieldAnalytics[];
  onFieldSelect: (fieldPath: string) => void;
  selectedField?: string | null;
}

type SortField = 'fieldPath' | 'dataType' | 'count' | 'uniqueValues' | 'coverage';
type SortOrder = 'asc' | 'desc';

export const FieldAnalyticsTable: React.FC<FieldAnalyticsTableProps> = ({
  fieldAnalytics,
  onFieldSelect,
  selectedField,
}) => {
  const [sortField, setSortField] = useState<SortField>('count');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('');

  const uniqueDataTypes = useMemo(() => {
    const types = new Set(fieldAnalytics.map(f => f.dataType));
    return Array.from(types).sort();
  }, [fieldAnalytics]);

  const filteredAndSortedFields = useMemo(() => {
    let filtered = fieldAnalytics;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(field =>
        field.fieldPath.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply data type filter
    if (dataTypeFilter) {
      filtered = filtered.filter(field => field.dataType === dataTypeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'fieldPath':
          aValue = a.fieldPath;
          bValue = b.fieldPath;
          break;
        case 'dataType':
          aValue = a.dataType;
          bValue = b.dataType;
          break;
        case 'count':
          aValue = a.count;
          bValue = b.count;
          break;
        case 'uniqueValues':
          aValue = a.uniqueValues;
          bValue = b.uniqueValues;
          break;
        case 'coverage':
          aValue = a.coverage;
          bValue = b.coverage;
          break;
        default:
          return 0;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortOrder === 'asc' ? comparison : -comparison;
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [fieldAnalytics, searchTerm, dataTypeFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? 
      <ChevronUp className="w-4 h-4" /> : 
      <ChevronDown className="w-4 h-4" />;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getDataTypeColor = (dataType: string) => {
    const colors: Record<string, string> = {
      'string': 'text-blue-400',
      'number': 'text-yellow-400',
      'boolean': 'text-purple-400',
      'object': 'text-cyan-400',
      'array': 'text-pink-400',
      'null': 'text-gray-400',
      'undefined': 'text-gray-500',
    };
    return colors[dataType] || 'text-green-400';
  };

  return (
    <div className="border border-green-500 bg-black/50">
      {/* Header */}
      <div className="border-b border-green-500 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-green-400 font-mono">FIELD ANALYTICS</h3>
          <div className="text-green-300 text-sm font-mono">
            {filteredAndSortedFields.length} / {fieldAnalytics.length} fields
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black border border-green-500 text-green-300 placeholder-green-600 focus:outline-none focus:border-green-400 font-mono"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-400" />
            <select
              value={dataTypeFilter}
              onChange={(e) => setDataTypeFilter(e.target.value)}
              className="pl-10 pr-8 py-2 bg-black border border-green-500 text-green-300 focus:outline-none focus:border-green-400 font-mono"
            >
              <option value="">All Types</option>
              {uniqueDataTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-sm">
          <thead>
            <tr className="border-b border-green-500">
              <th 
                className="text-left p-3 text-green-400 cursor-pointer hover:text-green-300 select-none"
                onClick={() => handleSort('fieldPath')}
              >
                <div className="flex items-center space-x-1">
                  <span>FIELD PATH</span>
                  {getSortIcon('fieldPath')}
                </div>
              </th>
              <th 
                className="text-left p-3 text-green-400 cursor-pointer hover:text-green-300 select-none"
                onClick={() => handleSort('dataType')}
              >
                <div className="flex items-center space-x-1">
                  <span>TYPE</span>
                  {getSortIcon('dataType')}
                </div>
              </th>
              <th 
                className="text-right p-3 text-green-400 cursor-pointer hover:text-green-300 select-none"
                onClick={() => handleSort('count')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>COUNT</span>
                  {getSortIcon('count')}
                </div>
              </th>
              <th 
                className="text-right p-3 text-green-400 cursor-pointer hover:text-green-300 select-none"
                onClick={() => handleSort('uniqueValues')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>UNIQUE</span>
                  {getSortIcon('uniqueValues')}
                </div>
              </th>
              <th 
                className="text-right p-3 text-green-400 cursor-pointer hover:text-green-300 select-none"
                onClick={() => handleSort('coverage')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>COVERAGE</span>
                  {getSortIcon('coverage')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedFields.map((field) => (
              <tr
                key={field.fieldPath}
                className={`border-b border-green-800 hover:bg-green-900/20 cursor-pointer transition-colors ${
                  selectedField === field.fieldPath ? 'bg-green-900/30' : ''
                }`}
                onClick={() => onFieldSelect(field.fieldPath)}
              >
                <td className="p-3 text-green-300">
                  <div className="truncate max-w-xs" title={field.fieldPath}>
                    {field.fieldPath}
                  </div>
                </td>
                <td className="p-3">
                  <span className={`${getDataTypeColor(field.dataType)} font-semibold`}>
                    {field.dataType}
                  </span>
                </td>
                <td className="p-3 text-right text-green-300">
                  {field.count.toLocaleString()}
                </td>
                <td className="p-3 text-right text-green-300">
                  {field.uniqueValues.toLocaleString()}
                </td>
                <td className="p-3 text-right text-green-300">
                  {formatPercentage(field.coverage)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedFields.length === 0 && (
        <div className="p-8 text-center text-green-600">
          <div className="text-lg">┌─ No Fields Found ─┐</div>
          <div className="text-sm mt-2">│ Try adjusting your filters │</div>
          <div className="text-lg">└──────────────────┘</div>
        </div>
      )}
    </div>
  );
};