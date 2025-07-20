import type {
  ChirpstackConfig,
  Gateway,
  GatewayStats,
  GatewayStatus,
  ChirpstackApiResponse,
  ChirpstackError,
  GatewayListRequest,
  GatewayStatsRequest,
  GatewayMetrics
} from '../types';

export class ChirpstackApiClient {
  private config: ChirpstackConfig;
  private abortController: AbortController | null = null;

  constructor(config: ChirpstackConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Grpc-Metadata-Authorization': `Bearer ${this.config.apiKey}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ChirpstackApiError(
          response.status,
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.details || []
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof ChirpstackApiError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ChirpstackApiError(0, 'Request was cancelled', []);
        }
        throw new ChirpstackApiError(0, error.message, []);
      }
      
      throw new ChirpstackApiError(0, 'Unknown error occurred', []);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/api/internal/profile');
      return true;
    } catch (error) {
      console.error('Chirpstack connection test failed:', error);
      return false;
    }
  }

  async getGateways(request: GatewayListRequest = {}): Promise<ChirpstackApiResponse<Gateway[]>> {
    const params = new URLSearchParams();
    
    if (request.limit) params.append('limit', request.limit.toString());
    if (request.offset) params.append('offset', request.offset.toString());
    if (request.search) params.append('search', request.search);
    if (request.tenantId) params.append('tenantId', request.tenantId);
    if (request.multicastGroupId) params.append('multicastGroupId', request.multicastGroupId);

    const queryString = params.toString();
    const endpoint = `/api/gateways${queryString ? `?${queryString}` : ''}`;
    
    return this.makeRequest<ChirpstackApiResponse<Gateway[]>>(endpoint);
  }

  async getGateway(gatewayId: string): Promise<Gateway> {
    const response = await this.makeRequest<{ gateway: Gateway }>(`/api/gateways/${gatewayId}`);
    return response.gateway;
  }

  async getGatewayStats(request: GatewayStatsRequest): Promise<GatewayStats[]> {
    const params = new URLSearchParams({
      interval: request.interval,
      startTimestamp: request.startTimestamp.toISOString(),
      endTimestamp: request.endTimestamp.toISOString(),
    });

    const endpoint = `/api/gateways/${request.gatewayId}/stats?${params.toString()}`;
    const response = await this.makeRequest<{ result: GatewayStats[] }>(endpoint);
    
    return response.result.map(stat => ({
      ...stat,
      timestamp: new Date(stat.timestamp),
    }));
  }

  async getGatewayStatus(gatewayId: string): Promise<GatewayStatus> {
    try {
      const gateway = await this.getGateway(gatewayId);
      const now = new Date();
      const lastSeen = gateway.lastSeenAt ? new Date(gateway.lastSeenAt) : null;
      
      let status: GatewayStatus['status'] = 'unknown';
      let uptime = 0;

      if (lastSeen) {
        const timeDiff = now.getTime() - lastSeen.getTime();
        const minutesSinceLastSeen = timeDiff / (1000 * 60);
        
        // Consider gateway online if seen within last 5 minutes
        status = minutesSinceLastSeen <= 5 ? 'online' : 'offline';
        
        // Calculate uptime based on first seen and last seen
        if (gateway.firstSeenAt) {
          const firstSeen = new Date(gateway.firstSeenAt);
          uptime = lastSeen.getTime() - firstSeen.getTime();
        }
      }

      return {
        gatewayId,
        status,
        lastSeen: lastSeen || now,
        uptime,
        version: gateway.metadata?.version,
        configVersion: gateway.metadata?.configVersion,
        region: gateway.metadata?.region,
      };
    } catch (error) {
      console.error(`Failed to get gateway status for ${gatewayId}:`, error);
      return {
        gatewayId,
        status: 'unknown',
        lastSeen: new Date(),
        uptime: 0,
      };
    }
  }

  async getGatewayMetrics(
    gatewayId: string,
    startDate: Date,
    endDate: Date,
    interval: 'HOUR' | 'DAY' | 'MONTH' = 'HOUR'
  ): Promise<GatewayMetrics> {
    try {
      const stats = await this.getGatewayStats({
        gatewayId,
        interval,
        startTimestamp: startDate,
        endTimestamp: endDate,
      });

      const totalPackets = stats.reduce((sum, stat) => sum + stat.rxPacketsReceived + stat.txPacketsReceived, 0);
      const successfulPackets = stats.reduce((sum, stat) => sum + stat.rxPacketsReceivedOk + stat.txPacketsEmitted, 0);
      const errorRate = totalPackets > 0 ? ((totalPackets - successfulPackets) / totalPackets) * 100 : 0;

      // Calculate average RSSI and SNR from metadata if available
      let totalRssi = 0;
      let totalSnr = 0;
      let rssiCount = 0;
      let snrCount = 0;

      const dataPoints = stats.map(stat => {
        const rssi = parseFloat(stat.metadata?.rssi || '0');
        const snr = parseFloat(stat.metadata?.snr || '0');
        
        if (rssi !== 0) {
          totalRssi += rssi;
          rssiCount++;
        }
        if (snr !== 0) {
          totalSnr += snr;
          snrCount++;
        }

        return {
          timestamp: stat.timestamp,
          rxPackets: stat.rxPacketsReceived,
          txPackets: stat.txPacketsReceived,
          rssi,
          snr,
        };
      });

      const averageRssi = rssiCount > 0 ? totalRssi / rssiCount : 0;
      const averageSnr = snrCount > 0 ? totalSnr / snrCount : 0;

      // Calculate uptime percentage based on expected data points
      const expectedDataPoints = this.calculateExpectedDataPoints(startDate, endDate, interval);
      const uptimePercentage = expectedDataPoints > 0 ? (stats.length / expectedDataPoints) * 100 : 0;

      return {
        gatewayId,
        timeRange: { start: startDate, end: endDate },
        totalPackets,
        successfulPackets,
        errorRate,
        averageRssi,
        averageSnr,
        uptimePercentage: Math.min(100, uptimePercentage),
        dataPoints,
      };
    } catch (error) {
      console.error(`Failed to get gateway metrics for ${gatewayId}:`, error);
      return {
        gatewayId,
        timeRange: { start: startDate, end: endDate },
        totalPackets: 0,
        successfulPackets: 0,
        errorRate: 0,
        averageRssi: 0,
        averageSnr: 0,
        uptimePercentage: 0,
        dataPoints: [],
      };
    }
  }

  private calculateExpectedDataPoints(
    startDate: Date,
    endDate: Date,
    interval: 'HOUR' | 'DAY' | 'MONTH'
  ): number {
    const timeDiff = endDate.getTime() - startDate.getTime();
    
    switch (interval) {
      case 'HOUR':
        return Math.ceil(timeDiff / (1000 * 60 * 60)); // Hours
      case 'DAY':
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Days
      case 'MONTH':
        return Math.ceil(timeDiff / (1000 * 60 * 60 * 24 * 30)); // Approximate months
      default:
        return 0;
    }
  }

  cancelRequests(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
  }

  updateConfig(config: ChirpstackConfig): void {
    this.config = config;
  }
}

export class ChirpstackApiError extends Error implements ChirpstackError {
  public code: number;
  public details: Array<{ typeUrl: string; value: string }>;

  constructor(code: number, message: string, details: Array<{ typeUrl: string; value: string }>) {
    super(message);
    this.name = 'ChirpstackApiError';
    this.code = code;
    this.details = details;
  }
}