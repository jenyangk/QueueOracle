/**
 * Unit tests for SecureStorageService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecureStorageService } from '../SecureStorageService';
import type { ServiceBusMessage, ConnectionProfile } from '../types';

// Mock dependencies
vi.mock('../Database', () => ({
  Database: vi.fn().mockImplementation(() => ({
    saveConnection: vi.fn(),
    getConnection: vi.fn(),
    getAllConnections: vi.fn(),
    deleteConnection: vi.fn(),
    saveMessages: vi.fn(),
    getMessages: vi.fn(),
    getRecentMessages: vi.fn(),
    deleteMessages: vi.fn(),
    getMessageCount: vi.fn(),
    saveAnalytics: vi.fn(),
    getAnalytics: vi.fn(),
    deleteAnalytics: vi.fn(),
    clearAll: vi.fn(),
    getStats: vi.fn(),
    exportData: vi.fn(),
    importData: vi.fn(),
  })),
}));

vi.mock('../../crypto/EncryptionService', () => ({
  WebCryptoEncryptionService: vi.fn().mockImplementation(() => ({
    generateKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    deriveKey: vi.fn(),
    generateSalt: vi.fn(),
  })),
}));

vi.mock('../../crypto/SecureKeyStorage', () => ({
  SecureKeyStorage: vi.fn().mockImplementation(() => ({
    storeKey: vi.fn(),
    retrieveKey: vi.fn(),
    deleteKey: vi.fn(),
    clearAllKeys: vi.fn(),
    listKeys: vi.fn(),
  })),
}));

describe('SecureStorageService', () => {
  let secureStorage: SecureStorageService;
  let mockDatabase: any;
  let mockEncryption: any;
  let mockKeyStorage: any;

  beforeEach(() => {
    mockDatabase = {
      connectionProfiles: { add: vi.fn(), get: vi.fn(), delete: vi.fn(), toArray: vi.fn() },
      messages: { add: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), toArray: vi.fn() },
      analytics: { add: vi.fn(), get: vi.fn() }
    };
    mockEncryption = { encrypt: vi.fn(), decrypt: vi.fn() };
    mockKeyStorage = { getKey: vi.fn(), storeKey: vi.fn() };
    
    secureStorage = new SecureStorageService(mockDatabase, mockEncryption, mockKeyStorage);
    vi.clearAllMocks();
  });

  describe('connection management', () => {
    const mockConnection: ConnectionProfile = {
      id: 'test-connection',
      name: 'Test Connection',
      connectionString: 'test-connection-string',
      type: 'connectionString',
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    it('should store connection with encrypted connection string', async () => {
      const encryptedData = new ArrayBuffer(32);
      const key = {} as CryptoKey;
      const salt = new Uint8Array(16);

      mockEncryption.generateKey.mockResolvedValue(key);
      mockEncryption.generateSalt.mockReturnValue(salt);
      mockEncryption.encrypt.mockResolvedValue(encryptedData);
      mockKeyStorage.storeKey.mockResolvedValue(undefined);
      mockDatabase.saveConnection.mockResolvedValue(undefined);

      await secureStorage.storeConnectionProfile(mockConnection);

      expect(mockEncryption.encrypt).toHaveBeenCalledWith(
        mockConnection.connectionString,
        key
      );
      expect(mockKeyStorage.storeKey).toHaveBeenCalledWith(
        `connection-${mockConnection.id}`,
        expect.any(ArrayBuffer),
        expect.objectContaining({
          purpose: 'connection-encryption',
          connectionId: mockConnection.id,
        })
      );
      expect(mockDatabase.saveConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockConnection,
          connectionString: expect.any(String), // Base64 encoded encrypted data
        })
      );
    });

    it('should retrieve connection with decrypted connection string', async () => {
      const encryptedConnection = {
        ...mockConnection,
        connectionString: 'base64-encrypted-data',
      };
      const key = {} as CryptoKey;
      const keyData = new ArrayBuffer(32);

      mockDatabase.getConnection.mockResolvedValue(encryptedConnection);
      mockKeyStorage.retrieveKey.mockResolvedValue({
        keyData,
        metadata: { purpose: 'connection-encryption' },
        createdAt: new Date(),
      });
      mockEncryption.importKey.mockResolvedValue(key);
      mockEncryption.decrypt.mockResolvedValue(mockConnection.connectionString);

      const result = await secureStorage.getConnectionProfile('test-connection');

      expect(mockDatabase.getConnection).toHaveBeenCalledWith('test-connection');
      expect(mockEncryption.decrypt).toHaveBeenCalled();
      expect(result?.connectionString).toBe(mockConnection.connectionString);
    });

    it('should return null for non-existent connection', async () => {
      mockDatabase.getConnection.mockResolvedValue(null);

      const result = await secureStorage.getConnectionProfile('non-existent');

      expect(result).toBeNull();
    });

    it('should delete connection and associated key', async () => {
      mockDatabase.deleteConnection.mockResolvedValue(undefined);
      mockKeyStorage.deleteKey.mockResolvedValue(undefined);

      await secureStorage.deleteConnectionProfile('test-connection');

      expect(mockDatabase.deleteConnection).toHaveBeenCalledWith('test-connection');
      expect(mockKeyStorage.deleteKey).toHaveBeenCalledWith('connection-test-connection');
    });

    it('should get all connections with decrypted connection strings', async () => {
      const encryptedConnections = [
        { ...mockConnection, connectionString: 'encrypted1' },
        { ...mockConnection, id: 'conn2', connectionString: 'encrypted2' },
      ];
      const key = {} as CryptoKey;
      const keyData = new ArrayBuffer(32);

      mockDatabase.getAllConnections.mockResolvedValue(encryptedConnections);
      mockKeyStorage.retrieveKey.mockResolvedValue({
        keyData,
        metadata: { purpose: 'connection-encryption' },
        createdAt: new Date(),
      });
      mockEncryption.importKey.mockResolvedValue(key);
      mockEncryption.decrypt.mockResolvedValue('decrypted-connection-string');

      const result = await secureStorage.getAllConnectionProfiles();

      expect(result).toHaveLength(2);
      expect(result[0].connectionString).toBe('decrypted-connection-string');
      expect(result[1].connectionString).toBe('decrypted-connection-string');
    });
  });

  describe('message management', () => {
    const mockMessage: ServiceBusMessage = {
      messageId: 'test-message',
      sequenceNumber: '123',
      enqueuedTimeUtc: new Date(),
      body: { test: 'data' },
      properties: {},
      deliveryCount: 1,
      jsonFields: { test: 'data' },
      analyzedAt: new Date(),
      connectionId: 'test-connection',
      queueOrTopicName: 'test-queue'
    };

    it('should store messages', async () => {
      mockDatabase.saveMessages.mockResolvedValue(undefined);

      await secureStorage.storeMessages([mockMessage]);

      expect(mockDatabase.saveMessages).toHaveBeenCalledWith([mockMessage]);
    });

    it('should get messages', async () => {
      const messages = [mockMessage];
      mockDatabase.getMessages.mockResolvedValue(messages);

      const result = await secureStorage.getMessages('test-connection');

      expect(mockDatabase.getMessages).toHaveBeenCalledWith('test-connection', undefined, undefined);
      expect(result).toEqual(messages);
    });

    it('should get messages with date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const messages = [mockMessage];
      mockDatabase.getMessages.mockResolvedValue(messages);

      const result = await secureStorage.getMessages('test-connection', 1000, 0);

      expect(mockDatabase.getMessages).toHaveBeenCalledWith('test-connection', startDate, endDate);
      expect(result).toEqual(messages);
    });

    it('should get recent messages', async () => {
      const messages = [mockMessage];
      mockDatabase.getRecentMessages.mockResolvedValue(messages);

      const result = await secureStorage.getRecentMessages('test-connection', 10);

      expect(mockDatabase.getRecentMessages).toHaveBeenCalledWith('test-connection', 10);
      expect(result).toEqual(messages);
    });

    it('should delete messages', async () => {
      mockDatabase.deleteMessages.mockResolvedValue(5);

      const deletedCount = await secureStorage.deleteMessages('test-connection');

      expect(mockDatabase.deleteMessages).toHaveBeenCalledWith('test-connection');
      expect(deletedCount).toBe(5);
    });

    it('should get message count', async () => {
      mockDatabase.getMessageCount.mockResolvedValue(100);

      const count = await secureStorage.getMessageCount('test-connection');

      expect(mockDatabase.getMessageCount).toHaveBeenCalledWith('test-connection');
      expect(count).toBe(100);
    });
  });

  describe('analytics management', () => {
    const mockAnalytics = {
      id: 'test-analytics-id',
      connectionId: 'test-connection',
      totalMessages: 100,
      messageTypes: {},
      fieldAnalytics: {},
      timeSeriesData: [],
      correlationMatrix: [],
      lastUpdated: new Date(),
    };

    it('should store analytics', async () => {
      mockDatabase.saveAnalytics.mockResolvedValue(undefined);

      await secureStorage.storeAnalytics(mockAnalytics);

      expect(mockDatabase.saveAnalytics).toHaveBeenCalledWith(mockAnalytics);
    });

    it('should get analytics', async () => {
      mockDatabase.getAnalytics.mockResolvedValue(mockAnalytics);

      const result = await secureStorage.getAnalytics('test-connection');

      expect(mockDatabase.getAnalytics).toHaveBeenCalledWith('test-connection');
      expect(result).toEqual(mockAnalytics);
    });

    it('should delete analytics', async () => {
      mockDatabase.deleteAnalytics.mockResolvedValue(undefined);

      await secureStorage.deleteAnalytics('test-connection');

      expect(mockDatabase.deleteAnalytics).toHaveBeenCalledWith('test-connection');
    });
  });

  describe('utility operations', () => {
    it('should clear all data', async () => {
      mockDatabase.clearAll.mockResolvedValue(undefined);
      mockKeyStorage.clearAllKeys.mockResolvedValue(undefined);

      await secureStorage.clearAll();

      expect(mockDatabase.clearAll).toHaveBeenCalled();
      expect(mockKeyStorage.clearAllKeys).toHaveBeenCalled();
    });

    it('should get storage statistics', async () => {
      const stats = {
        connections: 5,
        messages: 1000,
        analytics: 5,
      };
      mockDatabase.getStats.mockResolvedValue(stats);

      const result = await secureStorage.getStorageStats();

      expect(mockDatabase.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });

    it('should export data', async () => {
      const exportData = {
        connections: [],
        messages: [],
        analytics: [],
        exportedAt: new Date(),
      };
      mockDatabase.exportData.mockResolvedValue(exportData);

      const result = await secureStorage.exportData();

      expect(mockDatabase.exportData).toHaveBeenCalled();
      expect(result).toEqual(exportData);
    });

    it('should import data', async () => {
      const importData = {
        connections: [],
        messages: [],
        analytics: [],
        exportedAt: new Date(),
      };
      mockDatabase.importData.mockResolvedValue(undefined);

      await secureStorage.importData(importData);

      expect(mockDatabase.importData).toHaveBeenCalledWith(importData);
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors', async () => {
      const mockConnection: ConnectionProfile = {
        id: 'test',
        name: 'Test',
        connectionString: 'test',
        type: 'connectionString',
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      mockEncryption.generateKey.mockRejectedValue(new Error('Encryption failed'));

      await expect(secureStorage.storeConnectionProfile(mockConnection)).rejects.toThrow('Encryption failed');
    });

    it('should handle decryption errors', async () => {
      const encryptedConnection = {
        id: 'test',
        name: 'Test',
        connectionString: 'encrypted-data',
        type: 'connectionString' as const,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      mockDatabase.getConnection.mockResolvedValue(encryptedConnection);
      mockKeyStorage.retrieveKey.mockResolvedValue({
        keyData: new ArrayBuffer(32),
        metadata: { purpose: 'connection-encryption' },
        createdAt: new Date(),
      });
      mockEncryption.importKey.mockResolvedValue({} as CryptoKey);
      mockEncryption.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(secureStorage.getConnectionProfile('test')).rejects.toThrow('Decryption failed');
    });

    it('should handle missing encryption keys', async () => {
      const encryptedConnection = {
        id: 'test',
        name: 'Test',
        connectionString: 'encrypted-data',
        type: 'connectionString' as const,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      mockDatabase.getConnection.mockResolvedValue(encryptedConnection);
      mockKeyStorage.retrieveKey.mockResolvedValue(null);

      await expect(secureStorage.getConnectionProfile('test')).rejects.toThrow('Encryption key not found');
    });
  });
});