import { ChirpstackApiClient, ChirpstackApiError } from './ChirpstackApiClient';
import type {
  ChirpstackConfig,
  Gateway,
  GatewayStatus,
  GatewayMetrics,
  ChirpstackConnectionState,
  GatewayListRequest,
} from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
}

export class ChirpstackService {
  private client: ChirpstackApiClient | null = null;
  private cache = new Map<string, CacheEntry<any>>();
  private connectionState: ChirpstackConnectionState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    lastConnected: null,
    config: null,
  };
  private retryAttempts = 0;
  private maxRetryAttempts = 3;
  private retryDelay = 1000; // Start with 1 second
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000); // Cleanup every minute
  }

  async connect(config: ChirpstackConfig): Promise<void> {
    this.connectionState.isConnecting = true;
    this.connectionState.error = null;

    try {
      this.client = new ChirpstackApiClient(config);
      
      // Test the connection
      const isConnected = await this.client.testConnection();
      
      if (!isConnected) {
        throw new Error('Failed to connect to Chirpstack server');
      }

      this.connectionState = {
        isConnected: true,
        isConnecting: false,
        error: null,
        lastConnected: new Date(),
        config,
      };

      this.retryAttempts = 0;
      this.startMonitoring();
      
    } catch (error) {
      this.connectionState.isConnecting = false;
      this.connectionState.error = error instanceof Error ? error.message : 'Unknown connection error';
      
      // Implement exponential backoff retry
      if (this.retryAttempts < this.maxRetryAttempts) {
        this.retryAttempts++;
        const delay = this.retryDelay * Math.pow(2, this.retryAttempts - 1);
        
        setTimeout(() => {
          this.connect(config);
        }, delay);
      }
      
      throw error;
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.cancelRequests();
      this.client = null;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      error: null,
      lastConnected: this.connectionState.lastConnected,
      config: null,
    };

    this.cache.clear();
  }

  getConnectionState(): ChirpstackConnectionState {
    return { ...this.connectionState };
  }

  async getGateways(request: GatewayListRequest = {}, useCache = true): Promise<Gateway[]> {
    this.ensureConnected();
    
    const cacheKey = `gateways_${JSON.stringify(request)}`;
    
    if (useCache) {
      const cached = this.getFromCache<Gateway[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.client!.getGateways(request);
      const gateways = response.result;
      
      // Cache for 5 minutes
      this.setCache(cacheKey, gateways, 5 * 60 * 1000);
      
      return gateways;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getGateway(gatewayId: string, useCache = true): Promise<Gateway> {
    this.ensureConnected();
    
    const cacheKey = `gateway_${gatewayId}`;
    
    if (useCache) {
      const cached = this.getFromCache<Gateway>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const gateway = await this.client!.getGateway(gatewayId);
      
      // Cache for 2 minutes
      this.setCache(cacheKey, gateway, 2 * 60 * 1000);
      
      return gateway;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getGatewayStatus(gatewayId: string, useCache = true): Promise<GatewayStatus> {
    this.ensureConnected();
    
    const cacheKey = `gateway_status_${gatewayId}`;
    
    if (useCache) {
      const cached = this.getFromCache<GatewayStatus>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const status = await this.client!.getGatewayStatus(gatewayId);
      
      // Cache for 30 seconds (status changes frequently)
      this.setCache(cacheKey, status, 30 * 1000);
      
      return status;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getGatewayMetrics(
    gatewayId: string,
    startDate: Date,
    endDate: Date,
    interval: 'HOUR' | 'DAY' | 'MONTH' = 'HOUR',
    useCache = true
  ): Promise<GatewayMetrics> {
    this.ensureConnected();
    
    const cacheKey = `gateway_metrics_${gatewayId}_${startDate.toISOString()}_${endDate.toISOString()}_${interval}`;
    
    if (useCache) {
      const cached = this.getFromCache<GatewayMetrics>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const metrics = await this.client!.getGatewayMetrics(gatewayId, startDate, endDate, interval);
      
      // Cache for 10 minutes
      this.setCache(cacheKey, metrics, 10 * 60 * 1000);
      
      return metrics;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  async getMultipleGatewayStatuses(gatewayIds: string[]): Promise<Map<string, GatewayStatus>> {
    const statusMap = new Map<string, GatewayStatus>();
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < gatewayIds.length; i += batchSize) {
      const batch = gatewayIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (gatewayId) => {
        try {
          const status = await this.getGatewayStatus(gatewayId);
          return { gatewayId, status };
        } catch (error) {
          console.error(`Failed to get status for gateway ${gatewayId}:`, error);
          return {
            gatewayId,
            status: {
              gatewayId,
              status: 'unknown' as const,
              lastSeen: new Date(),
              uptime: 0,
            }
          };
        }
      });

      const results = await Promise.all(promises);
      results.forEach(({ gatewayId, status }) => {
        statusMap.set(gatewayId, status);
      });

      // Small delay between batches
      if (i + batchSize < gatewayIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return statusMap;
  }

  private ensureConnected(): void {
    if (!this.client || !this.connectionState.isConnected) {
      throw new Error('Not connected to Chirpstack server');
    }
  }

  private handleApiError(error: unknown): void {
    if (error instanceof ChirpstackApiError) {
      // Handle specific API errors
      if (error.code === 401 || error.code === 403) {
        this.connectionState.error = 'Authentication failed';
        this.disconnect();
      } else if (error.code === 0) {
        // Network error
        this.connectionState.error = 'Network connection lost';
      }
    }
  }

  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
    });
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = new Date().getTime();
    const entryTime = entry.timestamp.getTime();
    
    if (now - entryTime > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private cleanupCache(): void {
    const now = new Date().getTime();
    
    for (const [key, entry] of this.cache.entries()) {
      const entryTime = entry.timestamp.getTime();
      if (now - entryTime > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private startMonitoring(): void {
    // Monitor connection health every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      if (this.client && this.connectionState.isConnected) {
        try {
          const isConnected = await this.client.testConnection();
          if (!isConnected) {
            this.connectionState.error = 'Connection lost';
            this.connectionState.isConnected = false;
          }
        } catch {
          this.connectionState.error = 'Connection monitoring failed';
          this.connectionState.isConnected = false;
        }
      }
    }, 30000);
  }

  // Utility method to aggregate gateway statistics
  async getGatewayStatsSummary(gatewayIds: string[], timeRange: { start: Date; end: Date }): Promise<{
    totalGateways: number;
    onlineGateways: number;
    offlineGateways: number;
    totalPackets: number;
    averageUptime: number;
    topPerformingGateways: Array<{ gatewayId: string; metrics: GatewayMetrics }>;
  }> {
    const statuses = await this.getMultipleGatewayStatuses(gatewayIds);
    const onlineGateways = Array.from(statuses.values()).filter(s => s.status === 'online').length;
    const offlineGateways = gatewayIds.length - onlineGateways;

    // Get metrics for all gateways
    const metricsPromises = gatewayIds.map(async (gatewayId) => {
      try {
        const metrics = await this.getGatewayMetrics(gatewayId, timeRange.start, timeRange.end);
        return { gatewayId, metrics };
      } catch (error) {
        console.error(`Failed to get metrics for gateway ${gatewayId}:`, error);
        return null;
      }
    });

    const metricsResults = (await Promise.all(metricsPromises)).filter(Boolean) as Array<{ gatewayId: string; metrics: GatewayMetrics }>;
    
    const totalPackets = metricsResults.reduce((sum, result) => sum + result.metrics.totalPackets, 0);
    const averageUptime = metricsResults.length > 0 
      ? metricsResults.reduce((sum, result) => sum + result.metrics.uptimePercentage, 0) / metricsResults.length
      : 0;

    // Sort by total packets to find top performing gateways
    const topPerformingGateways = metricsResults
      .sort((a, b) => b.metrics.totalPackets - a.metrics.totalPackets)
      .slice(0, 5);

    return {
      totalGateways: gatewayIds.length,
      onlineGateways,
      offlineGateways,
      totalPackets,
      averageUptime,
      topPerformingGateways,
    };
  }
}