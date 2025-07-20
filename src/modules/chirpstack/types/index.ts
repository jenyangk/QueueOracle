export interface ChirpstackConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string; // Will be encrypted
  tenantId?: string;
  createdAt: Date;
  lastUsed: Date;
}

export interface Gateway {
  id: string;
  name: string;
  description?: string;
  location?: GatewayLocation;
  tenantId: string;
  gatewayId: string;
  createdAt: Date;
  updatedAt: Date;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  tags: Record<string, string>;
  metadata: Record<string, string>;
  statsInterval: number;
}

export interface GatewayLocation {
  latitude: number;
  longitude: number;
  altitude: number;
  source: 'UNKNOWN' | 'GPS' | 'CONFIG' | 'GEO_RESOLVER_TDOA' | 'GEO_RESOLVER_RSSI' | 'GEO_RESOLVER_GNSS' | 'GEO_RESOLVER_WIFI';
  accuracy: number;
}

export interface GatewayStats {
  gatewayId: string;
  timestamp: Date;
  rxPacketsReceived: number;
  rxPacketsReceivedOk: number;
  txPacketsReceived: number;
  txPacketsEmitted: number;
  metadata: Record<string, string>;
}

export interface GatewayStatus {
  gatewayId: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: Date;
  uptime: number;
  version?: string;
  configVersion?: string;
  region?: string;
}

export interface ChirpstackApiResponse<T> {
  result: T;
  totalCount?: number;
}

export interface ChirpstackError {
  code: number;
  message: string;
  details: Array<{
    typeUrl: string;
    value: string;
  }>;
}

export interface GatewayListRequest {
  limit?: number;
  offset?: number;
  search?: string;
  tenantId?: string;
  multicastGroupId?: string;
}

export interface GatewayStatsRequest {
  gatewayId: string;
  interval: 'HOUR' | 'DAY' | 'MONTH';
  startTimestamp: Date;
  endTimestamp: Date;
}

export interface GatewayMetrics {
  gatewayId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  totalPackets: number;
  successfulPackets: number;
  errorRate: number;
  averageRssi: number;
  averageSnr: number;
  uptimePercentage: number;
  dataPoints: Array<{
    timestamp: Date;
    rxPackets: number;
    txPackets: number;
    rssi: number;
    snr: number;
  }>;
}

export interface ChirpstackConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastConnected: Date | null;
  config: ChirpstackConfig | null;
}