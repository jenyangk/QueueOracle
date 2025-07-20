/**
 * Dexie.js database implementation for secure storage
 */

import Dexie, { type Table } from 'dexie';
import type {
  ConnectionProfile,
  ServiceBusMessage,
  MessageAnalytics,
  FieldAnalytics,
  AppSettings,
  ChirpstackConnection,
  ChirpstackGateway,
} from './types';

export class AppDatabase extends Dexie {
  // Tables
  connectionProfiles!: Table<ConnectionProfile>;
  messages!: Table<ServiceBusMessage>;
  analytics!: Table<MessageAnalytics>;
  fieldAnalytics!: Table<FieldAnalytics>;
  appSettings!: Table<AppSettings>;
  chirpstackConnections!: Table<ChirpstackConnection>;
  chirpstackGateways!: Table<ChirpstackGateway>;

  constructor() {
    super('AzureServiceBusExplorerDB');
    
    this.version(1).stores({
      connectionProfiles: 'id, name, type, createdAt, lastUsed, isActive',
      messages: 'messageId, connectionId, queueOrTopicName, enqueuedTimeUtc, sequenceNumber, analyzedAt',
      analytics: 'id, connectionId, lastUpdated',
      fieldAnalytics: 'id, connectionId, fieldPath, lastUpdated',
      appSettings: 'id, version',
      chirpstackConnections: 'id, name, createdAt, lastUsed, isActive',
      chirpstackGateways: 'id, gatewayId, connectionId, name, createdAt, updatedAt, lastSeenAt, isOnline',
    });

    // Add hooks for data validation and transformation
    this.connectionProfiles.hook('creating', (_primKey, obj, _trans) => {
      obj.createdAt = obj.createdAt || new Date();
      obj.lastUsed = obj.lastUsed || new Date();
    });

    this.connectionProfiles.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).lastUsed = new Date();
    });

    this.messages.hook('creating', (_primKey, obj, _trans) => {
      obj.analyzedAt = obj.analyzedAt || new Date();
    });

    this.analytics.hook('creating', (_primKey, obj, _trans) => {
      obj.lastUpdated = obj.lastUpdated || new Date();
    });

    this.analytics.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).lastUpdated = new Date();
    });

    this.fieldAnalytics.hook('creating', (_primKey, obj, _trans) => {
      obj.lastUpdated = obj.lastUpdated || new Date();
    });

    this.fieldAnalytics.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).lastUpdated = new Date();
    });

    this.chirpstackConnections.hook('creating', (_primKey, obj, _trans) => {
      obj.createdAt = obj.createdAt || new Date();
      obj.lastUsed = obj.lastUsed || new Date();
    });

    this.chirpstackConnections.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).lastUsed = new Date();
    });

    this.chirpstackGateways.hook('creating', (_primKey, obj, _trans) => {
      obj.createdAt = obj.createdAt || new Date();
      obj.updatedAt = obj.updatedAt || new Date();
    });

    this.chirpstackGateways.hook('updating', (modifications, _primKey, _obj, _trans) => {
      (modifications as any).updatedAt = new Date();
    });
  }

  /**
   * Initialize database with default settings
   */
  async initialize(): Promise<void> {
    try {
      await this.open();
      
      // Create default app settings if they don't exist
      const existingSettings = await this.appSettings.get('default');
      if (!existingSettings) {
        const defaultSettings: AppSettings = {
          id: 'default',
          theme: 'green',
          autoRefresh: true,
          refreshInterval: 30000, // 30 seconds
          maxMessagesCache: 10000,
          enableAnalytics: true,
          enableNotifications: true,
          version: '1.0.0',
        };
        await this.appSettings.add(defaultSettings);
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all([
        this.connectionProfiles.clear(),
        this.messages.clear(),
        this.analytics.clear(),
        this.fieldAnalytics.clear(),
        this.chirpstackConnections.clear(),
        this.chirpstackGateways.clear(),
      ]);
    });
  }

  /**
   * Get database storage statistics
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    messageCount: number;
    connectionCount: number;
    analyticsCount: number;
  }> {
    const [messageCount, connectionCount, analyticsCount] = await Promise.all([
      this.messages.count(),
      this.connectionProfiles.count(),
      this.analytics.count(),
    ]);

    // Estimate total size (this is approximate)
    const totalSize = await this.estimateSize();

    return {
      totalSize,
      messageCount,
      connectionCount,
      analyticsCount,
    };
  }

  /**
   * Estimate database size (approximate)
   */
  private async estimateSize(): Promise<number> {
    try {
      // Use navigator.storage.estimate() if available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      }
      
      // Fallback: rough estimation based on record counts
      const [messageCount, connectionCount, analyticsCount] = await Promise.all([
        this.messages.count(),
        this.connectionProfiles.count(),
        this.analytics.count(),
      ]);

      // Rough estimates: messages ~2KB, connections ~1KB, analytics ~5KB
      return (messageCount * 2048) + (connectionCount * 1024) + (analyticsCount * 5120);
    } catch (error) {
      console.warn('Could not estimate storage size:', error);
      return 0;
    }
  }

  /**
   * Export all data for backup
   */
  async exportData(): Promise<unknown> {
    const [
      connectionProfiles,
      messages,
      analytics,
      fieldAnalytics,
      appSettings,
      chirpstackConnections,
      chirpstackGateways,
    ] = await Promise.all([
      this.connectionProfiles.toArray(),
      this.messages.toArray(),
      this.analytics.toArray(),
      this.fieldAnalytics.toArray(),
      this.appSettings.toArray(),
      this.chirpstackConnections.toArray(),
      this.chirpstackGateways.toArray(),
    ]);

    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      data: {
        connectionProfiles,
        messages,
        analytics,
        fieldAnalytics,
        appSettings,
        chirpstackConnections,
        chirpstackGateways,
      },
    };
  }

  /**
   * Import data from backup
   */
  async importData(data: any): Promise<void> {
    if (!data || !data.data) {
      throw new Error('Invalid import data format');
    }

    await this.transaction('rw', this.tables, async () => {
      const { data: importData } = data;

      // Clear existing data
      await this.clearAllData();

      // Import data
      if (importData.connectionProfiles?.length) {
        await this.connectionProfiles.bulkAdd(importData.connectionProfiles);
      }
      if (importData.messages?.length) {
        await this.messages.bulkAdd(importData.messages);
      }
      if (importData.analytics?.length) {
        await this.analytics.bulkAdd(importData.analytics);
      }
      if (importData.fieldAnalytics?.length) {
        await this.fieldAnalytics.bulkAdd(importData.fieldAnalytics);
      }
      if (importData.appSettings?.length) {
        await this.appSettings.bulkAdd(importData.appSettings);
      }
      if (importData.chirpstackConnections?.length) {
        await this.chirpstackConnections.bulkAdd(importData.chirpstackConnections);
      }
      if (importData.chirpstackGateways?.length) {
        await this.chirpstackGateways.bulkAdd(importData.chirpstackGateways);
      }
    });
  }

  /**
   * Cleanup old data based on retention policies
   */
  async cleanupOldData(retentionDays: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    await this.transaction('rw', [this.messages, this.analytics, this.fieldAnalytics], async () => {
      // Clean up old messages
      await this.messages.where('enqueuedTimeUtc').below(cutoffDate).delete();
      
      // Clean up old analytics
      await this.analytics.where('lastUpdated').below(cutoffDate).delete();
      await this.fieldAnalytics.where('lastUpdated').below(cutoffDate).delete();
    });
  }

  // Compatibility methods for tests
  async saveConnection(connection: ConnectionProfile): Promise<void> {
    await this.connectionProfiles.put(connection);
  }
  
  async getConnection(id: string): Promise<ConnectionProfile | undefined> {
    return this.connectionProfiles.get(id);
  }
  
  async getAllConnections(): Promise<ConnectionProfile[]> {
    return this.connectionProfiles.toArray();
  }
  
  async deleteConnection(id: string): Promise<void> {
    await this.connectionProfiles.delete(id);
  }
  
  async saveMessages(messages: ServiceBusMessage[]): Promise<void> {
    await this.messages.bulkPut(messages);
  }
  
  async getMessages(connectionId: string, startDate?: Date, endDate?: Date): Promise<ServiceBusMessage[]> {
    let query = this.messages.where('connectionId').equals(connectionId);
    if (startDate && endDate) {
      query = query.and(item => {
        const date = new Date(item.enqueuedTimeUtc);
        return date >= startDate && date <= endDate;
      });
    }
    return query.toArray();
  }
  
  async getRecentMessages(connectionId: string, limit: number): Promise<ServiceBusMessage[]> {
    return this.messages
      .where('connectionId').equals(connectionId)
      .reverse()
      .limit(limit)
      .toArray();
  }
  
  async deleteMessages(connectionId: string, messageIds?: string[]): Promise<number> {
    if (messageIds && messageIds.length > 0) {
      return this.messages
        .where('connectionId').equals(connectionId)
        .and(item => messageIds.includes(item.messageId))
        .delete();
    }
    return this.messages.where('connectionId').equals(connectionId).delete();
  }
  
  async getMessageCount(connectionId: string): Promise<number> {
    return this.messages.where('connectionId').equals(connectionId).count();
  }
  
  async saveAnalytics(analytics: MessageAnalytics): Promise<void> {
    await this.analytics.put(analytics);
  }
  
  async getAnalytics(connectionId: string): Promise<MessageAnalytics | undefined> {
    return this.analytics.where('connectionId').equals(connectionId).first();
  }
  
  async deleteAnalytics(connectionId: string): Promise<void> {
    await this.analytics.where('connectionId').equals(connectionId).delete();
  }
  
  async clearAll(): Promise<void> {
    await this.delete();
    await this.open();
  }
  
  async getStats(): Promise<{ messageCount: number; connectionCount: number; }> {
    const messageCount = await this.messages.count();
    const connectionCount = await this.connectionProfiles.count();
    return { messageCount, connectionCount };
  }
}

// Singleton instance
export const db = new AppDatabase();