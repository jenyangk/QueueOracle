/**
 * Message Volume Chart - Time series visualization for message volume
 */

import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { TimeSeriesPoint } from '../../../services/storage/types';

interface MessageVolumeChartProps {
  timeSeriesData: TimeSeriesPoint[];
  title: string;
  showTrendLine?: boolean;
  showPatterns?: boolean;
}

export const MessageVolumeChart: React.FC<MessageVolumeChartProps> = ({
  timeSeriesData,
  title,
  showTrendLine = false,
  showPatterns = false,
}) => {
  const option = {
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
      trigger: 'axis',
      backgroundColor: '#000',
      borderColor: '#10B981',
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
      formatter: (params: any) => {
        const point = params[0];
        const date = new Date(point.axisValue).toLocaleString();
        return `${date}<br/>Messages: ${point.value}<br/>Avg Size: ${params[1]?.value || 0} bytes`;
      },
    },
    legend: {
      data: showTrendLine ? ['Message Count', 'Trend Line'] : ['Message Count'],
      textStyle: {
        color: '#10B981',
        fontFamily: 'monospace',
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'time',
      boundaryGap: false,
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
        show: true,
        lineStyle: {
          color: '#10B981',
          opacity: 0.2,
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
        name: 'Message Count',
        type: 'line',
        data: timeSeriesData.map(point => [
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
        smooth: true,
      },
      ...(showTrendLine ? [{
        name: 'Trend Line',
        type: 'line',
        data: calculateTrendLine(timeSeriesData),
        lineStyle: {
          color: '#F59E0B',
          width: 2,
          type: 'dashed' as const,
        },
        itemStyle: {
          color: '#F59E0B',
        },
        symbol: 'none',
      }] : []),
    ],
  };

  return (
    <div className="border border-green-500 bg-black/50 p-4">
      <ReactECharts
        option={option}
        style={{ height: '300px' }}
        theme="dark"
      />
      {timeSeriesData.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm font-mono">
          <div className="text-center">
            <div className="text-green-400">TOTAL MESSAGES</div>
            <div className="text-green-300 text-lg">
              {timeSeriesData.reduce((sum, point) => sum + point.count, 0).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-green-400">AVG PER PERIOD</div>
            <div className="text-green-300 text-lg">
              {Math.round(timeSeriesData.reduce((sum, point) => sum + point.count, 0) / timeSeriesData.length).toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-green-400">PEAK VOLUME</div>
            <div className="text-green-300 text-lg">
              {Math.max(...timeSeriesData.map(point => point.count)).toLocaleString()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to calculate trend line using linear regression
function calculateTrendLine(data: TimeSeriesPoint[]): [Date, number][] {
  if (data.length < 2) return [];

  const points = data.map((point, index) => ({
    x: index,
    y: point.count,
    timestamp: point.timestamp,
  }));

  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXX = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return points.map(point => [
    point.timestamp,
    slope * point.x + intercept,
  ]);
}