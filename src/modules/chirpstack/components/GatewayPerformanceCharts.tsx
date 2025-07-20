import React, { useState, useEffect, useCallback } from 'react';
import type { Gateway, GatewayMetrics } from '../types';
import { ChirpstackService } from '../services/ChirpstackService';
import { TerminalWindow } from '../../../components/terminal/TerminalWindow';
import { CommandButton } from '../../../components/terminal/CommandButton';

interface GatewayPerformanceChartsProps {
  service: ChirpstackService;
  gateway: Gateway;
  onClose?: () => void;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

export const GatewayPerformanceCharts: React.FC<GatewayPerformanceChartsProps> = ({
  service,
  gateway,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<GatewayMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [chartType, setChartType] = useState<'packets' | 'signal' | 'uptime'>('packets');

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      let startDate: Date;
      let interval: 'HOUR' | 'DAY' | 'MONTH';

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          interval = 'HOUR';
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          interval = 'HOUR';
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          interval = 'DAY';
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          interval = 'DAY';
          break;
      }

      const gatewayMetrics = await service.getGatewayMetrics(
        gateway.gatewayId,
        startDate,
        now,
        interval
      );

      setMetrics(gatewayMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [service, gateway.gatewayId, timeRange]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const formatTimestamp = (timestamp: Date): string => {
    switch (timeRange) {
      case '1h':
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '24h':
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '7d':
        return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
      case '30d':
        return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' });
      default:
        return timestamp.toLocaleString();
    }
  };

  const renderASCIIChart = (data: ChartData, title: string, unit: string = ''): React.ReactElement => {
    if (!data.datasets.length || !data.datasets[0].data.length) {
      return (
        <div className="text-center py-4">
          <span className="text-gray-500 font-mono">No data available</span>
        </div>
      );
    }

    const chartHeight = 10;
    
    // Find min and max values across all datasets
    const allValues = data.datasets.flatMap(dataset => dataset.data);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const range = maxValue - minValue || 1;

    return (
      <div className="space-y-2">
        <div className="text-sm font-mono text-cyan-400">{title}</div>
        
        {/* Chart Area */}
        <div className="border border-green-400 p-2 bg-black">
          <div className="font-mono text-xs">
            {/* Y-axis labels and chart */}
            {Array.from({ length: chartHeight }, (_, i) => {
              const y = chartHeight - 1 - i;
              const value = minValue + (range * y) / (chartHeight - 1);
              
              return (
                <div key={i} className="flex">
                  <span className="w-8 text-right text-gray-400 mr-1">
                    {value.toFixed(0)}{unit}
                  </span>
                  <span className="text-gray-700">│</span>
                  <div className="flex-1">
                    {data.datasets.map((dataset, datasetIndex) => (
                      <span key={datasetIndex}>
                        {dataset.data.map((dataValue, pointIndex) => {
                          const normalizedValue = (dataValue - minValue) / range;
                          const pointY = Math.round(normalizedValue * (chartHeight - 1));
                          
                          if (pointY === y) {
                            return (
                              <span
                                key={pointIndex}
                                className={dataset.color}
                                style={{ marginLeft: pointIndex * 2 }}
                              >
                                ●
                              </span>
                            );
                          }
                          return null;
                        })}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* X-axis */}
            <div className="flex">
              <span className="w-8 mr-1"></span>
              <span className="text-gray-700">└</span>
              <div className="flex-1 border-t border-gray-700"></div>
            </div>
            
            {/* X-axis labels */}
            <div className="flex">
              <span className="w-9"></span>
              <div className="flex-1 flex justify-between text-gray-400">
                {data.labels.filter((_, i) => i % Math.max(1, Math.floor(data.labels.length / 6)) === 0).map((label, i) => (
                  <span key={i} className="text-xs">{label}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex space-x-4 text-xs font-mono">
          {data.datasets.map((dataset, i) => (
            <span key={i} className={dataset.color}>
              ● {dataset.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const getPacketChartData = (): ChartData => {
    if (!metrics) return { labels: [], datasets: [] };

    return {
      labels: metrics.dataPoints.map(point => formatTimestamp(point.timestamp)),
      datasets: [
        {
          label: 'RX Packets',
          data: metrics.dataPoints.map(point => point.rxPackets),
          color: 'text-green-400',
        },
        {
          label: 'TX Packets',
          data: metrics.dataPoints.map(point => point.txPackets),
          color: 'text-blue-400',
        },
      ],
    };
  };

  const getSignalChartData = (): ChartData => {
    if (!metrics) return { labels: [], datasets: [] };

    return {
      labels: metrics.dataPoints.map(point => formatTimestamp(point.timestamp)),
      datasets: [
        {
          label: 'RSSI',
          data: metrics.dataPoints.map(point => Math.abs(point.rssi)), // Make positive for display
          color: 'text-yellow-400',
        },
        {
          label: 'SNR',
          data: metrics.dataPoints.map(point => point.snr),
          color: 'text-purple-400',
        },
      ],
    };
  };

  const getUptimeChartData = (): ChartData => {
    if (!metrics) return { labels: [], datasets: [] };

    // Calculate uptime percentage for each data point
    const uptimeData = metrics.dataPoints.map((_, index) => {
      const pointsUpToNow = index + 1;
      const expectedPoints = pointsUpToNow;
      return (pointsUpToNow / expectedPoints) * 100;
    });

    return {
      labels: metrics.dataPoints.map(point => formatTimestamp(point.timestamp)),
      datasets: [
        {
          label: 'Uptime %',
          data: uptimeData,
          color: 'text-green-400',
        },
      ],
    };
  };

  const renderMetricsSummary = (): React.ReactElement => {
    if (!metrics) return <></>;

    return (
      <div className="grid grid-cols-2 gap-4 text-sm font-mono">
        <div className="space-y-1">
          <div className="text-cyan-400">Packet Statistics</div>
          <div>Total Packets: <span className="text-white">{metrics.totalPackets.toLocaleString()}</span></div>
          <div>Successful: <span className="text-green-400">{metrics.successfulPackets.toLocaleString()}</span></div>
          <div>Error Rate: <span className="text-red-400">{metrics.errorRate.toFixed(2)}%</span></div>
        </div>
        <div className="space-y-1">
          <div className="text-cyan-400">Signal Quality</div>
          <div>Avg RSSI: <span className="text-yellow-400">{metrics.averageRssi.toFixed(1)} dBm</span></div>
          <div>Avg SNR: <span className="text-purple-400">{metrics.averageSnr.toFixed(1)} dB</span></div>
          <div>Uptime: <span className="text-green-400">{metrics.uptimePercentage.toFixed(1)}%</span></div>
        </div>
      </div>
    );
  };

  const actions = [
    {
      label: 'refresh',
      command: 'refresh',
      onClick: loadMetrics,
    },
    {
      label: 'close',
      command: 'close',
      onClick: onClose || (() => {}),
    },
  ];

  return (
    <TerminalWindow
      title={`Performance: ${gateway.name} (${gateway.gatewayId})`}
      actions={actions}
      status={service.getConnectionState().isConnected ? 'connected' : 'disconnected'}
    >
      <div className="space-y-4">
        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-green-400 font-mono">timerange:</span>
          <div className="flex space-x-1">
            {(['1h', '24h', '7d', '30d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2 py-1 font-mono text-xs border ${
                  timeRange === range
                    ? 'border-white bg-white text-black'
                    : 'border-green-400 text-green-400 hover:bg-green-400/10'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Type Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-green-400 font-mono">chart:</span>
          <div className="flex space-x-1">
            {(['packets', 'signal', 'uptime'] as const).map(type => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-2 py-1 font-mono text-xs border ${
                  chartType === type
                    ? 'border-white bg-white text-black'
                    : 'border-green-400 text-green-400 hover:bg-green-400/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="border border-red-400 bg-red-900/20 p-2">
            <span className="text-red-400 font-mono">ERROR: {error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4">
            <span className="text-yellow-400 font-mono">Loading performance data...</span>
          </div>
        )}

        {/* Metrics Summary */}
        {!loading && metrics && renderMetricsSummary()}

        {/* Charts */}
        {!loading && metrics && (
          <div className="space-y-4">
            {chartType === 'packets' && renderASCIIChart(
              getPacketChartData(),
              'Packet Traffic',
              ''
            )}
            {chartType === 'signal' && renderASCIIChart(
              getSignalChartData(),
              'Signal Quality',
              ''
            )}
            {chartType === 'uptime' && renderASCIIChart(
              getUptimeChartData(),
              'Uptime Percentage',
              '%'
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-green-400">
          <CommandButton
            command="refresh"
            description="Refresh performance data"
            onClick={loadMetrics}
            disabled={loading}
          />
          {onClose && (
            <CommandButton
              command="close"
              description="Close performance view"
              onClick={onClose}
            />
          )}
        </div>
      </div>
    </TerminalWindow>
  );
};