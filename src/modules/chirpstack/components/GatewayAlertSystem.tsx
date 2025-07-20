import React, { useState, useEffect, useCallback } from 'react';
import type { Gateway } from '../types';
import { ChirpstackService } from '../services/ChirpstackService';
import { TerminalWindow } from '../../../components/terminal/TerminalWindow';
import { CommandButton } from '../../../components/terminal/CommandButton';

interface GatewayAlert {
  id: string;
  gatewayId: string;
  gatewayName: string;
  type: 'offline' | 'low_signal' | 'high_error_rate' | 'no_data' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  details?: Record<string, any>;
}

interface AlertRule {
  id: string;
  name: string;
  type: GatewayAlert['type'];
  enabled: boolean;
  threshold: number;
  duration: number; // minutes
  severity: GatewayAlert['severity'];
}

interface GatewayAlertSystemProps {
  service: ChirpstackService;
  gateways: Gateway[];
  onAlertAction?: (alert: GatewayAlert, action: 'acknowledge' | 'dismiss') => void;
}

export const GatewayAlertSystem: React.FC<GatewayAlertSystemProps> = ({
  service,
  gateways,
  onAlertAction,
}) => {
  const [alerts, setAlerts] = useState<GatewayAlert[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([
    {
      id: 'offline',
      name: 'Gateway Offline',
      type: 'offline',
      enabled: true,
      threshold: 5, // minutes
      duration: 1,
      severity: 'high',
    },
    {
      id: 'low_signal',
      name: 'Low Signal Quality',
      type: 'low_signal',
      enabled: true,
      threshold: -120, // RSSI threshold
      duration: 10,
      severity: 'medium',
    },
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      type: 'high_error_rate',
      enabled: true,
      threshold: 10, // percentage
      duration: 5,
      severity: 'high',
    },
    {
      id: 'no_data',
      name: 'No Data Received',
      type: 'no_data',
      enabled: true,
      threshold: 30, // minutes
      duration: 1,
      severity: 'medium',
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'alerts' | 'rules'>('alerts');
  const [selectedAlert, setSelectedAlert] = useState<GatewayAlert | null>(null);

  const checkAlerts = useCallback(async () => {
    if (!service.getConnectionState().isConnected) return;

    setLoading(true);
    const newAlerts: GatewayAlert[] = [];

    try {
      // Get current statuses for all gateways
      const gatewayIds = gateways.map(g => g.gatewayId);
      const statusMap = await service.getMultipleGatewayStatuses(gatewayIds);

      for (const gateway of gateways) {
        const status = statusMap.get(gateway.gatewayId);
        if (!status) continue;

        // Check offline alert
        const offlineRule = alertRules.find(r => r.type === 'offline' && r.enabled);
        if (offlineRule && status.status === 'offline') {
          const timeSinceLastSeen = Date.now() - status.lastSeen.getTime();
          const minutesSinceLastSeen = timeSinceLastSeen / (1000 * 60);

          if (minutesSinceLastSeen > offlineRule.threshold) {
            newAlerts.push({
              id: `${gateway.gatewayId}_offline_${Date.now()}`,
              gatewayId: gateway.gatewayId,
              gatewayName: gateway.name,
              type: 'offline',
              severity: offlineRule.severity,
              message: `Gateway has been offline for ${Math.floor(minutesSinceLastSeen)} minutes`,
              timestamp: new Date(),
              acknowledged: false,
              details: {
                lastSeen: status.lastSeen,
                minutesOffline: Math.floor(minutesSinceLastSeen),
              },
            });
          }
        }

        // Check performance-based alerts (requires metrics)
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // Last hour
          const metrics = await service.getGatewayMetrics(gateway.gatewayId, startDate, endDate);

          // Check high error rate
          const errorRateRule = alertRules.find(r => r.type === 'high_error_rate' && r.enabled);
          if (errorRateRule && metrics.errorRate > errorRateRule.threshold) {
            newAlerts.push({
              id: `${gateway.gatewayId}_error_rate_${Date.now()}`,
              gatewayId: gateway.gatewayId,
              gatewayName: gateway.name,
              type: 'high_error_rate',
              severity: errorRateRule.severity,
              message: `High error rate: ${metrics.errorRate.toFixed(1)}% (threshold: ${errorRateRule.threshold}%)`,
              timestamp: new Date(),
              acknowledged: false,
              details: {
                errorRate: metrics.errorRate,
                threshold: errorRateRule.threshold,
                totalPackets: metrics.totalPackets,
              },
            });
          }

          // Check low signal quality
          const signalRule = alertRules.find(r => r.type === 'low_signal' && r.enabled);
          if (signalRule && metrics.averageRssi < signalRule.threshold) {
            newAlerts.push({
              id: `${gateway.gatewayId}_low_signal_${Date.now()}`,
              gatewayId: gateway.gatewayId,
              gatewayName: gateway.name,
              type: 'low_signal',
              severity: signalRule.severity,
              message: `Low signal quality: ${metrics.averageRssi.toFixed(1)} dBm (threshold: ${signalRule.threshold} dBm)`,
              timestamp: new Date(),
              acknowledged: false,
              details: {
                rssi: metrics.averageRssi,
                threshold: signalRule.threshold,
                snr: metrics.averageSnr,
              },
            });
          }

          // Check no data received
          const noDataRule = alertRules.find(r => r.type === 'no_data' && r.enabled);
          if (noDataRule && metrics.totalPackets === 0) {
            newAlerts.push({
              id: `${gateway.gatewayId}_no_data_${Date.now()}`,
              gatewayId: gateway.gatewayId,
              gatewayName: gateway.name,
              type: 'no_data',
              severity: noDataRule.severity,
              message: `No data received in the last hour`,
              timestamp: new Date(),
              acknowledged: false,
              details: {
                timeRange: { start: startDate, end: endDate },
                totalPackets: metrics.totalPackets,
              },
            });
          }
        } catch (error) {
          // Metrics not available, skip performance alerts
          console.warn(`Could not get metrics for gateway ${gateway.gatewayId}:`, error);
        }
      }

      // Merge with existing alerts, avoiding duplicates
      setAlerts(prevAlerts => {
        const existingAlertKeys = new Set(
          prevAlerts.map(a => `${a.gatewayId}_${a.type}`)
        );

        const filteredNewAlerts = newAlerts.filter(
          alert => !existingAlertKeys.has(`${alert.gatewayId}_${alert.type}`)
        );

        return [...prevAlerts, ...filteredNewAlerts];
      });
    } catch (error) {
      console.error('Failed to check alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [service, gateways, alertRules]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkAlerts();
    }, 60000); // Check every minute

    checkAlerts(); // Initial check

    return () => clearInterval(interval);
  }, [checkAlerts]);

  const handleAlertAction = (alert: GatewayAlert, action: 'acknowledge' | 'dismiss') => {
    if (action === 'acknowledge') {
      setAlerts(prev => prev.map(a => 
        a.id === alert.id ? { ...a, acknowledged: true } : a
      ));
    } else if (action === 'dismiss') {
      setAlerts(prev => prev.filter(a => a.id !== alert.id));
    }

    onAlertAction?.(alert, action);
  };

  const getSeverityColor = (severity: GatewayAlert['severity']): string => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-900/20 border-red-400';
      case 'high':
        return 'text-red-400 bg-red-900/10 border-red-400';
      case 'medium':
        return 'text-yellow-400 bg-yellow-900/10 border-yellow-400';
      case 'low':
        return 'text-blue-400 bg-blue-900/10 border-blue-400';
      default:
        return 'text-gray-400 bg-gray-900/10 border-gray-400';
    }
  };

  const getSeveritySymbol = (severity: GatewayAlert['severity']): string => {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const renderAlerts = () => {
    const activeAlerts = alerts.filter(a => !a.acknowledged);
    const acknowledgedAlerts = alerts.filter(a => a.acknowledged);

    return (
      <div className="space-y-4">
        {/* Alert Summary */}
        <div className="grid grid-cols-4 gap-4 text-sm font-mono">
          <div className="text-center">
            <div className="text-red-400 text-lg">{activeAlerts.filter(a => a.severity === 'critical').length}</div>
            <div>Critical</div>
          </div>
          <div className="text-center">
            <div className="text-red-400 text-lg">{activeAlerts.filter(a => a.severity === 'high').length}</div>
            <div>High</div>
          </div>
          <div className="text-center">
            <div className="text-yellow-400 text-lg">{activeAlerts.filter(a => a.severity === 'medium').length}</div>
            <div>Medium</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 text-lg">{activeAlerts.filter(a => a.severity === 'low').length}</div>
            <div>Low</div>
          </div>
        </div>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-mono text-red-400">Active Alerts ({activeAlerts.length})</div>
            {activeAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 border ${getSeverityColor(alert.severity)} cursor-pointer`}
                onClick={() => setSelectedAlert(alert)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span>{getSeveritySymbol(alert.severity)}</span>
                      <span className="font-mono text-sm font-bold">{alert.gatewayName}</span>
                      <span className="font-mono text-xs text-gray-400">({alert.gatewayId})</span>
                    </div>
                    <div className="font-mono text-sm mt-1">{alert.message}</div>
                    <div className="font-mono text-xs text-gray-400 mt-1">
                      {alert.timestamp.toLocaleString()}
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertAction(alert, 'acknowledge');
                      }}
                      className="px-2 py-1 text-xs font-mono border border-green-400 text-green-400 hover:bg-green-400/10"
                    >
                      ACK
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAlertAction(alert, 'dismiss');
                      }}
                      className="px-2 py-1 text-xs font-mono border border-red-400 text-red-400 hover:bg-red-400/10"
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Acknowledged Alerts */}
        {acknowledgedAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-mono text-gray-400">Acknowledged Alerts ({acknowledgedAlerts.length})</div>
            {acknowledgedAlerts.slice(0, 5).map(alert => (
              <div
                key={alert.id}
                className="p-2 border border-gray-600 bg-gray-900/20 opacity-60"
              >
                <div className="flex items-center space-x-2">
                  <span className="text-gray-400">✓</span>
                  <span className="font-mono text-sm">{alert.gatewayName}</span>
                  <span className="font-mono text-xs text-gray-500">({alert.gatewayId})</span>
                </div>
                <div className="font-mono text-sm text-gray-400">{alert.message}</div>
              </div>
            ))}
          </div>
        )}

        {/* No Alerts */}
        {alerts.length === 0 && !loading && (
          <div className="text-center py-8">
            <span className="text-green-400 font-mono">✓ All gateways operating normally</span>
          </div>
        )}
      </div>
    );
  };

  const renderAlertRules = () => {
    return (
      <div className="space-y-4">
        <div className="text-sm font-mono text-cyan-400">Alert Rules Configuration</div>
        
        {alertRules.map(rule => (
          <div
            key={rule.id}
            className={`p-3 border ${rule.enabled ? 'border-green-400' : 'border-gray-600'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => {
                      setAlertRules(prev => prev.map(r => 
                        r.id === rule.id ? { ...r, enabled: e.target.checked } : r
                      ));
                    }}
                    className="mr-2"
                  />
                  <span className="font-mono text-sm font-bold">{rule.name}</span>
                  <span className={`px-2 py-1 text-xs font-mono border ${getSeverityColor(rule.severity)}`}>
                    {rule.severity.toUpperCase()}
                  </span>
                </div>
                <div className="font-mono text-sm text-gray-400 mt-1">
                  Threshold: {rule.threshold} | Duration: {rule.duration}min
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const actions = [
    {
      label: 'refresh',
      command: 'refresh',
      onClick: checkAlerts,
    },
    {
      label: viewMode === 'alerts' ? 'rules' : 'alerts',
      command: viewMode === 'alerts' ? 'rules' : 'alerts',
      onClick: () => setViewMode(viewMode === 'alerts' ? 'rules' : 'alerts'),
    },
  ];

  return (
    <TerminalWindow
      title={`Gateway Alerts (${alerts.filter(a => !a.acknowledged).length} active)`}
      actions={actions}
      status={service.getConnectionState().isConnected ? 'connected' : 'disconnected'}
    >
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-4">
            <span className="text-yellow-400 font-mono">Checking alerts...</span>
          </div>
        )}

        {viewMode === 'alerts' ? renderAlerts() : renderAlertRules()}

        {/* Selected Alert Details */}
        {selectedAlert && (
          <div className="border-t border-green-400 pt-4">
            <div className="text-sm font-mono space-y-2">
              <div className="text-cyan-400">Alert Details:</div>
              <div>Gateway: {selectedAlert.gatewayName} ({selectedAlert.gatewayId})</div>
              <div>Type: {selectedAlert.type}</div>
              <div>Severity: {selectedAlert.severity}</div>
              <div>Message: {selectedAlert.message}</div>
              <div>Time: {selectedAlert.timestamp.toLocaleString()}</div>
              {selectedAlert.details && (
                <div>
                  <div className="text-cyan-400">Details:</div>
                  <pre className="text-xs text-gray-400">
                    {JSON.stringify(selectedAlert.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-green-400">
          <CommandButton
            command="refresh"
            description="Check for new alerts"
            onClick={checkAlerts}
            disabled={loading}
          />
          <CommandButton
            command={viewMode === 'alerts' ? 'rules' : 'alerts'}
            description={`Switch to ${viewMode === 'alerts' ? 'rules' : 'alerts'} view`}
            onClick={() => setViewMode(viewMode === 'alerts' ? 'rules' : 'alerts')}
          />
          {alerts.filter(a => !a.acknowledged).length > 0 && (
            <CommandButton
              command="ack-all"
              description="Acknowledge all alerts"
              onClick={() => {
                setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
              }}
              variant="secondary"
            />
          )}
        </div>
      </div>
    </TerminalWindow>
  );
};