/**
 * Message Pattern Chart - Visualization for message type distribution and patterns
 */

import React from 'react';
import ReactECharts from 'echarts-for-react';

interface MessagePatternChartProps {
  messageTypes: Record<string, number>;
  title: string;
  showDetails?: boolean;
}

export const MessagePatternChart: React.FC<MessagePatternChartProps> = ({
  messageTypes,
  title,
  showDetails = false,
}) => {
  const totalMessages = Object.values(messageTypes).reduce((sum, count) => sum + count, 0);
  
  const sortedTypes = Object.entries(messageTypes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Show top 10 message types

  const pieOption = {
    backgroundColor: 'transparent',
    title: {
      text: title,
      textStyle: {
        color: '#10B981',
        fontSize: 16,
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
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
      },
      formatter: (name: string) => {
        const count = messageTypes[name] || 0;
        const percentage = ((count / totalMessages) * 100).toFixed(1);
        return `${name} (${percentage}%)`;
      },
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['60%', '50%'],
        data: sortedTypes.map(([type, count], index) => ({
          name: type,
          value: count,
          itemStyle: {
            color: getColorForIndex(index),
            borderColor: '#000',
            borderWidth: 1,
          },
        })),
        label: {
          show: showDetails,
          color: '#10B981',
          fontFamily: 'monospace',
          fontSize: 10,
          formatter: '{b}: {c}',
        },
        labelLine: {
          show: showDetails,
          lineStyle: {
            color: '#10B981',
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(16, 185, 129, 0.5)',
          },
        },
      },
    ],
  };

  const barOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Message Type Distribution',
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
      axisPointer: {
        type: 'shadow',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: sortedTypes.map(([type]) => type),
      axisLine: {
        lineStyle: {
          color: '#10B981',
        },
      },
      axisLabel: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
        rotate: 45,
        formatter: (value: string) => {
          return value.length > 15 ? value.substring(0, 15) + '...' : value;
        },
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
        type: 'bar',
        data: sortedTypes.map(([, count], index) => ({
          value: count,
          itemStyle: {
            color: getColorForIndex(index),
          },
        })),
        barWidth: '60%',
      },
    ],
  };

  return (
    <div className="border border-green-500 bg-black/50 p-4">
      {showDetails ? (
        <div className="space-y-6">
          <ReactECharts
            option={pieOption}
            style={{ height: '400px' }}
            theme="dark"
          />
          <ReactECharts
            option={barOption}
            style={{ height: '300px' }}
            theme="dark"
          />
        </div>
      ) : (
        <ReactECharts
          option={pieOption}
          style={{ height: '300px' }}
          theme="dark"
        />
      )}
      
      {/* Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm font-mono">
        <div className="text-center">
          <div className="text-green-400">TOTAL TYPES</div>
          <div className="text-green-300 text-lg">
            {Object.keys(messageTypes).length}
          </div>
        </div>
        <div className="text-center">
          <div className="text-green-400">MOST COMMON</div>
          <div className="text-green-300 text-lg">
            {sortedTypes[0]?.[0] || 'N/A'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-green-400">DIVERSITY</div>
          <div className="text-green-300 text-lg">
            {calculateDiversityIndex(messageTypes).toFixed(2)}
          </div>
        </div>
        <div className="text-center">
          <div className="text-green-400">TOTAL MESSAGES</div>
          <div className="text-green-300 text-lg">
            {totalMessages.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Top Types Table */}
      {showDetails && (
        <div className="mt-6 border border-green-600 bg-black/30">
          <div className="border-b border-green-600 p-3">
            <h4 className="text-green-400 font-mono">MESSAGE TYPE BREAKDOWN</h4>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full font-mono text-sm">
              <thead className="sticky top-0 bg-black">
                <tr className="border-b border-green-600">
                  <th className="text-left p-2 text-green-400">TYPE</th>
                  <th className="text-right p-2 text-green-400">COUNT</th>
                  <th className="text-right p-2 text-green-400">%</th>
                  <th className="text-center p-2 text-green-400">BAR</th>
                </tr>
              </thead>
              <tbody>
                {sortedTypes.map(([type, count], index) => {
                  const percentage = ((count / totalMessages) * 100);
                  const barWidth = Math.max(2, (percentage / 100) * 100);
                  
                  return (
                    <tr key={type} className="border-b border-green-800">
                      <td className="p-2 text-green-300">
                        <div className="truncate max-w-xs" title={type}>
                          {type}
                        </div>
                      </td>
                      <td className="p-2 text-right text-green-300">
                        {count.toLocaleString()}
                      </td>
                      <td className="p-2 text-right text-green-300">
                        {percentage.toFixed(1)}%
                      </td>
                      <td className="p-2">
                        <div className="w-full bg-green-900/30 h-2 rounded">
                          <div
                            className="h-2 rounded transition-all duration-300"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: getColorForIndex(index),
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to get consistent colors for chart items
function getColorForIndex(index: number): string {
  const colors = [
    '#10B981', // green
    '#3B82F6', // blue
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#06B6D4', // cyan
    '#F97316', // orange
    '#84CC16', // lime
    '#EC4899', // pink
    '#6B7280', // gray
  ];
  return colors[index % colors.length];
}

// Helper function to calculate diversity index (Shannon diversity)
function calculateDiversityIndex(messageTypes: Record<string, number>): number {
  const total = Object.values(messageTypes).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;

  let diversity = 0;
  Object.values(messageTypes).forEach(count => {
    if (count > 0) {
      const proportion = count / total;
      diversity -= proportion * Math.log2(proportion);
    }
  });

  return diversity;
}