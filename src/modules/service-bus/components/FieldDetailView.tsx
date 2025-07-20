/**
 * Field Detail View - Shows detailed analytics for a specific field
 */

import React from 'react';
import { X, TrendingUp, BarChart3, Hash } from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { FieldAnalytics } from '../../../services/storage/types';

interface FieldDetailViewProps {
  fieldAnalytics: FieldAnalytics;
  onClose: () => void;
}

export const FieldDetailView: React.FC<FieldDetailViewProps> = ({
  fieldAnalytics,
  onClose,
}) => {
  const getDataTypeColor = (dataType: string) => {
    const colors: Record<string, string> = {
      'string': '#60A5FA',
      'number': '#FBBF24',
      'boolean': '#A78BFA',
      'object': '#22D3EE',
      'array': '#F472B6',
      'null': '#9CA3AF',
      'undefined': '#6B7280',
    };
    return colors[dataType] || '#10B981';
  };

  // Prepare data for value frequency chart
  const valueFrequencyOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Value Frequency',
      textStyle: {
        color: '#10B981',
        fontSize: 14,
        fontFamily: 'monospace',
      },
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#000',
      borderColor: '#10B981',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
      formatter: (params: any) => {
        return `${params.name}<br/>Count: ${params.value}<br/>Percentage: ${params.percent}%`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: fieldAnalytics.topValues.slice(0, 10).map(tv => ({
          name: String(tv.value).length > 20 ? 
            String(tv.value).substring(0, 20) + '...' : 
            String(tv.value),
          value: tv.count,
        })),
        itemStyle: {
          borderColor: '#000',
          borderWidth: 1,
        },
        label: {
          color: '#10B981',
          fontFamily: 'monospace',
          fontSize: 10,
        },
        labelLine: {
          lineStyle: {
            color: '#10B981',
          },
        },
      },
    ],
  };

  // Prepare data for trend chart
  const trendOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Field Trend',
      textStyle: {
        color: '#10B981',
        fontSize: 14,
        fontFamily: 'monospace',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#000',
      borderColor: '#10B981',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
    },
    xAxis: {
      type: 'time',
      axisLine: {
        lineStyle: {
          color: '#10B981',
        },
      },
      axisLabel: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: '#10B981',
        },
      },
      axisLabel: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: '#10B981',
          opacity: 0.3,
        },
      },
    },
    series: [
      {
        type: 'line',
        data: fieldAnalytics.trend.map(point => [
          point.timestamp,
          point.count,
        ]),
        lineStyle: {
          color: '#10B981',
          width: 2,
        },
        itemStyle: {
          color: '#10B981',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              {
                offset: 0,
                color: 'rgba(16, 185, 129, 0.3)',
              },
              {
                offset: 1,
                color: 'rgba(16, 185, 129, 0.05)',
              },
            ],
          },
        },
      },
    ],
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="border border-green-500 bg-black/50 h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-green-500 p-4 flex items-center justify-between">
        <div>
          <h3 className="text-green-400 font-mono text-lg">FIELD DETAILS</h3>
          <div className="text-green-300 font-mono text-sm truncate max-w-xs" title={fieldAnalytics.fieldPath}>
            {fieldAnalytics.fieldPath}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-green-400 hover:text-green-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-green-600 p-3 bg-black/30">
            <div className="flex items-center space-x-2 mb-2">
              <Hash className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-mono">COUNT</span>
            </div>
            <div className="text-green-300 text-xl font-mono">
              {fieldAnalytics.count.toLocaleString()}
            </div>
          </div>
          <div className="border border-green-600 p-3 bg-black/30">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-mono">UNIQUE</span>
            </div>
            <div className="text-green-300 text-xl font-mono">
              {fieldAnalytics.uniqueValues.toLocaleString()}
            </div>
          </div>
          <div className="border border-green-600 p-3 bg-black/30">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm font-mono">COVERAGE</span>
            </div>
            <div className="text-green-300 text-xl font-mono">
              {fieldAnalytics.coverage.toFixed(1)}%
            </div>
          </div>
          <div className="border border-green-600 p-3 bg-black/30">
            <div className="text-green-400 text-sm font-mono mb-2">DATA TYPE</div>
            <div 
              className="text-xl font-mono font-semibold"
              style={{ color: getDataTypeColor(fieldAnalytics.dataType) }}
            >
              {fieldAnalytics.dataType}
            </div>
          </div>
        </div>

        {/* Value Frequency Chart */}
        {fieldAnalytics.topValues.length > 0 && (
          <div className="border border-green-600 p-4 bg-black/30">
            <ReactECharts
              option={valueFrequencyOption}
              style={{ height: '300px' }}
              theme="dark"
            />
          </div>
        )}

        {/* Trend Chart */}
        {fieldAnalytics.trend.length > 0 && (
          <div className="border border-green-600 p-4 bg-black/30">
            <ReactECharts
              option={trendOption}
              style={{ height: '200px' }}
              theme="dark"
            />
          </div>
        )}

        {/* Top Values Table */}
        <div className="border border-green-600 bg-black/30">
          <div className="border-b border-green-600 p-3">
            <h4 className="text-green-400 font-mono">TOP VALUES</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full font-mono text-sm">
              <thead className="sticky top-0 bg-black">
                <tr className="border-b border-green-600">
                  <th className="text-left p-2 text-green-400">VALUE</th>
                  <th className="text-right p-2 text-green-400">COUNT</th>
                  <th className="text-right p-2 text-green-400">%</th>
                </tr>
              </thead>
              <tbody>
                {fieldAnalytics.topValues.map((tv, index) => (
                  <tr key={index} className="border-b border-green-800">
                    <td className="p-2 text-green-300">
                      <div className="truncate max-w-xs" title={formatValue(tv.value)}>
                        {formatValue(tv.value)}
                      </div>
                    </td>
                    <td className="p-2 text-right text-green-300">
                      {tv.count.toLocaleString()}
                    </td>
                    <td className="p-2 text-right text-green-300">
                      {tv.percentage.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Metadata */}
        <div className="border border-green-600 p-3 bg-black/30">
          <h4 className="text-green-400 font-mono mb-2">METADATA</h4>
          <div className="space-y-1 text-sm font-mono">
            <div className="text-green-300">
              <span className="text-green-400">Field ID:</span> {fieldAnalytics.id}
            </div>
            <div className="text-green-300">
              <span className="text-green-400">Connection:</span> {fieldAnalytics.connectionId}
            </div>
            <div className="text-green-300">
              <span className="text-green-400">Last Updated:</span> {fieldAnalytics.lastUpdated.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};