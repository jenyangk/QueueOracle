/**
 * Correlation Matrix - Visualization for field correlations
 */

import React, { useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Filter, TrendingUp, TrendingDown } from 'lucide-react';
import type { CorrelationData, FieldAnalytics } from '../../../services/storage/types';

interface CorrelationMatrixProps {
  correlationData: CorrelationData[];
  fieldAnalytics: FieldAnalytics[];
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({
  correlationData,
  fieldAnalytics,
}) => {
  const [minCorrelation, setMinCorrelation] = useState(0.3);
  const [showPositiveOnly, setShowPositiveOnly] = useState(false);

  const filteredCorrelations = correlationData.filter(corr => {
    const absCorr = Math.abs(corr.correlation);
    if (absCorr < minCorrelation) return false;
    if (showPositiveOnly && corr.correlation < 0) return false;
    return true;
  });

  // Prepare data for heatmap
  const fieldNames = Array.from(new Set([
    ...filteredCorrelations.map(c => c.field1),
    ...filteredCorrelations.map(c => c.field2),
  ])).sort();

  const matrixData = [];
  for (let i = 0; i < fieldNames.length; i++) {
    for (let j = 0; j < fieldNames.length; j++) {
      const field1 = fieldNames[i];
      const field2 = fieldNames[j];
      
      let correlation = 0;
      if (field1 === field2) {
        correlation = 1; // Perfect correlation with self
      } else {
        const corr = filteredCorrelations.find(c => 
          (c.field1 === field1 && c.field2 === field2) ||
          (c.field1 === field2 && c.field2 === field1)
        );
        correlation = corr ? corr.correlation : 0;
      }
      
      matrixData.push([j, i, correlation]);
    }
  }

  const heatmapOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Field Correlation Matrix',
      textStyle: {
        color: '#10B981',
        fontSize: 16,
        fontFamily: 'monospace',
      },
    },
    tooltip: {
      backgroundColor: '#000',
      borderColor: '#10B981',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
      formatter: (params: any) => {
        const [x, y, value] = params.data;
        const field1 = fieldNames[y];
        const field2 = fieldNames[x];
        return `${field1}<br/>↔<br/>${field2}<br/>Correlation: ${value.toFixed(3)}`;
      },
    },
    grid: {
      height: '70%',
      top: '10%',
    },
    xAxis: {
      type: 'category',
      data: fieldNames,
      splitArea: {
        show: true,
      },
      axisLabel: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
        rotate: 45,
        formatter: (value: string) => {
          return value.length > 20 ? value.substring(0, 20) + '...' : value;
        },
      },
    },
    yAxis: {
      type: 'category',
      data: fieldNames,
      splitArea: {
        show: true,
      },
      axisLabel: {
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
        formatter: (value: string) => {
          return value.length > 20 ? value.substring(0, 20) + '...' : value;
        },
      },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: '5%',
      inRange: {
        color: ['#EF4444', '#FEF3C7', '#10B981'],
      },
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
    },
    series: [
      {
        type: 'heatmap',
        data: matrixData,
        label: {
          show: fieldNames.length <= 10,
          color: '#000',
          fontFamily: 'monospace',
          fontSize: 8,
          formatter: (params: any) => {
            return params.data[2].toFixed(2);
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(16, 185, 129, 0.5)',
          },
        },
      },
    ],
  };

  // Network graph for strong correlations
  const networkData = {
    nodes: fieldNames.map(name => ({
      id: name,
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      symbolSize: Math.min(50, Math.max(20, (fieldAnalytics.find(f => f.fieldPath === name)?.count || 0) / 100)),
      itemStyle: {
        color: '#10B981',
      },
      label: {
        show: true,
        color: '#10B981',
        fontFamily: 'monospace',
        fontSize: 10,
      },
    })),
    links: filteredCorrelations
      .filter(corr => Math.abs(corr.correlation) >= 0.5)
      .map(corr => ({
        source: corr.field1,
        target: corr.field2,
        value: Math.abs(corr.correlation),
        lineStyle: {
          color: corr.correlation > 0 ? '#10B981' : '#EF4444',
          width: Math.abs(corr.correlation) * 5,
          opacity: 0.7,
        },
        label: {
          show: true,
          formatter: corr.correlation.toFixed(2),
          color: '#10B981',
          fontFamily: 'monospace',
          fontSize: 8,
        },
      })),
  };

  const networkOption = {
    backgroundColor: 'transparent',
    title: {
      text: 'Strong Correlations Network',
      textStyle: {
        color: '#10B981',
        fontSize: 16,
        fontFamily: 'monospace',
      },
    },
    tooltip: {
      backgroundColor: '#000',
      borderColor: '#10B981',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        data: networkData.nodes,
        links: networkData.links,
        roam: true,
        force: {
          repulsion: 1000,
          edgeLength: 100,
        },
        emphasis: {
          focus: 'adjacency',
        },
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="border border-green-500 bg-black/50 p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-mono text-sm">FILTERS</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-green-400 font-mono text-sm">Min Correlation:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={minCorrelation}
                onChange={(e) => setMinCorrelation(parseFloat(e.target.value))}
                className="w-20"
              />
              <span className="text-green-300 font-mono text-sm w-8">
                {minCorrelation.toFixed(1)}
              </span>
            </div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showPositiveOnly}
                onChange={(e) => setShowPositiveOnly(e.target.checked)}
                className="form-checkbox text-green-500"
              />
              <span className="text-green-400 font-mono text-sm">Positive Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-green-500 p-4 bg-black/50">
          <div className="text-green-400 text-sm font-mono">TOTAL CORRELATIONS</div>
          <div className="text-green-300 text-2xl font-mono">
            {correlationData.length}
          </div>
        </div>
        <div className="border border-green-500 p-4 bg-black/50">
          <div className="text-green-400 text-sm font-mono">STRONG POSITIVE</div>
          <div className="text-green-300 text-2xl font-mono flex items-center">
            <TrendingUp className="w-5 h-5 mr-1" />
            {correlationData.filter(c => c.correlation >= 0.7).length}
          </div>
        </div>
        <div className="border border-green-500 p-4 bg-black/50">
          <div className="text-green-400 text-sm font-mono">STRONG NEGATIVE</div>
          <div className="text-green-300 text-2xl font-mono flex items-center">
            <TrendingDown className="w-5 h-5 mr-1" />
            {correlationData.filter(c => c.correlation <= -0.7).length}
          </div>
        </div>
        <div className="border border-green-500 p-4 bg-black/50">
          <div className="text-green-400 text-sm font-mono">FILTERED</div>
          <div className="text-green-300 text-2xl font-mono">
            {filteredCorrelations.length}
          </div>
        </div>
      </div>

      {/* Charts */}
      {filteredCorrelations.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-green-500 bg-black/50 p-4">
            <ReactECharts
              option={heatmapOption}
              style={{ height: '400px' }}
              theme="dark"
            />
          </div>
          <div className="border border-green-500 bg-black/50 p-4">
            <ReactECharts
              option={networkOption}
              style={{ height: '400px' }}
              theme="dark"
            />
          </div>
        </div>
      ) : (
        <div className="border border-green-500 bg-black/50 p-8 text-center">
          <div className="text-green-400 text-lg">┌─ No Correlations Found ─┐</div>
          <div className="text-green-300 mt-2">│ Try lowering the minimum correlation threshold │</div>
          <div className="text-green-400">└─────────────────────────────────────────────┘</div>
        </div>
      )}

      {/* Correlation Table */}
      {filteredCorrelations.length > 0 && (
        <div className="border border-green-500 bg-black/50">
          <div className="border-b border-green-500 p-4">
            <h3 className="text-green-400 font-mono">CORRELATION DETAILS</h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full font-mono text-sm">
              <thead className="sticky top-0 bg-black">
                <tr className="border-b border-green-500">
                  <th className="text-left p-3 text-green-400">FIELD 1</th>
                  <th className="text-left p-3 text-green-400">FIELD 2</th>
                  <th className="text-right p-3 text-green-400">CORRELATION</th>
                  <th className="text-right p-3 text-green-400">SIGNIFICANCE</th>
                  <th className="text-center p-3 text-green-400">TYPE</th>
                </tr>
              </thead>
              <tbody>
                {filteredCorrelations
                  .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
                  .map((corr, index) => (
                    <tr key={index} className="border-b border-green-800 hover:bg-green-900/20">
                      <td className="p-3 text-green-300">
                        <div className="truncate max-w-xs" title={corr.field1}>
                          {corr.field1}
                        </div>
                      </td>
                      <td className="p-3 text-green-300">
                        <div className="truncate max-w-xs" title={corr.field2}>
                          {corr.field2}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className={corr.correlation > 0 ? 'text-green-300' : 'text-red-400'}>
                          {corr.correlation.toFixed(3)}
                        </span>
                      </td>
                      <td className="p-3 text-right text-green-300">
                        {corr.significance.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        {corr.correlation > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-400 mx-auto" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};