/**
 * Unit tests for Database service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppDatabase } from '../Database';
import type { ServiceBusMessage, ConnectionProfile } from '../types';

// Mock Dexie
vi.mock('dexie', () => {
  const mockTable = {
    add: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    toArray: vi.fn(),
    where: vi.fn(() => ({
      equals: vi.fn(() => ({
        toArray: vi.fn(),
        delete: vi.fn(),
      })),
      between: vi.fn(() => ({
        toArray: vi.fn(),
      })),
    })),
    orderBy: vi.fn(() => ({
      reverse: vi.fn(() => ({
        limit: vi.fn(() => ({
          toArray: vi.fn(),
        })),
      })),
    })),
    count: vi.fn(),
  };

  return {
    Dexie: vi.fn().mockImplementation(() => ({
      version: vi.fn(() => ({
        stores: vi.fn(),
      })),
      connections: mockTable,
      messages: mockTable,
      analytics: mockTable,
      open: vi.fn(),
      close: vi.fn(),
      delete: vi.fn(),
    })),
  };
});

describe('AppDatabase', () => {
  let database: AppDatabase;
  let mockDb: any;

  beforeEach(() => {
    database = new AppDatabase();
    mockDb = (database as any).db;
    vi.clearAllMocks();
  });

  describe('connection management', () => {
    const mockConnection: ConnectionProfile = {
      id: 'test-connection',
      name: 'Test Connection',
      connectionString: 'encrypted-connection-string',
      type: 'connectionString',
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    it('should save a connection profile', async () => {
      mockDb.connections.put.mockResolvedValue('test-connection');

      await database.saveConnection(mockConnection);

      expect(mockDb.connections.put).toHaveBeenCalledWith(mockConnection);
    });

    it('should get a connection profile by ID', async () => {
      mockDb.connections.get.mockResolvedValue(mockConnection);

      const result = await database.getConnection('test-connection');

      expect(mockDb.connections.get).toHaveBeenCalledWith('test-connection');
      expect(result).toEqual(mockConnection);
    });

    it('should get all connection profiles', async () => {
      const connections = [mockConnection];
      mockDb.connections.toArray.mockResolvedValue(connections);

      const result = await database.getAllConnections();

      expect(mockDb.connections.toArray).toHaveBeenCalled();
      expect(result).toEqual(connections);
    });

    it('should delete a connection profile', async () => {
      mockDb.connections.delete.mockResolvedValue(undefined);

      await database.deleteConnection('test-connection');

      expect(mockDb.connections.delete).toHaveBeenCalledWith('test-connection');
    });
  });

  describe('message management', () => {
    const mockMessage: ServiceBusMessage = {
      messageId: 'test-message',
      sequenceNumber: '123',
      enqueuedTimeUtc: new Date(),
      body: { test: 'data' },
      properties: { prop1: 'value1' },
      deliveryCount: 1,
      jsonFields: { test: 'data' },
      analyzedAt: new Date(),
      connectionId: 'test-connection',
      queueOrTopicName: 'test-queue'
    };

    it('should save messages', async () => {
      mockDb.messages.put.mockResolvedValue('test-message');

      await database.saveMessages([mockMessage]);

      expect(mockDb.messages.put).toHaveBeenCalledWith(mockMessage);
    });

    it('should get messages by connection ID', async () => {
      const messages = [mockMessage];
      mockDb.messages.where().equals().toArray.mockResolvedValue(messages);

      const result = await database.getMessages('test-connection');

      expect(mockDb.messages.where).toHaveBeenCalledWith('connectionId');
      expect(result).toEqual(messages);
    });

    it('should get messages with date range filter', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-12-31');
      const messages = [mockMessage];
      
      mockDb.messages.where().between().toArray.mockResolvedValue(messages);

      const result = await database.getMessages('test-connection', startDate, endDate);

      expect(mockDb.messages.where).toHaveBeenCalledWith('enqueuedTimeUtc');
      expect(result).toEqual(messages);
    });

    it('should get recent messages with limit', async () => {
      const messages = [mockMessage];
      mockDb.messages.where().equals().orderBy().reverse().limit().toArray.mockResolvedValue(messages);

      const result = await database.getRecentMessages('test-connection', 10);

      expect(mockDb.messages.where).toHaveBeenCalledWith('connectionId');
      expect(result).toEqual(messages);
    });

    it('should delete messages by connection ID', async () => {
      mockDb.messages.where().equals().delete.mockResolvedValue(5);

      const deletedCount = await database.deleteMessages('test-connection');

      expect(mockDb.messages.where).toHaveBeenCalledWith('connectionId');
      expect(deletedCount).toBe(5);
    });

    it('should get message count', async () => {
      mockDb.messages.where().equals().count.mockResolvedValue(100);

      const count = await database.getMessageCount('test-connection');

      expect(mockDb.messages.where).toHaveBeenCalledWith('connectionId');
      expect(count).toBe(100);
    });
  });

  describe('analytics management', () => {
    const mockAnalytics = {
      connectionId: 'test-connection',
      totalMessages: 100,
      messageTypes: { type1: 50, type2: 50 },
      fieldAnalytics: {},
      timeSeriesData: [],
      correlationMatrix: [],
      lastUpdated: new Date(),
    };

    it('should save analytics data', async () => {
      mockDb.analytics.put.mockResolvedValue('test-connection');

      await database.saveAnalytics(mockAnalytics);

      expect(mockDb.analytics.put).toHaveBeenCalledWith(mockAnalytics);
    });

    it('should get analytics data by connection ID', async () => {
      mockDb.analytics.get.mockResolvedValue(mockAnalytics);

      const result = await database.getAnalytics('test-connection');

      expect(mockDb.analytics.get).toHaveBeenCalledWith('test-connection');
      expect(result).toEqual(mockAnalytics);
    });

    it('should delete analytics data', async () => {
      mockDb.analytics.delete.mockResolvedValue(undefined);

      await database.deleteAnalytics('test-connection');

      expect(mockDb.analytics.delete).toHaveBeenCalledWith('test-connection');
    });
  });

  describe('database operations', () => {
    it('should clear all data', async () => {
      mockDb.connections.clear.mockResolvedValue(undefined);
      mockDb.messages.clear.mockResolvedValue(undefined);
      mockDb.analytics.clear.mockResolvedValue(undefined);

      await database.clearAll();

      expect(mockDb.connections.clear).toHaveBeenCalled();
      expect(mockDb.messages.clear).toHaveBeenCalled();
      expect(mockDb.analytics.clear).toHaveBeenCalled();
    });

    it('should get database statistics', async () => {
      mockDb.connections.count.mockResolvedValue(5);
      mockDb.messages.count.mockResolvedValue(1000);
      mockDb.analytics.count.mockResolvedValue(5);

      const stats = await database.getStats();

      expect(stats).toEqual({
        connections: 5,
        messages: 1000,
        analytics: 5,
      });
    });

    it('should export all data', async () => {
      const connections = [{ id: 'conn1' }];
      const messages = [{ messageId: 'msg1' }];
      const analytics = [{ connectionId: 'conn1' }];

      mockDb.connections.toArray.mockResolvedValue(connections);
      mockDb.messages.toArray.mockResolvedValue(messages);
      mockDb.analytics.toArray.mockResolvedValue(analytics);

      const exportData = await database.exportData();

      expect(exportData).toEqual({
        connections,
        messages,
        analytics,
        exportedAt: expect.any(Date),
      });
    });

    it('should import data', async () => {
      const importData = {
        connections: [{ id: 'conn1' }],
        messages: [{ messageId: 'msg1' }],
        analytics: [{ connectionId: 'conn1' }],
        exportedAt: new Date(),
      };

      mockDb.connections.put.mockResolvedValue(undefined);
      mockDb.messages.put.mockResolvedValue(undefined);
      mockDb.analytics.put.mockResolvedValue(undefined);

      await database.importData(importData);

      expect(mockDb.connections.put).toHaveBeenCalledWith({ id: 'conn1' });
      expect(mockDb.messages.put).toHaveBeenCalledWith({ messageId: 'msg1' });
      expect(mockDb.analytics.put).toHaveBeenCalledWith({ connectionId: 'conn1' });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      mockDb.connections.get.mockRejectedValue(error);

      await expect(database.getConnection('test')).rejects.toThrow('Database error');
    });

    it('should handle transaction errors', async () => {
      const error = new Error('Transaction failed');
      mockDb.messages.put.mockRejectedValue(error);

      await expect(database.saveMessages([{} as ServiceBusMessage])).rejects.toThrow('Transaction failed');
    });
  });
});