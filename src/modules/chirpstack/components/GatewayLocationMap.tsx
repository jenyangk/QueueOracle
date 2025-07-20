import React, { useState, useEffect, useCallback } from 'react';
import type { Gateway, GatewayStatus } from '../types';
import { ChirpstackService } from '../services/ChirpstackService';
import { TerminalWindow } from '../../../components/terminal/TerminalWindow';
import { CommandButton } from '../../../components/terminal/CommandButton';
import { StatusIndicator } from '../../../components/terminal/StatusIndicator';

interface GatewayLocationMapProps {
  service: ChirpstackService;
  gateways: Gateway[];
  selectedGateway?: Gateway | null;
  onGatewaySelect: (gateway: Gateway) => void;
}

interface GatewayMapMarker extends Gateway {
  status: GatewayStatus;
}

export const GatewayLocationMap: React.FC<GatewayLocationMapProps> = ({
  service,
  gateways,
  selectedGateway,
  onGatewaySelect,
}) => {
  const [mapMarkers, setMapMarkers] = useState<GatewayMapMarker[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'ascii' | 'coordinates'>('ascii');
  const [bounds, setBounds] = useState<{
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } | null>(null);

  const loadGatewayStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const gatewayIds = gateways
        .filter(g => g.location)
        .map(g => g.gatewayId);
      
      const statusMap = await service.getMultipleGatewayStatuses(gatewayIds);
      
      const markers: GatewayMapMarker[] = gateways
        .filter(g => g.location)
        .map(gateway => ({
          ...gateway,
          status: statusMap.get(gateway.gatewayId) || {
            gatewayId: gateway.gatewayId,
            status: 'unknown',
            lastSeen: new Date(),
            uptime: 0,
          },
        }));

      setMapMarkers(markers);
      calculateBounds(markers);
    } catch (error) {
      console.error('Failed to load gateway statuses:', error);
    } finally {
      setLoading(false);
    }
  }, [service, gateways]);

  useEffect(() => {
    loadGatewayStatuses();
  }, [loadGatewayStatuses]);

  const calculateBounds = (markers: GatewayMapMarker[]) => {
    if (markers.length === 0) {
      setBounds(null);
      return;
    }

    const lats = markers.map(m => m.location!.latitude);
    const lngs = markers.map(m => m.location!.longitude);

    setBounds({
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    });
  };

  const getStatusSymbol = (status: string): string => {
    switch (status) {
      case 'online':
        return '●';
      case 'offline':
        return '○';
      default:
        return '◐';
    }
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

  const normalizeCoordinate = (value: number, min: number, max: number, scale: number): number => {
    if (max === min) return scale / 2;
    return Math.floor(((value - min) / (max - min)) * scale);
  };

  const renderASCIIMap = () => {
    if (!bounds || mapMarkers.length === 0) {
      return (
        <div className="text-center py-8">
          <span className="text-gray-500 font-mono">No gateway locations available</span>
        </div>
      );
    }

    const mapWidth = 60;
    const mapHeight = 20;
    const map: string[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(' '));

    // Place gateways on the ASCII map
    mapMarkers.forEach(gateway => {
      if (!gateway.location) return;

      const x = normalizeCoordinate(gateway.location.longitude, bounds.minLng, bounds.maxLng, mapWidth - 1);
      const y = normalizeCoordinate(gateway.location.latitude, bounds.minLat, bounds.maxLat, mapHeight - 1);
      
      // Flip Y coordinate (ASCII maps are top-down, coordinates are bottom-up)
      const flippedY = mapHeight - 1 - y;
      
      map[flippedY][x] = getStatusSymbol(gateway.status.status);
    });

    return (
      <div className="space-y-2">
        {/* Map Legend */}
        <div className="flex space-x-4 text-sm font-mono">
          <span className="text-green-400">● Online</span>
          <span className="text-red-400">○ Offline</span>
          <span className="text-yellow-400">◐ Unknown</span>
        </div>

        {/* ASCII Map */}
        <div className="border border-green-400 p-2 bg-black">
          <div className="font-mono text-xs leading-none">
            {map.map((row, y) => (
              <div key={y} className="whitespace-pre">
                {row.map((cell, x) => {
                  const gateway = findGatewayAtPosition(x, y, mapWidth, mapHeight);
                  const isSelected = gateway && selectedGateway?.gatewayId === gateway.gatewayId;
                  
                  return (
                    <span
                      key={x}
                      className={`${
                        gateway ? getStatusColor(gateway.status.status) : 'text-gray-700'
                      } ${isSelected ? 'bg-white text-black' : ''} cursor-pointer`}
                      onClick={() => gateway && onGatewaySelect(gateway)}
                      title={gateway ? `${gateway.name} (${gateway.gatewayId})` : undefined}
                    >
                      {cell === ' ' ? '·' : cell}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Coordinate Bounds */}
        <div className="text-xs font-mono text-gray-400 grid grid-cols-2 gap-4">
          <div>
            <div>NW: {bounds.maxLat.toFixed(4)}, {bounds.minLng.toFixed(4)}</div>
            <div>SW: {bounds.minLat.toFixed(4)}, {bounds.minLng.toFixed(4)}</div>
          </div>
          <div>
            <div>NE: {bounds.maxLat.toFixed(4)}, {bounds.maxLng.toFixed(4)}</div>
            <div>SE: {bounds.minLat.toFixed(4)}, {bounds.maxLng.toFixed(4)}</div>
          </div>
        </div>
      </div>
    );
  };

  const findGatewayAtPosition = (x: number, y: number, mapWidth: number, mapHeight: number): GatewayMapMarker | null => {
    if (!bounds) return null;

    const flippedY = mapHeight - 1 - y;
    const tolerance = 0.5;

    return mapMarkers.find(gateway => {
      if (!gateway.location) return false;

      const gx = normalizeCoordinate(gateway.location.longitude, bounds.minLng, bounds.maxLng, mapWidth - 1);
      const gy = normalizeCoordinate(gateway.location.latitude, bounds.minLat, bounds.maxLat, mapHeight - 1);

      return Math.abs(gx - x) <= tolerance && Math.abs(gy - flippedY) <= tolerance;
    }) || null;
  };

  const renderCoordinatesList = () => {
    return (
      <div className="space-y-2">
        {mapMarkers.map(gateway => (
          <div
            key={gateway.gatewayId}
            className={`flex items-center space-x-4 p-2 border ${
              selectedGateway?.gatewayId === gateway.gatewayId
                ? 'border-white bg-white/10'
                : 'border-green-400'
            } cursor-pointer hover:bg-green-400/10`}
            onClick={() => onGatewaySelect(gateway)}
          >
            <StatusIndicator 
              status={gateway.status.status === 'unknown' ? 'warning' : gateway.status.status}
              className={getStatusColor(gateway.status.status)}
            />
            <div className="flex-1">
              <div className="font-mono text-sm">{gateway.name}</div>
              <div className="font-mono text-xs text-gray-400">{gateway.gatewayId}</div>
            </div>
            <div className="font-mono text-sm text-cyan-400">
              {gateway.location!.latitude.toFixed(6)}, {gateway.location!.longitude.toFixed(6)}
            </div>
            <div className="font-mono text-xs text-gray-400">
              Alt: {gateway.location!.altitude}m
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
      onClick: loadGatewayStatuses,
    },
    {
      label: viewMode === 'ascii' ? 'list' : 'map',
      command: viewMode === 'ascii' ? 'list' : 'map',
      onClick: () => setViewMode(viewMode === 'ascii' ? 'coordinates' : 'ascii'),
    },
  ];

  return (
    <TerminalWindow
      title={`Gateway Locations (${mapMarkers.length})`}
      actions={actions}
      status={service.getConnectionState().isConnected ? 'connected' : 'disconnected'}
    >
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-4">
            <span className="text-yellow-400 font-mono">Loading gateway locations...</span>
          </div>
        )}

        {!loading && (
          <>
            {viewMode === 'ascii' ? renderASCIIMap() : renderCoordinatesList()}
            
            {/* Selected Gateway Info */}
            {selectedGateway && (
              <div className="border-t border-green-400 pt-4">
                <div className="text-sm font-mono space-y-1">
                  <div className="text-cyan-400">Selected Gateway:</div>
                  <div>Name: {selectedGateway.name}</div>
                  <div>ID: {selectedGateway.gatewayId}</div>
                  {selectedGateway.location && (
                    <>
                      <div>Coordinates: {selectedGateway.location.latitude.toFixed(6)}, {selectedGateway.location.longitude.toFixed(6)}</div>
                      <div>Altitude: {selectedGateway.location.altitude}m</div>
                      <div>Source: {selectedGateway.location.source}</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2 border-t border-green-400">
          <CommandButton
            command="refresh"
            description="Refresh gateway locations"
            onClick={loadGatewayStatuses}
            disabled={loading}
          />
          <CommandButton
            command={viewMode === 'ascii' ? 'list' : 'map'}
            description={`Switch to ${viewMode === 'ascii' ? 'list' : 'map'} view`}
            onClick={() => setViewMode(viewMode === 'ascii' ? 'coordinates' : 'ascii')}
          />
        </div>
      </div>
    </TerminalWindow>
  );
};