/**
 * Secure storage service that integrates Dexie.js with encryption
 */

import { db, type AppDatabase } from './Database';
import { encryptionService, type EncryptionService } from '../crypto/EncryptionService';
import { secureKeyStorage, type SecureKeyStorage } from '../crypto/SecureKeyStorage';
import type {
  SecureStorage,
  ConnectionProfile,
  ServiceBusMessage,
  MessageAnalytics,
  FieldAnalytics,
  AppSettings,
  ChirpstackConnection,
  ChirpstackGateway,
} from './types';

export class SecureStorageService implements SecureStorage {
  private readonly db: AppDatabase;
  private readonly encryption: EncryptionService;
  private readonly keyStorage: SecureKeyStorage;
  private readonly encryptionKeyId = 'app-encryption-key';

  constructor(
    database: AppDatabase,
    encryptionService: EncryptionService,
    keyStorage: SecureKeyStorage
  ) {
    this.db = database;
    this.encryption = encryptionService;
    this.keyStorage = keyStorage;
  }

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
    await this.ensureEncryptionKey();
  }

  /**
   * Ensure encryption key exists for the application
   */
  private async ensureEncryptionKey(): Promise<void> {
    const hasKey = await this.keyStorage.hasKey(this.encryptionKeyId);
    if (!hasKey) {
      const key = await this.encryption.generateKey();
      await this.keyStorage.storeKey(this.encryptionKeyId, key);
    }
  }

  /**
   * Get the application encryption key
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    const key = await this.keyStorage.retrieveKey(this.encryptionKeyId);
    if (!key) {
      throw new Error('Encryption key not found');
    }
    return key;
  }

  /**
   * Encrypt sensitive data
   */
  private async encryptSensitiveData(data: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const encrypted = await this.encryption.encrypt(data, key);
      return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  private async decryptSensitiveData(encryptedData: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const binaryString = atob(encryptedData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return await this.encryption.decrypt(bytes.buffer, key);
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Connection Profile Methods
  async storeConnectionProfile(profile: ConnectionProfile): Promise<void> {
    try {
      const encryptedProfile = {
        ...profile,
        connectionString: await this.encryptSensitiveData(profile.connectionString),
      };
      await this.db.connectionProfiles.put(encryptedProfile);
    } catch (error) {
      throw new Error(`Failed to store connection profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConnectionProfile(id: string): Promise<ConnectionProfile | null> {
    try {
      const profile = await this.db.connectionProfiles.get(id);
      if (!profile) return null;

      return {
        ...profile,
        connectionString: await this.decryptSensitiveData(profile.connectionString),
      };
    } catch (error) {
      throw new Error(`Failed to get connection profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllConnectionProfiles(): Promise<ConnectionProfile[]> {
    try {
      const profiles = await this.db.connectionProfiles.toArray();
      return Promise.all(
        profiles.map(async (profile) => ({
          ...profile,
          connectionString: await this.decryptSensitiveData(profile.connectionString),
        }))
      );
    } catch (error) {
      throw new Error(`Failed to get connection profiles: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateConnectionProfile(profile: ConnectionProfile): Promise<void> {
    try {
      const encryptedProfile = {
        ...profile,
        connectionString: await this.encryptSensitiveData(profile.connectionString),
      };
      await this.db.connectionProfiles.put(encryptedProfile);
    } catch (error) {
      throw new Error(`Failed to update connection profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteConnectionProfile(id: string): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.connectionProfiles, this.db.messages, this.db.analytics], async () => {
        await this.db.connectionProfiles.delete(id);
        await this.db.messages.where('connectionId').equals(id).delete();
        await this.db.analytics.where('connectionId').equals(id).delete();
      });
    } catch (error) {
      throw new Error(`Failed to delete connection profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Service Bus Message Methods
  async storeMessages(messages: ServiceBusMessage[]): Promise<void> {
    try {
      await this.db.messages.bulkPut(messages);
    } catch (error) {
      throw new Error(`Failed to store messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMessages(connectionId: string, limit: number = 1000, offset: number = 0): Promise<ServiceBusMessage[]> {
    try {
      return await this.db.messages
        .where('connectionId')
        .equals(connectionId)
        .reverse()
        .offset(offset)
        .limit(limit)
        .toArray();
    } catch (error) {
      throw new Error(`Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMessagesByDateRange(connectionId: string, startDate: Date, endDate: Date): Promise<ServiceBusMessage[]> {
    try {
      return await this.db.messages
        .where('connectionId')
        .equals(connectionId)
        .and(message => message.enqueuedTimeUtc >= startDate && message.enqueuedTimeUtc <= endDate)
        .toArray();
    } catch (error) {
      throw new Error(`Failed to get messages by date range: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteMessages(connectionId: string, messageIds?: string[]): Promise<void> {
    try {
      if (messageIds && messageIds.length > 0) {
        await this.db.messages.bulkDelete(messageIds);
      } else {
        await this.db.messages.where('connectionId').equals(connectionId).delete();
      }
    } catch (error) {
      throw new Error(`Failed to delete messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clearAllMessages(connectionId: string): Promise<void> {
    try {
      await this.db.messages.where('connectionId').equals(connectionId).delete();
    } catch (error) {
      throw new Error(`Failed to clear messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Analytics Methods
  async storeAnalytics(analytics: MessageAnalytics): Promise<void> {
    try {
      await this.db.analytics.put(analytics);
    } catch (error) {
      throw new Error(`Failed to store analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAnalytics(connectionId: string): Promise<MessageAnalytics | null> {
    try {
      return await this.db.analytics.where('connectionId').equals(connectionId).first() || null;
    } catch (error) {
      throw new Error(`Failed to get analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateFieldAnalytics(connectionId: string, fieldAnalytics: FieldAnalytics[]): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.fieldAnalytics], async () => {
        // Remove existing field analytics for this connection
        await this.db.fieldAnalytics.where('connectionId').equals(connectionId).delete();
        // Add new field analytics
        await this.db.fieldAnalytics.bulkAdd(fieldAnalytics);
      });
    } catch (error) {
      throw new Error(`Failed to update field analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteAnalytics(connectionId: string): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.analytics, this.db.fieldAnalytics], async () => {
        await this.db.analytics.where('connectionId').equals(connectionId).delete();
        await this.db.fieldAnalytics.where('connectionId').equals(connectionId).delete();
      });
    } catch (error) {
      throw new Error(`Failed to delete analytics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // App Settings Methods
  async storeSettings(settings: AppSettings): Promise<void> {
    try {
      await this.db.appSettings.put(settings);
    } catch (error) {
      throw new Error(`Failed to store settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSettings(): Promise<AppSettings | null> {
    try {
      return await this.db.appSettings.get('default') || null;
    } catch (error) {
      throw new Error(`Failed to get settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<void> {
    try {
      await this.db.appSettings.update('default', settings);
    } catch (error) {
      throw new Error(`Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Chirpstack Methods
  async storeChirpstackConnection(connection: ChirpstackConnection): Promise<void> {
    try {
      const encryptedConnection = {
        ...connection,
        apiKey: await this.encryptSensitiveData(connection.apiKey),
      };
      await this.db.chirpstackConnections.put(encryptedConnection);
    } catch (error) {
      throw new Error(`Failed to store Chirpstack connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getChirpstackConnection(id: string): Promise<ChirpstackConnection | null> {
    try {
      const connection = await this.db.chirpstackConnections.get(id);
      if (!connection) return null;

      return {
        ...connection,
        apiKey: await this.decryptSensitiveData(connection.apiKey),
      };
    } catch (error) {
      throw new Error(`Failed to get Chirpstack connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllChirpstackConnections(): Promise<ChirpstackConnection[]> {
    try {
      const connections = await this.db.chirpstackConnections.toArray();
      return Promise.all(
        connections.map(async (connection) => ({
          ...connection,
          apiKey: await this.decryptSensitiveData(connection.apiKey),
        }))
      );
    } catch (error) {
      throw new Error(`Failed to get Chirpstack connections: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateChirpstackConnection(connection: ChirpstackConnection): Promise<void> {
    try {
      const encryptedConnection = {
        ...connection,
        apiKey: await this.encryptSensitiveData(connection.apiKey),
      };
      await this.db.chirpstackConnections.put(encryptedConnection);
    } catch (error) {
      throw new Error(`Failed to update Chirpstack connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteChirpstackConnection(id: string): Promise<void> {
    try {
      await this.db.transaction('rw', [this.db.chirpstackConnections, this.db.chirpstackGateways], async () => {
        await this.db.chirpstackConnections.delete(id);
        await this.db.chirpstackGateways.where('connectionId').equals(id).delete();
      });
    } catch (error) {
      throw new Error(`Failed to delete Chirpstack connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async storeGateways(gateways: ChirpstackGateway[]): Promise<void> {
    try {
      await this.db.chirpstackGateways.bulkPut(gateways);
    } catch (error) {
      throw new Error(`Failed to store gateways: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGateways(connectionId: string): Promise<ChirpstackGateway[]> {
    try {
      return await this.db.chirpstackGateways.where('connectionId').equals(connectionId).toArray();
    } catch (error) {
      throw new Error(`Failed to get gateways: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateGateway(gateway: ChirpstackGateway): Promise<void> {
    try {
      await this.db.chirpstackGateways.put(gateway);
    } catch (error) {
      throw new Error(`Failed to update gateway: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteGateways(connectionId: string): Promise<void> {
    try {
      await this.db.chirpstackGateways.where('connectionId').equals(connectionId).delete();
    } catch (error) {
      throw new Error(`Failed to delete gateways: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility Methods
  async clearAllData(): Promise<void> {
    try {
      await this.db.clearAllData();
    } catch (error) {
      throw new Error(`Failed to clear all data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exportData(): Promise<unknown> {
    try {
      return await this.db.exportData();
    } catch (error) {
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importData(data: unknown): Promise<void> {
    try {
      await this.db.importData(data);
    } catch (error) {
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStorageStats(): Promise<{
    totalSize: number;
    messageCount: number;
    connectionCount: number;
    analyticsCount: number;
  }> {
    try {
      return await this.db.getStorageStats();
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Compatibility methods for tests
  async getRecentMessages(connectionId: string, limit: number): Promise<ServiceBusMessage[]> {
    return this.getMessages(connectionId, limit);
  }
  
  async getMessageCount(connectionId: string): Promise<number> {
    const messages = await this.getMessages(connectionId);
    return messages.length;
  }
  
  async clearAll(): Promise<void> {
    return this.clearAllData();
  }

  // Additional compatibility methods for services
  async retrieve(key: string, _decrypt: boolean = true): Promise<any> {
    // Simple implementation using localStorage for now
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async store(key: string, data: any, _encrypt: boolean = true): Promise<void> {
    // Simple implementation using localStorage for now
    localStorage.setItem(key, JSON.stringify(data));
  }

  async get<T>(key: string): Promise<T | null> {
    // Simple implementation using localStorage for now
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }

  async set(key: string, data: any): Promise<void> {
    // Simple implementation using localStorage for now
    localStorage.setItem(key, JSON.stringify(data));
  }
}

// Singleton instance
export const secureStorage = new SecureStorageService(db, encryptionService, secureKeyStorage);