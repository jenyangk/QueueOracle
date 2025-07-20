import React, { useState, useEffect, useCallback } from 'react';
import type { Gateway, GatewayStatus } from '../types';
import { ChirpstackService } from '../services/ChirpstackService';
import { ASCIITable } from '../../../components/terminal/ASCIITable';
import { StatusIndicator } from '../../../components/terminal/StatusIndicator';
import { CommandButton } from '../../../components/terminal/CommandButton';
import { TerminalWindow } from '../../../components/terminal/TerminalWindow';

interface GatewayListProps {
  service: ChirpstackService;
  onGatewaySelect: (gateway: Gateway) => void;
  onRefresh?: () => void;
}

interface GatewayWithStatus extends Gateway {
  status: GatewayStatus;
}

export const GatewayList: React.FC<GatewayListProps> = ({
  service,
  onGatewaySelect,
  onRefresh,
}) => {
  const [gateways, setGateways] = useState<GatewayWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGateway, setSelectedGateway] = useState<Gateway | null>(null);

  const loadGateways = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const gatewayList = await service.getGateways({ 
        search: searchTerm || undefined,
        limit: 100 
      });
      
      // Get status for each gateway
      const gatewayIds = gatewayList.map(g => g.gatewayId);
      const statusMap = await service.getMultipleGatewayStatuses(gatewayIds);
      
      const gatewaysWithStatus: GatewayWithStatus[] = gatewayList.map(gateway => ({
        ...gateway,
        status: statusMap.get(gateway.gatewayId) || {
          gatewayId: gateway.gatewayId,
          status: 'unknown',
          lastSeen: new Date(),
          uptime: 0,
        },
      }));

      setGateways(gatewaysWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gateways');
    } finally {
      setLoading(false);
    }
  }, [service, searchTerm]);

  useEffect(() => {
    loadGateways();
  }, [searchTerm, loadGateways]);

  const handleRefresh = () => {
    loadGateways();
    onRefresh?.();
  };

  const handleGatewaySelect = (gateway: GatewayWithStatus) => {
    setSelectedGateway(gateway);
    onGatewaySelect(gateway);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'offline':
        return 'text-red-400';
      default:
        return 'text-yellow-400';
    }
  };

  const formatUptime = (uptime: number): string => {
    if (uptime === 0) return 'N/A';
    
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
    const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  };

  const formatLastSeen = (lastSeen: Date): string => {
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const columns = [
    {
      key: 'status' as keyof GatewayWithStatus,
      header: 'Status',
      width: 8,
      render: (gateway: GatewayWithStatus) => (
        <StatusIndicator 
          status={gateway.status.status === 'unknown' ? 'warning' : gateway.status.status} 
          className={getStatusColor(gateway.status.status)}
        />
      ),
    },
    {
      key: 'name' as keyof GatewayWithStatus,
      header: 'Gateway Name',
      width: 20,
      render: (gateway: GatewayWithStatus) => (
        <span className="font-mono">{gateway.name}</span>
      ),
    },
    {
      key: 'gatewayId' as keyof GatewayWithStatus,
      header: 'Gateway ID',
      width: 16,
      render: (gateway: GatewayWithStatus) => (
        <span className="font-mono text-blue-400">{gateway.gatewayId}</span>
      ),
    },
    {
      key: 'location' as keyof GatewayWithStatus,
      header: 'Location',
      width: 15,
      render: (gateway: GatewayWithStatus) => {
        if (gateway.location) {
          return (
            <span className="font-mono text-cyan-400">
              {gateway.location.latitude.toFixed(4)}, {gateway.location.longitude.toFixed(4)}
            </span>
          );
        }
        return <span className="text-gray-500">No location</span>;
      },
    },
    {
      key: 'lastSeen' as keyof GatewayWithStatus,
      header: 'Last Seen',
      width: 12,
      render: (gateway: GatewayWithStatus) => (
        <span className="font-mono">{formatLastSeen(gateway.status.lastSeen)}</span>
      ),
    },
    {
      key: 'uptime' as keyof GatewayWithStatus,
      header: 'Uptime',
      width: 10,
      render: (gateway: GatewayWithStatus) => (
        <span className="font-mono">{formatUptime(gateway.status.uptime)}</span>
      ),
    },
  ];

  const actions = [
    {
      label: 'refresh',
      command: 'refresh',
      onClick: handleRefresh,
    },
    {
      label: 'search',
      command: 'search',
      onClick: () => {
        const term = prompt('Enter search term:');
        if (term !== null) {
          setSearchTerm(term);
        }
      },
    },
  ];

  return (
    <TerminalWindow
      title={`Chirpstack Gateways (${gateways.length})`}
      actions={actions}
      status={service.getConnectionState().isConnected ? 'connected' : 'disconnected'}
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="flex items-center space-x-2">
          <span className="text-green-400 font-mono">search:</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter gateways..."
            className="bg-black border border-green-400 text-green-400 font-mono px-2 py-1 flex-1"
          />
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
            <span className="text-yellow-400 font-mono">Loading gateways...</span>
          </div>
        )}

        {/* Gateway Table */}
        {!loading && gateways.length > 0 && (
          <ASCIITable
            data={gateways}
            columns={columns}
            virtualizedRows={15}
            onRowSelect={handleGatewaySelect}
            sortable={true}
          />
        )}

        {/* Empty State */}
        {!loading && gateways.length === 0 && !error && (
          <div className="text-center py-8">
            <span className="text-gray-500 font-mono">
              {searchTerm ? 'No gateways match your search' : 'No gateways found'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-green-400">
          <CommandButton
            command="refresh"
            description="Refresh gateway list"
            onClick={handleRefresh}
            disabled={loading}
          />
          {selectedGateway && (
            <CommandButton
              command="details"
              description="View gateway details"
              onClick={() => onGatewaySelect(selectedGateway)}
            />
          )}
        </div>
      </div>
    </TerminalWindow>
  );
};