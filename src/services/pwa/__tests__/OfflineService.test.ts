/**
 * OfflineService Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineService } from '../OfflineService';
import type { ServiceBusMessage } from '../../storage/types';

// Mock dependencies
vi.mock('../PWAService', () => ({
  pwaService: {
    isOnline: vi.fn(() => true),
    onNetworkChange: vi.fn(() => vi.fn())
  }
}));

vi.mock('../../storage/SecureStorageService', () => ({
  secureStorage: {
    getMessages: vi.fn(),
    storeAnalytics: vi.fn(),
    updateFieldAnalytics: vi.fn(),
    getStorageStats: vi.fn(() => Promise.resolve({
      totalSize: 1024 * 1024,
      messageCount: 100,
      analyticsCount: 5
    })),
    exportData: vi.fn(() => Promise.resolve({ test: 'data' })),
    importData: vi.fn(() => Promise.resolve())
  }
}));

vi.mock('../../worker/AnalyticsWorkerService', () => ({
  getAnalyticsWorkerService: vi.fn(() => ({
    analyzeMessages: vi.fn(() => Promise.resolve({
      analytics: {
        connectionId: 'test',
        totalMessages: 10,
        messageTypes: {},
        fieldAnalytics: {},
        timeSeriesData: [],
        correlationMatrix: [],
        lastUpdated: new Date()
      },
      fieldAnalytics: {}
    }))
  }))
}));

describe('OfflineService', () => {
  let offlineService: OfflineService;
  let mockLocalStorage: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {};
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
        clear: vi.fn(() => {
          mockLocalStorage = {};
        })
      },
      writable: true
    });

    // Mock Blob
    global.Blob = class MockBlob {
      constructor(public content: any[], public options: any = {}) {}
      get type() { return this.options.type || ''; }
      text() { return Promise.resolve(this.content.join('')); }
    } as any;

    offlineService = new OfflineService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOfflineStatus', () => {
    it('should return current offline status', async () => {
      const status = await offlineService.getOfflineStatus();
      
      expect(status).toEqual({
        isOnline: true,
        lastSync: null,
        pendingOperations: 0,
        conflicts: 0,
        storageUsage: {
          totalSize: 1024 * 1024,
          messageCount: 100,
          analyticsCount: 5
        },
        syncInProgress: false
      });
    });
  });

  describe('queueOperation', () => {
    it('should queue an operation for later execution', async () => {
      const operation = {
        type: 'send' as const,
        entityName: 'test-queue',
        data: { message: 'test' },
        maxRetries: 3
      };

      const operationId = await offlineService.queueOperation(operation);
      
      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/);
      
      const pendingOps = offlineService.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0]!.type).toBe('send');
      expect(pendingOps[0]!.entityName).toBe('test-queue');
      expect(pendingOps[0]!.status).toBe('pending');
    });

    it('should save pending operations to localStorage', async () => {
      const operation = {
        type: 'delete' as const,
        entityName: 'test-queue',
        data: { messageId: '123' },
        maxRetries: 3
      };

      await offlineService.queueOperation(operation);
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'offline-pending-operations',
        expect.stringContaining('"type":"delete"')
      );
    });
  });

  describe('cancelOperation', () => {
    it('should cancel a pending operation', async () => {
      const operation = {
        type: 'send' as const,
        entityName: 'test-queue',
        data: { message: 'test' },
        maxRetries: 3
      };

      const operationId = await offlineService.queueOperation(operation);
      const cancelled = await offlineService.cancelOperation(operationId);
      
      expect(cancelled).toBe(true);
      expect(offlineService.getPendingOperations()).toHaveLength(0);
    });

    it('should return false for non-existent operation', async () => {
      const cancelled = await offlineService.cancelOperation('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('analyzeMessagesOffline', () => {
    it('should analyze provided messages offline', async () => {
      const messages: ServiceBusMessage[] = [
        {
          messageId: '1',
          sequenceNumber: '1',
          enqueuedTimeUtc: new Date(),
          body: { test: 'data' },
          properties: {},
          deliveryCount: 1,
          jsonFields: { test: 'data' },
          analyzedAt: new Date(),
          connectionId: 'test',
          queueOrTopicName: 'test-queue'
        }
      ];

      const result = await offlineService.analyzeMessagesOffline('test-connection', messages);
      
      expect(result.isFromCache).toBe(true);
      expect(result.analytics).toBeDefined();
      expect(result.fieldAnalytics).toBeDefined();
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });

    it('should throw error when no messages available', async () => {
      const { secureStorage } = await import('../../storage/SecureStorageService');
      vi.mocked(secureStorage.getMessages).mockResolvedValue([]);

      await expect(
        offlineService.analyzeMessagesOffline('test-connection')
      ).rejects.toThrow('No messages available for offline analysis');
    });
  });

  describe('handleSyncConflict', () => {
    it('should handle local resolution', async () => {
      // First create a conflict
      const conflict = {
        id: 'conflict-1',
        type: 'message' as const,
        localData: { local: 'data' },
        remoteData: { remote: 'data' },
        timestamp: new Date()
      };

      // Manually add conflict to test resolution
      (offlineService as any).syncConflicts.set(conflict.id, conflict);

      await offlineService.handleSyncConflict(conflict.id, 'local');
      
      const conflicts = offlineService.getSyncConflicts();
      expect(conflicts).toHaveLength(0);
    });

    it('should throw error for non-existent conflict', async () => {
      await expect(
        offlineService.handleSyncConflict('non-existent', 'local')
      ).rejects.toThrow('Conflict not found');
    });
  });

  describe('exportOfflineData', () => {
    it('should export offline data as blob', async () => {
      const blob = await offlineService.exportOfflineData();
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
      
      const text = await blob.text();
      const data = JSON.parse(text);
      
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('pendingOperations');
      expect(data).toHaveProperty('conflicts');
      expect(data).toHaveProperty('exportedAt');
    });
  });

  describe('importOfflineData', () => {
    it('should import offline data from blob', async () => {
      const exportData = {
        data: { test: 'data' },
        pendingOperations: [{
          id: 'op-1',
          type: 'send',
          entityName: 'test',
          data: {},
          timestamp: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
          status: 'pending'
        }],
        conflicts: [],
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData)], { type: 'application/json' });
      
      await offlineService.importOfflineData(blob);
      
      const pendingOps = offlineService.getPendingOperations();
      expect(pendingOps).toHaveLength(1);
      expect(pendingOps[0]!.id).toBe('op-1');
    });

    it('should throw error for invalid data', async () => {
      const blob = new Blob(['invalid json'], { type: 'application/json' });
      
      await expect(
        offlineService.importOfflineData(blob)
      ).rejects.toThrow('Failed to import offline data');
    });
  });

  describe('status change notifications', () => {
    it('should notify subscribers of status changes', async () => {
      const callback = vi.fn();
      const unsubscribe = offlineService.onStatusChange(callback);
      
      // Queue an operation to trigger status change
      await offlineService.queueOperation({
        type: 'send',
        entityName: 'test',
        data: {},
        maxRetries: 3
      });
      
      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).toHaveBeenCalled();
      
      unsubscribe();
      
      // Should not be called after unsubscribe
      callback.mockClear();
      await offlineService.queueOperation({
        type: 'send',
        entityName: 'test2',
        data: {},
        maxRetries: 3
      });
      
      // Wait for potential async notification
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(callback).not.toHaveBeenCalled();
    });
  });
});